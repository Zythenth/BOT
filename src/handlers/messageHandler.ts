import { Events, type Client } from "discord.js";
import type { AppConfig } from "../config";
import { parseBotMentionPrefixCommand, parsePrefixCommand, prefixCommands } from "../commands";
import { aliasService, guildAccessService, prefixService } from "../services";
import { logger } from "../utils";

export function registerMessageHandler(client: Client, config: AppConfig): void {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) {
      return;
    }

    if (!guildAccessService.isGuildAllowed(message.guild.id, config.discord.allowedGuildIds)) {
      return;
    }

    const prefix = await getGuildPrefix(message.guild.id, config.defaultPrefix);
    const parsedCommand =
      parsePrefixCommand(message.content, prefix) ??
      parseBotMentionPrefixCommand(message.content, client.user?.id);

    if (!parsedCommand) {
      return;
    }

    const resolvedCommandName = await aliasService.resolveCommandName(
      message.guild.id,
      parsedCommand.commandName
    );

    if (!resolvedCommandName) {
      return;
    }

    const command = prefixCommands.get(resolvedCommandName);

    if (!command) {
      return;
    }

    const logContext = {
      commandName: `${parsedCommand.prefixUsed}${resolvedCommandName}`,
      commandType: "prefix" as const,
      guildId: message.guild.id,
      userId: message.author.id
    };

    try {
      logger.command(logContext);
      await command.execute({
        message,
        args: parsedCommand.args,
        commandName: resolvedCommandName,
        prefix: parsedCommand.prefixUsed,
        rawArgs: parsedCommand.rawArgs
      });
    } catch (error) {
      logger.error("Prefix command failed.", {
        error,
        ...logContext
      });
      await message.reply("Nao consegui concluir este comando agora.");
    }
  });
}

async function getGuildPrefix(guildId: string, fallbackPrefix: string): Promise<string> {
  try {
    return await prefixService.getPrefixForGuild(guildId, fallbackPrefix);
  } catch (error) {
    logger.warn("Failed to load guild prefix. Falling back to default prefix.", {
      error,
      guildId
    });
    return fallbackPrefix;
  }
}
