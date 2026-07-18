import { PermissionFlagsBits, type ButtonInteraction } from "discord.js";
import { getRpActionDefinition, RETRIBUTE_BUTTON_TTL_MS } from "../config";
import { buttonInteractionStateRepository } from "../database";
import type { ActionContext, ActionResult } from "../types";
import { actionService } from "./actionService";
import { failAction } from "./actionValidation";

const RETRIBUTE_BUTTON_PREFIX = "rp:retribute:";
const RETRIBUTE_SENDER_MESSAGE =
  "Ei, esse botão é para quem recebeu o carinho retribuir você. Deixa a outra pessoa decidir, tá? 💛";
const RETRIBUTE_OTHER_USER_MESSAGE =
  "Ei! Esse carinho não era pra você retribuir. Só quem recebeu pode apertar esse botão. 😤";
const RETRIBUTE_EXPIRED_MESSAGE =
  "Ops, esse carinho já se perdeu no tempo. Melhor mandar outro novinho. 💫";

export function isRetributeButtonCustomId(customId: string): boolean {
  return customId.startsWith(RETRIBUTE_BUTTON_PREFIX);
}

export interface RetributeButtonState {
  action: string;
  guildId: string;
  originalAuthorId: string;
  originalTargetId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface RetributeStateStore {
  findByCustomId(customId: string): Promise<RetributeButtonState | null>;
  claim(customId: string, usedAt: Date): Promise<{ count: number }>;
  release(customId: string, usedAt: Date): Promise<{ count: number }>;
}

export interface RetributeActionExecutor {
  execute(context: ActionContext): Promise<ActionResult>;
}

export function createRetributeService(
  stateStore: RetributeStateStore = buttonInteractionStateRepository,
  actionExecutor: RetributeActionExecutor = actionService
) {
  return {
    async execute(interaction: ButtonInteraction): Promise<ActionResult> {
      const parsed = parseRetributeCustomId(interaction.customId);

      if (!parsed) {
        return failAction("expired", RETRIBUTE_EXPIRED_MESSAGE);
      }

      if (interaction.guildId !== parsed.guildId) {
        return failAction("expired", RETRIBUTE_EXPIRED_MESSAGE);
      }

      if (isExpired(parsed.createdAt, new Date())) {
        return failAction("expired", RETRIBUTE_EXPIRED_MESSAGE);
      }

      if (interaction.user.id === parsed.originalActorUserId) {
        return failAction("blocked", RETRIBUTE_SENDER_MESSAGE);
      }

      if (interaction.user.id !== parsed.originalTargetUserId) {
        return failAction("blocked", RETRIBUTE_OTHER_USER_MESSAGE);
      }

      const state = await stateStore.findByCustomId(interaction.customId);

      if (!isMatchingAvailableState(state, parsed, new Date())) {
        return failAction("expired", RETRIBUTE_EXPIRED_MESSAGE);
      }

      const definition = getRpActionDefinition(parsed.action);

      if (!definition) {
        return failAction("unknown_error", "Esta acao de RP nao esta registrada.");
      }

      const botUser = interaction.client.user;

      if (!botUser) {
        throw new Error("Discord client user is not available.");
      }

      const claimedAt = new Date();
      const claim = await stateStore.claim(interaction.customId, claimedAt);

      if (claim.count !== 1) {
        return failAction("expired", RETRIBUTE_EXPIRED_MESSAGE);
      }

      try {
        const result = await actionExecutor.execute(
          buildRetributeContext(interaction, parsed, definition, botUser)
        );

        if (!result.ok) {
          await stateStore.release(interaction.customId, claimedAt);
        }

        return result;
      } catch (error) {
        await stateStore.release(interaction.customId, claimedAt).catch(() => undefined);
        throw error;
      }
    }
  };
}

export const retributeService = createRetributeService();

interface ParsedRetributeCustomId {
  action: string;
  guildId: string;
  originalActorUserId: string;
  originalTargetUserId: string;
  createdAt: Date;
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
    !originalTargetUserId ||
    !timestamp
  ) {
    return null;
  }

  const createdAt = parseBase36Timestamp(timestamp);

  if (!createdAt) {
    return null;
  }

  return {
    action,
    guildId,
    originalActorUserId,
    originalTargetUserId,
    createdAt
  };
}

function parseBase36Timestamp(value: string | undefined): Date | undefined {
  if (!value || !/^[0-9a-z]+$/i.test(value)) {
    return undefined;
  }

  const timestamp = Number.parseInt(value, 36);

  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return undefined;
  }

  const createdAt = new Date(timestamp);
  return Number.isNaN(createdAt.getTime()) ? undefined : createdAt;
}

function isExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() > RETRIBUTE_BUTTON_TTL_MS;
}

function isMatchingAvailableState(
  state: RetributeButtonState | null,
  parsed: ParsedRetributeCustomId,
  now: Date
): state is RetributeButtonState {
  return Boolean(
    state &&
    state.guildId === parsed.guildId &&
    state.action === parsed.action &&
    state.originalAuthorId === parsed.originalActorUserId &&
    state.originalTargetId === parsed.originalTargetUserId &&
    state.usedAt === null &&
    state.expiresAt.getTime() > now.getTime()
  );
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
