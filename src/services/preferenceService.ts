import { userPreferenceRepository } from "../database";

export interface UserPreferenceView {
  userId: string;
  locale: string;
  allowRomance: boolean;
  hideFromRankings: boolean;
  optedOutOfAffinity: boolean;
}

export interface UpdateUserPreferencesInput {
  userId: string;
  allowRomance?: boolean;
  hideFromRankings?: boolean;
}

export const preferenceService = {
  async getOrCreate(userId: string): Promise<UserPreferenceView> {
    const preference = await userPreferenceRepository.findByUserId(userId);

    if (preference) {
      return toView(preference);
    }

    return toView(await userPreferenceRepository.upsert({ userId }));
  },

  async update(input: UpdateUserPreferencesInput): Promise<UserPreferenceView> {
    const current = await preferenceService.getOrCreate(input.userId);

    return toView(
      await userPreferenceRepository.upsert({
        userId: input.userId,
        locale: current.locale,
        allowRomance: input.allowRomance ?? current.allowRomance,
        hideFromRankings: input.hideFromRankings ?? current.hideFromRankings,
        optedOutOfAffinity: current.optedOutOfAffinity
      })
    );
  },

  async optOut(userId: string): Promise<UserPreferenceView> {
    const current = await preferenceService.getOrCreate(userId);

    return toView(
      await userPreferenceRepository.upsert({
        userId,
        locale: current.locale,
        allowRomance: false,
        hideFromRankings: true,
        optedOutOfAffinity: true
      })
    );
  },

  async optIn(userId: string): Promise<UserPreferenceView> {
    const current = await preferenceService.getOrCreate(userId);

    return toView(
      await userPreferenceRepository.upsert({
        userId,
        locale: current.locale,
        allowRomance: current.allowRomance,
        hideFromRankings: false,
        optedOutOfAffinity: false
      })
    );
  },

  async hasOptedOut(userId: string): Promise<boolean> {
    const preference = await userPreferenceRepository.findByUserId(userId);
    return preference?.optedOutOfAffinity ?? false;
  },

  async allowsRomance(userId: string): Promise<boolean> {
    const preference = await userPreferenceRepository.findByUserId(userId);
    return preference?.allowRomance ?? false;
  }
};

function toView(preference: UserPreferenceView): UserPreferenceView {
  return {
    userId: preference.userId,
    locale: preference.locale,
    allowRomance: preference.allowRomance,
    hideFromRankings: preference.hideFromRankings,
    optedOutOfAffinity: preference.optedOutOfAffinity
  };
}
