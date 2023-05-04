import axios, { AxiosInstance } from 'axios';
import axiosRetry, { isNetworkOrIdempotentRequestError as isNetworkError } from 'axios-retry';
import rateLimit from 'axios-rate-limit';
import { Metric, Profile } from "./types";

export class API {
  client: AxiosInstance

  constructor(private apiKey: string, private metrics: Metric[]) {
    this.client = axios.create({ timeout: 3000, baseURL: "https://api.hypixel.net" })
    rateLimit(this.client, { maxRequests: 2, perMilliseconds: 1000 })
    axiosRetry(this.client, { 
      retries: 3, 
      shouldResetTimeout: true,
      retryCondition: e => isNetworkError(e) || e.code == "ECONNABORTED",
      retryDelay: axiosRetry.exponentialDelay
    })
  }

  async fetchGuildMembers(guildId: string) {
    const response = await this.client.get("/guild", { params: { id: guildId, key: this.apiKey }})
    return response.data?.guild?.members.map((member: any) => member.uuid) as Array<string>
  }

  async fetchProfiles(uuid: string): Promise<Profile[]> {
    const profile = await this.client.get(`/skyblock/profiles`, { params: { uuid: uuid, key: this.apiKey }})
    return (profile.data.profiles as any[])?.map((profile: any) => {
      const profileMetrics = this.fetchMetrics(profile.members[uuid])
      return {
        playerId: uuid,
        profileId: profile.profile_id,
        cuteName: profile.cute_name,
        metrics: profileMetrics
      }
    }) 
  }
  
  async fetchName(uuid: string): Promise<string> {
    const resp = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`)
    if (resp.status != 200) throw new Error(`Failed to get Mojang data for ${uuid} (status ${resp.status})`)
    return resp.json().then(data => data.name)
  }

  private fetchMetrics(member: any): {metric: string, value: number}[] {
    return this.metrics.map(({name, path}) => ({
      metric: name,
      value: path.split(".").reduce((obj, attribute) => obj?.[attribute], member)
    })).filter(obj => obj.value != null)
  }
}









