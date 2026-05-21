import { REST, Routes } from "discord.js";
import { slashCommands } from "./commands";
import { assertRuntimeConfig, loadConfig } from "./config";
import { logger } from "./utils";

async function main(): Promise<void> {
  if (slashCommands.size === 0) {
    logger.info("No slash commands to deploy.");
    return;
  }

  const config = loadConfig();
  assertRuntimeConfig(config);

  const commandData = slashCommands.map((command) => command.data.toJSON());
  const rest = new REST({ version: "10" }).setToken(config.discord.token);

  const devGuildId = config.discord.devGuildId;

  if (devGuildId) {
    await deployWithMissingAccessHint(
      () =>
        rest.put(
          Routes.applicationGuildCommands(config.discord.clientId, devGuildId),
          { body: commandData }
        ),
      "guild",
      devGuildId
    );
    logger.info(`Deployed ${commandData.length} slash commands to dev guild ${devGuildId}.`);
    return;
  }

  await deployWithMissingAccessHint(
    () => rest.put(Routes.applicationCommands(config.discord.clientId), { body: commandData }),
    "global"
  );
  logger.info(`Deployed ${commandData.length} global slash commands.`);
}

async function deployWithMissingAccessHint(
  deploy: () => Promise<unknown>,
  target: "guild" | "global",
  guildId?: string
): Promise<void> {
  try {
    await deploy();
  } catch (error) {
    if (isDiscordMissingAccessError(error)) {
      logger.error("Discord recusou o deploy de slash commands com Missing Access.", {
        target,
        guildId,
        checks: [
          "confirme que DISCORD_TOKEN e DISCORD_CLIENT_ID pertencem a mesma aplicacao",
          "se DISCORD_DEV_GUILD_ID estiver definido, confirme que o bot esta nesse servidor",
          "reconvide o bot com os scopes bot e applications.commands"
        ]
      });
    }

    throw error;
  }
}

function isDiscordMissingAccessError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === 50001
  );
}

void main().catch((error) => {
  logger.error("Command deploy script failed.", { error });
  process.exitCode = 1;
});
