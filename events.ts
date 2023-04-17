import { fetchName, fetchProfiles, guildMembers } from "./hypixel.js";
import { updateGuildMembers, insertProfileAndMetrics, insertPlayer, getGuildMembers } from "./database.js";

async function updateGuild(guildId: string) {
  const uuids = await guildMembers(guildId)
  updateGuildMembers(guildId, uuids)
}

async function updatePlayersInGuild(guildId: string) {
  const uuids = getGuildMembers(guildId)
  const result = await Promise.allSettled(uuids.map(uuid => updatePlayer(uuid)))
  return successRate(result)
}

async function updateProfilesInGuild(guildId: string, timestamp: number) {
  const uuids = getGuildMembers(guildId)
  const result = await Promise.allSettled(uuids.map(uuid => updateProfiles(uuid, timestamp)))
  console.log(result)
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


console.log(await updateProfilesInGuild("63d0278d8ea8c999a1004ef9", Date.now()))