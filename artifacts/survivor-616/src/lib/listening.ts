/**
 * What the player listens to, kept only on this device: favourites (hearts), how many times each
 * song was played, and time spent listening. It feeds the Favorites and Recently played shelves in
 * the Jukebox. A "play" counts once a song has actually been heard for a while (not a skip), and
 * recording history can be switched off in Settings, which also clears it. Hearts are the player's
 * own list and are kept either way.
 */
import { useSyncExternalStore } from 'react';

import { createPref } from './devicePref';

export interface TrackStat {
  plays: number;
  /** Seconds listened across all plays. */
  seconds: number;
  /** Epoch ms of the most recent counted play. */
  last: number;
}

export interface ListeningState {
  stats: Record<string, TrackStat>;
  favorites: string[];
}

/** A song must be heard this long before it counts as a play. */
export const PLAY_THRESHOLD_SEC = 20;
const MAX_TRACKED = 400;

export const listeningHistoryPref = createPref<boolean>('survivor616.listening.history.v1', true);
export const favoritesShelfPref = createPref<boolean>('survivor616.jukebox.shelf-favorites.v1', true);
export const recentShelfPref = createPref<boolean>('survivor616.jukebox.shelf-recent.v1', true);

export const emptyListening = (): ListeningState => ({ stats: {}, favorites: [] });

const statOf = (state: ListeningState, id: string): TrackStat => state.stats[id] ?? { plays: 0, seconds: 0, last: 0 };

export function addSeconds(state: ListeningState, id: string, seconds: number): ListeningState {
  if (!id || !(seconds > 0)) return state;
  const stat = statOf(state, id);
  return { ...state, stats: { ...state.stats, [id]: { ...stat, seconds: stat.seconds + seconds } } };
}

export function recordPlay(state: ListeningState, id: string, now: number): ListeningState {
  if (!id) return state;
  const stat = statOf(state, id);
  const stats = { ...state.stats, [id]: { ...stat, plays: stat.plays + 1, last: now } };
  const ids = Object.keys(stats);
  if (ids.length > MAX_TRACKED) {
    // Keep the most recently heard songs; forgetting the oldest keeps the save small.
    ids.sort((a, b) => stats[b]!.last - stats[a]!.last);
    for (const drop of ids.slice(MAX_TRACKED)) delete stats[drop];
  }
  return { ...state, stats };
}

export function toggleFavorite(state: ListeningState, id: string): ListeningState {
  if (!id) return state;
  const has = state.favorites.includes(id);
  return { ...state, favorites: has ? state.favorites.filter((f) => f !== id) : [...state.favorites, id] };
}

/** Most recently played first, only songs that were really played. */
export function recentIds(state: ListeningState, limit = 8): string[] {
  return Object.entries(state.stats)
    .filter(([, s]) => s.plays > 0)
    .sort((a, b) => b[1].last - a[1].last)
    .slice(0, limit)
    .map(([id]) => id);
}

export function totalSeconds(state: ListeningState): number {
  return Object.values(state.stats).reduce((sum, s) => sum + s.seconds, 0);
}

export function totalPlays(state: ListeningState): number {
  return Object.values(state.stats).reduce((sum, s) => sum + s.plays, 0);
}

/** "1h 20m", "12m", "45s". */
export function formatListening(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// ---- device store ---------------------------------------------------------------------------

const KEY = 'survivor616.listening.v1';
let current: ListeningState | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): ListeningState {
  if (!raw) return emptyListening();
  try {
    const data = JSON.parse(raw) as Partial<ListeningState>;
    const stats: Record<string, TrackStat> = {};
    for (const [id, s] of Object.entries(data.stats ?? {})) {
      if (s && Number.isFinite(s.plays) && Number.isFinite(s.seconds) && Number.isFinite(s.last)) stats[id] = { plays: s.plays, seconds: s.seconds, last: s.last };
    }
    const favorites = Array.isArray(data.favorites) ? data.favorites.filter((f): f is string => typeof f === 'string') : [];
    return { stats, favorites };
  } catch {
    return emptyListening();
  }
}

export function readListening(): ListeningState {
  if (current) return current;
  try {
    current = parse(window.localStorage.getItem(KEY));
  } catch {
    current = emptyListening();
  }
  return current;
}

export function writeListening(next: ListeningState): void {
  current = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: lives until reload */
  }
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      current = null;
      listeners.forEach((l) => l());
    }
  });
}

export function useListening(): ListeningState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readListening,
    emptyListening,
  );
}

/** Forget what was played and for how long. Hearts are kept. */
export function clearListeningHistory(): void {
  writeListening({ ...readListening(), stats: {} });
}
