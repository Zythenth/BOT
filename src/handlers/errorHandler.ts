import { Events, type Client } from "discord.js";
import { logger } from "../utils";

export function registerErrorHandler(client: Client): void {
  client.on(Events.Error, (error) => {
    logger.error("Discord client error.", error);
  });

  client.on(Events.Warn, (message) => {
    logger.warn(`Discord client warning: ${message}`);
  });
}
