import assert from "node:assert/strict";
import test from "node:test";
import { parseConfig } from "../../src/config/env";

const requiredEnvironment = {
  DISCORD_TOKEN: "test-token",
  DISCORD_CLIENT_ID: "test-client-id",
  DATABASE_URL: "file:./test.db"
};

test("parseConfig aplica defaults publicos sem depender do ambiente local", () => {
  const config = parseConfig({ ...requiredEnvironment });

  assert.equal(config.environment, "development");
  assert.equal(config.defaultPrefix, "-");
  assert.equal(config.gifs.rating, "pg");
  assert.equal(config.gifs.allowNsfw, false);
  assert.deepEqual(config.discord.allowedGuildIds, []);
});

test("parseConfig relata todas as variaveis obrigatorias ausentes", () => {
  assert.throws(
    () => parseConfig({}),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /DISCORD_TOKEN is required/);
      assert.match(error.message, /DISCORD_CLIENT_ID is required/);
      assert.match(error.message, /DATABASE_URL is required/);
      return true;
    }
  );
});

test("parseConfig rejeita valores invalidos em vez de corrigi-los silenciosamente", () => {
  assert.throws(
    () =>
      parseConfig({
        ...requiredEnvironment,
        ACTION_COOLDOWN_SECONDS: "3.5",
        ALLOW_NSFW: "talvez",
        GIPHY_RATING: "adult"
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /ACTION_COOLDOWN_SECONDS must be an integer/);
      assert.match(error.message, /ALLOW_NSFW must be a boolean/);
      assert.match(error.message, /GIPHY_RATING must be one of/);
      return true;
    }
  );
});
