import { fetchName, fetchProfiles, guildMembers } from "./hypixel.js";
import { insertGuildMembers, insertProfileAndMetrics, setPlayerUsername } from "./database.js";

export type UpdateData = {
  players: number,
  profileUpdates: number
}

export async function update(guildId: string, timestamp: number): Promise<UpdateData> {
  const uuids = await guildMembers(guildId)
  insertGuildMembers(uuids)
  const profileUpdatePromises = await Promise.allSettled(uuids.map(uuid => updateProfile(uuid, timestamp)))
  const profileUpdates = profileUpdatePromises.filter(val => val.status == "fulfilled").length
  await Promise.allSettled(uuids.map(uuid => updatePlayer(uuid)))
  return {
    players: uuids.length,
    profileUpdates: profileUpdates
  }
}

async function updatePlayer(uuid: string) {
  const name = await fetchName(uuid)
  setPlayerUsername(uuid, name)
}

async function updateProfile(uuid: string, timestamp: number) {
  const profiles = await fetchProfiles(uuid)
  profiles.map(profile => insertProfileAndMetrics(profile, timestamp))
}

