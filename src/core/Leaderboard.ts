import { Database } from "../db/database.js"
import { API } from "../api/API.js"
import { LeaderboardPosition } from "./types.js"

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

  async updateProfiles(members: string[], timestamp: number, isStart?: boolean) {
    let count = 0;
    console.log(`Starting profile updates for ${members.length} members...`);
    const result = await Promise.allSettled(members.map(async uuid => {
      const res = await this.updateProfilesOfPlayer(uuid, timestamp, isStart);
      count++;
      if (count % 20 === 0 || count === members.length) {
        console.log(`Processed profiles: ${count}/${members.length}`);
      }
      return res;
    }));
    console.log(`Finished profile updates.`);
    return this.successRate(result);
  }

  async updatePlayers(members: string[]) {
    let count = 0;
    console.log(`Starting player name updates for ${members.length} members...`);
    const result = await Promise.allSettled(members.map(async uuid => {
      const res = await this.updatePlayer(uuid);
      count++;
      if (count % 20 === 0 || count === members.length) {
        console.log(`Processed players: ${count}/${members.length}`);
      }
      return res;
    }));
    console.log(`Finished player updates.`);
    return this.successRate(result);
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
