/**
 * What the bedroom objects say about your save: counts and alerts drawn on them. Pure function of the meta state,
 * so the room is just another view of the same data the menus show. Keys are anchor ids from `rooms616.ts`.
 */
import type { MetaState } from '../types';
import { advanceLoginStreak } from './loginStreak';

export interface RoomObjectStatus {
  /** A number shown in a small tag on the object (owned, found, streak). */
  count?: number;
  /** A pulsing dot: something is waiting here. */
  alert?: boolean;
}

export function bedroomStatus(meta: MetaState, now = Date.now()): Record<string, RoomObjectStatus> {
  const loginReady = advanceLoginStreak(meta.lastLoginStreakDayKey, meta.loginStreakCount, now).reward !== null;
  return {
    roster: { count: meta.unlockedCharacterIds.length },
    kennel: { count: meta.savedLokPets.length },
    bestiary: { count: Object.keys(meta.bestiary).length },
    unlocks: { count: meta.discoveryIds.length },
    runs: { count: meta.clearedAreaIds.length },
    'lok-shop': { count: meta.cred },
    stash: { alert: loginReady, count: meta.loginStreakCount },
    account: { alert: false },
  };
}
