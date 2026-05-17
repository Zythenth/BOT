import { slashCommands } from "./commands";
import { logger } from "./utils";

async function main(): Promise<void> {
  if (slashCommands.size === 0) {
    logger.info("No slash commands to deploy in this scaffold stage.");
    return;
  }

  logger.warn("Command deployment is prepared, but real registration starts after commands exist.");
}

void main().catch((error) => {
  logger.error("Command deploy script failed.", error);
  process.exitCode = 1;
});
