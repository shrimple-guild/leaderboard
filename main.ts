import { Database } from "./Database.js"
import { API } from "./API.js"
import metrics from "./metrics.json" assert { type: "json" }
import config from "./config.json" assert { type: "json" }
import { Leaderboard } from "./Leaderboard.js"

const api = new API(config.apiKey, metrics)
const database = new Database("./farming.db", metrics)
const lb = new Leaderboard(api, database)

const guildId = config.hypixelGuildId

const guildMembers = await lb.getGuildMembers(guildId)
/*
lb.updateGuild(guildId, guildMembers)
await lb.updatePlayersInGuild(guildMembers)
await lb.updateProfilesInGuild(guildMembers, Date.now())
*/

console.log(lb.getLeaderboard("Wheat Collection", 0, Date.now()))
console.log(lb.getMetrics("appable", "Orange"))