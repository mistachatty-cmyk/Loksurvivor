import { useSyncExternalStore } from 'react';

/**
 * The player's own sound settings: three tone bands, an even-volume switch and a mono switch. Kept apart
 * from the theater tone (which is the room's own sound) and applied after the analyser, so the visuals
 * and beat reading never change. Everything defaults to flat and nothing is created until you move it.
 */
export const EQ_LIMIT_DB = 12;

export type EqPresetId = 'flat' | 'bass-boost' | 'warm' | 'bright' | 'vocal' | 'small-speaker' | 'late-night';

export interface EqBands {
  bassDb: number;
  midDb: number;
  trebleDb: number;
}

export interface EqSettings extends EqBands {
  evenVolume: boolean;
  mono: boolean;
}

export const FLAT_EQ: EqSettings = { bassDb: 0, midDb: 0, trebleDb: 0, evenVolume: false, mono: false };

export const EQ_PRESETS: ReadonlyArray<{ id: EqPresetId } & EqBands> = [
  { id: 'flat', bassDb: 0, midDb: 0, trebleDb: 0 },
  { id: 'bass-boost', bassDb: 8, midDb: 0, trebleDb: -1 },
  { id: 'warm', bassDb: 3, midDb: 1, trebleDb: -3 },
  { id: 'bright', bassDb: -1, midDb: 0, trebleDb: 5 },
  { id: 'vocal', bassDb: -2, midDb: 4, trebleDb: 2 },
  { id: 'small-speaker', bassDb: -3, midDb: 3, trebleDb: 2 },
  { id: 'late-night', bassDb: -5, midDb: 0, trebleDb: -3 },
];

export function clampDb(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(-EQ_LIMIT_DB, Math.min(EQ_LIMIT_DB, Math.round(n)));
}

/** Anything read from storage is untrusted: bands clamp to the limit, switches must be real booleans. */
export function normalizeEq(raw: unknown): EqSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...FLAT_EQ };
  const r = raw as Record<string, unknown>;
  return { bassDb: clampDb(r.bassDb), midDb: clampDb(r.midDb), trebleDb: clampDb(r.trebleDb), evenVolume: r.evenVolume === true, mono: r.mono === true };
}

/** The preset these bands match exactly, or null when they have been moved by hand. */
export function presetFor(settings: EqBands): EqPresetId | null {
  return EQ_PRESETS.find((p) => p.bassDb === settings.bassDb && p.midDb === settings.midDb && p.trebleDb === settings.trebleDb)?.id ?? null;
}

export function applyPreset(settings: EqSettings, id: EqPresetId): EqSettings {
  const preset = EQ_PRESETS.find((p) => p.id === id);
  return preset ? { ...settings, bassDb: preset.bassDb, midDb: preset.midDb, trebleDb: preset.trebleDb } : settings;
}

/** The next preset in the list, wrapping; hand-tuned bands start the cycle from the top. */
export function nextPreset(settings: EqBands): EqPresetId {
  const current = presetFor(settings);
  const index = current ? EQ_PRESETS.findIndex((p) => p.id === current) : -1;
  return EQ_PRESETS[(index + 1) % EQ_PRESETS.length]!.id;
}

export const isFlatEq = (s: EqSettings): boolean => s.bassDb === 0 && s.midDb === 0 && s.trebleDb === 0 && !s.evenVolume && !s.mono;

/* --- device store (survivor616.music.eq.v1) --- */

const KEY = 'survivor616.music.eq.v1';
const listeners = new Set<() => void>();
let cached: EqSettings | null = null;

export function readEq(): EqSettings {
  if (cached) return cached;
  let parsed: unknown = null;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  cached = normalizeEq(parsed);
  return cached;
}

export function writeEq(next: EqSettings): void {
  cached = normalizeEq(next);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // Without storage the settings still hold for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useEq(): EqSettings {
  return useSyncExternalStore(subscribe, readEq, () => FLAT_EQ);
}
