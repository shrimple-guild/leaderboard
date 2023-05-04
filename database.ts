import Sql from "better-sqlite3"
import { Metric, Profile } from "./types"


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
        PRIMARY KEY (profileId, timestamp, metricId)
      );
      CREATE INDEX IF NOT EXISTS TimestampIndex ON ProfileData (timestamp);
      CREATE INDEX IF NOT EXISTS MetricIndex ON ProfileData (metricId);
      CREATE INDEX IF NOT EXISTS ValueIndex ON ProfileData (value);
    `)
    this.addMetrics(metrics)
  } 

  getLeaderboard(metric: string, start?: number, end?: number) {
    const stmt = this.db.prepare(`
      WITH ProfileLeaderboard AS (
        SELECT playerId, profileId, MAX(value) - IIF(:start IS NULL, 0, MIN(value)) AS profileMetric
        FROM ProfileData
        INNER JOIN Metrics ON metricId = Metrics.id AND Metrics.name = :metric
        INNER JOIN Profiles ON profileId = Profiles.id
        WHERE timestamp >= COALESCE(:start, 0) AND timestamp <= :end
        GROUP BY profileId
      )
      SELECT
        username, cuteName, metric
      FROM ProfileLeaderboard a
      INNER JOIN (
        SELECT profileId, MAX(profileMetric) AS metric
        FROM ProfileLeaderboard
        GROUP BY profileId
      ) b ON a.profileId = b.profileId AND a.profileMetric = b.metric
      INNER JOIN Players ON a.playerId = Players.id
      INNER JOIN Profiles ON a.profileId = Profiles.id
      WHERE metric > 0
      GROUP BY a.playerId
      ORDER BY MAX(profileMetric) DESC
    `)
    return stmt.all({ metric: metric, start: start, end: end ?? Date.now() })
  }

  getMetrics(username: string, cuteName: string) {
    const stmt = this.db.prepare(`
      SELECT 
        name, value
      FROM ProfileData a
      INNER JOIN Metrics ON metricId = Metrics.id
      INNER JOIN Players ON playerId = Players.id AND username = :username
      INNER JOIN Profiles ON a.profileId = Profiles.id AND cuteName = :cuteName
      INNER JOIN (
        SELECT profileId, MAX(timestamp) timestamp
        FROM ProfileData
        GROUP BY profileId
      ) b ON a.profileId = b.profileId AND a.timestamp = b.timestamp
    `)
    return stmt.all({ username: username, cuteName: cuteName })
  }

  getGuildMembers(guildId: string): string[] {
    const stmt = this.db.prepare(`SELECT id FROM players WHERE guildId = ?`)
    return stmt.all(guildId).map(data => data.id)
  }

  setGuildMembers(guildId: string, members: string[]) {
    const clearGuildMembers = this.db.prepare(`UPDATE Players SET guildId = NULL WHERE guildId = ?`)
    const insertGuildMember = this.db.prepare(`
      INSERT INTO Players (id, guildId) VALUES (:id, :guildId) 
      ON CONFLICT (id) DO UPDATE SET guildId = excluded.guildId
    `)
    this.db.transaction(() => {
      clearGuildMembers.run(guildId)
      members.forEach(member => insertGuildMember.run({ id: member, guildId: guildId }))
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
        cuteName: profile.cuteName
      })
      profile.metrics.forEach(({metric, value}) => {
        insertDataStmt.run({
          playerId: profile.playerId,
          hypixelProfileId: profile.profileId,
          timestamp: timestamp,
          metricName: metric,
          value: value
        })
      })
    })()
  }

  private addMetrics(metrics: Metric[]) {
    const insertMetricStmt = this.db.prepare(`
      INSERT INTO Metrics (name, counter) VALUES (:name, :counter) 
      ON CONFLICT (name) DO UPDATE SET counter = excluded.counter
    `)
    metrics.forEach((metric) => insertMetricStmt.run(metric))
  }
}
