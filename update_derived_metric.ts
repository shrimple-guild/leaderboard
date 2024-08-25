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
IFNULL(MAX(CASE WHEN Metrics.name = 'Grim Reaper Bestiary' THEN ProfileData.value END), 0) AS grimReaper,
IFNULL(MAX(CASE WHEN Metrics.name = 'Yeti Bestiary' THEN ProfileData.value END), 0) AS yeti,
IFNULL(MAX(CASE WHEN Metrics.name = 'Reindrake Bestiary' THEN ProfileData.value END), 0) AS reindrake,
IFNULL(MAX(CASE WHEN Metrics.name = 'Great White Shark Bestiary' THEN ProfileData.value END), 0) AS greatWhiteShark,
IFNULL(MAX(CASE WHEN Metrics.name = 'Thunder Bestiary' THEN ProfileData.value END), 0) AS thunder,
IFNULL(MAX(CASE WHEN Metrics.name = 'Lord Jawbus Bestiary' THEN ProfileData.value END), 0) AS lordJawbus,
IFNULL(MAX(CASE WHEN Metrics.name = 'Abyssal Miner Bestiary' THEN ProfileData.value END), 0) AS abyssalMiner,
IFNULL(MAX(CASE WHEN Metrics.name = 'Flaming Worm Bestiary' THEN ProfileData.value END), 0) AS flamingWorm,
IFNULL(MAX(CASE WHEN Metrics.name = 'Sea Emperor Bestiary' THEN ProfileData.value END), 0) AS seaEmperor,
IFNULL(MAX(CASE WHEN Metrics.name = 'Water Hydra Bestiary' THEN ProfileData.value END), 0) AS waterHydra,
IFNULL(MAX(CASE WHEN Metrics.name = 'Lava Blaze Bestiary' THEN ProfileData.value END), 0) AS lavaBlaze,
IFNULL(MAX(CASE WHEN Metrics.name = 'Lava Pigman Bestiary' THEN ProfileData.value END), 0) AS lavaPigman
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
    (nightSquid * 18000) +
    (grimReaper * 252000) +
    (yeti * 74000) +
    (reindrake * 191000) +
    (greatWhiteShark * 38000) +
    (thunder * 77000) +
    (lordJawbus * 306000) +
    (abyssalMiner * 22000) +
    (flamingWorm * 800) +
    (seaEmperor * 60000) +
    (waterHydra * 15000) +
    (lavaBlaze * 1300) +
    (lavaPigman * 1300)
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

const rows = res.all({ metric: "Rare Sea Creature Score" })

console.log(rows)
