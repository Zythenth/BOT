import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { ListOptions, RepositoryClient } from "./types";
import { DEFAULT_LIST_TAKE } from "./types";

export interface FindMatchingBlockInput {
  guildId: string;
  blockerUserId: string;
  blockedUserId?: string;
  category?: string;
  action?: string;
}

export interface ListBlocksFilters extends ListOptions {
  guildId: string;
  blockerUserId?: string;
  blockedUserId?: string;
  category?: string;
}

export interface ExactBlockFilters {
  guildId: string;
  blockerUserId: string;
  blockedUserId?: string | null;
  category?: string | null;
  action?: string | null;
}

export const blockRepository = {
  create(data: Prisma.BlockUncheckedCreateInput, db: RepositoryClient = prisma) {
    return db.block.create({
      data
    });
  },

  findMatching(input: FindMatchingBlockInput, db: RepositoryClient = prisma) {
    const and: Prisma.BlockWhereInput[] = [];

    if (input.blockedUserId) {
      and.push({
        OR: [
          { blockedUserId: input.blockedUserId },
          { blockedUserId: null }
        ]
      });
    }

    if (input.category) {
      and.push({
        OR: [
          { category: input.category },
          { category: null }
        ]
      });
    }

    if (input.action) {
      and.push({
        OR: [
          { action: input.action },
          { action: null }
        ]
      });
    }

    return db.block.findFirst({
      where: {
        guildId: input.guildId,
        blockerUserId: input.blockerUserId,
        ...(and.length > 0 ? { AND: and } : {})
      },
      orderBy: { createdAt: "desc" }
    });
  },

  list(filters: ListBlocksFilters, db: RepositoryClient = prisma) {
    const where: Prisma.BlockWhereInput = {
      guildId: filters.guildId,
      blockerUserId: filters.blockerUserId,
      blockedUserId: filters.blockedUserId,
      category: filters.category
    };

    return db.block.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.take ?? DEFAULT_LIST_TAKE,
      skip: filters.skip
    });
  },

  listForUser(userId: string, db: RepositoryClient = prisma) {
    return db.block.findMany({
      where: buildUserWhere(userId),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        guildId: true,
        blockerUserId: true,
        blockedUserId: true,
        category: true,
        action: true,
        createdAt: true
      }
    });
  },

  countForUser(userId: string, db: RepositoryClient = prisma) {
    return db.block.count({
      where: buildUserWhere(userId)
    });
  },

  deleteForUser(userId: string, db: RepositoryClient = prisma) {
    return db.block.deleteMany({
      where: buildUserWhere(userId)
    });
  },

  findExact(filters: ExactBlockFilters, db: RepositoryClient = prisma) {
    return db.block.findFirst({
      where: buildExactWhere(filters)
    });
  },

  deleteMany(filters: ExactBlockFilters, db: RepositoryClient = prisma) {
    return db.block.deleteMany({
      where: buildExactWhere(filters)
    });
  },

  deleteAllForBlocker(guildId: string, blockerUserId: string, db: RepositoryClient = prisma) {
    return db.block.deleteMany({
      where: {
        guildId,
        blockerUserId
      }
    });
  },

  deleteById(id: string, db: RepositoryClient = prisma) {
    return db.block.delete({
      where: { id }
    });
  }
};

function buildExactWhere(filters: ExactBlockFilters): Prisma.BlockWhereInput {
  return {
    guildId: filters.guildId,
    blockerUserId: filters.blockerUserId,
    blockedUserId: filters.blockedUserId ?? null,
    category: filters.category ?? null,
    action: filters.action ?? null
  };
}

function buildUserWhere(userId: string): Prisma.BlockWhereInput {
  return {
    blockerUserId: userId
  };
}
