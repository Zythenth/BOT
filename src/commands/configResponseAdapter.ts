import { EmbedBuilder, type ColorResolvable } from "discord.js";
import type { GuildConfigResult } from "../services";

const SUCCESS_COLOR: ColorResolvable = 0x8bd3a7;
const ERROR_COLOR: ColorResolvable = 0xe57373;

export function buildConfigResultEmbed(result: GuildConfigResult): EmbedBuilder {
  if (!result.ok) {
    return new EmbedBuilder()
      .setColor(ERROR_COLOR)
      .setTitle("Configuracao")
      .setDescription(result.message)
      .setTimestamp(new Date());
  }

  return new EmbedBuilder()
    .setColor(SUCCESS_COLOR)
    .setTitle("Configuracao atualizada")
    .setDescription(result.message)
    .addFields(
      {
        name: "Prefixo",
        value: `\`${result.config.prefix}\``,
        inline: true
      },
      {
        name: "Afinidade",
        value: formatBoolean(result.config.affinityEnabled),
        inline: true
      },
      {
        name: "GIFs",
        value: formatBoolean(result.config.gifsEnabled),
        inline: true
      },
      {
        name: "Cooldown",
        value: result.config.cooldownEnabled
          ? `${result.config.cooldownSeconds}s`
          : "desativado",
        inline: true
      },
      {
        name: "Idioma",
        value: result.config.locale,
        inline: true
      },
      {
        name: "Mencionar",
        value: formatBoolean(result.config.mentionUsers),
        inline: true
      },
      {
        name: "Ranking",
        value: formatBoolean(result.config.rankingEnabled),
        inline: true
      },
      {
        name: "Categorias desativadas",
        value: formatList(result.config.disabledCategories),
        inline: false
      },
      {
        name: "Canais permitidos",
        value: result.config.allowedChannelIds.length > 0
          ? result.config.allowedChannelIds.map((channelId) => `<#${channelId}>`).join(", ")
          : "todos",
        inline: false
      }
    )
    .setTimestamp(new Date());
}

function formatBoolean(value: boolean): string {
  return value ? "ativado" : "desativado";
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "nenhuma";
}
