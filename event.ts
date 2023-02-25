import Database from "better-sqlite3"
import config from "./config.json" assert { type: "json" }
import { guildMembers, PlayerResponse, playersData, ProfileResponse, profilesData } from "./weights.js"

const db = new Database("leaderboard.db")

db.prepare(`
CREATE TABLE IF NOT EXISTS Players (
  id TEXT PRIMARY KEY,
  username TEXT,
  inGuild INTEGER NOT NULL,
  inEvent INTEGER DEFAULT 1
)
`).run()

db.prepare(`
CREATE TABLE IF NOT EXISTS Metrics (
  playerId TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  profileName TEXT NOT NULL,
  profileId TEXT NOT NULL,
  mythosKills REAL NOT NULL,
  FOREIGN KEY(playerId) REFERENCES Players(id)
  PRIMARY KEY (playerId, timestamp)
)
`).run()

const clearGuildMembers = db.prepare(`UPDATE Players SET inGuild = 0`)

const insertOrUpdateGuildMember = db.prepare(`
INSERT INTO Players (id, inGuild)
  VALUES (?, 1)
  ON CONFLICT (id) DO UPDATE SET
    inGuild = 1
`)

const selectGuildMemberUuids = db.prepare(`
SELECT id
FROM players
WHERE inGuild = 1
`)

const setPlayerInEvent = db.prepare(`
UPDATE Players
SET inEvent = ?
WHERE username = :username
`)

const updatePlayerUsername = db.prepare(`
UPDATE Players
SET username = :name
WHERE id = :uuid
`)

const insertMetric = db.prepare(`
INSERT INTO Metrics
VALUES (:uuid, :timestamp, :name, :id, :mythosKills)
`)

const selectTimeseries = db.prepare(`
SELECT
  timestamp,
  mythosKills
FROM Metrics
INNER JOIN Players
  ON Players.id = Metrics.playerId
WHERE Metrics.timestamp >= ${config.eventStart}
  AND Players.username = ?
`)

const result = db.prepare(`
SELECT
  username,
  profileName,
  endingKills,
  startingKills,
  (endingKills - startingKills) as score,
  RANK() OVER (ORDER BY (endingKills - startingKills) DESC) rank
FROM (
  SELECT 
    Players.username AS username,
    Metrics.profileName AS profileName,
    FIRST_VALUE(Metrics.mythosKills) OVER (
      PARTITION BY Players.id
      ORDER BY Metrics.mythosKills ASC
    ) AS startingKills,
    FIRST_VALUE(Metrics.mythosKills) OVER (
      PARTITION BY Players.id
      ORDER BY Metrics.mythosKills DESC
    ) AS endingKills
  FROM Players
  INNER JOIN Metrics 
    ON Players.id = Metrics.playerId
  WHERE Metrics.timestamp >= ${config.eventStart}
    AND Players.inGuild = 1
    AND Players.inEvent = 1
)
WHERE score > 0
GROUP BY username
ORDER BY score DESC
`)

const insertPlayersTransaction = db.transaction((players: string[]) => {
  clearGuildMembers.run()
  players.forEach((player) => insertOrUpdateGuildMember.run(player))
})

const updatePlayersTransaction = db.transaction((responses: PlayerResponse[]) => {
  responses.forEach((response) => updatePlayerUsername.run(response))
})

const insertMetricsTransaction = db.transaction((metrics: ProfileResponse[]) => {
  metrics.forEach((metric) => insertMetric.run(metric))
})

export async function updatePlayersInGuild(guildId: string) {
  try {
    const players = await guildMembers(guildId)
    insertPlayersTransaction(players)
  } catch (e) {
    console.error(e)
  }
}

export async function updateUsernames() {
  const uuids = selectGuildMemberUuids.all().map(obj => obj.id)
  const names = await playersData(uuids)
  updatePlayersTransaction(names)
}

export async function updateMetrics() {
  const uuids = selectGuildMemberUuids.all().map(obj => obj.id)
  const metrics = await profilesData(uuids)
  insertMetricsTransaction(metrics)
  return {
    updated: metrics.length,
    players: uuids.length
  }
}

export async function updatePlayerInEvent(shouldBeInEvent: boolean) {
  const inEvent = shouldBeInEvent ? 1 : 0
  setPlayerInEvent.run(inEvent)
}

export type PlayerData = {
  username: string,
  rank: number,
  profileName: string,
  endingKills: number,
  startingKills: number,
  score: number
}

export type Timeseries = {
  timestamp: number,
  mythosKills: number
}

export function getLeaderboardData() {
  return result.all() as PlayerData[]
}

export function getTimeseries(username: string) {
  return selectTimeseries.all(username) as Timeseries[]
}


console.log(getLeaderboardData())