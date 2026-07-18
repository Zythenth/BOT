import { DEFAULT_PREFIX } from "./constants";

export const SUPPORTED_GUILD_LOCALES = ["pt-BR"] as const;
export type SupportedGuildLocale = (typeof SUPPORTED_GUILD_LOCALES)[number];

export const DEFAULT_GUILD_COOLDOWN_SECONDS = 30;
export const DEFAULT_ACTION_COOLDOWN_SECONDS = 5;

export const DEFAULT_GUILD_CONFIG = {
  prefix: DEFAULT_PREFIX,
  affinityEnabled: true,
  gifsEnabled: true,
  cooldownEnabled: true,
  cooldownSeconds: DEFAULT_GUILD_COOLDOWN_SECONDS,
  locale: "pt-BR" as SupportedGuildLocale,
  mentionUsers: true,
  rankingEnabled: true,
  disabledCategories: [] as string[],
  allowedChannelIds: [] as string[]
};
