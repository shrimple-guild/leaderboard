/**
 * Calculates the score for the Jerry Event, combining skills, slayers, dungeons, and more.
 */
export function calculateJerryEventScore(member: any): number {
  const skills = member.player_data?.experience
  const slayer = member.slayer?.slayer_bosses
  const catacombs = member.dungeons?.dungeon_types?.catacombs?.tier_completions
  const master = member.dungeons?.dungeon_types?.master_catacombs?.tier_completions
  const kuudra = member.nether_island_player_data?.kuudra_completed_tiers

  return (
    (skills?.SKILL_FISHING ?? 0) * 0.25 +
    (skills?.SKILL_MINING ?? 0) * 0.17 +
    (skills?.SKILL_FORAGING ?? 0) * 0.18 +
    (skills?.SKILL_FARMING ?? 0) * 1 +
    (skills?.SKILL_ENCHANTING ?? 0) * 0.04 +
    (slayer?.zombie?.xp ?? 0) * 2.5 +
    (slayer?.spider?.xp ?? 0) * 8 +
    (slayer?.wolf?.xp ?? 0) * 11 +
    (slayer?.enderman?.xp ?? 0) * 37.5 +
    (slayer?.blaze?.xp ?? 0) * 30 +
    (slayer?.vampire?.xp ?? 0) * 781.3 +
    (catacombs?.[1] ?? 0) * 41667 +
    (catacombs?.[2] ?? 0) * 41667 +
    (catacombs?.[3] ?? 0) * 62500 +
    (catacombs?.[4] ?? 0) * 62500 +
    (catacombs?.[5] ?? 0) * 41667 +
    (catacombs?.[6] ?? 0) * 62500 +
    (catacombs?.[7] ?? 0) * 125000 +
    (master?.[1] ?? 0) * 41667 +
    (master?.[2] ?? 0) * 50000 +
    (master?.[3] ?? 0) * 62500 +
    (master?.[4] ?? 0) * 68750 +
    (master?.[5] ?? 0) * 60417 +
    (master?.[6] ?? 0) * 68750 +
    (master?.[7] ?? 0) * 175000 +
    (kuudra?.fiery ?? 0) * 37500 +
    (kuudra?.infernal ?? 0) * 37500 +
    (member.player_stats?.mythos?.kills ?? 0) * 6000 +
    (member.player_stats?.end_island?.dragon_fight?.amount_summoned?.total ?? 0) * 12500
  )
}
