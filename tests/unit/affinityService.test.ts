import assert from "node:assert/strict";
import test from "node:test";
import {
  createAffinityService,
  defaultAffinityServiceConfig,
  type AffinityServiceDependencies
} from "../../src/services/affinityService";

test("affinityService normaliza A+B igual a B+A", () => {
  const service = createAffinityService(defaultAffinityServiceConfig, fakeAffinityDependencies());

  assert.deepEqual(
    service.normalizePair("user-b", "user-a"),
    service.normalizePair("user-a", "user-b")
  );
});

test("affinityService nao pontua quando participante esta em opt-out", async () => {
  const service = createAffinityService(
    defaultAffinityServiceConfig,
    fakeAffinityDependencies({
      optedOutUsers: ["actor"]
    })
  );
  const result = await service.applyAction({
    guildId: "guild-1",
    actorUserId: "actor",
    targetUserId: "target",
    action: "hug",
    category: "carinho_fofo",
    source: "slash",
    occurredAt: new Date("2026-05-20T12:00:00.000Z")
  });

  assert.equal(result.pointsAwarded, 0);
  assert.equal(result.scoreReason, "opt_out");
});

test("affinityService concede pontos da categoria quando limites permitem", async () => {
  const service = createAffinityService(defaultAffinityServiceConfig, fakeAffinityDependencies());
  const result = await service.applyAction({
    guildId: "guild-1",
    actorUserId: "actor",
    targetUserId: "target",
    action: "hug",
    category: "carinho_fofo",
    source: "slash",
    occurredAt: new Date("2026-05-20T12:00:00.000Z")
  });

  assert.equal(result.pointsAwarded, 2);
  assert.equal(result.totalPoints, 2);
  assert.equal(result.scoreReason, "awarded");
});

test("affinityService aplica +3 para kiss como romance leve", async () => {
  const service = createAffinityService(defaultAffinityServiceConfig, fakeAffinityDependencies());
  const result = await service.applyAction({
    guildId: "guild-1",
    actorUserId: "actor",
    targetUserId: "target",
    action: "kiss",
    category: "romance_leve",
    source: "slash",
    occurredAt: new Date("2026-05-20T12:00:00.000Z")
  });

  assert.equal(result.pointsAwarded, 3);
  assert.equal(result.totalPoints, 3);
  assert.equal(result.scoreReason, "awarded");
});

function fakeAffinityDependencies(
  options: {
    optedOutUsers?: string[];
    initialPoints?: number;
  } = {}
): AffinityServiceDependencies {
  let pair = {
    id: "pair-1",
    points: options.initialPoints ?? 0
  };

  return {
    affinityRepository: {
      normalizePair(userOneId, userTwoId) {
        return userOneId <= userTwoId
          ? { userAId: userOneId, userBId: userTwoId }
          : { userAId: userTwoId, userBId: userOneId };
      },
      async getOrCreatePair() {
        return pair;
      },
      async recordAction(input) {
        pair = {
          ...pair,
          points: pair.points + input.pointsAwarded
        };

        return pair;
      }
    },
    interactionRepository: {
      async findLatestScoredForPairAction() {
        return null;
      },
      async findLatestScoredForUser() {
        return null;
      },
      async sumScoredPointsForPair() {
        return 0;
      },
      async sumScoredPointsForUser() {
        return 0;
      },
      async countScoredInteractionsForUser() {
        return 0;
      }
    },
    preferenceService: {
      async hasOptedOut(userId) {
        return options.optedOutUsers?.includes(userId) ?? false;
      }
    },
    guildConfigService: {
      async getConfig() {
        return {
          cooldownEnabled: false,
          cooldownSeconds: 30
        };
      }
    }
  };
}
