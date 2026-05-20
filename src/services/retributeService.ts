import { PermissionFlagsBits, type ButtonInteraction } from "discord.js";
import { getRpActionDefinition } from "../config";
import type { ActionContext, ActionResult } from "../types";
import { actionService } from "./actionService";
import { failAction } from "./actionValidation";

const RETRIBUTE_BUTTON_PREFIX = "rp:retribute:";
const RETRIBUTE_BUTTON_TTL_MS = 15 * 60 * 1000;

export function isRetributeButtonCustomId(customId: string): boolean {
  return customId.startsWith(RETRIBUTE_BUTTON_PREFIX);
}

export const retributeService = {
  async execute(interaction: ButtonInteraction): Promise<ActionResult> {
    const parsed = parseRetributeCustomId(interaction.customId);

    if (!parsed) {
      return failAction("unknown_error", "Nao consegui identificar esta retribuicao.");
    }

    if (interaction.guildId !== parsed.guildId) {
      return failAction("dm_not_allowed", "Esta retribuicao so pode ser usada no servidor original.");
    }

    if (interaction.user.id !== parsed.originalTargetUserId) {
      return failAction("blocked", "So quem recebeu essa acao pode retribuir.");
    }

    if (isExpired(parsed.createdAt, new Date())) {
      return failAction("expired", "Esse botao expirou. Use o comando de novo.");
    }

    const definition = getRpActionDefinition(parsed.action);

    if (!definition) {
      return failAction("unknown_error", "Esta acao de RP nao esta registrada.");
    }

    const botUser = interaction.client.user;

    if (!botUser) {
      throw new Error("Discord client user is not available.");
    }

    return actionService.execute(buildRetributeContext(interaction, parsed, definition, botUser));
  }
};

interface ParsedRetributeCustomId {
  action: string;
  guildId: string;
  originalActorUserId: string;
  originalTargetUserId: string;
  createdAt?: Date;
}

function parseRetributeCustomId(customId: string): ParsedRetributeCustomId | null {
  const [namespace, kind, action, guildId, originalActorUserId, originalTargetUserId, timestamp] =
    customId.split(":");

  if (
    namespace !== "rp" ||
    kind !== "retribute" ||
    !action ||
    !guildId ||
    !originalActorUserId ||
    !originalTargetUserId
  ) {
    return null;
  }

  return {
    action,
    guildId,
    originalActorUserId,
    originalTargetUserId,
    createdAt: parseBase36Timestamp(timestamp)
  };
}

function parseBase36Timestamp(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = Number.parseInt(value, 36);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return undefined;
  }

  return new Date(timestamp);
}

function isExpired(createdAt: Date | undefined, now: Date): boolean {
  return createdAt
    ? now.getTime() - createdAt.getTime() > RETRIBUTE_BUTTON_TTL_MS
    : false;
}

function buildRetributeContext(
  interaction: ButtonInteraction,
  parsed: ParsedRetributeCustomId,
  definition: NonNullable<ReturnType<typeof getRpActionDefinition>>,
  botUser: NonNullable<ButtonInteraction["client"]["user"]>
): ActionContext {
  return {
    action: definition.action,
    category: definition.category,
    source: "button",
    guild: interaction.guild
      ? {
          id: interaction.guild.id,
          name: interaction.guild.name
        }
      : null,
    channelId: interaction.channelId,
    actor: {
      id: interaction.user.id,
      displayName: interaction.user.globalName ?? interaction.user.username,
      isBot: interaction.user.bot
    },
    target: {
      id: parsed.originalActorUserId,
      displayName: interaction.guild?.members.cache.get(parsed.originalActorUserId)?.displayName,
      isBot: false
    },
    botUser: {
      id: botUser.id,
      isBot: botUser.bot
    },
    permissions: {
      canSendMessages: interaction.appPermissions?.has(PermissionFlagsBits.SendMessages),
      canEmbedLinks: interaction.appPermissions?.has(PermissionFlagsBits.EmbedLinks),
      canUseExternalEmojis: interaction.appPermissions?.has(PermissionFlagsBits.UseExternalEmojis)
    },
    now: new Date()
  };
}
