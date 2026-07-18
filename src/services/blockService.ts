import { blockRepository } from "../database";
import type { ActionCategory, ActionName, ActionResult } from "../types";
import { failAction } from "./actionValidation";
import type { RequiredActionPayloadContext } from "./actionPayloadBuilder";
import { preferenceService } from "./preferenceService";

export type PrivacyBlockCategory =
  "carinho_fofo" | "romance_leve" | "apoio_emocional" | "brincadeira";

export interface BlockPreferenceResult {
  message: string;
}

export interface BlockStatus {
  blocksAllRp: boolean;
  blockedCategories: string[];
  blockedUserCount: number;
}

export interface BlockRecordLike {
  blockedUserId: string | null;
  category: string | null;
  action: string | null;
}

export interface BlockRepositoryLike {
  findMatching(input: {
    guildId: string;
    blockerUserId: string;
    blockedUserId?: string;
    category?: string;
    action?: string;
  }): Promise<unknown | null>;
  findExact(input: {
    guildId: string;
    blockerUserId: string;
    blockedUserId?: string | null;
    category?: string | null;
    action?: ActionName | null;
  }): Promise<unknown | null>;
  create(input: {
    guildId: string;
    blockerUserId: string;
    blockedUserId?: string | null;
    category?: string | null;
    action?: ActionName | null;
  }): Promise<unknown>;
  deleteMany(input: {
    guildId: string;
    blockerUserId: string;
    blockedUserId?: string | null;
    category?: string | null;
    action?: ActionName | null;
  }): Promise<unknown>;
  list(input: {
    guildId: string;
    blockerUserId?: string;
    take?: number;
  }): Promise<BlockRecordLike[]>;
}

export interface BlockPreferenceServiceLike {
  allowsRomance(userId: string): Promise<boolean>;
}

export interface BlockServiceDependencies {
  repository: BlockRepositoryLike;
  preferences: BlockPreferenceServiceLike;
}

export interface BlockService {
  validateActionPrivacy(context: RequiredActionPayloadContext): Promise<ActionResult | null>;
  blockAllRp(guildId: string, blockerUserId: string): Promise<BlockPreferenceResult>;
  unblockAllRp(guildId: string, blockerUserId: string): Promise<BlockPreferenceResult>;
  blockUser(
    guildId: string,
    blockerUserId: string,
    blockedUserId: string
  ): Promise<BlockPreferenceResult>;
  unblockUser(
    guildId: string,
    blockerUserId: string,
    blockedUserId: string
  ): Promise<BlockPreferenceResult>;
  setCategoryBlock(input: {
    guildId: string;
    blockerUserId: string;
    category: PrivacyBlockCategory;
    blocked: boolean;
  }): Promise<BlockPreferenceResult>;
  getStatus(guildId: string, userId: string): Promise<BlockStatus>;
}

const defaultBlockServiceDependencies: BlockServiceDependencies = {
  repository: blockRepository,
  preferences: preferenceService
};

export function createBlockService(
  dependencies: BlockServiceDependencies = defaultBlockServiceDependencies
): BlockService {
  async function validateActionPrivacy(
    context: RequiredActionPayloadContext
  ): Promise<ActionResult | null> {
    const incomingBlock = await dependencies.repository.findMatching({
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
        dependencies.preferences.allowsRomance(context.actor.id),
        dependencies.preferences.allowsRomance(context.target.id)
      ]);

      if (!actorAllowsRomance || !targetAllowsRomance) {
        return failAction("blocked", "Esta interacao romantica precisa de opt-in.");
      }
    }

    return null;
  }

  async function ensureBlock(input: {
    guildId: string;
    blockerUserId: string;
    blockedUserId?: string | null;
    category?: string | null;
    action?: ActionName | null;
  }): Promise<void> {
    const existingBlock = await dependencies.repository.findExact(input);

    if (existingBlock) {
      return;
    }

    await dependencies.repository.create(input);
  }

  return {
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
      await dependencies.repository.deleteMany({
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
      await dependencies.repository.deleteMany({
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

      await dependencies.repository.deleteMany({
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
      const blocks = await dependencies.repository.list({
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
}

export const blockService = createBlockService();

export function validateActionPrivacy(
  context: RequiredActionPayloadContext
): Promise<ActionResult | null> {
  return blockService.validateActionPrivacy(context);
}

function isRomanceCategory(category: ActionCategory): boolean {
  return category === "romance_leve" || category === "romance";
}

function isFullBlock(block: BlockRecordLike): boolean {
  return !block.blockedUserId && !block.category && !block.action;
}
