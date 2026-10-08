import { ENEMY_QUIRKS } from '@/game/data/enemyQuirks';

/** Per-quirk switches for the Enemy quirks end-game feature. Missing means on. */
export const QUIRK_STORAGE_KEY = 'survivor616.quirks.v1';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Ids of quirks the player has switched off. Unknown ids are dropped. */
export function disabledQuirkIds(): string[] {
  try {
    const raw = storage()?.getItem(QUIRK_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const known = new Set(ENEMY_QUIRKS.map((quirk) => quirk.id));
    return [...new Set(parsed.filter((id): id is string => typeof id === 'string' && known.has(id)))];
  } catch {
    return [];
  }
}

export function isQuirkEnabled(id: string): boolean {
  return !disabledQuirkIds().includes(id);
}

export function setQuirkEnabled(id: string, enabled: boolean): void {
  const off = new Set(disabledQuirkIds());
  if (enabled) off.delete(id);
  else off.add(id);
  try {
    storage()?.setItem(QUIRK_STORAGE_KEY, JSON.stringify([...off]));
  } catch {
    // Storage can be unavailable; the switch simply won't persist.
  }
}

export function setAllQuirksEnabled(enabled: boolean): void {
  try {
    storage()?.setItem(QUIRK_STORAGE_KEY, JSON.stringify(enabled ? [] : ENEMY_QUIRKS.map((quirk) => quirk.id)));
  } catch {
    // See above.
  }
}
