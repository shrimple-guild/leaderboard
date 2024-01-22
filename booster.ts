import Database from "better-sqlite3"

const db = new Database("farming_BACKUP2.db")

db.exec(`
CREATE TEMPORARY TABLE ProfileDataPivot AS 
SELECT
Players.username,
Profiles.id AS profileId,
Profiles.cuteName,
timestamp,
IFNULL(MAX(CASE WHEN Metrics.name = 'Shark Kills' THEN ProfileData.value END), 0) AS sharkKills
FROM ProfileData
JOIN Profiles ON Profiles.id = ProfileData.profileId
JOIN Metrics ON Metrics.id = ProfileData.metricId
JOIN Players ON Players.id = Profiles.playerId
GROUP BY Profiles.id, timestamp
HAVING sharkKills > 0
`)

type Row = {
  username: string
  profileId: number
  cuteName: string
  timestamp: number
  sharkKills: number
}

const res = db
  .prepare(
    `
  SELECT 
  username,
  profileId,
  cuteName,
  timestamp,
  sharkKills - LAG ( sharkKills, 1, sharkKills ) OVER ( 
    PARTITION BY profileId
		ORDER BY timestamp
  ) AS sharkKills
FROM ProfileDataPivot
ORDER BY profileId ASC, timestamp ASC
`
  )
  .all() as Row[]

type GroupedElements<T> = {
  [key: string]: T[]
}

function groupArrayElements<T>(array: T[], testingFunction: (element: T) => string): GroupedElements<T> {
  const groupedElements: GroupedElements<T> = {}

  for (const element of array) {
    const key = testingFunction(element)
    if (groupedElements[key]) {
      groupedElements[key].push(element)
    } else {
      groupedElements[key] = [element]
    }
  }

  return groupedElements
}

const profiles = groupArrayElements(res, row => `${row.username.toLowerCase()}:${row.cuteName.toLowerCase()}`)

const average = (array: number[]) => array.reduce((a, b) => a + b) / array.length

const data = Object.fromEntries(
  Object.entries(profiles)
    .map(([profile, data]) => {
      let sharkKillsThisInterval = 0
      let festivalResults = []
      for (let i = 1; i <= data.length - 1; i++) {
        let row = data[i]
        if (row.sharkKills != 0) {
          sharkKillsThisInterval += row.sharkKills
        } else {
          if (sharkKillsThisInterval > 0) {
            festivalResults.push(sharkKillsThisInterval)
          }
          sharkKillsThisInterval = 0
        }
      }
      return [profile, festivalResults.length > 0 ? average(festivalResults) : 0]
    })
    .filter(val => val[1] != 0)
    .sort((a: any, b: any) => b[1] - a[1])
)

console.log(data)
