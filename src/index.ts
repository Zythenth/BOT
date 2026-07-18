import type { PrismaClient } from "@prisma/client";
import type { Client } from "discord.js";
import { assertRuntimeConfig, loadConfig } from "./config";
import { logger } from "./utils";

let activeClient: Client | undefined;
let activePrisma: PrismaClient | undefined;
let shutdownPromise: Promise<void> | undefined;

export async function bootstrap(): Promise<void> {
  const config = loadConfig();
  assertRuntimeConfig(config);

  const [{ createAuroraClient }, { prisma }] = await Promise.all([
    import("./client"),
    import("./database")
  ]);

  activePrisma = prisma;
  await assertDatabaseReady(prisma);

  activeClient = createAuroraClient(config);
  registerShutdownHandlers();
  await activeClient.login(config.discord.token);
}

export async function shutdown(reason: string): Promise<void> {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    logger.info("Shutting down Aurora.", { reason });
    activeClient?.destroy();
    await activePrisma?.$disconnect();
  })();

  return shutdownPromise;
}

async function assertDatabaseReady(prisma: PrismaClient): Promise<void> {
  await prisma.$connect();
  await prisma.guild.count();
}

function registerShutdownHandlers(): void {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown(signal).catch((error) => {
        logger.error("Graceful shutdown failed.", { error, signal });
        process.exitCode = 1;
      });
    });
  }
}

if (require.main === module) {
  void bootstrap().catch(async (error) => {
    logger.error("Failed to start Aurora.", { error });
    process.exitCode = 1;
    await shutdown("startup_error");
  });
}
