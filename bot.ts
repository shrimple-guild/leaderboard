import { Client, EmbedBuilder, AttachmentBuilder, ChannelType, Message, ActionRowBuilder, StringSelectMenuBuilder, Events } from "discord.js"
import { CronJob } from "cron"
import { generateLeaderboardPlot } from "./chart.js"
import config from "./config.json" assert { type: "json" }
import { update } from "./Leaderboard.js"
import { EventMetric, EventParticipantData, eventRanking } from "./Database.js"
import { getRandomIndex } from "./random.js"

const formatter = Intl.NumberFormat('en', {
  notation: "compact",
  maximumSignificantDigits: 3,
  minimumSignificantDigits: 1
})

let lastMessage: Message<true> | undefined = undefined

const client = new Client({ intents: [] })
client.login(config.discordToken)

let crop: EventMetric | undefined = undefined

const possibleCrops: EventMetric[] = [
  "collectionCocoaBean",
  "collectionSugarCane",
  "collectionPotato",
  "collectionCarrot",
  "collectionWheat"
]

async function getEventCrop() {
  if (crop == null) {
    const index = await getRandomIndex(config.eventStart, possibleCrops.length)
    const eventCrop = crop ?? possibleCrops[index]
    crop = eventCrop
    return eventCrop
  }
  return crop
}

const updateEventJob = new CronJob("0 */15 * * * *", async () => { 
  console.log(`[${new Date().toISOString()}] Beginning event update.`)
  try {
    const updateData = await update(config.hypixelGuildId, Date.now())
    console.log(`[${new Date().toISOString()}] Update complete (${updateData.profileUpdates} / ${updateData.players} players).`)
    if (nextUpdateTime == config.eventStart) {
      const eventCrop = await getEventCrop()
      console.log(`[${new Date().toISOString()}] Sending start embed.`)
      await sendStartEmbed(eventCrop)
    } 
    if (nextUpdateTime > config.eventStart && nextUpdateTime <= config.eventEnd) {
      const eventCrop = await getEventCrop()
      console.log(`[${new Date().toISOString()}] Sending update embed.`)
      lastMessage = await sendUpdate(config.eventStart, config.eventEnd, eventCrop)
    }
    if (nextUpdateTime == config.eventEnd) {
      console.log(`[${new Date().toISOString()}] Ending event.`)
      await sendEndEmbed()
      updateEventJob.stop()
    }
    nextUpdateTime = updateEventJob.nextDate().toMillis()
    console.log(`[${new Date().toISOString()}] Update complete; next update at ${updateEventJob.nextDate().toISO()}.`)
  } catch (e) {
    console.log(e)
  }
}, undefined, true)

let nextUpdateTime = updateEventJob.nextDate().toMillis()

async function fetchChannel() {
  const guild = await client.guilds.fetch(config.discordGuildId)
  const channel = await guild.channels.fetch(config.discordChannelId)
  if (channel?.type != ChannelType.GuildText) throw Error("Output channel is not a text channel.")
  return channel
}

async function sendStartEmbed(eventCrop: EventMetric) {
  const channel = await fetchChannel()
  
}

async function sendEndEmbed() {
  const channel = await fetchChannel()
  const embed = new EmbedBuilder()
    .setTitle("Event over")
    .setColor("DarkBlue")
    .setDescription("The farming event has finished, and official results will be posted as soon as possible. Thanks for participating!")
    .setTimestamp()
  await channel.send(`<@&${config.guildMemberRole}>`)
  await channel.send({embeds: [embed]})
}

export function leaderboardEmbed(start: number, end: number, metric: EventMetric) {
  const eventData = eventRanking(start, end, metric)
  let fields = eventData.slice(0, 10).map(({ position, username, profileName, totalEventMetric }) => {
    return {
      name: `${position}. ${username} (${profileName})`,
      value: `**${formatter.format(totalEventMetric)}** ${eventMetricOrdinal(metric)}`,
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
  const icon = new AttachmentBuilder("./assets/jacob.png", { name: "jacob.png" })
  const chart = new AttachmentBuilder(generateLeaderboardPlot(start, end, metric, eventData), { name: "chart.png" })
  const embed = new EmbedBuilder()
    .setAuthor({ name: "Jacob", iconURL: "attachment://jacob.png" })
    .setTitle("Shrimple Event Leaderboard")
    .setColor("DarkBlue")
    .addFields(fields)
    .setTimestamp()
    .setImage("attachment://chart.png")
  return { embeds: [embed], files: [icon, chart] }
}

async function sendUpdate(start: number, end: number, metric: EventMetric) {
  const messageData = leaderboardEmbed(start, end, metric)
  messageData.embeds[0].setDescription(`Shrimple ${1} **${eventMetricName(metric)}** leaderboard

**Start:** <t:${Math.round(config.eventStart / 1000)}:f>
**End:** <t:${Math.round(config.eventEnd / 1000)}:f>
**Last updated:** <t:${Math.round(Date.now() / 1000)}:R>
  `)
  const channel = await fetchChannel()
  if (lastMessage) {
    return lastMessage.edit({...messageData })
  } else {
    return channel.send({...messageData })
  }
}

function continueData(start: number, data: EventParticipantData[]) {
  const continuedData = data.slice(start, start + 5)
  if (continuedData.length > 0) {
    return {
      name: "Continued",
      value: continuedData.map(({ position, username, totalEventMetric}) => `**${position}.** ${username} (${formatter.format(totalEventMetric)})`).join("\n"),
      inline: true
    }
  } else {
    return undefined
  }
}


function eventMetricOrdinal(metric: EventMetric) {
  return "collection"
}

function eventMetricName(metric: EventMetric) {
  switch (metric) {
    case "collectionCocoaBean": return "Cocoa Bean"
    case "collectionMelon": return "Melon"
    case "collectionPumpkin": return "Pumpkin"
    case "collectionSugarCane": return "Sugar Cane"
    case "collectionMushroom": return "Mushroom"
    case "collectionCactus": return "Cactus"
    case "collectionNetherWart": return "Nether Wart"
    case "collectionPotato": return "Potato"
    case "collectionCarrot": return "Carrot"
    case "collectionWheat": return "Wheat"
  }
}

