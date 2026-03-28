import creatures from "../../data/creatures.json" with { type: "json" }
import { getBestiaryTiers, getEmperorKills, getMythologicalKills, getRareSeaCreatureScore } from "../bestiary.js"
import { sumKills } from "./mobs.js"
import { calculateMithrilPowder, calculateGemstonePowder } from "./mining.js"
import { calculateDungeonCompletions, calculateWeightedDungeonCompletions, calculateDungeonBossCollections } from "./dungeons.js"
import { calculateSlayerWeight } from "./slayer.js"
import { calculateJerryEventScore } from "./jerry.js"
import { calculateDerpyWeight } from "./derpy.js"
import { calculateTrophyFishWeight } from "./fishing.js"
import { calculateKuudraCompletions } from "./kuudra.js"

export { sumKills } from "./mobs.js"
export { calculateMithrilPowder, calculateGemstonePowder } from "./mining.js"
export { calculateDungeonCompletions, calculateWeightedDungeonCompletions, calculateDungeonBossCollections } from "./dungeons.js"
export { calculateSlayerWeight } from "./slayer.js"
export { calculateJerryEventScore } from "./jerry.js"
export { calculateDerpyWeight } from "./derpy.js"
export { calculateTrophyFishWeight } from "./fishing.js"
export { calculateKuudraCompletions } from "./kuudra.js"

/**
 * Main dispatcher for calculating metrics based on the metric name.
 */
export function getMetricValue(member: any, metricName: string): number | undefined {
  switch (metricName) {
    case "Shark Kills":
      return sumKills(member, creatures.shark)
    case "Water Kills":
      return sumKills(member, [creatures.shark, creatures.special, creatures.water].flat())
    case "Crimson Kills":
      return sumKills(member, creatures.crimson)
    case "Dungeon Completions":
      return calculateDungeonCompletions(member)
    case "Slayer Weight":
      return calculateSlayerWeight(member)
    case "Mithril Powder":
      return calculateMithrilPowder(member)
    case "Gemstone Powder":
      return calculateGemstonePowder(member)
    case "Weighted Dungeon Completions":
      return calculateWeightedDungeonCompletions(member)
    case "Jerry Event Score":
      return calculateJerryEventScore(member)
    case "Total Powder":
      return calculateMithrilPowder(member) + calculateGemstonePowder(member)
    case "Fishing Actions":
      return (member.stats?.pet_milestone_sea_creatures_killed ?? 0) + (member.stats?.items_fished ?? 0)
    case "Trophy Fish Weight":
      return calculateTrophyFishWeight(member.trophy_fish)
    case "Marina Fishing Weight":
      if (member.experience_skill_fishing == null) return undefined
      return sumKills(member, creatures.shark) * 7000 + member.experience_skill_fishing
    case "Bestiary Tiers":
      return getBestiaryTiers(member)?.total
    case "Inquisitor Bestiary":
      return getMythologicalKills(member)?.inquisitors
    case "Mythological Bestiary":
      return getMythologicalKills(member)?.mythologicalKills
    case "Derpy Weight":
      return calculateDerpyWeight(member)
    case "Dungeon Boss Collections":
      return calculateDungeonBossCollections(member)
    case "Rare Sea Creature Score":
      return getRareSeaCreatureScore(member)
    case "Kuudra Completions":
      return calculateKuudraCompletions(member, ["none", "hot", "burning", "fiery", "infernal"])
    case "Kuudra Completions (T4/5)":
      return calculateKuudraCompletions(member, ["fiery", "infernal"])
    case "Loch Emperor Bestiary":
      return getEmperorKills(member)
    case "Trapper Kills":
      return sumKills(member, ["trapper_cow", "trapper_chicken", "trapper_sheep", "trapper_pig", "trapper_rabbit", "trapper_horse"])
    default:
      return undefined
  }
}
