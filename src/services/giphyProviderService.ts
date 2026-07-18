import type { GiphyRating } from "../config";
import { giphyQuotaRepository } from "../database";

const GIPHY_API_BASE_URL = "https://api.giphy.com/v1/gifs";
const GIPHY_PROVIDER = "giphy";
const DEFAULT_GIPHY_TIMEOUT_MS = 10_000;

export interface GiphyProviderConfig {
  apiKey?: string;
  requestsPerHour: number;
  rating: GiphyRating;
  lang: string;
  timeoutMs?: number;
}

export interface GiphyGif {
  provider: "giphy";
  providerGifId: string;
  title?: string;
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
  "ok" | "missing_api_key" | "quota_exhausted" | "provider_error" | "not_found";

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

export interface GiphyQuotaStore {
  consume(input: {
    provider: string;
    limit: number;
    now?: Date;
  }): Promise<GiphyQuotaSnapshot | null>;
  snapshot(input: { provider: string; limit: number; now?: Date }): Promise<GiphyQuotaSnapshot>;
}

export interface GiphyProviderService {
  search(input: GiphySearchInput): Promise<GiphySearchResult>;
  getById(providerGifId: string): Promise<GiphySingleResult>;
  buildTransientMediaUrl(providerGifId: string): string;
  getQuotaSnapshot(): Promise<GiphyQuotaSnapshot>;
  canUseApi(): Promise<boolean>;
}

export function createGiphyProviderService(
  config: GiphyProviderConfig,
  quotaStore: GiphyQuotaStore = giphyQuotaRepository,
  fetchImplementation: typeof fetch = fetch
): GiphyProviderService {
  return {
    async search(input) {
      if (!config.apiKey) {
        return { status: "missing_api_key", gifs: [] };
      }

      if (!(await reserveQuota(config, quotaStore))) {
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
        const response = await fetchImplementation(url, {
          signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_GIPHY_TIMEOUT_MS)
        });

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

      if (!(await reserveQuota(config, quotaStore))) {
        return { status: "quota_exhausted" };
      }

      const url = new URL(`${GIPHY_API_BASE_URL}/${providerGifId}`);
      url.searchParams.set("api_key", config.apiKey);

      try {
        const response = await fetchImplementation(url, {
          signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_GIPHY_TIMEOUT_MS)
        });

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

    async getQuotaSnapshot() {
      return quotaStore.snapshot({
        provider: GIPHY_PROVIDER,
        limit: config.requestsPerHour
      });
    },

    async canUseApi() {
      if (!config.apiKey) {
        return false;
      }

      const snapshot = await quotaStore.snapshot({
        provider: GIPHY_PROVIDER,
        limit: config.requestsPerHour
      });

      return snapshot.remaining > 0;
    }
  };
}

async function reserveQuota(
  config: GiphyProviderConfig,
  quotaStore: GiphyQuotaStore
): Promise<boolean> {
  const snapshot = await quotaStore.consume({
    provider: GIPHY_PROVIDER,
    limit: config.requestsPerHour
  });

  return Boolean(snapshot);
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
  title?: string;
  slug?: string;
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
    title: input.title ?? input.slug,
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
