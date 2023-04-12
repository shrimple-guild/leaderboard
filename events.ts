import { fetchName, fetchProfiles, guildMembers } from "./hypixel.js";
import { insertGuildMembers, insertProfileAndMetrics, setPlayerUsername } from "./database.js";

export type UpdateData = {
  players: number,
  profileUpdates: number
}

export async function update(guildId: string, timestamp: number): Promise<UpdateData> {
  console.log("Updating guild members...")
  const uuids = await guildMembers(guildId)
  console.log(uuids)
  console.log("Complete. Updating profiles...")
  insertGuildMembers(uuids)
  const profileUpdatePromises = await Promise.allSettled(uuids.map(uuid => updateProfile(uuid, timestamp)))
  const profileUpdates = profileUpdatePromises.filter(val => val.status == "fulfilled").length
  console.log("Complete. Updating players...")
  await Promise.allSettled(uuids.map(uuid => updatePlayer(uuid)))
  console.log(`Complete. ${profileUpdates}/${uuids.length}`)
  return {
    players: uuids.length,
    profileUpdates: profileUpdates
  }
}

await update("63d0278d8ea8c999a1004ef9", Date.now())
async function updatePlayer(uuid: string) {
  const name = await fetchName(uuid)
  setPlayerUsername(uuid, name)
}

async function updateProfile(uuid: string, timestamp: number) {
  console.log(`Fetching profile of ${uuid}...`)
  const profiles = await fetchProfiles(uuid)
  console.log(`Complete.`)
  profiles.map(profile => insertProfileAndMetrics(profile, timestamp))
}

