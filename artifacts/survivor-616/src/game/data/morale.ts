/**
 * Crew morale: one crew-wide number that follows how your runs end.
 *
 * - A win raises it, a loss lowers it. It can go negative, and a loss while it is
 *   still negative digs deeper (down to `floor`).
 * - A loss while it is positive wipes the streak back to 0 instead.
 * - Below 0 the crew's boosts shrink. Above 0 nothing changes until the end game is
 *   reached; after that every point adds `endgameStackBonus` to every crew boost,
 *   with no upper limit.
 *
 * Every number lives in `MORALE_RULES`; the functions below only read it.
 */
export interface MoraleRules {
  win: number;
  loss: number;
  /** Lowest morale can fall. */
  floor: number;
  /** Boost lost per negative point. */
  penaltyPerPoint: number;
  /** Crew boosts never fall below this fraction. */
  minMultiplier: number;
  /** Boost gained per positive point once the end game is reached. */
  endgameStackBonus: number;
}

export const MORALE_RULES: MoraleRules = {
  win: 1,
  loss: -1,
  floor: -5,
  penaltyPerPoint: 0.1,
  minMultiplier: 0.5,
  endgameStackBonus: 0.25,
};

/** Morale after a run ends. `cleared` is the run's win flag. */
export function nextMorale(morale: number, cleared: boolean, rules: MoraleRules = MORALE_RULES): number {
  const current = Number.isFinite(morale) ? Math.trunc(morale) : 0;
  if (cleared) return current + rules.win;
  if (current > 0) return 0;
  return Math.max(rules.floor, current + rules.loss);
}

/** Runs won in a row after a run ends; any loss sends it back to 0. */
export function nextStreak(streak: number, cleared: boolean): number {
  const current = Number.isFinite(streak) ? Math.max(0, Math.trunc(streak)) : 0;
  return cleared ? current + 1 : 0;
}

/** Cleans a saved streak count: a whole number, never negative. */
export function normalizeStreak(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** What every crew boost is multiplied by at this morale. */
export function moraleMultiplier(morale: number, endgameReached: boolean, rules: MoraleRules = MORALE_RULES): number {
  const m = Number.isFinite(morale) ? Math.trunc(morale) : 0;
  if (m < 0) return Math.max(rules.minMultiplier, 1 + m * rules.penaltyPerPoint);
  if (m > 0 && endgameReached) return 1 + m * rules.endgameStackBonus;
  return 1;
}

/** Cleans a saved value: whole number, never below the floor. */
export function normalizeMorale(value: unknown, rules: MoraleRules = MORALE_RULES): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(rules.floor, Math.trunc(value));
}
