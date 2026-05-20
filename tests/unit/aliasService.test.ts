import assert from "node:assert/strict";
import test from "node:test";
import { createAliasService, normalizeAlias, type AliasRepositoryLike } from "../../src/services/aliasService";

test("aliasService normaliza espacos, caixa e acentos", () => {
  assert.equal(normalizeAlias("  \u00C1bra\u00E7o  "), "abraco");
});

test("aliasService resolve alias interno para comando canonico", async () => {
  const service = createAliasService(emptyAliasRepository());

  assert.equal(await service.resolveCommandName("guild-1", "abraco"), "hug");
});

test("aliasService resolve alias customizado do servidor", async () => {
  const repository: AliasRepositoryLike = {
    async findByAlias(_guildId, alias) {
      return alias === "colo"
        ? {
            commandName: "cafune",
            isEnabled: true
          }
        : null;
    }
  };
  const service = createAliasService(repository);

  assert.equal(await service.resolveCommandName("guild-1", "colo"), "cafune");
});

function emptyAliasRepository(): AliasRepositoryLike {
  return {
    async findByAlias() {
      return null;
    }
  };
}
