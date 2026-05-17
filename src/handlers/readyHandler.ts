import { Events, type Client } from "discord.js";
import { BOT_NAME } from "../config";
import { logger } from "../utils";

export function registerReadyHandler(client: Client): void {
  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`${BOT_NAME} connected as ${readyClient.user.tag}.`);
  });
}
