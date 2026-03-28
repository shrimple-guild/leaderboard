/**
 * Gets the Peak of the Mountain level from the member's mining core.
 */
function getPotmLevel(member: any): number {
  return member.mining_core?.nodes?.special_0 ?? 0
}

/**
 * Calculates Mithril powder including Peak of the Mountain bonuses.
 */
export function calculateMithrilPowder(member: any): number {
  const mining = member.mining_core
  const potmMithril = [0, 0, 50_000, 125_000, 225_000, 350_000, 350_000, 350_000]
  
  return (
    (mining?.powder_mithril ?? 0) +
    (mining?.powder_spent_mithril ?? 0) +
    (potmMithril[getPotmLevel(member)] ?? 0)
  )
}

/**
 * Calculates Gemstone powder including Peak of the Mountain bonuses.
 */
export function calculateGemstonePowder(member: any): number {
  const mining = member.mining_core
  const potmGemstone = [0, 0, 0, 0, 0, 0, 500_000, 1_250_000]

  return (
    (mining?.powder_gemstone ?? 0) +
    (mining?.powder_spent_gemstone ?? 0) +
    (potmGemstone[getPotmLevel(member)] ?? 0)
  )
}
