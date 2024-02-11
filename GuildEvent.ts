import { Leaderboard } from "Leaderboard.js"
import { pickRandom } from "./random.js"
import { AttachmentBuilder } from "discord.js"

export class GuildEvent {
  discordGuildId!: string
  discordChannelId!: string
  pingRoleIds!: string[]
  guildIds!: string[]
  name!: string
  intro!: string
  description!: string
  outro!: string
  author!: string
  icon!: string
  start!: number
  duration!: number
  metrics!: string[]
  metric: string | undefined
  related: string[] | undefined
  iconAttachment!: AttachmentBuilder
  lb!: Leaderboard

  private constructor() {}

  static from(json: any, lb: Leaderboard) {
    const obj = Object.assign<GuildEvent, GuildEvent>(new GuildEvent(), json)
    obj.iconAttachment = new AttachmentBuilder(`./assets/${obj.icon}`, {
      name: "icon.png",
    })
    obj.lb = lb
    return obj
  }

  async updateGuilds() {
    await Promise.all(this.guildIds.map(guildId => this.updateGuild(guildId)))
  }

  private async updateGuild(guildId: string) {
    const members = await this.lb.fetchGuildMembers(guildId)
    this.lb.updateGuild(guildId, members)
  }

  async updatePlayers() {
    const guildMembers = this.lb.getGuildMembers(this.guildIds)
    await this.lb.updatePlayers(guildMembers)
  }

  async updateProfiles(time: number, isStart?: boolean) {
    const guildMembers = this.lb.getGuildMembers(this.guildIds)
    await this.lb.updateProfiles(guildMembers, time, isStart)
  }

  getLeaderboard(metric?: string) {
    const leaderboardMetric = metric ?? this.metric
    if (leaderboardMetric == undefined) return undefined
    return this.lb.getLeaderboard(this.guildIds, leaderboardMetric, this.start, this.end)
  }

  getTimeseries(username: string, cuteName: string, metric?: string) {
    const timeseriesMetric = metric ?? this.metric
    if (timeseriesMetric == undefined) return undefined
    return this.lb.getTimeseries(username, cuteName, timeseriesMetric, this.start, this.end)
  }

  async fetchMetric() {
    if (this.metric == null) {
      if (this.metrics.length == 1) {
        this.metric = this.metrics[0]
      } else {
        this.metric = await pickRandom(this.metrics, this.start)
      }
    }
    return this.metric
  }

  parse(str: string) {
    return str.replaceAll("{metric}", this.metric ?? "unknown")
  }

  get fullDescription() {
    return (
      this.parse(this.description) +
      `\n
**Start:** <t:${Math.round(this.start / 1000)}:f>
**End:** <t:${Math.round(this.end / 1000)}:f>
**Last updated:** <t:${Math.round(Date.now() / 1000)}:R>`
    )
  }

  get hasStarted() {
    return Date.now() >= this.start
  }

  get end() {
    return this.start + this.duration
  }
}
