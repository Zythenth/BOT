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

  if (config.discord.devGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.devGuildId),
      { body: commandData }
    );
    logger.info(`Deployed ${commandData.length} slash commands to dev guild ${config.discord.devGuildId}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commandData });
  logger.info(`Deployed ${commandData.length} global slash commands.`);
}

void main().catch((error) => {
  logger.error("Command deploy script failed.", error);
  process.exitCode = 1;
});
