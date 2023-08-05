/*
const bestiaryRepo = "https://raw.githubusercontent.com/jani270/NotEnoughUpdates-REPO/2190bestiary/constants/bestiary.json"
const bestiaryConstants = await fetch(bestiaryRepo).then(resp => resp.json())
*/

import bestiaryConstants from "./bestiary.json" assert { type: "json" }

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

const {brackets, ...categories}: { brackets: Brackets } = bestiaryConstants

function flattenCategories(obj: NestedCategories): BestiaryCategories {
  const unnested: BestiaryCategories = {}
  for (const key in obj) {
    if ("mobs" in obj[key]) {
      unnested[key] = obj[key].mobs as BestiaryFamily[]
    } else {
      const nestedUnnested = flattenCategories(obj[key] as NestedCategories)
      for (const nestedKey in nestedUnnested) {
        unnested[key + '_' + nestedKey] = nestedUnnested[nestedKey]
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
  if (!member.bestiary.migration || !member.bestiary.migrated_stats) return
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
        .replaceAll(/§[0-9a-fklmnor]/g, '')
      bestiaryTiers[category][familyName] = {
        maxed: kills >= family.cap,
        tier: findMilestoneTier(tierKills, brackets[family.bracket]),
        kills: kills
      }
    })
  })
  return bestiaryTiers
}

export function getBestiaryTiers(member: any) {
  const bestiary = getBestiary(member)
  if (!bestiary) return
  const categories: { [category: string]: number } = {}
  Object.entries(bestiary).forEach(([category, families]) => (
    categories[category] = Object.values(families).reduce((cum, cur) => cum + cur.tier, 0)
  ))
  return {
    total: Object.values(categories).reduce((cum, cur) => cum + cur, 0),
    categories: categories
  } 
}
