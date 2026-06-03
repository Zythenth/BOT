import assert from "node:assert/strict";
import test from "node:test";
import {
  createGifService,
  type CreateImportedGifInput,
  type GifStorage,
  type StoredGifLike
} from "../../src/services/gifService";
import type {
  GiphyGif,
  GiphyProviderService,
  GiphySearchInput
} from "../../src/services/giphyProviderService";
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
  assert.equal(storage.created[0]?.status, "approved");
  assert.equal(storage.created[0]?.searchTerm, "anime hug");
  assert.equal(gif?.providerGifId, "new-gif");
  assert.equal(gif?.imageUrl, "https://media.example/new-gif.gif");
});

test("gifService tenta fallback generico de carinho quando buscas especificas nao batem", async () => {
  const provider = createFakeProvider({
    canUseApi: true,
    searchGifsByTerm: {
      "anime hug one": [fakeGiphyGif("dance-1", "Anime dance GIF")],
      "anime hug two": [fakeGiphyGif("dance-2", "Anime running GIF")],
      "anime hug three": [fakeGiphyGif("dance-3", "Anime waving GIF")],
      "anime carinho fallback": [fakeGiphyGif("fallback-hug", "Anime comfort hug GIF")]
    }
  });
  const storage = createFakeStorage({
    approvedGifs: []
  });
  const service = createGifService(
    { provider: "giphy", allowUncategorizedGifs: true },
    provider.service,
    ratioServiceReturning("giphy"),
    {
      hug: ["anime hug one", "anime hug two", "anime hug three"],
      __generic_affection: ["anime carinho fallback"]
    },
    storage.service
  );

  const gif = await service.chooseGif({
    guildId: "guild-1",
    action: "hug",
    category: "carinho_fofo",
    addedBy: "actor"
  });

  assert.equal(provider.calls.search, 4);
  assert.equal(storage.created.length, 1);
  assert.equal(storage.created[0]?.providerGifId, "fallback-hug");
  assert.equal(storage.created[0]?.searchTerm, "anime carinho fallback");
  assert.equal(gif?.providerGifId, "fallback-hug");
});

test("gifService aceita anime generico na quarta busca mesmo com titulo pobre", async () => {
  const provider = createFakeProvider({
    canUseApi: true,
    searchGifsByTerm: {
      "anime hug one": [fakeGiphyGif("dance-1", "Anime dance GIF")],
      "anime hug two": [fakeGiphyGif("dance-2", "Anime running GIF")],
      "anime hug three": [fakeGiphyGif("dance-3", "Anime waving GIF")],
      "anime carinho fallback": [fakeGiphyGif("fallback-anime", "Anime GIF")]
    }
  });
  const storage = createFakeStorage({
    approvedGifs: []
  });
  const service = createGifService(
    { provider: "giphy", allowUncategorizedGifs: true },
    provider.service,
    ratioServiceReturning("giphy"),
    {
      hug: ["anime hug one", "anime hug two", "anime hug three"],
      __generic_affection: ["anime carinho fallback"]
    },
    storage.service
  );

  const gif = await service.chooseGif({
    guildId: "guild-1",
    action: "hug",
    category: "carinho_fofo",
    addedBy: "actor"
  });

  assert.equal(provider.calls.search, 4);
  assert.equal(storage.created[0]?.providerGifId, "fallback-anime");
  assert.equal(gif?.providerGifId, "fallback-anime");
});

test("gifService aceita quarta busca generica mesmo sem palavra anime no titulo", async () => {
  const provider = createFakeProvider({
    canUseApi: true,
    searchGifsByTerm: {
      "anime beijotesta one": [fakeGiphyGif("dance-1", "Anime dance GIF")],
      "anime beijotesta two": [fakeGiphyGif("dance-2", "Anime running GIF")],
      "anime beijotesta three": [fakeGiphyGif("dance-3", "Anime waving GIF")],
      "anime carinho fallback": [fakeGiphyGif("fallback-generic", "Wholesome hug GIF")]
    }
  });
  const storage = createFakeStorage({
    approvedGifs: []
  });
  const service = createGifService(
    { provider: "giphy", allowUncategorizedGifs: true },
    provider.service,
    ratioServiceReturning("giphy"),
    {
      beijotesta: ["anime beijotesta one", "anime beijotesta two", "anime beijotesta three"],
      __generic_affection: ["anime carinho fallback"]
    },
    storage.service
  );

  const gif = await service.chooseGif({
    guildId: "guild-1",
    action: "beijotesta",
    category: "carinho_fofo",
    addedBy: "actor"
  });

  assert.equal(provider.calls.search, 4);
  assert.equal(storage.created[0]?.providerGifId, "fallback-generic");
  assert.equal(gif?.providerGifId, "fallback-generic");
});

test("gifService ignora resultado com metadado bloqueado antes de salvar", async () => {
  const provider = createFakeProvider({
    canUseApi: true,
    searchGifsByTerm: {
      "anime comforting hug": [
        fakeGiphyGif("persona-ai", "Hana Sparkling Eyes GIF by Persona"),
        fakeGiphyGif("safe-hug", "Fruits Basket Anime Hug GIF")
      ]
    }
  });
  const storage = createFakeStorage({
    approvedGifs: []
  });
  const service = createGifService(
    { provider: "giphy", allowUncategorizedGifs: true },
    provider.service,
    ratioServiceReturning("giphy"),
    { hug: ["anime comforting hug"] },
    storage.service
  );

  const gif = await service.chooseGif({
    guildId: "guild-1",
    action: "hug",
    category: "carinho_fofo",
    addedBy: "actor"
  });

  assert.equal(storage.created.length, 1);
  assert.equal(storage.created[0]?.providerGifId, "safe-hug");
  assert.equal(gif?.providerGifId, "safe-hug");
});

test("gifService promove GIF antigo uncategorized para approved quando ele bate com a acao", async () => {
  const provider = createFakeProvider({
    canUseApi: true,
    searchGifId: "old-gif"
  });
  const storage = createFakeStorage({
    approvedGifs: [],
    existingGif: storedGif({
      id: "old-gif-id",
      providerGifId: "old-gif",
      status: "uncategorized"
    })
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

  assert.equal(storage.updated[0]?.id, "old-gif-id");
  assert.equal(storage.updated[0]?.data.status, "approved");
  assert.equal(gif?.providerGifId, "old-gif");
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
  searchGifsByTerm?: Record<string, GiphyGif[]>;
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
      async search(input: GiphySearchInput) {
        calls.search += 1;

        const gifsByTerm = options.searchGifsByTerm?.[input.searchTerm];

        return {
          status: "ok",
          gifs: gifsByTerm ?? (options.searchGifId
            ? [
                fakeGiphyGif(options.searchGifId, "Anime hug GIF")
              ]
            : [])
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
            title: "Anime approved GIF",
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

function fakeGiphyGif(providerGifId: string, title: string): GiphyGif {
  return {
    provider: "giphy",
    providerGifId,
    title,
    rating: "pg",
    pageUrl: `https://giphy.example/${providerGifId}`,
    mediaUrl: `https://media.example/${providerGifId}.gif`
  };
}

function createFakeStorage(options: {
  approvedGifs: StoredGifLike[];
  existingGif?: StoredGifLike;
}): {
  service: GifStorage;
  created: CreateImportedGifInput[];
  updated: Array<{
    id: string;
    data: Parameters<GifStorage["updateGiphyMetadata"]>[1];
  }>;
} {
  const created: CreateImportedGifInput[] = [];
  const updated: Array<{
    id: string;
    data: Parameters<GifStorage["updateGiphyMetadata"]>[1];
  }> = [];

  return {
    created,
    updated,
    service: {
      async listApproved() {
        return options.approvedGifs;
      },
      async findByProviderGifId() {
        return options.existingGif ?? null;
      },
      async createImportedGif(input) {
        created.push(input);
        return storedGif({
          ...input,
          id: `stored-${input.providerGifId}`
        });
      },
      async updateGiphyMetadata(id, data) {
        updated.push({
          id,
          data
        });
        return storedGif({
          ...options.existingGif,
          id,
          status: data.status ?? options.existingGif?.status ?? "approved"
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
