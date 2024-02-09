import { Redis } from "ioredis"

type EventData = {
  start: Date
}

export class Database {
  private redis: Redis

  constructor() {
    this.redis = new Redis()
  }

  addEvent(eventId: string, eventData: EventData) {
    this.redis.hset(eventId, eventData)
  }
}

const database = new Database()

database.addEvent("jiajdsa", { start: new Date() })
