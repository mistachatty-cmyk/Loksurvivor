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
