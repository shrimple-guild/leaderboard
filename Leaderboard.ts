import { Database } from "./database.js"
import { API } from "./API.js"
import { LeaderboardPosition } from "types.js"

export class Leaderboard {
  constructor(private api: API, private db: Database) {}

  getGuildMembers(guildIds: string[]) {
    return guildIds.flatMap(guildId => this.db.getGuildMembers(guildId))
  }

  async fetchGuildMembers(guildId: string) {
    return this.api.fetchGuildMembers(guildId)
  }

  updateGuild(guildId: string, members: string[]) {
    console.log(`Updating ${guildId} with ${members.length} members`)
    this.db.setGuildMembers(guildId, members)
  }

  async updatePlayers(members: string[]) {
    const result = await Promise.allSettled(members.map(uuid => this.updatePlayer(uuid)))
    return this.successRate(result)
  }

  async updateProfiles(members: string[], timestamp: number, isStart?: boolean) {
    const result = await Promise.allSettled(members.map(uuid => this.updateProfilesOfPlayer(uuid, timestamp, isStart)))
    return this.successRate(result)
  }

  async updatePlayer(uuid: string) {
    const name = await this.api.fetchName(uuid)
    this.db.setUsername(uuid, name)
  }

  async updateProfilesOfPlayer(uuid: string, timestamp: number, isStart?: boolean) {
    const profiles = await this.api.fetchProfiles(uuid)
    profiles.forEach(profile => {
      this.db.setProfile(profile, timestamp)
      if (isStart != null) {
        this.db.insertProfileBackup(profile.profileId, isStart, profile.raw)
      }
    })
  }

  getLeaderboard(guildIds: string[], metric: string, start?: number, end?: number): LeaderboardPosition[] {
    const data = guildIds.flatMap(guildId => this.db.getLeaderboard(guildId, metric, start, end))
    const result = data.sort((a, b) => b.value - a.value)
    return data.map((data, index) => ({ ...data, rank: index + 1 }))
  }

  getTimeseries(username: string, cuteName: string, metric: string, start?: number, end?: number) {
    return this.db.getTimeseries(username, cuteName, metric, start, end)
  }

  private successRate<T>(settled: PromiseSettledResult<T>[]) {
    return {
      fulfilled: settled.filter(value => value.status == "fulfilled").length,
      total: settled.length,
    }
  }
}
