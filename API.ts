import axios, { AxiosInstance } from "axios"
import axiosRetry, { isNetworkOrIdempotentRequestError as isNetworkError } from "axios-retry"
import rateLimit from "axios-rate-limit"
import creatures from "./creatures.json" with { type: "json" }
import { Metric, Profile } from "types"
import { getBestiaryTiers, getEmperorKills, getMythologicalKills, getRareSeaCreatureScore } from "./bestiary.js"
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
    const profile = await this.client.get(`/v2/skyblock/profiles`, {
      params: { uuid: uuid, key: this.apiKey },
    })
    return (profile.data.profiles as any[])?.map((profile: any) => {
      const profileMetrics = this.fetchMetrics(profile.members[uuid])
      return {
        playerId: uuid,
        profileId: profile.profile_id.replaceAll("-", ""),
        cuteName: profile.cute_name,
        metrics: profileMetrics,
        raw: JSON.stringify(profile),
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

  private fetchMetrics(member: any): { metric: string; value: number }[] {
    // guard against skill api disablers destroying events
    if (member.player_data?.experience == null) {
      return []
    }
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
      (member.slayer_bosses?.zombie?.xp ?? 0) * 0.15 +
      (member.slayer_bosses?.spider?.xp ?? 0) * 0.16 +
      (member.slayer_bosses?.wolf?.xp ?? 0) * 0.55 +
      (member.slayer_bosses?.enderman?.xp ?? 0) * 0.75 +
      (member.slayer_bosses?.blaze?.xp ?? 0) * 0.64 +
      (member.slayer_bosses?.vampire?.xp ?? 0) * 31
    )
  } else if (metric.name == "Mithril Powder") {
    return totalMithril
  } else if (metric.name == "Gemstone Powder") {
    return totalGemstone
  } else if (metric.name == "Weighted Dungeon Completions") {
    return (
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[1] ?? 0) * 37500 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[2] ?? 0) * 37500 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[3] ?? 0) * 37500 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[4] ?? 0) * 56000 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[5] ?? 0) * 33000 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[6] ?? 0) * 62000 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[7] ?? 0) * 143000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[1] ?? 0) * 43500 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[2] ?? 0) * 48000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[3] ?? 0) * 56000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[4] ?? 0) * 69000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[5] ?? 0) * 43500 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[6] ?? 0) * 69000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[7] ?? 0) * 154000
    )
  } else if (metric.name == "Jerry Event Score") {
    return (
      (member.player_data?.experience?.SKILL_FISHING ?? 0) * 0.5 +
      (member.player_data?.experience?.SKILL_MINING ?? 0) * 0.17 +
      (member.player_data?.experience?.SKILL_FORAGING ?? 0) * 1.6 +
      (member.player_data?.experience?.SKILL_FARMING ?? 0) * 1 +
      (member.player_data?.experience?.SKILL_ENCHANTING ?? 0) * 0.268 +
      (member.slayer?.slayer_bosses?.zombie?.xp ?? 0) * 3.33 +
      (member.slayer?.slayer_bosses?.spider?.xp ?? 0) * 7.5 +
      (member.slayer?.slayer_bosses?.wolf?.xp ?? 0) * 9.38 +
      (member.slayer?.slayer_bosses?.enderman?.xp ?? 0) * 37.5 +
      (member.slayer?.slayer_bosses?.blaze?.xp ?? 0) * 42.86 +
      (member.slayer?.slayer_bosses?.vampire?.xp ?? 0) * 500 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[1] ?? 0) * 41667 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[2] ?? 0) * 41667 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[3] ?? 0) * 62500 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[4] ?? 0) * 62500 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[5] ?? 0) * 41667 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[6] ?? 0) * 62500 +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[7] ?? 0) * 125000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[1] ?? 0) * 41667 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[2] ?? 0) * 50000 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[3] ?? 0) * 62500 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[4] ?? 0) * 68750 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[5] ?? 0) * 60417 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[6] ?? 0) * 68750 +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[7] ?? 0) * 150000 +
      (member.nether_island_player_data?.kuudra_completed_tiers?.fiery ?? 0) * 37500 +
      (member.nether_island_player_data?.kuudra_completed_tiers?.infernal ?? 0) * 37500 +
      (member.player_stats?.mythos?.kills ?? 0) * 6000 +
      (member.player_stats?.end_island?.dragon_fight?.amount_summoned?.total ?? 0) * 12500
    )
  } else if (metric.name == "Total Powder") {
    return totalMithril + totalGemstone
  } else if (metric.name == "Fishing Actions") {
    return (member.stats?.pet_milestone_sea_creatures_killed ?? 0) + (member.stats?.items_fished ?? 0)
  } else if (metric.name == "Trophy Fish Weight") {
    return trophyFishWeight(member.trophy_fish)
  } else if (metric.name == "Marina Fishing Weight") {
    if (member.experience_skill_fishing == null) return undefined
    return sumKills(member, creatures.shark) * 7_000 + member.experience_skill_fishing
  } else if (metric.name == "Bestiary Tiers") {
    return getBestiaryTiers(member)?.total
  } else if (metric.name == "Inquisitor Bestiary") {
    return getMythologicalKills(member)?.inquisitors
  } else if (metric.name == "Mythological Bestiary") {
    return getMythologicalKills(member)?.mythologicalKills
  } else if (metric.name == "Skill Weight") {
    return (
      ((member.player_data?.experience?.SKILL_FISHING ?? 0) * 0.6) +
      ((member.player_data?.experience?.SKILL_MINING ?? 0) * 0.2) +
      ((member.player_data?.experience?.SKILL_COMBAT ?? 0) * 0.375) +
      ((member.player_data?.experience?.SKILL_FORAGING ?? 0) * 1.6) +
      ((member.player_data?.experience?.SKILL_FARMING ?? 0) * 1.2) +
      ((member.player_data?.experience?.SKILL_ENCHANTING ?? 0) * 0.04) +
      ((member.player_data?.experience?.SKILL_ALCHEMY ?? 0) * 0.002) +
      ((member.player_data?.experience?.SKILL_SOCIAL ?? 0) * 7.77)
    );
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
  } else if (metric.name == "Kuudra Completions") {
    const tiers = member.nether_island_player_data?.kuudra_completed_tiers
    return (tiers?.none ?? 0) + (tiers?.hot ?? 0) + (tiers?.burning ?? 0) + (tiers?.fiery ?? 0) + (tiers?.infernal ?? 0)
  } else if (metric.name == "Kuudra Completions (T4/5)") {
    const tiers = member.nether_island_player_data?.kuudra_completed_tiers
    return (tiers?.fiery ?? 0) + (tiers?.infernal ?? 0)
  } else if (metric.name == "Dungeon Completions") {
    return (
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[1] ?? 0) +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[2] ?? 0) +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[3] ?? 0) +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[4] ?? 0) +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[5] ?? 0) +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[6] ?? 0) +
      (member.dungeons?.dungeon_types?.catacombs?.tier_completions?.[7] ?? 0) +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[1] ?? 0) +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[2] ?? 0) +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[3] ?? 0) +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[4] ?? 0) +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[5] ?? 0) +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[6] ?? 0) +
      (member.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[7] ?? 0)
    )
  } else if (metric.name == "Sea Emperor Bestiary") {
    return getEmperorKills(member)
  } else if (metric.name == "Trapper Kills") {
    const kills = member.player_stats?.kills
    return (kills?.trapper_cow ?? 0) + 
      (kills?.trapper_chicken ?? 0) + 
      (kills?.trapper_sheep ?? 0) + 
      (kills?.trapper_pig ?? 0) + 
      (kills?.trapper_rabbit ?? 0) + 
      (kills?.trapper_horse ?? 0)
  } else if (metric.name == "Stat {} + []") {
    return getTotalFailedBosses(member)
  } else if (metric.name == "Shrimple Weight") {
    return (
      getTotalFailedBosses(member) * 12 +
      (member.glacite_player_data?.mineshafts_entered ?? 0) * 144 +
      (member.player_stats?.end_island?.summoning_eyes_collected) * 660 +
      (member.player_stats?.gifts?.total_received ?? 0) * 2 +
      (member.player_stats?.rift?.west_hot_dogs_given ?? 0) * 2 +
      (member.player_stats?.glowing_mushrooms_broken ?? 0) * 1 +
      (member.rift?.village_plaza?.lonely?.seconds_sitting ?? 0) * 1
    )
  }
}

function getTotalFailedBosses(member: any) {
  const bosses = member.slayer?.slayer_bosses
  return getFailedBosses(bosses?.zombie) + 
    getFailedBosses(bosses?.spider) +
    getFailedBosses(bosses?.wolf) +
    getFailedBosses(bosses?.enderman) +
    getFailedBosses(bosses?.blaze) +
    getFailedBosses(bosses?.vampire)
}

function getFailedBosses(slayerData: any) {
  if (slayerData == null) return 0
  let totalKills = 0
  let totalAttempts = 0
  for (let i = 0; i < 5; i++) {
    totalKills += slayerData[`boss_kills_tier_${i}`] ?? 0
    totalAttempts += slayerData[`boss_attempts_tier_${i}`] ?? 0
  }
  return totalAttempts - totalKills
}

function sumKills(member: any, mobs: string[]) {
  return mobs.reduce((cum, cur) => cum + (member?.player_stats?.kills?.[cur] ?? 0), 0)
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
  slugfish: 145,
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
