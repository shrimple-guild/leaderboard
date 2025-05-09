import { Database } from "./database.js"
import { API } from "./API.js"
import { Leaderboard } from "./Leaderboard.js"
import { GuildEvent } from "./GuildEvent.js"
import { DiscordBot } from "./DiscordBot.js"
import metrics from "./metrics.json" assert { type: "json" }
import config from "./config.json" assert { type: "json" }
import eventConfig from "./event.json" assert { type: "json" }
import { getBestiary, getBestiaryTiers, getMythologicalKills, getRareSeaCreatureScore } from "./bestiary.js"

const api = new API(config.apiKey, metrics)
const database = new Database(":memory:", metrics)
const lb = new Leaderboard(api, database)
//const event = GuildEvent.from(eventConfig, lb)

const uuid = "62e7b7bc460a45e2b5c83e56dc340acf"
const profileName = "lime"

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
