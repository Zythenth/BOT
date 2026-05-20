import { EmbedBuilder, type ColorResolvable } from "discord.js";
import type { Phrase } from "@prisma/client";
import type {
  PhraseListResult,
  PhraseModerationResult
} from "../services";

const SUCCESS_COLOR: ColorResolvable = 0x8bd3a7;
const ERROR_COLOR: ColorResolvable = 0xe57373;

export function buildPhraseMutationEmbed(
  title: string,
  result: PhraseModerationResult<Phrase>
): EmbedBuilder {
  if (!result.ok) {
    return baseEmbed(title, ERROR_COLOR).setDescription(result.message);
  }

  return baseEmbed(title, SUCCESS_COLOR)
    .setDescription(result.message)
    .addFields(
      {
        name: "ID",
        value: `\`${result.data.id}\``
      },
      {
        name: "Action / category",
        value: `\`${result.data.action}\` / \`${result.data.category}\``
      },
      {
        name: "Frase",
        value: result.data.text
      }
    );
}

export function buildPhraseListEmbed(
  result: PhraseModerationResult<PhraseListResult>
): EmbedBuilder {
  if (!result.ok) {
    return baseEmbed("Lista de frases", ERROR_COLOR).setDescription(result.message);
  }

  return baseEmbed("Lista de frases", SUCCESS_COLOR)
    .setDescription(`Base JSON: ${result.data.baseCount}. Customizadas: ${result.data.customCount}.`)
    .addFields(formatPhraseFields(result.data));
}

function baseEmbed(title: string, color: ColorResolvable): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setTimestamp(new Date());
}

function formatPhraseFields(result: PhraseListResult) {
  if (result.items.length === 0) {
    return [
      {
        name: "Frases",
        value: "Nenhuma frase encontrada com esses filtros."
      }
    ];
  }

  return chunk(result.items, 8).map((group, groupIndex) => ({
    name: groupIndex === 0 ? "Frases" : "Frases (continua)",
    value: truncateFieldValue(
      group
        .map((item, index) => {
          const position = groupIndex * 8 + index + 1;
          const source = item.source === "base" ? "base" : "custom";
          return `${position}. [${source}] \`${item.id}\` - ${item.action}/${item.category}\n${item.text}`;
        })
        .join("\n")
    )
  }));
}

function truncateFieldValue(value: string): string {
  if (value.length <= 1000) {
    return value;
  }

  return `${value.slice(0, 997)}...`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
