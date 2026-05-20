import { createAuroraClient } from "./client";
import { assertRuntimeConfig, loadConfig } from "./config";
import { logger } from "./utils";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  assertRuntimeConfig(config);

  const client = createAuroraClient(config);
  await client.login(config.discord.token);
}

void bootstrap().catch((error) => {
  logger.error("Failed to start Aurora.", { error });
  process.exitCode = 1;
});
