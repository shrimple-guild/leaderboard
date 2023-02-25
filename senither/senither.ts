import { dungeonLevel, dungeonParameters, dungeonXpLevel50, skillLevel, skillParameters, skillXpLevel50, skillXpLevel60, slayerParameters } from "./constants.js"
import { Skill, ProfileMemberData, Dungeon, Slayer, } from "./types"

export function skillWeight(profile: ProfileMemberData, skill: Skill): number {
  const { maxLevel, exponent, divider } = skillParameters[skill]
  const skillXp = profile.skills[skill]
  if (skillXp == null) return 0
  const maxXp = (maxLevel == 50) ? skillXpLevel50 : skillXpLevel60
  const level = Math.min(skillLevel(skillXp), maxLevel)
  const base = Math.pow(level * 10, 0.5 + exponent + level / 100) / 1250
  const overflow = (skillXp > maxXp) ? Math.pow((skillXp - maxXp) / divider, 0.968) : 0
  return base + overflow
}

export function totalSkillWeight(profile: ProfileMemberData): number {
  return Object.keys(profile.skills).reduce((weight, skill) => weight + skillWeight(profile, skill as Skill), 0)
}

export function dungeonWeight(profile: ProfileMemberData, dungeon: Dungeon): number {
  const modifier = dungeonParameters[dungeon]
  const dungeonXp = profile.dungeons[dungeon] 
  if (dungeonXp == null) return 0
  const level = dungeonLevel(dungeonXp)
  const base = Math.pow(level, 4.5) * modifier
  const remaining = dungeonXp - dungeonXpLevel50
  const overflow = (remaining > 0) ? Math.pow(remaining / (4 * dungeonXpLevel50 / base), 0.968) : 0
  return base + overflow
}

export function totalDungeonWeight(profile: ProfileMemberData): number {
  return Object.keys(profile.dungeons).reduce((weight, type) => weight + dungeonWeight(profile, type as Dungeon), 0)
}

export function slayerWeight(profile: ProfileMemberData, slayer: Slayer) {
  const { divider, modifier } = slayerParameters[slayer]
  const slayerXp = profile.slayers[slayer]
  if (slayerXp == null) return 0
  const base = Math.min(slayerXp, 1e6) / divider
  let overflow = 0
  let remainingXp = slayerXp - 1e6
  let chunkModifier = modifier
  while (remainingXp > 0) {
    const xpChunk = Math.min(remainingXp, 1e6)
    overflow += Math.pow(xpChunk / (divider * (1.5 + chunkModifier)), 0.942)
    chunkModifier += modifier
    remainingXp -= 1e6
  }
  return base + overflow
}

export function totalSlayerWeight(profile: ProfileMemberData): number {
  return Object.keys(profile.slayers).reduce((weight, slayer) => weight + slayerWeight(profile, slayer as Slayer), 0)
}

export function senitherWeight(profile: ProfileMemberData): number {
  return totalSkillWeight(profile) + totalDungeonWeight(profile) + totalSlayerWeight(profile)
}