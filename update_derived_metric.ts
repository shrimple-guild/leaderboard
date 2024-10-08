import Database from "better-sqlite3"
import { existsSync } from "fs"

const dbName = "lb_63d0278d8ea8c999a1004ef9_651316cd8ea8c9e6a31fbccb-1728227700000_1728674100000.db"
const backupName = `backup:${dbName}`

if (existsSync(backupName)) {
  console.error("File already exists in backup location, aborting...")
  process.exit(1)
}

const db = new Database(dbName)
await db.backup(backupName)

db.exec(`
CREATE TEMPORARY TABLE ProfileDataPivot AS 
SELECT
    Profiles.id AS profileId,
    Profiles.cuteName,
    timestamp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Fishing XP' THEN ProfileData.value END), 0) AS fishingXp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Mining XP' THEN ProfileData.value END), 0) AS miningXp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Foraging XP' THEN ProfileData.value END), 0) AS foragingXp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Farming XP' THEN ProfileData.value END), 0) AS farmingXp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Enchanting XP' THEN ProfileData.value END), 0) AS enchantingXp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Zombie XP' THEN ProfileData.value END), 0) AS zombieXp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Spider XP' THEN ProfileData.value END), 0) AS spiderXp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Wolf XP' THEN ProfileData.value END), 0) AS wolfXp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Enderman XP' THEN ProfileData.value END), 0) AS endermanXp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Blaze XP' THEN ProfileData.value END), 0) AS blazeXp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Vampire XP' THEN ProfileData.value END), 0) AS vampireXp,
    IFNULL(MAX(CASE WHEN Metrics.name = 'F1 Completions' THEN ProfileData.value END), 0) AS f1Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'F2 Completions' THEN ProfileData.value END), 0) AS f2Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'F3 Completions' THEN ProfileData.value END), 0) AS f3Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'F4 Completions' THEN ProfileData.value END), 0) AS f4Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'F5 Completions' THEN ProfileData.value END), 0) AS f5Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'F6 Completions' THEN ProfileData.value END), 0) AS f6Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'F7 Completions' THEN ProfileData.value END), 0) AS f7Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'M1 Completions' THEN ProfileData.value END), 0) AS m1Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'M2 Completions' THEN ProfileData.value END), 0) AS m2Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'M3 Completions' THEN ProfileData.value END), 0) AS m3Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'M4 Completions' THEN ProfileData.value END), 0) AS m4Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'M5 Completions' THEN ProfileData.value END), 0) AS m5Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'M6 Completions' THEN ProfileData.value END), 0) AS m6Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'M7 Completions' THEN ProfileData.value END), 0) AS m7Completions,
    IFNULL(MAX(CASE WHEN Metrics.name = 'T1 Kuudra Runs' THEN ProfileData.value END), 0) AS t1KuudraRuns,
    IFNULL(MAX(CASE WHEN Metrics.name = 'T2 Kuudra Runs' THEN ProfileData.value END), 0) AS t2KuudraRuns,
    IFNULL(MAX(CASE WHEN Metrics.name = 'T3 Kuudra Runs' THEN ProfileData.value END), 0) AS t3KuudraRuns,
    IFNULL(MAX(CASE WHEN Metrics.name = 'T4 Kuudra Runs' THEN ProfileData.value END), 0) AS t4KuudraRuns,
    IFNULL(MAX(CASE WHEN Metrics.name = 'T5 Kuudra Runs' THEN ProfileData.value END), 0) AS t5KuudraRuns,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Mythos Kills' THEN ProfileData.value END), 0) AS mythosKills,
    IFNULL(MAX(CASE WHEN Metrics.name = 'Skyblock XP' THEN ProfileData.value END), 0) AS skyblockXp
FROM ProfileData
JOIN Profiles ON Profiles.id = ProfileData.profileId
JOIN Metrics ON Metrics.id = ProfileData.metricId
GROUP BY Profiles.id, timestamp;

CREATE TEMPORARY TABLE UpdatedMetrics AS 
SELECT
    profileId,
    timestamp,
    (SELECT id FROM Metrics WHERE name = 'Jerry Event Score') AS metricId,
    (
        (fishingXp * 0.6) +
        (miningXp * 0.125) +
        (foragingXp * 1.6) +
        (farmingXp * 1.5) +
        (enchantingXp * 0.04) +
        (zombieXp * 4.68) +
        (spiderXp * 4.88) +
        (wolfXp * 17.14) +
        (endermanXp * 32.32) +
        (blazeXp * 30) +
        (vampireXp * 500) +
        (f1Completions * 37500) +
        (f2Completions * 37500) +
        (f3Completions * 37500) +
        (f4Completions * 56000) +
        (f5Completions * 43500) +
        (f6Completions * 62000) +
        (f7Completions * 143000) +
        (m1Completions * 43500) +
        (m2Completions * 48000) +
        (m3Completions * 56000) +
        (m4Completions * 69000) +
        (m5Completions * 56000) +
        (m6Completions * 69000) +
        (m7Completions * 154000) +
        (t4KuudraRuns * 41500) +
        (t5KuudraRuns * 41500) +
        (mythosKills * 5400) +
        (skyblockXp * 1500)
    ) AS value
FROM ProfileDataPivot;

INSERT INTO ProfileData (profileId, timestamp, metricId, value)
SELECT profileId, timestamp, metricId, value
FROM UpdatedMetrics
ON CONFLICT(profileId, timestamp, metricId)
DO UPDATE SET value = excluded.value;
`)

const res = db.prepare(`
WITH ProfileLeaderboard AS (
  SELECT profileId, MAX(value) - MIN(value) AS profileValue, name AS metric, counter
  FROM ProfileData
  INNER JOIN Metrics on metricId = Metrics.id
  WHERE Metrics.name = :metric
  GROUP BY profileId
)
SELECT
  username,
  cuteName,
  MAX(profileValue) AS value,
  metric, 
  counter
FROM ProfileLeaderboard
INNER JOIN Profiles on profileId = Profiles.id
INNER JOIN Players on playerId = Players.id
GROUP BY playerId
ORDER BY value DESC
`)

const rows = res.all({ metric: "Jerry Event Score" })

console.log(rows)
