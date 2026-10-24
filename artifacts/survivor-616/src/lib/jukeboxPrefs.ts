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

/**
 * Stacked shelves: one row of discs per album or playlist, swiped up and down. Off puts every disc
 * back on a single row. On by default.
 */
const SHELVES_KEY = 'survivor616.jukebox.shelves.v1';

export function readShelves(): boolean {
  try {
    return window.localStorage.getItem(SHELVES_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeShelves(on: boolean): void {
  try {
    window.localStorage.setItem(SHELVES_KEY, on ? '1' : '0');
  } catch {
    /* the choice just will not persist */
  }
}

/** Hands-on disc gestures: spin a disc, and pull the song out to a full screen. On by default. */
const GESTURES_KEY = 'survivor616.jukebox.disc-gestures.v1';

export function readDiscGestures(): boolean {
  try {
    return window.localStorage.getItem(GESTURES_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeDiscGestures(on: boolean): void {
  try {
    window.localStorage.setItem(GESTURES_KEY, on ? '1' : '0');
  } catch {
    /* the choice just will not persist */
  }
}

/** The shelf the player last looked at, so the room reopens where they left it. */
const LAST_SHELF_KEY = 'survivor616.jukebox.last-shelf.v1';

export function readLastShelf(): string | null {
  try {
    return window.localStorage.getItem(LAST_SHELF_KEY);
  } catch {
    return null;
  }
}

export function writeLastShelf(id: string): void {
  try {
    window.localStorage.setItem(LAST_SHELF_KEY, id);
  } catch {
    /* the choice just will not persist */
  }
}
