import { ENEMY_QUIRKS, QUIRK_EVERYWHERE_KILLS, QUIRK_TAKE_ON_KILLS } from '@/game/data/enemyQuirks';

/**
 * Switches for the Enemy quirks end-game feature, kept in the browser:
 *  - off: quirks the player has switched off entirely (missing means on)
 *  - everywhere: quirks set to hit every enemy (needs QUIRK_EVERYWHERE_KILLS kills)
 *  - taken: quirks the player has taken on (needs QUIRK_TAKE_ON_KILLS kills)
 * Both of the last two default to off, and are only honored once earned.
 */
export const QUIRK_STORAGE_KEY = 'survivor616.quirks.v1';

export interface QuirkSwitches {
  off: string[];
  everywhere: string[];
  taken: string[];
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const KNOWN = new Set(ENEMY_QUIRKS.map((quirk) => quirk.id));

function ids(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && KNOWN.has(id)))]
    : [];
}

function read(): QuirkSwitches {
  try {
    const raw = storage()?.getItem(QUIRK_STORAGE_KEY);
    if (!raw) return { off: [], everywhere: [], taken: [] };
    const parsed: unknown = JSON.parse(raw);
    // The first version stored just the list of switched-off quirks.
    if (Array.isArray(parsed)) return { off: ids(parsed), everywhere: [], taken: [] };
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      return { off: ids(record.off), everywhere: ids(record.everywhere), taken: ids(record.taken) };
    }
  } catch {
    // Fall through to defaults.
  }
  return { off: [], everywhere: [], taken: [] };
}

function write(next: QuirkSwitches): void {
  try {
    storage()?.setItem(QUIRK_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable; the switch simply won't persist.
  }
}

export function quirkSwitches(): QuirkSwitches {
  return read();
}

/** Ids of quirks the player has switched off. Unknown ids are dropped. */
export function disabledQuirkIds(): string[] {
  return read().off;
}

export function isQuirkEnabled(id: string): boolean {
  return !read().off.includes(id);
}

function withMember(list: string[], id: string, member: boolean): string[] {
  const set = new Set(list);
  if (member) set.add(id);
  else set.delete(id);
  return [...set];
}

export function setQuirkEnabled(id: string, enabled: boolean): void {
  const current = read();
  write({ ...current, off: withMember(current.off, id, !enabled) });
}

export function setAllQuirksEnabled(enabled: boolean): void {
  write({ ...read(), off: enabled ? [] : ENEMY_QUIRKS.map((quirk) => quirk.id) });
}

export function setQuirkEverywhere(id: string, on: boolean): void {
  const current = read();
  write({ ...current, everywhere: withMember(current.everywhere, id, on) });
}

export function setQuirkTaken(id: string, on: boolean): void {
  const current = read();
  write({ ...current, taken: withMember(current.taken, id, on) });
}

/** Kills with a quirk needed before each option opens. */
export function quirkUnlocks(kills: number): { everywhere: boolean; taken: boolean } {
  return { everywhere: kills >= QUIRK_EVERYWHERE_KILLS, taken: kills >= QUIRK_TAKE_ON_KILLS };
}

/** The setup a run should use: switches that are on AND earned. */
export function earnedQuirkRunSetup(quirkKills: Record<string, number>, allUnlocked = false): {
  disabledIds: string[];
  everywhereIds: string[];
  takenIds: string[];
} {
  const current = read();
  const unlocked = (id: string) => quirkUnlocks(allUnlocked ? Number.POSITIVE_INFINITY : (quirkKills[id] ?? 0));
  return {
    disabledIds: current.off,
    everywhereIds: current.everywhere.filter((id) => unlocked(id).everywhere),
    takenIds: current.taken.filter((id) => unlocked(id).taken),
  };
}
