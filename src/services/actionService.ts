import { RETRIBUTE_BUTTON_TTL_MS } from "../config";
import {
  buttonInteractionStateRepository,
  gifRepository,
  guildRepository,
  interactionRepository,
  prisma
} from "../database";
import type {
  ActionAffinityResult,
  ActionContext,
  ActionGifSelection,
  ActionPhraseSelection,
  ActionResult
} from "../types";
import {
  buildDefaultActionPayload,
  buildRetributeCustomId,
  fallbackActionPhrase,
  type RequiredActionPayloadContext
} from "./actionPayloadBuilder";
import { actionCooldownService } from "./actionCooldownService";
import { failAction, validateBaseActionContext } from "./actionValidation";
import { affinityService } from "./affinityService";
import { blockService } from "./blockService";
import { gifService } from "./gifService";
import { guildConfigService, type GuildConfig } from "./guildConfigService";
import { phraseService } from "./phraseService";

export interface ActionServiceDependencies {
  validateGuild(context: RequiredActionPayloadContext): Promise<ActionResult | null>;
  validateBlocks(context: RequiredActionPayloadContext): Promise<ActionResult | null>;
  validatePermissions(context: RequiredActionPayloadContext): Promise<ActionResult | null>;
  validateCooldown(context: RequiredActionPayloadContext): Promise<ActionResult | null>;
  selectPhrase(context: RequiredActionPayloadContext): Promise<ActionPhraseSelection>;
  selectGif(context: RequiredActionPayloadContext): Promise<ActionGifSelection | undefined>;
  persistAction(
    context: RequiredActionPayloadContext,
    phrase: ActionPhraseSelection,
    gif: ActionGifSelection | undefined
  ): Promise<ActionAffinityResult>;
}

export interface ActionService {
  execute(context: ActionContext): Promise<ActionResult>;
}

export function createActionService(
  overrides: Partial<ActionServiceDependencies> = {}
): ActionService {
  const dependencies: ActionServiceDependencies = {
    ...defaultActionServiceDependencies,
    ...overrides
  };

  return {
    async execute(context: ActionContext): Promise<ActionResult> {
      const baseFailure = validateBaseActionContext(context);

      if (baseFailure) {
        return baseFailure;
      }

      const preparedContext = prepareContext(context);

      for (const check of [
        dependencies.validateGuild,
        dependencies.validateBlocks,
        dependencies.validatePermissions,
        dependencies.validateCooldown
      ]) {
        const failure = await check(preparedContext);

        if (failure) {
          return failure;
        }
      }

      const phrase = await dependencies.selectPhrase(preparedContext);
      const gif = await dependencies.selectGif(preparedContext);
      const affinity = await dependencies.persistAction(preparedContext, phrase, gif);
      const payload = buildDefaultActionPayload(preparedContext, phrase, gif, affinity);

      return {
        ok: true,
        action: preparedContext.action,
        category: preparedContext.category,
        source: preparedContext.source,
        guildId: preparedContext.guild.id,
        actorUserId: preparedContext.actor.id,
        targetUserId: preparedContext.target.id,
        phrase,
        gif,
        affinity,
        payload
      };
    }
  };
}

const defaultActionServiceDependencies: ActionServiceDependencies = {
  async validateGuild(context) {
    const guild = await guildRepository.findById(context.guild.id);

    if (!guild) {
      await guildRepository.upsert({ id: context.guild.id });
      return null;
    }

    if (guild?.isAllowed === false) {
      return failAction("guild_not_allowed", "Este servidor nao esta autorizado a usar a Aurora.");
    }

    const config = await guildConfigService.getConfig(context.guild.id);
    setContextConfig(context, config);

    return null;
  },

  async validateBlocks(context) {
    return blockService.validateActionPrivacy(context);
  },

  async validatePermissions(context) {
    const config = await getContextConfig(context);

    if (
      config.allowedChannelIds.length > 0 &&
      !config.allowedChannelIds.includes(context.channelId ?? "")
    ) {
      return failAction("channel_not_allowed", "Este canal nao esta liberado para acoes RP.");
    }

    if (config.disabledCategories.includes(context.category)) {
      return failAction("category_disabled", "Essa categoria esta desativada neste servidor.");
    }

    return null;
  },

  async validateCooldown(context) {
    return actionCooldownService.validate(context, {
      enabled: true
    });
  },

  async selectPhrase(context) {
    const phrase = await phraseService.selectForAction({
      guildId: context.guild.id,
      action: context.action,
      category: context.category
    });

    if (!phrase) {
      return {
        text: fallbackActionPhrase(context)
      };
    }

    return phrase;
  },

  async selectGif(context) {
    const config = await getContextConfig(context);

    if (!config.gifsEnabled) {
      return undefined;
    }

    return gifService.chooseGif({
      guildId: context.guild.id,
      action: context.action,
      category: context.category,
      addedBy: context.actor.id
    });
  },

  async persistAction(context, _phrase, gif) {
    const config = await getContextConfig(context);

    return prisma.$transaction(async (db) => {
      const affinity = config.affinityEnabled
        ? await affinityService.applyAction(
            {
              guildId: context.guild.id,
              actorUserId: context.actor.id,
              targetUserId: context.target.id,
              action: context.action,
              category: context.category,
              source: context.source,
              occurredAt: context.now
            },
            db
          )
        : {
            pointsAwarded: 0,
            scoreReason: "not_pointable" as const
          };

      if (gif?.id) {
        await gifRepository.incrementUsage(gif.id, context.now, db);
      }

      await buttonInteractionStateRepository.upsert(
        {
          guildId: context.guild.id,
          customId: buildRetributeCustomId(context),
          action: context.action,
          originalAuthorId: context.actor.id,
          originalTargetId: context.target.id,
          expiresAt: new Date(context.now.getTime() + RETRIBUTE_BUTTON_TTL_MS)
        },
        db
      );

      await interactionRepository.create(
        {
          guildId: context.guild.id,
          actorUserId: context.actor.id,
          targetUserId: context.target.id,
          action: context.action,
          category: context.category,
          source: context.source,
          pointsAwarded: affinity.pointsAwarded,
          affinityPairId: affinity.affinityPairId,
          gifId: gif?.id,
          createdAt: context.now
        },
        db
      );

      return affinity;
    });
  }
};

export const actionService = createActionService();

function prepareContext(context: ActionContext): RequiredActionPayloadContext {
  return {
    ...context,
    guild: context.guild,
    actor: context.actor,
    target: context.target,
    now: context.now ?? new Date()
  } as RequiredActionPayloadContext;
}

async function getContextConfig(context: RequiredActionPayloadContext): Promise<GuildConfig> {
  const config = readContextConfig(context);

  if (config) {
    return config;
  }

  const loadedConfig = await guildConfigService.getConfig(context.guild.id);
  setContextConfig(context, loadedConfig);
  return loadedConfig;
}

function readContextConfig(context: RequiredActionPayloadContext): GuildConfig | undefined {
  return context.metadata?.guildConfig as GuildConfig | undefined;
}

function setContextConfig(context: RequiredActionPayloadContext, config: GuildConfig): void {
  context.metadata = {
    ...context.metadata,
    guildConfig: config,
    locale: config.locale,
    mentionUsers: config.mentionUsers
  };
}
