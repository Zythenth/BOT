import assert from "node:assert/strict";
import test from "node:test";
import {
  createAliasService,
  normalizeAlias,
  type AliasRepositoryLike
} from "../../src/services/aliasService";

test("aliasService normaliza espacos, caixa e acentos", () => {
  assert.equal(normalizeAlias("  \u00C1bra\u00E7o  "), "abraco");
});

test("aliasService resolve alias interno para comando canonico", async () => {
  const service = createAliasService(emptyAliasRepository());

  assert.equal(await service.resolveCommandName("guild-1", "abraco"), "hug");
});

test("aliasService resolve aliases obrigatorios do MVP", async () => {
  const service = createAliasService(emptyAliasRepository());

  assert.equal(await service.resolveCommandName("guild-1", "kiss"), "kiss");
  assert.equal(await service.resolveCommandName("guild-1", "selinho"), "kiss");
  assert.equal(await service.resolveCommandName("guild-1", "abra\u00E7ar"), "hug");
  assert.equal(await service.resolveCommandName("guild-1", "foreheadkiss"), "beijotesta");
  assert.equal(await service.resolveCommandName("guild-1", "bjt"), "beijotesta");
  assert.equal(await service.resolveCommandName("guild-1", "cheekkiss"), "beijobochecha");
  assert.equal(await service.resolveCommandName("guild-1", "bjb"), "beijobochecha");
  assert.equal(await service.resolveCommandName("guild-1", "cafun\u00E9"), "cafune");
  assert.equal(await service.resolveCommandName("guild-1", "headpat"), "cafune");
  assert.equal(await service.resolveCommandName("guild-1", "pat"), "cafune");
  assert.equal(await service.resolveCommandName("guild-1", "comfort"), "consolar");
  assert.equal(await service.resolveCommandName("guild-1", "protect"), "proteger");
  assert.equal(await service.resolveCommandName("guild-1", "bite"), "morder");
  assert.equal(await service.resolveCommandName("guild-1", "poke"), "cutucar");
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
