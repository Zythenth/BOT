import { Events, type Client } from "discord.js";
import { BOT_NAME, type AppConfig } from "../config";
import { guildAccessService } from "../services";
import { logger } from "../utils";

export function registerReadyHandler(client: Client, config: AppConfig): void {
  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(`${BOT_NAME} connected as ${readyClient.user.tag}.`);
    await syncCurrentGuilds(readyClient, config);
  });

  client.on(Events.GuildCreate, async (guild) => {
    try {
      await guildAccessService.syncGuildAccess(guild, config.discord.allowedGuildIds);
    } catch (error) {
      logger.error("Failed to enforce guild allowlist on guild create.", {
        error,
        guildId: guild.id
      });
    }
  });
}

async function syncCurrentGuilds(client: Client<true>, config: AppConfig): Promise<void> {
  await Promise.all(
    client.guilds.cache.map(async (guild) => {
      try {
        await guildAccessService.syncGuildAccess(guild, config.discord.allowedGuildIds);
      } catch (error) {
        logger.error("Failed to enforce guild allowlist on ready.", {
          error,
          guildId: guild.id
        });
      }
    })
  );
}
