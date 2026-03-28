import { Database } from "./db/database.js"
import { API } from "./api/API.js"
import { Leaderboard } from "./core/Leaderboard.js"
import { CronJob } from "cron"
import { GuildEvent } from "./core/GuildEvent.js"
import { DiscordBot } from "./bot/DiscordBot.js"
import { GatewayIntentBits } from "discord.js"
import metrics from "./data/metrics.json" with { type: "json" }
import config from "../config.json" with { type: "json" }
import eventConfig from "../event.json" with { type: "json" }

let api: API;
let database: Database;
let lb: Leaderboard;
let event: GuildEvent;
let discordBot: DiscordBot;
let updateEventJob: CronJob;
let updateTime: number;

const runUpdateOnInit = true;

async function doEventUpdate() {
  try {
    if (updateTime > event.end) {
      updateEventJob.stop();
      console.log(`Job started after expected end time, aborting.`)
      return;
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

      if (updateTime <= event.start + 60000) { // Dentro de 1 minuto do início
        await discordBot.sendIntroEmbed(event)
        console.log(`Sent start embed.`)
      } 
      
      await discordBot.sendLeaderboardEmbed(event)
      console.log(`Sent leaderboard embed.`)

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
    console.error("Error during event update:", e)
  }
}

try {
  api = new API(config.apiKey, metrics)

  const dbName = `./lb_${eventConfig.guildIds.join("_")}-${eventConfig.start}_${
    eventConfig.start + eventConfig.duration
  }.db`
  database = new Database(dbName, metrics)
  lb = new Leaderboard(api, database)
  event = GuildEvent.from(eventConfig, lb)

  discordBot = await DiscordBot.create(config.discordToken, [GatewayIntentBits.Guilds], event)

  console.log("Event ready.")

  updateEventJob = new CronJob("0 */20 * * * *", doEventUpdate)
  updateTime = updateEventJob.nextDate().toMillis()
  updateEventJob.start()

  if (runUpdateOnInit) {
    console.log("Running update on initialization.")
    updateTime = Date.now()
    await doEventUpdate()
  }
} catch (error) {
  console.error("Failed to initialize bot:", error);
  process.exit(1);
}
