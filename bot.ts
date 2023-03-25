import { Client, EmbedBuilder, AttachmentBuilder, ChannelType, Message, ActionRowBuilder, StringSelectMenuBuilder, Events } from "discord.js"
import { CronJob } from "cron"
import { generateLeaderboardPlot } from "./chart.js"
import config from "./config.json" assert { type: "json" }
import { update } from "./events.js"
import { EventMetric, EventParticipantData, eventRanking } from "./database.js"

const formatter = Intl.NumberFormat('en', {
  notation: "compact",
  maximumSignificantDigits: 3,
  minimumSignificantDigits: 1
})

const dataRow = new ActionRowBuilder<StringSelectMenuBuilder>()
  .addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("selectData")
      .setPlaceholder("View specific kuudra tiers!")
      .setOptions(
        {
          label: "Basic Kuudra",
          value: "kuudraBasic"
        },
        {
          label: "Hot Kuudra",
          value: "kuudraHot"
        },
        {
          label: "Burning Kuudra",
          value: "kuudraBurning"
        },
        {
          label: "Fiery Kuudra",
          value: "kuudraFiery"
        },
        {
          label: "Infernal Kuudra",
          value: "kuudraInfernal"
        }
      )
  )

let lastMessage: Message<true> | undefined = undefined

const client = new Client({ intents: [] })
client.login(config.discordToken)

client.on(Events.InteractionCreate, (interaction) => {
  try {
    if (!interaction.inCachedGuild() || !interaction.isStringSelectMenu()) return
    if (interaction.customId != "selectData") return
    const option = interaction.values[0] as EventMetric
    const data = leaderboardEmbed(config.eventStart, config.eventEnd, option)
    data.embeds[0].setDescription(eventMetricDescription(option))
    interaction.reply({ ...data, ephemeral: true })
  } catch (e) {
    console.log(e)
  }
})

const updateEventJob = new CronJob("0 */15 * * * *", async () => { 
  console.log(`[${new Date().toISOString()}] Beginning event update.`)
  try {
    const updateData = await update(config.hypixelGuildId, Date.now())
    console.log(`[${new Date().toISOString()}] Update complete (${updateData.profileUpdates} / ${updateData.players} players).`)
    if (nextUpdateTime == config.eventStart) {
      console.log(`[${new Date().toISOString()}] Sending start embed.`)
      await sendStartEmbed()
    } 
    if (nextUpdateTime > config.eventStart && nextUpdateTime <= config.eventEnd) {
      console.log(`[${new Date().toISOString()}] Sending update embed.`)
      lastMessage = await sendUpdate(config.eventStart, config.eventEnd, "kuudraCompletions")
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

async function sendStartEmbed() {
  const channel = await fetchChannel()
  const embed = new EmbedBuilder()
    .setTitle("The event has started!")
    .setColor("DarkBlue")
    .setDescription(`The Kuudra event has started! Good luck to all participants.`)
    .setTimestamp()
  await channel.send(`<@&${config.guildMemberRole}>`)
  await channel.send({embeds: [embed]})
}

async function sendEndEmbed() {
  const channel = await fetchChannel()
  const embed = new EmbedBuilder()
    .setTitle("Event over")
    .setColor("DarkBlue")
    .setDescription("The Kuudra event has finished, and official results will be posted as soon as possible. Thanks for participating!")
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
  const icon = new AttachmentBuilder("./assets/elle.png", { name: "elle.png" })
  const chart = new AttachmentBuilder(generateLeaderboardPlot(start, end, metric, eventData), { name: "chart.png" })
  const embed = new EmbedBuilder()
    .setAuthor({ name: "Elle", iconURL: "attachment://elle.png" })
    .setTitle("Shrimple Event Leaderboard")
    .setColor("DarkBlue")
    .addFields(fields)
    .setTimestamp()
    .setImage("attachment://chart.png")
  return { embeds: [embed], files: [icon, chart] }
}

async function sendUpdate(start: number, end: number, metric: EventMetric) {
  const messageData = leaderboardEmbed(start, end, metric)
  messageData.embeds[0].setDescription(`Attention hypixel skyblock guild members! Join us for an exciting guild event where we'll be competing to complete the most Kuudra runs in a single day. Kuudra runs are a challenging game mode that will test your skills and strategic planning as you navigate through obstacles and defeat bosses. Work with your guildmates to climb the leaderboard and emerge as the champion. The top player with the most completed runs will be rewarded with a special prize. Join us for a day of intense adventure and show us what you're made of in the Kuudra fight!

**Start:** <t:${Math.round(config.eventStart / 1000)}:f>
**End:** <t:${Math.round(config.eventEnd / 1000)}:f>
**Last updated:** <t:${Math.round(Date.now() / 1000)}:R>
  `)
  const channel = await fetchChannel()
  if (lastMessage) {
    return lastMessage.edit({...messageData, components: [dataRow] })
  } else {
    return channel.send({...messageData, components: [dataRow] })
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

function eventMetricDescription(metric: EventMetric) {
  switch (metric) {
    case "kuudraBasic": return "Basic kuudra completion leaderboard"
    case "kuudraHot": return "Hot kuudra completion leaderboard."
    case "kuudraBurning": return "Burning kuudra completion leaderboard."
    case "kuudraFiery": return "Fiery kuudra completion leaderboard."
    case "kuudraInfernal": return "Infernal kuudra completion leaderboard."
    default: return ""
  }
}

function eventMetricOrdinal(metric: EventMetric) {
  switch (metric) {
    case "kuudraBasic": return "completions"
    case "kuudraHot": return "completions"
    case "kuudraBurning": return "completions"
    case "kuudraFiery": return "completions"
    case "kuudraInfernal": return "completions"
    case "kuudraCompletions": return "completions"
  }
}
