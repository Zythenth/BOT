import { EmbedBuilder } from "discord.js";
import type { AffinityPairSummary, AffinityRankingEntry } from "../services";

export function buildAffinitySummaryEmbed(
  userOneId: string,
  userTwoId: string,
  summary: AffinityPairSummary
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf2a7b8)
    .setTitle("Afinidade")
    .setDescription(`<@${userOneId}> e <@${userTwoId}>`)
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
}

export function buildAffinityRankingEmbed(ranking: readonly AffinityRankingEntry[]): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf2a7b8)
    .setTitle("Ranking de Afinidade")
    .setDescription(formatRanking(ranking))
    .setTimestamp(new Date());
}

function formatRanking(ranking: readonly AffinityRankingEntry[]): string {
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
