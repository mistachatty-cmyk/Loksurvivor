/**
 * Flag for the floating-CD shelf on the "Outside the hideout" arrival
 * screen. It is a device-local presentation preference (like the music
 * autostart flag), not progression, so it lives in localStorage rather than in
 * `MetaState`. On by default; Settings can turn it off (stored as '0').
 *
 * `?arrivalDiscs` in the URL forces it on for one visit, for screenshots.
 */
const KEY = 'survivor616.arrival-discs.v1';

/** The saved setting only, ignoring the URL flag (what the Settings toggle shows). */
export function readArrivalDiscsSetting(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeArrivalDiscsSetting(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, '0');
  } catch {
    // Private mode or a full quota: the toggle simply will not persist.
  }
}

/** Whether the arrival screen should show the disc shelf right now. */
export function readArrivalDiscsEnabled(): boolean {
  if (typeof window === 'undefined') return false; // no screen to show it on
  try {
    if (new URLSearchParams(window.location.search).has('arrivalDiscs')) return true;
  } catch {
    // Fall through to the saved setting.
  }
  return readArrivalDiscsSetting();
}
