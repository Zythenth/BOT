import assert from "node:assert/strict";
import test from "node:test";
import {
  parseBotMentionPrefixCommand,
  parsePrefixCommand
} from "../../src/commands/prefixParser";

test("parsePrefixCommand mantem prefixo configuravel", () => {
  const parsed = parsePrefixCommand("-hug <@123456789012345678>", "-");

  assert.equal(parsed?.commandName, "hug");
  assert.deepEqual(parsed?.args, ["<@123456789012345678>"]);
  assert.equal(parsed?.prefixUsed, "-");
});

test("parseBotMentionPrefixCommand aceita mencao ao bot como prefixo auxiliar", () => {
  const parsed = parseBotMentionPrefixCommand(
    "<@999999999999999999> help",
    "999999999999999999"
  );

  assert.equal(parsed?.commandName, "help");
  assert.deepEqual(parsed?.args, []);
  assert.equal(parsed?.prefixUsed, "<@999999999999999999> ");
});

test("parseBotMentionPrefixCommand ignora mencao sem separador", () => {
  const parsed = parseBotMentionPrefixCommand(
    "<@999999999999999999>hug <@123456789012345678>",
    "999999999999999999"
  );

  assert.equal(parsed, null);
});
