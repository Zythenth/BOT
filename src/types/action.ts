export const ACTION_NAMES = [
  "kiss",
  "hug",
  "beijotesta",
  "beijobochecha",
  "cafune",
  "consolar",
  "proteger",
  "morder",
  "cutucar"
] as const;

export const ACTION_CATEGORIES = [
  "carinho_fofo",
  "romance_leve",
  "apoio_emocional",
  "brincadeira",
  "utilitario",
  "admin",
  "consulta",
  "neutro",
  "carinho",
  "romance",
  "apoio"
] as const;

export const ACTION_SOURCES = ["slash", "prefix", "button"] as const;

export type KnownActionName = (typeof ACTION_NAMES)[number];
export type KnownActionCategory = (typeof ACTION_CATEGORIES)[number];
export type ActionSource = (typeof ACTION_SOURCES)[number];

export type ActionName = KnownActionName | (string & {});
export type ActionCategory = KnownActionCategory | (string & {});

export interface ActionGuildContext {
  id: string;
  name?: string;
}

export interface ActionUserContext {
  id: string;
  displayName?: string;
  isBot: boolean;
}

export interface ActionPermissionSnapshot {
  canSendMessages?: boolean;
  canEmbedLinks?: boolean;
  canUseExternalEmojis?: boolean;
}

export interface ActionContext {
  action: ActionName;
  category: ActionCategory;
  source: ActionSource;
  guild?: ActionGuildContext | null;
  channelId?: string;
  actor?: ActionUserContext | null;
  target?: ActionUserContext | null;
  botUser: ActionUserContext;
  permissions?: ActionPermissionSnapshot;
  now?: Date;
  metadata?: Record<string, unknown>;
}

export interface ActionPhraseSelection {
  id?: string;
  text: string;
}

export interface ActionGifSelection {
  id?: string;
  provider?: string;
  providerGifId?: string;
  imageUrl?: string;
}

export interface ActionAffinityResult {
  pointsAwarded: number;
  totalPoints?: number;
  previousTotalPoints?: number;
  affinityPairId?: string;
  dailyLimitReached?: boolean;
  cooldownUntil?: Date;
  maxPointsReached?: boolean;
  milestone?: ActionAffinityMilestone;
  previousMilestone?: ActionAffinityMilestone;
  milestoneReached?: boolean;
  scoreReason?: ActionAffinityScoreReason;
}

export interface ActionAffinityMilestone {
  key: string;
  name: string;
  minPoints: number;
}

export type ActionAffinityScoreReason =
  "awarded" | "not_pointable" | "opt_out" | "cooldown" | "daily_limit" | "max_points";

export interface ActionResponseButton {
  type: "button";
  customId: string;
  label: string;
  emoji?: string;
  style: "primary" | "secondary" | "success" | "danger";
  disabled?: boolean;
}

export interface ActionVisualPayload {
  content?: string;
  embed: {
    description: string;
    imageUrl?: string;
    authorLabel?: string;
    targetLabel?: string;
    actionLabel?: string;
    footer?: string;
    timestamp?: Date;
  };
  components: ActionResponseButton[];
}

export type ActionFailureCode =
  | "dm_not_allowed"
  | "guild_not_allowed"
  | "invalid_actor"
  | "invalid_target"
  | "bot_actor"
  | "bot_target"
  | "self_target"
  | "own_bot_target"
  | "blocked"
  | "category_disabled"
  | "channel_not_allowed"
  | "missing_permission"
  | "cooldown"
  | "expired"
  | "unknown_error";

export type ActionResult =
  | {
      ok: true;
      action: ActionName;
      category: ActionCategory;
      source: ActionSource;
      guildId: string;
      actorUserId: string;
      targetUserId: string;
      phrase: ActionPhraseSelection;
      gif?: ActionGifSelection;
      affinity: ActionAffinityResult;
      payload: ActionVisualPayload;
    }
  | {
      ok: false;
      code: ActionFailureCode;
      message: string;
      ephemeral: true;
    };
