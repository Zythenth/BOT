import { PermissionFlagsBits, type ButtonInteraction } from "discord.js";
import { getRpActionDefinition } from "../config";
import type { ActionContext, ActionResult } from "../types";
import { actionService } from "./actionService";
import { failAction } from "./actionValidation";

const RETRIBUTE_BUTTON_PREFIX = "rp:retribute:";

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
      return failAction("blocked", "Apenas o alvo original pode retribuir esta acao.");
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
}

function parseRetributeCustomId(customId: string): ParsedRetributeCustomId | null {
  const [namespace, kind, action, guildId, originalActorUserId, originalTargetUserId] =
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
    originalTargetUserId
  };
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
      isBot: interaction.user.bot
    },
    target: {
      id: parsed.originalActorUserId,
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
