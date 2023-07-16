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

const res = await api.fetchProfiles("6e0560b84ae84b7bad8a4f9610060c00")
console.log(JSON.stringify(res, null, 4))
