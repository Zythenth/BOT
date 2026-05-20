import assert from "node:assert/strict";
import test from "node:test";
import {
  createGiphyProviderService,
  type GiphyQuotaStore
} from "../../src/services/giphyProviderService";

test("giphyProviderService nao chama GIPHY quando cota persistente acabou", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called");
  }) as typeof fetch;

  try {
    const service = createGiphyProviderService(
      {
        apiKey: "test-key",
        requestsPerHour: 100,
        rating: "pg",
        lang: "pt"
      },
      quotaStore({
        remaining: 0,
        consumeAllowed: false
      })
    );

    const result = await service.search({
      searchTerm: "anime hug",
      limit: 1
    });

    assert.equal(result.status, "quota_exhausted");
    assert.equal(fetchCalls, 0);
    assert.equal(await service.canUseApi(), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function quotaStore(options: {
  remaining: number;
  consumeAllowed: boolean;
}): GiphyQuotaStore {
  return {
    async consume(input) {
      if (!options.consumeAllowed) {
        return null;
      }

      return {
        limit: input.limit,
        used: input.limit - options.remaining + 1,
        remaining: Math.max(options.remaining - 1, 0),
        resetAt: new Date("2026-05-20T13:00:00.000Z")
      };
    },
    async snapshot(input) {
      return {
        limit: input.limit,
        used: input.limit - options.remaining,
        remaining: options.remaining,
        resetAt: new Date("2026-05-20T13:00:00.000Z")
      };
    }
  };
}
