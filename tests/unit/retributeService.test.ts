import assert from "node:assert/strict";
import test from "node:test";
import type { ButtonInteraction } from "discord.js";
import { retributeService } from "../../src/services/retributeService";

test("retributeService responde privado quando autor original clica", async () => {
  const result = await retributeService.execute(fakeButtonInteraction({
    userId: "actor",
    customId: retributeCustomId({
      originalActorUserId: "actor",
      originalTargetUserId: "target"
    })
  }));

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
  const result = await retributeService.execute(fakeButtonInteraction({
    userId: "third",
    customId: retributeCustomId({
      originalActorUserId: "actor",
      originalTargetUserId: "target"
    })
  }));

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
  const expiredResult = await retributeService.execute(fakeButtonInteraction({
    userId: "target",
    customId: retributeCustomId({
      originalActorUserId: "actor",
      originalTargetUserId: "target",
      createdAt: new Date(Date.now() - 16 * 60 * 1000)
    })
  }));
  const missingResult = await retributeService.execute(fakeButtonInteraction({
    userId: "target",
    customId: "rp:retribute"
  }));
  const malformedResult = await retributeService.execute(fakeButtonInteraction({
    userId: "target",
    customId: "rp:retribute:hug:guild-1:actor:target:bad!"
  }));

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

function fakeButtonInteraction(input: {
  userId: string;
  customId: string;
  guildId?: string;
}): ButtonInteraction {
  return {
    customId: input.customId,
    guildId: input.guildId ?? "guild-1",
    user: {
      id: input.userId
    }
  } as unknown as ButtonInteraction;
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
