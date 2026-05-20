import type { Guild } from "discord.js";
import { guildRepository } from "../database";
import { logger } from "../utils";

export interface GuildAccessService {
  isGuildAllowed(guildId: string, allowedGuildIds: readonly string[]): boolean;
  syncGuildAccess(guild: Guild, allowedGuildIds: readonly string[]): Promise<boolean>;
}

export const guildAccessService: GuildAccessService = {
  isGuildAllowed(guildId, allowedGuildIds) {
    return allowedGuildIds.length === 0 || allowedGuildIds.includes(guildId);
  },

  async syncGuildAccess(guild, allowedGuildIds) {
    const allowed = guildAccessService.isGuildAllowed(guild.id, allowedGuildIds);

    await guildRepository.upsert({
      id: guild.id,
      isAllowed: allowed
    });

    if (allowed) {
      return true;
    }

    logger.warn("Leaving unauthorized guild.", {
      guildId: guild.id
    });

    await guild.leave();
    return false;
  }
};
