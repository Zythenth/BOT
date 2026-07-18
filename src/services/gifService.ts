import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gifRepository, type GifStatus } from "../database";
import type { ActionCategory, ActionGifSelection, ActionName } from "../types";
import {
  giphyProviderService,
  type GiphyGif,
  type GiphyProviderService
} from "./giphyProviderService";
import { gifRatioService, type GifRatioService } from "./gifRatioService";
import { logger } from "../utils";

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
}

export interface StoredGifLike {
  id: string;
  guildId: string;
  provider: string;
  providerGifId: string;
  action: string;
  category: string;
  status: string;
}

export interface CreateImportedGifInput {
  guildId: string;
  provider: string;
  providerGifId: string;
  action: ActionName;
  category: ActionCategory;
  status: GifStatus;
  rating?: string;
  searchTerm?: string;
  giphyPageUrl?: string;
  addedBy?: string;
}

export interface GifStorage {
  listApproved(request: GifSelectionRequest): Promise<StoredGifLike[]>;
  findByProviderGifId(provider: string, providerGifId: string): Promise<StoredGifLike | null>;
  createImportedGif(input: CreateImportedGifInput): Promise<StoredGifLike>;
  updateGiphyMetadata(
    id: string,
    data: {
      rating?: string;
      giphyPageUrl?: string;
      searchTerm?: string;
      status?: GifStatus;
    }
  ): Promise<StoredGifLike>;
}

type SearchTermsByAction = Record<string, string[]>;

export function createGifService(
  config: GifServiceConfig = readGifServiceConfigFromEnv(),
  provider: GiphyProviderService = giphyProviderService,
  ratioService: GifRatioService = gifRatioService,
  searchTerms: SearchTermsByAction = loadSearchTerms(),
  storage: GifStorage = defaultGifStorage
): GifService {
  return {
    async chooseGif(request) {
      if (config.provider !== "giphy") {
        logGifSelection("disabled_provider", request, { provider: config.provider });
        return undefined;
      }

      const canUseGiphy = await provider.canUseApi();
      const decision = await ratioService.decideSource(
        {
          guildId: request.guildId,
          action: request.action,
          category: request.category,
          provider: "giphy"
        },
        {
          canUseGiphy
        }
      );

      if (decision.selectedSource === "database") {
        const approvedGif = await pickApprovedGif(request, provider, storage);

        if (approvedGif || !(await provider.canUseApi())) {
          logGifSelection(approvedGif ? "database" : "none", request, {
            selectedSource: decision.selectedSource,
            canUseGiphy,
            approvedCount: decision.approvedCount
          });
          return approvedGif;
        }
      }

      const searchTermsForAction = pickSearchTerms(searchTerms, request.action, 3);

      if (searchTermsForAction.length === 0 && !(await provider.canUseApi())) {
        const approvedGif = await pickApprovedGif(request, provider, storage);
        logGifSelection(approvedGif ? "database_fallback" : "none", request, {
          reason: "giphy_unavailable",
          canUseGiphy,
          approvedCount: decision.approvedCount
        });
        return approvedGif;
      }

      const searchedGif = await searchAnimeGif({
        request,
        provider,
        storage,
        searchTerms: searchTermsForAction,
        allowUncategorizedGifs: config.allowUncategorizedGifs,
        matchKeywords: getActionResultKeywords(request.action),
        requireAnimeKeywords: true
      });

      if (searchedGif.selection) {
        logGifSelection("giphy", request, {
          searchTerm: searchedGif.searchTerm,
          storedStatus: searchedGif.storedStatus,
          approvedCount: decision.approvedCount,
          hasMediaUrl: searchedGif.hasMediaUrl,
          giphyResultCount: searchedGif.giphyResultCount,
          animeResultCount: searchedGif.animeResultCount,
          matchingResultCount: searchedGif.matchingResultCount
        });
        return searchedGif.selection;
      }

      const fallbackSearchTerms = pickGenericAffectionSearchTerms(searchTerms, 1);
      const fallbackSearchedGif = await searchAnimeGif({
        request,
        provider,
        storage,
        searchTerms: fallbackSearchTerms,
        allowUncategorizedGifs: config.allowUncategorizedGifs,
        matchKeywords: [],
        requireAnimeKeywords: false
      });

      if (fallbackSearchedGif.selection) {
        logGifSelection("giphy_affection_fallback", request, {
          reason: searchedGif.reason,
          searchTerm: fallbackSearchedGif.searchTerm,
          specificSearchTerms: searchedGif.searchTermsTried,
          fallbackSearchTerms: fallbackSearchedGif.searchTermsTried,
          storedStatus: fallbackSearchedGif.storedStatus,
          approvedCount: decision.approvedCount,
          hasMediaUrl: fallbackSearchedGif.hasMediaUrl,
          giphyResultCount: fallbackSearchedGif.giphyResultCount,
          animeResultCount: fallbackSearchedGif.animeResultCount,
          matchingResultCount: fallbackSearchedGif.matchingResultCount
        });
        return fallbackSearchedGif.selection;
      }

      const approvedGif = await pickApprovedGif(request, provider, storage);
      logGifSelection(approvedGif ? "database_fallback" : "none", request, {
        reason: fallbackSearchedGif.reason ?? searchedGif.reason,
        specificSearchTerms: searchedGif.searchTermsTried,
        fallbackSearchTerms: fallbackSearchedGif.searchTermsTried,
        giphyResultCount: searchedGif.giphyResultCount + fallbackSearchedGif.giphyResultCount,
        animeResultCount: searchedGif.animeResultCount + fallbackSearchedGif.animeResultCount,
        matchingResultCount:
          searchedGif.matchingResultCount + fallbackSearchedGif.matchingResultCount,
        approvedCount: decision.approvedCount
      });
      return approvedGif;
    }
  };
}

export function readGifServiceConfigFromEnv(): GifServiceConfig {
  return {
    provider: readString("GIF_PROVIDER", "giphy"),
    allowUncategorizedGifs: readBoolean("ALLOW_UNCATEGORIZED_GIFS", true)
  };
}

async function pickApprovedGif(
  request: GifSelectionRequest,
  provider: GiphyProviderService,
  storage: GifStorage
): Promise<ActionGifSelection | undefined> {
  const approvedGifs = await storage.listApproved(request);
  const gif = pickRandom(approvedGifs);

  if (!gif) {
    return undefined;
  }

  const refreshed = await provider.getById(gif.providerGifId);

  if (refreshed.status === "ok" && refreshed.gif) {
    await storage.updateGiphyMetadata(gif.id, {
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

async function upsertImportedGif(
  input: {
    request: GifSelectionRequest;
    giphyGif: GiphyGif;
    searchTerm: string;
  },
  storage: GifStorage
): Promise<StoredGifLike> {
  const existingGif = await storage.findByProviderGifId(
    input.giphyGif.provider,
    input.giphyGif.providerGifId
  );

  if (existingGif) {
    const shouldAutoApproveExistingGif =
      (existingGif.status === "uncategorized" || existingGif.status === "pending") &&
      canUseStoredGif(existingGif, input.request, true);

    return storage.updateGiphyMetadata(existingGif.id, {
      rating: input.giphyGif.rating,
      giphyPageUrl: input.giphyGif.pageUrl,
      searchTerm: input.searchTerm,
      status: shouldAutoApproveExistingGif ? "approved" : undefined
    });
  }

  return storage.createImportedGif({
    guildId: input.request.guildId,
    provider: input.giphyGif.provider,
    providerGifId: input.giphyGif.providerGifId,
    action: input.request.action,
    category: input.request.category,
    status: "approved",
    rating: input.giphyGif.rating ?? "pg",
    searchTerm: input.searchTerm,
    giphyPageUrl: input.giphyGif.pageUrl,
    addedBy: input.request.addedBy
  });
}

async function searchAnimeGif(input: {
  request: GifSelectionRequest;
  provider: GiphyProviderService;
  storage: GifStorage;
  searchTerms: readonly string[];
  allowUncategorizedGifs: boolean;
  matchKeywords: readonly string[];
  requireAnimeKeywords: boolean;
}): Promise<{
  selection?: ActionGifSelection;
  reason?: string;
  searchTerm?: string;
  storedStatus?: string;
  hasMediaUrl?: boolean;
  searchTermsTried: string[];
  giphyResultCount: number;
  animeResultCount: number;
  matchingResultCount: number;
}> {
  const searchTermsTried: string[] = [];
  let giphyResultCount = 0;
  let animeResultCount = 0;
  let matchingResultCount = 0;

  if (input.searchTerms.length === 0) {
    return {
      reason: "missing_search_term",
      searchTermsTried,
      giphyResultCount,
      animeResultCount,
      matchingResultCount
    };
  }

  for (const searchTerm of input.searchTerms) {
    if (!(await input.provider.canUseApi())) {
      return {
        reason: "giphy_unavailable",
        searchTermsTried,
        giphyResultCount,
        animeResultCount,
        matchingResultCount
      };
    }

    searchTermsTried.push(searchTerm);
    const result = await input.provider.search({
      searchTerm,
      limit: 15
    });

    if (result.status !== "ok") {
      return {
        reason: result.status,
        searchTermsTried,
        giphyResultCount,
        animeResultCount,
        matchingResultCount
      };
    }

    giphyResultCount += result.gifs.length;

    const animeGifs = input.requireAnimeKeywords
      ? filterAnimeGifs(result.gifs)
      : filterBlockedGifs(result.gifs);
    animeResultCount += animeGifs.length;

    const matchingGifs =
      input.matchKeywords.length > 0
        ? filterGifsByKeywords(animeGifs, input.matchKeywords)
        : animeGifs;
    matchingResultCount += matchingGifs.length;

    const giphyGif = pickRandom(matchingGifs);

    if (!giphyGif) {
      continue;
    }

    const storedGif = await upsertImportedGif(
      {
        request: input.request,
        giphyGif,
        searchTerm
      },
      input.storage
    );

    if (!canUseStoredGif(storedGif, input.request, input.allowUncategorizedGifs)) {
      return {
        reason: "stored_gif_not_allowed",
        searchTerm,
        storedStatus: storedGif.status,
        searchTermsTried,
        giphyResultCount,
        animeResultCount,
        matchingResultCount
      };
    }

    return {
      selection: {
        id: storedGif.id,
        provider: storedGif.provider,
        providerGifId: storedGif.providerGifId,
        imageUrl:
          giphyGif.mediaUrl ?? input.provider.buildTransientMediaUrl(storedGif.providerGifId)
      },
      searchTerm,
      storedStatus: storedGif.status,
      hasMediaUrl: Boolean(giphyGif.mediaUrl),
      searchTermsTried,
      giphyResultCount,
      animeResultCount,
      matchingResultCount
    };
  }

  return {
    reason:
      giphyResultCount === 0
        ? "empty_giphy_result"
        : animeResultCount === 0
          ? "giphy_result_not_anime"
          : "giphy_result_not_matching_action",
    searchTermsTried,
    giphyResultCount,
    animeResultCount,
    matchingResultCount
  };
}

const defaultGifStorage: GifStorage = {
  listApproved(request) {
    return gifRepository.list({
      guildId: request.guildId,
      action: request.action,
      category: request.category,
      status: "approved",
      provider: "giphy",
      take: 25
    });
  },

  findByProviderGifId(provider, providerGifId) {
    return gifRepository.findByProviderGifId(provider, providerGifId);
  },

  createImportedGif(input) {
    return gifRepository.createGif(input);
  },

  updateGiphyMetadata(id, data) {
    return gifRepository.updateGiphyMetadata(id, data);
  }
};

export const gifService = createGifService();

function loadSearchTerms(): SearchTermsByAction {
  const filePath = path.resolve(process.cwd(), "data", "giphy-search-terms.json");

  if (!existsSync(filePath)) {
    return {};
  }

  const rawJson = readFileSync(filePath, "utf8");
  return JSON.parse(rawJson) as SearchTermsByAction;
}

function pickSearchTerms(
  searchTerms: SearchTermsByAction,
  action: ActionName,
  take: number
): string[] {
  return shuffle(searchTerms[action] ?? []).slice(0, take);
}

function pickGenericAffectionSearchTerms(searchTerms: SearchTermsByAction, take: number): string[] {
  const configuredTerms = searchTerms[GENERIC_AFFECTION_SEARCH_TERMS_KEY] ?? [];
  return shuffle(
    configuredTerms.length > 0 ? configuredTerms : DEFAULT_GENERIC_AFFECTION_SEARCH_TERMS
  ).slice(0, take);
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

function shuffle<T>(values: readonly T[]): T[] {
  return [...values].sort(() => Math.random() - 0.5);
}

function filterAnimeGifs(gifs: readonly GiphyGif[]): GiphyGif[] {
  return gifs.filter((gif) => {
    const searchableText = getSearchableGifText(gif);

    return (
      ANIME_RESULT_KEYWORDS.some((keyword) => includesNormalizedKeyword(searchableText, keyword)) &&
      !BLOCKED_RESULT_KEYWORDS.some((keyword) => includesNormalizedKeyword(searchableText, keyword))
    );
  });
}

function filterBlockedGifs(gifs: readonly GiphyGif[]): GiphyGif[] {
  return gifs.filter((gif) => {
    const searchableText = getSearchableGifText(gif);
    return !BLOCKED_RESULT_KEYWORDS.some((keyword) =>
      includesNormalizedKeyword(searchableText, keyword)
    );
  });
}

function filterGifsByKeywords(gifs: readonly GiphyGif[], keywords: readonly string[]): GiphyGif[] {
  return gifs.filter((gif) => {
    const searchableText = getSearchableGifText(gif);
    return keywords.some((keyword) => includesNormalizedKeyword(searchableText, keyword));
  });
}

function getSearchableGifText(gif: GiphyGif): string {
  return normalizeText(
    [gif.title, gif.pageUrl, gif.mediaUrl]
      .filter((value): value is string => Boolean(value))
      .join(" ")
  );
}

function includesNormalizedKeyword(searchableText: string, keyword: string): boolean {
  return searchableText.includes(normalizeText(keyword));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function getActionResultKeywords(action: ActionName): readonly string[] {
  return ACTION_RESULT_KEYWORDS[action] ?? [String(action)];
}

const GENERIC_AFFECTION_SEARCH_TERMS_KEY = "__generic_affection";

const DEFAULT_GENERIC_AFFECTION_SEARCH_TERMS = [
  "anime affection hug gif",
  "anime wholesome hug gif",
  "anime comfort hug gif",
  "anime head pat comfort gif",
  "anime caring friends gif",
  "anime gentle embrace gif",
  "anime cute friendship hug",
  "anime cheering up hug gif"
];

const ANIME_RESULT_KEYWORDS = [
  "anime",
  "manga",
  "crunchyroll",
  "funimation",
  "shoujo",
  "shojo",
  "shounen",
  "shonen",
  "naruto",
  "one-piece",
  "one piece",
  "bleach",
  "jujutsu",
  "demon-slayer",
  "demon slayer",
  "kimetsu",
  "haikyuu",
  "horimiya",
  "toradora",
  "clannad",
  "sailor-moon",
  "sailor moon",
  "fruits-basket",
  "fruits basket",
  "kimi-ni-todoke",
  "kimi ni todoke",
  "kaguya-sama",
  "kaguya sama",
  "maid-sama",
  "maid sama",
  "umamusume",
  "uma musume",
  "chibi",
  "spy-x-family",
  "spy x family",
  "violet-evergarden",
  "violet evergarden",
  "my-hero-academia",
  "my hero academia",
  "boku-no-hero",
  "boku no hero"
];

const BLOCKED_RESULT_KEYWORDS = [
  "ai generated",
  "ai-generated",
  "pixai",
  "stable diffusion",
  "midjourney",
  "novelai",
  "waifu diffusion",
  "gif by persona",
  "cat humor",
  "dog playing",
  "voting turn up",
  "jelly london",
  "best friends animal society"
];

const ACTION_RESULT_KEYWORDS: Record<string, readonly string[]> = {
  kiss: ["kiss", "kissing", "couple kiss", "romantic kiss", "selinho"],
  beijotesta: ["forehead kiss", "kiss forehead", "kiss on forehead", "forehead peck", "forehead"],
  beijobochecha: ["cheek kiss", "kiss cheek", "kiss on cheek", "cheek peck", "cheek"],
  hug: ["hug", "hugs", "hugging", "embrace", "cuddle"],
  cafune: ["headpat", "head pat", "pat", "hair pat"],
  consolar: ["comfort", "comforting", "console", "consoling", "sad hug", "crying hug"],
  proteger: ["protect", "protecting", "protective", "saving", "shield"],
  morder: ["bite", "biting", "nibble", "chomp"],
  cutucar: ["poke", "poking", "cheek poke"]
};

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

function logGifSelection(
  outcome: string,
  request: GifSelectionRequest,
  details: Record<string, unknown>
): void {
  logger.info("GIF selection result.", {
    outcome,
    guildId: request.guildId,
    action: request.action,
    category: request.category,
    ...details
  });
}
