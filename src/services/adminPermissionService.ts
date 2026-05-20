import { PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";

export interface AdminPermissionResult {
  allowed: boolean;
  reason?: string;
}

export const adminPermissionService = {
  canManageGifs(interaction: ChatInputCommandInteraction): AdminPermissionResult {
    return canManageServerFeature(interaction, "Use comandos administrativos de GIF em um servidor.");
  },

  canManagePhrases(interaction: ChatInputCommandInteraction): AdminPermissionResult {
    return canManageServerFeature(interaction, "Use comandos administrativos de frases em um servidor.");
  },

  canManageConfig(interaction: ChatInputCommandInteraction): AdminPermissionResult {
    return canManageServerFeature(interaction, "Use comandos de configuracao em um servidor.");
  }
};

function canManageServerFeature(
  interaction: ChatInputCommandInteraction,
  dmReason: string
): AdminPermissionResult {
  if (!interaction.guildId) {
    return {
      allowed: false,
      reason: dmReason
    };
  }

  if (interaction.guild?.ownerId === interaction.user.id) {
    return { allowed: true };
  }

  const permissions = interaction.memberPermissions;

  if (
    permissions?.has(PermissionFlagsBits.Administrator) ||
    permissions?.has(PermissionFlagsBits.ManageGuild)
  ) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Voce precisa ser dono, administrador ou ter permissao de gerenciar servidor."
  };
}
