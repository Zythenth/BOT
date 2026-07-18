import assert from "node:assert/strict";
import test from "node:test";
import type { ButtonInteraction } from "discord.js";
import {
  createRetributeService,
  retributeService,
  type RetributeButtonState
} from "../../src/services/retributeService";
import type { ActionContext, ActionResult } from "../../src/types";

test("retributeService responde privado quando autor original clica", async () => {
  const result = await retributeService.execute(
    fakeButtonInteraction({
      userId: "actor",
      customId: retributeCustomId({
        originalActorUserId: "actor",
        originalTargetUserId: "target"
      })
    })
  );

  assert.equal(result.ok, false);
  if (result.ok !== false) {
    throw new Error("Expected failed retribute.");
  }

  assert.equal(result.ephemeral, true);
  assert.equal(
    result.message,
    "Ei, esse botão é para quem recebeu o carinho retribuir você. Deixa a outra pessoa decidir, tá? 💛"
  );
});

test("retributeService responde privado quando terceiro clica", async () => {
  const result = await retributeService.execute(
    fakeButtonInteraction({
      userId: "third",
      customId: retributeCustomId({
        originalActorUserId: "actor",
        originalTargetUserId: "target"
      })
    })
  );

  assert.equal(result.ok, false);
  if (result.ok !== false) {
    throw new Error("Expected failed retribute.");
  }

  assert.equal(result.ephemeral, true);
  assert.equal(
    result.message,
    "Ei! Esse carinho não era pra você retribuir. Só quem recebeu pode apertar esse botão. 😤"
  );
});

test("retributeService responde privado quando dados expiraram ou sumiram", async () => {
  const expiredResult = await retributeService.execute(
    fakeButtonInteraction({
      userId: "target",
      customId: retributeCustomId({
        originalActorUserId: "actor",
        originalTargetUserId: "target",
        createdAt: new Date(Date.now() - 16 * 60 * 1000)
      })
    })
  );
  const missingResult = await retributeService.execute(
    fakeButtonInteraction({
      userId: "target",
      customId: "rp:retribute"
    })
  );
  const malformedResult = await retributeService.execute(
    fakeButtonInteraction({
      userId: "target",
      customId: "rp:retribute:hug:guild-1:actor:target:bad!"
    })
  );

  for (const result of [expiredResult, missingResult, malformedResult]) {
    assert.equal(result.ok, false);
    if (result.ok !== false) {
      throw new Error("Expected failed retribute.");
    }

    assert.equal(result.ephemeral, true);
    assert.equal(
      result.message,
      "Ops, esse carinho já se perdeu no tempo. Melhor mandar outro novinho. 💫"
    );
  }
});

test("retributeService reivindica estado persistido antes de executar uma unica vez", async () => {
  const customId = retributeCustomId({
    originalActorUserId: "actor",
    originalTargetUserId: "target"
  });
  const state = validState(customId);
  let claims = 0;
  let releases = 0;
  let receivedContext: ActionContext | undefined;
  const service = createRetributeService(
    {
      async findByCustomId() {
        return state;
      },
      async claim() {
        claims += 1;
        return { count: 1 };
      },
      async release() {
        releases += 1;
        return { count: 1 };
      }
    },
    {
      async execute(context) {
        receivedContext = context;
        return successfulActionResult();
      }
    }
  );

  const result = await service.execute(fakeButtonInteraction({ userId: "target", customId }));

  assert.equal(result.ok, true);
  assert.equal(claims, 1);
  assert.equal(releases, 0);
  assert.equal(receivedContext?.actor?.id, "target");
  assert.equal(receivedContext?.target?.id, "actor");
});

test("retributeService libera a reivindicacao quando a acao e recusada", async () => {
  const customId = retributeCustomId({
    originalActorUserId: "actor",
    originalTargetUserId: "target"
  });
  let releases = 0;
  const service = createRetributeService(
    {
      async findByCustomId() {
        return validState(customId);
      },
      async claim() {
        return { count: 1 };
      },
      async release() {
        releases += 1;
        return { count: 1 };
      }
    },
    {
      async execute() {
        return {
          ok: false,
          code: "cooldown",
          message: "Aguarde antes de retribuir.",
          ephemeral: true
        };
      }
    }
  );

  const result = await service.execute(fakeButtonInteraction({ userId: "target", customId }));

  assert.equal(result.ok, false);
  assert.equal(releases, 1);
});

function fakeButtonInteraction(input: {
  userId: string;
  customId: string;
  guildId?: string;
}): ButtonInteraction {
  return {
    customId: input.customId,
    guildId: input.guildId ?? "guild-1",
    user: {
      id: input.userId,
      username: input.userId,
      bot: false
    },
    client: {
      user: {
        id: "bot",
        bot: true
      }
    },
    channelId: "channel-1"
  } as unknown as ButtonInteraction;
}

function validState(customId: string): RetributeButtonState {
  const [, , action, guildId, originalAuthorId, originalTargetId] = customId.split(":");

  return {
    action: action!,
    guildId: guildId!,
    originalAuthorId: originalAuthorId!,
    originalTargetId: originalTargetId!,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    usedAt: null
  };
}

function successfulActionResult(): ActionResult {
  return {
    ok: true,
    action: "hug",
    category: "carinho_fofo",
    source: "button",
    guildId: "guild-1",
    actorUserId: "target",
    targetUserId: "actor",
    phrase: { text: "Retribuicao" },
    affinity: { pointsAwarded: 0 },
    payload: {
      embed: { description: "Retribuicao" },
      components: []
    }
  };
}

function retributeCustomId(input: {
  originalActorUserId: string;
  originalTargetUserId: string;
  action?: string;
  guildId?: string;
  createdAt?: Date;
}): string {
  return [
    "rp",
    "retribute",
    input.action ?? "hug",
    input.guildId ?? "guild-1",
    input.originalActorUserId,
    input.originalTargetUserId,
    (input.createdAt ?? new Date()).getTime().toString(36)
  ].join(":");
}
