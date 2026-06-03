import assert from "node:assert/strict";
import test from "node:test";
import type { APIEmbed } from "discord.js";
import { toActionReplyOptions } from "../../src/commands/actionResponseAdapter";
import { createActionService, type ActionServiceDependencies } from "../../src/services/actionService";
import type { ActionContext, ActionSource } from "../../src/types";

test("actionService centraliza slash, prefix e botao na mesma execucao", async () => {
  const sources: ActionSource[] = ["slash", "prefix", "button"];
  const executedSources: ActionSource[] = [];
  const service = createActionService({
    ...safeDependencies(),
    async saveHistory(context) {
      executedSources.push(context.source);
    }
  });

  for (const source of sources) {
    const result = await service.execute(actionContext(source));

    assert.equal(result.ok, true);
  }

  assert.deepEqual(executedSources, sources);
});

test("payload publico de RP nao mostra providerGifId, URL ou fonte do GIF em texto", async () => {
  const service = createActionService(safeDependencies({
    async selectGif() {
      return {
        id: "gif-interno",
        provider: "giphy",
        providerGifId: "secret-provider-gif-id",
        imageUrl: "https://media.giphy.com/media/secret-provider-gif-id/giphy.gif"
      };
    }
  }));
  const result = await service.execute(actionContext("slash"));

  assert.equal(result.ok, true);

  if (!result.ok) {
    throw new Error("Expected successful action.");
  }

  const replyOptions = toActionReplyOptions(result);
  const publicText = collectPublicReplyText(replyOptions);

  assert.match(publicText, /GIF: gif-interno/);
  assert.doesNotMatch(publicText, /providerGifId/i);
  assert.doesNotMatch(publicText, /secret-provider-gif-id/i);
  assert.doesNotMatch(publicText, /https?:\/\//i);
  assert.doesNotMatch(publicText, /giphy/i);
  assert.doesNotMatch(publicText, /fonte|source/i);
});

function safeDependencies(
  overrides: Partial<ActionServiceDependencies> = {}
): Partial<ActionServiceDependencies> {
  return {
    async validateGuild() {
      return null;
    },
    async validateBlocks() {
      return null;
    },
    async validatePermissions() {
      return null;
    },
    async validateCooldown() {
      return null;
    },
    async selectPhrase() {
      return {
        id: "phrase-1",
        text: "{autor} fez hug em {alvo}."
      };
    },
    async selectGif() {
      return undefined;
    },
    async calculateAffinity() {
      return {
        pointsAwarded: 2,
        totalPoints: 2,
        scoreReason: "awarded"
      };
    },
    async saveHistory() {
      return undefined;
    },
    ...overrides
  };
}

function actionContext(source: ActionSource): ActionContext {
  return {
    action: "hug",
    category: "carinho_fofo",
    source,
    guild: {
      id: "guild-1",
      name: "Guild"
    },
    channelId: "channel-1",
    actor: {
      id: "actor",
      displayName: "Actor",
      isBot: false
    },
    target: {
      id: "target",
      displayName: "Target",
      isBot: false
    },
    botUser: {
      id: "bot",
      isBot: true
    },
    now: new Date("2026-05-20T12:00:00.000Z"),
    metadata: {
      mentionUsers: false
    }
  };
}

function collectPublicReplyText(replyOptions: ReturnType<typeof toActionReplyOptions>): string {
  const embed = replyOptions.embeds?.[0] as { toJSON(): APIEmbed } | undefined;
  const embedJson = embed?.toJSON();
  const fields = embedJson?.fields?.flatMap((field) => [field.name, field.value]) ?? [];
  const footer = embedJson?.footer?.text;

  return [
    replyOptions.content,
    embedJson?.title,
    embedJson?.description,
    footer,
    ...fields
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}
