import { GuildEvent } from "GuildEvent";
import { generateLeaderboardPlot } from "./chart.js";
import { AttachmentBuilder, ChannelType, EmbedBuilder, Events, GatewayIntentBits, Message, MessageCreateOptions, MessagePayload } from "discord.js";
import { Client } from "discord.js";
import { LeaderboardPosition } from "types.js";

export class DiscordBot {
  currentMessage?: Message<true>

  private constructor(private client: Client<true>) {}

  static async create(token: string, intents: GatewayIntentBits[]) {
    const client = new Client({ intents: intents })
    client.login(token)
    const clientReady: Client<true> = await new Promise((resolve, reject) => {
      client.once(Events.Error, reject)
      client.once(Events.ClientReady, (client) => {
        client.off(Events.Error, reject)
        resolve(client)
      })
    })
    return new DiscordBot(clientReady)
  }

  async fetchLeaderboardChannel(event: GuildEvent) {
    const guild = await this.client.guilds.fetch(event.discordGuildId)
    const channel = await guild.channels.fetch(event.discordChannelId)
    if (channel?.type != ChannelType.GuildText) throw Error("Output channel is not a text channel.")
    return channel
  }

  async sendIntroEmbed(event: GuildEvent) {
    const embed = new EmbedBuilder()
      .setTitle("The event has started!")
      .setColor("Green")
      .setDescription(event.parse(event.intro))
      .setTimestamp()
    this.send(event, { embeds: [embed] }, false, true)
  }

  async sendLeaderboardEmbed(event: GuildEvent) {
    const leaderboard = event.getLeaderboard()
    if (!leaderboard) return
    const plot = generateLeaderboardPlot(event, leaderboard)
    if (!plot) return
    let fields = leaderboard.slice(0, 10).map(({ rank, username, cuteName, value, counter }) => {
      return {
        name: `${rank}. ${username} (${cuteName})`,
        value: `**${formatter.format(value)}** ${counter}`,
        inline: true
      }
    })
    const blankField = { name: "\u200b", value: "\u200b", inline: true }
    fields = fields.flatMap((value, index) => ((index + 1) % 2) == 0 ? [value, blankField] : value)
    const continued10 = continueData(10, leaderboard)
    if (continued10 != null) fields.push(continued10)
    const continued15 = continueData(15, leaderboard)
    if (continued15 != null) fields.push(continued15, blankField)
    if (fields.length == 0) {
      fields.push({
        name: "No data",
        value: "Either there is no event data yet, or the leaderboard broke!",
        inline: false
      })
    }
    
    const embed = new EmbedBuilder()
      .setTitle(event.parse(event.name))
      .setAuthor({ name: event.author, iconURL: "attachment://icon.png" })
      .setColor("DarkBlue")
      .setDescription(event.fullDescription)
      .addFields(fields)
      .setImage("attachment://chart.png")
      .setTimestamp()
    this.send(event, { embeds: [embed], files: [event.iconAttachment, new AttachmentBuilder(plot, { name: "chart.png" })] }, true, false)
  }

  async sendOutroEmbed(event: GuildEvent) {
    const embed = new EmbedBuilder()
      .setTitle("Event over")
      .setColor("Red")
      .setDescription(event.parse(event.outro))
      .setTimestamp()
    this.send(event, { embeds: [embed] }, false, true)
  }

  async send(event: GuildEvent, message: string | MessagePayload | MessageCreateOptions, tryEdit: boolean, ping: boolean) {
    const channel = await this.fetchLeaderboardChannel(event)
    if (tryEdit && this.currentMessage) {
      this.currentMessage = await this.currentMessage.edit(message)
    } else {
      this.currentMessage = await channel.send(message)
    }
    if (ping) await channel.send(`<@&${event.pingRoleId}>`)
  }
}

const formatter = Intl.NumberFormat('en', {
  notation: "compact",
  maximumSignificantDigits: 3,
  minimumSignificantDigits: 1
})

function continueData(start: number, data: LeaderboardPosition[]) {
  const continuedData = data.slice(start, start + 5)
  if (continuedData.length > 0) {
    return {
      name: "Continued",
      value: continuedData.map(({ rank, username, cuteName, value, counter }) => (
        `**${rank}.** ${username} (${formatter.format(value)})`
      )).join("\n"),
      inline: true
    }
  } else {
    return undefined
  }
}

