import { Database } from "./Database.js"
import { API } from "./API.js"
import { Leaderboard } from "./Leaderboard.js"
import { GuildEvent } from "./GuildEvent.js"
import { DiscordBot } from "./DiscordBot.js"
import metrics from "./metrics.json" assert { type: "json" }
import config from "./config.json" assert { type: "json" }
import eventConfig from "./event.json" assert { type: "json" }
import {
  getBestiary,
  getBestiaryTiers,
  getMythologicalKills,
} from "./bestiary.js"

const api = new API(config.apiKey, metrics)
const database = new Database("./main.db", metrics)
const lb = new Leaderboard(api, database)
const event = GuildEvent.from(eventConfig, lb)

const uuid = "1fb1ebe4a27148878d4edb77ad26a849"
const profileName = "peach"

const res = await fetch(
  `https://api.hypixel.net/skyblock/profiles?uuid=${uuid}&key=${config.apiKey}`
).then(res => res.json())
/*
const member = res.profiles.find((profile: any) => (
  profile.cute_name.toLocaleLowerCase() == profileName.toLocaleLowerCase()
))?.members?.[uuid]
*/

//const bestiary = getBestiary(member)
//console.log(bestiary)

const met = await api.fetchProfiles("59998433ceda41c1b0acffe7d9b33594")
console.log(JSON.stringify(met, null, 4))
