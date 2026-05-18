import { Events, type Client } from "discord.js";
import type { AppConfig } from "../config";
import { parsePrefixCommand, prefixCommands } from "../commands";
import { prefixService } from "../services";
import { logger } from "../utils";

export function registerMessageHandler(client: Client, config: AppConfig): void {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) {
      return;
    }

    const prefix = await getGuildPrefix(message.guild.id, config.defaultPrefix);
    const parsedCommand = parsePrefixCommand(message.content, prefix);

    if (!parsedCommand) {
      return;
    }

    const command = prefixCommands.get(parsedCommand.commandName);

    if (!command) {
      return;
    }

    try {
      await command.execute({
        message,
        args: parsedCommand.args,
        commandName: parsedCommand.commandName,
        prefix,
        rawArgs: parsedCommand.rawArgs
      });
    } catch (error) {
      logger.error(`Prefix command failed: ${parsedCommand.commandName}`, error);
      await message.reply("Nao consegui concluir este comando agora.");
    }
  });
}

async function getGuildPrefix(guildId: string, fallbackPrefix: string): Promise<string> {
  try {
    return await prefixService.getPrefixForGuild(guildId, fallbackPrefix);
  } catch (error) {
    logger.warn("Failed to load guild prefix. Falling back to default prefix.", error);
    return fallbackPrefix;
  }
}
