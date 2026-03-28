/**
 * Calculates Trophy Fish Weight based on fish type and tier.
 */
export function calculateTrophyFishWeight(trophyFish: Record<string, number | undefined>): number {
  const trophyFishBase: Record<string, Record<string, number>> = {
    golden_fish: { bronze: 150, silver: 300, gold: 3000, diamond: 10000 },
    karate_fish: { bronze: 40, silver: 100, gold: 1000, diamond: 3200 },
    soul_fish: { bronze: 80, silver: 200, gold: 2000, diamond: 6400 },
    moldfin: { bronze: 40, silver: 100, gold: 1000, diamond: 3200 },
    skeleton_fish: { bronze: 40, silver: 100, gold: 1000, diamond: 3200 },
    vanille: { bronze: 15, silver: 40, gold: 400, diamond: 1350 },
    volcanic_stonefish: { bronze: 28, silver: 70, gold: 700, diamond: 2240 },
    mana_ray: { bronze: 8, silver: 20, gold: 200, diamond: 640 },
    lava_horse: { bronze: 24, silver: 60, gold: 600, diamond: 1920 },
    slugfish: { bronze: 72, silver: 180, gold: 1800, diamond: 5760 }
  }

  let totalWeight = 0
  for (const [fish, weights] of Object.entries(trophyFishBase)) {
    for (const [tier, weight] of Object.entries(weights)) {
      totalWeight += (trophyFish?.[`${fish}_${tier}`] ?? 0) * weight
    }
  }
  return totalWeight
}
