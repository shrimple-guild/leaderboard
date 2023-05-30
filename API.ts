import axios, { AxiosInstance } from 'axios';
import axiosRetry, { isNetworkOrIdempotentRequestError as isNetworkError } from 'axios-retry';
import rateLimit from 'axios-rate-limit';
import creatures from "./creatures.json" assert { type: "json" }
import { Metric, Profile } from 'types';

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
        profileId: profile.profile_id.replaceAll("-", ""),
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
    return this.metrics.map(metric => ({
      metric: metric.name,
      value: getMetric(member, metric)
    })).filter(obj => obj.value != null) as {metric: string, value: number}[]
  }
}

function getMetric(member: any, metric: Metric): number | undefined {
  if (metric.path) {
    return metric.path.split(".").reduce((obj, attribute) => obj?.[attribute], member)
  } else if (metric.name == "Shark Kills") {
    return sumKills(member, creatures.shark)
  } else if (metric.name == "Water Kills") {
    const waterMobs = [creatures.shark, creatures.special, creatures.water].flat()
    return sumKills(member, waterMobs)
  } else if (metric.name == "Crimson Kills") {
    return sumKills(member, creatures.crimson)
  } else if (metric.name == "Dungeon Completions") {
    const normalCompletions: any[] = Object.values(member.dungeons?.dungeon_types?.catacombs?.tier_completions ?? {})
    const masterCompletions: any[] = Object.values(member.dungeons?.dungeon_types?.master_catacombs?.tier_completions ?? {})
    return [...normalCompletions, ...masterCompletions].reduce((cum, cur) => cum + cur, 0)
  } else if (metric.name == "Slayer Weight") {
    return (member.slayer_bosses?.zombie?.xp ?? 0) * 0.06 
      + (member.slayer_bosses?.spider?.xp ?? 0) * 0.09 
      + (member.slayer_bosses?.wolf?.xp ?? 0) * 0.30
      + (member.slayer_bosses?.enderman?.xp ?? 0) * 0.33
      + (member.slayer_bosses?.blaze?.xp ?? 0)
  } else if (metric.name == "Mithril Powder") {
    return (member.mining_core?.powder_mithril ?? 0) + (member.mining_core?.powder_spent_mithril ?? 0)
  } else if (metric.name == "Gemstone Powder") {
    return (member.mining_core?.powder_gemstone ?? 0) + (member.mining_core?.powder_spent_gemstone ?? 0)
  } else if (metric.name == "Linc Weight") {
    return (member.experience_skill_fishing ?? 0) * 0.2
      + (member.experience_skill_mining ?? 0) * 0.2
      + (member.experience_skill_foraging ?? 0) * 1.33
      + (member.experience_skill_farming ?? 0) 
      + (member.experience_skill_enchanting ?? 0) * 0.01
      + (member.experience_skill_carpentry ?? 0) * 0.01
      + (member.slayer_bosses?.zombie?.xp ?? 0) * 3.12
      + (member.slayer_bosses?.spider?.xp ?? 0) * 4.88
      + (member.slayer_bosses?.wolf?.xp ?? 0) * 16.13
      + (member.slayer_bosses?.enderman?.xp ?? 0) * 18.18
      + (member.slayer_bosses?.blaze?.xp ?? 0) * 52.63
      + (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[1] ?? 0) * 25000
      + (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[2] ?? 0) * 25000
      + (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[3] ?? 0) * 25000
      + (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[4] ?? 0) * 42000
      + (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[5] ?? 0) * 33000
      + (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[6] ?? 0) * 50000
      + (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[7] ?? 0) * 143000
      + (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[1] ?? 0) * 33000
      + (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[2] ?? 0) * 33000
      + (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[3] ?? 0) * 42000
      + (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[4] ?? 0) * 50000
      + (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[5] ?? 0) * 42000
      + (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[6] ?? 0) * 59000
      + (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[7] ?? 0) * 125000
      + (member.stats.mythos_kills ?? 0) * 3650
      + (member.leveling?.experience ?? 0) * 1000
  }
}

function sumKills(member: any, mobs: string[]) {
  return mobs.reduce((cum, cur) => (
    cum + (member?.stats?.[`kills_${cur}`] ?? 0)
  ), 0)
}










