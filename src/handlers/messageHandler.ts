import { Events, type Client } from "discord.js";
import type { AppConfig } from "../config";
import { prefixCommands } from "../commands";
import { logger } from "../utils";

export function registerMessageHandler(client: Client, config: AppConfig): void {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) {
      return;
    }

    if (!message.content.startsWith(config.defaultPrefix)) {
      return;
    }

    const content = message.content.slice(config.defaultPrefix.length).trim();

    if (!content) {
      return;
    }

    const [rawCommandName, ...args] = content.split(/\s+/);
    const commandName = rawCommandName.toLowerCase();
    const command = prefixCommands.get(commandName);

    if (!command) {
      return;
    }

    try {
      await command.execute({ message, args, commandName });
    } catch (error) {
      logger.error(`Prefix command failed: ${commandName}`, error);
    }
  });
}
