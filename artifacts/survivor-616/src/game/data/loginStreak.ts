import { contractDayKey } from '@/game/data/contracts';

export interface LoginStreakReward {
  day: number;
  rewardCred: number;
  rewardKeys: number;
}

const DAY_MS = 86_400_000;

/** A 7-day escalating cycle; day 7 is the big payout, then the cycle loops. */
export function loginStreakReward(day: number): LoginStreakReward {
  const cycleDay = ((day - 1) % 7) + 1;
  return {
    day,
    rewardCred: 20 + cycleDay * 10,
    rewardKeys: cycleDay === 7 ? 1 : 0,
  };
}

export interface LoginStreakAdvance {
  dayKey: string;
  streakCount: number;
  /** null when today's bonus was already claimed. */
  reward: LoginStreakReward | null;
}

/** Uses the same local-calendar day key as the Broadcast contract board. */
export function advanceLoginStreak(lastDayKey: string, streakCount: number, now = Date.now()): LoginStreakAdvance {
  const today = contractDayKey(now);
  if (lastDayKey === today) return { dayKey: today, streakCount, reward: null };
  const yesterday = contractDayKey(now - DAY_MS);
  const nextCount = lastDayKey === yesterday ? streakCount + 1 : 1;
  return { dayKey: today, streakCount: nextCount, reward: loginStreakReward(nextCount) };
}
