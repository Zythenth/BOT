import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { RepositoryClient } from "./types";

export const buttonInteractionStateRepository = {
  create(data: Prisma.ButtonInteractionStateUncheckedCreateInput, db: RepositoryClient = prisma) {
    return db.buttonInteractionState.create({
      data
    });
  },

  findByCustomId(customId: string, db: RepositoryClient = prisma) {
    return db.buttonInteractionState.findUnique({
      where: { customId }
    });
  },

  listForUser(userId: string, db: RepositoryClient = prisma) {
    return db.buttonInteractionState.findMany({
      where: buildUserWhere(userId),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        guildId: true,
        action: true,
        originalAuthorId: true,
        originalTargetId: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true
      }
    });
  },

  countForUser(userId: string, db: RepositoryClient = prisma) {
    return db.buttonInteractionState.count({
      where: buildUserWhere(userId)
    });
  },

  deleteForUser(userId: string, db: RepositoryClient = prisma) {
    return db.buttonInteractionState.deleteMany({
      where: buildUserWhere(userId)
    });
  },

  markUsed(customId: string, usedAt = new Date(), db: RepositoryClient = prisma) {
    return db.buttonInteractionState.update({
      where: { customId },
      data: { usedAt }
    });
  },

  deleteExpired(now = new Date(), db: RepositoryClient = prisma) {
    return db.buttonInteractionState.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    });
  }
};

function buildUserWhere(userId: string): Prisma.ButtonInteractionStateWhereInput {
  return {
    OR: [
      { originalAuthorId: userId },
      { originalTargetId: userId }
    ]
  };
}
