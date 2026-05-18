import type { GiphyRating } from "../config";

const GIPHY_API_BASE_URL = "https://api.giphy.com/v1/gifs";
const GIPHY_PROVIDER = "giphy";

export interface GiphyProviderConfig {
  apiKey?: string;
  requestsPerHour: number;
  rating: GiphyRating;
  lang: string;
}

export interface GiphyGif {
  provider: "giphy";
  providerGifId: string;
  rating?: string;
  pageUrl?: string;
  mediaUrl?: string;
}

export interface GiphySearchInput {
  searchTerm: string;
  limit?: number;
  offset?: number;
}

export type GiphyProviderStatus =
  | "ok"
  | "missing_api_key"
  | "quota_exhausted"
  | "provider_error"
  | "not_found";

export interface GiphySearchResult {
  status: GiphyProviderStatus;
  gifs: GiphyGif[];
}

export interface GiphySingleResult {
  status: GiphyProviderStatus;
  gif?: GiphyGif;
}

export interface GiphyQuotaSnapshot {
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
}

export class HourlyGiphyRateLimiter {
  private windowStartedAt = Date.now();
  private used = 0;

  constructor(private readonly limit: number) {}

  canConsume(now = Date.now()): boolean {
    this.resetIfNeeded(now);
    return this.used < this.limit;
  }

  consume(now = Date.now()): boolean {
    if (!this.canConsume(now)) {
      return false;
    }

    this.used += 1;
    return true;
  }

  snapshot(now = Date.now()): GiphyQuotaSnapshot {
    this.resetIfNeeded(now);

    return {
      limit: this.limit,
      used: this.used,
      remaining: Math.max(this.limit - this.used, 0),
      resetAt: new Date(this.windowStartedAt + 60 * 60 * 1000)
    };
  }

  private resetIfNeeded(now: number): void {
    if (now - this.windowStartedAt < 60 * 60 * 1000) {
      return;
    }

    this.windowStartedAt = now;
    this.used = 0;
  }
}

export interface GiphyProviderService {
  search(input: GiphySearchInput): Promise<GiphySearchResult>;
  getById(providerGifId: string): Promise<GiphySingleResult>;
  buildTransientMediaUrl(providerGifId: string): string;
  getQuotaSnapshot(): GiphyQuotaSnapshot;
  canUseApi(): boolean;
}

export function createGiphyProviderService(
  config: GiphyProviderConfig,
  limiter = new HourlyGiphyRateLimiter(config.requestsPerHour)
): GiphyProviderService {
  return {
    async search(input) {
      if (!config.apiKey) {
        return { status: "missing_api_key", gifs: [] };
      }

      if (!limiter.consume()) {
        return { status: "quota_exhausted", gifs: [] };
      }

      const url = new URL(`${GIPHY_API_BASE_URL}/search`);
      url.searchParams.set("api_key", config.apiKey);
      url.searchParams.set("q", input.searchTerm);
      url.searchParams.set("limit", String(input.limit ?? 10));
      url.searchParams.set("offset", String(input.offset ?? 0));
      url.searchParams.set("rating", config.rating);
      url.searchParams.set("lang", config.lang);

      try {
        const response = await fetch(url);

        if (!response.ok) {
          return { status: "provider_error", gifs: [] };
        }

        const payload = (await response.json()) as GiphySearchPayload;
        return {
          status: "ok",
          gifs: payload.data.map(toGiphyGif).filter(isDefined)
        };
      } catch {
        return { status: "provider_error", gifs: [] };
      }
    },

    async getById(providerGifId) {
      if (!config.apiKey) {
        return { status: "missing_api_key" };
      }

      if (!limiter.consume()) {
        return { status: "quota_exhausted" };
      }

      const url = new URL(`${GIPHY_API_BASE_URL}/${providerGifId}`);
      url.searchParams.set("api_key", config.apiKey);

      try {
        const response = await fetch(url);

        if (response.status === 404) {
          return { status: "not_found" };
        }

        if (!response.ok) {
          return { status: "provider_error" };
        }

        const payload = (await response.json()) as GiphySinglePayload;
        const gif = toGiphyGif(payload.data);

        if (!gif) {
          return { status: "not_found" };
        }

        return { status: "ok", gif };
      } catch {
        return { status: "provider_error" };
      }
    },

    buildTransientMediaUrl(providerGifId) {
      return `https://media.giphy.com/media/${encodeURIComponent(providerGifId)}/giphy.gif`;
    },

    getQuotaSnapshot() {
      return limiter.snapshot();
    },

    canUseApi() {
      return Boolean(config.apiKey) && limiter.canConsume();
    }
  };
}

export function readGiphyProviderConfigFromEnv(): GiphyProviderConfig {
  return {
    apiKey: readOptionalString("GIPHY_API_KEY"),
    requestsPerHour: readInteger("GIPHY_REQUESTS_PER_HOUR", 100),
    rating: readGiphyRating(),
    lang: readString("GIPHY_LANG", "pt")
  };
}

export const giphyProviderService = createGiphyProviderService(readGiphyProviderConfigFromEnv());

interface GiphySearchPayload {
  data: GiphyApiGif[];
}

interface GiphySinglePayload {
  data: GiphyApiGif;
}

interface GiphyApiGif {
  id?: string;
  url?: string;
  rating?: string;
  images?: {
    original?: GiphyImage;
    downsized_medium?: GiphyImage;
    fixed_height?: GiphyImage;
  };
}

interface GiphyImage {
  url?: string;
}

function toGiphyGif(input: GiphyApiGif): GiphyGif | undefined {
  if (!input.id) {
    return undefined;
  }

  return {
    provider: GIPHY_PROVIDER,
    providerGifId: input.id,
    rating: input.rating,
    pageUrl: input.url,
    mediaUrl:
      input.images?.original?.url ??
      input.images?.downsized_medium?.url ??
      input.images?.fixed_height?.url
  };
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function readOptionalString(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function readString(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function readInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readGiphyRating(): GiphyRating {
  const allowNsfw = readBoolean("ALLOW_NSFW", false);
  const rating = readString("GIPHY_RATING", "pg").toLowerCase();

  if (!["g", "pg", "pg-13", "r"].includes(rating)) {
    return "pg";
  }

  if (!allowNsfw && rating === "r") {
    return "pg";
  }

  return rating as GiphyRating;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "y", "on"].includes(value);
}
