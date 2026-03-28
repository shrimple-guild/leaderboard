/**
 * Calculates total dungeon completions across all tiers (Normal and Master).
 */
export function calculateDungeonCompletions(member: any): number {
  const normalCompletions: any[] = Object.values(member.dungeons?.dungeon_types?.catacombs?.tier_completions ?? {})
  const masterCompletions: any[] = Object.values(
    member.dungeons?.dungeon_types?.master_catacombs?.tier_completions ?? {}
  )
  return [...normalCompletions, ...masterCompletions].reduce((cum, cur) => cum + cur, 0)
}

/**
 * Calculates a weighted score for dungeon completions based on tier difficulty.
 */
export function calculateWeightedDungeonCompletions(member: any): number {
  const catacombs = member.dungeons?.dungeon_types?.catacombs?.tier_completions
  const master = member.dungeons?.dungeon_types?.master_catacombs?.tier_completions

  return (
    (catacombs?.[1] ?? 0) * 37500 +
    (catacombs?.[2] ?? 0) * 37500 +
    (catacombs?.[3] ?? 0) * 37500 +
    (catacombs?.[4] ?? 0) * 56000 +
    (catacombs?.[5] ?? 0) * 33000 +
    (catacombs?.[6] ?? 0) * 62000 +
    (catacombs?.[7] ?? 0) * 143000 +
    (master?.[1] ?? 0) * 43500 +
    (master?.[2] ?? 0) * 48000 +
    (master?.[3] ?? 0) * 56000 +
    (master?.[4] ?? 0) * 69000 +
    (master?.[5] ?? 0) * 43500 +
    (master?.[6] ?? 0) * 69000 +
    (master?.[7] ?? 0) * 154000
  )
}

/**
 * Calculates a score for Dungeon Boss collections with a penalty for completions over 1000.
 */
export function calculateDungeonBossCollections(member: any): number {
  const catacombs = member.dungeons?.dungeon_types?.catacombs?.tier_completions
  const master = member.dungeons?.dungeon_types?.master_catacombs?.tier_completions
  const penalty = 0.75

  const calculateScore = (f: number, weight: number) => 
    (Math.min(1000, f) + Math.max(0, f - 1000) * penalty) * weight

  const tiers = [1, 2, 3, 4, 5, 6, 7]
  const weights = [33, 33, 38, 50, 42, 45, 116]

  return tiers.reduce((total, tier, i) => {
    const f = (catacombs?.[tier] ?? 0) + 2 * (master?.[tier] ?? 0)
    return total + calculateScore(f, weights[i])
  }, 0)
}
