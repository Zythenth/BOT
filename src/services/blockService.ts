import { blockRepository } from "../database";
import type { ActionCategory, ActionName, ActionResult } from "../types";
import { failAction } from "./actionValidation";
import type { RequiredActionPayloadContext } from "./actionPayloadBuilder";
import { preferenceService } from "./preferenceService";

export type PrivacyBlockCategory =
  | "carinho_fofo"
  | "romance_leve"
  | "apoio_emocional"
  | "brincadeira";

export interface BlockPreferenceResult {
  message: string;
}

export interface BlockStatus {
  blocksAllRp: boolean;
  blockedCategories: string[];
  blockedUserCount: number;
}

export async function validateActionPrivacy(
  context: RequiredActionPayloadContext
): Promise<ActionResult | null> {
  const incomingBlock = await blockRepository.findMatching({
    guildId: context.guild.id,
    blockerUserId: context.target.id,
    blockedUserId: context.actor.id,
    category: context.category,
    action: context.action
  });

  if (incomingBlock) {
    return failAction("blocked", "Essa pessoa nao pode receber esta interacao agora.");
  }

  if (isRomanceCategory(context.category)) {
    const [actorAllowsRomance, targetAllowsRomance] = await Promise.all([
      preferenceService.allowsRomance(context.actor.id),
      preferenceService.allowsRomance(context.target.id)
    ]);

    if (!actorAllowsRomance || !targetAllowsRomance) {
      return failAction("blocked", "Esta interacao romantica precisa de opt-in.");
    }
  }

  return null;
}

export const blockService = {
  validateActionPrivacy,

  async blockAllRp(guildId: string, blockerUserId: string): Promise<BlockPreferenceResult> {
    await ensureBlock({
      guildId,
      blockerUserId,
      blockedUserId: null,
      category: null,
      action: null
    });

    return {
      message: "Interacoes RP recebidas foram bloqueadas."
    };
  },

  async unblockAllRp(guildId: string, blockerUserId: string): Promise<BlockPreferenceResult> {
    await blockRepository.deleteMany({
      guildId,
      blockerUserId,
      blockedUserId: null,
      category: null,
      action: null
    });

    return {
      message: "Interacoes RP recebidas foram reativadas."
    };
  },

  async blockUser(
    guildId: string,
    blockerUserId: string,
    blockedUserId: string
  ): Promise<BlockPreferenceResult> {
    await ensureBlock({
      guildId,
      blockerUserId,
      blockedUserId,
      category: null,
      action: null
    });

    return {
      message: "Esse usuario foi bloqueado para interacoes RP."
    };
  },

  async unblockUser(
    guildId: string,
    blockerUserId: string,
    blockedUserId: string
  ): Promise<BlockPreferenceResult> {
    await blockRepository.deleteMany({
      guildId,
      blockerUserId,
      blockedUserId,
      category: null,
      action: null
    });

    return {
      message: "Esse usuario foi desbloqueado para interacoes RP."
    };
  },

  async setCategoryBlock(input: {
    guildId: string;
    blockerUserId: string;
    category: PrivacyBlockCategory;
    blocked: boolean;
  }): Promise<BlockPreferenceResult> {
    if (input.blocked) {
      await ensureBlock({
        guildId: input.guildId,
        blockerUserId: input.blockerUserId,
        blockedUserId: null,
        category: input.category,
        action: null
      });

      return {
        message: "Categoria bloqueada para interacoes recebidas."
      };
    }

    await blockRepository.deleteMany({
      guildId: input.guildId,
      blockerUserId: input.blockerUserId,
      blockedUserId: null,
      category: input.category,
      action: null
    });

    return {
      message: "Categoria liberada para interacoes recebidas."
    };
  },

  async getStatus(guildId: string, userId: string): Promise<BlockStatus> {
    const blocks = await blockRepository.list({
      guildId,
      blockerUserId: userId,
      take: 100
    });

    return {
      blocksAllRp: blocks.some(isFullBlock),
      blockedCategories: blocks
        .filter((block) => block.category && !block.blockedUserId && !block.action)
        .map((block) => block.category as string),
      blockedUserCount: blocks.filter((block) => Boolean(block.blockedUserId)).length
    };
  }
};

function isRomanceCategory(category: ActionCategory): boolean {
  return category === "romance_leve" || category === "romance";
}

async function ensureBlock(input: {
  guildId: string;
  blockerUserId: string;
  blockedUserId?: string | null;
  category?: string | null;
  action?: ActionName | null;
}): Promise<void> {
  const existingBlock = await blockRepository.findExact(input);

  if (existingBlock) {
    return;
  }

  await blockRepository.create(input);
}

function isFullBlock(block: {
  blockedUserId: string | null;
  category: string | null;
  action: string | null;
}): boolean {
  return !block.blockedUserId && !block.category && !block.action;
}
