import { Database } from "./database.js"
import { API } from "./API.js"

export class Leaderboard {
  constructor(private api: API, private db: Database) {}

  getGuildMembers(guildId: string) {
    return this.db.getGuildMembers(guildId)
  }

  async fetchGuildMembers(guildId: string) {
    return this.api.fetchGuildMembers(guildId)
  }

  updateGuild(guildId: string, members: string[]) {
    this.db.setGuildMembers(guildId, members)
  }

  async updatePlayersInGuild(members: string[]) {
    const result = await Promise.allSettled(members.map(uuid => this.updatePlayer(uuid)))
    return this.successRate(result)
  }

  async updateProfilesInGuild(members: string[], timestamp: number, isStart?: boolean) {
    const result = await Promise.allSettled(members.map(uuid => this.updateProfiles(uuid, timestamp, isStart)))
    return this.successRate(result)
  }

  async updatePlayer(uuid: string) {
    const name = await this.api.fetchName(uuid)
    this.db.setUsername(uuid, name)
  }

  async updateProfiles(uuid: string, timestamp: number, isStart?: boolean) {
    const profiles = await this.api.fetchProfiles(uuid)
    profiles.forEach(profile => {
      this.db.setProfile(profile, timestamp)
      if (isStart != null) {
        this.db.insertProfileBackup(profile.profileId, isStart, profile.raw)
      }
    })
  }

  getLeaderboard(guildId: string, metric: string, start?: number, end?: number) {
    return this.db.getLeaderboard(guildId, metric, start, end)
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
