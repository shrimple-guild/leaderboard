import Database from "better-sqlite3"
import { Profile } from "./hypixel"
import metrics from "./metrics.json" assert { type: "json" } 

const db = new Database("./data/farming.db")

db.exec(`
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
`)

export const updateGuildMembers = (() => {
  const clearGuildMembers = db.prepare(`UPDATE Players SET guildId = NULL WHERE guildId = ?`)
  const insertGuildMember = db.prepare(`
    INSERT INTO Players (id, guildId) VALUES (:id, :guildId) 
    ON CONFLICT (id) DO UPDATE SET guildId = excluded.guildId
  `)
  return db.transaction((guildId: string, members: string[]) => {
    clearGuildMembers.run(guildId)
    members.forEach(member => insertGuildMember.run({ id: member, guildId: guildId }))
  })
})()

export const getGuildMembers: (guildId: string) => string[] = (() => {
  const stmt = db.prepare(`SELECT id FROM players WHERE guildId = ?`)
  return (guildId: string) => stmt.all(guildId).map(data => data.id)
})()

export const insertPlayer = (() => {
  const stmt = db.prepare(`
  INSERT INTO Players (id, username, guildId) VALUES (:playerId, :username, NULL)
  ON CONFLICT (id) DO UPDATE SET username = excluded.username`)
  return (playerId: string, name: string) => stmt.run({ username: name, playerId: playerId })
})()

export const insertProfileAndMetrics = (() => {
  const insertProfileStmt = db.prepare(`
    INSERT INTO Profiles (playerId, hypixelProfileId, cuteName)
    VALUES (:playerId, :hypixelProfileId, :cuteName)
    ON CONFLICT (playerId, hypixelProfileId)
    DO UPDATE SET cuteName = excluded.cuteName
  `)
  const insertDataStmt = db.prepare(`
    INSERT INTO ProfileData (
      profileId,
      timestamp,
      metricId,
      value
    )
    SELECT 
      Profiles.id,
      :timestamp,
      Metrics.id,
      :value
    FROM Profiles, Metrics
    WHERE Profiles.playerId = :playerId 
    AND hypixelProfileId = :hypixelProfileId
    AND Metrics.name = :metricName
  `)
  return db.transaction((
    profile: Profile,
    timestamp: number
  ) => {
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
  })
})()

const insertMetricStmt = db.prepare(`INSERT OR REPLACE INTO Metrics (name, counter) VALUES (:name, :counter)`)
metrics.forEach((metric) => insertMetricStmt.run(metric))

