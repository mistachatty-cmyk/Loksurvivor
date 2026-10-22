/**
 * Keeps the floating discs from taking a phone down. Safari kills a page that
 * runs out of memory, and a killed page cannot report anything, so this leaves
 * a marker while discs are on screen and checks it on the next load:
 *   - marker still there once  -> the last visit ended badly: use lite mode.
 *   - marker there twice in a row -> turn the discs off for this device.
 * The marker is cleared whenever the page is hidden or closed normally, and
 * the strike count resets after the discs stay up for a minute.
 * Phones and tablets (coarse pointer) always start in lite mode.
 */
const LIVE_KEY = 'survivor616.discs-live.v1';
const STRIKES_KEY = 'survivor616.discs-strikes.v1';
const STABLE_MS = 60_000;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the guard simply does nothing.
  }
}

export interface DiscSafety {
  /** Use the light carousel. */
  lite: boolean;
  /** Two bad visits in a row: do not show discs at all. */
  off: boolean;
}

let armed: DiscSafety | null = null;

/** Call before the first disc renders. Judges the LAST visit once per page load, then reuses the answer. */
export function armDiscGuard(): DiscSafety {
  if (typeof window === 'undefined') return { lite: true, off: false };
  if (armed) return armed;
  const wasLive = read(LIVE_KEY) !== null;
  const strikes = Number(read(STRIKES_KEY) ?? '0') + (wasLive ? 1 : 0);
  write(STRIKES_KEY, strikes > 0 ? String(strikes) : null);
  write(LIVE_KEY, String(Date.now()));
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  armed = { lite: coarse || strikes > 0, off: strikes >= 2 };
  return armed;
}

/** The player turned the discs back on in Settings: forget past bad visits (takes effect on reload). */
export function resetDiscGuard(): void {
  write(STRIKES_KEY, null);
  write(LIVE_KEY, null);
}

/** Clears the marker on a normal exit and resets the strikes after a stable minute. Returns a cleanup. */
export function watchDiscGuard(): () => void {
  if (typeof window === 'undefined') return () => {};
  write(LIVE_KEY, String(Date.now()));
  const clear = () => write(LIVE_KEY, null);
  const rearm = () => {
    if (!document.hidden) write(LIVE_KEY, String(Date.now()));
  };
  const onVisibility = () => (document.hidden ? clear() : rearm());
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', clear);
  const stable = window.setTimeout(() => write(STRIKES_KEY, null), STABLE_MS);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', clear);
    window.clearTimeout(stable);
    clear();
  };
}
