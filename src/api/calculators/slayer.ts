/**
 * Calculates Slayer Weight based on XP across different boss types.
 */
export function calculateSlayerWeight(member: any): number {
  return (
    (member.slayer?.slayer_bosses?.zombie?.xp ?? 0) * 2.5 +
    (member.slayer?.slayer_bosses?.spider?.xp ?? 0) * 8 +
    (member.slayer?.slayer_bosses?.wolf?.xp ?? 0) * 11 +
    (member.slayer?.slayer_bosses?.enderman?.xp ?? 0) * 37.5 +
    (member.slayer?.slayer_bosses?.blaze?.xp ?? 0) * 30 +
    (member.slayer?.slayer_bosses?.vampire?.xp ?? 0) * 781.3
  )
}
