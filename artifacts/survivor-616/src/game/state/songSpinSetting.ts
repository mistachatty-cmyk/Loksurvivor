/**
 * Device-local settings for LokPets spinning when a song starts in the hideout.
 * - `cadence`: every song, or every other song.
 * - `length`: a short burst, or the whole song.
 * - `byBond`: when on, closer pets join in more often (see `songSpinChance`).
 */
import type { BondRankId } from '@/game/engine/petGrowth';

export type SongSpinCadence = 'every' | 'other';
export type SongSpinLength = 'burst' | 'song';

export interface SongSpinSettings {
  enabled: boolean;
  cadence: SongSpinCadence;
  length: SongSpinLength;
  byBond: boolean;
  /** Quick taps build up speed that slides the pet along, then slows. */
  momentum: boolean;
}

export const DEFAULT_SONG_SPIN: SongSpinSettings = { enabled: true, cadence: 'every', length: 'burst', byBond: true, momentum: true };

const KEY = 'survivor616.songSpin.v1';

export function getSongSpinSettings(): SongSpinSettings {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<SongSpinSettings> | null;
    if (raw && typeof raw === 'object') {
      return {
        enabled: raw.enabled !== false,
        cadence: raw.cadence === 'other' ? 'other' : 'every',
        length: raw.length === 'song' ? 'song' : 'burst',
        byBond: raw.byBond !== false,
        momentum: raw.momentum !== false,
      };
    }
  } catch {
    // Storage unavailable or corrupt -- use the defaults.
  }
  return DEFAULT_SONG_SPIN;
}

export function setSongSpinSettings(next: SongSpinSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The choice lasts until reload.
  }
}

/** Chance a pet joins in on a song, by how close you are. Everyone joins when bond-based is off. */
export function songSpinChance(bondRank: BondRankId, byBond: boolean): number {
  if (!byBond) return 1;
  switch (bondRank) {
    case 'stranger': return 0.2;
    case 'familiar': return 0.5;
    case 'friend': return 0.8;
    default: return 1;
  }
}

/** Does this song (1-based count since the hideout opened) trigger spinning? */
export function songSpinsOn(songNumber: number, cadence: SongSpinCadence): boolean {
  return cadence === 'every' || songNumber % 2 === 1;
}

export const SONG_SPIN_BURST_MS = 4500;
