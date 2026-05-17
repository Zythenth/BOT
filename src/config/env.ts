import dotenv from "dotenv";
import { DEFAULT_PREFIX } from "./constants";

if (process.env.DOTENV_CONFIG_PATH) {
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  dotenv.config();
}

export interface AppConfig {
  environment: string;
  discord: {
    token: string;
    clientId: string;
    devGuildId?: string;
  };
  databaseUrl: string;
  defaultPrefix: string;
  gifs: {
    provider: string;
    giphyApiKey?: string;
    requestsPerHour: number;
    rating: string;
    lang: string;
    dbMinRatio: number;
    dbMaxRatio: number;
    externalMinRatio: number;
    externalMaxRatio: number;
    allowNsfw: boolean;
    allowUncategorized: boolean;
  };
}

export function loadConfig(): AppConfig {
  return {
    environment: process.env.NODE_ENV ?? "development",
    discord: {
      token: readString("DISCORD_TOKEN"),
      clientId: readString("DISCORD_CLIENT_ID"),
      devGuildId: readOptionalString("DISCORD_DEV_GUILD_ID")
    },
    databaseUrl: readString("DATABASE_URL", "file:./dev.db"),
    defaultPrefix: readString("DEFAULT_PREFIX", DEFAULT_PREFIX),
    gifs: {
      provider: readString("GIF_PROVIDER", "giphy"),
      giphyApiKey: readOptionalString("GIPHY_API_KEY"),
      requestsPerHour: readNumber("GIPHY_REQUESTS_PER_HOUR", 100),
      rating: readString("GIPHY_RATING", "pg"),
      lang: readString("GIPHY_LANG", "pt"),
      dbMinRatio: readNumber("GIF_DB_MIN_RATIO", 0.65),
      dbMaxRatio: readNumber("GIF_DB_MAX_RATIO", 0.85),
      externalMinRatio: readNumber("GIF_GIPHY_MIN_RATIO", 0.15),
      externalMaxRatio: readNumber("GIF_GIPHY_MAX_RATIO", 0.35),
      allowNsfw: readBoolean("ALLOW_NSFW", false),
      allowUncategorized: readBoolean("ALLOW_UNCATEGORIZED_GIFS", true)
    }
  };
}

export function assertRuntimeConfig(config: AppConfig): void {
  const missing: string[] = [];

  if (!config.discord.token) {
    missing.push("DISCORD_TOKEN");
  }

  if (!config.discord.clientId) {
    missing.push("DISCORD_CLIENT_ID");
  }

  if (!config.databaseUrl) {
    missing.push("DATABASE_URL");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function readString(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function readOptionalString(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(value);
}
