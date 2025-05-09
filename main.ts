import { Database } from "./database.js"
import { API } from "./API.js"
import { Leaderboard } from "./Leaderboard.js"
import { CronJob } from "cron"
import { GuildEvent } from "./GuildEvent.js"
import { DiscordBot } from "./DiscordBot.js"
import metrics from "./metrics.json" with { type: "json" }
import config from "./config.json" with { type: "json" }
import eventConfig from "./event.json" with { type: "json" }

const api = new API(config.apiKey, metrics)

const dbName = `./lb_${eventConfig.guildIds.join("_")}-${eventConfig.start}_${
  eventConfig.start + eventConfig.duration
}.db`
const database = new Database(dbName, metrics)
const lb = new Leaderboard(api, database)
const event = GuildEvent.from(eventConfig, lb)

const discordBot = await DiscordBot.create(config.discordToken, [], event)

console.log("Event ready.")

const runUpdateOnInit = false

const updateEventJob = new CronJob("0 15-59/20 * * * *", doEventUpdate)

async function doEventUpdate() {
  try {
    if (updateTime > event.end) {
        updateEventJob.stop();
        console.log(`Job started after expected end time, aborting.`)
      }

    console.log(`[${new Date(updateTime).toISOString()}] Starting event update.`)

    if (updateTime >= event.start) {
      await event.updateGuilds()
      console.log("Guilds updated.")

      const metric = await event.fetchMetric()
      console.log(`Event metric: ${metric}`)

      await event.updatePlayers()
      console.log(`Players updated.`)

      // tri state booleans B)
      const isStart = updateTime == event.start ? true : updateTime == event.end ? false : undefined

      await event.updateProfiles(updateTime, isStart)
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
}

let updateTime = updateEventJob.nextDate().toMillis()
updateEventJob.start()

if (runUpdateOnInit) {
  console.log("Running update on initialization.")
  await doEventUpdate()
}
