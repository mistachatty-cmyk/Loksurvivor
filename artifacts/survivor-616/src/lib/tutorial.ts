/** Whether the player has already been through the first-match tutorial. Device-local. */
const KEY = 'survivor616.tutorial.v1';

export function readTutorialDone(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function writeTutorialDone(): void {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    /* the tutorial may be offered again, which is harmless */
  }
}
