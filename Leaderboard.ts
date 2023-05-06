import { Database } from "./Database.js"
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
  
  async updateProfilesInGuild(members: string[], timestamp: number) {
    const result = await Promise.allSettled(members.map(uuid => this.updateProfiles(uuid, timestamp)))
    return this.successRate(result)
  }
  
  async updatePlayer(uuid: string) {
    const name = await this.api.fetchName(uuid)
    this.db.setUsername(uuid, name)
  }
  
  async updateProfiles(uuid: string, timestamp: number) {
    const profiles = await this.api.fetchProfiles(uuid)
    profiles.map(profile => this.db.setProfile(profile, timestamp))
  }

  getLeaderboard(metric: string, start?: number, end?: number) {
    return this.db.getLeaderboard(metric, start, end)
  }
  
  getMetrics(username: string, cuteName: string) {
    return this.db.getMetrics(username, cuteName)
  }

  private successRate<T>(settled: PromiseSettledResult<T>[]) {
    return {
      fulfilled: settled.filter(value => value.status == "fulfilled").length,
      total: settled.length
    }
  }
}



