/**
 * Calculates a weight score for the Derpy event based on various skills and dungeons.
 */
export function calculateDerpyWeight(member: any): number {
  const skills = member.player_data?.experience
  return (
    (skills?.SKILL_FISHING ?? 0) * 0.25 +
    (skills?.SKILL_MINING ?? 0) * 0.17 +
    (skills?.SKILL_COMBAT ?? 0) * 0.22 +
    (skills?.SKILL_FORAGING ?? 0) * 0.18 +
    (skills?.SKILL_FARMING ?? 0) * 1 +
    (skills?.SKILL_ENCHANTING ?? 0) * 0.04 +
    (skills?.SKILL_ALCHEMY ?? 0) * 0.002 +
    (skills?.SKILL_SOCIAL ?? 0) * 7.77 +
    (member.dungeons?.dungeon_types?.catacombs?.experience ?? 0) * 0.33
  )
}
