// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Playtime: report how long a person actually plays, to the GSix account.
 *
 * Contract (server side lives in the GSix hub repo,
 * supabase/migrations/20261018000000_gsix_playtime.sql): `gsix_playtime_add(
 * p_app_key, p_seconds, p_client )`. A client only says "I was active for N
 * seconds"; the server believes no more seconds than have really elapsed since
 * that same person last reported, so counting twice (hub frame + game) or in a
 * loop cannot inflate it. This is a cosmetic statistic: never pay or rank from it.
 *
 * Framework-free and dependency-free, like the rest of the SDK. Browser only.
 *
 *   const tracker = startPlaytimeTracker({
 *     appKey: "survivor616",                      // lok_apps.app_key / apps.ts key
 *     supabaseUrl, publishableKey,
 *     getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
 *   });
 *   // later: tracker.stop()
 *
 * When the game is shown inside the GSix hub's frame, the hub counts that time
 * and this tracker stays idle (`skipWhenFramed`, on by default), so the same
 * minute is never counted twice.
 */

export interface PlaytimeTrackerOptions {
  /** The app's key, e.g. `survivor616`. Unknown keys are ignored by the server. */
  appKey: string;
  supabaseUrl: string;
  publishableKey: string;
  /** The signed-in account's access token, or null when signed out. */
  getAccessToken: () => string | null | Promise<string | null>;
  /**
   * Extra gate: return false while the player is not really playing (paused,
   * on a menu you consider idle...). Default: the tab is visible and focused.
   */
  isActive?: () => boolean;
  /** Skip counting when this page is inside another page's frame (the hub counts it). Default true. */
  skipWhenFramed?: boolean;
  /**
   * Count signed-out play under a random per-browser id? Only return true after
   * the person has agreed to optional storage. Default: signed-out play is not counted.
   */
  allowAnonymous?: () => boolean;
  /** Seconds between reports. Default 30; the server accepts at most 90 per report. */
  flushEverySeconds?: number;
}

export interface PlaytimeTracker {
  /** Send what is pending now. */
  flush(): Promise<void>;
  /** Stop counting and send what is pending. */
  stop(): void;
}

const CLIENT_ID_KEY = "gsix.play.client.v1";
const MAX_REPORT_SECONDS = 60;
const MAX_STEP_SECONDS = 2;
const RESTORE_CAP_SECONDS = 600;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Not security-sensitive: it only separates anonymous browsers from one another.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function anonymousId(): string | null {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function isFramed(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true; // a cross-origin parent throws: we are framed
  }
}

export function startPlaytimeTracker(options: PlaytimeTrackerOptions): PlaytimeTracker {
  const idle: PlaytimeTracker = { flush: async () => {}, stop: () => {} };
  if (typeof window === "undefined" || typeof document === "undefined") return idle;
  if ((options.skipWhenFramed ?? true) && isFramed()) return idle;

  const flushEvery = Math.max(10, options.flushEverySeconds ?? 30) * 1000;
  let carry = 0; // fractional active seconds not yet reported
  let last: number | null = null;
  let token: string | null = null;
  let sending = false;
  let stopped = false;

  const refreshToken = async () => {
    try {
      token = (await options.getAccessToken()) ?? null;
    } catch {
      token = null;
    }
  };
  void refreshToken();

  const active = () => {
    if (document.visibilityState !== "visible" || !document.hasFocus()) return false;
    return options.isActive ? options.isActive() : true;
  };

  const tick = window.setInterval(() => {
    const now = Date.now();
    if (active()) {
      if (last !== null) carry += Math.min(Math.max(0, (now - last) / 1000), MAX_STEP_SECONDS);
      last = now;
    } else {
      last = null; // a pause must not leak into the next interval
    }
  }, 1000);

  const send = async (seconds: number): Promise<boolean> => {
    const signedIn = token !== null;
    if (!signedIn && !options.allowAnonymous?.()) return true; // nothing to send; drop it
    const headers: Record<string, string> = { apikey: options.publishableKey, "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const response = await fetch(`${options.supabaseUrl}/rest/v1/rpc/gsix_playtime_add`, {
        method: "POST",
        headers,
        keepalive: true,
        body: JSON.stringify({ p_app_key: options.appKey, p_seconds: seconds, p_client: signedIn ? null : anonymousId() }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const flush = async () => {
    const whole = Math.min(Math.floor(carry), MAX_REPORT_SECONDS);
    if (whole < 1 || sending) return;
    carry -= whole;
    sending = true;
    const ok = await send(whole);
    sending = false;
    if (!ok) carry = Math.min(RESTORE_CAP_SECONDS, carry + whole);
  };

  const every = window.setInterval(() => {
    void refreshToken().then(flush);
  }, flushEvery);
  const onHide = () => {
    if (document.visibilityState === "hidden") void flush();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);

  return {
    flush,
    stop() {
      if (stopped) return;
      stopped = true;
      window.clearInterval(tick);
      window.clearInterval(every);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void flush();
    },
  };
}
