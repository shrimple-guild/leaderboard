import { Dungeon, Slayer, Skill } from "./types"

type SlayerParameters = {
  divider: number,
  modifier: number
}

type SkillParameters = {
  exponent: number,
  divider: number,
  maxLevel: number
}

export const dungeonParameters: {[key in Dungeon]: number} = {
  catacombs: 0.0002149604615,
  healer: 0.0000045254834,
  mage: 0.0000045254834,
  berserk: 0.0000045254834,
  archer: 0.0000045254834,
  tank: 0.0000045254834,
}

export const slayerParameters: {[key in Slayer]: SlayerParameters} = {
  zombie: {
    divider: 2208,
    modifier: 0.15
  },
  spider: {
    divider: 2118,
    modifier: 0.08
  },
  wolf: {
    divider: 1962,
    modifier: 0.015
  },
  enderman: {
    divider: 1430, 
    modifier: 0.017
  },
}

export const skillParameters: {[key in Skill]: SkillParameters} = {
  mining: {
    exponent: 1.18207448,
    divider: 259634,
    maxLevel: 60
  },
  foraging: {
    exponent: 1.232826,
    divider: 259634,
    maxLevel: 50
  },
  enchanting: {
    exponent: 0.96976583,
    divider: 882758,
    maxLevel: 60
  },
  farming: {
    exponent: 1.217848139,
    divider: 220689,
    maxLevel: 60
  },
  combat: {
    exponent: 1.15797687265,
    divider: 275862,
    maxLevel: 60
  },
  fishing: {
    exponent: 1.406418,
    divider: 88274,
    maxLevel: 50
  },
  alchemy: {
    exponent: 1.0,
    divider: 1103448,
    maxLevel: 50
  },
  taming: {
    exponent: 1.14744,
    divider: 441379,
    maxLevel: 50
  }
}

export const skillXpLevel60 = 111672425
export const skillXpLevel50 = 55172425
export const dungeonXpLevel50 = 569809640

const dungeonXpCumulative = [
  0,
  50,
  125,
  235,
  395,
  625,
  955,
  1425,
  2095,
  3045,
  4385,
  6275,
  8940,
  12700,
  17960,
  25340,
  35640,
  50040,
  70040,
  97640,
  135640,
  188140,
  259640,
  356640,
  488640,
  668640,
  911640,
  1239640,
  1684640,
  2284640,
  3084640,
  4149640,
  5559640,
  7459640,
  9959640,
  13259640,
  17559640,
  23159640,
  30359640,
  39559640,
  51559640,
  66559640,
  85559640,
  109559640,
  139559640,
  177559640,
  225559640,
  285559640,
  360559640,
  453559640,
  569809640,
]

const skillXpCumulative = [
  0,
  50,
  175,
  375,
  675,
  1175,
  1925,
  2925,
  4425,
  6425,
  9925,
  14925,
  22425,
  32425,
  47425,
  67425,
  97425,
  147425,
  222425,
  322425,
  522425,
  822425,
  1222425,
  1722425,
  2322425,
  3022425,
  3822425,
  4722425,
  5722425,
  6822425,
  8022425,
  9322425,
  10722425,
  12222425,
  13822425,
  15522425,
  17322425,
  19222425,
  21222425,
  23322425,
  25522425,
  27822425,
  30222425,
  32722425,
  35322425,
  38072425,
  40972425,
  44072425,
  47472425,
  51172425,
  55172425,
  59472425,
  64072425,
  68972425,
  74172425,
  79672425,
  85472425,
  91572425,
  97972425,
  104672425,
  111672425,
]

function level(xp: number, levels: Array<number>) {
  for (let level = 0; level < levels.length; level++) {
    if (xp < levels[level]) {
      return (level - 1) + (xp - levels[level - 1]) / (levels[level] - levels[level - 1])
    }
  }
  return levels.length - 1
}

export function skillLevel(xp: number) {
  return level(xp, skillXpCumulative)
}

export function dungeonLevel(xp: number) {
  return level(xp, dungeonXpCumulative)
}

  

