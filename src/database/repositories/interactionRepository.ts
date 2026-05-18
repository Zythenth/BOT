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
  }
};
