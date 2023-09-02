import Sql from "better-sqlite3"
import { LeaderboardPosition, Metric, Profile, Timeseries } from "./types"

export class Database {
  private db: Sql.Database

  constructor(path: string, metrics: Metric[]) {
    this.db = new Sql(path)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Players (
        id TEXT PRIMARY KEY,
        username TEXT,
        guildId TEXT
      );
      CREATE TABLE IF NOT EXISTS Profiles (
        id INTEGER PRIMARY KEY,
        playerId TEXT NOT NULL,
        hypixelProfileId TEXT NOT NULL,
        cuteName TEXT NOT NULL,
        UNIQUE (playerId, hypixelProfileId),
        FOREIGN KEY (playerId) REFERENCES Players(id)
      );
      CREATE TABLE IF NOT EXISTS Metrics (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        counter TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ProfileData (
        profileId INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        metricId INTEGER NOT NULL,
        value REAL NOT NULL,
        FOREIGN KEY (profileId) REFERENCES Profiles(id),
        FOREIGN KEY (metricId) REFERENCES Metrics(id),
        PRIMARY KEY (profileId, timestamp, metricId)
      );
      CREATE INDEX IF NOT EXISTS TimestampIndex ON ProfileData (timestamp);
      CREATE INDEX IF NOT EXISTS MetricIndex ON ProfileData (metricId);
      CREATE INDEX IF NOT EXISTS ValueIndex ON ProfileData (value);
    `)
    this.addMetrics(metrics)
  }

  getLeaderboard(
    guildId: string,
    metric: string,
    start?: number,
    end?: number
  ): LeaderboardPosition[] {
    const stmt = this.db.prepare(`
      WITH ProfileLeaderboard AS (
        SELECT profileId, MAX(value) - IIF(:start IS NOT NULL, MIN(value), 0) AS profileValue, name AS metric, counter
        FROM ProfileData
        INNER JOIN Metrics on metricId = Metrics.id
        WHERE Metrics.name = :metric AND timestamp >= COALESCE(:start, 0) AND timestamp <= :end
        GROUP BY profileId
      )
      SELECT
        RANK() OVER (ORDER BY MAX(profileValue) DESC) rank,
        username,
        cuteName,
        MAX(profileValue) AS value,
        metric, 
        counter
      FROM ProfileLeaderboard
      INNER JOIN Profiles on profileId = Profiles.id
      INNER JOIN Players on playerId = Players.id AND guildId = :guildId
      GROUP BY playerId
      HAVING MAX(profileValue) > 0
      ORDER BY MAX(profileValue) DESC
    `)
    return stmt.all({
      metric: metric,
      start: start,
      end: end ?? Date.now(),
      guildId: guildId,
    }) as LeaderboardPosition[]
  }

  getTimeseries(
    username: string,
    cuteName: string,
    metric: string,
    start?: number,
    end?: number
  ): Timeseries[] {
    const stmt = this.db.prepare(`
      SELECT 
        timestamp - :start AS time, value - MIN(value) OVER() AS value
      FROM ProfileData a
      INNER JOIN Metrics ON metricId = Metrics.id AND name = :metric
      INNER JOIN Players ON playerId = Players.id AND username = :username
      INNER JOIN Profiles ON a.profileId = Profiles.id AND cuteName = :cuteName
      WHERE timestamp >= COALESCE(:start, 0) AND timestamp <= COALESCE(:end, 9223372036854775807)
      ORDER BY timestamp ASC
    `)
    return stmt.all({
      username: username,
      cuteName: cuteName,
      metric: metric,
      start: start,
      end: end,
    }) as Timeseries[]
  }

  getGuildMembers(guildId: string): string[] {
    const stmt = this.db.prepare(`SELECT id FROM players WHERE guildId = ?`)
    return stmt.all(guildId).map((data: any) => data.id)
  }

  setGuildMembers(guildId: string, members: string[]) {
    const clearGuildMembers = this.db.prepare(
      `UPDATE Players SET guildId = NULL WHERE guildId = ?`
    )
    const insertGuildMember = this.db.prepare(`
      INSERT INTO Players (id, guildId) VALUES (:id, :guildId) 
      ON CONFLICT (id) DO UPDATE SET guildId = excluded.guildId
    `)
    this.db.transaction(() => {
      clearGuildMembers.run(guildId)
      members.forEach(member =>
        insertGuildMember.run({ id: member, guildId: guildId })
      )
    })()
  }

  setUsername(uuid: string, name: string) {
    const stmt = this.db.prepare(`
      INSERT INTO Players (id, username, guildId) VALUES (:playerId, :username, NULL)
      ON CONFLICT (id) DO UPDATE SET username = excluded.username
    `)
    stmt.run({ username: name, playerId: uuid })
  }

  setProfile(profile: Profile, timestamp: number) {
    const insertProfileStmt = this.db.prepare(`
      INSERT INTO Profiles (playerId, hypixelProfileId, cuteName)
      VALUES (:playerId, :hypixelProfileId, :cuteName)
      ON CONFLICT (playerId, hypixelProfileId)
      DO UPDATE SET cuteName = excluded.cuteName
    `)
    const insertDataStmt = this.db.prepare(`
      INSERT INTO ProfileData (profileId, timestamp, metricId, value)
      SELECT Profiles.id, :timestamp, Metrics.id, :value
      FROM Profiles, Metrics
      WHERE Profiles.playerId = :playerId 
      AND hypixelProfileId = :hypixelProfileId 
      AND Metrics.name = :metricName
    `)
    this.db.transaction(() => {
      insertProfileStmt.run({
        playerId: profile.playerId,
        hypixelProfileId: profile.profileId,
        cuteName: profile.cuteName,
      })
      profile.metrics.forEach(({ metric, value }) => {
        insertDataStmt.run({
          playerId: profile.playerId,
          hypixelProfileId: profile.profileId,
          timestamp: timestamp,
          metricName: metric,
          value: value,
        })
      })
    })()
  }

  private addMetrics(metrics: Metric[]) {
    const insertMetricStmt = this.db.prepare(`
      INSERT INTO Metrics (name, counter) VALUES (:name, :counter) 
      ON CONFLICT (name) DO UPDATE SET counter = excluded.counter
    `)
    metrics.forEach(metric => insertMetricStmt.run(metric))
  }
}
