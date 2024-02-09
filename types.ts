import { AttachmentBuilder, EmbedBuilder } from "discord.js"
import metric from "./metrics.json" assert { type: "json" }

export function isNotNull<T>(val: T | null | undefined): val is T {
  return val != null
}

export type Profile = {
  playerId: string
  profileId: string
  cuteName: string
  data: any
}

export type LeaderboardPosition = {
  rank: number
  username: string
  cuteName: string
  value: number
  metric: string
  counter: string
}

export type Timeseries = {
  time: number
  value: number
}
