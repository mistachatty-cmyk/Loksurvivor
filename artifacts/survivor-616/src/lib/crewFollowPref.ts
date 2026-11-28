/**
 * Crew Link, player side: the "Follow the host" switch (default on, per device) and the one-shot flag that
 * tells Lok Party's lobby to open a room as soon as the crew host picked it in the Games tab.
 */

const FOLLOW_KEY = 'survivor616.crewFollow.v1';
const LAUNCH_KEY = 'survivor616.crewLaunch.v1';
export const CREW_FOLLOW_EVENT = 'lok:crew-follow';

export function getFollow(): boolean {
  try { return window.localStorage.getItem(FOLLOW_KEY) !== 'off'; } catch { return true; }
}

export function setFollow(on: boolean): void {
  try { window.localStorage.setItem(FOLLOW_KEY, on ? 'on' : 'off'); } catch { /* the choice just will not stick */ }
  window.dispatchEvent(new Event(CREW_FOLLOW_EVENT));
}

/** The host tapped an online mode in the Games tab: the lobby should open a room and invite the crew. */
export function markCrewLaunch(rowId: string): void {
  try { window.sessionStorage.setItem(LAUNCH_KEY, rowId); } catch { /* the host can still invite by hand */ }
}

/** Reads and clears the flag so a refresh never opens a second room. */
export function takeCrewLaunch(): string | null {
  try {
    const v = window.sessionStorage.getItem(LAUNCH_KEY);
    window.sessionStorage.removeItem(LAUNCH_KEY);
    return v;
  } catch { return null; }
}

/** Reads the flag without clearing it (safe to call twice in a render). */
export function peekCrewLaunch(): boolean {
  try { return window.sessionStorage.getItem(LAUNCH_KEY) !== null; } catch { return false; }
}
