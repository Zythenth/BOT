import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type SlashCommandStringOption
} from "discord.js";
import { SUPPORTED_GUILD_LOCALES, type SupportedGuildLocale } from "../config";
import { adminPermissionService, guildConfigService, type GuildConfigResult } from "../services";
import type { ActionCategory, SlashCommandDefinition } from "../types";
import { buildConfigResultEmbed } from "./configResponseAdapter";

const ACTIVE_OPTION = "ativo";
const PREFIX_OPTION = "valor";
const CATEGORY_OPTION = "categoria";
const CHANNEL_OPTION = "canal";
const SECONDS_OPTION = "segundos";
const LOCALE_OPTION = "idioma";
const CONFIRMATION_OPTION = "confirmacao";
const RESET_CONFIRMATION = "CONFIRMAR";

export const configCommand: SlashCommandDefinition = {
  name: "config",
  description: "Configura a Aurora neste servidor.",
  data: new SlashCommandBuilder()
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setName("config")
    .setDescription("Configura a Aurora neste servidor.")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("prefixo")
        .setDescription("Altera o prefixo dos comandos por mensagem.")
        .addStringOption((option) =>
          option
            .setName(PREFIX_OPTION)
            .setDescription("Novo prefixo, com 1 a 5 caracteres.")
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(5)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("afinidade")
        .setDescription("Ativa ou desativa pontos de afinidade.")
        .addBooleanOption((option) =>
          option.setName(ACTIVE_OPTION).setDescription("Novo estado.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("gifs")
        .setDescription("Ativa ou desativa GIFs nas respostas de RP.")
        .addBooleanOption((option) =>
          option.setName(ACTIVE_OPTION).setDescription("Novo estado.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("categoria")
        .setDescription("Ativa ou desativa uma categoria de RP.")
        .addStringOption((option) =>
          addCategoryChoices(
            option.setName(CATEGORY_OPTION).setDescription("Categoria.").setRequired(true)
          )
        )
        .addBooleanOption((option) =>
          option.setName(ACTIVE_OPTION).setDescription("Novo estado.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("canal")
        .setDescription("Adiciona ou remove um canal da lista permitida.")
        .addChannelOption((option) =>
          option
            .setName(CHANNEL_OPTION)
            .setDescription("Canal permitido para RP.")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName(ACTIVE_OPTION)
            .setDescription("true adiciona; false remove.")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("cooldown")
        .setDescription("Ativa/desativa e ajusta o cooldown de pontuacao.")
        .addBooleanOption((option) =>
          option.setName(ACTIVE_OPTION).setDescription("Novo estado.").setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName(SECONDS_OPTION)
            .setDescription("Tempo em segundos.")
            .setMinValue(0)
            .setMaxValue(3600)
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("idioma")
        .setDescription("Define o idioma preferido do servidor.")
        .addStringOption((option) => {
          const localeOption = option
            .setName(LOCALE_OPTION)
            .setDescription("Idioma.")
            .setRequired(true);

          for (const locale of SUPPORTED_GUILD_LOCALES) {
            localeOption.addChoices({ name: locale, value: locale });
          }

          return localeOption;
        })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("mencionar")
        .setDescription("Define se respostas de RP mencionam usuarios.")
        .addBooleanOption((option) =>
          option.setName(ACTIVE_OPTION).setDescription("Novo estado.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("rank")
        .setDescription("Ativa ou desativa rankings de afinidade.")
        .addBooleanOption((option) =>
          option.setName(ACTIVE_OPTION).setDescription("Novo estado.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reset")
        .setDescription("Reseta configuracoes do servidor.")
        .addStringOption((option) =>
          option
            .setName(CONFIRMATION_OPTION)
            .setDescription(`Digite ${RESET_CONFIRMATION} para confirmar.`)
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    if (!(await requireConfigAdmin(interaction))) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await executeConfigSubcommand(interaction);

    await interaction.editReply({
      embeds: [buildConfigResultEmbed(result)]
    });
  }
};

async function executeConfigSubcommand(
  interaction: ChatInputCommandInteraction
): Promise<GuildConfigResult> {
  const baseInput = {
    guildId: interaction.guildId!,
    actorUserId: interaction.user.id
  };

  switch (interaction.options.getSubcommand(true)) {
    case "prefixo":
      return guildConfigService.setPrefix({
        ...baseInput,
        prefix: interaction.options.getString(PREFIX_OPTION, true)
      });
    case "afinidade":
      return guildConfigService.setAffinityEnabled({
        ...baseInput,
        enabled: interaction.options.getBoolean(ACTIVE_OPTION, true)
      });
    case "gifs":
      return guildConfigService.setGifsEnabled({
        ...baseInput,
        enabled: interaction.options.getBoolean(ACTIVE_OPTION, true)
      });
    case "categoria":
      return guildConfigService.setCategoryEnabled({
        ...baseInput,
        category: interaction.options.getString(CATEGORY_OPTION, true) as ActionCategory,
        enabled: interaction.options.getBoolean(ACTIVE_OPTION, true)
      });
    case "canal":
      return guildConfigService.setChannelAllowed({
        ...baseInput,
        channelId: interaction.options.getChannel(CHANNEL_OPTION, true).id,
        allowed: interaction.options.getBoolean(ACTIVE_OPTION, true)
      });
    case "cooldown":
      return guildConfigService.setCooldown({
        ...baseInput,
        enabled: interaction.options.getBoolean(ACTIVE_OPTION, true),
        seconds: interaction.options.getInteger(SECONDS_OPTION) ?? undefined
      });
    case "idioma":
      return guildConfigService.setLocale({
        ...baseInput,
        locale: interaction.options.getString(LOCALE_OPTION, true) as SupportedGuildLocale
      });
    case "mencionar":
      return guildConfigService.setMentionUsers({
        ...baseInput,
        enabled: interaction.options.getBoolean(ACTIVE_OPTION, true)
      });
    case "rank":
      return guildConfigService.setRankingEnabled({
        ...baseInput,
        enabled: interaction.options.getBoolean(ACTIVE_OPTION, true)
      });
    case "reset":
      if (interaction.options.getString(CONFIRMATION_OPTION, true) !== RESET_CONFIRMATION) {
        return {
          ok: false as const,
          message: `Reset cancelado. Digite ${RESET_CONFIRMATION} para confirmar.`
        };
      }

      return guildConfigService.resetConfig(baseInput);
    default:
      return {
        ok: false as const,
        message: "Subcomando de configuracao desconhecido."
      };
  }
}

async function requireConfigAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const permission = adminPermissionService.canManageConfig(interaction);

  if (permission.allowed) {
    return true;
  }

  await interaction.reply({
    content: permission.reason ?? "Voce nao pode alterar configuracoes deste servidor.",
    ephemeral: true
  });
  return false;
}

function addCategoryChoices(option: SlashCommandStringOption): SlashCommandStringOption {
  return option.addChoices(
    { name: "carinho_fofo", value: "carinho_fofo" },
    { name: "romance_leve", value: "romance_leve" },
    { name: "apoio_emocional", value: "apoio_emocional" },
    { name: "brincadeira", value: "brincadeira" }
  );
}
