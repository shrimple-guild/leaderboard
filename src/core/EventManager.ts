import { Database } from "../db/database.js"
import { API } from "../api/API.js"
import { Leaderboard } from "./Leaderboard.js"
import { GuildEvent } from "./GuildEvent.js"
import { CronJob } from "cron"
import fs from "fs"
import { DiscordBot } from "../bot/DiscordBot.js"

const EVENTS_FILE = "./events.json"

export class EventManager {
  public activeEvents: Map<string, { event: GuildEvent, database: Database }> = new Map()
  private isUpdating = false
  private updateJob: CronJob
  private statusCheckJob: CronJob

  constructor(private api: API, private metrics: any, private discordBot: DiscordBot) {
    this.updateJob = new CronJob("0 */20 * * * *", () => this.doAllUpdates())
    this.statusCheckJob = new CronJob("0 * * * * *", () => this.checkEventStatus())
  }

  async start() {
    await this.loadEvents()
    this.updateJob.start()
    this.statusCheckJob.start()
    console.log("EventManager started.")
  }

  async loadEvents() {
    if (!fs.existsSync(EVENTS_FILE)) {
      fs.writeFileSync(EVENTS_FILE, '[]')
      return
    }
    const content = fs.readFileSync(EVENTS_FILE, 'utf-8').trim()
    if (!content) return
    
    try {
      const data = JSON.parse(content)
      for (const eventConfig of data) {
        await this.initEvent(eventConfig)
      }
    } catch (e) {
      console.error("Failed to parse events.json, initializing empty:", e)
      fs.writeFileSync(EVENTS_FILE, '[]')
    }
  }

  saveEvents() {
    const configs = Array.from(this.activeEvents.values()).map(e => {
      const { lb, iconAttachment, metric, ...config } = e.event as any
      config.id = e.event.identifier()
      return config
    })
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(configs, null, 2))
  }

  async initEvent(eventConfig: any) {
    const dbName = `./lb_${eventConfig.guildIds.join("_")}-${eventConfig.start}_${eventConfig.start + eventConfig.duration}.db`
    const database = new Database(dbName, this.metrics)
    const lb = new Leaderboard(this.api, database)
    const event = GuildEvent.from(eventConfig, lb)
    
    await event.fetchMetric()
    const identifier = event.identifier()
    this.activeEvents.set(identifier, { event, database })
    console.log(`Initialized event: ${event.name} (${identifier})`)
  }

  async checkEventStatus() {
    if (this.isUpdating) return
    const now = Date.now()
    for (const [id, { event }] of this.activeEvents.entries()) {
      try {
        if (now > event.end + 86400000) {
          console.log(`Event ${event.name} has ended 24h ago. Removing.`)
          this.activeEvents.delete(id)
          this.saveEvents()
          continue
        }

        if (now >= event.start && !event.introSent) {
          console.log(`Event ${event.name} just started! Triggering initial update.`)
          await this.doAllUpdates()
          continue
        }

        if (now >= event.end && !event.outroSent) {
          console.log(`Event ${event.name} just ended! Triggering final update.`)
          await this.doAllUpdates()
          continue
        }
      } catch (e) {
        console.error(`Error in status check for ${event.name}:`, e)
      }
    }
  }

  async doAllUpdates() {
    if (this.isUpdating) return
    this.isUpdating = true
    try {
      const now = Date.now()
      console.log(`[${new Date(now).toISOString()}] Starting global update for ${this.activeEvents.size} events.`)

      for (const [id, { event }] of this.activeEvents.entries()) {
        try {
          if (now > event.end + 86400000 || (now >= event.end && event.outroSent)) continue

          if (now >= event.start) {
            console.log(`Updating event: ${event.name}`)
            
            const isFirstUpdate = !event.introSent
            const isStart = now <= event.start + 1200000
            const isEnd = now >= event.end

            if (isStart && isFirstUpdate) {
               event.introSent = true
               this.saveEvents()
               await event.fetchMetric()
               await this.discordBot.sendIntroEmbed(event)
            }

            await event.updateGuilds()
            await event.fetchMetric()
            await event.updatePlayers()
            await event.updateProfiles(now, isStart)

            await this.discordBot.sendLeaderboardEmbed(event)

            if (isEnd && !event.outroSent) {
              event.outroSent = true
              this.saveEvents()
              await this.discordBot.sendOutroEmbed(event)
            }
          } else {
            console.log(`Event ${event.name} hasn't started yet (starts in ${Math.round((event.start - now)/60000)} mins)`)
          }
        } catch (e) {
          console.error(`Error updating event ${event.name}:`, e)
        }
      }
    } finally {
      this.isUpdating = false
    }
  }

  getEvents() {
    return Array.from(this.activeEvents.values()).map(e => e.event)
  }

  async deleteEvent(identifier: string) {
    const deleted = this.activeEvents.delete(identifier)
    if (deleted) {
      this.saveEvents()
      return true
    }
    return false
  }

  async forceStartEvent(identifier: string) {
    const eventData = this.activeEvents.get(identifier)
    if (eventData && !eventData.event.hasStarted) {
      eventData.event.start = Date.now()
      this.saveEvents()
      return true
    }
    return false
  }

  async modifyDuration(identifier: string, action: 'extend' | 'reduce', hours: number) {
    const eventData = this.activeEvents.get(identifier)
    if (eventData) {
      const ms = hours * 3600000
      if (action === 'extend') {
        eventData.event.duration += ms
        if (eventData.event.outroSent && Date.now() < eventData.event.end) {
          eventData.event.outroSent = false
        }
      } else {
        eventData.event.duration = Math.max(3600000, eventData.event.duration - ms)
      }
      this.saveEvents()
      return true
    }
    return false
  }
}
