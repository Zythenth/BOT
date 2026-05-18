import { EmbedBuilder } from "discord.js";
import type { BlockStatus, UserPreferenceView } from "../services";

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

function formatBlockedCategories(categories: readonly string[]): string {
  if (categories.length === 0) {
    return "Nenhuma";
  }

  return categories.join(", ");
}
