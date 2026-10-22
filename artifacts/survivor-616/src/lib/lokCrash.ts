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

/**
 * A page the browser kills (Safari "A problem repeatedly occurred") can never run
 * code, so it cannot report itself. Instead a marker is left while the game is on
 * screen and cleared whenever the page is hidden or closed normally. If the marker
 * is still there on the next load, the last visit ended badly: record it, then the
 * app shows a small "send a report" prompt.
 */
const ALIVE_KEY = 'survivor616.alive.v1';
let recovered: ReturnType<typeof lokCrash.last> = null;

export function startCrashWatch(): void {
  try {
    const raw = window.localStorage.getItem(ALIVE_KEY);
    if (raw && document.visibilityState === 'visible') {
      const prev = JSON.parse(raw) as { screen?: string; v?: string };
      recovered = lokCrash.capture(
        new Error(`Page closed unexpectedly on ${prev.screen || 'unknown screen'} (v${prev.v ?? '?'})`),
        'error',
      );
    }
    const mark = () => {
      try {
        window.localStorage.setItem(ALIVE_KEY, JSON.stringify({ screen: currentScreen, v: CURRENT_VERSION }));
      } catch {
        /* storage blocked */
      }
    };
    const clear = () => {
      try {
        window.localStorage.removeItem(ALIVE_KEY);
      } catch {
        /* storage blocked */
      }
    };
    mark();
    window.setInterval(() => !document.hidden && mark(), 5000);
    document.addEventListener('visibilitychange', () => (document.hidden ? clear() : mark()));
    window.addEventListener('pagehide', clear);
  } catch {
    /* watching must never break the game */
  }
}

/** The report for an unexpected close on the previous visit, if there was one (shown once). */
export function takeRecoveredCrash() {
  const r = recovered;
  recovered = null;
  return r;
}
