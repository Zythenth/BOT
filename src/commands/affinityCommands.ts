import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { affinityQueryService, rankingService } from "../services";
import type { SlashCommandDefinition } from "../types";
import { buildAffinityRankingEmbed, buildAffinitySummaryEmbed } from "./affinityResponseAdapter";

const USER_OPTION_NAME = "usuario";
const PAGE_OPTION_NAME = "pagina";

export const affinityCommand: SlashCommandDefinition = {
  name: "afinidade",
  description: "Mostra a afinidade entre voce e outro usuario.",
  data: new SlashCommandBuilder()
    .setName("afinidade")
    .setDescription("Mostra a afinidade entre voce e outro usuario.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName(USER_OPTION_NAME).setDescription("Usuario para consultar.").setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "A afinidade so pode ser consultada em servidores.",
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser(USER_OPTION_NAME, true);
    const summary = await affinityQueryService.getPairSummary(
      interaction.guildId,
      interaction.user.id,
      target.id
    );

    await interaction.editReply({
      embeds: [buildAffinitySummaryEmbed(interaction.user.id, target.id, summary)]
    });
  }
};

export const rankAffinityCommand: SlashCommandDefinition = {
  name: "rankafinidade",
  description: "Mostra o ranking de afinidade do servidor.",
  data: new SlashCommandBuilder()
    .setName("rankafinidade")
    .setDescription("Mostra o ranking de afinidade do servidor.")
    .addIntegerOption((option) =>
      option
        .setName(PAGE_OPTION_NAME)
        .setDescription("Pagina do ranking.")
        .setMinValue(1)
        .setRequired(false)
    )
    .setDMPermission(false),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "O ranking de afinidade so pode ser consultado em servidores.",
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();
    const ranking = await rankingService.getGuildPairRanking({
      guildId: interaction.guildId,
      page: interaction.options.getInteger(PAGE_OPTION_NAME) ?? 1
    });

    await interaction.editReply({ embeds: [buildAffinityRankingEmbed(ranking)] });
  }
};
