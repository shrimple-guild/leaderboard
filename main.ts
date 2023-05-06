import { Database } from "./Database.js"
import { API } from "./API.js"
import { Leaderboard } from "./Leaderboard.js"
import { CronJob } from "cron"
import { GuildEvent } from "./GuildEvent.js"
import { DiscordBot } from "./DiscordBot.js"

import metrics from "./metrics.json" assert { type: "json" }
import config from "./config.json" assert { type: "json" }
import eventConfig from "./event.json" assert { type: "json" }

const api = new API(config.apiKey, metrics)
const database = new Database("./farming.db", metrics)
const lb = new Leaderboard(api, database)
const discordBot = await DiscordBot.create(config.discordToken, [])

const event = GuildEvent.from(eventConfig, lb)

const updateEventJob = new CronJob("0 */15 * * * *", async () => { 
  try {
    await event.updateGuild()

    if (updateTime < event.start) return
    if (!event.metric) await event.fetchMetric()
  
    await event.updatePlayers()
    await event.updateProfiles(updateTime)
  
    if (updateTime == event.start) {
      await discordBot.sendIntroEmbed(event)
    } else {
      await discordBot.sendLeaderboardEmbed(event)
    }
  
    if (updateTime == event.end) {
      await discordBot.sendOutroEmbed(event)
      updateEventJob.stop()
    }
  
    updateTime = updateEventJob.nextDate().toMillis()
  } catch (e) {
    console.error(e)
  }
})

let updateTime = updateEventJob.nextDate().toMillis()
updateEventJob.start()
