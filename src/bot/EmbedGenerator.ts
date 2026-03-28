import { EmbedBuilder, AttachmentBuilder, MessageFlags } from "discord.js"
import { GuildEvent } from "../core/GuildEvent.js"
import { LeaderboardPosition } from "../core/types.js"
import { generateLeaderboardPlot } from "../utils/chart.js"
import guildsConfig from "../data/guilds.json" with { type: "json" }

export const formatter = Intl.NumberFormat("en", {
  notation: "compact",
  maximumSignificantDigits: 3,
  minimumSignificantDigits: 1,
})

export class EmbedGenerator {
  static createIntroEmbed(event: GuildEvent) {
    return new EmbedBuilder()
      .setTitle("The event has started!")
      .setColor("Green")
      .setDescription(event.parse(event.intro))
      .setTimestamp()
  }

  static createOutroEmbed(event: GuildEvent) {
    return new EmbedBuilder()
      .setTitle("Event over")
      .setColor("Red")
      .setDescription(event.parse(event.outro))
      .setTimestamp()
  }

  static async createLeaderboardEmbed(event: GuildEvent, metric?: string) {
    const leaderboard = event.getLeaderboard(metric)
    if (!leaderboard) return null
    
    const plot = generateLeaderboardPlot(event, leaderboard, metric)
    if (!plot) return null

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
      const continuation = this.continueData(i, leaderboard)
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

    const embed = new EmbedBuilder()
      .setAuthor({ name: event.author, iconURL: "attachment://icon.png" })
      .setColor("DarkBlue")
      .addFields(fields)
      .setImage("attachment://chart.png")
      .setTimestamp()

    return { embed, attachment: plot }
  }

  static createScheduleConfirmEmbed(preset: any, interaction: any, startTime: number, timezone: string, durationHours: number, guildNames: string) {
    return new EmbedBuilder()
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
  }

  static createScheduleSuccessEmbed(eventConfig: any, identifier: string, guildNames: string) {
    return new EmbedBuilder()
      .setTitle("Event Scheduled Successfully")
      .setColor("Green")
      .addFields(
        { name: "Event", value: eventConfig.name, inline: true },
        { name: "Management ID", value: `\`${identifier}\``, inline: true },
        { name: "Channel", value: `<#${eventConfig.discordChannelId}>`, inline: true },
        { name: "Starts", value: `<t:${Math.round(eventConfig.start/1000)}:F>`, inline: false },
        { name: "Duration", value: `${eventConfig.duration / 3600000} hours`, inline: true },
        { name: "Guilds", value: guildNames }
      )
      .setTimestamp()
  }

  static createListEventsEmbed(events: GuildEvent[]) {
    const embed = new EmbedBuilder()
      .setTitle("Guild Events List")
      .setColor("Blue")
      .setTimestamp()

    const now = Date.now()
    
    const eventList = events.map(e => {
      let status = "📅 Queued"
      if (now >= e.end) status = "🏁 Finished"
      else if (now >= e.start) status = "🚀 Active"
      
      const guildNames = e.guildIds.map((id: string) => guildsConfig.find((g: any) => g.id === id)?.name || id).join(", ")
      
      return `**${e.name}**\nID: \`${e.identifier()}\`\nStatus: ${status}\nChannel: <#${e.discordChannelId}>\nStart: <t:${Math.round(e.start/1000)}:f>\nEnd: <t:${Math.round(e.end/1000)}:f>\nMetric: ${e.metric || "Pending"}\nGuilds: ${guildNames}`
    }).join("\n\n")

    embed.setDescription(eventList || "No events currently scheduled or active.")
    return embed
  }

  static createDeleteConfirmEmbed(event: GuildEvent, identifier: string) {
    const guildNames = event.guildIds.map((id: string) => guildsConfig.find((g: any) => g.id === id)?.name || id).join(", ")
    return new EmbedBuilder()
      .setTitle("Confirm Event Deletion")
      .setColor("Red")
      .setDescription(`Are you sure you want to delete the following event?\n\n**${event.name}**\nID: \`${identifier}\`\nStart: <t:${Math.round(event.start/1000)}:f>\nGuilds: ${guildNames}`)
      .setFooter({ text: "This action cannot be undone." })
  }

  static createForceStartConfirmEmbed(event: GuildEvent, identifier: string) {
    const guildNames = event.guildIds.map((id: string) => guildsConfig.find((g: any) => g.id === id)?.name || id).join(", ")
    return new EmbedBuilder()
      .setTitle("Confirm Force Start")
      .setColor("Orange")
      .setDescription(`Are you sure you want to start the following event **IMMEDIATELY**?\n\n**${event.name}**\nID: \`${identifier}\`\nOriginal Start: <t:${Math.round(event.start/1000)}:f>\nGuilds: ${guildNames}`)
      .setFooter({ text: "The event will start as soon as you confirm." })
  }

  static createModifyDurationConfirmEmbed(event: GuildEvent, action: string, hours: number, newDurationHours: number, newEnd: number) {
    const guildNames = event.guildIds.map((id: string) => guildsConfig.find((g: any) => g.id === id)?.name || id).join(", ")
    const currentDurationHours = event.duration / 3600000
    
    return new EmbedBuilder()
      .setTitle("Confirm Duration Modification")
      .setColor("Yellow")
      .setDescription(`Modify duration for **${event.name}**?\n\n` +
        `**Current Duration:** ${currentDurationHours}h\n` +
        `**Action:** ${action === 'extend' ? "Extend by" : "Reduce by"} ${hours}h\n` +
        `**New Duration:** ${newDurationHours}h\n` +
        `**New End Time:** <t:${Math.round(newEnd/1000)}:f>\n` +
        `**Guilds:** ${guildNames}`)
      .setFooter({ text: "Please confirm this change." })
  }

  private static escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}\[\]()#+\-.!>])/g, "\\$1");
  }

  private static continueData(start: number, data: LeaderboardPosition[]) {
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
}
