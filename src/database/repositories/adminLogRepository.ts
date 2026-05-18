import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { ListOptions, RepositoryClient } from "./types";
import { DEFAULT_LIST_TAKE } from "./types";

export interface AdminActionLogInput {
  guildId: string;
  actorUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: string;
}

export interface ListAdminLogsFilters extends ListOptions {
  guildId: string;
  actorUserId?: string;
  action?: string;
}

export const adminLogRepository = {
  create(data: Prisma.AdminLogUncheckedCreateInput, db: RepositoryClient = prisma) {
    return db.adminLog.create({
      data
    });
  },

  logAction(input: AdminActionLogInput, db: RepositoryClient = prisma) {
    return db.adminLog.create({
      data: input
    });
  },

  listByGuild(filters: ListAdminLogsFilters, db: RepositoryClient = prisma) {
    const where: Prisma.AdminLogWhereInput = {
      guildId: filters.guildId,
      actorUserId: filters.actorUserId,
      action: filters.action
    };

    return db.adminLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.take ?? DEFAULT_LIST_TAKE,
      skip: filters.skip
    });
  }
};
