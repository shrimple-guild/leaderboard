import { Database } from "./db/database.js"
import { API } from "./api/API.js"
import { Leaderboard } from "./core/Leaderboard.js"
import { GuildEvent } from "./core/GuildEvent.js"
import { DiscordBot } from "./bot/DiscordBot.js"
import metrics from "../metrics.json" with { type: "json" }
import config from "../config.json" with { type: "json" }
import eventConfig from "../event.json" with { type: "json" }
import { getBestiaryTiers, getMythologicalKills, getRareSeaCreatureScore } from "./api/bestiary.js"

const api = new API(config.apiKey, metrics)
const database = new Database(":memory:", metrics)
const lb = new Leaderboard(api, database)
//const event = GuildEvent.from(eventConfig, lb)

const uuid = "56c4dee635c24a0a9d013c8f2ee679f4" // soutifdeluxe
const profileName = "tomato"

const profiles = await api.fetchProfiles(uuid)
const profile = profiles.find(profile => profile.cuteName.toLowerCase() == profileName)
console.log(profile!.metrics)

/*
const res = await fetch(`https://api.hypixel.net/skyblock/profiles?uuid=${uuid}&key=${config.apiKey}`).then(res =>
  res.json()
)


const member = res.profiles.find(
  (profile: any) => profile.cute_name.toLocaleLowerCase() == profileName.toLocaleLowerCase()
)?.members?.[uuid]
*/
/*

const profiles = await api.fetchProfiles(uuid)
const profile = profiles.find(profile => profile.cuteName.toLowerCase() == profileName)
console.log(profile!.metrics)
*/
