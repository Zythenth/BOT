import { DEFAULT_PREFIX } from "../config";
import { guildRepository } from "../database";

export const prefixService = {
  async getPrefixForGuild(guildId: string, fallbackPrefix = DEFAULT_PREFIX): Promise<string> {
    const guild = await guildRepository.findById(guildId);
    return guild?.prefix || fallbackPrefix;
  }
};
