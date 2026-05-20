import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("comandos de RP delegam regra critica para services", () => {
  const files = [
    "src/commands/rpCommands.ts",
    "src/commands/prefixCommands.ts"
  ];

  for (const file of files) {
    const source = readFileSync(path.resolve(process.cwd(), file), "utf8");

    assert.match(source, /actionService\.execute/);
    assert.doesNotMatch(source, /gifRepository|affinityRepository|providerGifId|giphyProviderService|Prisma/);
  }
});
