import { prisma } from "../prisma";
import type { RepositoryClient } from "./types";

export interface GiphyQuotaWindowInput {
  provider: string;
  limit: number;
  now?: Date;
}

export interface GiphyQuotaWindowSnapshot {
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
}

export const giphyQuotaRepository = {
  async consume(
    input: GiphyQuotaWindowInput,
    db: RepositoryClient = prisma
  ): Promise<GiphyQuotaWindowSnapshot | null> {
    const window = getHourlyWindow(input.now ?? new Date());
    const quotaWindow = await db.giphyQuotaWindow.upsert({
      where: {
        provider_windowStartedAt: {
          provider: input.provider,
          windowStartedAt: window.startedAt
        }
      },
      create: {
        provider: input.provider,
        windowStartedAt: window.startedAt,
        windowEndsAt: window.endsAt,
        used: 0,
        limit: input.limit
      },
      update: {
        windowEndsAt: window.endsAt,
        limit: input.limit
      }
    });
    const consumed = await db.giphyQuotaWindow.updateMany({
      where: {
        id: quotaWindow.id,
        used: { lt: input.limit }
      },
      data: {
        used: { increment: 1 },
        limit: input.limit,
        windowEndsAt: window.endsAt
      }
    });

    if (consumed.count === 0) {
      return null;
    }

    const updated = await db.giphyQuotaWindow.findUnique({
      where: { id: quotaWindow.id }
    });

    return toSnapshot(updated?.used ?? input.limit, input.limit, window.endsAt);
  },

  async snapshot(
    input: GiphyQuotaWindowInput,
    db: RepositoryClient = prisma
  ): Promise<GiphyQuotaWindowSnapshot> {
    const window = getHourlyWindow(input.now ?? new Date());
    const quotaWindow = await db.giphyQuotaWindow.findUnique({
      where: {
        provider_windowStartedAt: {
          provider: input.provider,
          windowStartedAt: window.startedAt
        }
      }
    });

    return toSnapshot(quotaWindow?.used ?? 0, input.limit, window.endsAt);
  }
};

function getHourlyWindow(now: Date): { startedAt: Date; endsAt: Date } {
  const startedAt = new Date(now);
  startedAt.setUTCMinutes(0, 0, 0);

  return {
    startedAt,
    endsAt: new Date(startedAt.getTime() + 60 * 60 * 1000)
  };
}

function toSnapshot(used: number, limit: number, resetAt: Date): GiphyQuotaWindowSnapshot {
  return {
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    resetAt
  };
}
