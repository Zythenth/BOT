export interface CooldownCheckInput {
  now: Date;
  lastUsedAt?: Date | null;
  cooldownMs: number;
}

export interface CooldownCheckResult {
  onCooldown: boolean;
  cooldownUntil?: Date;
  remainingMs: number;
}

export interface CooldownService {
  check(input: CooldownCheckInput): CooldownCheckResult;
  getCooldownUntil(input: CooldownCheckInput): Date | undefined;
  isOnCooldown(input: CooldownCheckInput): boolean;
}

export const cooldownService: CooldownService = {
  check(input) {
    const cooldownUntil = getCooldownUntil(input);

    if (!cooldownUntil) {
      return {
        onCooldown: false,
        remainingMs: 0
      };
    }

    return {
      onCooldown: true,
      cooldownUntil,
      remainingMs: cooldownUntil.getTime() - input.now.getTime()
    };
  },

  getCooldownUntil,

  isOnCooldown(input) {
    return Boolean(getCooldownUntil(input));
  }
};

export function getCooldownUntil(input: CooldownCheckInput): Date | undefined {
  if (!input.lastUsedAt || input.cooldownMs <= 0) {
    return undefined;
  }

  const cooldownUntil = new Date(input.lastUsedAt.getTime() + input.cooldownMs);

  return cooldownUntil.getTime() > input.now.getTime()
    ? cooldownUntil
    : undefined;
}
