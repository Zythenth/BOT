import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from "discord.js";
import {
  blockService,
  preferenceService,
  type PrivacyBlockCategory
} from "../services";
import type { SlashCommandDefinition } from "../types";
import { buildPreferencesEmbed } from "./privacyResponseAdapter";

const USER_OPTION_NAME = "usuario";
const CATEGORY_OPTION_NAME = "categoria";
const BLOCK_OPTION_NAME = "bloquear";
const ALLOW_ROMANCE_OPTION_NAME = "permitir_romance";
const HIDE_RANKING_OPTION_NAME = "ocultar_ranking";

export const privacySlashCommands: SlashCommandDefinition[] = [
  createBlockRpCommand(),
  createUnblockRpCommand(),
  createBlockCategoryCommand(),
  createPreferencesCommand(),
  createOptOutCommand(),
  createOptInCommand()
];

function createBlockRpCommand(): SlashCommandDefinition {
  return {
    name: "bloquearrp",
    description: "Bloqueia interacoes RP recebidas.",
    data: new SlashCommandBuilder()
      .setName("bloquearrp")
      .setDescription("Bloqueia interacoes RP recebidas.")
      .setDMPermission(false)
      .addUserOption((option) =>
        option
          .setName(USER_OPTION_NAME)
          .setDescription("Usuario especifico para bloquear.")
          .setRequired(false)
      ),
    async execute(interaction) {
      const guildId = await requireGuildId(interaction);

      if (!guildId) {
        return;
      }

      const target = interaction.options.getUser(USER_OPTION_NAME);
      const result = target
        ? await blockService.blockUser(guildId, interaction.user.id, target.id)
        : await blockService.blockAllRp(guildId, interaction.user.id);

      await interaction.reply({
        content: result.message,
        ephemeral: true
      });
    }
  };
}

function createUnblockRpCommand(): SlashCommandDefinition {
  return {
    name: "desbloquearrp",
    description: "Reativa interacoes RP recebidas.",
    data: new SlashCommandBuilder()
      .setName("desbloquearrp")
      .setDescription("Reativa interacoes RP recebidas.")
      .setDMPermission(false)
      .addUserOption((option) =>
        option
          .setName(USER_OPTION_NAME)
          .setDescription("Usuario especifico para desbloquear.")
          .setRequired(false)
      ),
    async execute(interaction) {
      const guildId = await requireGuildId(interaction);

      if (!guildId) {
        return;
      }

      const target = interaction.options.getUser(USER_OPTION_NAME);
      const result = target
        ? await blockService.unblockUser(guildId, interaction.user.id, target.id)
        : await blockService.unblockAllRp(guildId, interaction.user.id);

      await interaction.reply({
        content: result.message,
        ephemeral: true
      });
    }
  };
}

function createBlockCategoryCommand(): SlashCommandDefinition {
  return {
    name: "bloquearcategoria",
    description: "Bloqueia ou libera uma categoria de RP recebida.",
    data: new SlashCommandBuilder()
      .setName("bloquearcategoria")
      .setDescription("Bloqueia ou libera uma categoria de RP recebida.")
      .setDMPermission(false)
      .addStringOption((option) =>
        option
          .setName(CATEGORY_OPTION_NAME)
          .setDescription("Categoria de RP.")
          .setRequired(true)
          .addChoices(
            { name: "Carinho fofo", value: "carinho_fofo" },
            { name: "Romance leve", value: "romance_leve" },
            { name: "Apoio emocional", value: "apoio_emocional" },
            { name: "Brincadeira", value: "brincadeira" }
          )
      )
      .addBooleanOption((option) =>
        option
          .setName(BLOCK_OPTION_NAME)
          .setDescription("Use false para liberar a categoria.")
          .setRequired(false)
      ),
    async execute(interaction) {
      const guildId = await requireGuildId(interaction);

      if (!guildId) {
        return;
      }

      const category = interaction.options.getString(
        CATEGORY_OPTION_NAME,
        true
      ) as PrivacyBlockCategory;
      const blocked = interaction.options.getBoolean(BLOCK_OPTION_NAME) ?? true;
      const result = await blockService.setCategoryBlock({
        guildId,
        blockerUserId: interaction.user.id,
        category,
        blocked
      });

      await interaction.reply({
        content: result.message,
        ephemeral: true
      });
    }
  };
}

function createPreferencesCommand(): SlashCommandDefinition {
  return {
    name: "preferencias",
    description: "Mostra ou atualiza suas preferencias pessoais.",
    data: new SlashCommandBuilder()
      .setName("preferencias")
      .setDescription("Mostra ou atualiza suas preferencias pessoais.")
      .setDMPermission(false)
      .addBooleanOption((option) =>
        option
          .setName(ALLOW_ROMANCE_OPTION_NAME)
          .setDescription("Permitir participar de acoes romanticas leves.")
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName(HIDE_RANKING_OPTION_NAME)
          .setDescription("Ocultar seus dados dos rankings publicos.")
          .setRequired(false)
      ),
    async execute(interaction) {
      const guildId = await requireGuildId(interaction);

      if (!guildId) {
        return;
      }

      const allowRomance = interaction.options.getBoolean(ALLOW_ROMANCE_OPTION_NAME);
      const hideFromRankings = interaction.options.getBoolean(HIDE_RANKING_OPTION_NAME);
      const preference =
        allowRomance === null && hideFromRankings === null
          ? await preferenceService.getOrCreate(interaction.user.id)
          : await preferenceService.update({
              userId: interaction.user.id,
              allowRomance: allowRomance ?? undefined,
              hideFromRankings: hideFromRankings ?? undefined
            });
      const blockStatus = await blockService.getStatus(guildId, interaction.user.id);

      await interaction.reply({
        embeds: [buildPreferencesEmbed(preference, blockStatus)],
        ephemeral: true
      });
    }
  };
}

function createOptOutCommand(): SlashCommandDefinition {
  return {
    name: "optout",
    description: "Sai do sistema de afinidade e ranking.",
    data: new SlashCommandBuilder()
      .setName("optout")
      .setDescription("Sai do sistema de afinidade e ranking.")
      .setDMPermission(false),
    async execute(interaction) {
      await preferenceService.optOut(interaction.user.id);
      await interaction.reply({
        content: "Opt-out ativado. Voce nao pontuara afinidade nem aparecera em rankings.",
        ephemeral: true
      });
    }
  };
}

function createOptInCommand(): SlashCommandDefinition {
  return {
    name: "optin",
    description: "Volta ao sistema de afinidade e ranking.",
    data: new SlashCommandBuilder()
      .setName("optin")
      .setDescription("Volta ao sistema de afinidade e ranking.")
      .setDMPermission(false),
    async execute(interaction) {
      await preferenceService.optIn(interaction.user.id);
      await interaction.reply({
        content: "Opt-in ativado. Voce voltou ao sistema de afinidade e ranking.",
        ephemeral: true
      });
    }
  };
}

async function requireGuildId(interaction: ChatInputCommandInteraction): Promise<string | null> {
  if (interaction.guildId) {
    return interaction.guildId;
  }

  await interaction.reply({
    content: "Use este comando em um servidor.",
    ephemeral: true
  });

  return null;
}
