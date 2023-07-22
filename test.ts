import { Database } from "./Database.js"
import { API } from "./API.js"
import { Leaderboard } from "./Leaderboard.js"
import { GuildEvent } from "./GuildEvent.js"
import { DiscordBot } from "./DiscordBot.js"
import metrics from "./metrics.json" assert { type: "json" }
import config from "./config.json" assert { type: "json" }
import eventConfig from "./event.json" assert { type: "json" }

const api = new API(config.apiKey, metrics)
const database = new Database("./main.db", metrics)
const lb = new Leaderboard(api, database)
const event = GuildEvent.from(eventConfig, lb)
const discordBot = await DiscordBot.create(config.discordToken, [], event)

console.log(event.getTimeseries("Toebar", "Apple", "Shark Kills"))

const res = await api.fetchProfiles("59998433ceda41c1b0acffe7d9b33594")
console.log(JSON.stringify(res, null, 4))
