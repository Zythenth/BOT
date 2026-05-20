import assert from "node:assert/strict";
import test from "node:test";
import {
  createGifService,
  type CreateImportedGifInput,
  type GifStorage,
  type StoredGifLike
} from "../../src/services/gifService";
import type { GiphyProviderService, GiphySearchInput } from "../../src/services/giphyProviderService";
import type { GifRatioService } from "../../src/services/gifRatioService";

test("gifService reutiliza GIF aprovado do banco sem buscar GIPHY nova", async () => {
  const provider = createFakeProvider({
    canUseApi: true,
    getByIdGifId: "approved-gif"
  });
  const storage = createFakeStorage({
    approvedGifs: [
      storedGif({
        id: "gif-approved-1",
        providerGifId: "approved-gif",
        status: "approved"
      })
    ]
  });
  const service = createGifService(
    { provider: "giphy", allowUncategorizedGifs: true },
    provider.service,
    ratioServiceReturning("database"),
    { hug: ["anime hug"] },
    storage.service
  );

  const gif = await service.chooseGif({
    guildId: "guild-1",
    action: "hug",
    category: "carinho_fofo"
  });

  assert.equal(gif?.providerGifId, "approved-gif");
  assert.equal(gif?.imageUrl, "https://media.example/approved-gif.gif");
  assert.equal(provider.calls.search, 0);
  assert.equal(provider.calls.getById, 1);
});

test("gifService busca GIPHY, salva metadados e retorna GIF importado", async () => {
  const provider = createFakeProvider({
    canUseApi: true,
    searchGifId: "new-gif"
  });
  const storage = createFakeStorage({
    approvedGifs: []
  });
  const service = createGifService(
    { provider: "giphy", allowUncategorizedGifs: true },
    provider.service,
    ratioServiceReturning("giphy"),
    { hug: ["anime hug"] },
    storage.service
  );

  const gif = await service.chooseGif({
    guildId: "guild-1",
    action: "hug",
    category: "carinho_fofo",
    addedBy: "actor"
  });

  assert.equal(provider.calls.search, 1);
  assert.equal(storage.created.length, 1);
  assert.equal(storage.created[0]?.providerGifId, "new-gif");
  assert.equal(storage.created[0]?.status, "uncategorized");
  assert.equal(storage.created[0]?.searchTerm, "anime hug");
  assert.equal(gif?.providerGifId, "new-gif");
  assert.equal(gif?.imageUrl, "https://media.example/new-gif.gif");
});

test("gifService retorna fallback sem GIF quando cota acabou e banco nao tem aprovado", async () => {
  const provider = createFakeProvider({
    canUseApi: false,
    searchGifId: "new-gif"
  });
  const storage = createFakeStorage({
    approvedGifs: []
  });
  const service = createGifService(
    { provider: "giphy", allowUncategorizedGifs: true },
    provider.service,
    ratioServiceReturning("giphy"),
    { hug: ["anime hug"] },
    storage.service
  );

  const gif = await service.chooseGif({
    guildId: "guild-1",
    action: "hug",
    category: "carinho_fofo"
  });

  assert.equal(gif, undefined);
  assert.equal(provider.calls.search, 0);
});

function ratioServiceReturning(selectedSource: "database" | "giphy"): GifRatioService {
  return {
    getRatioForApprovedCount(approvedCount) {
      return {
        approvedCount,
        bucket: {
          minApproved: 0,
          maxApproved: 19,
          databaseRatio: 0.65,
          giphyRatio: 0.35
        },
        databaseRatio: 0.65,
        giphyRatio: 0.35
      };
    },
    async countApproved() {
      return 0;
    },
    async decideSource() {
      return {
        approvedCount: 0,
        bucket: {
          minApproved: 0,
          maxApproved: 19,
          databaseRatio: 0.65,
          giphyRatio: 0.35
        },
        databaseRatio: 0.65,
        giphyRatio: 0.35,
        selectedSource
      };
    }
  };
}

function createFakeProvider(options: {
  canUseApi: boolean;
  searchGifId?: string;
  getByIdGifId?: string;
}): {
  service: GiphyProviderService;
  calls: {
    search: number;
    getById: number;
  };
} {
  const calls = {
    search: 0,
    getById: 0
  };

  return {
    calls,
    service: {
      async search(_input: GiphySearchInput) {
        calls.search += 1;

        return {
          status: "ok",
          gifs: options.searchGifId
            ? [
                {
                  provider: "giphy",
                  providerGifId: options.searchGifId,
                  rating: "pg",
                  pageUrl: `https://giphy.example/${options.searchGifId}`,
                  mediaUrl: `https://media.example/${options.searchGifId}.gif`
                }
              ]
            : []
        };
      },
      async getById(providerGifId) {
        calls.getById += 1;

        if (providerGifId !== options.getByIdGifId) {
          return {
            status: "not_found"
          };
        }

        return {
          status: "ok",
          gif: {
            provider: "giphy",
            providerGifId,
            rating: "pg",
            pageUrl: `https://giphy.example/${providerGifId}`,
            mediaUrl: `https://media.example/${providerGifId}.gif`
          }
        };
      },
      buildTransientMediaUrl(providerGifId) {
        return `https://media.example/${providerGifId}.gif`;
      },
      async getQuotaSnapshot() {
        return {
          limit: 100,
          used: options.canUseApi ? 1 : 100,
          remaining: options.canUseApi ? 99 : 0,
          resetAt: new Date("2026-05-20T13:00:00.000Z")
        };
      },
      async canUseApi() {
        return options.canUseApi;
      }
    }
  };
}

function createFakeStorage(options: {
  approvedGifs: StoredGifLike[];
}): {
  service: GifStorage;
  created: CreateImportedGifInput[];
} {
  const created: CreateImportedGifInput[] = [];

  return {
    created,
    service: {
      async listApproved() {
        return options.approvedGifs;
      },
      async findByProviderGifId() {
        return null;
      },
      async createImportedGif(input) {
        created.push(input);
        return storedGif({
          ...input,
          id: `stored-${input.providerGifId}`
        });
      },
      async updateGiphyMetadata(id) {
        return storedGif({
          id,
          status: "approved"
        });
      },
      async incrementUsage() {
        return undefined;
      }
    }
  };
}

function storedGif(overrides: Partial<StoredGifLike> = {}): StoredGifLike {
  return {
    id: "gif-1",
    guildId: "guild-1",
    provider: "giphy",
    providerGifId: "gif-provider-1",
    action: "hug",
    category: "carinho_fofo",
    status: "approved",
    ...overrides
  };
}
