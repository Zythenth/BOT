import { EmbedBuilder } from "discord.js";
import type {
  BlockStatus,
  PersonalDataEraseResult,
  PersonalDataSummary,
  UserPreferenceView
} from "../services";

export function buildPreferencesEmbed(
  preference: UserPreferenceView,
  blockStatus: BlockStatus
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf2a7b8)
    .setTitle("Preferencias de Privacidade")
    .addFields(
      {
        name: "Romance",
        value: preference.allowRomance ? "Permitido por opt-in" : "Sem opt-in",
        inline: true
      },
      {
        name: "Ranking",
        value: preference.hideFromRankings ? "Oculto" : "Visivel",
        inline: true
      },
      {
        name: "Afinidade",
        value: preference.optedOutOfAffinity ? "Opt-out ativo" : "Participando",
        inline: true
      },
      {
        name: "RP recebido",
        value: blockStatus.blocksAllRp ? "Bloqueado" : "Permitido",
        inline: true
      },
      {
        name: "Categorias bloqueadas",
        value: formatBlockedCategories(blockStatus.blockedCategories),
        inline: true
      },
      {
        name: "Usuarios bloqueados",
        value: blockStatus.blockedUserCount.toString(),
        inline: true
      }
    )
    .setTimestamp(new Date());
}

export function buildPersonalDataSummaryEmbed(summary: PersonalDataSummary): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf2a7b8)
    .setTitle("Meus dados na Aurora")
    .setDescription("Resumo privado dos dados ligados a sua conta.")
    .addFields(
      {
        name: "Interacoes RP",
        value: summary.counts.interactions.toString(),
        inline: true
      },
      {
        name: "Pares de afinidade",
        value: summary.counts.affinityPairs.toString(),
        inline: true
      },
      {
        name: "Bloqueios criados",
        value: summary.counts.blocks.toString(),
        inline: true
      },
      {
        name: "Botoes temporarios",
        value: summary.counts.buttonInteractionStates.toString(),
        inline: true
      },
      {
        name: "AdminLog retido",
        value: summary.counts.adminLogsRetained.toString(),
        inline: true
      },
      {
        name: "Preferencias",
        value: formatPersonalDataPreference(summary.preference),
        inline: false
      },
      {
        name: "Retencao",
        value: `${summary.retained.adminLogNote}\n${summary.retained.preservedPreferenceNote}`,
        inline: false
      }
    )
    .setTimestamp(new Date(summary.exportedAt));
}

export function buildPersonalDataEraseEmbed(result: PersonalDataEraseResult): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf2a7b8)
    .setTitle("Dados apagados")
    .setDescription("Removi seus dados pessoais de RP que podiam ser apagados com seguranca.")
    .addFields(
      {
        name: "Interacoes RP",
        value: result.deleted.interactions.toString(),
        inline: true
      },
      {
        name: "Pares de afinidade",
        value: result.deleted.affinityPairs.toString(),
        inline: true
      },
      {
        name: "Bloqueios criados",
        value: result.deleted.blocks.toString(),
        inline: true
      },
      {
        name: "Botoes temporarios",
        value: result.deleted.buttonInteractionStates.toString(),
        inline: true
      },
      {
        name: "Preferencia preservada",
        value: formatPersonalDataPreference(result.preservedPreference),
        inline: false
      },
      {
        name: "Retencao",
        value: `${result.retained.adminLogsRetained} AdminLog(s) retido(s). ${result.retained.adminLogNote}\n${result.retained.preservedPreferenceNote}`,
        inline: false
      }
    )
    .setTimestamp(new Date(result.erasedAt));
}

function formatBlockedCategories(categories: readonly string[]): string {
  if (categories.length === 0) {
    return "Nenhuma";
  }

  return categories.join(", ");
}

function formatPersonalDataPreference(
  preference: PersonalDataSummary["preference"] | PersonalDataEraseResult["preservedPreference"]
): string {
  if (!preference) {
    return "Nenhuma preferencia salva.";
  }

  const romance = preference.allowRomance ? "romance permitido" : "romance sem opt-in";
  const ranking = preference.hideFromRankings ? "ranking oculto" : "ranking visivel";
  const affinity = preference.optedOutOfAffinity ? "opt-out de afinidade" : "afinidade ativa";

  return `${romance}; ${ranking}; ${affinity}.`;
}
