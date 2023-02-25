import Discord, { ChannelType } from "discord.js"
import { CronJob } from "cron"
import { getLeaderboardData, PlayerData as PlayerEventData, updateMetrics, updatePlayersInGuild, updateUsernames } from "./event.js"
import { generateLeaderboardPlot } from "./chart.js"

import config from "./config.json" assert { type: "json" }

const { Client, EmbedBuilder, AttachmentBuilder } = Discord

const formatter = Intl.NumberFormat('en', {
  notation: "compact",
  maximumSignificantDigits: 3,
  minimumSignificantDigits: 1
})

const client = new Client({ intents: [] })
client.login(config.discordToken)

let lastMessage: Discord.Message<true> | undefined = undefined

const updatePlayers = new CronJob("0 35 * * * *", async () => updatePlayersData())
const updateEvent = new CronJob("0 */15 * * * *", async () => { 
  await updatePlayerMetrics() 
  if (config.eventEnd < Date.now()) {
    updatePlayers.stop()
    updateEvent.stop()
    await sendEndEmbed()
    process.exit(0)
  }
})

async function timeIt<T>(description: string, cb: () => Promise<T>): Promise<T> {
  const startDate = new Date()
  process.stdout.write(`[${startDate.toISOString()}] ${description}...`)
  const result = await cb()
  const duration = ((Date.now() - startDate.valueOf()) / 1000).toFixed(2)
  process.stdout.write(` completed in ${duration} seconds.\n`)
  return result
}

async function updatePlayersData() {
  try {
    await timeIt("Updating guild members", () => updatePlayersInGuild(config.hypixelGuildId))
    await timeIt("Updating player usernames", updateUsernames)
  } catch (e) {
    console.error(e)
  } 
}

async function updatePlayerMetrics() {
  try {
    const metricData = await timeIt("Updating player metrics", updateMetrics)
    const eventData = getLeaderboardData()
    lastMessage = await timeIt("Sending leaderboard update", () => sendUpdate(eventData, metricData))
  } catch (e) {
    console.error(e)
  }
}

async function forceUpdate() {
  await updatePlayersData()
  await updatePlayerMetrics() 
}

client.once("ready", async () => {
  console.log(`[${new Date().toISOString()}] Bot online.`)
  const timeSinceStart = Date.now() - config.eventStart 
  updatePlayers.start()
  if (timeSinceStart < 0) {
    await new Promise(resolve => setTimeout(resolve, -timeSinceStart))
    await sendStartedEmbed()
    await updatePlayerMetrics()
  } else {
    await forceUpdate()
  }
  updateEvent.start()
})

function continueData(start: number, data: PlayerEventData[]) {
  const continuedData = data.slice(start, start + 5)
  if (continuedData.length > 0) {
    return {
      name: "Continued",
      value: continuedData.map(({ rank, username, score}) => `**${rank}.** ${username} (${formatter.format(score)})`).join("\n"),
      inline: true
    }
  } else {
    return undefined
  }
}

async function fetchChannel() {
  const guild = await client.guilds.fetch(config.discordGuildId)
  const channel = await guild.channels.fetch(config.discordChannelId)
  if (channel?.type != ChannelType.GuildText) throw Error("Output channel is not a text channel.")
  return channel
}

async function sendStartedEmbed() {
  try {
    const channel = await fetchChannel()
    const embed = new EmbedBuilder()
      .setTitle("The event has started!")
      .setColor("DarkBlue")
      .setDescription(`The Diana grinding event has started! Good luck to all participants.`)
      .setTimestamp()
    await channel.send({embeds: [embed]})
    await channel.send(`<@&${config.guildMemberRole}>`)
  } catch (e) {
    console.log(e)
  }
}

async function sendEndEmbed() {
  try {
    const channel = await fetchChannel()
    const embed = new EmbedBuilder()
      .setTitle("Event over")
      .setColor("DarkBlue")
      .setDescription("The Diana grinding event has finished, and official results will be posted as soon as possible. Thanks for participating!")
      .setTimestamp()
    await channel.send({embeds: [embed]})
    await channel.send(`<@&${config.guildMemberRole}>`)
  } catch (e) {
    console.log(e)
  }
}

async function sendUpdate(eventData: PlayerEventData[], metricData: {updated: number, players: number}): Promise<Discord.Message<true>> {
  const channel = await fetchChannel()
  let fields = eventData.slice(0, 10).map(({ rank, username, profileName, endingKills, score }) => {
    return {
      name: `${rank}. ${username} (${profileName})`,
      value: `**${formatter.format(score)}** mythos kills`,
      inline: true
    }
  })
  const blankField = { name: "\u200b", value: "\u200b", inline: true }
  fields = fields.flatMap((value, index) => ((index + 1) % 2) == 0 ? [value, blankField] : value)
  const continued10 = continueData(10, eventData)
  if (continued10 != null) fields.push(continued10)
  const continued15 = continueData(15, eventData)
  if (continued15 != null) fields.push(continued15, blankField)
  if (fields.length == 0) {
    fields.push({
      name: "No data",
      value: "Either there is no event data yet, or the leaderboard broke!",
      inline: false
    })
  }
  const icon = new AttachmentBuilder("./assets/diana.png", { name: "diana.png" })
  const chart = new AttachmentBuilder(generateLeaderboardPlot(eventData), { name: "chart.png" })
  const embed = new EmbedBuilder()
    .setAuthor({ name: "Mayor Diana", iconURL: "attachment://diana.png"})
    .setTitle("Shrimple Event Leaderboard")
    .setColor("DarkBlue")
    .setDescription(`
Shrimple is having a mythological festival event for the duration of Diana! Score is based your mythological kills on your highest-kill profile.

**Start:** <t:${Math.round(config.eventStart / 1000)}:f>
**End:** <t:${Math.round(config.eventEnd / 1000)}:f>
**Last updated:** <t:${Math.round(Date.now() / 1000)}:R> (\`${metricData.updated}/${metricData.players}\` players)`)
    .addFields(fields)
    .setTimestamp()
    .setImage("attachment://chart.png")
  if (lastMessage != null) {
    try {
      await lastMessage.edit({ embeds: [embed], files: [icon, chart] })
      return lastMessage
    } catch (e) {
      console.error(new Error("Previous message was expected but was not found."))
      return channel.send({ embeds: [embed], files: [icon, chart] });
    }
  } else {
    return channel.send({ embeds: [embed], files: [icon, chart] });
  }
}

