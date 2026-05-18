import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gifRepository } from "../database";
import type { ActionCategory, ActionGifSelection, ActionName } from "../types";
import {
  giphyProviderService,
  type GiphyGif,
  type GiphyProviderService
} from "./giphyProviderService";
import { gifRatioService, type GifRatioService } from "./gifRatioService";

export interface GifServiceConfig {
  allowUncategorizedGifs: boolean;
  provider: string;
}

export interface GifSelectionRequest {
  guildId: string;
  action: ActionName;
  category: ActionCategory;
  addedBy?: string;
}

export interface GifService {
  chooseGif(request: GifSelectionRequest): Promise<ActionGifSelection | undefined>;
  markGifUsed(gifId: string, usedAt?: Date): Promise<void>;
}

type SearchTermsByAction = Record<string, string[]>;

export function createGifService(
  config: GifServiceConfig = readGifServiceConfigFromEnv(),
  provider: GiphyProviderService = giphyProviderService,
  ratioService: GifRatioService = gifRatioService,
  searchTerms: SearchTermsByAction = loadSearchTerms()
): GifService {
  return {
    async chooseGif(request) {
      if (config.provider !== "giphy") {
        return undefined;
      }

      const decision = await ratioService.decideSource(
        {
          guildId: request.guildId,
          action: request.action,
          category: request.category,
          provider: "giphy"
        },
        {
          canUseGiphy: provider.canUseApi()
        }
      );

      if (decision.selectedSource === "database") {
        const approvedGif = await pickApprovedGif(request, provider);

        if (approvedGif || !provider.canUseApi()) {
          return approvedGif;
        }
      }

      const searchTerm = pickSearchTerm(searchTerms, request.action);

      if (!searchTerm || !provider.canUseApi()) {
        return pickApprovedGif(request, provider);
      }

      const result = await provider.search({
        searchTerm,
        limit: 10
      });

      if (result.status !== "ok") {
        return pickApprovedGif(request, provider);
      }

      const giphyGif = pickRandom(result.gifs);

      if (!giphyGif) {
        return undefined;
      }

      const storedGif = await upsertImportedGif({
        request,
        giphyGif,
        searchTerm,
        allowUncategorizedGifs: config.allowUncategorizedGifs
      });

      if (!canUseStoredGif(storedGif, request, config.allowUncategorizedGifs)) {
        return pickApprovedGif(request, provider);
      }

      return {
        id: storedGif.id,
        provider: storedGif.provider,
        providerGifId: storedGif.providerGifId,
        imageUrl: giphyGif.mediaUrl ?? provider.buildTransientMediaUrl(storedGif.providerGifId)
      };
    },

    async markGifUsed(gifId, usedAt = new Date()) {
      await gifRepository.incrementUsage(gifId, usedAt);
    }
  };
}

export const gifService = createGifService();

export function readGifServiceConfigFromEnv(): GifServiceConfig {
  return {
    provider: readString("GIF_PROVIDER", "giphy"),
    allowUncategorizedGifs: readBoolean("ALLOW_UNCATEGORIZED_GIFS", true)
  };
}

async function pickApprovedGif(
  request: GifSelectionRequest,
  provider: GiphyProviderService
): Promise<ActionGifSelection | undefined> {
  const approvedGifs = await gifRepository.list({
    guildId: request.guildId,
    action: request.action,
    category: request.category,
    status: "approved",
    provider: "giphy",
    take: 25
  });
  const gif = pickRandom(approvedGifs);

  if (!gif) {
    return undefined;
  }

  const refreshed = await provider.getById(gif.providerGifId);

  if (refreshed.status === "ok" && refreshed.gif) {
    await gifRepository.updateGiphyMetadata(gif.id, {
      rating: refreshed.gif.rating,
      giphyPageUrl: refreshed.gif.pageUrl
    });

    return {
      id: gif.id,
      provider: gif.provider,
      providerGifId: gif.providerGifId,
      imageUrl: refreshed.gif.mediaUrl ?? provider.buildTransientMediaUrl(gif.providerGifId)
    };
  }

  return {
    id: gif.id,
    provider: gif.provider,
    providerGifId: gif.providerGifId,
    imageUrl: provider.buildTransientMediaUrl(gif.providerGifId)
  };
}

async function upsertImportedGif(input: {
  request: GifSelectionRequest;
  giphyGif: GiphyGif;
  searchTerm: string;
  allowUncategorizedGifs: boolean;
}) {
  const existingGif = await gifRepository.findByProviderGifId(
    input.giphyGif.provider,
    input.giphyGif.providerGifId
  );

  if (existingGif) {
    return gifRepository.updateGiphyMetadata(existingGif.id, {
      rating: input.giphyGif.rating,
      giphyPageUrl: input.giphyGif.pageUrl,
      searchTerm: input.searchTerm
    });
  }

  return gifRepository.createGif({
    guildId: input.request.guildId,
    provider: input.giphyGif.provider,
    providerGifId: input.giphyGif.providerGifId,
    action: input.request.action,
    category: input.request.category,
    status: input.allowUncategorizedGifs ? "uncategorized" : "pending",
    rating: input.giphyGif.rating ?? "pg",
    searchTerm: input.searchTerm,
    giphyPageUrl: input.giphyGif.pageUrl,
    addedBy: input.request.addedBy
  });
}

function loadSearchTerms(): SearchTermsByAction {
  const filePath = path.resolve(process.cwd(), "data", "giphy-search-terms.json");

  if (!existsSync(filePath)) {
    return {};
  }

  const rawJson = readFileSync(filePath, "utf8");
  return JSON.parse(rawJson) as SearchTermsByAction;
}

function pickSearchTerm(searchTerms: SearchTermsByAction, action: ActionName): string | undefined {
  return pickRandom(searchTerms[action] ?? []);
}

function canUseStoredGif(
  gif: {
    guildId: string;
    action: string;
    category: string;
    status: string;
  },
  request: GifSelectionRequest,
  allowUncategorizedGifs: boolean
): boolean {
  if (
    gif.guildId !== request.guildId ||
    gif.action !== request.action ||
    gif.category !== request.category
  ) {
    return false;
  }

  if (gif.status === "approved") {
    return true;
  }

  return allowUncategorizedGifs && gif.status === "uncategorized";
}

function pickRandom<T>(values: T[]): T | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return values[Math.floor(Math.random() * values.length)];
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (["1", "true", "yes", "y", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(value)) {
    return false;
  }

  return fallback;
}

function readString(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}
