import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type SlashCommandStringOption
} from "discord.js";
import { adminPermissionService, phraseModerationService } from "../services";
import type { ActionCategory, ActionName, SlashCommandDefinition } from "../types";
import { buildPhraseListEmbed, buildPhraseMutationEmbed } from "./phraseAdminResponseAdapter";

const PHRASE_ID_OPTION = "id";
const ACTION_OPTION = "action";
const CATEGORY_OPTION = "categoria";
const TEXT_OPTION = "texto";
const LIMIT_OPTION = "limite";

export const phraseAdminSlashCommands: SlashCommandDefinition[] = [
  createPhraseAddCommand(),
  createPhraseRemoveCommand(),
  createPhraseListCommand()
];

function createAdminSlashCommandBuilder(): SlashCommandBuilder {
  return new SlashCommandBuilder().setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
}

function createPhraseAddCommand(): SlashCommandDefinition {
  const data = createAdminSlashCommandBuilder()
    .setName("fraseadd")
    .setDescription("Adiciona uma frase customizada para uma action.")
    .setDMPermission(false)
    .addStringOption((option) =>
      addActionChoices(
        option.setName(ACTION_OPTION).setDescription("Action da frase.").setRequired(true)
      )
    )
    .addStringOption((option) =>
      option
        .setName(TEXT_OPTION)
        .setDescription("Frase com placeholders permitidos.")
        .setRequired(true)
        .setMaxLength(240)
    )
    .addStringOption((option) =>
      addCategoryChoices(
        option
          .setName(CATEGORY_OPTION)
          .setDescription("Categoria, se a action nao tiver categoria padrao.")
          .setRequired(false)
      )
    );

  return {
    name: "fraseadd",
    description: "Adiciona uma frase customizada para uma action.",
    data,
    async execute(interaction) {
      if (!(await requirePhraseAdmin(interaction))) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const result = await phraseModerationService.addPhrase({
        guildId: interaction.guildId!,
        actorUserId: interaction.user.id,
        action: readAction(interaction, true)!,
        category: readCategory(interaction),
        text: interaction.options.getString(TEXT_OPTION, true)
      });

      await interaction.editReply({
        embeds: [buildPhraseMutationEmbed("Adicionar frase", result)]
      });
    }
  };
}

function createPhraseRemoveCommand(): SlashCommandDefinition {
  const data = createAdminSlashCommandBuilder()
    .setName("fraseremove")
    .setDescription("Remove uma frase customizada da rotacao.")
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName(PHRASE_ID_OPTION).setDescription("ID da frase customizada.").setRequired(true)
    );

  return {
    name: "fraseremove",
    description: "Remove uma frase customizada da rotacao.",
    data,
    async execute(interaction) {
      if (!(await requirePhraseAdmin(interaction))) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const result = await phraseModerationService.removePhrase({
        guildId: interaction.guildId!,
        actorUserId: interaction.user.id,
        id: interaction.options.getString(PHRASE_ID_OPTION, true)
      });

      await interaction.editReply({
        embeds: [buildPhraseMutationEmbed("Remover frase", result)]
      });
    }
  };
}

function createPhraseListCommand(): SlashCommandDefinition {
  const data = createAdminSlashCommandBuilder()
    .setName("fraselist")
    .setDescription("Lista frases base e customizadas.")
    .setDMPermission(false)
    .addStringOption((option) =>
      addActionChoices(
        option.setName(ACTION_OPTION).setDescription("Filtrar por action.").setRequired(false)
      )
    )
    .addStringOption((option) =>
      addCategoryChoices(
        option.setName(CATEGORY_OPTION).setDescription("Filtrar por categoria.").setRequired(false)
      )
    )
    .addIntegerOption((option) =>
      option
        .setName(LIMIT_OPTION)
        .setDescription("Quantidade de frases.")
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(false)
    );

  return {
    name: "fraselist",
    description: "Lista frases base e customizadas.",
    data,
    async execute(interaction) {
      if (!(await requirePhraseAdmin(interaction))) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const result = await phraseModerationService.listPhrases({
        guildId: interaction.guildId!,
        actorUserId: interaction.user.id,
        action: readAction(interaction, false),
        category: readCategory(interaction),
        take: interaction.options.getInteger(LIMIT_OPTION) ?? undefined
      });

      await interaction.editReply({
        embeds: [buildPhraseListEmbed(result)]
      });
    }
  };
}

async function requirePhraseAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const permission = adminPermissionService.canManagePhrases(interaction);

  if (permission.allowed) {
    return true;
  }

  await interaction.reply({
    content: permission.reason ?? "Voce nao pode usar comandos administrativos de frases.",
    ephemeral: true
  });
  return false;
}

function readAction(
  interaction: ChatInputCommandInteraction,
  required: boolean
): ActionName | undefined {
  const value = required
    ? interaction.options.getString(ACTION_OPTION, true)
    : interaction.options.getString(ACTION_OPTION);

  return (value as ActionName | null) ?? undefined;
}

function readCategory(interaction: ChatInputCommandInteraction): ActionCategory | undefined {
  return (interaction.options.getString(CATEGORY_OPTION) as ActionCategory | null) ?? undefined;
}

function addActionChoices(option: SlashCommandStringOption): SlashCommandStringOption {
  return option.addChoices(
    { name: "kiss", value: "kiss" },
    { name: "hug", value: "hug" },
    { name: "beijotesta", value: "beijotesta" },
    { name: "beijobochecha", value: "beijobochecha" },
    { name: "cafune", value: "cafune" },
    { name: "consolar", value: "consolar" },
    { name: "proteger", value: "proteger" },
    { name: "morder", value: "morder" },
    { name: "cutucar", value: "cutucar" }
  );
}

function addCategoryChoices(option: SlashCommandStringOption): SlashCommandStringOption {
  return option.addChoices(
    { name: "carinho_fofo", value: "carinho_fofo" },
    { name: "romance_leve", value: "romance_leve" },
    { name: "apoio_emocional", value: "apoio_emocional" },
    { name: "brincadeira", value: "brincadeira" }
  );
}
