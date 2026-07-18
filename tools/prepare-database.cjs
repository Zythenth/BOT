const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

if (process.env.DOTENV_CONFIG_PATH) {
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  dotenv.config();
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required before applying migrations.");
  }

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message =
    error instanceof Error && error.message.startsWith("DATABASE_URL")
      ? error.message
      : "Could not prepare the database. Check DATABASE_URL and filesystem access.";

  console.error(message);
  process.exitCode = 1;
});
