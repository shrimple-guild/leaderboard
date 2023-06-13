import Database from "better-sqlite3";

const db = new Database("farming.db")

db.exec(`
CREATE TEMPORARY TABLE ProfileDataPivot AS 
SELECT
Players.username,
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
IFNULL(MAX(CASE WHEN Metrics.name = 'M7 Completions' THEN ProfileData.value END), 0) AS m7Completions,
IFNULL(MAX(CASE WHEN Metrics.name = 'Linc Weight' THEN ProfileData.value END), 0) AS lincWeight
FROM ProfileData
JOIN Profiles ON Profiles.id = ProfileData.profileId
JOIN Metrics ON Metrics.id = ProfileData.metricId
JOIN Players ON Players.id = Profiles.playerId
GROUP BY Profiles.id, timestamp
HAVING COUNT(CASE WHEN Metrics.name = 'Linc Weight' THEN 1 END) > 0;
`)

const res = db.prepare(`
SELECT * FROM ProfileDataPivot
WHERE username = 'boostercookie' AND cuteName = 'Watermelon'
ORDER BY timestamp ASC
`).all()

console.log(res)