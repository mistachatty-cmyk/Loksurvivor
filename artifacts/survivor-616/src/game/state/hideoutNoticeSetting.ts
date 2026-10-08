/**
 * Device-local choice of how long the hideout's corner notes stay on screen
 * before fading. Stored in seconds; the default matches the original 6.5s.
 */
export const HIDEOUT_NOTICE_SECONDS = [6, 12, 20, 30] as const;
export type HideoutNoticeSeconds = (typeof HIDEOUT_NOTICE_SECONDS)[number];

const KEY = 'survivor616.hideoutNoticeSeconds';
const DEFAULT_MS = 6500;

export function getHideoutNoticeSeconds(): HideoutNoticeSeconds {
  try {
    const stored = Number(window.localStorage.getItem(KEY));
    const match = HIDEOUT_NOTICE_SECONDS.find((s) => s === stored);
    if (match) return match;
  } catch {
    // Storage unavailable -- fall through to the default.
  }
  return HIDEOUT_NOTICE_SECONDS[0];
}

export function setHideoutNoticeSeconds(seconds: HideoutNoticeSeconds): void {
  try {
    window.localStorage.setItem(KEY, String(seconds));
  } catch {
    // Storage unavailable -- the choice lasts until reload.
  }
}

/** Milliseconds a note stays up. Unset keeps the original 6.5s. */
export function hideoutNoticeMs(): number {
  try {
    if (window.localStorage.getItem(KEY) === null) return DEFAULT_MS;
  } catch {
    return DEFAULT_MS;
  }
  return getHideoutNoticeSeconds() * 1000;
}
