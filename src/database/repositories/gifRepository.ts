import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { GifStatus, ListOptions, RepositoryClient } from "./types";
import { DEFAULT_LIST_TAKE } from "./types";

export interface CreateGifInput
  extends Omit<
    Prisma.GifUncheckedCreateInput,
    "id" | "createdAt" | "updatedAt" | "timesUsed" | "lastUsedAt"
  > {
  status?: GifStatus;
}

export interface ListGifFilters extends ListOptions {
  guildId?: string;
  action?: string;
  category?: string;
  status?: GifStatus;
  provider?: string;
}

export interface CountApprovedGifFilters {
  guildId: string;
  action: string;
  category: string;
  provider?: string;
}

export interface GifModerationInput {
  id: string;
  actorUserId?: string;
  notes?: string;
}

export const gifRepository = {
  createGif(input: CreateGifInput, db: RepositoryClient = prisma) {
    return db.gif.create({
      data: input
    });
  },

  findByProviderGifId(provider: string, providerGifId: string, db: RepositoryClient = prisma) {
    return db.gif.findUnique({
      where: {
        provider_providerGifId: {
          provider,
          providerGifId
        }
      }
    });
  },

  findById(id: string, db: RepositoryClient = prisma) {
    return db.gif.findUnique({
      where: { id }
    });
  },

  list(filters: ListGifFilters = {}, db: RepositoryClient = prisma) {
    const where: Prisma.GifWhereInput = {
      guildId: filters.guildId,
      action: filters.action,
      category: filters.category,
      status: filters.status,
      provider: filters.provider
    };

    return db.gif.findMany({
      where,
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" }
      ],
      take: filters.take ?? DEFAULT_LIST_TAKE,
      skip: filters.skip
    });
  },

  countApproved(filters: CountApprovedGifFilters, db: RepositoryClient = prisma) {
    return db.gif.count({
      where: {
        guildId: filters.guildId,
        action: filters.action,
        category: filters.category,
        status: "approved",
        provider: filters.provider
      }
    });
  },

  approve(input: GifModerationInput, db: RepositoryClient = prisma) {
    return db.gif.update({
      where: { id: input.id },
      data: {
        status: "approved",
        approvedBy: input.actorUserId,
        blockedBy: null,
        notes: input.notes
      }
    });
  },

  block(input: GifModerationInput, db: RepositoryClient = prisma) {
    return db.gif.update({
      where: { id: input.id },
      data: {
        status: "blocked",
        blockedBy: input.actorUserId,
        notes: input.notes
      }
    });
  },

  disable(id: string, db: RepositoryClient = prisma) {
    return db.gif.update({
      where: { id },
      data: {
        status: "disabled"
      }
    });
  },

  moveActionCategory(
    id: string,
    data: Pick<Prisma.GifUncheckedUpdateInput, "action" | "category">,
    db: RepositoryClient = prisma
  ) {
    return db.gif.update({
      where: { id },
      data
    });
  },

  incrementUsage(id: string, usedAt = new Date(), db: RepositoryClient = prisma) {
    return db.gif.update({
      where: { id },
      data: {
        timesUsed: { increment: 1 },
        lastUsedAt: usedAt
      }
    });
  },

  updateGiphyMetadata(
    id: string,
    data: Pick<Prisma.GifUncheckedUpdateInput, "rating" | "searchTerm" | "giphyPageUrl">,
    db: RepositoryClient = prisma
  ) {
    return db.gif.update({
      where: { id },
      data
    });
  }
};
