import Database from "better-sqlite3"
import { existsSync } from "fs"

const dbName = "lb_63d0278d8ea8c999a1004ef9_651316cd8ea8c9e6a31fbccb-1735371300000_1735816500000.db"
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
  IFNULL(MAX(CASE WHEN Metrics.name = 'Alchemy XP' THEN ProfileData.value END), 0) AS alchemyXp,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Runecrafting XP' THEN ProfileData.value END), 0) AS runecraftingXp,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Mining XP' THEN ProfileData.value END), 0) AS miningXp,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Farming XP' THEN ProfileData.value END), 0) AS farmingXp,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Enchanting XP' THEN ProfileData.value END), 0) AS enchantingXp,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Taming XP' THEN ProfileData.value END), 0) AS tamingXp,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Foraging XP' THEN ProfileData.value END), 0) AS foragingXp,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Social XP' THEN ProfileData.value END), 0) AS socialXp,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Carpentry XP' THEN ProfileData.value END), 0) AS carpentryXp,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Combat XP' THEN ProfileData.value END), 0) AS combatXp
FROM ProfileData
JOIN Profiles ON Profiles.id = ProfileData.profileId
JOIN Metrics ON Metrics.id = ProfileData.metricId
GROUP BY Profiles.id, timestamp;

CREATE TEMPORARY TABLE UpdatedMetrics AS 
SELECT
  profileId,
  timestamp,
  (SELECT id FROM Metrics WHERE name = 'Skill Weight') AS metricId,
  (
    (fishingXp * 0.6) +
    (miningXp * 0.2) +
    (combatXp * 0.375) +
    (foragingXp * 1.6) +
    (farmingXp * 1.2) +
    (enchantingXp * 0.04) +
    (alchemyXp * 0.002) +
    (socialXp * 7.77)
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

const rows = res.all({ metric: "Skill Weight" })

console.log(rows)
