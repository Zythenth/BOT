import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { affinityQueryService } from "../services";
import type { SlashCommandDefinition } from "../types";

const USER_OPTION_NAME = "usuario";

export const affinityCommand: SlashCommandDefinition = {
  name: "afinidade",
  description: "Mostra a afinidade entre voce e outro usuario.",
  data: new SlashCommandBuilder()
    .setName("afinidade")
    .setDescription("Mostra a afinidade entre voce e outro usuario.")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName(USER_OPTION_NAME)
        .setDescription("Usuario para consultar.")
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "A afinidade so pode ser consultada em servidores.",
        ephemeral: true
      });
      return;
    }

    const target = interaction.options.getUser(USER_OPTION_NAME, true);
    const summary = await affinityQueryService.getPairSummary(
      interaction.guildId,
      interaction.user.id,
      target.id
    );

    const embed = new EmbedBuilder()
      .setColor(0xf2a7b8)
      .setTitle("Afinidade")
      .setDescription(`<@${interaction.user.id}> e <@${target.id}>`)
      .addFields(
        {
          name: "Pontos",
          value: summary.points.toString(),
          inline: true
        },
        {
          name: "Interacoes",
          value: summary.interactionCount.toString(),
          inline: true
        },
        {
          name: "Ultima interacao",
          value: formatDate(summary.lastInteractionAt),
          inline: true
        }
      )
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [embed] });
  }
};

export const rankAffinityCommand: SlashCommandDefinition = {
  name: "rankafinidade",
  description: "Mostra o ranking de afinidade do servidor.",
  data: new SlashCommandBuilder()
    .setName("rankafinidade")
    .setDescription("Mostra o ranking de afinidade do servidor.")
    .setDMPermission(false),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "O ranking de afinidade so pode ser consultado em servidores.",
        ephemeral: true
      });
      return;
    }

    const ranking = await affinityQueryService.getGuildRanking(interaction.guildId, 10);

    const embed = new EmbedBuilder()
      .setColor(0xf2a7b8)
      .setTitle("Ranking de Afinidade")
      .setDescription(formatRanking(ranking))
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [embed] });
  }
};

function formatRanking(
  ranking: Awaited<ReturnType<typeof affinityQueryService.getGuildRanking>>
): string {
  if (ranking.length === 0) {
    return "Ainda nao ha pares de afinidade registrados neste servidor.";
  }

  return ranking
    .map(
      (entry) =>
        `${entry.position}. <@${entry.userAId}> + <@${entry.userBId}> - ${entry.points} pontos (${entry.interactionCount} interacoes)`
    )
    .join("\n");
}

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return "Ainda sem interacoes";
  }

  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}
