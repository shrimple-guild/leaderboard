import Database from "better-sqlite3"
import { existsSync } from "fs"

const dbName = "lb_63d0278d8ea8c999a1004ef9_651316cd8ea8c9e6a31fbccb-1745190900000_1745637300000.db"

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
  IFNULL(MAX(CASE WHEN Metrics.name = 'Grim Reaper Bestiary' THEN ProfileData.value END), 0) AS grimReaperBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Phantom Fisher Bestiary' THEN ProfileData.value END), 0) AS phantomFisherBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Yeti Bestiary' THEN ProfileData.value END), 0) AS yetiBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Reindrake Bestiary' THEN ProfileData.value END), 0) AS reindrakeBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Thunder Bestiary' THEN ProfileData.value END), 0) AS thunderBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Lord Jawbus Bestiary' THEN ProfileData.value END), 0) AS lordJawbusBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Abyssal Miner Bestiary' THEN ProfileData.value END), 0) AS abyssalMinerBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Sea Emperor Bestiary' THEN ProfileData.value END), 0) AS seaEmperorBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Water Hydra Bestiary' THEN ProfileData.value END), 0) AS waterHydraBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Plhlegblast Bestiary' THEN ProfileData.value END), 0) AS plhlegblastBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Ragnarok Bestiary' THEN ProfileData.value END), 0) AS ragnarokBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Scuttler Bestiary' THEN ProfileData.value END), 0) AS scuttlerBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Titanoboa Bestiary' THEN ProfileData.value END), 0) AS titanoboaBestiary,
  IFNULL(MAX(CASE WHEN Metrics.name = 'Wiki Tiki Bestiary' THEN ProfileData.value END), 0) AS wikiTikiBestiary
FROM ProfileData
JOIN Profiles ON Profiles.id = ProfileData.profileId
JOIN Metrics ON Metrics.id = ProfileData.metricId
GROUP BY Profiles.id, timestamp;

CREATE TEMPORARY TABLE UpdatedMetrics AS 
SELECT
  profileId,
  timestamp,
  (SELECT id FROM Metrics WHERE name = 'Rare Sea Creature Score') AS metricId,
  (
    (phantomFisherBestiary * 20000) +
    (grimReaperBestiary * 64000) +
    (yetiBestiary * 40000) +
    (reindrakeBestiary * 95000) +
    (thunderBestiary * 27000) +
    (lordJawbusBestiary * 122000) +
    (abyssalMinerBestiary * 11000) +
    (seaEmperorBestiary * 30000) +
    (waterHydraBestiary * 8000) +
    (plhlegblastBestiary * 77) +
    (scuttlerBestiary * 15000) +
    (ragnarokBestiary * 93000) +
    (titanoboaBestiary * 150000) +
    (wikiTikiBestiary * 100000)
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

const rows = res.all({ metric: "Rare Sea Creature Score" })

console.log(rows)
