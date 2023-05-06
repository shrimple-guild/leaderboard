import { AttachmentBuilder, EmbedBuilder } from "discord.js"
import metric from "./metrics.json" assert { type: "json" }

export type Metric = {
  name: string,
  counter: string,
  path: string
}

export type Profile = {
  playerId: string,
  profileId: string,
  cuteName: string,
  metrics: { metric: string, value: number | undefined }[]
}

export type LeaderboardPosition = {
  rank: number,
  username: string,
  cuteName: string,
  value: number,
  metric: string,
  counter: string
}

export type Sendable = { 
  embeds: EmbedBuilder[] | undefined, 
  files: AttachmentBuilder[] | undefined 
}