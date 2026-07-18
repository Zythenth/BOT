import { EmbedBuilder, type ColorResolvable } from "discord.js";
import type { Gif } from "@prisma/client";
import type {
  GifSearchModerationResult,
  GifModerationResult,
  GifTestResult,
  ImportedGifSummary,
  ListModerationGifsInput
} from "../services";

const SUCCESS_COLOR: ColorResolvable = 0x8bd3a7;
const WARNING_COLOR: ColorResolvable = 0xf2c66d;
const ERROR_COLOR: ColorResolvable = 0xe57373;

export function buildGifMutationEmbed(
  title: string,
  result: GifModerationResult<Gif | ImportedGifSummary>
): EmbedBuilder {
  if (!result.ok) {
    return baseEmbed(title, ERROR_COLOR).setDescription(result.message);
  }

  const gif = "gif" in result.data ? result.data.gif : result.data;

  return baseEmbed(title, SUCCESS_COLOR)
    .setDescription(result.message)
    .addFields(formatGifFields(gif));
}

export function buildGifSearchEmbed(
  result: GifModerationResult<GifSearchModerationResult>
): EmbedBuilder {
  if (!result.ok) {
    return baseEmbed("Busca de GIFs", ERROR_COLOR).setDescription(result.message);
  }

  const created = result.data.items.filter((item) => item.created).length;

  return baseEmbed("Busca de GIFs", SUCCESS_COLOR)
    .setDescription(
      `${result.message} Novos: ${created}. Duplicados: ${result.data.duplicateCount}.`
    )
    .addFields({
      name: "Resultados",
      value: formatImportedGifs(result.data.items)
    });
}

export function buildGifListEmbed(
  result: GifModerationResult<Gif[]>,
  filters: Pick<ListModerationGifsInput, "action" | "category" | "status" | "provider">
): EmbedBuilder {
  if (!result.ok) {
    return baseEmbed("Lista de GIFs", ERROR_COLOR).setDescription(result.message);
  }

  return baseEmbed("Lista de GIFs", SUCCESS_COLOR)
    .setDescription(formatFilters(filters))
    .addFields(formatGifRowFields(result.data));
}

export function buildGifTestEmbed(result: GifModerationResult<GifTestResult>): EmbedBuilder {
  if (!result.ok) {
    return baseEmbed("Teste de GIF", ERROR_COLOR).setDescription(result.message);
  }

  const embed = baseEmbed(
    "Teste de GIF",
    result.data.selection ? SUCCESS_COLOR : WARNING_COLOR
  ).setDescription(result.message);

  if (result.data.storedGif) {
    embed.addFields(formatGifFields(result.data.storedGif));
  }

  if (result.data.selection?.imageUrl) {
    embed.setImage(result.data.selection.imageUrl);
    embed.setFooter({
      text: "Preview transiente da GIPHY; o bot salva providerGifId e metadados."
    });
  }

  return embed;
}

function baseEmbed(title: string, color: ColorResolvable): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setTitle(title).setTimestamp(new Date());
}

function formatGifFields(gif: Gif) {
  return [
    {
      name: "ID interno",
      value: `\`${gif.id}\``,
      inline: false
    },
    {
      name: "Provider",
      value: `\`${gif.provider}\``,
      inline: true
    },
    {
      name: "Provider GIF ID",
      value: `\`${gif.providerGifId}\``,
      inline: true
    },
    {
      name: "Action / category",
      value: `\`${gif.action}\` / \`${gif.category}\``,
      inline: false
    },
    {
      name: "Status",
      value: `\`${gif.status}\``,
      inline: true
    },
    {
      name: "Usos",
      value: String(gif.timesUsed),
      inline: true
    }
  ];
}

function formatImportedGifs(items: ImportedGifSummary[]): string {
  if (items.length === 0) {
    return "Nenhum resultado retornado.";
  }

  return truncateFieldValue(
    items
      .slice(0, 10)
      .map((item, index) => {
        const marker = item.created ? "novo" : "duplicado";
        return `${index + 1}. \`${item.gif.id}\` (${marker}) - ${item.gif.action}/${item.gif.category} - ${item.gif.status} - \`${item.gif.providerGifId}\``;
      })
      .join("\n")
  );
}

function formatGifRowFields(gifs: Gif[]) {
  if (gifs.length === 0) {
    return [
      {
        name: "GIFs",
        value: "Nenhum GIF encontrado com esses filtros."
      }
    ];
  }

  return chunk(gifs, 8).map((group, groupIndex) => ({
    name: groupIndex === 0 ? "GIFs" : "GIFs (continua)",
    value: truncateFieldValue(
      group
        .map((gif, index) => {
          const position = groupIndex * 8 + index + 1;
          return `${position}. \`${gif.id}\` - ${gif.action}/${gif.category} - ${gif.status} - ${gif.provider}:\`${gif.providerGifId}\` - usos ${gif.timesUsed}`;
        })
        .join("\n")
    )
  }));
}

function formatFilters(
  filters: Pick<ListModerationGifsInput, "action" | "category" | "status" | "provider">
): string {
  const activeFilters = [
    filters.action ? `action=${filters.action}` : undefined,
    filters.category ? `category=${filters.category}` : undefined,
    filters.status ? `status=${filters.status}` : undefined,
    filters.provider ? `provider=${filters.provider}` : undefined
  ].filter(Boolean);

  return activeFilters.length > 0
    ? `Filtros: ${activeFilters.join(", ")}`
    : "Sem filtros adicionais.";
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
