import assert from "node:assert/strict";
import test from "node:test";
import { cooldownService } from "../../src/services/cooldownService";

test("cooldownService calcula janela restante com horario controlado", () => {
  const now = new Date("2026-05-20T12:00:20.000Z");
  const lastUsedAt = new Date("2026-05-20T12:00:00.000Z");
  const result = cooldownService.check({
    now,
    lastUsedAt,
    cooldownMs: 30_000
  });

  assert.equal(result.onCooldown, true);
  assert.equal(result.remainingMs, 10_000);
  assert.equal(result.cooldownUntil?.toISOString(), "2026-05-20T12:00:30.000Z");
});

test("cooldownService libera quando nao existe uso recente ou cooldown acabou", () => {
  const now = new Date("2026-05-20T12:01:00.000Z");

  assert.equal(
    cooldownService.isOnCooldown({
      now,
      lastUsedAt: null,
      cooldownMs: 30_000
    }),
    false
  );

  assert.equal(
    cooldownService.isOnCooldown({
      now,
      lastUsedAt: new Date("2026-05-20T12:00:00.000Z"),
      cooldownMs: 30_000
    }),
    false
  );
});
