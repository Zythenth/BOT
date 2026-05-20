import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from "discord.js";
import { RP_ACTION_DEFINITIONS, type RpActionDefinition } from "../config";
import { actionService } from "../services";
import type { ActionContext, SlashCommandDefinition } from "../types";
import { replyWithActionResult } from "./actionResponseAdapter";

const TARGET_OPTION_NAME = "alvo";

export const rpSlashCommands: SlashCommandDefinition[] = RP_ACTION_DEFINITIONS.map((definition) =>
  createRpSlashCommand(definition)
);

function createRpSlashCommand(definition: RpActionDefinition): SlashCommandDefinition {
  const data = new SlashCommandBuilder()
    .setName(definition.commandName)
    .setDescription(definition.description)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName(TARGET_OPTION_NAME)
        .setDescription("Pessoa alvo da acao.")
        .setRequired(true)
    );

  return {
    name: definition.commandName,
    description: definition.description,
    data,
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const target = interaction.options.getUser(TARGET_OPTION_NAME, true);
      const botUser = interaction.client.user;

      if (!botUser) {
        throw new Error("Discord client user is not available.");
      }

      const result = await actionService.execute(buildActionContext(interaction, definition, target, botUser));
      await replyWithActionResult(interaction, result);
    }
  };
}

function buildActionContext(
  interaction: ChatInputCommandInteraction,
  definition: RpActionDefinition,
  target: NonNullable<ReturnType<ChatInputCommandInteraction["options"]["getUser"]>>,
  botUser: NonNullable<ChatInputCommandInteraction["client"]["user"]>
): ActionContext {
  return {
    action: definition.action,
    category: definition.category,
    source: "slash",
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
      id: target.id,
      displayName: target.globalName ?? target.username,
      isBot: target.bot
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
