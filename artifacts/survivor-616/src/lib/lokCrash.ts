import { createCrashReporter, formatReport } from '../../../../lib/lok-universe/src/crash';
import { CURRENT_VERSION } from '@/game/data/changelog';
import { lokClientConfig } from '@/lib/lokClient';

/**
 * LOK crash reports for 616 Survivor (shared SDK module `crash.ts`, see
 * Lok-EcoSystsem/docs/LOK_CRASH_REPORTS.md). The latest crash is always kept on
 * this device so the crash screen can show a code and a copy button; it is sent
 * to the shared project only when that migration exists, the browser has not
 * asked not to be tracked, and the player has not turned reporting off.
 */
const OFF_KEY = 'survivor616.crash-reports-off.v1';

let currentScreen = '';
/** Called by App whenever the screen changes, so a report says where it happened. */
export function setCrashScreen(name: string): void {
  currentScreen = name;
}

export function crashReportsEnabled(): boolean {
  try {
    return window.localStorage.getItem(OFF_KEY) !== '1';
  } catch {
    return true;
  }
}

export function setCrashReportsEnabled(on: boolean): void {
  try {
    if (on) window.localStorage.removeItem(OFF_KEY);
    else window.localStorage.setItem(OFF_KEY, '1');
  } catch {
    // Private mode: the choice just will not persist.
  }
}

export const lokCrash = createCrashReporter({
  appKey: 'survivor616',
  appVersion: CURRENT_VERSION,
  supabaseUrl: lokClientConfig?.url,
  publishableKey: lokClientConfig?.anonKey,
  getScreen: () => currentScreen,
  enabled: crashReportsEnabled,
});

export { formatReport };
