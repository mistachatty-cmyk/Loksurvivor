/**
 * Opt-in flag for the floating-CD shelf on the "Outside the hideout" arrival
 * screen. It is a device-local presentation preference (like the music
 * autostart flag), not progression, so it lives in localStorage rather than in
 * `MetaState`. Off by default: the original arrival scene is the default.
 *
 * `?arrivalDiscs` in the URL turns it on for one visit, for screenshots.
 */
const KEY = 'survivor616.arrival-discs.v1';

/** The saved setting only, ignoring the URL flag (what the Settings toggle shows). */
export function readArrivalDiscsSetting(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function writeArrivalDiscsSetting(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.setItem(KEY, '1');
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private mode or a full quota: the toggle simply will not persist.
  }
}

/** Whether the arrival screen should show the disc shelf right now. */
export function readArrivalDiscsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).has('arrivalDiscs')) return true;
  } catch {
    // Fall through to the saved setting.
  }
  return readArrivalDiscsSetting();
}
