import { GuildEvent } from "GuildEvent"
import { generateLeaderboardPlot } from "./chart.js"
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Message,
  MessageCreateOptions,
  MessageEditOptions,
  MessagePayload,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js"
import { Client } from "discord.js"
import { LeaderboardPosition } from "types.js"

export class DiscordBot {
  currentMessage?: Message<true>

  // TODO: rework event field to allow multiple events per DiscordBot
  private constructor(private client: Client<true>, event: GuildEvent) {
    client.on(Events.InteractionCreate, async interaction => {
      try {
        if (!interaction.inCachedGuild() || !interaction.isStringSelectMenu())
          return
        if (interaction.customId != "leaderboardSelector") return
        await interaction.deferReply({ ephemeral: true })
        const metric = interaction.values[0]
        const data = await this.getLeaderboardEmbed(event, metric)
        if (!data) return
        data.embed.setTitle(`${metric} Leaderboard`)

        await interaction.editReply({
          embeds: [data.embed],
          files: [
            event.iconAttachment,
            new AttachmentBuilder(data.attachment, { name: "chart.png" }),
          ],
        })
      } catch (e) {
        console.error(e)
      }
    })
  }

  static async create(
    token: string,
    intents: GatewayIntentBits[],
    event: GuildEvent
  ) {
    const client = new Client({ intents: intents })
    client.login(token)
    const clientReady: Client<true> = await new Promise((resolve, reject) => {
      client.once(Events.Error, reject)
      client.once(Events.ClientReady, client => {
        client.off(Events.Error, reject)
        resolve(client)
      })
    })
    return new DiscordBot(clientReady, event)
  }

  async fetchLeaderboardChannel(event: GuildEvent) {
    const guild = await this.client.guilds.fetch(event.discordGuildId)
    const channel = await guild.channels.fetch(event.discordChannelId)
    if (channel?.type != ChannelType.GuildText)
      throw Error("Output channel is not a text channel.")
    return channel
  }

  async sendIntroEmbed(event: GuildEvent) {
    const embed = new EmbedBuilder()
      .setTitle("The event has started!")
      .setColor("Green")
      .setDescription(event.parse(event.intro))
      .setTimestamp()
    await this.send(event, { embeds: [embed] }, false, true)
  }

  async sendLeaderboardEmbed(event: GuildEvent) {
    const data = await this.getLeaderboardEmbed(event)
    if (!data) return
    data.embed
      .setTitle(event.parse(event.name))
      .setDescription(event.fullDescription)

    const actionBar = this.getActionBar(event)

    await this.send(
      event,
      {
        embeds: [data.embed],
        files: [
          event.iconAttachment,
          new AttachmentBuilder(data.attachment, { name: "chart.png" }),
        ],
        components: actionBar,
      },
      true,
      false
    )
  }

  async sendOutroEmbed(event: GuildEvent) {
    const embed = new EmbedBuilder()
      .setTitle("Event over")
      .setColor("Red")
      .setDescription(event.parse(event.outro))
      .setTimestamp()
    await this.send(event, { embeds: [embed] }, false, true)
  }

  private async send(
    event: GuildEvent,
    message:
      | string
      | MessagePayload
      | (MessageEditOptions & MessageCreateOptions),
    tryEdit: boolean,
    ping: boolean
  ) {
    const channel = await this.fetchLeaderboardChannel(event)
    if (tryEdit && this.currentMessage) {
      this.currentMessage = await this.currentMessage.edit(message)
    } else {
      this.currentMessage = await channel.send(message)
    }
    if (ping) await channel.send(`<@&${event.pingRoleId}>`)
  }

  private async getLeaderboardEmbed(event: GuildEvent, metric?: string) {
    const leaderboard = event.getLeaderboard(metric)
    if (!leaderboard) return
    const plot = generateLeaderboardPlot(event, leaderboard, metric)
    if (!plot) return
    let fields = leaderboard
      .slice(0, 10)
      .map(({ rank, username, cuteName, value, counter }) => {
        return {
          name: `${rank}. ${username} (${cuteName})`,
          value: `**${formatter.format(value)}** ${counter}`,
          inline: true,
        }
      })
    const blankField = { name: "\u200b", value: "\u200b", inline: true }
    fields = fields.flatMap((value, index) =>
      (index + 1) % 2 == 0 ? [value, blankField] : value
    )
    const continued10 = continueData(10, leaderboard)
    if (continued10 != null) fields.push(continued10)
    const continued15 = continueData(15, leaderboard)
    if (continued15 != null) fields.push(continued15, blankField)
    if (fields.length == 0) {
      fields.push({
        name: "No data",
        value: "Either there is no event data yet, or the leaderboard broke!",
        inline: false,
      })
    }

    return {
      embed: new EmbedBuilder()
        .setAuthor({ name: event.author, iconURL: "attachment://icon.png" })
        .setColor("DarkBlue")
        .addFields(fields)
        .setImage("attachment://chart.png")
        .setTimestamp(),
      attachment: plot,
    }
  }

  private getActionBar(event: GuildEvent) {
    const options = event.related?.map(metric =>
      new StringSelectMenuOptionBuilder().setLabel(metric).setValue(metric)
    )
    if (options == null || options.length == 0) return undefined
    return [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("leaderboardSelector")
          .setPlaceholder("View other leaderboards")
          .addOptions(options)
      ),
    ]
  }
}

const formatter = Intl.NumberFormat("en", {
  notation: "compact",
  maximumSignificantDigits: 3,
  minimumSignificantDigits: 1,
})

function continueData(start: number, data: LeaderboardPosition[]) {
  const continuedData = data.slice(start, start + 5)
  if (continuedData.length > 0) {
    return {
      name: "Continued",
      value: continuedData
        .map(
          ({ rank, username, cuteName, value, counter }) =>
            `**${rank}.** ${username} (${formatter.format(value)})`
        )
        .join("\n"),
      inline: true,
    }
  } else {
    return undefined
  }
}
