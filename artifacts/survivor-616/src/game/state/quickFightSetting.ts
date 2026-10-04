/**
 * Device-local switch for the quick fight (the arena-engine version of the
 * scraps you run into while travelling). Off by default so the classic
 * encounter popup stays the standard until the new one has been played.
 */
const KEY = 'survivor616.quickfight';

export function getQuickFightEnabled(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setQuickFightEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(KEY, enabled ? 'on' : 'off');
  } catch {
    // Storage unavailable -- the choice lasts until reload.
  }
}
