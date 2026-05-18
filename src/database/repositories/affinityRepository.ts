import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { ListOptions, RepositoryClient } from "./types";

export interface NormalizedAffinityPair {
  userAId: string;
  userBId: string;
}

export interface IncrementAffinityInput {
  guildId: string;
  userOneId: string;
  userTwoId: string;
  points?: number;
  interactedAt?: Date;
}

export interface RecordAffinityActionInput extends IncrementAffinityInput {
  pointsAwarded: number;
}

export function normalizeAffinityPair(userOneId: string, userTwoId: string): NormalizedAffinityPair {
  return userOneId <= userTwoId
    ? { userAId: userOneId, userBId: userTwoId }
    : { userAId: userTwoId, userBId: userOneId };
}

export const affinityRepository = {
  normalizePair: normalizeAffinityPair,

  findPair(
    guildId: string,
    userOneId: string,
    userTwoId: string,
    db: RepositoryClient = prisma
  ) {
    const { userAId, userBId } = normalizeAffinityPair(userOneId, userTwoId);

    return db.affinityPair.findUnique({
      where: {
        guildId_userAId_userBId: {
          guildId,
          userAId,
          userBId
        }
      }
    });
  },

  getOrCreatePair(
    guildId: string,
    userOneId: string,
    userTwoId: string,
    db: RepositoryClient = prisma
  ) {
    const { userAId, userBId } = normalizeAffinityPair(userOneId, userTwoId);

    return db.affinityPair.upsert({
      where: {
        guildId_userAId_userBId: {
          guildId,
          userAId,
          userBId
        }
      },
      create: {
        guildId,
        userAId,
        userBId
      },
      update: {}
    });
  },

  incrementInteraction(input: IncrementAffinityInput, db: RepositoryClient = prisma) {
    const { userAId, userBId } = normalizeAffinityPair(input.userOneId, input.userTwoId);
    const points = input.points ?? 0;
    const lastInteractionAt = input.interactedAt ?? new Date();

    return db.affinityPair.upsert({
      where: {
        guildId_userAId_userBId: {
          guildId: input.guildId,
          userAId,
          userBId
        }
      },
      create: {
        guildId: input.guildId,
        userAId,
        userBId,
        points,
        interactionCount: 1,
        lastInteractionAt
      },
      update: {
        points: { increment: points },
        interactionCount: { increment: 1 },
        lastInteractionAt
      }
    });
  },

  recordAction(input: RecordAffinityActionInput, db: RepositoryClient = prisma) {
    const { userAId, userBId } = normalizeAffinityPair(input.userOneId, input.userTwoId);
    const pointsAwarded = Math.max(0, input.pointsAwarded);
    const lastInteractionAt = input.interactedAt ?? new Date();
    const update: Prisma.AffinityPairUncheckedUpdateInput = {
      interactionCount: { increment: 1 },
      lastInteractionAt
    };

    if (pointsAwarded > 0) {
      update.points = { increment: pointsAwarded };
    }

    return db.affinityPair.upsert({
      where: {
        guildId_userAId_userBId: {
          guildId: input.guildId,
          userAId,
          userBId
        }
      },
      create: {
        guildId: input.guildId,
        userAId,
        userBId,
        points: pointsAwarded,
        interactionCount: 1,
        lastInteractionAt
      },
      update
    });
  },

  updatePair(
    guildId: string,
    userOneId: string,
    userTwoId: string,
    data: Prisma.AffinityPairUpdateInput,
    db: RepositoryClient = prisma
  ) {
    const { userAId, userBId } = normalizeAffinityPair(userOneId, userTwoId);

    return db.affinityPair.update({
      where: {
        guildId_userAId_userBId: {
          guildId,
          userAId,
          userBId
        }
      },
      data
    });
  },

  listByGuild(guildId: string, options: ListOptions = {}, db: RepositoryClient = prisma) {
    return db.affinityPair.findMany({
      where: { guildId },
      orderBy: [
        { points: "desc" },
        { interactionCount: "desc" },
        { updatedAt: "desc" }
      ],
      take: options.take,
      skip: options.skip
    });
  }
};
