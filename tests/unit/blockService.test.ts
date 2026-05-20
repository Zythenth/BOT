import assert from "node:assert/strict";
import test from "node:test";
import {
  createBlockService,
  type BlockPreferenceServiceLike,
  type BlockRepositoryLike
} from "../../src/services/blockService";
import type { RequiredActionPayloadContext } from "../../src/services/actionPayloadBuilder";

test("blockService impede interacao quando existe bloqueio total", async () => {
  const service = createBlockService({
    repository: fakeBlockRepository({
      blockedUserId: null,
      category: null,
      action: null
    }),
    preferences: allowRomancePreferences()
  });

  const result = await service.validateActionPrivacy(actionContext());

  assert.equal(result?.ok, false);
  if (result?.ok !== false) {
    throw new Error("Expected blocked action.");
  }

  assert.equal(result.code, "blocked");
});

test("blockService exige opt-in para categoria romantica", async () => {
  const service = createBlockService({
    repository: fakeBlockRepository(null),
    preferences: {
      async allowsRomance(userId) {
        return userId === "actor";
      }
    }
  });

  const result = await service.validateActionPrivacy(
    actionContext({
      action: "kiss",
      category: "romance_leve"
    })
  );

  assert.equal(result?.ok, false);
  if (result?.ok !== false) {
    throw new Error("Expected romance block.");
  }

  assert.equal(result.code, "blocked");
  assert.match(result.message, /opt-in/i);
});

test("blockService impede brincadeira bloqueada por categoria", async () => {
  const service = createBlockService({
    repository: fakeBlockRepository({
      blockedUserId: null,
      category: "brincadeira",
      action: null
    }),
    preferences: allowRomancePreferences()
  });

  const result = await service.validateActionPrivacy(
    actionContext({
      action: "morder",
      category: "brincadeira"
    })
  );

  assert.equal(result?.ok, false);
  if (result?.ok !== false) {
    throw new Error("Expected category block.");
  }

  assert.equal(result.code, "blocked");
});

function actionContext(
  overrides: Partial<Pick<RequiredActionPayloadContext, "action" | "category">> = {}
): RequiredActionPayloadContext {
  return {
    action: overrides.action ?? "hug",
    category: overrides.category ?? "carinho_fofo",
    source: "slash",
    guild: {
      id: "guild-1",
      name: "Guild"
    },
    channelId: "channel-1",
    actor: {
      id: "actor",
      displayName: "Actor",
      isBot: false
    },
    target: {
      id: "target",
      displayName: "Target",
      isBot: false
    },
    botUser: {
      id: "bot",
      isBot: true
    },
    now: new Date("2026-05-20T12:00:00.000Z")
  };
}

function fakeBlockRepository(match: unknown | null): BlockRepositoryLike {
  return {
    async findMatching() {
      return match;
    },
    async findExact() {
      return null;
    },
    async create() {
      return {};
    },
    async deleteMany() {
      return {};
    },
    async list() {
      return [];
    }
  };
}

function allowRomancePreferences(): BlockPreferenceServiceLike {
  return {
    async allowsRomance() {
      return true;
    }
  };
}
