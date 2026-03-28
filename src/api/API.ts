import axios, { AxiosInstance } from "axios"
import axiosRetry, { isNetworkOrIdempotentRequestError as isNetworkError } from "axios-retry"
import rateLimit from "axios-rate-limit"
import { Metric, Profile } from "../core/types.js"
import { getMetricValue } from "./calculators/index.js"
import { LRUCache } from "lru-cache"

export class API {
  client: AxiosInstance
  private nameCache: LRUCache<string, string>

  constructor(private apiKey: string, private metrics: Metric[]) {
    this.nameCache = new LRUCache({ max: 1000, ttl: 86400 * 1000 })
    this.client = axios.create({
      timeout: 3000,
      baseURL: "https://api.hypixel.net",
    })
    
    // Rate limit to 2 requests per second to stay within Hypixel limits
    rateLimit(this.client, { maxRequests: 2, perMilliseconds: 1000 })
    
    // Exponential retry for network errors or rate limits
    axiosRetry(this.client, {
      retries: 3,
      shouldResetTimeout: true,
      retryCondition: e => isNetworkError(e) || e.code == "ECONNABORTED",
      retryDelay: axiosRetry.exponentialDelay,
    })
  }

  /**
   * Fetches all member UUIDs for a given Hypixel Guild ID.
   */
  async fetchGuildMembers(guildId: string): Promise<string[]> {
    const response = await this.client.get("/guild", {
      params: { id: guildId, key: this.apiKey },
    })
    return response.data?.guild?.members.map((member: any) => member.uuid) as Array<string>
  }

  /**
   * Fetches all Skyblock profiles for a given player UUID.
   */
  async fetchProfiles(uuid: string): Promise<Profile[]> {
    const profile = await this.client.get(`/v2/skyblock/profiles`, {
      params: { uuid: uuid, key: this.apiKey },
    })
    
    return (profile.data.profiles as any[])?.map((profile: any) => {
      const profileMetrics = this.calculateMemberMetrics(profile.members[uuid])
      return {
        playerId: uuid,
        profileId: profile.profile_id.replaceAll("-", ""),
        cuteName: profile.cute_name,
        metrics: profileMetrics,
        raw: JSON.stringify(profile),
      }
    })
  }

  /**
   * Fetches and caches the Minecraft username for a given UUID using a Mojang API proxy.
   */
  async fetchName(uuid: string): Promise<string> {
    const cachedName = this.nameCache.get(uuid)
    if (cachedName) return cachedName

    const resp = await fetch(`https://mowojang.matdoes.dev/session/minecraft/profile/${uuid}`)
    if (resp.status != 200) throw new Error(`Failed to get Mojang data for ${uuid} (status ${resp.status})`)
    
    const name = await resp.json().then(data => data.name)
    this.nameCache.set(uuid, name)
    return name
  }

  /**
   * Calculates all metrics for a specific profile member.
   */
  private calculateMemberMetrics(member: any): { metric: string; value: number }[] {
    // Basic guard: if experience is missing, API access is likely disabled for this profile
    if (member.player_data?.experience == null) {
      return []
    }

    return this.metrics
      .map(metric => {
        let value: number | undefined

        // If the metric has a direct JSON path, use it. Otherwise, use the specialized calculators.
        if (metric.path) {
          value = metric.path.split(".").reduce((obj, attribute) => obj?.[attribute], member)
        } else {
          value = getMetricValue(member, metric.name)
        }

        return { metric: metric.name, value: value! }
      })
      .filter(obj => obj.value != null)
  }
}
