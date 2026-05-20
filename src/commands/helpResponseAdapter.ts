import { EmbedBuilder } from "discord.js";
import { RP_ACTION_DEFINITIONS } from "../config";

export function buildHelpEmbed(prefix = "-"): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf2a7b8)
    .setTitle("Aurora - comandos do MVP")
    .addFields(
      {
        name: "Carinho",
        value: formatCommandsByCategory("carinho_fofo", prefix)
      },
      {
        name: "Romance",
        value: formatCommandsByCategory("romance_leve", prefix)
      },
      {
        name: "Apoio",
        value: formatCommandsByCategory("apoio_emocional", prefix)
      },
      {
        name: "Brincadeira",
        value: formatCommandsByCategory("brincadeira", prefix)
      },
      {
        name: "Afinidade",
        value: formatCommandPair("afinidade", prefix) + ", " + formatCommandPair("rankafinidade", prefix)
      },
      {
        name: "Ajuda",
        value: formatCommandPair("help", prefix)
      },
      {
        name: "Privacidade",
        value:
          "`/bloquearrp`, `/desbloquearrp`, `/bloquearcategoria`, `/preferencias`, `/optout`, `/optin`, `/meusdados`, `/exportardados`, `/apagardados`"
      },
      {
        name: "Admin GIFs",
        value:
          "`/gifadd`, `/gifbuscar`, `/gifaprovar`, `/gifbloquear`, `/gifremove`, `/gifmover`, `/giflist`, `/giftest`"
      },
      {
        name: "Admin frases",
        value: "`/fraseadd`, `/fraseremove`, `/fraselist`"
      },
      {
        name: "Config",
        value: "`/config prefixo`, `/config afinidade`, `/config gifs`, `/config categoria`, `/config canal`, `/config cooldown`, `/config idioma`, `/config mencionar`, `/config rank`, `/config reset`"
      }
    )
    .setFooter({ text: `Prefixo atual: ${prefix}` })
    .setTimestamp(new Date());
}

function formatCommandsByCategory(category: string, prefix: string): string {
  return RP_ACTION_DEFINITIONS
    .filter((definition) => definition.category === category)
    .map((definition) => formatCommandPair(definition.commandName, prefix))
    .join(", ");
}

function formatCommandPair(commandName: string, prefix: string): string {
  return `\`/${commandName}\` ou \`${prefix}${commandName}\``;
}
