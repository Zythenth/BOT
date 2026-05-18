import { EmbedBuilder } from "discord.js";
import type { AffinityPairSummary, AffinityRankingPage } from "../services";

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
      },
      {
        name: "Marco",
        value: summary.milestone.name,
        inline: true
      },
      {
        name: `<@${userOneId}> -> <@${userTwoId}>`,
        value: formatActionUsage(summary.actionBreakdown.fromUserOneToUserTwo),
        inline: false
      },
      {
        name: `<@${userTwoId}> -> <@${userOneId}>`,
        value: formatActionUsage(summary.actionBreakdown.fromUserTwoToUserOne),
        inline: false
      }
    )
    .setTimestamp(new Date());
}

export function buildAffinityRankingEmbed(ranking: AffinityRankingPage): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf2a7b8)
    .setTitle("Ranking de Afinidade")
    .setDescription(formatRanking(ranking))
    .setFooter({ text: formatRankingFooter(ranking) })
    .setTimestamp(new Date());
}

function formatRanking(ranking: AffinityRankingPage): string {
  if (!ranking.isEnabled) {
    return "O ranking de afinidade esta desativado neste servidor.";
  }

  if (ranking.entries.length === 0) {
    if (ranking.page > 1) {
      return "Nao ha pares de afinidade nesta pagina.";
    }

    return "Ainda nao ha pares de afinidade registrados neste servidor.";
  }

  return ranking.entries
    .map(
      (entry) =>
        `${entry.position}. <@${entry.userAId}> + <@${entry.userBId}> - ${entry.points} pontos | ${entry.milestone.name} | ${entry.interactionCount} interacoes`
    )
    .join("\n");
}

function formatRankingFooter(ranking: AffinityRankingPage): string {
  if (!ranking.isEnabled) {
    return "Ranking indisponivel";
  }

  return ranking.hasNextPage
    ? `Pagina ${ranking.page} | use a proxima pagina para ver mais`
    : `Pagina ${ranking.page}`;
}

function formatActionUsage(
  counts: AffinityPairSummary["actionBreakdown"]["fromUserOneToUserTwo"]
): string {
  return counts
    .map((entry) => `${entry.label}: ${entry.count}`)
    .join("\n");
}

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return "Ainda sem interacoes";
  }

  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}
