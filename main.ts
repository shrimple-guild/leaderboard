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
const database = new Database("./main.db", metrics)
const lb = new Leaderboard(api, database)
const event = GuildEvent.from(eventConfig, lb)
const discordBot = await DiscordBot.create(config.discordToken, [], event)

console.log("Event ready.")

const updateEventJob = new CronJob("0 */15 * * * *", async () => {
  try {
    console.log(
      `[${new Date(updateTime).toISOString()}] Starting event update.`
    )

    if (updateTime >= event.start) {
      await event.updateGuild()
      console.log("Guild updated.")

      const metric = await event.fetchMetric()
      console.log(`Event metric: ${metric}`)

      await event.updatePlayers()
      console.log(`Players updated.`)

      await event.updateProfiles(updateTime)
      console.log(`Profiles updated.`)

      if (updateTime == event.start) {
        await discordBot.sendIntroEmbed(event)
        console.log(`Sent start embed.`)
      } else {
        await discordBot.sendLeaderboardEmbed(event)
        console.log(`Sent leaderboard embed.`)
      }

      if (updateTime == event.end) {
        await discordBot.sendOutroEmbed(event)
        console.log(`Sent outro embed; stopping.`)

        updateEventJob.stop()
      }
    } else {
      console.log(`Skipping because the event hasn't started yet!`)
    }
    updateTime = updateEventJob.nextDate().toMillis()
  } catch (e) {
    console.error(e)
  }
})

let updateTime = updateEventJob.nextDate().toMillis()
updateEventJob.start()
