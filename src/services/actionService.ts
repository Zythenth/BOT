import {
  guildRepository,
  interactionRepository,
  phraseRepository
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
  fallbackActionPhrase,
  renderActionPhraseTemplate,
  type RequiredActionPayloadContext
} from "./actionPayloadBuilder";
import { failAction, validateBaseActionContext } from "./actionValidation";
import { affinityService } from "./affinityService";
import { blockService } from "./blockService";
import { gifService } from "./gifService";

export interface ActionServiceDependencies {
  validateGuild(context: RequiredActionPayloadContext): Promise<ActionResult | null>;
  validateBlocks(context: RequiredActionPayloadContext): Promise<ActionResult | null>;
  validatePermissions(context: RequiredActionPayloadContext): Promise<ActionResult | null>;
  validateCooldown(context: RequiredActionPayloadContext): Promise<ActionResult | null>;
  selectPhrase(context: RequiredActionPayloadContext): Promise<ActionPhraseSelection>;
  selectGif(context: RequiredActionPayloadContext): Promise<ActionGifSelection | undefined>;
  calculateAffinity(
    context: RequiredActionPayloadContext,
    phrase: ActionPhraseSelection,
    gif: ActionGifSelection | undefined
  ): Promise<ActionAffinityResult>;
  saveHistory(
    context: RequiredActionPayloadContext,
    phrase: ActionPhraseSelection,
    gif: ActionGifSelection | undefined,
    affinity: ActionAffinityResult
  ): Promise<void>;
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
      const affinity = await dependencies.calculateAffinity(preparedContext, phrase, gif);
      const payload = buildDefaultActionPayload(preparedContext, phrase, gif, affinity);

      await dependencies.saveHistory(preparedContext, phrase, gif, affinity);

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

export const actionService = createActionService();

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

    return null;
  },

  async validateBlocks(context) {
    return blockService.validateActionPrivacy(context);
  },

  async validatePermissions() {
    return null;
  },

  async validateCooldown() {
    return null;
  },

  async selectPhrase(context) {
    const phrases = await phraseRepository.list({
      guildId: context.guild.id,
      action: context.action,
      category: context.category,
      isEnabled: true,
      take: 25
    });
    const phrase = pickRandom(phrases);

    if (!phrase) {
      return {
        text: fallbackActionPhrase(context)
      };
    }

    return {
      id: phrase.id,
      text: renderActionPhraseTemplate(phrase.text, context)
    };
  },

  async selectGif(context) {
    return gifService.chooseGif({
      guildId: context.guild.id,
      action: context.action,
      category: context.category,
      addedBy: context.actor.id
    });
  },

  async calculateAffinity(context) {
    return affinityService.applyAction({
      guildId: context.guild.id,
      actorUserId: context.actor.id,
      targetUserId: context.target.id,
      action: context.action,
      category: context.category,
      source: context.source,
      occurredAt: context.now
    });
  },

  async saveHistory(context, _phrase, gif, affinity) {
    if (gif?.id) {
      await gifService.markGifUsed(gif.id, context.now);
    }

    await interactionRepository.create({
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
    });
  }
};

function prepareContext(context: ActionContext): RequiredActionPayloadContext {
  return {
    ...context,
    guild: context.guild,
    actor: context.actor,
    target: context.target,
    now: context.now ?? new Date()
  } as RequiredActionPayloadContext;
}

function pickRandom<T>(values: T[]): T | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return values[Math.floor(Math.random() * values.length)];
}
