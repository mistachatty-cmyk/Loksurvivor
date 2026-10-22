/** Jukebox preferences shared by the Jukebox Room and Settings. Device-local; storage may be blocked, so nothing throws. */
const MIX_KEY = 'survivor616.jukebox.theater-mix.v1';
/** Set by the Jukebox Room so Settings opens straight on the jukebox section. */
export const SETTINGS_FOCUS_KEY = 'survivor616.settings-focus';

export function readTheaterMix(): boolean {
  try {
    return window.localStorage.getItem(MIX_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeTheaterMix(on: boolean): void {
  try {
    window.localStorage.setItem(MIX_KEY, on ? '1' : '0');
  } catch {
    /* the choice just will not persist */
  }
}

/** Music-reactive background: how strongly the Jukebox Room and the arrival backdrop move with the music. */
export type ReactiveBgLevel = 'off' | 'soft' | 'full';
export const REACTIVE_BG_LEVELS: readonly ReactiveBgLevel[] = ['off', 'soft', 'full'];
const BG_KEY = 'survivor616.jukebox.reactive-bg.v1';

export function readReactiveBg(): ReactiveBgLevel {
  try {
    const v = window.localStorage.getItem(BG_KEY);
    return v === 'off' || v === 'soft' || v === 'full' ? v : 'soft';
  } catch {
    return 'soft';
  }
}

export function writeReactiveBg(level: ReactiveBgLevel): void {
  try {
    window.localStorage.setItem(BG_KEY, level);
  } catch {
    /* the choice just will not persist */
  }
}

/** Multiplier applied to the background's reaction. */
export function reactiveBgGain(level: ReactiveBgLevel): number {
  return level === 'full' ? 1 : level === 'soft' ? 0.5 : 0;
}

/** Shuffle ("random") as a standing preference; the player still toggles it per session. */
const SHUFFLE_KEY = 'survivor616.jukebox.shuffle.v1';

export function readShuffle(): boolean {
  try {
    return window.localStorage.getItem(SHUFFLE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeShuffle(on: boolean): void {
  try {
    window.localStorage.setItem(SHUFFLE_KEY, on ? '1' : '0');
  } catch {
    /* the choice just will not persist */
  }
}
