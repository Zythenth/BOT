import assert from "node:assert/strict";
import test from "node:test";
import type { RepositoryClient } from "../../src/database/repositories/types";
import { createPersonalDataService } from "../../src/services/personalDataService";

const now = new Date("2026-05-20T12:00:00.000Z");
const createdAt = new Date("2026-05-19T10:00:00.000Z");
const updatedAt = new Date("2026-05-20T10:00:00.000Z");

test("personalDataService exporta dados proprios sem expor metadados de GIF", async () => {
  const service = createPersonalDataService({
    now: () => now,
    transaction: runTransaction,
    preferences: {
      findByUserId: async () => ({
        userId: "u1",
        locale: "pt-BR",
        allowRomance: true,
        hideFromRankings: false,
        optedOutOfAffinity: false,
        createdAt,
        updatedAt
      }),
      upsert: async () => {
        throw new Error("upsert nao deve ser chamado no export");
      }
    },
    interactions: {
      listForUser: async () => [
        {
          id: "interaction-1",
          guildId: "guild-1",
          actorUserId: "u1",
          targetUserId: "u2",
          action: "kiss",
          category: "romance_leve",
          source: "slash",
          pointsAwarded: 3,
          createdAt
        }
      ],
      deleteForUser: async () => ({ count: 0 })
    },
    affinityPairs: {
      listForUser: async () => [
        {
          id: "pair-1",
          guildId: "guild-1",
          userAId: "u1",
          userBId: "u2",
          points: 30,
          interactionCount: 10,
          lastInteractionAt: updatedAt,
          createdAt,
          updatedAt
        }
      ],
      deleteForUser: async () => ({ count: 0 })
    },
    blocks: {
      listForUser: async () => [
        {
          id: "block-1",
          guildId: "guild-1",
          blockerUserId: "u1",
          blockedUserId: "u3",
          category: null,
          action: null,
          createdAt
        }
      ],
      deleteForUser: async () => ({ count: 0 })
    },
    buttonInteractionStates: {
      listForUser: async () => [
        {
          id: "state-1",
          guildId: "guild-1",
          action: "hug",
          originalAuthorId: "u4",
          originalTargetId: "u1",
          expiresAt: updatedAt,
          usedAt: null,
          createdAt
        }
      ],
      deleteForUser: async () => ({ count: 0 })
    },
    adminLogs: {
      countForActor: async () => 2
    }
  });

  const data = await service.exportUserData("u1");

  assert.equal(data.exportedAt, now.toISOString());
  assert.equal(data.counts.interactions, 1);
  assert.equal(data.counts.affinityPairs, 1);
  assert.equal(data.counts.blocks, 1);
  assert.equal(data.counts.buttonInteractionStates, 1);
  assert.equal(data.counts.adminLogsRetained, 2);
  assert.equal(data.affinityPairs[0].otherUserId, "u2");
  assert.equal(data.blocks[0].direction, "sent");
  assert.equal(data.buttonInteractionStates[0].role, "original_target");
  assert.equal(data.interactions[0].commandOrigin, "slash");
  assert.equal(hasKey(data.interactions[0], "source"), false);
  assert.equal(hasKey(data.interactions[0], "gifId"), false);
  assert.equal(hasKey(data.interactions[0], "providerGifId"), false);
  assert.equal(hasKey(data.interactions[0], "url"), false);
});

test("personalDataService apaga dados e preserva preferencia minima de opt-out", async () => {
  let upsertInput: {
    userId: string;
    locale: string;
    allowRomance: boolean;
    hideFromRankings: boolean;
    optedOutOfAffinity: boolean;
  } | null = null;

  const service = createPersonalDataService({
    now: () => now,
    transaction: runTransaction,
    preferences: {
      findByUserId: async () => ({
        userId: "u1",
        locale: "pt-BR",
        allowRomance: true,
        hideFromRankings: false,
        optedOutOfAffinity: false,
        createdAt,
        updatedAt
      }),
      upsert: async (input) => {
        upsertInput = input;
        return {
          ...input,
          createdAt,
          updatedAt
        };
      }
    },
    interactions: {
      listForUser: async () => [],
      deleteForUser: async () => ({ count: 4 })
    },
    affinityPairs: {
      listForUser: async () => [],
      deleteForUser: async () => ({ count: 2 })
    },
    blocks: {
      listForUser: async () => [],
      deleteForUser: async () => ({ count: 3 })
    },
    buttonInteractionStates: {
      listForUser: async () => [],
      deleteForUser: async () => ({ count: 1 })
    },
    adminLogs: {
      countForActor: async () => 5
    }
  });

  const result = await service.eraseOwnData("u1");

  assert.deepEqual(result.deleted, {
    interactions: 4,
    affinityPairs: 2,
    blocks: 3,
    buttonInteractionStates: 1
  });
  assert.deepEqual(upsertInput, {
    userId: "u1",
    locale: "pt-BR",
    allowRomance: false,
    hideFromRankings: true,
    optedOutOfAffinity: true
  });
  assert.equal(result.preservedPreference.allowRomance, false);
  assert.equal(result.preservedPreference.hideFromRankings, true);
  assert.equal(result.preservedPreference.optedOutOfAffinity, true);
  assert.equal(result.retained.adminLogsRetained, 5);
});

async function runTransaction<T>(work: (db: RepositoryClient) => Promise<T>): Promise<T> {
  return work({} as RepositoryClient);
}

function hasKey(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
