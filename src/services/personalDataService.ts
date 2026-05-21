import { prisma } from "../database/prisma";
import {
  adminLogRepository,
  affinityRepository,
  blockRepository,
  buttonInteractionStateRepository,
  interactionRepository,
  userPreferenceRepository
} from "../database/repositories";
import type { RepositoryClient } from "../database/repositories/types";

const RETAINED_ADMIN_LOG_NOTE =
  "AdminLog e mantido como trilha administrativa minima e nao e exportado em detalhes por privacidade.";
const PRESERVED_PREFERENCE_NOTE =
  "Apos apagar dados, a Aurora preserva apenas uma preferencia minima de opt-out para manter sua escolha de privacidade.";

interface StoredUserPreference {
  userId: string;
  locale: string;
  allowRomance: boolean;
  hideFromRankings: boolean;
  optedOutOfAffinity: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface InteractionRecord {
  id: string;
  guildId: string;
  actorUserId: string;
  targetUserId: string;
  action: string;
  category: string;
  source: string;
  pointsAwarded: number;
  createdAt: Date;
}

interface AffinityPairRecord {
  id: string;
  guildId: string;
  userAId: string;
  userBId: string;
  points: number;
  interactionCount: number;
  lastInteractionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface BlockRecord {
  id: string;
  guildId: string;
  blockerUserId: string;
  blockedUserId: string | null;
  category: string | null;
  action: string | null;
  createdAt: Date;
}

interface ButtonInteractionStateRecord {
  id: string;
  guildId: string;
  action: string;
  originalAuthorId: string;
  originalTargetId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

interface DeleteResult {
  count: number;
}

interface PersonalDataDependencies {
  now(): Date;
  transaction<T>(work: (db: RepositoryClient) => Promise<T>): Promise<T>;
  preferences: {
    findByUserId(userId: string): Promise<StoredUserPreference | null>;
    upsert(
      input: {
        userId: string;
        locale: string;
        allowRomance: boolean;
        hideFromRankings: boolean;
        optedOutOfAffinity: boolean;
      },
      db?: RepositoryClient
    ): Promise<StoredUserPreference>;
  };
  interactions: {
    listForUser(userId: string): Promise<InteractionRecord[]>;
    deleteForUser(userId: string, db?: RepositoryClient): Promise<DeleteResult>;
  };
  affinityPairs: {
    listForUser(userId: string): Promise<AffinityPairRecord[]>;
    deleteForUser(userId: string, db?: RepositoryClient): Promise<DeleteResult>;
  };
  blocks: {
    listForUser(userId: string): Promise<BlockRecord[]>;
    deleteForUser(userId: string, db?: RepositoryClient): Promise<DeleteResult>;
  };
  buttonInteractionStates: {
    listForUser(userId: string): Promise<ButtonInteractionStateRecord[]>;
    deleteForUser(userId: string, db?: RepositoryClient): Promise<DeleteResult>;
  };
  adminLogs: {
    countForActor(userId: string): Promise<number>;
  };
}

export interface PersonalDataPreferenceExport {
  locale: string;
  allowRomance: boolean;
  hideFromRankings: boolean;
  optedOutOfAffinity: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalDataCounts {
  interactions: number;
  affinityPairs: number;
  blocks: number;
  buttonInteractionStates: number;
  adminLogsRetained: number;
}

export interface PersonalDataExport {
  exportedAt: string;
  userId: string;
  preference: PersonalDataPreferenceExport | null;
  counts: PersonalDataCounts;
  interactions: Array<{
    guildId: string;
    actorUserId: string;
    targetUserId: string;
    action: string;
    category: string;
    commandOrigin: string;
    pointsAwarded: number;
    createdAt: string;
  }>;
  affinityPairs: Array<{
    guildId: string;
    otherUserId: string;
    points: number;
    interactionCount: number;
    lastInteractionAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  blocks: Array<{
    guildId: string;
    direction: "sent" | "received";
    otherUserId: string | null;
    category: string | null;
    action: string | null;
    createdAt: string;
  }>;
  buttonInteractionStates: Array<{
    guildId: string;
    action: string;
    role: "original_author" | "original_target";
    expiresAt: string;
    usedAt: string | null;
    createdAt: string;
  }>;
  retained: {
    adminLogNote: string;
    preservedPreferenceNote: string;
  };
}

export interface PersonalDataSummary {
  exportedAt: string;
  userId: string;
  preference: PersonalDataPreferenceExport | null;
  counts: PersonalDataCounts;
  retained: PersonalDataExport["retained"];
}

export interface PersonalDataEraseResult {
  erasedAt: string;
  userId: string;
  deleted: {
    interactions: number;
    affinityPairs: number;
    blocks: number;
    buttonInteractionStates: number;
  };
  preservedPreference: PersonalDataPreferenceExport;
  retained: {
    adminLogsRetained: number;
    adminLogNote: string;
    preservedPreferenceNote: string;
  };
}

export function createPersonalDataService(dependencies: PersonalDataDependencies) {
  const service = {
    async getSummary(userId: string): Promise<PersonalDataSummary> {
      const data = await service.exportUserData(userId);

      return {
        exportedAt: data.exportedAt,
        userId: data.userId,
        preference: data.preference,
        counts: data.counts,
        retained: data.retained
      };
    },

    async exportUserData(userId: string): Promise<PersonalDataExport> {
      const [
        preference,
        interactions,
        affinityPairs,
        blocks,
        buttonInteractionStates,
        adminLogsRetained
      ] = await Promise.all([
        dependencies.preferences.findByUserId(userId),
        dependencies.interactions.listForUser(userId),
        dependencies.affinityPairs.listForUser(userId),
        dependencies.blocks.listForUser(userId),
        dependencies.buttonInteractionStates.listForUser(userId),
        dependencies.adminLogs.countForActor(userId)
      ]);

      return {
        exportedAt: dependencies.now().toISOString(),
        userId,
        preference: preference ? toPreferenceExport(preference) : null,
        counts: {
          interactions: interactions.length,
          affinityPairs: affinityPairs.length,
          blocks: blocks.length,
          buttonInteractionStates: buttonInteractionStates.length,
          adminLogsRetained
        },
        interactions: interactions.map(toInteractionExport),
        affinityPairs: affinityPairs.map((pair) => toAffinityPairExport(userId, pair)),
        blocks: blocks.map((block) => toBlockExport(userId, block)),
        buttonInteractionStates: buttonInteractionStates.map((state) =>
          toButtonInteractionStateExport(userId, state)
        ),
        retained: {
          adminLogNote: RETAINED_ADMIN_LOG_NOTE,
          preservedPreferenceNote: PRESERVED_PREFERENCE_NOTE
        }
      };
    },

    async eraseOwnData(userId: string): Promise<PersonalDataEraseResult> {
      const [currentPreference, adminLogsRetained] = await Promise.all([
        dependencies.preferences.findByUserId(userId),
        dependencies.adminLogs.countForActor(userId)
      ]);
      const erasedAt = dependencies.now();
      const locale = currentPreference?.locale ?? "pt-BR";

      const result = await dependencies.transaction(async (db) => {
        const buttonInteractionStates =
          await dependencies.buttonInteractionStates.deleteForUser(userId, db);
        const interactions = await dependencies.interactions.deleteForUser(userId, db);
        const affinityPairs = await dependencies.affinityPairs.deleteForUser(userId, db);
        const blocks = await dependencies.blocks.deleteForUser(userId, db);
        const preservedPreference = await dependencies.preferences.upsert(
          {
            userId,
            locale,
            allowRomance: false,
            hideFromRankings: true,
            optedOutOfAffinity: true
          },
          db
        );

        return {
          buttonInteractionStates,
          interactions,
          affinityPairs,
          blocks,
          preservedPreference
        };
      });

      return {
        erasedAt: erasedAt.toISOString(),
        userId,
        deleted: {
          interactions: result.interactions.count,
          affinityPairs: result.affinityPairs.count,
          blocks: result.blocks.count,
          buttonInteractionStates: result.buttonInteractionStates.count
        },
        preservedPreference: toPreferenceExport(result.preservedPreference),
        retained: {
          adminLogsRetained,
          adminLogNote: RETAINED_ADMIN_LOG_NOTE,
          preservedPreferenceNote: PRESERVED_PREFERENCE_NOTE
        }
      };
    }
  };

  return service;
}

export const personalDataService = createPersonalDataService({
  now: () => new Date(),
  transaction: (work) => prisma.$transaction((db: RepositoryClient) => work(db)),
  preferences: userPreferenceRepository,
  interactions: interactionRepository,
  affinityPairs: affinityRepository,
  blocks: blockRepository,
  buttonInteractionStates: buttonInteractionStateRepository,
  adminLogs: adminLogRepository
});

function toPreferenceExport(preference: StoredUserPreference): PersonalDataPreferenceExport {
  return {
    locale: preference.locale,
    allowRomance: preference.allowRomance,
    hideFromRankings: preference.hideFromRankings,
    optedOutOfAffinity: preference.optedOutOfAffinity,
    createdAt: preference.createdAt.toISOString(),
    updatedAt: preference.updatedAt.toISOString()
  };
}

function toInteractionExport(interaction: InteractionRecord): PersonalDataExport["interactions"][number] {
  return {
    guildId: interaction.guildId,
    actorUserId: interaction.actorUserId,
    targetUserId: interaction.targetUserId,
    action: interaction.action,
    category: interaction.category,
    commandOrigin: interaction.source,
    pointsAwarded: interaction.pointsAwarded,
    createdAt: interaction.createdAt.toISOString()
  };
}

function toAffinityPairExport(
  userId: string,
  pair: AffinityPairRecord
): PersonalDataExport["affinityPairs"][number] {
  return {
    guildId: pair.guildId,
    otherUserId: pair.userAId === userId ? pair.userBId : pair.userAId,
    points: pair.points,
    interactionCount: pair.interactionCount,
    lastInteractionAt: pair.lastInteractionAt?.toISOString() ?? null,
    createdAt: pair.createdAt.toISOString(),
    updatedAt: pair.updatedAt.toISOString()
  };
}

function toBlockExport(
  userId: string,
  block: BlockRecord
): PersonalDataExport["blocks"][number] {
  const sent = block.blockerUserId === userId;

  return {
    guildId: block.guildId,
    direction: sent ? "sent" : "received",
    otherUserId: sent ? block.blockedUserId : block.blockerUserId,
    category: block.category,
    action: block.action,
    createdAt: block.createdAt.toISOString()
  };
}

function toButtonInteractionStateExport(
  userId: string,
  state: ButtonInteractionStateRecord
): PersonalDataExport["buttonInteractionStates"][number] {
  return {
    guildId: state.guildId,
    action: state.action,
    role: state.originalAuthorId === userId ? "original_author" : "original_target",
    expiresAt: state.expiresAt.toISOString(),
    usedAt: state.usedAt?.toISOString() ?? null,
    createdAt: state.createdAt.toISOString()
  };
}
