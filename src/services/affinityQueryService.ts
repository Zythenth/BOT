import { affinityRepository, interactionRepository, type ActionCountResult } from "../database";
import {
  getAffinityMilestone,
  getRpActionStatsLabel,
  RP_ACTION_DEFINITIONS
} from "../config";
import { rankingService, type AffinityRankingEntry } from "./rankingService";

export interface ActionUsageCount {
  action: string;
  label: string;
  count: number;
}

export interface ActionUsageBreakdown {
  fromUserOneToUserTwo: ActionUsageCount[];
  fromUserTwoToUserOne: ActionUsageCount[];
}

export interface AffinityPairSummary {
  userAId: string;
  userBId: string;
  points: number;
  interactionCount: number;
  lastInteractionAt?: Date | null;
  milestone: ReturnType<typeof getAffinityMilestone>;
  actionBreakdown: ActionUsageBreakdown;
}

export const affinityQueryService = {
  async getPairSummary(
    guildId: string,
    userOneId: string,
    userTwoId: string
  ): Promise<AffinityPairSummary> {
    const [pair, actionBreakdown] = await Promise.all([
      affinityRepository.findPair(guildId, userOneId, userTwoId),
      getActionUsageBreakdown(guildId, userOneId, userTwoId)
    ]);
    const normalizedPair = affinityRepository.normalizePair(userOneId, userTwoId);

    if (!pair) {
      return {
        ...normalizedPair,
        points: 0,
        interactionCount: 0,
        lastInteractionAt: null,
        milestone: getAffinityMilestone(0),
        actionBreakdown
      };
    }

    return {
      userAId: pair.userAId,
      userBId: pair.userBId,
      points: pair.points,
      interactionCount: pair.interactionCount,
      lastInteractionAt: pair.lastInteractionAt,
      milestone: getAffinityMilestone(pair.points),
      actionBreakdown
    };
  },

  async getGuildRanking(guildId: string, limit = 10): Promise<AffinityRankingEntry[]> {
    const ranking = await rankingService.getGuildPairRanking({
      guildId,
      pageSize: limit
    });

    return ranking.entries;
  }
};

async function getActionUsageBreakdown(
  guildId: string,
  userOneId: string,
  userTwoId: string
): Promise<ActionUsageBreakdown> {
  const actions = RP_ACTION_DEFINITIONS.map((definition) => definition.action);
  const [fromUserOneToUserTwo, fromUserTwoToUserOne] = await Promise.all([
    interactionRepository.countActionsBetweenUsers({
      guildId,
      actorUserId: userOneId,
      targetUserId: userTwoId,
      actions
    }),
    interactionRepository.countActionsBetweenUsers({
      guildId,
      actorUserId: userTwoId,
      targetUserId: userOneId,
      actions
    })
  ]);

  return {
    fromUserOneToUserTwo: buildUsageCounts(fromUserOneToUserTwo),
    fromUserTwoToUserOne: buildUsageCounts(fromUserTwoToUserOne)
  };
}

function buildUsageCounts(counts: readonly ActionCountResult[]): ActionUsageCount[] {
  const countByAction = new Map(counts.map((count) => [count.action, count.count]));

  return RP_ACTION_DEFINITIONS.map((definition) => ({
    action: definition.action,
    label: getRpActionStatsLabel(definition.action),
    count: countByAction.get(definition.action) ?? 0
  }));
}
