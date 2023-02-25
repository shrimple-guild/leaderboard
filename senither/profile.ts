import { ProfileMemberData } from "./types"

export function profileMemberSummary(member: any): ProfileMemberData {
  return {
    skills: {
      mining: member?.experience_skill_mining,
      enchanting: member?.experience_skill_enchanting,
      foraging: member?.experience_skill_foraging,
      farming: member?.experience_skill_farming,
      combat: member?.experience_skill_combat,
      fishing: member?.experience_skill_fishing,
      alchemy: member?.experience_skill_alchemy,
      taming: member?.experience_skill_taming
    },
    dungeons: {
      catacombs: member?.dungeons?.dungeon_types?.catacombs?.experience,
      archer: member?.dungeons?.player_classes?.archer?.experience,
      berserk: member?.dungeons?.player_classes?.berserk?.experience,
      healer: member?.dungeons?.player_classes?.healer?.experience,
      mage: member?.dungeons?.player_classes?.mage?.experience,
      tank: member?.dungeons?.player_classes?.tank?.experience
    },
    slayers: {
      zombie: member?.slayer_bosses?.zombie?.xp,
      spider: member?.slayer_bosses?.spider?.xp,
      wolf: member?.slayer_bosses?.wolf?.xp,
      enderman: member?.slayer_bosses?.enderman?.xp,
    },
    misc: {
      mythosKills: member?.experience_skill_taming
    }
  }
}
//member?.stats?.mythos_kills