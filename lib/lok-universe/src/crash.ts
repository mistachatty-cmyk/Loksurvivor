// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Crash reports: a small, privacy-first way for any LOK app to learn that a
 * screen crashed and why, without tracking anyone.
 *
 * What is sent (and only this): the app key and version, what kind of failure
 * it was, the screen name, a short fingerprint, the error message and a
 * trimmed stack with URLs, emails and long tokens removed, and a coarse
 * browser/OS family. No account id, no device id, no cookies, no page content.
 * Nothing is sent from browsers that send Global Privacy Control or Do Not
 * Track, nor when the app says `enabled()` is false. Each browser session
 * sends at most `maxPerSession` reports and never the same fingerprint twice.
 *
 * Whether or not it is sent, the latest report is kept on the device so the
 * crash screen can show a short code and offer "Copy report" to the person.
 *
 * Server contract (migration text in docs/LOK_CRASH_REPORTS.md of the
 * Lok-EcoSystsem repo): `lok_crash_report_add(p_app_key, p_app_version,
 * p_kind, p_screen, p_fingerprint, p_message, p_stack, p_env)`.
 *
 * Framework-free and dependency-free. Browser only; the pure helpers
 * (`sanitizeText`, `trimStack`, `fingerprintOf`, `browserFamily`,
 * `formatReport`) also run under plain node for tests.
 */

export type CrashKind = "render" | "error" | "promise" | "chunk";

export interface CrashReport {
  appKey: string;
  appVersion: string;
  kind: CrashKind;
  screen: string;
  fingerprint: string;
  message: string;
  stack: string;
  env: string;
  at: string;
}

export interface CrashReporterOptions {
  appKey: string;
  appVersion: string;
  supabaseUrl?: string;
  publishableKey?: string;
  /** The screen the person is on, e.g. "hub". Optional. */
  getScreen?: () => string;
  /** Extra gate: return false to keep reports on the device only. */
  enabled?: () => boolean;
  /** Default 3. */
  maxPerSession?: number;
}

export interface CrashReporter {
  /** Record a failure. Returns the report (always kept locally; sent only when allowed). */
  capture(error: unknown, kind?: CrashKind): CrashReport;
  /** Listen for window errors and unhandled promise rejections. Returns an uninstall function. */
  install(): () => void;
  /** The most recent report kept on this device, if any. */
  last(): CrashReport | null;
  /**
   * The person chose to send this report (a "Send to LOK" button). That is explicit consent, so it
   * works even when automatic sending is off, blocked by Do Not Track, or over the session limit.
   * Resolves "sent", "failed" (network or server refused) or "unavailable" (no server configured).
   * Defaults to the latest report kept on the device.
   */
  submit(report?: CrashReport | null): Promise<"sent" | "failed" | "unavailable">;
}

export const CRASH_STORAGE_KEY = "lok.crash.last.v1";
const MAX_MESSAGE = 300;
const MAX_STACK_LINES = 8;
const MAX_STACK = 1500;

/** Strip what must never leave the device: URLs, emails, long opaque tokens. */
export function sanitizeText(text: string, max = MAX_MESSAGE): string {
  return String(text ?? "")
    .replace(/https?:\/\/[^\s)'"]+/gi, (url) => {
      const file = url.split(/[?#]/)[0]!.split("/").pop() ?? "";
      return file ? `<url>/${file}` : "<url>";
    })
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "<token>")
    .slice(0, max);
}

/** Keep the first few stack lines, with file paths reduced to a file name. */
export function trimStack(stack: string | undefined): string {
  if (!stack) return "";
  const lines = stack.split("\n").slice(0, MAX_STACK_LINES).map((line) => sanitizeText(line, 200));
  return lines.join("\n").slice(0, MAX_STACK);
}

/** A short, stable id for "the same crash" (32-bit FNV-1a, hex). Not a secret. */
export function fingerprintOf(kind: string, message: string, stack: string): string {
  const firstFrame = stack.split("\n").find((l) => /\bat\b|@/.test(l)) ?? "";
  const text = `${kind}|${message.replace(/\d+/g, "#")}|${firstFrame.replace(/:\d+:\d+/g, "").replace(/-[A-Za-z0-9_]{6,}\./g, ".")}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Coarse "Safari 17 / iOS" style label. Never the full user-agent string. */
export function browserFamily(ua: string): string {
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other";
  const m =
    /(Edg|EdgA|EdgiOS)\/(\d+)/.exec(ua) ? ["Edge", /(Edg|EdgA|EdgiOS)\/(\d+)/.exec(ua)![2]] :
    /(CriOS|Chrome)\/(\d+)/.exec(ua) ? ["Chrome", /(CriOS|Chrome)\/(\d+)/.exec(ua)![2]] :
    /(FxiOS|Firefox)\/(\d+)/.exec(ua) ? ["Firefox", /(FxiOS|Firefox)\/(\d+)/.exec(ua)![2]] :
    /Version\/(\d+).*Safari/.exec(ua) ? ["Safari", /Version\/(\d+).*Safari/.exec(ua)![1]] :
    ["Browser", ""];
  return `${m[0]}${m[1] ? " " + m[1] : ""} / ${os}`;
}

/** The text a person can copy and send. */
export function formatReport(r: CrashReport): string {
  return [
    `LOK crash report ${r.fingerprint}`,
    `${r.appKey} ${r.appVersion} | ${r.kind} | screen: ${r.screen || "?"}`,
    `${r.env} | ${r.at}`,
    r.message,
    r.stack,
  ].filter(Boolean).join("\n");
}

function sendingAllowed(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const dnt = nav.doNotTrack ?? (window as Window & { doNotTrack?: string }).doNotTrack ?? nav.msDoNotTrack;
  return nav.globalPrivacyControl !== true && dnt !== "1" && dnt !== "yes";
}

function toParts(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack ?? "" };
  if (typeof error === "string") return { message: error, stack: "" };
  try {
    return { message: JSON.stringify(error) ?? String(error), stack: "" };
  } catch {
    return { message: String(error), stack: "" };
  }
}

export function createCrashReporter(options: CrashReporterOptions): CrashReporter {
  const maxPerSession = options.maxPerSession ?? 3;
  const sentFingerprints = new Set<string>();
  let sentCount = 0;

  const store = (report: CrashReport) => {
    try {
      window.localStorage.setItem(CRASH_STORAGE_KEY, JSON.stringify(report));
    } catch {
      /* storage blocked: the code is still shown on screen */
    }
  };

  const post = (report: CrashReport): Promise<Response> =>
    fetch(`${options.supabaseUrl}/rest/v1/rpc/lok_crash_report_add`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: options.publishableKey as string, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_app_key: report.appKey,
        p_app_version: report.appVersion,
        p_kind: report.kind,
        p_screen: report.screen,
        p_fingerprint: report.fingerprint,
        p_message: report.message,
        p_stack: report.stack,
        p_env: report.env,
      }),
    });

  const send = (report: CrashReport) => {
    if (!options.supabaseUrl || !options.publishableKey) return;
    if (options.enabled && !options.enabled()) return;
    if (!sendingAllowed()) return;
    if (sentCount >= maxPerSession || sentFingerprints.has(report.fingerprint)) return;
    sentFingerprints.add(report.fingerprint);
    sentCount += 1;
    try {
      void post(report).catch(() => undefined);
    } catch {
      /* reporting must never throw */
    }
  };

  const readLast = (): CrashReport | null => {
    try {
      const raw = window.localStorage.getItem(CRASH_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CrashReport) : null;
    } catch {
      return null;
    }
  };

  const capture = (error: unknown, kind: CrashKind = "error"): CrashReport => {
    const parts = toParts(error);
    const message = sanitizeText(parts.message);
    const stack = trimStack(parts.stack);
    const isChunk = /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(parts.message);
    const finalKind: CrashKind = isChunk ? "chunk" : kind;
    let screen = "";
    try {
      screen = sanitizeText(options.getScreen?.() ?? "", 40);
    } catch {
      /* ignore */
    }
    const report: CrashReport = {
      appKey: options.appKey,
      appVersion: options.appVersion,
      kind: finalKind,
      screen,
      fingerprint: fingerprintOf(finalKind, message, stack),
      message,
      stack,
      env: typeof navigator === "undefined" ? "unknown" : browserFamily(navigator.userAgent),
      at: new Date().toISOString(),
    };
    store(report);
    send(report);
    return report;
  };

  return {
    capture,
    last: readLast,
    async submit(report) {
      const target = report ?? readLast();
      if (!target || !options.supabaseUrl || !options.publishableKey) return "unavailable";
      try {
        const response = await post(target);
        return response.ok ? "sent" : "failed";
      } catch {
        return "failed";
      }
    },
    install() {
      if (typeof window === "undefined") return () => {};
      const onError = (event: ErrorEvent) => {
        // Cross-origin scripts report no detail; there is nothing useful to keep.
        if (!event.error && !event.message) return;
        capture(event.error ?? event.message, "error");
      };
      const onRejection = (event: PromiseRejectionEvent) => capture(event.reason, "promise");
      window.addEventListener("error", onError);
      window.addEventListener("unhandledrejection", onRejection);
      return () => {
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onRejection);
      };
    },
  };
}
