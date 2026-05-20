import assert from "node:assert/strict";
import test from "node:test";
import { guildAccessService } from "../../src/services/guildAccessService";

test("guildAccessService permite todos quando allowlist nao foi configurada", () => {
  assert.equal(guildAccessService.isGuildAllowed("guild-1", []), true);
});

test("guildAccessService bloqueia servidor fora da allowlist", () => {
  assert.equal(guildAccessService.isGuildAllowed("guild-1", ["guild-2"]), false);
  assert.equal(guildAccessService.isGuildAllowed("guild-2", ["guild-2"]), true);
});
