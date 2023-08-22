import Database from "better-sqlite3"

const database = new Database("./main.db")

database.exec(`
DELETE FROM ProfileData
WHERE ROWID IN (
  SELECT ProfileData.ROWID FROM ProfileData
  INNER JOIN Metrics ON ProfileData.metricId = Metrics.id
  WHERE Metrics.name = 'Skill Weight' AND ProfileData.value = 0
);
`)


