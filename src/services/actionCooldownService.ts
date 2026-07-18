import { DEFAULT_ACTION_COOLDOWN_SECONDS } from "../config";
import { interactionRepository } from "../database";
import type { ActionResult } from "../types";
import type { RequiredActionPayloadContext } from "./actionPayloadBuilder";
import { failAction } from "./actionValidation";
import { cooldownService, type CooldownService } from "./cooldownService";

export interface ActionCooldownConfig {
  enabled: boolean;
  cooldownSeconds?: number;
}

export interface ActionCooldownInteractionRepository {
  findLatestForActor(filters: {
    guildId: string;
    actorUserId: string;
    since?: Date;
  }): Promise<{ createdAt: Date } | null>;
  findLatestBetweenUsers(filters: {
    guildId: string;
    userOneId: string;
    userTwoId: string;
    action?: string;
    since?: Date;
  }): Promise<{ createdAt: Date } | null>;
}

export interface ActionCooldownDependencies {
  interactions: ActionCooldownInteractionRepository;
  cooldowns: CooldownService;
}

export interface ActionCooldownService {
  validate(
    context: RequiredActionPayloadContext,
    config: ActionCooldownConfig
  ): Promise<ActionResult | null>;
}

const defaultActionCooldownDependencies: ActionCooldownDependencies = {
  interactions: interactionRepository,
  cooldowns: cooldownService
};

export function createActionCooldownService(
  dependencies: ActionCooldownDependencies = defaultActionCooldownDependencies
): ActionCooldownService {
  return {
    async validate(context, config) {
      if (!config.enabled) {
        return null;
      }

      const cooldownMs = resolveCooldownMs(config.cooldownSeconds);

      if (cooldownMs <= 0) {
        return null;
      }

      const since = new Date(context.now.getTime() - cooldownMs);
      const [actorLatest, pairLatest, pairActionLatest] = await Promise.all([
        dependencies.interactions.findLatestForActor({
          guildId: context.guild.id,
          actorUserId: context.actor.id,
          since
        }),
        dependencies.interactions.findLatestBetweenUsers({
          guildId: context.guild.id,
          userOneId: context.actor.id,
          userTwoId: context.target.id,
          since
        }),
        dependencies.interactions.findLatestBetweenUsers({
          guildId: context.guild.id,
          userOneId: context.actor.id,
          userTwoId: context.target.id,
          action: context.action,
          since
        })
      ]);
      const cooldownUntil = [actorLatest, pairLatest, pairActionLatest]
        .map((interaction) =>
          dependencies.cooldowns.getCooldownUntil({
            now: context.now,
            lastUsedAt: interaction?.createdAt,
            cooldownMs
          })
        )
        .filter((value): value is Date => Boolean(value))
        .reduce<Date | undefined>(
          (latest, candidate) =>
            !latest || candidate.getTime() > latest.getTime() ? candidate : latest,
          undefined
        );

      if (!cooldownUntil) {
        return null;
      }

      return failAction(
        "cooldown",
        `Aguarde ${formatRemaining(cooldownUntil, context.now)} antes de mandar outra acao de RP.`
      );
    }
  };
}

export const actionCooldownService = createActionCooldownService();

export function readActionCooldownSeconds(): number {
  const rawValue = Number(process.env.ACTION_COOLDOWN_SECONDS);

  return Number.isInteger(rawValue) && rawValue >= 0 ? rawValue : DEFAULT_ACTION_COOLDOWN_SECONDS;
}

function resolveCooldownMs(seconds = readActionCooldownSeconds()): number {
  return Math.max(0, seconds * 1000);
}

function formatRemaining(cooldownUntil: Date, now: Date): string {
  const seconds = Math.max(1, Math.ceil((cooldownUntil.getTime() - now.getTime()) / 1000));

  return seconds === 1 ? "1 segundo" : `${seconds} segundos`;
}
