import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { ListOptions, RepositoryClient } from "./types";
import { DEFAULT_LIST_TAKE } from "./types";

export interface ListInteractionsFilters extends ListOptions {
  guildId: string;
  action?: string;
  category?: string;
  actorUserId?: string;
  targetUserId?: string;
}

export interface ScoredPairActionFilters {
  guildId: string;
  affinityPairId: string;
  action: string;
  since?: Date;
}

export interface ScoredPairFilters {
  guildId: string;
  affinityPairId: string;
  since?: Date;
}

export interface ScoredUserFilters {
  guildId: string;
  userId: string;
  since?: Date;
}

export interface LatestActorInteractionFilters {
  guildId: string;
  actorUserId: string;
  since?: Date;
}

export interface LatestPairInteractionFilters {
  guildId: string;
  userOneId: string;
  userTwoId: string;
  action?: string;
  since?: Date;
}

export interface CountActionsBetweenUsersFilters {
  guildId: string;
  actorUserId: string;
  targetUserId: string;
  actions?: readonly string[];
}

export interface ActionCountResult {
  action: string;
  count: number;
}

export const interactionRepository = {
  create(data: Prisma.InteractionUncheckedCreateInput, db: RepositoryClient = prisma) {
    return db.interaction.create({
      data
    });
  },

  findById(id: string, db: RepositoryClient = prisma) {
    return db.interaction.findUnique({
      where: { id }
    });
  },

  listByGuild(filters: ListInteractionsFilters, db: RepositoryClient = prisma) {
    const where: Prisma.InteractionWhereInput = {
      guildId: filters.guildId,
      action: filters.action,
      category: filters.category,
      actorUserId: filters.actorUserId,
      targetUserId: filters.targetUserId
    };

    return db.interaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.take ?? DEFAULT_LIST_TAKE,
      skip: filters.skip
    });
  },

  findLatestScoredForPairAction(
    filters: ScoredPairActionFilters,
    db: RepositoryClient = prisma
  ) {
    return db.interaction.findFirst({
      where: {
        guildId: filters.guildId,
        affinityPairId: filters.affinityPairId,
        action: filters.action,
        pointsAwarded: { gt: 0 },
        createdAt: filters.since ? { gte: filters.since } : undefined
      },
      orderBy: { createdAt: "desc" }
    });
  },

  findLatestScoredForUser(filters: ScoredUserFilters, db: RepositoryClient = prisma) {
    return db.interaction.findFirst({
      where: {
        guildId: filters.guildId,
        pointsAwarded: { gt: 0 },
        createdAt: filters.since ? { gte: filters.since } : undefined,
        OR: [
          { actorUserId: filters.userId },
          { targetUserId: filters.userId }
        ]
      },
      orderBy: { createdAt: "desc" }
    });
  },

  findLatestForActor(filters: LatestActorInteractionFilters, db: RepositoryClient = prisma) {
    return db.interaction.findFirst({
      where: {
        guildId: filters.guildId,
        actorUserId: filters.actorUserId,
        createdAt: filters.since ? { gte: filters.since } : undefined
      },
      orderBy: { createdAt: "desc" }
    });
  },

  findLatestBetweenUsers(filters: LatestPairInteractionFilters, db: RepositoryClient = prisma) {
    return db.interaction.findFirst({
      where: {
        guildId: filters.guildId,
        action: filters.action,
        createdAt: filters.since ? { gte: filters.since } : undefined,
        OR: [
          {
            actorUserId: filters.userOneId,
            targetUserId: filters.userTwoId
          },
          {
            actorUserId: filters.userTwoId,
            targetUserId: filters.userOneId
          }
        ]
      },
      orderBy: { createdAt: "desc" }
    });
  },

  async sumScoredPointsForPair(
    filters: ScoredPairFilters,
    db: RepositoryClient = prisma
  ): Promise<number> {
    const result = await db.interaction.aggregate({
      where: {
        guildId: filters.guildId,
        affinityPairId: filters.affinityPairId,
        pointsAwarded: { gt: 0 },
        createdAt: filters.since ? { gte: filters.since } : undefined
      },
      _sum: {
        pointsAwarded: true
      }
    });

    return result._sum.pointsAwarded ?? 0;
  },

  async sumScoredPointsForUser(
    filters: ScoredUserFilters,
    db: RepositoryClient = prisma
  ): Promise<number> {
    const result = await db.interaction.aggregate({
      where: {
        guildId: filters.guildId,
        pointsAwarded: { gt: 0 },
        createdAt: filters.since ? { gte: filters.since } : undefined,
        OR: [
          { actorUserId: filters.userId },
          { targetUserId: filters.userId }
        ]
      },
      _sum: {
        pointsAwarded: true
      }
    });

    return result._sum.pointsAwarded ?? 0;
  },

  countScoredInteractionsForUser(filters: ScoredUserFilters, db: RepositoryClient = prisma) {
    return db.interaction.count({
      where: {
        guildId: filters.guildId,
        pointsAwarded: { gt: 0 },
        createdAt: filters.since ? { gte: filters.since } : undefined,
        OR: [
          { actorUserId: filters.userId },
          { targetUserId: filters.userId }
        ]
      }
    });
  },

  async countActionsBetweenUsers(
    filters: CountActionsBetweenUsersFilters,
    db: RepositoryClient = prisma
  ): Promise<ActionCountResult[]> {
    const where: Prisma.InteractionWhereInput = {
      guildId: filters.guildId,
      actorUserId: filters.actorUserId,
      targetUserId: filters.targetUserId
    };

    if (filters.actions && filters.actions.length > 0) {
      where.action = {
        in: [...filters.actions]
      };
    }

    const groupedActions = await db.interaction.groupBy({
      by: ["action"],
      where,
      _count: {
        _all: true
      }
    });

    return groupedActions.map((group) => ({
      action: group.action,
      count: group._count._all
    }));
  }
};
