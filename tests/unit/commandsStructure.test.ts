import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { slashCommands } from "../../src/commands";
import { RP_ACTION_DEFINITIONS } from "../../src/config";

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

test("kiss e uma acao publica de romance leve", () => {
  const kiss = RP_ACTION_DEFINITIONS.find((definition) => definition.action === "kiss");

  assert.equal(kiss?.commandName, "kiss");
  assert.equal(kiss?.category, "romance_leve");
});

test("/rp agrupado existe sem remover slash diretos", () => {
  assert.ok(slashCommands.has("rp"));
  assert.ok(slashCommands.has("hug"));
  assert.ok(slashCommands.has("kiss"));
});

test("dados base mantem kiss separado dos beijos de testa e bochecha", () => {
  const phrases = readJson<Record<string, string[]>>("data/phrases.json");
  const searchTerms = readJson<Record<string, string[]>>("data/giphy-search-terms.json");

  assert.ok(phrases.kiss?.length > 0);
  assert.ok(searchTerms.kiss?.length > 0);
  assert.ok(searchTerms.beijotesta?.length > 0);
  assert.ok(searchTerms.beijobochecha?.length > 0);
  assert.notDeepEqual(searchTerms.kiss, searchTerms.beijotesta);
  assert.notDeepEqual(searchTerms.kiss, searchTerms.beijobochecha);
});

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.resolve(process.cwd(), file), "utf8")) as T;
}
