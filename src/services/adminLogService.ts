import { adminLogRepository } from "../database";
import { logger, sanitizeForLog } from "../utils";

export const ADMIN_LOG_ACTIONS = {
  CONFIG_PREFIX: "config.prefixo",
  CONFIG_AFFINITY: "config.afinidade",
  CONFIG_GIFS: "config.gifs",
  CONFIG_CATEGORY: "config.categoria",
  CONFIG_CHANNEL: "config.canal",
  CONFIG_COOLDOWN: "config.cooldown",
  CONFIG_LOCALE: "config.idioma",
  CONFIG_MENTION: "config.mencionar",
  CONFIG_RANK: "config.rank",
  CONFIG_RESET: "config.reset",
  GIF_ADD: "gifadd",
  GIF_SEARCH: "gifbuscar",
  GIF_APPROVE: "gifaprovar",
  GIF_BLOCK: "gifbloquear",
  GIF_REMOVE: "gifremove",
  GIF_MOVE: "gifmover",
  GIF_LIST: "giflist",
  GIF_TEST: "giftest",
  PHRASE_ADD: "fraseadd",
  PHRASE_REMOVE: "fraseremove",
  PHRASE_LIST: "fraselist",
  BLACKLIST_ADD: "blacklist.add",
  BLACKLIST_REMOVE: "blacklist.remove",
  AFFINITY_RESET: "afinidade.reset",
  POINTS_UPDATE: "pontuacao.update"
} as const;

export interface AdminLogInput {
  guildId: string;
  actorUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

export const adminLogService = {
  async log(input: AdminLogInput): Promise<void> {
    try {
      await adminLogRepository.logAction({
        guildId: input.guildId,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        details: serializeDetails(input.details)
      });
    } catch (error) {
      logger.error("Failed to write AdminLog.", {
        error,
        guildId: input.guildId,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId
      });
    }
  }
};

function serializeDetails(details: Record<string, unknown> | undefined): string | undefined {
  if (!details) {
    return undefined;
  }

  const sanitized = sanitizeForLog(details, { includeStack: false });
  const serialized = JSON.stringify(sanitized);

  if (serialized.length <= 1500) {
    return serialized;
  }

  return `${serialized.slice(0, 1497)}...`;
}
