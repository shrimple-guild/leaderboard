import AsyncLock from "async-lock"
import config from "./config.json" assert { type: "json" }
import creatures from "./creatures.json" assert { type: "json" }

export type ProfileMetrics = {
  fishingXp: number | undefined, 
  fishingTrophy: number, 
  fishingItems: number,
  fishingCreatures: number,
  fishingActions: number
}

export type Profile = {
  playerId: string,
  profileId: string,
  cuteName: string,
  metrics: ProfileMetrics
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseIntOrDefault(str: string | null, num: number): number {
  return (str != null) ? (parseInt(str) || num) : num
}

const fetchHypixel = (() => {
  const remainingRequestsAllowable = 30
  let lock = new AsyncLock()
  return async (url: string) => {
    return lock.acquire("hypixel", async () => {
      const response = await fetch(url)
      if (response.status == 200) {
        const ratelimitRemaining = parseIntOrDefault(response.headers.get("ratelimit-remaining"), 0)
        const ratelimitReset = parseIntOrDefault(response.headers.get("ratelimit-reset"), 60)  
        if (ratelimitRemaining <= remainingRequestsAllowable) await sleep(ratelimitReset * 1000)
        return response.json()
      } else {
        await sleep(parseIntOrDefault(response.headers.get("retry-after"), 60) * 1000)
        throw new Error(`Hypixel API returned status ${response.status} with url ${url}`)
      }
    })
  }
})()

export async function guildMembers(guildId: string) {
  const response: any = await fetchHypixel(`https://api.hypixel.net/guild?id=${guildId}&key=${config.apiKey}`)
  return response?.guild?.members.map((member: any) => member.uuid) as Array<string>
}

export async function fetchName(uuid: string): Promise<string> {
  const resp = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`)
  if (resp.status != 200) throw new Error(`Failed to get Mojang data for ${uuid} (status ${resp.status})`)
  return resp.json().then(data => data.name)
}

export async function fetchProfiles(uuid: string): Promise<Profile[]> {
  const profile = await fetchHypixel(`https://api.hypixel.net/skyblock/profiles?uuid=${uuid}&key=${config.apiKey}`)
  return (profile?.profiles as any[])?.map((profile: any) => {
    const profileMetrics = getMetrics(profile.members[uuid])
    return {
      playerId: uuid,
      profileId: profile.profile_id,
      cuteName: profile.cute_name,
      metrics: profileMetrics
    }
  }) 
}

function getMetrics(member: any): ProfileMetrics {
  const stats: { [key: string]: number | undefined } = member?.stats ?? {}
  const fishingCreatures = creatures.map(creature => ({
    creature: creature,
    kills: stats[`kills_${creature}`] ?? 0
  })).reduce((partialKills, data) => partialKills + data.kills, 0)
  const fishingItems = member?.stats?.items_fished ?? 0
  return {
    fishingXp: member?.experience_skill_fishing,
    fishingTrophy: member?.trophy_fish?.total_caught ?? 0,
    fishingItems: fishingItems, 
    fishingCreatures: fishingCreatures,
    fishingActions: fishingItems + fishingCreatures,
  }
}
