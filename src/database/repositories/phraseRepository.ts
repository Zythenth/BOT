import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { ListOptions, RepositoryClient } from "./types";
import { DEFAULT_LIST_TAKE } from "./types";

export interface ListPhraseFilters extends ListOptions {
  guildId: string;
  action?: string;
  category?: string;
  isEnabled?: boolean;
}

export const phraseRepository = {
  create(data: Prisma.PhraseUncheckedCreateInput, db: RepositoryClient = prisma) {
    return db.phrase.create({
      data
    });
  },

  findById(id: string, db: RepositoryClient = prisma) {
    return db.phrase.findUnique({
      where: { id }
    });
  },

  list(filters: ListPhraseFilters, db: RepositoryClient = prisma) {
    const where: Prisma.PhraseWhereInput = {
      guildId: filters.guildId,
      action: filters.action,
      category: filters.category,
      isEnabled: filters.isEnabled
    };

    return db.phrase.findMany({
      where,
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "asc" }
      ],
      take: filters.take ?? DEFAULT_LIST_TAKE,
      skip: filters.skip
    });
  },

  update(id: string, data: Prisma.PhraseUpdateInput, db: RepositoryClient = prisma) {
    return db.phrase.update({
      where: { id },
      data
    });
  },

  setEnabled(id: string, isEnabled: boolean, db: RepositoryClient = prisma) {
    return db.phrase.update({
      where: { id },
      data: { isEnabled }
    });
  }
};
