import fetch from "node-fetch"
import AsyncLock from "async-lock"
import dotenv from "dotenv"
import { profileMemberSummary } from "./senither/profile.js" 
import config from "./config.json" assert { type: "json" }

dotenv.config()

const isNotNull = <T>(value: T | undefined): value is T => value != null

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function parseIntOrDefault(str: string | null, num: number): number {
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

export type ProfileResponse = {
  uuid: string
  timestamp: number
  name: string
  id: string
  mythosKills: number
}

export type PlayerResponse = {
  uuid: string
  name: string
}

async function playerData(uuid: string): Promise<PlayerResponse | undefined> {
  try {
    const player: any = await fetchHypixel(`https://api.hypixel.net/player?uuid=${uuid}&key=${config.apiKey}`)
    const name = player.player?.displayname as string | undefined
    return (name != null) ? { uuid: uuid, name: name } : undefined
  } catch (e) {
    console.log(e)
    return undefined
  } 
}

async function profileData(uuid: string): Promise<ProfileResponse | undefined> {
  try {
    const profile: any = await fetchHypixel(`https://api.hypixel.net/skyblock/profiles?uuid=${uuid}&key=${config.apiKey}`)
    return profile?.profiles?.map((profile: any) => {
      const profileSummary = profileMemberSummary(profile.members[uuid])
      return { 
        uuid: uuid, 
        timestamp: Date.now(),
        name: profile.cute_name,
        id: profile.profile_id,
        mythosKills: profileSummary.misc.mythosKills ?? 0
      }
    }).reduce((previous: any, current: any) => previous.mythosKills > current.mythosKills ? previous : current)
  } catch (e) {
    console.log(e)
    return undefined
  }
}

export async function guildMembers(guildId: string) {
  const response: any = await fetchHypixel(`https://api.hypixel.net/guild?id=${guildId}&key=${config.apiKey}`)
  return response?.guild?.members.map((member: any) => member.uuid) as Array<string>
}

export async function playersData(uuids: string[]): Promise<PlayerResponse[]> {
  return (await Promise.all(uuids.map(uuid => playerData(uuid)))).filter(isNotNull) 
}

export async function profilesData(uuids: string[]) {
  return (await Promise.all(uuids.map(uuid => profileData(uuid)))).filter(isNotNull) 
}
