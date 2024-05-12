/*
const bestiaryRepo = "https://raw.githubusercontent.com/jani270/NotEnoughUpdates-REPO/2190bestiary/constants/bestiary.json"
const bestiaryConstants = await fetch(bestiaryRepo).then(resp => resp.json())
*/

import bestiaryConstants from "./bestiary.json" with { type: "json" }

type Brackets = {
  [key: number]: number[]
}

interface BestiaryFamily {
  name: string
  cap: number
  mobs: string[]
  bracket: number
}

type BestiaryTiers = {
  [category: string]: {
    [family: string]: {
      tier: number
      kills: number
      maxed: boolean
    }
  }
}

type NestedCategories = {
  [key: string]: NestedCategories | { mobs: BestiaryFamily[] }
}

type BestiaryCategories = {
  [key: string]: BestiaryFamily[]
}

const { brackets, ...categories }: { brackets: Brackets } = bestiaryConstants

function flattenCategories(obj: NestedCategories): BestiaryCategories {
  const unnested: BestiaryCategories = {}
  for (const key in obj) {
    if ("mobs" in obj[key]) {
      unnested[key] = obj[key].mobs as BestiaryFamily[]
    } else {
      const nestedUnnested = flattenCategories(obj[key] as NestedCategories)
      for (const nestedKey in nestedUnnested) {
        unnested[key + "_" + nestedKey] = nestedUnnested[nestedKey]
      }
    }
  }
  return unnested
}

function findMilestoneTier(kills: number, bracket: number[]) {
  let highestTier = -1
  for (let tier = 0; tier <= bracket.length && kills >= bracket[tier]; tier++) {
    highestTier = tier
  }
  return highestTier + 1
}

const bestiaryCategories = flattenCategories(categories)

export function getBestiary(member: any) {
  if (!member.bestiary) return
  if (!member.bestiary.migration) return
  const bestiary: { [key: string]: number } = member.bestiary.kills ?? {}
  const bestiaryTiers: BestiaryTiers = {}
  Object.entries(bestiaryCategories).forEach(([category, families]) => {
    bestiaryTiers[category] = {}
    families.forEach(family => {
      const kills = family.mobs.reduce((cum, cur) => cum + (bestiary[cur] ?? 0), 0)
      const tierKills = Math.min(kills, family.cap)
      const familyName = family.name
        .toLocaleLowerCase()
        .replaceAll(" ", "_")
        .replaceAll(/§[0-9a-fklmnor]/g, "")
      bestiaryTiers[category][familyName] = {
        maxed: kills >= family.cap,
        tier: findMilestoneTier(tierKills, brackets[family.bracket]),
        kills: kills,
      }
    })
  })
  return bestiaryTiers
}

export function getBestiaryTiers(member: any) {
  const bestiary = getBestiary(member)
  if (!bestiary) return
  const categories: { [category: string]: number } = {}
  Object.entries(bestiary).forEach(
    ([category, families]) => (categories[category] = Object.values(families).reduce((cum, cur) => cum + cur.tier, 0))
  )
  return {
    total: Object.values(categories).reduce((cum, cur) => cum + cur, 0),
    categories: categories,
  }
}

export function getMythologicalKills(member: any) {
  const bestiary = getBestiary(member)
  if (!bestiary) return
  const creatures = Object.values(bestiary.mythological_creatures)
  return {
    inquisitors: bestiary.mythological_creatures.minos_inquisitor.kills,
    mythologicalKills: creatures.reduce((cum, cur) => cum + cur.kills, 0),
  }
}

export function getRareSeaCreatureScore(member: any) {
  const bestiary = getBestiary(member)
  if (!bestiary) return
  const kills = {
    greatWhiteShark: bestiary.fishing_fishing_festival.great_white_shark.kills,
    grimReaper: bestiary.fishing_spooky_festival.grim_reaper.kills,
    phantomFisher: bestiary.fishing_spooky_festival.phantom_fisher.kills,
    seaEmperor: bestiary.fishing_fishing.the_sea_emperor.kills,
    waterHydra: bestiary.fishing_fishing.water_hydra.kills,
    yeti: bestiary.fishing_winter.yeti.kills,
    reindrake: bestiary.fishing_winter.reindrake.kills,
    lordJawbus: bestiary.fishing_lava.lord_jawbus.kills,
    thunder: bestiary.fishing_lava.thunder.kills,
    flamingWorm: bestiary.fishing_lava.flaming_worm.kills,
    waterWorm: bestiary.fishing_fishing.water_worm.kills,
    poisonedWaterWorm: bestiary.fishing_fishing.poisoned_water_worm.kills,
    zombieMiner: bestiary.fishing_fishing.zombie_miner.kills,
  }
  return Object.entries(kills).reduce((score, [mob, kills]) => score + kills * rareSeaCreatureScore[mob], 0)
}

const rareSeaCreatureScore: Record<string, number> = {
  greatWhiteShark: 60000,
  grimReaper: 185000,
  phantomFisher: 45000,
  seaEmperor: 120000,
  waterHydra: 65000,
  yeti: 150000,
  reindrake: 0,
  lordJawbus: 750000,
  thunder: 100000,
  flamingWorm: 2000,
  waterWorm: 0,
  poisonedWaterWorm: 0,
  zombieMiner: 0,
}
