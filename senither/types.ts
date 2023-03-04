export type Dungeon = "catacombs" | "healer" | "mage" | "berserk" | "archer" | "tank"
export type Slayer = "zombie" | "spider" | "wolf" | "enderman"
export type Skill = "mining" | "foraging" | "enchanting" | "farming" | "combat" | "fishing" | "alchemy" | "taming"

export type ProfileMemberData = {
  skills: {[key in Skill]: number | undefined},
  dungeons: {[key in Dungeon]: number | undefined},
  slayers: {[key in Slayer]: number | undefined}
  misc: {
    level: number | undefined
    metric: number | undefined
  }
}
