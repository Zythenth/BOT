import {
  type AutocompleteInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from "discord.js";
import { getRpActionDefinition, RP_ACTION_DEFINITIONS, type RpActionDefinition } from "../config";
import { actionService, aliasService, listBuiltInAliases } from "../services";
import type { ActionContext, SlashCommandDefinition } from "../types";
import { replyWithActionResult } from "./actionResponseAdapter";

const TARGET_OPTION_NAME = "alvo";
const ACTION_OPTION_NAME = "acao";
const MESSAGE_OPTION_NAME = "mensagem";
const MAX_CUSTOM_MESSAGE_LENGTH = 120;

export const rpSlashCommands: SlashCommandDefinition[] = [
  ...RP_ACTION_DEFINITIONS.map((definition) => createRpSlashCommand(definition)),
  createGroupedRpSlashCommand()
];

function createRpSlashCommand(definition: RpActionDefinition): SlashCommandDefinition {
  const data = new SlashCommandBuilder()
    .setName(definition.commandName)
    .setDescription(definition.description)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName(TARGET_OPTION_NAME).setDescription("Pessoa alvo da acao.").setRequired(true)
    );

  return {
    name: definition.commandName,
    description: definition.description,
    data,
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const target = interaction.options.getUser(TARGET_OPTION_NAME, true);
      await executeRpActionInteraction(interaction, definition, target);
    }
  };
}

function createGroupedRpSlashCommand(): SlashCommandDefinition {
  const data = new SlashCommandBuilder()
    .setName("rp")
    .setDescription("Executa uma acao de RP com autocomplete.")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName(ACTION_OPTION_NAME)
        .setDescription("Acao de RP.")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addUserOption((option) =>
      option.setName(TARGET_OPTION_NAME).setDescription("Pessoa alvo da acao.").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName(MESSAGE_OPTION_NAME)
        .setDescription("Mensagem curta opcional.")
        .setRequired(false)
        .setMaxLength(MAX_CUSTOM_MESSAGE_LENGTH)
    );

  return {
    name: "rp",
    description: "Executa uma acao de RP com autocomplete.",
    data,
    async execute(interaction) {
      const rawAction = interaction.options.getString(ACTION_OPTION_NAME, true);
      const resolvedAction = await aliasService.resolveCommandName(
        interaction.guildId ?? "",
        rawAction
      );
      const definition = resolvedAction ? getRpActionDefinition(resolvedAction) : undefined;

      if (!definition) {
        await interaction.reply({
          content: "Escolha uma acao de RP valida.",
          ephemeral: true
        });
        return;
      }

      const target = interaction.options.getUser(TARGET_OPTION_NAME, true);
      const customMessage = interaction.options.getString(MESSAGE_OPTION_NAME) ?? undefined;
      await executeRpActionInteraction(
        interaction,
        definition,
        target,
        sanitizeCustomMessage(customMessage)
      );
    },
    async autocomplete(interaction) {
      await interaction.respond(buildActionAutocompleteChoices(interaction));
    }
  };
}

async function executeRpActionInteraction(
  interaction: ChatInputCommandInteraction,
  definition: RpActionDefinition,
  target: NonNullable<ReturnType<ChatInputCommandInteraction["options"]["getUser"]>>,
  customMessage?: string
): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const botUser = interaction.client.user;

  if (!botUser) {
    throw new Error("Discord client user is not available.");
  }

  const result = await actionService.execute(
    buildActionContext(interaction, definition, target, botUser, customMessage)
  );
  await replyWithActionResult(interaction, result);
}

function buildActionContext(
  interaction: ChatInputCommandInteraction,
  definition: RpActionDefinition,
  target: NonNullable<ReturnType<ChatInputCommandInteraction["options"]["getUser"]>>,
  botUser: NonNullable<ChatInputCommandInteraction["client"]["user"]>,
  customMessage?: string
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
    now: new Date(),
    metadata: customMessage
      ? {
          customMessage
        }
      : undefined
  };
}

function buildActionAutocompleteChoices(interaction: AutocompleteInteraction): Array<{
  name: string;
  value: string;
}> {
  const focusedValue = String(interaction.options.getFocused(true).value ?? "");
  const normalizedFocus = aliasService.normalizeAlias(focusedValue);
  const canonicalChoices = RP_ACTION_DEFINITIONS.map((definition) => ({
    name: definition.commandName,
    value: definition.commandName
  }));
  const aliasChoices = listBuiltInAliases()
    .filter((entry) => Boolean(getRpActionDefinition(entry.commandName)))
    .map((entry) => ({
      name: `${entry.alias} -> ${entry.commandName}`,
      value: entry.alias
    }));
  const uniqueChoices = new Map<string, { name: string; value: string }>();

  for (const choice of [...canonicalChoices, ...aliasChoices]) {
    if (!uniqueChoices.has(choice.value)) {
      uniqueChoices.set(choice.value, choice);
    }
  }

  return [...uniqueChoices.values()]
    .filter((choice) => {
      if (!normalizedFocus) {
        return true;
      }

      return (
        aliasService.normalizeAlias(choice.name).includes(normalizedFocus) ||
        aliasService.normalizeAlias(choice.value).includes(normalizedFocus)
      );
    })
    .slice(0, 25);
}

function sanitizeCustomMessage(value: string | undefined): string | undefined {
  const normalized = value
    ?.replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/@everyone/gi, "everyone")
    .replace(/@here/gi, "here")
    .replace(/<@!?\d{17,20}>/g, "[mencao]")
    .replace(/<@&\d{17,20}>/g, "[cargo]")
    .replace(/<#\d{17,20}>/g, "[canal]")
    .trim();

  return normalized ? normalized.slice(0, MAX_CUSTOM_MESSAGE_LENGTH).trim() : undefined;
}
