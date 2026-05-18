import {
  DEFAULT_AFFINITY_MAX_POINTS,
  DEFAULT_AFFINITY_PAIR_ACTION_COOLDOWN_MS,
  DEFAULT_AFFINITY_PAIR_DAILY_POINTS,
  DEFAULT_AFFINITY_TIME_ZONE,
  DEFAULT_AFFINITY_USER_COOLDOWN_MS,
  DEFAULT_AFFINITY_USER_DAILY_POINTS,
  DEFAULT_AFFINITY_USER_DAILY_SCORED_INTERACTIONS,
  getAffinityMilestone,
  getAffinityPointsForCategory
} from "../config";
import { affinityRepository, interactionRepository } from "../database";
import type {
  ActionAffinityResult,
  ActionCategory,
  ActionName,
  ActionSource
} from "../types";
import { preferenceService } from "./preferenceService";

export interface ApplyAffinityInput {
  guildId: string;
  actorUserId: string;
  targetUserId: string;
  action: ActionName;
  category: ActionCategory;
  source: ActionSource;
  occurredAt?: Date;
}

export interface AffinityServiceConfig {
  maxPoints: number;
  pairDailyPoints: number;
  userDailyPoints: number;
  userDailyScoredInteractions: number;
  userCooldownMs: number;
  pairActionCooldownMs: number;
  timeZone: string;
}

export interface AffinityService {
  applyAction(input: ApplyAffinityInput): Promise<ActionAffinityResult>;
  getMilestone(points: number): ReturnType<typeof getAffinityMilestone>;
  normalizePair(userOneId: string, userTwoId: string): ReturnType<typeof affinityRepository.normalizePair>;
}

export const defaultAffinityServiceConfig: AffinityServiceConfig = {
  maxPoints: DEFAULT_AFFINITY_MAX_POINTS,
  pairDailyPoints: DEFAULT_AFFINITY_PAIR_DAILY_POINTS,
  userDailyPoints: DEFAULT_AFFINITY_USER_DAILY_POINTS,
  userDailyScoredInteractions: DEFAULT_AFFINITY_USER_DAILY_SCORED_INTERACTIONS,
  userCooldownMs: DEFAULT_AFFINITY_USER_COOLDOWN_MS,
  pairActionCooldownMs: DEFAULT_AFFINITY_PAIR_ACTION_COOLDOWN_MS,
  timeZone: DEFAULT_AFFINITY_TIME_ZONE
};

export function createAffinityService(
  config: AffinityServiceConfig = defaultAffinityServiceConfig
): AffinityService {
  return {
    async applyAction(input) {
      const basePoints = getAffinityPointsForCategory(input.category);

      if (basePoints <= 0) {
        return {
          pointsAwarded: 0,
          scoreReason: "not_pointable"
        };
      }

      const now = input.occurredAt ?? new Date();
      const [actorOptedOut, targetOptedOut] = await Promise.all([
        preferenceService.hasOptedOut(input.actorUserId),
        preferenceService.hasOptedOut(input.targetUserId)
      ]);

      if (actorOptedOut || targetOptedOut) {
        return {
          pointsAwarded: 0,
          scoreReason: "opt_out"
        };
      }

      const pair = await affinityRepository.getOrCreatePair(
        input.guildId,
        input.actorUserId,
        input.targetUserId
      );
      const previousMilestone = getAffinityMilestone(pair.points);

      if (pair.points >= config.maxPoints) {
        await affinityRepository.recordAction({
          guildId: input.guildId,
          userOneId: input.actorUserId,
          userTwoId: input.targetUserId,
          pointsAwarded: 0,
          interactedAt: now
        });

        return {
          pointsAwarded: 0,
          totalPoints: pair.points,
          previousTotalPoints: pair.points,
          affinityPairId: pair.id,
          maxPointsReached: true,
          milestone: previousMilestone,
          previousMilestone,
          scoreReason: "max_points"
        };
      }

      const cooldownResult = await checkCooldowns(input, pair.id, now, config);

      if (cooldownResult) {
        await affinityRepository.recordAction({
          guildId: input.guildId,
          userOneId: input.actorUserId,
          userTwoId: input.targetUserId,
          pointsAwarded: 0,
          interactedAt: now
        });

        return {
          pointsAwarded: 0,
          totalPoints: pair.points,
          previousTotalPoints: pair.points,
          affinityPairId: pair.id,
          cooldownUntil: cooldownResult,
          milestone: previousMilestone,
          previousMilestone,
          scoreReason: "cooldown"
        };
      }

      const dailyAllowance = await calculateDailyAllowance(input, pair.id, now, config);
      const maxRemaining = Math.max(0, config.maxPoints - pair.points);
      const pointsAwarded = Math.max(
        0,
        Math.min(basePoints, dailyAllowance.remainingPoints, maxRemaining)
      );
      const updatedPair = await affinityRepository.recordAction({
        guildId: input.guildId,
        userOneId: input.actorUserId,
        userTwoId: input.targetUserId,
        pointsAwarded,
        interactedAt: now
      });
      const milestone = getAffinityMilestone(updatedPair.points);

      return {
        pointsAwarded,
        totalPoints: updatedPair.points,
        previousTotalPoints: pair.points,
        affinityPairId: updatedPair.id,
        dailyLimitReached: dailyAllowance.limitReached && pointsAwarded === 0,
        maxPointsReached: updatedPair.points >= config.maxPoints,
        milestone,
        previousMilestone,
        milestoneReached: milestone.key !== previousMilestone.key,
        scoreReason: pointsAwarded > 0
          ? "awarded"
          : dailyAllowance.limitReached
            ? "daily_limit"
            : "max_points"
      };
    },

    getMilestone(points) {
      return getAffinityMilestone(points);
    },

    normalizePair(userOneId, userTwoId) {
      return affinityRepository.normalizePair(userOneId, userTwoId);
    }
  };
}

export const affinityService = createAffinityService();

async function checkCooldowns(
  input: ApplyAffinityInput,
  affinityPairId: string,
  now: Date,
  config: AffinityServiceConfig
): Promise<Date | null> {
  const pairCooldownSince = new Date(now.getTime() - config.pairActionCooldownMs);
  const userCooldownSince = new Date(now.getTime() - config.userCooldownMs);
  const [pairAction, actorGlobal, targetGlobal] = await Promise.all([
    interactionRepository.findLatestScoredForPairAction({
      guildId: input.guildId,
      affinityPairId,
      action: input.action,
      since: pairCooldownSince
    }),
    interactionRepository.findLatestScoredForUser({
      guildId: input.guildId,
      userId: input.actorUserId,
      since: userCooldownSince
    }),
    interactionRepository.findLatestScoredForUser({
      guildId: input.guildId,
      userId: input.targetUserId,
      since: userCooldownSince
    })
  ]);
  const cooldownUntilValues = [
    pairAction
      ? addMilliseconds(pairAction.createdAt, config.pairActionCooldownMs)
      : null,
    actorGlobal
      ? addMilliseconds(actorGlobal.createdAt, config.userCooldownMs)
      : null,
    targetGlobal
      ? addMilliseconds(targetGlobal.createdAt, config.userCooldownMs)
      : null
  ].filter((value): value is Date => Boolean(value));

  if (cooldownUntilValues.length === 0) {
    return null;
  }

  return cooldownUntilValues.reduce((latest, candidate) =>
    candidate.getTime() > latest.getTime() ? candidate : latest
  );
}

async function calculateDailyAllowance(
  input: ApplyAffinityInput,
  affinityPairId: string,
  now: Date,
  config: AffinityServiceConfig
): Promise<{ remainingPoints: number; limitReached: boolean }> {
  const dayStart = getStartOfDayInTimeZone(now, config.timeZone);
  const [
    pairPointsToday,
    actorPointsToday,
    targetPointsToday,
    actorScoredInteractions,
    targetScoredInteractions
  ] = await Promise.all([
    interactionRepository.sumScoredPointsForPair({
      guildId: input.guildId,
      affinityPairId,
      since: dayStart
    }),
    interactionRepository.sumScoredPointsForUser({
      guildId: input.guildId,
      userId: input.actorUserId,
      since: dayStart
    }),
    interactionRepository.sumScoredPointsForUser({
      guildId: input.guildId,
      userId: input.targetUserId,
      since: dayStart
    }),
    interactionRepository.countScoredInteractionsForUser({
      guildId: input.guildId,
      userId: input.actorUserId,
      since: dayStart
    }),
    interactionRepository.countScoredInteractionsForUser({
      guildId: input.guildId,
      userId: input.targetUserId,
      since: dayStart
    })
  ]);
  const remainingPairPoints = config.pairDailyPoints - pairPointsToday;
  const remainingActorPoints = config.userDailyPoints - actorPointsToday;
  const remainingTargetPoints = config.userDailyPoints - targetPointsToday;
  const actorInteractionLimitReached =
    actorScoredInteractions >= config.userDailyScoredInteractions;
  const targetInteractionLimitReached =
    targetScoredInteractions >= config.userDailyScoredInteractions;
  const interactionLimitReached =
    actorInteractionLimitReached || targetInteractionLimitReached;
  const remainingPoints = Math.max(
    0,
    interactionLimitReached
      ? 0
      : Math.min(remainingPairPoints, remainingActorPoints, remainingTargetPoints)
  );

  return {
    remainingPoints,
    limitReached: remainingPoints <= 0 || interactionLimitReached
  };
}

function getStartOfDayInTimeZone(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = Number(readDatePart(parts, "year"));
  const month = Number(readDatePart(parts, "month"));
  const day = Number(readDatePart(parts, "day"));

  return zonedDateTimeToUtc(year, month, day, timeZone);
}

function zonedDateTimeToUtc(year: number, month: number, day: number, timeZone: string): Date {
  const localUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  let offsetMs = getTimeZoneOffsetMs(new Date(localUtcMs), timeZone);
  offsetMs = getTimeZoneOffsetMs(new Date(localUtcMs - offsetMs), timeZone);

  return new Date(localUtcMs - offsetMs);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const year = Number(readDatePart(parts, "year"));
  const month = Number(readDatePart(parts, "month"));
  const day = Number(readDatePart(parts, "day"));
  const hour = normalizeHour(Number(readDatePart(parts, "hour")));
  const minute = Number(readDatePart(parts, "minute"));
  const second = Number(readDatePart(parts, "second"));
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);

  return asUtc - date.getTime();
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((part) => part.type === type)?.value ?? "0";
}

function normalizeHour(hour: number): number {
  return hour === 24 ? 0 : hour;
}

function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}
