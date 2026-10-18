import { updateLedger, type AchievementLedger } from '@workspace/lok-client';

import { ACHIEVEMENTS } from '@/game/data/achievements';
import type { MetaState } from '@/game/types';
import { LOKDEX_APP_KEY } from '@/lib/lokDexSnapshot';

/**
 * 616's achievements are computed from `MetaState`, never stored, so nothing in
 * the save says WHEN one was earned. This keeps a small permanent ledger in its
 * own localStorage key: the first time an achievement is seen complete, it is
 * stamped with the time. Whatever was already complete the first time the ledger
 * is built is recorded as "earned before tracking began" (date unknown), never
 * as "just now". The ledger only ever grows.
 *
 * While signed in it is reported to the GSix account (`gsix_achievements_report`)
 * so the hub's Achievements page can show what is earned, and when.
 */
export const ACHIEVEMENTS_APP_KEY = LOKDEX_APP_KEY;
export const ACHIEVEMENT_LEDGER_KEY = 'survivor616.achievement-ledger.v1';

/** The slice of `localStorage` this needs, so it can be tested without a browser. */
export interface LedgerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function completeAchievementIds(meta: MetaState): string[] {
  return ACHIEVEMENTS.filter((achievement) => achievement.isComplete(meta)).map((achievement) => achievement.id);
}

export function readLedger(storage: LedgerStorage): AchievementLedger | null {
  try {
    const raw = storage.getItem(ACHIEVEMENT_LEDGER_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as AchievementLedger) : null;
  } catch {
    return null;
  }
}

/** Brings the stored ledger up to date with `meta`, saves it if it changed, and returns it. */
export function syncAchievementLedger(meta: MetaState, storage: LedgerStorage, now = Date.now()): AchievementLedger {
  const stored = readLedger(storage);
  const { ledger, changed } = updateLedger(stored ?? {}, completeAchievementIds(meta), now, { firstRun: stored === null });
  if (changed || stored === null) {
    try {
      storage.setItem(ACHIEVEMENT_LEDGER_KEY, JSON.stringify(ledger));
    } catch {
      /* storage blocked: the returned ledger still serves this session */
    }
  }
  return ledger;
}
