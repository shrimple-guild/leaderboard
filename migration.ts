import Database from "better-sqlite3"

interface ProfileData {
  id: number
  username: string
  cuteName: string
  name: string
  timestamp: number
  value: number
}

const db = new Database("lb_63d0278d8ea8c999a1004ef9_651316cd8ea8c9e6a31fbccb-1707606000000_1707692400000.db")

const res = db
  .prepare(
    `
WITH ProfileLeaderboard AS (
        SELECT profileId, MAX(value) - MIN(value) AS profileValue, name AS metric, counter
        FROM ProfileData
        INNER JOIN Metrics on metricId = Metrics.id
        WHERE Metrics.name = 'Mushroom Cow Bestiary'
        GROUP BY profileId
      )
      SELECT
        SUM(profileValue) AS total
      FROM ProfileLeaderboard
`
  )
  .all()

console.log(res)

/*
console.log("Removing invalid Jerry Event Scores from database.")

const query = db
  .prepare(
    `
WITH ProfileDataPivot AS (
  SELECT
    Profiles.id AS profileId,
    timestamp,
    MAX(CASE WHEN Metrics.name = 'Jerry Event Score' THEN ProfileData.ROWID END) AS jerryRowId,
    MAX(CASE WHEN Metrics.name = 'Fishing XP' THEN ProfileData.value END) AS fishingXp,
    MAX(CASE WHEN Metrics.name = 'Mining XP' THEN ProfileData.value END) AS miningXp,
    MAX(CASE WHEN Metrics.name = 'Foraging XP' THEN ProfileData.value END) AS foragingXp,
    MAX(CASE WHEN Metrics.name = 'Farming XP' THEN ProfileData.value END) AS farmingXp,
    MAX(CASE WHEN Metrics.name = 'Enchanting XP' THEN ProfileData.value END) AS enchantingXp
  FROM ProfileData
  JOIN Profiles ON Profiles.id = ProfileData.profileId
  JOIN Metrics ON Metrics.id = ProfileData.metricId
  GROUP BY Profiles.id, timestamp
)
DELETE FROM ProfileData
WHERE ROWID IN (
  SELECT jerryRowId FROM ProfileDataPivot
  WHERE fishingXp IS NULL AND miningXp IS NULL AND foragingXp IS NULL and farmingXp IS NULL and enchantingXp IS NULL
)
`
  )
  .run()

console.log(`Deleted ${query.changes} rows.`)

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
