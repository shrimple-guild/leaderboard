import Database from "better-sqlite3"

interface ProfileData {
  id: number
  username: string
  cuteName: string
  name: string
  timestamp: number
  value: number
}

const db = new Database("farming.db")

/*
db.exec(`
CREATE TEMPORARY TABLE ProfileDataPivot AS 
SELECT
username,
Profiles.id AS profileId,
Profiles.cuteName,
timestamp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Fishing XP' THEN ProfileData.value END), 0) AS fishingXp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Mining XP' THEN ProfileData.value END), 0) AS miningXp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Foraging XP' THEN ProfileData.value END), 0) AS foragingXp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Farming XP' THEN ProfileData.value END), 0) AS farmingXp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Carpentry XP' THEN ProfileData.value END), 0) AS carpentryXp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Enchanting XP' THEN ProfileData.value END), 0) AS enchantingXp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Mythos Kills' THEN ProfileData.value END), 0) AS mythosKills,
IFNULL(MAX(CASE WHEN Metrics.name = 'Skyblock Experience' THEN ProfileData.value END), 0) AS skyblockExperience,
IFNULL(MAX(CASE WHEN Metrics.name = 'Zombie XP' THEN ProfileData.value END), 0) AS zombieXp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Spider XP' THEN ProfileData.value END), 0) AS spiderXp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Wolf XP' THEN ProfileData.value END), 0) AS wolfXp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Enderman XP' THEN ProfileData.value END), 0) AS endermanXp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Blaze XP' THEN ProfileData.value END), 0) AS blazeXp,
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
IFNULL(MAX(CASE WHEN Metrics.name = 'M7 Completions' THEN ProfileData.value END), 0) AS m7Completions
FROM ProfileData
JOIN Profiles ON Profiles.id = ProfileData.profileId
JOIN Metrics ON Metrics.id = ProfileData.metricId
JOIN Players ON Players.id = Profiles.playerId
GROUP BY Profiles.id, timestamp
HAVING COUNT(CASE WHEN Metrics.name = 'Linc Weight' THEN 1 END) > 0;
CREATE TEMPORARY TABLE ProfileLincWeight AS 
SELECT
  profileId,
  timestamp,
  (
    (fishingXp * 0.2) +
    (miningXp * 0.2) +
    (foragingXp * 1.33) +
    (farmingXp * 1) +
    (enchantingXp * 0.01) +
    (carpentryXp * 0.01) +
    (zombieXp * 3.12) +
    (spiderXp * 4.88) +
    (wolfXp * 16.13) +
    (endermanXp * 18.18) +
    (blazeXp * 52.63) +
    (f1Completions * 25000) +
    (f2Completions * 25000) +
    (f3Completions * 25000) +
    (f4Completions * 42000) +
    (f5Completions * 33000) +
    (f6Completions * 50000) +
    (f7Completions * 110000) +
    (m1Completions * 33000) +
    (m2Completions * 33000) +
    (m3Completions * 42000) +
    (m4Completions * 50000) +
    (m5Completions * 42000) +
    (m6Completions * 59000) +
    (m7Completions * 125000) +
    (mythosKills * 3650) +
    (skyblockExperience * 1000)
  ) AS lincWeight
FROM ProfileDataPivot;
UPDATE ProfileData
SET value = (
  SELECT lincWeight
  FROM ProfileLincWeight
  WHERE ProfileLincWeight.profileId = ProfileData.profileId
    AND ProfileLincWeight.timestamp = ProfileData.timestamp
)
WHERE metricId = (
  SELECT id
  FROM Metrics
  WHERE name = 'Linc Weight'
);
`)

/*
const data = db.prepare("SELECT * FROM ProfileLincWeight").all()



const stmt = db.prepare(`
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
const ranking = stmt.all({ metric: "Linc Weight", start: 1685373300000, end: 1685373300000 + 446400000, guildId: "63d0278d8ea8c999a1004ef9" }) 
console.log(ranking)

*/
