/**
 * Calculates total Kuudra completions for the specified tiers.
 */
export function calculateKuudraCompletions(member: any, tiersToSum: string[]): number {
  const kuudra = member.nether_island_player_data?.kuudra_completed_tiers ?? {}
  return tiersToSum.reduce((total, tier) => total + (kuudra[tier] ?? 0), 0)
}
