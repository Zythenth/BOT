import { getAffinityMilestone } from "../config";
import { affinityRepository, userPreferenceRepository } from "../database";
import { guildConfigService } from "./guildConfigService";

const DEFAULT_RANKING_PAGE = 1;
const DEFAULT_RANKING_PAGE_SIZE = 10;
const MAX_RANKING_PAGE_SIZE = 25;
const RANKING_SCAN_BATCH_SIZE = 50;
const MAX_RANKING_SCAN_SIZE = 500;

export interface AffinityRankingRequest {
  guildId: string;
  page?: number;
  pageSize?: number;
  rankingEnabled?: boolean;
}

export interface AffinityRankingEntry {
  position: number;
  userAId: string;
  userBId: string;
  points: number;
  interactionCount: number;
  lastInteractionAt?: Date | null;
  milestone: ReturnType<typeof getAffinityMilestone>;
}

export interface AffinityRankingPage {
  entries: AffinityRankingEntry[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  isEnabled: boolean;
}

export const rankingService = {
  async getGuildPairRanking(request: AffinityRankingRequest): Promise<AffinityRankingPage> {
    const page = normalizePage(request.page);
    const pageSize = normalizePageSize(request.pageSize);
    const rankingEnabled =
      request.rankingEnabled ??
      (await guildConfigService.getConfig(request.guildId)).rankingEnabled;

    if (!rankingEnabled) {
      return {
        entries: [],
        page,
        pageSize,
        hasNextPage: false,
        isEnabled: false
      };
    }

    const visibleEntries = await collectVisibleRankingEntries({
      guildId: request.guildId,
      neededEntries: page * pageSize + 1
    });
    const pageStart = (page - 1) * pageSize;
    const entries = visibleEntries.slice(pageStart, pageStart + pageSize);

    return {
      entries,
      page,
      pageSize,
      hasNextPage: visibleEntries.length > pageStart + pageSize,
      isEnabled: true
    };
  }
};

async function collectVisibleRankingEntries(input: {
  guildId: string;
  neededEntries: number;
}): Promise<AffinityRankingEntry[]> {
  const entries: AffinityRankingEntry[] = [];
  let skip = 0;
  let scannedPairs = 0;

  while (entries.length < input.neededEntries && scannedPairs < MAX_RANKING_SCAN_SIZE) {
    const pairs = await affinityRepository.listByGuild(input.guildId, {
      take: RANKING_SCAN_BATCH_SIZE,
      skip
    });

    if (pairs.length === 0) {
      break;
    }

    skip += pairs.length;
    scannedPairs += pairs.length;

    const hiddenUserIds = await getHiddenRankingUserIds(
      pairs.flatMap((pair) => [pair.userAId, pair.userBId])
    );

    for (const pair of pairs) {
      if (pair.points <= 0) {
        continue;
      }

      if (hiddenUserIds.has(pair.userAId) || hiddenUserIds.has(pair.userBId)) {
        continue;
      }

      entries.push({
        position: entries.length + 1,
        userAId: pair.userAId,
        userBId: pair.userBId,
        points: pair.points,
        interactionCount: pair.interactionCount,
        lastInteractionAt: pair.lastInteractionAt,
        milestone: getAffinityMilestone(pair.points)
      });

      if (entries.length >= input.neededEntries) {
        break;
      }
    }
  }

  return entries;
}

async function getHiddenRankingUserIds(userIds: readonly string[]): Promise<Set<string>> {
  const preferences = await userPreferenceRepository.listHiddenFromRankingsByUserIds(userIds);
  return new Set(preferences.map((preference) => preference.userId));
}

function normalizePage(page: number | undefined): number {
  if (!page || !Number.isInteger(page) || page < 1) {
    return DEFAULT_RANKING_PAGE;
  }

  return page;
}

function normalizePageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isInteger(pageSize) || pageSize < 1) {
    return DEFAULT_RANKING_PAGE_SIZE;
  }

  return Math.min(pageSize, MAX_RANKING_PAGE_SIZE);
}
