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
