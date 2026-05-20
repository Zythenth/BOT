import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type SlashCommandStringOption
} from "discord.js";
import { adminPermissionService, gifModerationService } from "../services";
import type { ActionCategory, ActionName, SlashCommandDefinition } from "../types";
import type { GifStatus } from "../database";
import {
  buildGifListEmbed,
  buildGifMutationEmbed,
  buildGifSearchEmbed,
  buildGifTestEmbed
} from "./gifAdminResponseAdapter";

const GIF_ID_OPTION = "id";
const PROVIDER_GIF_ID_OPTION = "provider_gif_id";
const PROVIDER_OPTION = "provider";
const ACTION_OPTION = "action";
const CATEGORY_OPTION = "category";
const STATUS_OPTION = "status";
const RATING_OPTION = "rating";
const NOTES_OPTION = "notes";
const SEARCH_TERM_OPTION = "termo";
const LIMIT_OPTION = "limite";
const PAGE_URL_OPTION = "page_url";

export const gifAdminSlashCommands: SlashCommandDefinition[] = [
  createGifAddCommand(),
  createGifSearchCommand(),
  createGifApproveCommand(),
  createGifBlockCommand(),
  createGifRemoveCommand(),
  createGifMoveCommand(),
  createGifListCommand(),
  createGifTestCommand()
];

function createGifAddCommand(): SlashCommandDefinition {
  const data = new SlashCommandBuilder()
    .setName("gifadd")
    .setDescription("Adiciona um GIF manualmente para moderacao.")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName(PROVIDER_GIF_ID_OPTION)
        .setDescription("ID do GIF no provider.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      addActionChoices(option.setName(ACTION_OPTION).setDescription("Acao do GIF.").setRequired(true))
    )
    .addStringOption((option) =>
      addCategoryChoices(
        option.setName(CATEGORY_OPTION).setDescription("Categoria do GIF.").setRequired(true)
      )
    )
    .addStringOption((option) =>
      addProviderChoices(option.setName(PROVIDER_OPTION).setDescription("Provider do GIF.").setRequired(false))
    )
    .addStringOption((option) =>
      addStatusChoices(option.setName(STATUS_OPTION).setDescription("Status inicial.").setRequired(false))
    )
    .addStringOption((option) =>
      addRatingChoices(option.setName(RATING_OPTION).setDescription("Rating do GIF.").setRequired(false))
    )
    .addStringOption((option) =>
      option
        .setName(PAGE_URL_OPTION)
        .setDescription("Pagina da GIPHY, se houver.")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option.setName(NOTES_OPTION).setDescription("Notas internas.").setRequired(false).setMaxLength(500)
    );

  return {
    name: "gifadd",
    description: "Adiciona um GIF manualmente para moderacao.",
    data,
    async execute(interaction) {
      if (!(await requireGifAdmin(interaction))) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const result = await gifModerationService.addManualGif({
        guildId: interaction.guildId!,
        actorUserId: interaction.user.id,
        provider: readProvider(interaction),
        providerGifId: interaction.options.getString(PROVIDER_GIF_ID_OPTION, true),
        action: readAction(interaction, true)!,
        category: readCategory(interaction, true)!,
        status: readStatus(interaction),
        rating: interaction.options.getString(RATING_OPTION) ?? undefined,
        giphyPageUrl: interaction.options.getString(PAGE_URL_OPTION) ?? undefined,
        notes: interaction.options.getString(NOTES_OPTION) ?? undefined
      });

      await interaction.editReply({
        embeds: [buildGifMutationEmbed("Adicionar GIF", result)]
      });
    }
  };
}

function createGifSearchCommand(): SlashCommandDefinition {
  const data = new SlashCommandBuilder()
    .setName("gifbuscar")
    .setDescription("Busca GIFs na GIPHY e salva no banco para moderacao.")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName(SEARCH_TERM_OPTION)
        .setDescription("Termo de busca na GIPHY.")
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption((option) =>
      addActionChoices(option.setName(ACTION_OPTION).setDescription("Acao para salvar.").setRequired(true))
    )
    .addStringOption((option) =>
      addCategoryChoices(
        option.setName(CATEGORY_OPTION).setDescription("Categoria para salvar.").setRequired(true)
      )
    )
    .addIntegerOption((option) =>
      option
        .setName(LIMIT_OPTION)
        .setDescription("Quantidade de resultados para importar.")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    )
    .addStringOption((option) =>
      addStatusChoices(option.setName(STATUS_OPTION).setDescription("Status inicial.").setRequired(false))
    );

  return {
    name: "gifbuscar",
    description: "Busca GIFs na GIPHY e salva no banco para moderacao.",
    data,
    async execute(interaction) {
      if (!(await requireGifAdmin(interaction))) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const result = await gifModerationService.searchGiphy({
        guildId: interaction.guildId!,
        actorUserId: interaction.user.id,
        searchTerm: interaction.options.getString(SEARCH_TERM_OPTION, true),
        action: readAction(interaction, true)!,
        category: readCategory(interaction, true)!,
        limit: interaction.options.getInteger(LIMIT_OPTION) ?? undefined,
        status: readStatus(interaction)
      });

      await interaction.editReply({
        embeds: [buildGifSearchEmbed(result)]
      });
    }
  };
}

function createGifApproveCommand(): SlashCommandDefinition {
  const data = new SlashCommandBuilder()
    .setName("gifaprovar")
    .setDescription("Aprova um GIF para uso em RP.")
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName(GIF_ID_OPTION).setDescription("ID interno do GIF.").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName(NOTES_OPTION).setDescription("Notas internas.").setRequired(false).setMaxLength(500)
    );

  return {
    name: "gifaprovar",
    description: "Aprova um GIF para uso em RP.",
    data,
    async execute(interaction) {
      if (!(await requireGifAdmin(interaction))) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await gifModerationService.approve(readGifStatusChangeInput(interaction));

      await interaction.editReply({
        embeds: [buildGifMutationEmbed("Aprovar GIF", result)]
      });
    }
  };
}

function createGifBlockCommand(): SlashCommandDefinition {
  const data = new SlashCommandBuilder()
    .setName("gifbloquear")
    .setDescription("Bloqueia um GIF para impedir uso em RP.")
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName(GIF_ID_OPTION).setDescription("ID interno do GIF.").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName(NOTES_OPTION).setDescription("Motivo interno.").setRequired(false).setMaxLength(500)
    );

  return {
    name: "gifbloquear",
    description: "Bloqueia um GIF para impedir uso em RP.",
    data,
    async execute(interaction) {
      if (!(await requireGifAdmin(interaction))) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await gifModerationService.block(readGifStatusChangeInput(interaction));

      await interaction.editReply({
        embeds: [buildGifMutationEmbed("Bloquear GIF", result)]
      });
    }
  };
}

function createGifRemoveCommand(): SlashCommandDefinition {
  const data = new SlashCommandBuilder()
    .setName("gifremove")
    .setDescription("Desativa um GIF logicamente.")
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName(GIF_ID_OPTION).setDescription("ID interno do GIF.").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName(NOTES_OPTION).setDescription("Notas internas.").setRequired(false).setMaxLength(500)
    );

  return {
    name: "gifremove",
    description: "Desativa um GIF logicamente.",
    data,
    async execute(interaction) {
      if (!(await requireGifAdmin(interaction))) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await gifModerationService.remove(readGifStatusChangeInput(interaction));

      await interaction.editReply({
        embeds: [buildGifMutationEmbed("Remover GIF", result)]
      });
    }
  };
}

function createGifMoveCommand(): SlashCommandDefinition {
  const data = new SlashCommandBuilder()
    .setName("gifmover")
    .setDescription("Move um GIF para outra action e/ou category.")
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName(GIF_ID_OPTION).setDescription("ID interno do GIF.").setRequired(true)
    )
    .addStringOption((option) =>
      addActionChoices(option.setName(ACTION_OPTION).setDescription("Nova acao.").setRequired(false))
    )
    .addStringOption((option) =>
      addCategoryChoices(option.setName(CATEGORY_OPTION).setDescription("Nova categoria.").setRequired(false))
    );

  return {
    name: "gifmover",
    description: "Move um GIF para outra action e/ou category.",
    data,
    async execute(interaction) {
      if (!(await requireGifAdmin(interaction))) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await gifModerationService.move({
        guildId: interaction.guildId!,
        actorUserId: interaction.user.id,
        id: interaction.options.getString(GIF_ID_OPTION, true),
        action: readAction(interaction, false),
        category: readCategory(interaction, false)
      });

      await interaction.editReply({
        embeds: [buildGifMutationEmbed("Mover GIF", result)]
      });
    }
  };
}

function createGifListCommand(): SlashCommandDefinition {
  const data = new SlashCommandBuilder()
    .setName("giflist")
    .setDescription("Lista GIFs cadastrados com filtros.")
    .setDMPermission(false)
    .addStringOption((option) =>
      addActionChoices(option.setName(ACTION_OPTION).setDescription("Filtrar por acao.").setRequired(false))
    )
    .addStringOption((option) =>
      addCategoryChoices(option.setName(CATEGORY_OPTION).setDescription("Filtrar por categoria.").setRequired(false))
    )
    .addStringOption((option) =>
      addStatusChoices(option.setName(STATUS_OPTION).setDescription("Filtrar por status.").setRequired(false))
    )
    .addStringOption((option) =>
      addProviderChoices(option.setName(PROVIDER_OPTION).setDescription("Filtrar por provider.").setRequired(false))
    )
    .addIntegerOption((option) =>
      option
        .setName(LIMIT_OPTION)
        .setDescription("Quantidade de registros.")
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    );

  return {
    name: "giflist",
    description: "Lista GIFs cadastrados com filtros.",
    data,
    async execute(interaction) {
      if (!(await requireGifAdmin(interaction))) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const filters = {
        guildId: interaction.guildId!,
        actorUserId: interaction.user.id,
        action: readAction(interaction, false),
        category: readCategory(interaction, false),
        status: readStatus(interaction),
        provider: readProvider(interaction),
        take: interaction.options.getInteger(LIMIT_OPTION) ?? undefined
      };
      const result = await gifModerationService.list(filters);

      await interaction.editReply({
        embeds: [buildGifListEmbed(result, filters)]
      });
    }
  };
}

function createGifTestCommand(): SlashCommandDefinition {
  const data = new SlashCommandBuilder()
    .setName("giftest")
    .setDescription("Testa o sorteio real de GIF para action/category.")
    .setDMPermission(false)
    .addStringOption((option) =>
      addActionChoices(option.setName(ACTION_OPTION).setDescription("Acao do teste.").setRequired(true))
    )
    .addStringOption((option) =>
      addCategoryChoices(option.setName(CATEGORY_OPTION).setDescription("Categoria do teste.").setRequired(true))
    );

  return {
    name: "giftest",
    description: "Testa o sorteio real de GIF para action/category.",
    data,
    async execute(interaction) {
      if (!(await requireGifAdmin(interaction))) {
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await gifModerationService.testSelection({
        guildId: interaction.guildId!,
        actorUserId: interaction.user.id,
        action: readAction(interaction, true)!,
        category: readCategory(interaction, true)!
      });

      await interaction.editReply({
        embeds: [buildGifTestEmbed(result)]
      });
    }
  };
}

async function requireGifAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const permission = adminPermissionService.canManageGifs(interaction);

  if (permission.allowed) {
    return true;
  }

  await interaction.reply({
    content: permission.reason ?? "Voce nao pode usar comandos administrativos de GIF.",
    ephemeral: true
  });
  return false;
}

function readGifStatusChangeInput(interaction: ChatInputCommandInteraction) {
  return {
    guildId: interaction.guildId!,
    actorUserId: interaction.user.id,
    id: interaction.options.getString(GIF_ID_OPTION, true),
    notes: interaction.options.getString(NOTES_OPTION) ?? undefined
  };
}

function readAction(interaction: ChatInputCommandInteraction, required: boolean): ActionName | undefined {
  const value = required
    ? interaction.options.getString(ACTION_OPTION, true)
    : interaction.options.getString(ACTION_OPTION);

  return (value as ActionName | null) ?? undefined;
}

function readCategory(
  interaction: ChatInputCommandInteraction,
  required: boolean
): ActionCategory | undefined {
  const value = required
    ? interaction.options.getString(CATEGORY_OPTION, true)
    : interaction.options.getString(CATEGORY_OPTION);

  return (value as ActionCategory | null) ?? undefined;
}

function readStatus(interaction: ChatInputCommandInteraction): GifStatus | undefined {
  return (interaction.options.getString(STATUS_OPTION) as GifStatus | null) ?? undefined;
}

function readProvider(interaction: ChatInputCommandInteraction): "giphy" | undefined {
  return (interaction.options.getString(PROVIDER_OPTION) as "giphy" | null) ?? undefined;
}

function addActionChoices(option: SlashCommandStringOption): SlashCommandStringOption {
  return option.addChoices(
    { name: "kiss", value: "kiss" },
    { name: "hug", value: "hug" },
    { name: "beijotesta", value: "beijotesta" },
    { name: "beijobochecha", value: "beijobochecha" },
    { name: "cafune", value: "cafune" },
    { name: "consolar", value: "consolar" },
    { name: "proteger", value: "proteger" },
    { name: "morder", value: "morder" },
    { name: "cutucar", value: "cutucar" }
  );
}

function addCategoryChoices(option: SlashCommandStringOption): SlashCommandStringOption {
  return option.addChoices(
    { name: "carinho_fofo", value: "carinho_fofo" },
    { name: "romance_leve", value: "romance_leve" },
    { name: "apoio_emocional", value: "apoio_emocional" },
    { name: "brincadeira", value: "brincadeira" }
  );
}

function addStatusChoices(option: SlashCommandStringOption): SlashCommandStringOption {
  return option.addChoices(
    { name: "pending", value: "pending" },
    { name: "approved", value: "approved" },
    { name: "blocked", value: "blocked" },
    { name: "disabled", value: "disabled" },
    { name: "uncategorized", value: "uncategorized" }
  );
}

function addProviderChoices(option: SlashCommandStringOption): SlashCommandStringOption {
  return option.addChoices({ name: "giphy", value: "giphy" });
}

function addRatingChoices(option: SlashCommandStringOption): SlashCommandStringOption {
  return option.addChoices(
    { name: "g", value: "g" },
    { name: "pg", value: "pg" },
    { name: "pg-13", value: "pg-13" },
    { name: "r", value: "r" }
  );
}
