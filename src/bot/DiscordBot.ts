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
  private pendingDeletions: Map<string, string> = new Map()
  private pendingForceStarts: Map<string, string> = new Map()
  private onEventScheduled?: (eventConfig: any) => Promise<void>
  private onSelectMenu?: (interaction: StringSelectMenuInteraction) => Promise<void>
  private onListEvents?: () => GuildEvent[]
  private onDeleteEvent?: (identifier: string) => Promise<boolean>
  private onForceStartEvent?: (identifier: string) => Promise<boolean>

  private constructor(private client: Client<true>) {
    this.setupInteractions()
  }

  private setupInteractions() {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          if (interaction.commandName === 'scheduleevent') {
            await this.handleScheduleEventCommand(interaction)
          } else if (interaction.commandName === 'listevents') {
            await this.handleListEventsCommand(interaction)
          } else if (interaction.commandName === 'deleteevent') {
            await this.handleDeleteEventCommand(interaction)
          } else if (interaction.commandName === 'forcestartevent') {
            await this.handleForceStartEventCommand(interaction)
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
          } else if (interaction.customId === 'confirmDelete') {
            await this.handleConfirmDeleteButton(interaction)
          } else if (interaction.customId === 'cancelDelete') {
            await this.handleCancelDeleteButton(interaction)
          } else if (interaction.customId === 'confirmForceStart') {
            await this.handleConfirmForceStartButton(interaction)
          } else if (interaction.customId === 'cancelForceStart') {
            await this.handleCancelForceStartButton(interaction)
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

  private async handleScheduleEventCommand(interaction: ChatInputCommandInteraction) {
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
      .setPlaceholder("e.g. 01/04/26 18:00")
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
      .setPlaceholder("e.g. 124 (1 SB Year)")
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

  private async handleListEventsCommand(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "You need Administrator permissions to use this command.", ephemeral: true })
    }

    if (!this.onListEvents) {
      return interaction.reply({ content: "Event lister not initialized.", ephemeral: true })
    }

    const events = this.onListEvents()
    if (events.length === 0) {
      return interaction.reply({ content: "No events currently scheduled or active.", ephemeral: true })
    }

    const embed = new EmbedBuilder()
      .setTitle("Guild Events List")
      .setColor("Blue")
      .setTimestamp()

    const now = Date.now()
    
    const eventList = events.map(e => {
      let status = "📅 Queued"
      if (now >= e.end) status = "🏁 Finished"
      else if (now >= e.start) status = "🚀 Active"
      
      return `**${e.name}**\nID: \`${e.identifier()}\`\nStatus: ${status}\nChannel: <#${e.discordChannelId}>\nStart: <t:${Math.round(e.start/1000)}:f>\nEnd: <t:${Math.round(e.end/1000)}:f>\nMetric: ${e.metric || "Pending"}`
    }).join("\n\n")

    embed.setDescription(eventList)

    await interaction.reply({ embeds: [embed], ephemeral: true })
  }

  private async handleDeleteEventCommand(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "You need Administrator permissions to use this command.", ephemeral: true })
    }

    const identifier = interaction.options.getString('identifier', true)
    if (!this.onListEvents) return interaction.reply({ content: "Event lister not initialized.", ephemeral: true })
    
    const events = this.onListEvents()
    const event = events.find(e => e.identifier() === identifier)

    if (!event) {
      return interaction.reply({ content: `No event found with ID \`${identifier}\`.`, ephemeral: true })
    }

    this.pendingDeletions.set(interaction.user.id, identifier)

    const confirmEmbed = new EmbedBuilder()
      .setTitle("Confirm Event Deletion")
      .setColor("Red")
      .setDescription(`Are you sure you want to delete the following event?\n\n**${event.name}**\nID: \`${identifier}\`\nStart: <t:${Math.round(event.start/1000)}:f>`)
      .setFooter({ text: "This action cannot be undone." })

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirmDelete')
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancelDelete')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      )

    await interaction.reply({ 
      embeds: [confirmEmbed],
      components: [row],
      ephemeral: true 
    })
  }

  private async handleConfirmDeleteButton(interaction: Interaction) {
    if (!interaction.isButton()) return
    
    const identifier = this.pendingDeletions.get(interaction.user.id)
    if (!identifier) {
      return interaction.reply({ content: "No pending deletion request found.", ephemeral: true })
    }

    if (this.onDeleteEvent) {
      const success = await this.onDeleteEvent(identifier)
      this.pendingDeletions.delete(interaction.user.id)
      
      if (success) {
        await interaction.update({ 
          content: `✅ Event \`${identifier}\` has been deleted.`, 
          embeds: [],
          components: [] 
        })
      } else {
        await interaction.update({ 
          content: `❌ Failed to delete event \`${identifier}\`. It may have already been removed.`, 
          embeds: [],
          components: [] 
        })
      }
    } else {
      await interaction.reply({ content: "Error: Event deleter not initialized.", ephemeral: true })
    }
  }

  private async handleCancelDeleteButton(interaction: Interaction) {
    if (!interaction.isButton()) return
    
    this.pendingDeletions.delete(interaction.user.id)
    await interaction.update({ 
      content: "❌ Deletion cancelled.", 
      embeds: [],
      components: [] 
    })
  }

  private async handleForceStartEventCommand(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "You need Administrator permissions to use this command.", ephemeral: true })
    }

    const identifier = interaction.options.getString('identifier', true)
    if (!this.onListEvents) return interaction.reply({ content: "Event lister not initialized.", ephemeral: true })
    
    const events = this.onListEvents()
    const event = events.find(e => e.identifier() === identifier)

    if (!event) {
      return interaction.reply({ content: `No event found with ID \`${identifier}\`.`, ephemeral: true })
    }

    if (event.hasStarted) {
      return interaction.reply({ content: `Event \`${event.name}\` has already started.`, ephemeral: true })
    }

    this.pendingForceStarts.set(interaction.user.id, identifier)

    const confirmEmbed = new EmbedBuilder()
      .setTitle("Confirm Force Start")
      .setColor("Orange")
      .setDescription(`Are you sure you want to start the following event **IMMEDIATELY**?\n\n**${event.name}**\nID: \`${identifier}\`\nOriginal Start: <t:${Math.round(event.start/1000)}:f>`)
      .setFooter({ text: "The event will start as soon as you confirm." })

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirmForceStart')
          .setLabel('Force Start')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancelForceStart')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      )

    await interaction.reply({ 
      embeds: [confirmEmbed],
      components: [row],
      ephemeral: true 
    })
  }

  private async handleConfirmForceStartButton(interaction: Interaction) {
    if (!interaction.isButton()) return
    
    const identifier = this.pendingForceStarts.get(interaction.user.id)
    if (!identifier) {
      return interaction.reply({ content: "No pending force-start request found.", ephemeral: true })
    }

    if (this.onForceStartEvent) {
      const success = await this.onForceStartEvent(identifier)
      this.pendingForceStarts.delete(interaction.user.id)
      
      if (success) {
        await interaction.update({ 
          content: `🚀 Event \`${identifier}\` is starting now!`, 
          embeds: [],
          components: [] 
        })
      } else {
        await interaction.update({ 
          content: `❌ Failed to force-start event \`${identifier}\`. It may have already started or been removed.`, 
          embeds: [],
          components: [] 
        })
      }
    } else {
      await interaction.reply({ content: "Error: Event starter not initialized.", ephemeral: true })
    }
  }

  private async handleCancelForceStartButton(interaction: Interaction) {
    if (!interaction.isButton()) return
    
    this.pendingForceStarts.delete(interaction.user.id)
    await interaction.update({ 
      content: "❌ Force start cancelled.", 
      embeds: [],
      components: [] 
    })
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
        { name: "Channel", value: `<#${interaction.channelId}>`, inline: true },
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

  setListEventsHandler(fn: () => GuildEvent[]) {
    this.onListEvents = fn
  }

  setDeleteEventHandler(fn: (identifier: string) => Promise<boolean>) {
    this.onDeleteEvent = fn
  }

  setForceStartEventHandler(fn: (identifier: string) => Promise<boolean>) {
    this.onForceStartEvent = fn
  }

  static async create(token: string, intents: GatewayIntentBits[]) {
    const client = new Client({ intents: intents })
    
    const commands = [
      new SlashCommandBuilder()
        .setName('scheduleevent')
        .setDescription('Schedule a new guild event')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
      new SlashCommandBuilder()
        .setName('listevents')
        .setDescription('List all scheduled and active events')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
      new SlashCommandBuilder()
        .setName('deleteevent')
        .setDescription('Delete a scheduled or active event')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option => 
          option.setName('identifier')
            .setDescription('The ID of the event to delete (get from /listevents)')
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName('forcestartevent')
        .setDescription('Force an event to start immediately')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option => 
          option.setName('identifier')
            .setDescription('The ID of the event to force start')
            .setRequired(true)
        )
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