import {
  Client,
  AttachmentBuilder,
  ChannelType,
  Events,
  GatewayIntentBits,
  Message,
  SlashCommandBuilder,
  Interaction,
  PermissionsBitField,
  REST,
  Routes,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from "discord.js"
import { GuildEvent } from "../core/GuildEvent.js"
import { InteractionManager } from "./InteractionManager.js"
import { EventManager } from "../core/EventManager.js"
import { EmbedGenerator } from "./EmbedGenerator.js"

export class DiscordBot {
  private readonly currentMessages: Map<string, Message<true>> = new Map()
  public interactionManager!: InteractionManager

  private constructor(public client: Client<true>) {}

  private setupInteractions() {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      await this.interactionManager.handleInteraction(interaction)
    })
  }

  static async create(token: string, intents: GatewayIntentBits[], eventManager?: EventManager) {
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
        ),
      new SlashCommandBuilder()
        .setName('modifyeventduration')
        .setDescription('Extend or reduce the duration of an event')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option => 
          option.setName('identifier')
            .setDescription('The ID of the event to modify')
            .setRequired(true)
        )
        .addStringOption(option => 
          option.setName('action')
            .setDescription('Whether to extend or reduce the duration')
            .setRequired(true)
            .addChoices(
              { name: 'Extend', value: 'extend' },
              { name: 'Reduce', value: 'reduce' }
            )
        )
        .addNumberOption(option => 
          option.setName('hours')
            .setDescription('Number of hours to add or remove')
            .setRequired(true)
            .setMinValue(0.1)
        )
    ].map(command => command.toJSON())

    const rest = new REST({ version: '10' }).setToken(token)

    const clientReady: Client<true> = await new Promise((resolve, reject) => {
      client.once(Events.Error, reject)
      client.once(Events.ClientReady, async client => {
        try {
          console.log(`Bot logged in as ${client.user.tag}`)
          
          // Clear global commands
          await rest.put(Routes.applicationCommands(client.user.id), { body: [] })
          
          const guilds = await client.guilds.fetch()
          for (const [guildId] of guilds) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands })
          }
          console.log(`Successfully reloaded application (/) commands.`)
          client.off(Events.Error, reject)
          resolve(client)
        } catch (error) {
          console.error("Failed to register commands:", error)
          reject(error)
        }
      })
      client.login(token)
    })

    const bot = new DiscordBot(clientReady)
    if (eventManager) {
      bot.interactionManager = new InteractionManager(bot, eventManager)
      bot.setupInteractions()
    }
    return bot
  }

  initInteractionManager(eventManager: EventManager) {
    this.interactionManager = new InteractionManager(this, eventManager)
    this.setupInteractions()
  }

  async fetchLeaderboardChannel(event: GuildEvent) {
    const guild = await this.client.guilds.fetch(event.discordGuildId)
    const channel = await guild.channels.fetch(event.discordChannelId)
    if (channel?.type != ChannelType.GuildText) throw Error("Output channel is not a text channel.")
    return channel
  }

  async sendIntroEmbed(event: GuildEvent) {
    const embed = EmbedGenerator.createIntroEmbed(event)
    await this.send(event, { embeds: [embed] }, false, true)
  }

  async sendLeaderboardEmbed(event: GuildEvent) {
    const result = await EmbedGenerator.createLeaderboardEmbed(event)
    if (!result) return
    result.embed.setTitle(event.parse(event.name)).setDescription(event.fullDescription)

    const actionBar = this.getActionBar(event)

    await this.send(
      event,
      {
        embeds: [result.embed],
        files: [event.iconAttachment, new AttachmentBuilder(result.attachment, { name: "chart.png" })],
        components: actionBar,
      },
      true,
      false
    )
  }

  async sendOutroEmbed(event: GuildEvent) {
    const embed = EmbedGenerator.createOutroEmbed(event)
    await this.send(event, { embeds: [embed] }, false, true)
  }

  private async send(event: GuildEvent, message: any, tryEdit: boolean, ping: boolean) {
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
}
