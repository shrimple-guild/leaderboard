import {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  CheckboxGroupBuilder,
  CheckboxGroupOptionBuilder,
  AttachmentBuilder,
  LabelBuilder
} from "discord.js"
import { DiscordBot } from "./DiscordBot.js"
import { EventManager } from "../core/EventManager.js"
import { EmbedGenerator } from "./EmbedGenerator.js"
import eventPresets from "../data/event_presets.json" with { type: "json" }
import guildsConfig from "../data/guilds.json" with { type: "json" }
import crypto from "node:crypto"

export class InteractionManager {
  private readonly pendingEvents: Map<string, any> = new Map()
  private readonly pendingDeletions: Map<string, string> = new Map()
  private readonly pendingForceStarts: Map<string, string> = new Map()
  private readonly pendingDurationModifications: Map<string, { identifier: string, action: 'extend' | 'reduce', hours: number }> = new Map()

  constructor(private bot: DiscordBot, private eventManager: EventManager) {}

  async handleInteraction(interaction: Interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        await this.handleChatInput(interaction)
      } else if (interaction.isModalSubmit()) {
        await this.handleModalSubmit(interaction)
      } else if (interaction.isButton()) {
        await this.handleButton(interaction)
      } else if (interaction.isStringSelectMenu()) {
        await this.handleSelectMenu(interaction)
      }
    } catch (e) {
      console.error("Interaction handling error:", e)
    }
  }

  private async handleChatInput(interaction: ChatInputCommandInteraction) {
    const { commandName } = interaction
    if (commandName === 'scheduleevent') {
      await this.handleScheduleEventCommand(interaction)
    } else if (commandName === 'listevents') {
      await this.handleListEventsCommand(interaction)
    } else if (commandName === 'deleteevent') {
      await this.handleDeleteEventCommand(interaction)
    } else if (commandName === 'forcestartevent') {
      await this.handleForceStartEventCommand(interaction)
    } else if (commandName === 'modifyeventduration') {
      await this.handleModifyDurationCommand(interaction)
    }
  }

  private async handleScheduleEventCommand(interaction: ChatInputCommandInteraction) {
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
    const events = this.eventManager.getEvents()
    const embed = EmbedGenerator.createListEventsEmbed(events)
    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] })
  }

  private async handleDeleteEventCommand(interaction: ChatInputCommandInteraction) {
    const identifier = interaction.options.getString('identifier', true)
    const event = this.eventManager.getEvents().find(e => e.identifier() === identifier)

    if (!event) {
      return interaction.reply({ content: `No event found with ID \`${identifier}\`.`, flags: [MessageFlags.Ephemeral] })
    }

    this.pendingDeletions.set(interaction.user.id, identifier)
    const embed = EmbedGenerator.createDeleteConfirmEmbed(event, identifier)

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('confirmDelete').setLabel('Delete').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('cancelDelete').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      )

    await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] })
  }

  private async handleForceStartEventCommand(interaction: ChatInputCommandInteraction) {
    const identifier = interaction.options.getString('identifier', true)
    const event = this.eventManager.getEvents().find(e => e.identifier() === identifier)

    if (!event) {
      return interaction.reply({ content: `No event found with ID \`${identifier}\`.`, flags: [MessageFlags.Ephemeral] })
    }

    if (event.hasStarted) {
      return interaction.reply({ content: `Event \`${event.name}\` has already started.`, flags: [MessageFlags.Ephemeral] })
    }

    this.pendingForceStarts.set(interaction.user.id, identifier)
    const embed = EmbedGenerator.createForceStartConfirmEmbed(event, identifier)

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('confirmForceStart').setLabel('Force Start').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancelForceStart').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      )

    await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] })
  }

  private async handleModifyDurationCommand(interaction: ChatInputCommandInteraction) {
    const identifier = interaction.options.getString('identifier', true)
    const action = interaction.options.getString('action', true) as 'extend' | 'reduce'
    const hours = interaction.options.getNumber('hours', true)

    const event = this.eventManager.getEvents().find(e => e.identifier() === identifier)
    if (!event) {
      return interaction.reply({ content: `No event found with ID \`${identifier}\`.`, flags: [MessageFlags.Ephemeral] })
    }

    const currentDurationHours = event.duration / 3600000
    const newDurationHours = action === 'extend' ? currentDurationHours + hours : currentDurationHours - hours

    if (newDurationHours <= 0) {
      return interaction.reply({ content: "Resulting duration must be greater than 0.", flags: [MessageFlags.Ephemeral] })
    }

    const newEnd = event.start + (newDurationHours * 3600000)
    this.pendingDurationModifications.set(interaction.user.id, { identifier, action, hours })

    const embed = EmbedGenerator.createModifyDurationConfirmEmbed(event, action, hours, newDurationHours, newEnd)
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('confirmModifyDuration').setLabel('Confirm').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cancelModifyDuration').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      )

    await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] })
  }

  private async handleModalSubmit(interaction: ModalSubmitInteraction) {
    if (interaction.customId !== 'eventModal') return
    const fields = interaction.fields as any

    const presetId = fields.fields.get('presetId')?.values?.[0]
    const preset = eventPresets.find(p => p.id === presetId)
    
    if (!preset) {
      return interaction.reply({ content: "Please select a valid event preset.", flags: [MessageFlags.Ephemeral] })
    }

    const startTimeStr = fields.getTextInputValue('startTime')
    const durationHours = parseFloat(fields.getTextInputValue('durationHours'))
    const timezone = fields.fields.get('timezone')?.values?.[0]
    
    if (!timezone) {
      return interaction.reply({ content: "Please select a timezone.", flags: [MessageFlags.Ephemeral] })
    }
    
    const selectedGuildIds = fields.fields.get('guildSelection')?.values || []

    let startTime: number
    try {
      const [datePart, timePart] = startTimeStr.split(' ')
      const [day, month, year] = datePart.split('/')
      const fullYear = year.length === 2 ? `20${year}` : year
      const isoDateStr = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00${timezone}`
      startTime = new Date(isoDateStr).getTime()
    } catch {
      return interaction.reply({ content: `Invalid date format. Please use DD/MM/YY HH:mm. Provided: ${startTimeStr}`, flags: [MessageFlags.Ephemeral] })
    }

    if (isNaN(startTime) || isNaN(durationHours) || durationHours <= 0 || selectedGuildIds.length === 0) {
      return interaction.reply({ content: "Invalid input. Check your date, duration, and guild selection.", flags: [MessageFlags.Ephemeral] })
    }

    const pingRoleIds = selectedGuildIds
      .map((id: string) => guildsConfig.find((g: any) => g.id === id)?.pingRoleId)
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
    const guildNames = selectedGuildIds.map((id: string) => guildsConfig.find((g: any) => g.id === id)?.name || id).join(", ")
    const embed = EmbedGenerator.createScheduleConfirmEmbed(preset, interaction, startTime, timezone, durationHours, guildNames)

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('confirmEvent').setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancelEvent').setLabel('Cancel').setStyle(ButtonStyle.Danger)
      )

    await interaction.reply({ embeds: [embed], components: [row], flags: [MessageFlags.Ephemeral] })
  }

  private async handleButton(interaction: ButtonInteraction) {
    const { customId, user } = interaction

    if (customId === 'confirmEvent') {
      const config = this.pendingEvents.get(user.id)
      if (!config) return interaction.reply({ content: "Expired request.", flags: [MessageFlags.Ephemeral] })
      
      const identifier = crypto.createHash('md5').update(`${config.guildIds.join("_")}-${config.start}-${config.start + config.duration}`).digest('hex')
      const guildNames = config.guildIds.map((id: string) => guildsConfig.find((g: any) => g.id === id)?.name || id).join(", ")
      const embed = EmbedGenerator.createScheduleSuccessEmbed(config, identifier, guildNames)

      await interaction.update({ content: "", embeds: [embed], components: [] })
      await this.eventManager.initEvent(config)
      this.eventManager.saveEvents()
      this.pendingEvents.delete(user.id)

    } else if (customId === 'cancelEvent') {
      this.pendingEvents.delete(user.id)
      await interaction.update({ content: "❌ Event scheduling cancelled.", embeds: [], components: [] })

    } else if (customId === 'confirmDelete') {
      const id = this.pendingDeletions.get(user.id)
      if (id && await this.eventManager.deleteEvent(id)) {
        await interaction.update({ content: `✅ Event \`${id}\` deleted.`, embeds: [], components: [] })
      }
      this.pendingDeletions.delete(user.id)

    } else if (customId === 'confirmForceStart') {
      const id = this.pendingForceStarts.get(user.id)
      if (id && await this.eventManager.forceStartEvent(id)) {
        await interaction.update({ content: `🚀 Event \`${id}\` starting!`, embeds: [], components: [] })
      }
      this.pendingForceStarts.delete(user.id)

    } else if (customId === 'confirmModifyDuration') {
      const config = this.pendingDurationModifications.get(user.id)
      if (config && await this.eventManager.modifyDuration(config.identifier, config.action, config.hours)) {
        await interaction.update({ content: `✅ Duration updated!`, embeds: [], components: [] })
      }
      this.pendingDurationModifications.delete(user.id)
    }
  }

  private async handleSelectMenu(interaction: StringSelectMenuInteraction) {
    const eventId = interaction.customId.split('_')[1]
    const eventData = this.eventManager.activeEvents.get(eventId)
    if (!eventData) return

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] })
    const metric = interaction.values[0]
    const result = await EmbedGenerator.createLeaderboardEmbed(eventData.event, metric)
    if (!result) return

    await interaction.editReply({
      embeds: [result.embed],
      files: [eventData.event.iconAttachment, new AttachmentBuilder(result.attachment, { name: "chart.png" })],
    })
  }
}
