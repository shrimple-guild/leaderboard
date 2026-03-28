import { GuildEvent } from "../core/GuildEvent.js"
import { generateLeaderboardPlot } from "../utils/chart.js"
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Message,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  CheckboxGroupBuilder,
  CheckboxGroupOptionBuilder,
  Interaction,
  PermissionsBitField,
  REST,
  Routes,
  LabelBuilder,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle
} from "discord.js"
import { Client } from "discord.js"
import { LeaderboardPosition } from "../core/types.js"
import eventPresets from "../data/event_presets.json" with { type: "json" }
import guildsConfig from "../data/guilds.json" with { type: "json" }

export class DiscordBot {
  private currentMessages: Map<string, Message<true>> = new Map()
  private pendingEvents: Map<string, any> = new Map()
  private onEventScheduled?: (eventConfig: any) => Promise<void>
  private onSelectMenu?: (interaction: StringSelectMenuInteraction) => Promise<void>

  private constructor(private client: Client<true>) {
    this.setupInteractions()
  }

  private setupInteractions() {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          if (interaction.commandName === 'scheduleevent') {
            await this.handleStartEventCommand(interaction)
          }
        } else if (interaction.isModalSubmit()) {
          if (interaction.customId === 'eventModal') {
            await this.handleModalSubmit(interaction)
          }
        } else if (interaction.isButton()) {
          if (interaction.customId === 'confirmEvent') {
            await this.handleConfirmButton(interaction)
          } else if (interaction.customId === 'cancelEvent') {
            await this.handleCancelButton(interaction)
          }
        } else if (interaction.isStringSelectMenu()) {
          if (this.onSelectMenu) {
            await this.onSelectMenu(interaction)
          }
        }
      } catch (e) {
        console.error("Interaction error:", e)
      }
    })
  }

  private async handleStartEventCommand(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "You need Administrator permissions to use this command.", ephemeral: true })
    }

    const modal = new ModalBuilder()
      .setCustomId(`eventModal`)
      .setTitle(`Schedule Guild Event`)

    const presetLabel = new LabelBuilder()
      .setLabel("Select Event Preset")
      .setStringSelectMenuComponent(new StringSelectMenuBuilder()
        .setCustomId('presetId')
        .setPlaceholder('Choose a preset...')
        .addOptions(eventPresets.map(p => 
          new StringSelectMenuOptionBuilder()
            .setLabel(p.name)
            .setValue(p.id)
        ))
      )

    const startInput = new TextInputBuilder()
      .setCustomId('startTime')
      .setPlaceholder("e.g. 2026/04/01 18:00")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)

    const startLabel = new LabelBuilder()
      .setLabel("Start Time (DD/MM/YY HH:mm)")
      .setTextInputComponent(startInput)

    const gmtOptions = []
    for (let i = -11; i <= 13; i++) {
      const sign = i >= 0 ? "+" : "-"
      const abs = Math.abs(i)
      const formatted = `${sign}${abs.toString().padStart(2, '0')}:00`
      gmtOptions.push(new StringSelectMenuOptionBuilder()
        .setLabel(`GMT${formatted}`)
        .setValue(formatted)
        .setDefault(i === 0)
      )
    }

    const timezoneLabel = new LabelBuilder()
      .setLabel("Timezone (for Start Time)")
      .setStringSelectMenuComponent(new StringSelectMenuBuilder()
        .setCustomId('timezone')
        .setPlaceholder('Select GMT offset...')
        .addOptions(gmtOptions)
      )

    const durationInput = new TextInputBuilder()
      .setCustomId('durationHours')
      .setPlaceholder("e.g. 48")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)

    const durationLabel = new LabelBuilder()
      .setLabel("Duration in Hours")
      .setTextInputComponent(durationInput)
    
    const guildCheckboxGroup = new CheckboxGroupBuilder()
      .setCustomId('guildSelection')
      .addOptions(guildsConfig.map(g => 
        new CheckboxGroupOptionBuilder()
          .setLabel(g.name)
          .setValue(g.id)
          .setDescription(`Include ${g.name}`)
      ))

    const guildLabel = new LabelBuilder()
      .setLabel("Select Guilds")
      .setCheckboxGroupComponent(guildCheckboxGroup)

    modal.addLabelComponents(presetLabel, startLabel, timezoneLabel, durationLabel, guildLabel)

    await interaction.showModal(modal)
  }

  private async handleModalSubmit(interaction: ModalSubmitInteraction) {
    // Cast to any to bypass the missing TypeScript definitions for the new components
    const fields = interaction.fields as any

    const presetId = fields.fields.get('presetId')?.values?.[0]
    const preset = eventPresets.find(p => p.id === presetId)
    
    if (!preset) {
      return interaction.reply({ content: "Please select a valid event preset.", ephemeral: true })
    }

    const startTimeStr = fields.getTextInputValue('startTime')
    const durationHours = parseFloat(fields.getTextInputValue('durationHours'))
    const timezone = fields.fields.get('timezone')?.values?.[0]
    
    if (!timezone) {
      return interaction.reply({ content: "Please select a timezone.", ephemeral: true })
    }
    
    const selectedGuildIds = fields.fields.get('guildSelection')?.values || []

    let startTime: number
    try {
      const [datePart, timePart] = startTimeStr.split(' ')
      const [day, month, year] = datePart.split('/')
      const fullYear = year.length === 2 ? `20${year}` : year
      const isoDateStr = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00${timezone}`
      startTime = new Date(isoDateStr).getTime()
    } catch (e) {
      return interaction.reply({ content: `Invalid date format. Please use DD/MM/YY HH:mm. Provided: ${startTimeStr}`, ephemeral: true })
    }

    if (isNaN(startTime)) {
      return interaction.reply({ content: `Invalid date or timezone format. Provided: ${startTimeStr} ${timezone}`, ephemeral: true })
    }

    if (isNaN(durationHours) || durationHours <= 0) {
      return interaction.reply({ content: "Invalid duration.", ephemeral: true })
    }

    if (selectedGuildIds.length === 0) {
      return interaction.reply({ content: "You must select at least one guild.", ephemeral: true })
    }

    const pingRoleIds = selectedGuildIds
      .map((id: string) => guildsConfig.find(g => g.id === id)?.pingRoleId)
      .filter((id: string | undefined): id is string => id !== undefined)

    const eventConfig = {
      ...preset,
      discordGuildId: interaction.guildId,
      discordChannelId: interaction.channelId,
      guildIds: selectedGuildIds,
      pingRoleIds: pingRoleIds,
      start: startTime,
      duration: durationHours * 3600000,
    }

    this.pendingEvents.set(interaction.user.id, eventConfig)

    const guildNames = selectedGuildIds.map((id: string) => guildsConfig.find(g => g.id === id)?.name || id).join(", ")

    const confirmEmbed = new EmbedBuilder()
      .setTitle("Confirm Event Scheduling")
      .setColor("Blue")
      .addFields(
        { name: "Event", value: preset.name, inline: true },
        { name: "Timezone", value: timezone, inline: true },
        { name: "Start Time", value: `<t:${Math.round(startTime/1000)}:F>`, inline: false },
        { name: "Duration", value: `${durationHours} hours`, inline: true },
        { name: "Guilds", value: guildNames }
      )
      .setFooter({ text: "Please confirm or cancel this request." })

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirmEvent')
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancelEvent')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      )

    await interaction.reply({ 
      embeds: [confirmEmbed],
      components: [row],
      ephemeral: true 
    })
  }

  private async handleConfirmButton(interaction: Interaction) {
    if (!interaction.isButton()) return
    
    const eventConfig = this.pendingEvents.get(interaction.user.id)
    if (!eventConfig) {
      return interaction.reply({ content: "No pending event request found or it has expired.", ephemeral: true })
    }

    await interaction.update({ 
      content: `✅ Event **${eventConfig.name}** scheduled successfully!\nStarts at: <t:${Math.round(eventConfig.start/1000)}:F>`, 
      embeds: [],
      components: [] 
    })

    if (this.onEventScheduled) {
      await this.onEventScheduled(eventConfig)
      this.pendingEvents.delete(interaction.user.id)
    }
  }

  private async handleCancelButton(interaction: Interaction) {
    if (!interaction.isButton()) return
    
    await interaction.update({ 
      content: "❌ Event scheduling cancelled.", 
      embeds: [],
      components: [] 
    })
    
    this.pendingEvents.delete(interaction.user.id)
  }

  setEventScheduler(fn: (config: any) => Promise<void>) {
    this.onEventScheduled = fn
  }

  setSelectMenuHandler(fn: (interaction: StringSelectMenuInteraction) => Promise<void>) {
    this.onSelectMenu = fn
  }

  static async create(token: string, intents: GatewayIntentBits[]) {
    const client = new Client({ intents: intents })
    
    const commands = [
      new SlashCommandBuilder()
        .setName('scheduleevent')
        .setDescription('Schedule a new guild event')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    ].map(command => command.toJSON())

    const rest = new REST({ version: '10' }).setToken(token)

    const clientReady: Client<true> = await new Promise((resolve, reject) => {
      client.once(Events.Error, reject)
      client.once(Events.ClientReady, async client => {
        try {
          console.log(`Bot logged in as ${client.user.tag}`)
          const guilds = await client.guilds.fetch()
          for (const [guildId] of guilds) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands })
          }
          console.log(`Successfully reloaded application (/) commands across all guilds.`)
          client.off(Events.Error, reject)
          resolve(client)
        } catch (error) {
          console.error("Failed to register commands:", error)
          reject(error)
        }
      })
      client.login(token)
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
    await this.send(event, { embeds: [embed] }, false, true)
  }

  async sendLeaderboardEmbed(event: GuildEvent) {
    const data = await this.getLeaderboardEmbed(event)
    if (!data) return
    data.embed.setTitle(event.parse(event.name)).setDescription(event.fullDescription)

    const actionBar = this.getActionBar(event)

    await this.send(
      event,
      {
        embeds: [data.embed],
        files: [event.iconAttachment, new AttachmentBuilder(data.attachment, { name: "chart.png" })],
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
    message: any,
    tryEdit: boolean,
    ping: boolean
  ) {
    const channel = await this.fetchLeaderboardChannel(event)
    const eventId = event.identifier()
    const existingMsg = this.currentMessages.get(eventId)

    if (tryEdit) {
      if (existingMsg) {
        await existingMsg.edit(message).catch(async () => {
          const ret = await channel.send(message).catch(console.error)
          if (ret) this.currentMessages.set(eventId, ret)
        })
      } else {
        const ret = await channel.send(message).catch(console.error)
        if (ret) this.currentMessages.set(eventId, ret)
      }
    } else {
      await channel.send(message).catch(console.error)
    }
    
    const pingMessage = event.pingRoleIds.map(id => `<@&${id}>`).join("")
    if (ping && pingMessage) await channel.send(pingMessage).catch(console.error)
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}\[\]()#+\-.!>])/g, "\\$1");
  }

  private async getLeaderboardEmbed(event: GuildEvent, metric?: string) {
    const leaderboard = event.getLeaderboard(metric)
    if (!leaderboard) return
    const plot = generateLeaderboardPlot(event, leaderboard, metric)
    if (!plot) return
    let fields = leaderboard.slice(0, 10).map(({ rank, username, cuteName, value, counter }) => {
      return {
        name: `${rank}. ${this.escapeMarkdown(username)} (${cuteName})`,
        value: `**${formatter.format(value)}** ${counter}`,
        inline: true,
      }
    })
    const blankField = { name: "\u200b", value: "\u200b", inline: true }
    fields = fields.flatMap((value, index) => ((index + 1) % 2 == 0 ? [value, blankField] : value))

    const extendedFields = 4
    for (let i = 10; i < 10 + 5 * extendedFields; i += 5) {
      const continuation = continueData(i, leaderboard)
      if (continuation != null) fields.push(continuation)
      if (i % 10 == 5) {
        fields.push(blankField)
      }
    }

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
    const options = event.related?.map(metric => new StringSelectMenuOptionBuilder().setLabel(metric).setValue(metric))
    if (options == null || options.length == 0) return undefined
    return [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`leaderboardSelector_${event.identifier()}`)
          .setPlaceholder("View other leaderboards")
          .addOptions(options)
      ),
    ]
  }

  async handleSelectMenu(interaction: StringSelectMenuInteraction, event: GuildEvent) {
    if (interaction.customId !== `leaderboardSelector_${event.identifier()}`) return
    await interaction.deferReply({ ephemeral: true })
    const metric = interaction.values[0]
    const data = await this.getLeaderboardEmbed(event, metric).catch(console.error)
    if (!data) return
    data.embed.setTitle(`${metric} Leaderboard`)

    await interaction
      .editReply({
        embeds: [data.embed],
        files: [event.iconAttachment, new AttachmentBuilder(data.attachment, { name: "chart.png" })],
      })
      .catch(console.error)
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
        .map(({ rank, username, cuteName, value, counter }) => `**${rank}.** ${username} (${formatter.format(value)})`)
        .join("\n"),
      inline: true,
    }
  } else {
    return undefined
  }
}