import dotenv from "dotenv";
import { DEFAULT_PREFIX } from "./constants";
import { DEFAULT_ACTION_COOLDOWN_SECONDS } from "./guildDefaults";

export type AppEnvironment = "development" | "test" | "production";
export type GifProvider = "giphy";
export type GiphyRating = "g" | "pg" | "pg-13" | "r";

export interface AppConfig {
  environment: AppEnvironment;
  discord: {
    token: string;
    clientId: string;
    devGuildId?: string;
    allowedGuildIds: string[];
  };
  databaseUrl: string;
  defaultPrefix: string;
  actionCooldownSeconds: number;
  gifs: {
    provider: GifProvider;
    giphyApiKey?: string;
    requestsPerHour: number;
    rating: GiphyRating;
    lang: string;
    allowNsfw: boolean;
    allowUncategorized: boolean;
  };
}

export function loadConfig(): AppConfig {
  loadDotEnv();

  return parseConfig(process.env);
}

export function parseConfig(source: NodeJS.ProcessEnv): AppConfig {
  const reader = createEnvReader(source);
  const config: AppConfig = {
    environment: reader.enumValue("NODE_ENV", ["development", "test", "production"], "development"),
    discord: {
      token: reader.requiredString("DISCORD_TOKEN"),
      clientId: reader.requiredString("DISCORD_CLIENT_ID"),
      devGuildId: reader.optionalString("DISCORD_DEV_GUILD_ID"),
      allowedGuildIds: reader.stringList("DISCORD_ALLOWED_GUILD_IDS")
    },
    databaseUrl: reader.requiredString("DATABASE_URL"),
    defaultPrefix: DEFAULT_PREFIX,
    actionCooldownSeconds: reader.integer(
      "ACTION_COOLDOWN_SECONDS",
      DEFAULT_ACTION_COOLDOWN_SECONDS,
      { min: 0, max: 3600 }
    ),
    gifs: {
      provider: reader.enumValue("GIF_PROVIDER", ["giphy"], "giphy"),
      giphyApiKey: reader.optionalString("GIPHY_API_KEY"),
      requestsPerHour: reader.integer("GIPHY_REQUESTS_PER_HOUR", 100, { min: 1 }),
      rating: reader.enumValue("GIPHY_RATING", ["g", "pg", "pg-13", "r"], "pg"),
      lang: reader.string("GIPHY_LANG", "pt"),
      allowNsfw: reader.boolean("ALLOW_NSFW", false),
      allowUncategorized: reader.boolean("ALLOW_UNCATEGORIZED_GIFS", true)
    }
  };

  reader.throwIfInvalid();

  return config;
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

function loadDotEnv(): void {
  if (process.env.DOTENV_CONFIG_PATH) {
    dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
    return;
  }

  dotenv.config();
}

function createEnvReader(source: NodeJS.ProcessEnv) {
  const errors: string[] = [];

  function read(name: string): string | undefined {
    const value = source[name]?.trim();
    return value ? value : undefined;
  }

  function validateRange(name: string, value: number, options?: NumberOptions): void {
    if (options?.min !== undefined && value < options.min) {
      errors.push(`${name} must be greater than or equal to ${options.min}.`);
    }

    if (options?.max !== undefined && value > options.max) {
      errors.push(`${name} must be less than or equal to ${options.max}.`);
    }
  }

  function parseNumber(name: string, fallback: number, options?: NumberOptions): number {
    const rawValue = read(name);

    if (!rawValue) {
      validateRange(name, fallback, options);
      return fallback;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
      errors.push(`${name} must be a valid number.`);
      return fallback;
    }

    validateRange(name, value, options);
    return value;
  }

  return {
    errors,
    requiredString(name: string): string {
      const value = read(name);

      if (!value) {
        errors.push(`${name} is required.`);
        return "";
      }

      return value;
    },
    optionalString(name: string): string | undefined {
      return read(name);
    },
    string(name: string, fallback: string): string {
      return read(name) ?? fallback;
    },
    stringList(name: string): string[] {
      const value = read(name);

      if (!value) {
        return [];
      }

      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    },
    number(name: string, fallback: number, options?: NumberOptions): number {
      return parseNumber(name, fallback, options);
    },
    integer(name: string, fallback: number, options?: NumberOptions): number {
      const value = parseNumber(name, fallback, options);

      if (!Number.isInteger(value)) {
        errors.push(`${name} must be an integer.`);
      }

      return value;
    },
    boolean(name: string, fallback: boolean): boolean {
      const rawValue = read(name)?.toLowerCase();

      if (!rawValue) {
        return fallback;
      }

      if (["1", "true", "yes", "y", "on"].includes(rawValue)) {
        return true;
      }

      if (["0", "false", "no", "n", "off"].includes(rawValue)) {
        return false;
      }

      errors.push(`${name} must be a boolean value.`);
      return fallback;
    },
    enumValue<const T extends readonly string[]>(
      name: string,
      allowedValues: T,
      fallback: T[number]
    ): T[number] {
      const value = read(name) ?? fallback;

      if (!(allowedValues as readonly string[]).includes(value)) {
        errors.push(`${name} must be one of: ${allowedValues.join(", ")}.`);
        return fallback;
      }

      return value as T[number];
    },
    throwIfInvalid(): void {
      if (errors.length > 0) {
        throw new Error(`Invalid environment configuration:\n- ${errors.join("\n- ")}`);
      }
    }
  };
}

interface NumberOptions {
  min?: number;
  max?: number;
}
