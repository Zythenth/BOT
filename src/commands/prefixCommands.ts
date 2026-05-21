import type { User } from "discord.js";
import { RP_ACTION_DEFINITIONS, type RpActionDefinition } from "../config";
import { actionService, affinityQueryService, rankingService } from "../services";
import type { ActionContext, PrefixCommandDefinition, PrefixCommandContext } from "../types";
import { replyToMessageWithActionResult } from "./actionResponseAdapter";
import { buildAffinityRankingEmbed, buildAffinitySummaryEmbed } from "./affinityResponseAdapter";
import { buildHelpEmbed } from "./helpResponseAdapter";
import { resolvePrefixTarget } from "./prefixArgumentParser";

export const prefixCommandDefinitions: PrefixCommandDefinition[] = [
  ...RP_ACTION_DEFINITIONS.map((definition) => createRpPrefixCommand(definition)),
  createAffinityPrefixCommand(),
  createRankAffinityPrefixCommand(),
  createHelpPrefixCommand()
];

function createRpPrefixCommand(definition: RpActionDefinition): PrefixCommandDefinition {
  return {
    name: definition.commandName,
    description: definition.description,
    async execute(context: PrefixCommandContext): Promise<void> {
      const target = await resolvePrefixTarget(context.message, context.args);

      if (!target.ok) {
        await context.message.reply(target.message);
        return;
      }

      const botUser = context.message.client.user;

      if (!botUser) {
        throw new Error("Discord client user is not available.");
      }

      const result = await actionService.execute(
        buildPrefixActionContext(context, definition, target.user, botUser, target.customMessage)
      );

      await replyToMessageWithActionResult(context.message, result);
    }
  };
}

function createAffinityPrefixCommand(): PrefixCommandDefinition {
  return {
    name: "afinidade",
    description: "Mostra a afinidade entre voce e outro usuario.",
    async execute(context: PrefixCommandContext): Promise<void> {
      if (!context.message.guildId) {
        return;
      }

      const target = await resolvePrefixTarget(context.message, context.args);

      if (!target.ok) {
        await context.message.reply(target.message);
        return;
      }

      const summary = await affinityQueryService.getPairSummary(
        context.message.guildId,
        context.message.author.id,
        target.user.id
      );

      await context.message.reply({
        embeds: [buildAffinitySummaryEmbed(context.message.author.id, target.user.id, summary)]
      });
    }
  };
}

function createRankAffinityPrefixCommand(): PrefixCommandDefinition {
  return {
    name: "rankafinidade",
    description: "Mostra o ranking de afinidade do servidor.",
    async execute(context: PrefixCommandContext): Promise<void> {
      if (!context.message.guildId) {
        return;
      }

      const ranking = await rankingService.getGuildPairRanking({
        guildId: context.message.guildId,
        page: parseRankingPage(context.args)
      });

      await context.message.reply({ embeds: [buildAffinityRankingEmbed(ranking)] });
    }
  };
}

function createHelpPrefixCommand(): PrefixCommandDefinition {
  return {
    name: "help",
    description: "Lista os comandos principais do MVP.",
    async execute(context: PrefixCommandContext): Promise<void> {
      await context.message.reply({ embeds: [buildHelpEmbed(context.prefix)] });
    }
  };
}

function buildPrefixActionContext(
  context: PrefixCommandContext,
  definition: RpActionDefinition,
  target: User,
  botUser: NonNullable<PrefixCommandContext["message"]["client"]["user"]>,
  customMessage?: string
): ActionContext {
  const guildId = context.message.guildId;

  return {
    action: definition.action,
    category: definition.category,
    source: "prefix",
    guild: guildId
      ? {
          id: guildId,
          name: context.message.guild?.name ?? "Servidor"
        }
      : null,
    channelId: context.message.channelId,
    actor: {
      id: context.message.author.id,
      displayName: context.message.author.globalName ?? context.message.author.username,
      isBot: context.message.author.bot
    },
    target: {
      id: target.id,
      displayName: target.globalName ?? target.username,
      isBot: target.bot
    },
    botUser: {
      id: botUser.id,
      isBot: botUser.bot
    },
    now: new Date(),
    metadata: customMessage
      ? {
          customMessage
        }
      : undefined
  };
}

function parseRankingPage(args: readonly string[]): number {
  const page = Number(args[0]);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}
