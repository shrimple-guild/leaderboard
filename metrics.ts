function path(path: string): (member: any) => number | undefined {
  return (member: any) => {
    return path.split(".").reduce((obj, attribute) => obj?.[attribute], member)
  }
}

type Metric = {
  name: string
  counter: string
  calculation: (member: any) => number | undefined
}

const metrics: Partial<Record<string, Metric>> = {
  fishing_xp: {
    name: "Fishing XP",
    counter: "xp",
    calculation: path("player_data.experience.SKILL_FISHING"),
  },
  mooshroom_cow_bestiary: {
    name: "Mooshroom Cow Bestiary",
    counter: "cyclamen dyes",
    calculation: path("bestiary.kills.mushroom_cow_1"),
  },
}

export function getMetric(member: any, metric: string) {
  return metrics[metric]?.calculation(member)
}
