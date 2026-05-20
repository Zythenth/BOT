import type { Client } from "discord.js";
import type { AppConfig } from "../config";
import { registerErrorHandler } from "./errorHandler";
import { registerInteractionHandler } from "./interactionHandler";
import { registerMessageHandler } from "./messageHandler";
import { registerReadyHandler } from "./readyHandler";

export function registerEventHandlers(client: Client, config: AppConfig): void {
  registerReadyHandler(client, config);
  registerErrorHandler(client);
  registerInteractionHandler(client, config);
  registerMessageHandler(client, config);
}
