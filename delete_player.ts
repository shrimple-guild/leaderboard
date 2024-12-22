import { Database } from "./database.js"
import metrics from "./metrics.json" with { type: "json" }
import eventConfig from "./event.json" with { type: "json" }

const dbFileName = `${eventConfig.guildIds.join("_")}-${eventConfig.start}_${eventConfig.start + eventConfig.duration}`
const dbName = `./lb_${dbFileName}.db`
const dbBackupName = `./backup_${dbFileName}.db`

const players = process.argv.slice(2)
const database = new Database(dbName, metrics)

database.backup(dbBackupName)

console.log(`Backed up database at: ${dbBackupName}`)

players.forEach((player) => {
  database.deletePlayer(player)
  console.log(`Deleted metrics of ${player}.`)
})


console.log(`Completed.`)
