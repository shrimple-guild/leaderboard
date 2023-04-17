import AsyncLock from "async-lock"
import config from "./config.json" assert { type: "json" }
import metrics from "./metrics.json" assert { type: "json" } 

import axios from 'axios';
import axiosRetry, { isNetworkOrIdempotentRequestError as isNetworkError } from 'axios-retry';
import rateLimit from 'axios-rate-limit';

export type Profile = {
  playerId: string,
  profileId: string,
  cuteName: string,
  metrics: {metric: string, value: number | undefined}[]
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseIntOrDefault(str: string | null, num: number): number {
  return (str != null) ? (parseInt(str) || num) : num
}

const retryCount = 3

let client = axios.create({ timeout: 3000, baseURL: "https://api.hypixel.net" })
rateLimit(client, { maxRequests: 2, perMilliseconds: 1000 })
axiosRetry(client, { 
  retries: 10, 
  shouldResetTimeout: true, 
  onRetry: (retryCount, error, request) => {
    console.log(`Retrying (attempt ${retryCount})`)
  },
  retryCondition: e => isNetworkError(e) || e.code == "ECONNABORTED",
  retryDelay: retryCount => retryCount * 1000
})



export async function guildMembers(guildId: string) {
  const response = (await client.get(`https://api.hypixel.net/guild?id=${guildId}&key=${config.apiKey}`)).data
  return response?.guild?.members.map((member: any) => member.uuid) as Array<string>
}

export async function fetchName(uuid: string): Promise<string> {
  const resp = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`)
  if (resp.status != 200) throw new Error(`Failed to get Mojang data for ${uuid} (status ${resp.status})`)
  return resp.json().then(data => data.name)
}

export async function fetchProfiles(uuid: string): Promise<Profile[]> {
  const profile = (await client.get(`https://api.hypixel.net/skyblock/profiles?uuid=${uuid}&key=${config.apiKey}`)).data
  return (profile?.profiles as any[])?.map((profile: any) => {
    const profileMetrics = getMetrics(profile.members[uuid])
    return {
      playerId: uuid,
      profileId: profile.profile_id,
      cuteName: profile.cute_name,
      metrics: profileMetrics
    }
  }) 
}

function getMetrics(member: any): {metric: string, value: number}[] {
  return metrics.map(({name, path}) => ({
    metric: name,
    value: path.split(".").reduce((obj, attribute) => obj?.[attribute], member)
  })).filter(obj => obj.value != null)
}

console.log(await fetchProfiles("b4d88362b4dc4edaa5e152e92d61b543d"))
