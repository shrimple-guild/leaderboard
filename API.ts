import axios, { AxiosInstance } from "axios"
import axiosRetry, { isNetworkOrIdempotentRequestError as isNetworkError } from "axios-retry"
import rateLimit from "axios-rate-limit"
import creatures from "./creatures.json" assert { type: "json" }
import { Metric, Profile } from "types"
import { getBestiaryTiers, getMythologicalKills, getRareSeaCreatureScore } from "./bestiary.js"

export class API {
  client: AxiosInstance

  constructor(private apiKey: string, private metrics: Metric[]) {
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
      const profileMetrics = this.fetchMetrics(profile.members[uuid])
      return {
        playerId: uuid,
        profileId: profile.profile_id.replaceAll("-", ""),
        cuteName: profile.cute_name,
        metrics: profileMetrics,
      }
    })
  }

  async fetchName(uuid: string): Promise<string> {
    const resp = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`)
    if (resp.status != 200) throw new Error(`Failed to get Mojang data for ${uuid} (status ${resp.status})`)
    return resp.json().then(data => data.name)
  }

  private fetchMetrics(member: any): { metric: string; value: number }[] {
    return this.metrics
      .map(metric => ({
        metric: metric.name,
        value: getMetric(member, metric),
      }))
      .filter(obj => obj.value != null) as { metric: string; value: number }[]
  }
}

function getMetric(member: any, metric: Metric): number | undefined {
  const mining = member.mining_core

  const totalMithril =
    (mining?.powder_mithril ?? 0) +
    (mining?.powder_spent_mithril ?? 0) +
    (potmMithril[mining?.nodes?.special_0 ?? 0] ?? 0)

  const totalGemstone =
    (mining?.powder_gemstone ?? 0) +
    (mining?.powder_spent_gemstone ?? 0) +
    (potmGemstone[mining?.nodes?.special_0 ?? 0] ?? 0)

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
    const masterCompletions: any[] = Object.values(
      member.dungeons?.dungeon_types?.master_catacombs?.tier_completions ?? {}
    )
    return [...normalCompletions, ...masterCompletions].reduce((cum, cur) => cum + cur, 0)
  } else if (metric.name == "Slayer Weight") {
    return (
      (member.slayer_bosses?.zombie?.xp ?? 0) * 0.06 +
      (member.slayer_bosses?.spider?.xp ?? 0) * 0.09 +
      (member.slayer_bosses?.wolf?.xp ?? 0) * 0.3 +
      (member.slayer_bosses?.enderman?.xp ?? 0) * 0.33 +
      (member.slayer_bosses?.blaze?.xp ?? 0) +
      (member.slayer_bosses?.vampire?.xp ?? 0) * 10
    )
  } else if (metric.name == "Mithril Powder") {
    return totalMithril
  } else if (metric.name == "Gemstone Powder") {
    return totalGemstone
  } else if (metric.name == "Linc Weight") {
    return (
      (member.experience_skill_fishing ?? 0) * 0.2 +
      (member.experience_skill_mining ?? 0) * 0.2 +
      (member.experience_skill_foraging ?? 0) * 1.33 +
      (member.experience_skill_farming ?? 0) +
      (member.experience_skill_enchanting ?? 0) * 0.01 +
      (member.experience_skill_carpentry ?? 0) * 0.01 +
      (member.slayer_bosses?.zombie?.xp ?? 0) * 3.12 +
      (member.slayer_bosses?.spider?.xp ?? 0) * 4.88 +
      (member.slayer_bosses?.wolf?.xp ?? 0) * 16.13 +
      (member.slayer_bosses?.enderman?.xp ?? 0) * 18.18 +
      (member.slayer_bosses?.blaze?.xp ?? 0) * 52.63 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[1] ?? 0) * 25000 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[2] ?? 0) * 25000 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[3] ?? 0) * 25000 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[4] ?? 0) * 42000 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[5] ?? 0) * 33000 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[6] ?? 0) * 50000 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[7] ?? 0) * 110000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[1] ?? 0) * 33000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[2] ?? 0) * 33000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[3] ?? 0) * 42000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[4] ?? 0) * 50000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[5] ?? 0) * 42000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[6] ?? 0) * 59000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[7] ?? 0) * 125000 +
      (member.stats?.mythos_kills ?? 0) * 3650 +
      (member.leveling?.experience ?? 0) * 1000
    )
  } else if (metric.name == "Powder Score") {
    return totalMithril + totalGemstone
  } else if (metric.name == "Fishing Actions") {
    return (member.stats?.pet_milestone_sea_creatures_killed ?? 0) + (member.stats?.items_fished ?? 0)
  } else if (metric.name == "Trophy Fish Weight") {
    return trophyFishWeight(member.trophy_fish)
  } else if (metric.name == "Marina Fishing Weight") {
    if (member.experience_skill_fishing == null) return undefined
    return sumKills(member, creatures.shark) * 9_000 + member.experience_skill_fishing
  } else if (metric.name == "Bestiary Tiers") {
    return getBestiaryTiers(member)?.total
  } else if (metric.name == "Inquisitor Bestiary") {
    return getMythologicalKills(member)?.inquisitors
  } else if (metric.name == "Mythological Bestiary") {
    return getMythologicalKills(member)?.mythologicalKills
  } else if (metric.name == "Skill Weight") {
    if (
      member.experience_skill_fishing == null &&
      member.experience_skill_mining == null &&
      member.experience_skill_combat == null &&
      member.experience_skill_foraging == null &&
      member.experience_skill_farming == null &&
      member.experience_skill_enchanting == null &&
      member.experience_skill_alchemy == null &&
      member.experience_skill_carpentry == null
    ) {
      return undefined
    }
    return (
      (member.experience_skill_fishing ?? 0) * 0.4 +
      (member.experience_skill_mining ?? 0) * 0.2 +
      (member.experience_skill_combat ?? 0) * 1.2 +
      (member.experience_skill_foraging ?? 0) * 1.33 +
      (member.experience_skill_farming ?? 0) +
      (member.experience_skill_enchanting ?? 0) * 0.01 +
      (member.experience_skill_alchemy ?? 0) * 0.002 +
      (member.experience_skill_carpentry ?? 0) * 0.002 +
      (member.experience_skill_social2 ?? 0) * 7.77
    )
  } else if (metric.name == "Dungeon Boss Collections") {
    const catacombs = member.dungeons?.dungeon_types?.catacombs?.tier_completions
    const masterModeCatacombs = member.dungeons?.dungeon_types?.master_catacombs?.tier_completions
    const penalty = 0.75
    const f1 = (catacombs?.[1] ?? 0) + 2 * (masterModeCatacombs?.[1] ?? 0)
    const f2 = (catacombs?.[2] ?? 0) + 2 * (masterModeCatacombs?.[2] ?? 0)
    const f3 = (catacombs?.[3] ?? 0) + 2 * (masterModeCatacombs?.[3] ?? 0)
    const f4 = (catacombs?.[4] ?? 0) + 2 * (masterModeCatacombs?.[4] ?? 0)
    const f5 = (catacombs?.[5] ?? 0) + 2 * (masterModeCatacombs?.[5] ?? 0)
    const f6 = (catacombs?.[6] ?? 0) + 2 * (masterModeCatacombs?.[6] ?? 0)
    const f7 = (catacombs?.[7] ?? 0) + 2 * (masterModeCatacombs?.[7] ?? 0)

    return (
      (Math.min(1000, f1) + Math.max(0, f1 - 1000) * penalty) * 33 +
      (Math.min(1000, f2) + Math.max(0, f2 - 1000) * penalty) * 33 +
      (Math.min(1000, f3) + Math.max(0, f3 - 1000) * penalty) * 38 +
      (Math.min(1000, f4) + Math.max(0, f4 - 1000) * penalty) * 50 +
      (Math.min(1000, f5) + Math.max(0, f5 - 1000) * penalty) * 42 +
      (Math.min(1000, f6) + Math.max(0, f6 - 1000) * penalty) * 45 +
      (Math.min(1000, f7) + Math.max(0, f7 - 1000) * penalty) * 116
    )
  } else if (metric.name == "Rare Sea Creature Score") {
    return getRareSeaCreatureScore(member)
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
  vanille: 80,
  volcanic_stonefish: 24,
  mana_ray: 40,
  lava_horse: 32,
  flyfish: 12,
  slugfish: 250,
  obfuscated_fish_3: 40,
  blobfish: 8,
  obfuscated_fish_2: 22,
  gusher: 8,
  obfuscated_fish_1: 64,
  steaming_hot_flounder: 4,
  sulphur_skitter: 2,
}

const trophyFishMultipliers: Record<string, number> = {
  bronze: 1,
  silver: 2.5,
  gold: 25,
  diamond: 100,
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
