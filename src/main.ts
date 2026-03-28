import { API } from "./api/API.js"
import { EventManager } from "./core/EventManager.js"
import { DiscordBot } from "./bot/DiscordBot.js"
import { GatewayIntentBits } from "discord.js"
import metrics from "./data/metrics.json" with { type: "json" }
import config from "../config.json" with { type: "json" }

const api = new API(config.apiKey, metrics)

const discordBot = await DiscordBot.create(
  config.discordToken, 
  [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
)

const eventManager = new EventManager(api, metrics, discordBot)

discordBot.initInteractionManager(eventManager)

await eventManager.start()

console.log("Application fully initialized and running.")