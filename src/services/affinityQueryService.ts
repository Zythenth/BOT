import { affinityRepository } from "../database";

export interface AffinityPairSummary {
  userAId: string;
  userBId: string;
  points: number;
  interactionCount: number;
  lastInteractionAt?: Date | null;
}

export interface AffinityRankingEntry extends AffinityPairSummary {
  position: number;
}

export const affinityQueryService = {
  async getPairSummary(
    guildId: string,
    userOneId: string,
    userTwoId: string
  ): Promise<AffinityPairSummary> {
    const pair = await affinityRepository.findPair(guildId, userOneId, userTwoId);
    const normalizedPair = affinityRepository.normalizePair(userOneId, userTwoId);

    if (!pair) {
      return {
        ...normalizedPair,
        points: 0,
        interactionCount: 0,
        lastInteractionAt: null
      };
    }

    return {
      userAId: pair.userAId,
      userBId: pair.userBId,
      points: pair.points,
      interactionCount: pair.interactionCount,
      lastInteractionAt: pair.lastInteractionAt
    };
  },

  async getGuildRanking(guildId: string, limit = 10): Promise<AffinityRankingEntry[]> {
    const pairs = await affinityRepository.listByGuild(guildId, { take: limit });

    return pairs.map((pair, index) => ({
      position: index + 1,
      userAId: pair.userAId,
      userBId: pair.userBId,
      points: pair.points,
      interactionCount: pair.interactionCount,
      lastInteractionAt: pair.lastInteractionAt
    }));
  }
};
