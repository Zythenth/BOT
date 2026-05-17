import { Client, GatewayIntentBits } from "discord.js";
import type { AppConfig } from "./config";
import { registerEventHandlers } from "./handlers";

export function createAuroraClient(config: AppConfig): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  registerEventHandlers(client, config);

  return client;
}
