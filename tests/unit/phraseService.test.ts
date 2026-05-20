import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createPhraseService, type PhraseRepositoryLike } from "../../src/services/phraseService";

test("phraseService lista frases base filtradas por acao e categoria", () => {
  const fixture = createPhrasesFixture({
    hug: ["{autor} abracou {alvo}."]
  });

  try {
    const service = createPhraseService(fixture.filePath, emptyPhraseRepository());
    const phrases = service.listBasePhrases({
      action: "hug",
      category: "carinho_fofo"
    });

    assert.equal(phrases.length, 1);
    assert.equal(phrases[0]?.id, "base:hug:1");
    assert.equal(phrases[0]?.source, "base");
  } finally {
    fixture.cleanup();
  }
});

test("phraseService combina frases customizadas do servidor com base local", async () => {
  const fixture = createPhrasesFixture({
    hug: []
  });
  const repository: PhraseRepositoryLike = {
    async list() {
      return [
        {
          id: "phrase-custom-1",
          text: "{autor} ofereceu um abraco em {alvo}."
        }
      ] as Awaited<ReturnType<PhraseRepositoryLike["list"]>>;
    }
  };

  try {
    const service = createPhraseService(fixture.filePath, repository);
    const phrase = await service.selectForAction({
      guildId: "guild-1",
      action: "hug",
      category: "carinho_fofo"
    });

    assert.equal(phrase?.id, "phrase-custom-1");
    assert.match(phrase?.text ?? "", /\{autor\}/);
  } finally {
    fixture.cleanup();
  }
});

function createPhrasesFixture(phrases: Record<string, string[]>): {
  filePath: string;
  cleanup(): void;
} {
  const directory = mkdtempSync(path.join(tmpdir(), "rp-affection-phrases-"));
  const filePath = path.join(directory, "phrases.json");

  writeFileSync(filePath, JSON.stringify(phrases), "utf8");

  return {
    filePath,
    cleanup() {
      rmSync(directory, {
        force: true,
        recursive: true
      });
    }
  };
}

function emptyPhraseRepository(): PhraseRepositoryLike {
  return {
    async list() {
      return [];
    }
  };
}
