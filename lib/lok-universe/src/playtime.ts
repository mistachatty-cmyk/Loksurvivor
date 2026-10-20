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
  /**
   * Count signed-out play that has NOT agreed to optional storage, in a separate cookieless
   * "guest" tally (`gsix_playtime_add_guest`): only the app name and the seconds are sent, no
   * identifier, nothing stored on the device. Skipped for browsers sending Global Privacy
   * Control or Do Not Track. Default false. Disclose it in your privacy policy if you turn it on.
   */
  countGuests?: boolean;
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

/** Browsers can ask not to be tracked (Global Privacy Control, Do Not Track): honour it. */
function guestCountingAllowed(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const dnt = nav.doNotTrack ?? (window as Window & { doNotTrack?: string }).doNotTrack ?? nav.msDoNotTrack;
  return nav.globalPrivacyControl !== true && dnt !== "1" && dnt !== "yes";
}

/** Guest reports are capped server-side at this many seconds per call. */
const GUEST_REPORT_SECONDS = 30;

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

  type Mode = "account" | "anon" | "guest" | null;
  const currentMode = (): Mode => {
    if (token !== null) return "account";
    if (options.allowAnonymous?.()) return "anon";
    return options.countGuests && guestCountingAllowed() ? "guest" : null;
  };

  const send = async (seconds: number, mode: Mode): Promise<boolean> => {
    if (!mode) return true; // nothing to send; drop it
    const headers: Record<string, string> = { apikey: options.publishableKey, "Content-Type": "application/json" };
    let fn = "gsix_playtime_add";
    let body: Record<string, unknown>;
    if (mode === "guest") {
      fn = "gsix_playtime_add_guest";
      body = { p_app_key: options.appKey, p_seconds: seconds };
    } else {
      if (mode === "account" && token) headers.Authorization = `Bearer ${token}`;
      body = { p_app_key: options.appKey, p_seconds: seconds, p_client: mode === "account" ? null : anonymousId() };
    }
    try {
      const response = await fetch(`${options.supabaseUrl}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers,
        keepalive: true,
        body: JSON.stringify(body),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const flush = async () => {
    const mode = currentMode();
    const whole = Math.min(Math.floor(carry), mode === "guest" ? GUEST_REPORT_SECONDS : MAX_REPORT_SECONDS);
    if (whole < 1 || sending) return;
    carry -= whole;
    sending = true;
    const ok = await send(whole, mode);
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
