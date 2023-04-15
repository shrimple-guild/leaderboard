import { fetchName, fetchProfiles, guildMembers } from "./hypixel.js";
import { updateGuildMembers, insertProfileAndMetrics, insertPlayer, getGuildMembers } from "./database.js";

async function updateGuild(guildId: string) {
  const uuids = await guildMembers(guildId)
  updateGuildMembers(guildId, uuids)
}

async function updatePlayersInGuild() {
  const uuids = getGuildMembers()
  const result = await Promise.allSettled(uuids.map(uuid => updatePlayer(uuid)))
  return successRate(result)
}

async function updateProfilesInGuild(timestamp: number) {
  const uuids = getGuildMembers()
  const result = await Promise.allSettled(uuids.map(uuid => updateProfiles(uuid, timestamp)))
  return successRate(result)
}

async function updatePlayer(uuid: string) {
  const name = await fetchName(uuid)
  insertPlayer(uuid, name)
}

async function updateProfiles(uuid: string, timestamp: number) {
  const profiles = await fetchProfiles(uuid)
  profiles.map(profile => insertProfileAndMetrics(profile, timestamp))
}

async function successRate<T>(settled: PromiseSettledResult<T>[]) {
  return {
    fulfilled: settled.filter(value => value.status == "fulfilled").length,
    total: settled.length
  }
}
