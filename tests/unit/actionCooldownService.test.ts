import assert from "node:assert/strict";
import test from "node:test";
import {
  createActionCooldownService,
  type ActionCooldownInteractionRepository
} from "../../src/services/actionCooldownService";
import { cooldownService } from "../../src/services/cooldownService";
import type { RequiredActionPayloadContext } from "../../src/services/actionPayloadBuilder";

test("actionCooldownService bloqueia spam recente de acoes RP", async () => {
  const service = createActionCooldownService({
    cooldowns: cooldownService,
    interactions: fakeInteractionRepository({
      actorLatest: new Date("2026-05-20T12:00:03.000Z")
    })
  });
  const result = await service.validate(actionContext(), {
    enabled: true,
    cooldownSeconds: 5
  });

  assert.equal(result?.ok, false);
  assert.equal(result?.code, "cooldown");
  assert.match(result?.message ?? "", /Aguarde 3 segundos/);
});

test("actionCooldownService permite quando janela de flood passou", async () => {
  const service = createActionCooldownService({
    cooldowns: cooldownService,
    interactions: fakeInteractionRepository({
      actorLatest: new Date("2026-05-20T11:59:50.000Z")
    })
  });
  const result = await service.validate(actionContext(), {
    enabled: true,
    cooldownSeconds: 5
  });

  assert.equal(result, null);
});

function fakeInteractionRepository(input: {
  actorLatest?: Date;
  pairLatest?: Date;
  pairActionLatest?: Date;
}): ActionCooldownInteractionRepository {
  return {
    async findLatestForActor() {
      return input.actorLatest ? { createdAt: input.actorLatest } : null;
    },
    async findLatestBetweenUsers(filters) {
      const latest = filters.action ? input.pairActionLatest : input.pairLatest;
      return latest ? { createdAt: latest } : null;
    }
  };
}

function actionContext(): RequiredActionPayloadContext {
  return {
    action: "hug",
    category: "carinho_fofo",
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
    now: new Date("2026-05-20T12:00:05.000Z")
  };
}
