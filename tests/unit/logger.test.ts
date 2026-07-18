import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeForLog } from "../../src/utils/logger";

test("sanitizeForLog remove segredos por nome de campo em estruturas aninhadas", () => {
  const sanitized = sanitizeForLog({
    authorization: "Bearer private",
    nested: {
      giphyApiKey: "private-key",
      safe: "visible"
    }
  });

  assert.deepEqual(sanitized, {
    authorization: "[redacted]",
    nested: {
      giphyApiKey: "[redacted]",
      safe: "visible"
    }
  });
});

test("sanitizeForLog remove valores secretos conhecidos de mensagens de erro", () => {
  const previousToken = process.env.DISCORD_TOKEN;
  process.env.DISCORD_TOKEN = "known-test-token";

  try {
    const sanitized = sanitizeForLog(new Error("Falha ao usar known-test-token"), {
      includeStack: true
    }) as { message: string; stack: string };

    assert.equal(sanitized.message, "Falha ao usar [redacted]");
    assert.doesNotMatch(sanitized.stack, /known-test-token/);
  } finally {
    if (previousToken === undefined) {
      delete process.env.DISCORD_TOKEN;
    } else {
      process.env.DISCORD_TOKEN = previousToken;
    }
  }
});
