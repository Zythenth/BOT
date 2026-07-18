import { Events, type Client, type Message } from "discord.js";
import type { AppConfig } from "../config";
import { parseBotMentionPrefixCommand, parsePrefixCommand, prefixCommands } from "../commands";
import { aliasService, guildAccessService, prefixService } from "../services";
import { logger } from "../utils";

const contentWarningGuildIds = new Set<string>();

export function registerMessageHandler(client: Client, config: AppConfig): void {
  logger.info("Prefix message handler registered.", {
    defaultPrefix: config.defaultPrefix,
    messageContentIntentRequired: true
  });

  client.on(Events.MessageCreate, (message) => {
    void handleMessage(message, client, config).catch(async (error) => {
      logger.error("Prefix message handling failed.", {
        error,
        guildId: message.guildId,
        userId: message.author.id
      });

      try {
        await message.reply("Nao consegui concluir este comando agora.");
      } catch (replyError) {
        logger.error("Failed to send prefix command error response.", {
          error: replyError,
          guildId: message.guildId
        });
      }
    });
  });
}

async function handleMessage(message: Message, client: Client, config: AppConfig): Promise<void> {
  if (message.author.bot || !message.guildId) {
    return;
  }

  if (!guildAccessService.isGuildAllowed(message.guildId, config.discord.allowedGuildIds)) {
    return;
  }

  if (!message.content) {
    warnOnceAboutMissingMessageContent(message.guildId);
    return;
  }

  if (message.content.trimStart().startsWith(config.defaultPrefix)) {
    logger.info("Default-prefix message received.", {
      guildId: message.guildId,
      userId: message.author.id,
      contentLength: message.content.length
    });
  }

  const prefix = await getGuildPrefix(message.guildId, config.defaultPrefix);
  const content = message.content.trimStart();
  const potentialPrefixCommand = isPotentialPrefixCommand(content, prefix, client.user?.id);
  const parsedCommand =
    parsePrefixCommand(content, prefix) ?? parseBotMentionPrefixCommand(content, client.user?.id);

  if (!parsedCommand) {
    if (potentialPrefixCommand) {
      logger.warn("Prefix-like message did not parse.", {
        guildId: message.guildId,
        userId: message.author.id,
        configuredPrefix: prefix,
        defaultPrefix: config.defaultPrefix,
        contentLength: content.length
      });
    }
    return;
  }

  logger.info("Prefix command parsed.", {
    commandName: parsedCommand.commandName,
    commandType: "prefix",
    guildId: message.guildId,
    userId: message.author.id,
    prefixUsed: parsedCommand.prefixUsed,
    argCount: parsedCommand.args.length
  });

  const resolvedCommandName = await aliasService.resolveCommandName(
    message.guildId,
    parsedCommand.commandName
  );

  if (!resolvedCommandName) {
    return;
  }

  const command = prefixCommands.get(resolvedCommandName);

  if (!command) {
    logger.warn("Ignored unknown prefix command.", {
      commandName: `${parsedCommand.prefixUsed}${resolvedCommandName}`,
      commandType: "prefix",
      guildId: message.guildId,
      userId: message.author.id
    });
    await message.reply("Nao conheco esse comando por prefixo. Use `/help` para ver a lista.");
    return;
  }

  const logContext = {
    commandName: `${parsedCommand.prefixUsed}${resolvedCommandName}`,
    commandType: "prefix" as const,
    guildId: message.guildId,
    userId: message.author.id
  };

  logger.command(logContext);
  await command.execute({
    message,
    args: parsedCommand.args,
    commandName: resolvedCommandName,
    prefix: parsedCommand.prefixUsed,
    rawArgs: parsedCommand.rawArgs
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

function warnOnceAboutMissingMessageContent(guildId: string): void {
  if (contentWarningGuildIds.has(guildId)) {
    return;
  }

  contentWarningGuildIds.add(guildId);
  logger.warn(
    "Received guild message without content. Prefix commands need Message Content Intent and channel read access.",
    {
      guildId
    }
  );
}

function isPotentialPrefixCommand(
  content: string,
  configuredPrefix: string,
  botUserId: string | undefined
): boolean {
  if (configuredPrefix && content.startsWith(configuredPrefix)) {
    return true;
  }

  return Boolean(
    botUserId && (content.startsWith(`<@${botUserId}>`) || content.startsWith(`<@!${botUserId}>`))
  );
}
