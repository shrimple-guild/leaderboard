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
      .setPlaceholder("View specific slayers!")
      .setOptions(
        {
          label: "Zombie",
          description: "Revenant Horror",
          value: "slayerZombie"
        },
        {
          label: "Spider",
          description: "Tarantula Broodfather",
          value: "slayerSpider"
        },
        {
          label: "Wolf",
          description: "Sven Packmaster",
          value: "slayerWolf"
        },
        {
          label: "Enderman",
          description: "Voidgloom Seraph",
          value: "slayerEnderman"
        },
        {
          label: "Blaze",
          description: "Inferno Demonhunter990",
          value: "slayerBlaze"
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
      lastMessage = await sendUpdate(config.eventStart, config.eventEnd, "slayerScore")
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
    .setDescription(`The slayer event has started! Good luck to all participants.`)
    .setTimestamp()
  await channel.send(`<@&${config.guildMemberRole}>`)
  await channel.send({embeds: [embed]})
}

async function sendEndEmbed() {
  const channel = await fetchChannel()
  const embed = new EmbedBuilder()
    .setTitle("Event over")
    .setColor("DarkBlue")
    .setDescription("The slayer event has finished, and official results will be posted as soon as possible. Thanks for participating!")
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
  const icon = new AttachmentBuilder("./assets/maddox.png", { name: "maddox.png" })
  const chart = new AttachmentBuilder(generateLeaderboardPlot(start, end, metric, eventData), { name: "chart.png" })
  const embed = new EmbedBuilder()
    .setAuthor({ name: "Maddox", iconURL: "attachment://maddox.png" })
    .setTitle("Shrimple Event Leaderboard")
    .setColor("DarkBlue")
    .addFields(fields)
    .setTimestamp()
    .setImage("attachment://chart.png")
  return { embeds: [embed], files: [icon, chart] }
}

async function sendUpdate(start: number, end: number, metric: EventMetric) {
  const messageData = leaderboardEmbed(start, end, metric)
  messageData.embeds[0].setDescription(`Are you ready to take on a new challenge and elevate your slayer game to the next level? Our guild is excited to announce an upcoming event focused on gaining Slayer XP. As you know, slaying monsters is an integral part of the Hypixel Skyblock experience, and we want to help our guild members become the best slayers they can be.

During this Slayer XP event, we will be focusing on a variety of different slayers, including zombie, spider, wolf, enderman, and blaze. Each of these slayers presents its unique challenges and rewards. There's something for everyone in this exciting Slayer XP event!

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
    case "slayerZombie": return "For zombie slayers, we will be targeting various types of zombies, including Revenants and Crypt Ghouls. These undead creatures are known for their strength and resilience, so you will need to come prepared with your strongest weapons and armor."
    case "slayerSpider": return "Spider slayers, on the other hand, will require you to venture into the Spider's Den and take on the likes of Brood Mother and Weaver. These spiders are quick and agile, so make sure you have plenty of speed potions and spider armor to keep up with them."
    case "slayerWolf": return "If you're a wolf slayer, you'll be hunting down various wolf packs and their leaders, including the Howling Alpha and Packmaster. These fierce canines are known for their ferocity and teamwork, so you'll need to work together with your guild members to take them down."
    case "slayerEnderman": return "Enderman slayers will need to travel to The End and face off against the likes of Voidgloom Seraph and Endermite. These teleporting creatures are notoriously difficult to pin down, so be prepared to use your wits and quick reflexes."
    case "slayerBlaze": return "Finally, for blaze slayers, we'll be heading to the blazing fortress to battle against Blazemen and the fearsome Blaze Boss. These fiery monsters are immune to most forms of damage, so you'll need to bring water buckets and fire resistance potions to survive."
    default: return ""
  }
}


function eventMetricOrdinal(metric: EventMetric) {
  switch (metric) {
    case "slayerScore": return "score"
    case "slayerZombie": return "zombie xp"
    case "slayerSpider": return "spider xp"
    case "slayerWolf": return "wolf xp"
    case "slayerEnderman": return "enderman xp"
    case "slayerBlaze": return "blaze xp"
  }
}
