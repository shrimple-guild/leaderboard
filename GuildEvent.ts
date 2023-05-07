import { Leaderboard } from "Leaderboard.js"
import { pickRandom } from "./random.js"
import { AttachmentBuilder } from "discord.js"

export class GuildEvent {
  discordGuildId!: string
  discordChannelId!: string
  pingRoleId!: string
  guildId!: string
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
  iconAttachment!: AttachmentBuilder
  lb!: Leaderboard
  
  private constructor() {}

  static from(json: any, lb: Leaderboard) {
    const obj = Object.assign<GuildEvent, GuildEvent>(new GuildEvent(), json)
    obj.iconAttachment = new AttachmentBuilder(`./assets/${obj.icon}`, { name: "icon.png" })
    obj.lb = lb
    return obj
  }

  async updateGuild() {
    const members = await this.lb.fetchGuildMembers(this.guildId)
    this.lb.updateGuild(this.guildId, members)
  }

  async updatePlayers() {
    const guildMembers = this.lb.getGuildMembers(this.guildId)
    this.lb.updateGuild(this.guildId, guildMembers)
    await this.lb.updatePlayersInGuild(guildMembers)
  }

  async updateProfiles(time: number) {
    const guildMembers = this.lb.getGuildMembers(this.guildId)
    this.lb.updateGuild(this.guildId, guildMembers)
    await this.lb.updateProfilesInGuild(guildMembers, time)
  }

  getLeaderboard(metric?: string) {
    const leaderboardMetric = metric ?? this.metric 
    if (leaderboardMetric == undefined) return undefined
    return this.lb.getLeaderboard(this.guildId, leaderboardMetric, this.start, this.end)
  }
  
  getTimeseries(username: string, cuteName: string, metric?: string) {
    const timeseriesMetric = metric ?? this.metric 
    if (timeseriesMetric == undefined) return undefined
    return this.lb.getTimeseries(username, cuteName, timeseriesMetric, this.start, this.end)
  }

  async fetchMetric() {
    this.metric = await pickRandom(this.metrics, this.start)
  }

  parse(str: string) {
    return str.replaceAll("{metric}", this.metric ?? "unknown")
  }

  get fullDescription() {
    return this.parse(this.description) + `\n
**Start:** <t:${Math.round(this.start / 1000)}:f>
**End:** <t:${Math.round(this.end / 1000)}:f>
**Last updated:** <t:${Math.round(Date.now() / 1000)}:R>`
  }
  
  get hasStarted() {
    return Date.now() >= this.start
  }

  get end() {
    return this.start + this.duration
  }
}
