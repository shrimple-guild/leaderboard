import { GuildEvent } from "GuildEvent";
import { generateLeaderboardPlot } from "./chart.js";
import { APIActionRowComponent, APIMessageActionRowComponent, ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, ComponentType, Embed, EmbedBuilder, Events, GatewayIntentBits, Message, MessageActionRowComponent, MessageCreateOptions, MessageEditOptions, MessagePayload, ModalAssertions, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder } from "discord.js";
import { Client } from "discord.js";
import { LeaderboardPosition } from "types.js";

export class DiscordBot {
  currentMessage?: Message<true>

  // TODO: rework event field to allow multiple events per DiscordBot
  private constructor(private client: Client<true>, event: GuildEvent) {
    client.on(Events.InteractionCreate, async interaction => {
      try {
        if (!interaction.inCachedGuild() || !interaction.isStringSelectMenu()) return
        if (interaction.customId != "leaderboardSelector") return
        const metric = interaction.values[0]
        const data = await this.getLeaderboardEmbed(event, metric)
        if (!data) return
        data.embed.setTitle(`${metric} Leaderboard`)
  
        await interaction.reply({ 
          embeds: [data.embed], 
          files: [event.iconAttachment, new AttachmentBuilder(data.attachment, { name: "chart.png" })],
          ephemeral: true
        })
      } catch (e) {
        console.error(e)
      }
    })
    client.on(Events.InteractionCreate, async interaction => {
      try {
        if (!interaction.inCachedGuild() || !interaction.isButton()) return
        if (interaction.customId != "usernameModalButton") return

        const modal = new ModalBuilder()
        .setCustomId('usernameModal')
        .setTitle('Enter username')
        .addComponents([
          new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder()
            .setCustomId("usernameInput")
            .setLabel("Input the username to view metrics")
            .setPlaceholder("Milo77")
            .setRequired(true)
          )
        ])
        await interaction.showModal(modal)
        const modalResponse = await interaction.awaitModalSubmit({ time: 60_000 })
        const row = modalResponse.components[0]
        const input = row.components[0]
        if (input.type != ComponentType.TextInput) return
        modalResponse.reply({
          embeds: [await this.getMetricEmbed(input.value, event)],
          ephemeral: true
        })
      } catch (e) {
        console.error(e)
      }
    })
  }

  static async create(token: string, intents: GatewayIntentBits[], event: GuildEvent) {
    const client = new Client({ intents: intents })
    client.login(token)
    const clientReady: Client<true> = await new Promise((resolve, reject) => {
      client.once(Events.Error, reject)
      client.once(Events.ClientReady, (client) => {
        client.off(Events.Error, reject)
        resolve(client)
      })
    })
    return new DiscordBot(clientReady, event)
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
  
  async getMetricEmbed(username: string, event: GuildEvent) {
    const metrics = event.getPlayerMetrics(username)
    
    const embed = new EmbedBuilder()
      .setTitle(`Event metrics for ${username}`)
      .setColor("DarkBlue")

    if (!metrics || metrics.length == 0) {
      embed.setDescription("Could not find any metrics for this player!")
    } else {
      embed.setFields(metrics.map(metric => ({
        name: metric.name,
        value: formatter.format(metric.gain),
        inline: true
      })))
    }
    return embed
  }

  async sendLeaderboardEmbed(event: GuildEvent) {
    const data = (await this.getLeaderboardEmbed(event))
    if (!data) return
    data.embed.setTitle(event.parse(event.name)).setDescription(event.fullDescription)

    const actionBar = this.getActionBar(event)

    this.send(event, { 
      embeds: [data.embed], 
      files: [event.iconAttachment, new AttachmentBuilder(data.attachment, { name: "chart.png" })],
      components: actionBar
     }, true, false)
  }

  async sendOutroEmbed(event: GuildEvent) {
    const embed = new EmbedBuilder()
      .setTitle("Event over")
      .setColor("Red")
      .setDescription(event.parse(event.outro))
      .setTimestamp()
    this.send(event, { embeds: [embed] }, false, true)
  }

  private async send(event: GuildEvent, message: string | MessagePayload | (MessageEditOptions & MessageCreateOptions), tryEdit: boolean, ping: boolean) {
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
    
    return {
      embed: new EmbedBuilder()
      .setAuthor({ name: event.author, iconURL: "attachment://icon.png" })
      .setColor("DarkBlue")
      .addFields(fields)
      .setImage("attachment://chart.png")
      .setTimestamp(),
      attachment: plot
    }
  }

  private getActionBar(event: GuildEvent) {
    const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = []
    const options = event.related?.map(metric => (
      new StringSelectMenuOptionBuilder()
        .setLabel(metric)
        .setValue(metric)
    ))
    if (options != null && options.length >= 1) {
      rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("leaderboardSelector")
          .setPlaceholder("View other leaderboards")
          .addOptions(options)
      ))
    }
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("usernameModalButton")
        .setLabel("Select a player")
        .setStyle(ButtonStyle.Primary)
    ))
    return rows
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

