import Database from "better-sqlite3"
import { existsSync } from "fs"

const dbName = "lb_63d0278d8ea8c999a1004ef9-1723435200000_1723694400000.db"
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
IFNULL(MAX(CASE WHEN Metrics.name = 'Zombie XP' THEN ProfileData.value END), 0) AS zombie,
IFNULL(MAX(CASE WHEN Metrics.name = 'Spider XP' THEN ProfileData.value END), 0) AS spider,
IFNULL(MAX(CASE WHEN Metrics.name = 'Wolf XP' THEN ProfileData.value END), 0) AS wolf,
IFNULL(MAX(CASE WHEN Metrics.name = 'Enderman XP' THEN ProfileData.value END), 0) AS enderman,
IFNULL(MAX(CASE WHEN Metrics.name = 'Blaze XP' THEN ProfileData.value END), 0) AS blaze,
IFNULL(MAX(CASE WHEN Metrics.name = 'Vampire XP' THEN ProfileData.value END), 0) AS vampire
FROM ProfileData
JOIN Profiles ON Profiles.id = ProfileData.profileId
JOIN Metrics ON Metrics.id = ProfileData.metricId
GROUP BY Profiles.id, timestamp
HAVING COUNT(CASE WHEN Metrics.name = 'Slayer Weight' THEN 1 END) > 0;

CREATE TEMPORARY TABLE UpdatedMetrics AS 
SELECT
  profileId,
  timestamp,
  (SELECT id FROM Metrics WHERE name = 'Slayer Weight') AS metricId,
  (
    (zombie * 0.15) +
    (spider * 0.16) +
    (wolf * 0.55) +
    (enderman * 0.75) +
    (blaze * 0.64) +
    (vampire * 31)
  ) AS value
FROM ProfileDataPivot;

UPDATE ProfileData
SET value = updated.value
FROM UpdatedMetrics updated
WHERE ProfileData.profileId = updated.profileId
  AND ProfileData.timestamp = updated.timestamp
  AND ProfileData.metricId = updated.metricId;
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

const rows = res.all({ metric: "Slayer Weight" })

console.log(rows)
