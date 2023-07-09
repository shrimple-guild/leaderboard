import Database from "better-sqlite3";

const db = new Database("main.db")

const res = db.prepare(`
WITH Temp AS (
  SELECT DISTINCT
  Profiles.cuteName,
  Metrics.name,
  FIRST_VALUE(ProfileData.value) OVER (
    PARTITION BY Profiles.id, Metrics.id 
    ORDER BY ProfileData.timestamp DESC 
  ) - FIRST_VALUE(ProfileData.value) OVER (
    PARTITION BY Profiles.id, Metrics.id 
    ORDER BY ProfileData.timestamp ASC
  ) AS gain
  FROM Players
  JOIN Profiles ON Profiles.playerId = Players.id
  JOIN ProfileData ON ProfileData.profileId = Profiles.id
  JOIN Metrics ON Metrics.id = ProfileData.metricId
  WHERE Players.username = @playerName
  AND ProfileData.timestamp >= @startTime
  AND ProfileData.timestamp <= @endTime
  AND ProfileData.value IS NOT NULL
)
SELECT
  name,
  gain
FROM Temp
WHERE cuteName = (
  SELECT cuteName
  FROM Temp
  WHERE name = @eventMetric
  ORDER BY gain DESC
  LIMIT 1
)
`).all({
  playerName: "SemiSun",
  startTime: 0,
  eventMetric: 'Trophy Fish Weight',
  endTime: Date.now()
})

console.log(res)