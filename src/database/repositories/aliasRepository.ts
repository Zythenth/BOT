import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { ListOptions, RepositoryClient } from "./types";
import { DEFAULT_LIST_TAKE } from "./types";

export interface ListAliasFilters extends ListOptions {
  guildId: string;
  commandName?: string;
  isEnabled?: boolean;
}

export const aliasRepository = {
  create(data: Prisma.AliasUncheckedCreateInput, db: RepositoryClient = prisma) {
    return db.alias.create({
      data
    });
  },

  findByAlias(guildId: string, alias: string, db: RepositoryClient = prisma) {
    return db.alias.findUnique({
      where: {
        guildId_alias: {
          guildId,
          alias
        }
      }
    });
  },

  list(filters: ListAliasFilters, db: RepositoryClient = prisma) {
    const where: Prisma.AliasWhereInput = {
      guildId: filters.guildId,
      commandName: filters.commandName,
      isEnabled: filters.isEnabled
    };

    return db.alias.findMany({
      where,
      orderBy: { alias: "asc" },
      take: filters.take ?? DEFAULT_LIST_TAKE,
      skip: filters.skip
    });
  },

  setEnabled(id: string, isEnabled: boolean, db: RepositoryClient = prisma) {
    return db.alias.update({
      where: { id },
      data: { isEnabled }
    });
  },

  update(id: string, data: Prisma.AliasUpdateInput, db: RepositoryClient = prisma) {
    return db.alias.update({
      where: { id },
      data
    });
  }
};
