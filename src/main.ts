import { Database } from "./db/database.js"
import { API } from "./api/API.js"
import { Leaderboard } from "./core/Leaderboard.js"
import { CronJob } from "cron"
import { GuildEvent } from "./core/GuildEvent.js"
import { DiscordBot } from "./bot/DiscordBot.js"
import { GatewayIntentBits } from "discord.js"
import metrics from "./data/metrics.json" with { type: "json" }
import config from "../config.json" with { type: "json" }
import fs from "fs"

const EVENTS_FILE = "./events.json"

let api: API;
let discordBot: DiscordBot;
let activeEvents: Map<string, { event: GuildEvent, database: Database }> = new Map();
let isUpdating = false;

// Initialize API
api = new API(config.apiKey, metrics)

// Load events from persistence
function loadEvents() {
  if (!fs.existsSync(EVENTS_FILE)) {
    fs.writeFileSync(EVENTS_FILE, '[]');
    return;
  }
  const content = fs.readFileSync(EVENTS_FILE, 'utf-8').trim();
  if (!content) return;
  
  try {
    const data = JSON.parse(content);
    for (const eventConfig of data) {
      initEvent(eventConfig);
    }
  } catch (e) {
    console.error("Failed to parse events.json, initializing empty:", e);
    fs.writeFileSync(EVENTS_FILE, '[]');
  }
}

function saveEvents() {
  const configs = Array.from(activeEvents.values()).map(e => {
    // Extract raw config from GuildEvent
    const { lb, iconAttachment, metric, ...config } = e.event as any;
    return config;
  });
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(configs, null, 2));
}

function initEvent(eventConfig: any) {
  const dbName = `./lb_${eventConfig.guildIds.join("_")}-${eventConfig.start}_${eventConfig.start + eventConfig.duration}.db`
  const database = new Database(dbName, metrics)
  const lb = new Leaderboard(api, database)
  const event = GuildEvent.from(eventConfig, lb)
  
  activeEvents.set(event.identifier(), { event, database });
  console.log(`Initialized event: ${event.name} (${event.identifier()})`);
}

// Setup Discord Bot
discordBot = await DiscordBot.create(config.discordToken, [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages
])

discordBot.setEventScheduler(async (eventConfig) => {
  initEvent(eventConfig);
  saveEvents();
});

discordBot.setSelectMenuHandler(async (interaction) => {
  const identifier = interaction.customId.split('_')[1];
  const eventData = activeEvents.get(identifier);
  if (eventData) {
    await discordBot.handleSelectMenu(interaction, eventData.event);
  }
});

discordBot.setListEventsHandler(() => {
  return Array.from(activeEvents.values()).map(e => e.event);
});

console.log("Bot ready and listening for commands.");

// Cron Jobs
const updateJob = new CronJob("0 */20 * * * *", doAllUpdates)
const statusCheckJob = new CronJob("0 * * * * *", checkEventStatus)

async function checkEventStatus() {
  if (isUpdating) return;
  const now = Date.now();
  for (const [id, { event }] of activeEvents.entries()) {
    try {
      if (now > event.end + 3600000) {
        console.log(`Event ${event.name} has ended 1h ago. Removing.`);
        activeEvents.delete(id);
        saveEvents();
        continue;
      }

      if (now >= event.start && !event.introSent) {
        console.log(`Event ${event.name} just started! Triggering initial update.`);
        await doAllUpdates();
        continue;
      }

      if (now >= event.end && !event.outroSent) {
        console.log(`Event ${event.name} just ended! Triggering final update.`);
        await doAllUpdates();
        continue;
      }
    } catch (e) {
      console.error(`Error in status check for ${event.name}:`, e);
    }
  }
}

async function doAllUpdates() {
  if (isUpdating) return;
  isUpdating = true;
  try {
    const now = Date.now();
    console.log(`[${new Date(now).toISOString()}] Starting global update for ${activeEvents.size} events.`);

    for (const [id, { event }] of activeEvents.entries()) {
      try {
        // Skip if cleanup time or already concluded
        if (now > event.end + 3600000 || (now >= event.end && event.outroSent)) continue;

        if (now >= event.start) {
          console.log(`Updating event: ${event.name}`);
          
          const isFirstUpdate = !event.introSent;
          const isStart = now <= event.start + 1200000;
          const isEnd = now >= event.end;

          if (isStart && isFirstUpdate) {
             event.introSent = true;
             saveEvents();
             await event.fetchMetric() // Ensure metric is loaded for placeholder
             await discordBot.sendIntroEmbed(event);
          }

          await event.updateGuilds()
          await event.fetchMetric()
          await event.updatePlayers()
          await event.updateProfiles(now, isStart)

          await discordBot.sendLeaderboardEmbed(event)

          if (isEnd && !event.outroSent) {
            event.outroSent = true;
            saveEvents();
            await discordBot.sendOutroEmbed(event)
          }
        } else {
          console.log(`Event ${event.name} hasn't started yet (starts in ${Math.round((event.start - now)/60000)} mins)`);
        }
      } catch (e) {
        console.error(`Error updating event ${event.name}:`, e);
      }
    }
  } finally {
    isUpdating = false;
  }
}

loadEvents();
updateJob.start();
statusCheckJob.start();

