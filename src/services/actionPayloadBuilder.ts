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
      description: phrase.text,
      imageUrl: gif?.imageUrl,
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

export function renderActionPhraseTemplate(template: string, context: RequiredActionPayloadContext): string {
  return template
    .replaceAll("{actor}", displayName(context.actor))
    .replaceAll("{target}", displayName(context.target))
    .replaceAll("{action}", context.action);
}

export function fallbackActionPhrase(context: RequiredActionPayloadContext): string {
  return `${displayName(context.actor)} fez ${context.action} em ${displayName(context.target)}.`;
}

export interface RequiredActionPayloadContext extends ActionContext {
  guild: NonNullable<ActionContext["guild"]>;
  actor: NonNullable<ActionContext["actor"]>;
  target: NonNullable<ActionContext["target"]>;
  now: Date;
}

function displayName(user: { id: string; displayName?: string }): string {
  return user.displayName ?? `<@${user.id}>`;
}

function buildAffinityFooter(affinity: ActionAffinityResult): string | undefined {
  if (affinity.dailyLimitReached) {
    return "Limite diario de afinidade atingido.";
  }

  if (affinity.pointsAwarded > 0 && affinity.totalPoints !== undefined) {
    return `+${affinity.pointsAwarded} afinidade | Total: ${affinity.totalPoints}`;
  }

  if (affinity.pointsAwarded > 0) {
    return `+${affinity.pointsAwarded} afinidade`;
  }

  return undefined;
}
