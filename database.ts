import Database from "better-sqlite3"
import { Profile } from "./hypixel"

const db = new Database("./data/leaderboard.db")

db.exec(`
  CREATE TABLE IF NOT EXISTS Players (
    id TEXT PRIMARY KEY,
    username TEXT,
    inGuild INTEGER NOT NULL
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
    profileId TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    fishingXp REAL,
    fishingTrophy REAL,
    fishingItems REAL,
    fishingCreatures REAL,
    fishingActions REAL,
    slayerZombie REAL NOT NULL,
    slayerSpider REAL NOT NULL,
    slayerWolf REAL NOT NULL,
    slayerEnderman REAL NOT NULL,
    slayerBlaze REAL NOT NULL,
    slayerScore REAL GENERATED ALWAYS AS ( 
        1 * slayerZombie 
      + 1 * slayerSpider
      + 1 * slayerWolf
      + 1 * slayerEnderman
      + 1 * slayerBlaze
    ) STORED
    FOREIGN KEY (profileId) REFERENCES Profiles(id)
    UNIQUE (profileId, timestamp)
  );
`)

export const insertGuildMembers = (() => {
  const clearGuildMembers = db.prepare(`UPDATE Players SET inGuild = 0`)
  const insertGuildMember = db.prepare(`INSERT INTO Players (id, inGuild) VALUES (?, 1) ON CONFLICT (id) DO UPDATE SET inGuild = 1`)
  return db.transaction((members: string[]) => {
    clearGuildMembers.run()
    members.forEach(member => insertGuildMember.run(member))
  })
})()

const getGuildMembers: () => string[] = (() => {
  const stmt = db.prepare(`SELECT id FROM players WHERE inGuild = 1`)
  return () => stmt.all().map(data => data.id)
})()

export const setPlayerUsername = (() => {
  const stmt = db.prepare(`UPDATE Players SET username = :name WHERE id = :playerId`)
  return (playerId: string, name: string) => stmt.run({ name: name, playerId: playerId })
})()

export const insertProfileAndMetrics = (() => {
  const insertProfileStmt = db.prepare(`
    INSERT INTO Profiles (playerId, hypixelProfileId, cuteName)
    VALUES (:playerId, :hypixelProfileId, :cuteName)
    ON CONFLICT (playerId, hypixelProfileId)
    DO UPDATE SET cuteName = excluded.cuteName
  `)
  const insertMetricStmt = db.prepare(`
    INSERT INTO Metrics (
      profileId,
      timestamp,
      fishingXp,
      fishingTrophy,
      fishingItems,
      fishingCreatures,
      fishingActions,
      slayerZombie REAL,
      slayerSpider REAL,
      slayerWolf REAL,
      slayerEnderman REAL,
      slayerBlaze REAL
    )
    SELECT 
      id, 
      :timestamp, 
      :fishingXp, 
      :fishingTrophy, 
      :fishingItems,
      :fishingCreatures,
      :fishingActions,
      :slayerZombie,
      :slayerSpider,
      :slayerWolf,
      :slayerEnderman,
      :slayerBlaze
    FROM Profiles
    WHERE playerId = :playerId 
    AND hypixelProfileId = :hypixelProfileId
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
    insertMetricStmt.run({
      playerId: profile.playerId,
      hypixelProfileId: profile.profileId,
      timestamp: timestamp,
      ...profile.metrics
    })
  })
})()

export type EventMetric = "slayerZombie" | "slayerSpider" | "slayerWolf" | "slayerEnderman" | "slayerBlaze" | "slayerScore"

export function eventRanking(start: number, end: number, metric: EventMetric) {
  const stmt = db.prepare(`  
    WITH EventMetrics AS (
      SELECT 
        Profiles.id AS profileId,
        Profiles.cuteName AS profileName,
        Profiles.playerId as playerId,
        MAX(${metric}) - MIN(${metric}) AS eventMetric
      FROM Metrics
      INNER JOIN Profiles on profileId = Profiles.id
      WHERE timestamp >= ${start} AND timestamp <= ${end} 
      GROUP BY profileId
      ORDER BY eventMetric DESC
    )
    SELECT
      Players.username,
      profileName,
      SUM(eventMetric) AS totalEventMetric,
      RANK() OVER (ORDER BY SUM(eventMetric) DESC) AS position
    FROM EventMetrics
    INNER JOIN Players ON playerId = Players.id
    WHERE Players.inGuild = 1
    GROUP BY playerId
    HAVING totalEventMetric > 0
    ORDER BY totalEventMetric DESC
  `)
  return stmt.all() as EventParticipantData[]
}

export type EventParticipantData = {
  username: string,
  profileName: string,
  totalEventMetric: number,
  position: number
}

export function eventTimeseries(start: number, end: number, metric: EventMetric, username: string) {
  const stmt = db.prepare(`  
    SELECT 
      Metrics.timestamp,
      SUM(Metrics.${metric}) AS metric
    FROM Metrics
    INNER JOIN Profiles ON profileId = Profiles.id
    INNER JOIN Players ON Players.id = Profiles.playerId
    WHERE timestamp >= :start AND timestamp <= :end AND Players.username = :name
    GROUP BY Metrics.timestamp
    HAVING metric IS NOT NULL
  `)
  return stmt.all({ start: start, end: end, name: username } ) as { timestamp: number, metric: number }[]
}

