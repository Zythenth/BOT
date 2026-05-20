import type {
  ActionAffinityResult,
  ActionContext,
  ActionGifSelection,
  ActionPhraseSelection,
  ActionResponseButton,
  ActionVisualPayload
} from "../types";

export function buildDefaultActionPayload(
  context: RequiredActionPayloadContext,
  phrase: ActionPhraseSelection,
  gif: ActionGifSelection | undefined,
  affinity: ActionAffinityResult
): ActionVisualPayload {
  return {
    embed: {
      description: buildDescription(context, phrase, affinity),
      imageUrl: gif?.imageUrl,
      authorLabel: displayName(context.actor, context),
      targetLabel: displayName(context.target, context),
      actionLabel: `/${context.action}`,
      footer: buildAffinityFooter(affinity),
      timestamp: context.now
    },
    components: [buildRetributeButton(context)]
  };
}

export function buildRetributeButton(context: RequiredActionPayloadContext): ActionResponseButton {
  return {
    type: "button",
    customId: buildRetributeCustomId(context),
    label: "Retribuir",
    emoji: "\u{1F60A}",
    style: "secondary"
  };
}

export function buildRetributeCustomId(context: RequiredActionPayloadContext): string {
  return [
    "rp",
    "retribute",
    context.action,
    context.guild.id,
    context.actor.id,
    context.target.id
  ].join(":");
}

export function renderActionPhraseTemplate(
  template: string,
  context: RequiredActionPayloadContext,
  affinity?: ActionAffinityResult
): string {
  return template
    .replaceAll("{autor}", displayName(context.actor, context))
    .replaceAll("{alvo}", displayName(context.target, context))
    .replaceAll("{pontos}", String(affinity?.pointsAwarded ?? 0))
    .replaceAll("{total}", String(affinity?.totalPoints ?? 0))
    .replaceAll("{marco}", affinity?.milestone?.name ?? "Sem marco")
    .replaceAll("{actor}", displayName(context.actor, context))
    .replaceAll("{target}", displayName(context.target, context))
    .replaceAll("{action}", context.action);
}

export function fallbackActionPhrase(context: RequiredActionPayloadContext): string {
  return `${displayName(context.actor, context)} fez ${context.action} em ${displayName(context.target, context)}.`;
}

export interface RequiredActionPayloadContext extends ActionContext {
  guild: NonNullable<ActionContext["guild"]>;
  actor: NonNullable<ActionContext["actor"]>;
  target: NonNullable<ActionContext["target"]>;
  now: Date;
}

function displayName(
  user: { id: string; displayName?: string },
  context: RequiredActionPayloadContext
): string {
  if (context.metadata?.mentionUsers === false) {
    return user.displayName ?? `usuario ${user.id}`;
  }

  return `<@${user.id}>`;
}

function buildDescription(
  context: RequiredActionPayloadContext,
  phrase: ActionPhraseSelection,
  affinity: ActionAffinityResult
): string {
  const renderedPhrase = renderActionPhraseTemplate(phrase.text, context, affinity);
  const customMessage = readCustomMessage(context.metadata?.customMessage);

  if (!customMessage) {
    return renderedPhrase;
  }

  return `${renderedPhrase}\n\n"${customMessage}"`;
}

function readCustomMessage(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildAffinityFooter(affinity: ActionAffinityResult): string | undefined {
  const segments: string[] = [];

  if (affinity.pointsAwarded > 0) {
    segments.push(`+${affinity.pointsAwarded} afinidade`);
  }

  if (affinity.scoreReason === "cooldown") {
    segments.push("Sem pontos: cooldown ativo");
  }

  if (affinity.dailyLimitReached) {
    segments.push("Sem pontos: limite diario atingido");
  }

  if (affinity.maxPointsReached) {
    segments.push("Afinidade maxima");
  }

  if (affinity.totalPoints !== undefined) {
    segments.push(`Total: ${affinity.totalPoints}`);
  }

  if (affinity.milestoneReached && affinity.milestone) {
    segments.push(`Novo marco: ${affinity.milestone.name}`);
  } else if (affinity.milestone) {
    segments.push(`Marco: ${affinity.milestone.name}`);
  }

  return segments.length > 0 ? segments.join(" | ") : undefined;
}
