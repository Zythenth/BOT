import type { Guild, Prisma } from "@prisma/client";
import {
  DEFAULT_GUILD_CONFIG,
  SUPPORTED_GUILD_LOCALES,
  type SupportedGuildLocale
} from "../config";
import { guildRepository } from "../database";
import type { ActionCategory } from "../types";
import { ADMIN_LOG_ACTIONS, adminLogService } from "./adminLogService";

export interface GuildConfig {
  guildId: string;
  prefix: string;
  affinityEnabled: boolean;
  gifsEnabled: boolean;
  cooldownEnabled: boolean;
  cooldownSeconds: number;
  locale: SupportedGuildLocale;
  mentionUsers: boolean;
  rankingEnabled: boolean;
  disabledCategories: string[];
  allowedChannelIds: string[];
}

export interface GuildConfigChangeInput {
  guildId: string;
  actorUserId: string;
}

export type GuildConfigResult =
  | {
      ok: true;
      message: string;
      config: GuildConfig;
    }
  | {
      ok: false;
      message: string;
    };

export const guildConfigService = {
  async getConfig(guildId: string): Promise<GuildConfig> {
    const existingGuild = await guildRepository.findById(guildId);

    if (existingGuild) {
      return toGuildConfig(existingGuild);
    }

    const guild = await guildRepository.upsert({
      id: guildId,
      prefix: DEFAULT_GUILD_CONFIG.prefix,
      affinityEnabled: DEFAULT_GUILD_CONFIG.affinityEnabled,
      gifsEnabled: DEFAULT_GUILD_CONFIG.gifsEnabled,
      cooldownEnabled: DEFAULT_GUILD_CONFIG.cooldownEnabled,
      cooldownSeconds: DEFAULT_GUILD_CONFIG.cooldownSeconds,
      locale: DEFAULT_GUILD_CONFIG.locale,
      mentionUsers: DEFAULT_GUILD_CONFIG.mentionUsers,
      rankingEnabled: DEFAULT_GUILD_CONFIG.rankingEnabled,
      disabledCategories: stringifyStringArray(DEFAULT_GUILD_CONFIG.disabledCategories),
      allowedChannelIds: stringifyStringArray(DEFAULT_GUILD_CONFIG.allowedChannelIds)
    });

    return toGuildConfig(guild);
  },

  async setPrefix(input: GuildConfigChangeInput & { prefix: string }): Promise<GuildConfigResult> {
    const prefix = input.prefix.trim();

    if (!isValidPrefix(prefix)) {
      return {
        ok: false,
        message: "Prefixo invalido. Use de 1 a 5 caracteres, sem espacos."
      };
    }

    const config = await updateGuildConfig(input, { prefix }, ADMIN_LOG_ACTIONS.CONFIG_PREFIX, { prefix });

    return {
      ok: true,
      message: `Prefixo alterado para ${prefix}.`,
      config
    };
  },

  async setAffinityEnabled(
    input: GuildConfigChangeInput & { enabled: boolean }
  ): Promise<GuildConfigResult> {
    const config = await updateGuildConfig(
      input,
      { affinityEnabled: input.enabled },
      ADMIN_LOG_ACTIONS.CONFIG_AFFINITY,
      { enabled: input.enabled }
    );

    return boolResult("Afinidade", input.enabled, config);
  },

  async setGifsEnabled(input: GuildConfigChangeInput & { enabled: boolean }): Promise<GuildConfigResult> {
    const config = await updateGuildConfig(
      input,
      { gifsEnabled: input.enabled },
      ADMIN_LOG_ACTIONS.CONFIG_GIFS,
      { enabled: input.enabled }
    );

    return boolResult("GIFs", input.enabled, config);
  },

  async setCategoryEnabled(
    input: GuildConfigChangeInput & { category: ActionCategory; enabled: boolean }
  ): Promise<GuildConfigResult> {
    const currentConfig = await guildConfigService.getConfig(input.guildId);
    const disabledCategories = input.enabled
      ? currentConfig.disabledCategories.filter((category) => category !== input.category)
      : addUnique(currentConfig.disabledCategories, input.category);
    const config = await updateGuildConfig(
      input,
      { disabledCategories: stringifyStringArray(disabledCategories) },
      ADMIN_LOG_ACTIONS.CONFIG_CATEGORY,
      { category: input.category, enabled: input.enabled }
    );

    return {
      ok: true,
      message: `Categoria ${input.category} ${input.enabled ? "ativada" : "desativada"}.`,
      config
    };
  },

  async setChannelAllowed(
    input: GuildConfigChangeInput & { channelId: string; allowed: boolean }
  ): Promise<GuildConfigResult> {
    const currentConfig = await guildConfigService.getConfig(input.guildId);
    const allowedChannelIds = input.allowed
      ? addUnique(currentConfig.allowedChannelIds, input.channelId)
      : currentConfig.allowedChannelIds.filter((channelId) => channelId !== input.channelId);
    const config = await updateGuildConfig(
      input,
      { allowedChannelIds: stringifyStringArray(allowedChannelIds) },
      ADMIN_LOG_ACTIONS.CONFIG_CHANNEL,
      { channelId: input.channelId, allowed: input.allowed }
    );

    return {
      ok: true,
      message: input.allowed
        ? `Canal <#${input.channelId}> adicionado aos canais permitidos.`
        : `Canal <#${input.channelId}> removido dos canais permitidos.`,
      config
    };
  },

  async setCooldown(
    input: GuildConfigChangeInput & { enabled: boolean; seconds?: number }
  ): Promise<GuildConfigResult> {
    const currentConfig = await guildConfigService.getConfig(input.guildId);
    const cooldownSeconds = input.seconds ?? currentConfig.cooldownSeconds;

    if (!Number.isInteger(cooldownSeconds) || cooldownSeconds < 0 || cooldownSeconds > 3600) {
      return {
        ok: false,
        message: "Cooldown deve ficar entre 0 e 3600 segundos."
      };
    }

    const config = await updateGuildConfig(
      input,
      {
        cooldownEnabled: input.enabled,
        cooldownSeconds
      },
      ADMIN_LOG_ACTIONS.CONFIG_COOLDOWN,
      { enabled: input.enabled, seconds: cooldownSeconds }
    );

    return {
      ok: true,
      message: input.enabled
        ? `Cooldown ativado com ${cooldownSeconds}s.`
        : "Cooldown desativado.",
      config
    };
  },

  async setLocale(
    input: GuildConfigChangeInput & { locale: SupportedGuildLocale }
  ): Promise<GuildConfigResult> {
    if (!SUPPORTED_GUILD_LOCALES.includes(input.locale)) {
      return {
        ok: false,
        message: `Idioma invalido. Use: ${SUPPORTED_GUILD_LOCALES.join(", ")}.`
      };
    }

    const config = await updateGuildConfig(input, { locale: input.locale }, ADMIN_LOG_ACTIONS.CONFIG_LOCALE, {
      locale: input.locale
    });

    return {
      ok: true,
      message: `Idioma do servidor definido como ${input.locale}.`,
      config
    };
  },

  async setMentionUsers(
    input: GuildConfigChangeInput & { enabled: boolean }
  ): Promise<GuildConfigResult> {
    const config = await updateGuildConfig(
      input,
      { mentionUsers: input.enabled },
      ADMIN_LOG_ACTIONS.CONFIG_MENTION,
      { enabled: input.enabled }
    );

    return {
      ok: true,
      message: input.enabled
        ? "Mencoes ativadas nas respostas de RP."
        : "Respostas de RP usarao nomes sem ping quando possivel.",
      config
    };
  },

  async setRankingEnabled(
    input: GuildConfigChangeInput & { enabled: boolean }
  ): Promise<GuildConfigResult> {
    const config = await updateGuildConfig(
      input,
      { rankingEnabled: input.enabled },
      ADMIN_LOG_ACTIONS.CONFIG_RANK,
      { enabled: input.enabled }
    );

    return boolResult("Ranking", input.enabled, config);
  },

  async resetConfig(input: GuildConfigChangeInput): Promise<GuildConfigResult> {
    const config = await updateGuildConfig(
      input,
      {
        prefix: DEFAULT_GUILD_CONFIG.prefix,
        affinityEnabled: DEFAULT_GUILD_CONFIG.affinityEnabled,
        gifsEnabled: DEFAULT_GUILD_CONFIG.gifsEnabled,
        cooldownEnabled: DEFAULT_GUILD_CONFIG.cooldownEnabled,
        cooldownSeconds: DEFAULT_GUILD_CONFIG.cooldownSeconds,
        locale: DEFAULT_GUILD_CONFIG.locale,
        mentionUsers: DEFAULT_GUILD_CONFIG.mentionUsers,
        rankingEnabled: DEFAULT_GUILD_CONFIG.rankingEnabled,
        disabledCategories: stringifyStringArray(DEFAULT_GUILD_CONFIG.disabledCategories),
        allowedChannelIds: stringifyStringArray(DEFAULT_GUILD_CONFIG.allowedChannelIds)
      },
      ADMIN_LOG_ACTIONS.CONFIG_RESET,
      { outcome: "reset" }
    );

    return {
      ok: true,
      message: "Configuracoes do servidor resetadas para o padrao.",
      config
    };
  }
};

async function updateGuildConfig(
  input: GuildConfigChangeInput,
  data: Prisma.GuildUpdateInput,
  action: string,
  details: Record<string, unknown>
): Promise<GuildConfig> {
  await guildConfigService.getConfig(input.guildId);
  const guild = await guildRepository.update(input.guildId, data);

  await adminLogService.log({
    guildId: input.guildId,
    actorUserId: input.actorUserId,
    action,
    targetType: "guild",
    targetId: input.guildId,
    details
  });

  return toGuildConfig(guild);
}

function toGuildConfig(guild: Guild): GuildConfig {
  return {
    guildId: guild.id,
    prefix: guild.prefix || DEFAULT_GUILD_CONFIG.prefix,
    affinityEnabled: guild.affinityEnabled,
    gifsEnabled: guild.gifsEnabled,
    cooldownEnabled: guild.cooldownEnabled,
    cooldownSeconds: guild.cooldownSeconds,
    locale: normalizeLocale(guild.locale),
    mentionUsers: guild.mentionUsers,
    rankingEnabled: guild.rankingEnabled,
    disabledCategories: parseStringArray(guild.disabledCategories),
    allowedChannelIds: parseStringArray(guild.allowedChannelIds)
  };
}

function normalizeLocale(locale: string): SupportedGuildLocale {
  return SUPPORTED_GUILD_LOCALES.includes(locale as SupportedGuildLocale)
    ? (locale as SupportedGuildLocale)
    : DEFAULT_GUILD_CONFIG.locale;
}

function isValidPrefix(prefix: string): boolean {
  return prefix.length >= 1 && prefix.length <= 5 && !/\s/.test(prefix) && !prefix.startsWith("/");
}

function boolResult(name: string, enabled: boolean, config: GuildConfig): GuildConfigResult {
  return {
    ok: true,
    message: `${name} ${enabled ? "ativado" : "desativado"}.`,
    config
  };
}

function addUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

function stringifyStringArray(values: readonly string[]): string {
  return JSON.stringify([...new Set(values)]);
}
