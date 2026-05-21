import { GIF_RATIO_BUCKETS, type GifRatioBucket } from "../config";
import { gifRepository } from "../database";
import type { ActionCategory, ActionName } from "../types";

export type GifSourceChoice = "database" | "giphy";

export interface GifRatioRequest {
  guildId: string;
  action: ActionName;
  category: ActionCategory;
  provider?: string;
}

export interface GifRatioDecisionOptions {
  canUseGiphy: boolean;
}

export interface GifRatioResult {
  approvedCount: number;
  bucket: GifRatioBucket;
  databaseRatio: number;
  giphyRatio: number;
}

export interface GifRatioDecision extends GifRatioResult {
  selectedSource: GifSourceChoice;
}

export interface GifRatioService {
  getRatioForApprovedCount(approvedCount: number): GifRatioResult;
  countApproved(request: GifRatioRequest): Promise<number>;
  decideSource(request: GifRatioRequest, options: GifRatioDecisionOptions): Promise<GifRatioDecision>;
}

export interface GifRatioServiceOptions {
  random?: () => number;
}

export function createGifRatioService(options: GifRatioServiceOptions = {}): GifRatioService {
  const random = options.random ?? Math.random;

  function getRatioForApprovedCount(approvedCount: number): GifRatioResult {
    const bucket = getRatioBucketForApprovedCount(approvedCount);

    return {
      approvedCount,
      bucket,
      databaseRatio: bucket.databaseRatio,
      giphyRatio: bucket.giphyRatio
    };
  }

  function countApproved(request: GifRatioRequest): Promise<number> {
    return gifRepository.countApproved({
      guildId: request.guildId,
      action: request.action,
      category: request.category,
      provider: request.provider ?? "giphy"
    });
  }

  return {
    getRatioForApprovedCount,
    countApproved,

    async decideSource(request, options) {
      const approvedCount = await countApproved(request);
      const ratio = getRatioForApprovedCount(approvedCount);
      const selectedSource = chooseSource({
        approvedCount,
        databaseRatio: ratio.databaseRatio,
        canUseGiphy: options.canUseGiphy,
        random
      });

      return {
        ...ratio,
        selectedSource
      };
    }
  };
}

export const gifRatioService = createGifRatioService();

export function getRatioBucketForApprovedCount(approvedCount: number): GifRatioBucket {
  const safeCount = Math.max(Math.floor(approvedCount), 0);
  const buckets: readonly GifRatioBucket[] = GIF_RATIO_BUCKETS;
  const bucket = buckets.find((candidate) => {
    const underMax = candidate.maxApproved === undefined || safeCount <= candidate.maxApproved;
    return safeCount >= candidate.minApproved && underMax;
  });

  return bucket ?? buckets[buckets.length - 1];
}

function chooseSource(input: {
  approvedCount: number;
  databaseRatio: number;
  canUseGiphy: boolean;
  random: () => number;
}): GifSourceChoice {
  if (!input.canUseGiphy) {
    return "database";
  }

  if (input.approvedCount <= 0) {
    return "giphy";
  }

  return input.random() < input.databaseRatio ? "database" : "giphy";
}
