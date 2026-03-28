/**
 * Utility to sum kills for a list of mobs from the member's player_stats.
 */
export function sumKills(member: any, mobs: string[]): number {
  return mobs.reduce((cum, cur) => cum + (member?.player_stats?.kills?.[cur] ?? 0), 0)
}
