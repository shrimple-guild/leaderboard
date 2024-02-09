import axios, { AxiosInstance } from "axios"
import axiosRetry, { isNetworkOrIdempotentRequestError as isNetworkError } from "axios-retry"
import rateLimit from "axios-rate-limit"
import { Profile } from "types"
import { LRUCache } from "lru-cache"

export class API {
  client: AxiosInstance
  private nameCache: LRUCache<string, string>

  constructor(private apiKey: string) {
    this.nameCache = new LRUCache({ max: 1000, ttl: 86400 * 1000 })
    this.client = axios.create({
      timeout: 3000,
      baseURL: "https://api.hypixel.net",
    })
    rateLimit(this.client, { maxRequests: 2, perMilliseconds: 1000 })
    axiosRetry(this.client, {
      retries: 3,
      shouldResetTimeout: true,
      retryCondition: e => isNetworkError(e) || e.code == "ECONNABORTED",
      retryDelay: axiosRetry.exponentialDelay,
    })
  }

  async fetchGuildMembers(guildId: string) {
    const response = await this.client.get("/guild", {
      params: { id: guildId, key: this.apiKey },
    })
    return response.data?.guild?.members.map((member: any) => member.uuid) as Array<string>
  }

  async fetchProfiles(uuid: string): Promise<Profile[]> {
    const profile = await this.client.get(`/skyblock/profiles`, {
      params: { uuid: uuid, key: this.apiKey },
    })
    return (profile.data.profiles as any[])?.map((profile: any) => {
      const member = profile.members[uuid]
      return {
        playerId: uuid,
        profileId: profile.profile_id.replaceAll("-", ""),
        cuteName: profile.cute_name,
        data: member,
      }
    })
  }

  async fetchName(uuid: string): Promise<string> {
    const cachedName = this.nameCache.get(uuid)
    if (cachedName) {
      return cachedName
    }
    const resp = await fetch(`https://mowojang.matdoes.dev/session/minecraft/profile/${uuid}`)
    if (resp.status != 200) throw new Error(`Failed to get Mojang data for ${uuid} (status ${resp.status})`)
    const name = await resp.json().then(data => data.name)
    this.nameCache.set(uuid, name)
    return name
  }
}

function sumKills(member: any, mobs: string[]) {
  return mobs.reduce((cum, cur) => cum + (member?.stats?.[`kills_${cur}`] ?? 0), 0)
}

const trophyFishBase: Record<string, number> = {
  golden_fish: 400,
  karate_fish: 160,
  soul_fish: 80,
  moldfin: 80,
  skeleton_fish: 80,
  vanille: 90,
  volcanic_stonefish: 16,
  mana_ray: 40,
  lava_horse: 32,
  flyfish: 12,
  slugfish: 370,
  obfuscated_fish_3: 40,
  blobfish: 8,
  obfuscated_fish_2: 22,
  gusher: 8,
  obfuscated_fish_1: 0,
  steaming_hot_flounder: 5,
  sulphur_skitter: 2,
}

const trophyFishMultipliers: Record<string, number> = {
  bronze: 1,
  silver: 2.5,
  gold: 21.7391304348,
  diamond: 86.9565217391,
}

const trophyFishWeights: Record<string, number> = {}

for (const baseKey in trophyFishBase) {
  for (const multiplierKey in trophyFishMultipliers) {
    const concatenatedKey = `${baseKey}_${multiplierKey}`
    const baseValue = trophyFishBase[baseKey]
    const multiplierValue = trophyFishMultipliers[multiplierKey]
    trophyFishWeights[concatenatedKey] = baseValue * multiplierValue
  }
}

function trophyFishWeight(trophyFish: Record<string, number | undefined>): number {
  const weights = Object.entries(trophyFishWeights).map(([fish, weight]) => (trophyFish?.[fish] ?? 0) * weight)
  return weights.reduce((prev, cur) => prev + cur, 0)
}

const potmMithril = [0, 0, 50_000, 125_000, 225_000, 350_000, 350_000, 350_000]
const potmGemstone = [0, 0, 0, 0, 0, 0, 500_000, 1_250_000]
