/**
 * The storage contract supabase-js expects for `auth.storage`.
 *
 * Declared here rather than imported. supabase-js does not re-export
 * `SupportedStorage`, and reaching into `@supabase/auth-js` for it drags a
 * second package into every consumer's resolution just for a type — which is
 * exactly what broke the first Vercel build. The shape is small and stable,
 * and `storage` is structurally typed, so a local declaration satisfies it
 * while keeping this package dependency-free like @lok/skins.
 */
export interface SupportedStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
  /**
   * Signals that values come from an untrusted medium such as request cookies,
   * so supabase-js verifies the JWT instead of trusting the stored session.
   */
  isServer?: boolean;
}

/**
 * Cross-domain session adapter for GSix Hub.
 *
 * Replaces Supabase's default localStorage store with a cookie scoped to the
 * parent domain, so one sign-in reaches the hub on the apex and every app
 * subdomain below it (survivor.gsix.online, book.gsix.online, ...).
 *
 * localStorage is per-origin, which is why the default cannot do this. A cookie
 * on `.gsix.online` is sent to the apex and all subdomains.
 *
 *   const supabase = createClient(url, key, {
 *     auth: { storage: new LokSessionAdapter() }
 *   });
 *
 * Note on HttpOnly: cookies written from `document.cookie` can never be
 * HttpOnly — the browser forbids it. That is inherent to supabase-js running in
 * the browser, which needs to read the session back out. Use
 * LokServerSessionAdapter in route handlers and middleware where the cookie is
 * set from a real Set-Cookie header and HttpOnly does apply.
 */

/**
 * Parent domain the session cookie is scoped to on production.
 */
export const LOK_COOKIE_DOMAIN = ".gsix.online";

const COOKIE_PATH = "/";
const COOKIE_MAX_AGE = 604800; // 7 days

/**
 * Local development runs on localhost, where a `Domain=.gsix.online` attribute
 * makes the browser silently reject the cookie, and `Secure` does the same over
 * plain http.
 */
function isLocalhost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

function isGsixDomain(hostname: string): boolean {
  return hostname === "gsix.online" || hostname.endsWith(".gsix.online");
}

export interface LokSessionOptions {
  /** Override the parent domain. Defaults to `.gsix.online`. */
  domain?: string;
}

export class LokSessionAdapter implements SupportedStorage {
  private readonly domain: string;

  constructor(options: LokSessionOptions = {}) {
    this.domain = options.domain ?? LOK_COOKIE_DOMAIN;
  }

  async getItem(key: string): Promise<string | null> {
    if (typeof document === "undefined") return null;

    // 1. Try reading from cookie first
    const prefix = `${encodeURIComponent(key)}=`;
    for (const cookie of document.cookie.split(";")) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith(prefix)) {
        return decodeURIComponent(trimmed.slice(prefix.length));
      }
    }

    // On production the shared cookie is the source of truth. Falling back to
    // per-origin localStorage here could resurrect a session after another
    // GSix app signed out and removed the shared cookie.
    if (isGsixDomain(window.location.hostname)) return null;

    // Local development and preview hosts may use localStorage as a fallback.
    try {
      if (typeof window !== "undefined" && !isGsixDomain(window.location.hostname) && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Ignore storage restrictions
    }

    return null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof document !== "undefined") {
      document.cookie = this.serialize(key, value, COOKIE_MAX_AGE);
      if (isGsixDomain(window.location.hostname)) {
        if (await this.getItem(key) !== value) {
          throw new Error("The shared GSix session cookie could not be saved.");
        }
        return;
      }
    }
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore
    }
  }

  async removeItem(key: string): Promise<void> {
    if (typeof document !== "undefined") {
      document.cookie = this.serialize(key, "", 0);
    }
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
  }

  private serialize(key: string, value: string, maxAge: number): string {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const isGsix = isGsixDomain(hostname);
    const local = isLocalhost(hostname);
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

    const parts = [
      `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      `Path=${COOKIE_PATH}`,
      `Max-Age=${maxAge}`,
      "SameSite=Lax",
    ];

    // Only specify the parent domain if we are actually on gsix.online.
    // Specifying Domain=.gsix.online on any other domain (e.g. preview, run.app)
    // causes the browser to reject the cookie outright.
    if (isGsix) {
      parts.push(`Domain=${this.domain}`);
    }
    if (isHttps && !local) {
      parts.push("Secure");
    }
    return parts.join("; ");
  }
}

/**
 * Server-side adapter for Next.js route handlers, server actions and
 * middleware. Here the cookie is written via a real Set-Cookie header, so
 * HttpOnly genuinely applies.
 */
export interface CookieStore {
  get(key: string): { value?: string } | undefined;
  set(key: string, value: string, options?: Record<string, unknown>): void;
  delete(key: string): void;
}

export class LokServerSessionAdapter implements SupportedStorage {
  /**
   * Tells supabase-js these values come from request cookies and are therefore
   * not authenticated on their own — it must verify the JWT rather than trust
   * the stored session. Always use getUser(), never getSession(), on the server.
   */
  readonly isServer = true;

  private readonly domain: string;

  constructor(
    private readonly cookies: CookieStore,
    options: LokSessionOptions = {}
  ) {
    this.domain = options.domain ?? LOK_COOKIE_DOMAIN;
  }

  async getItem(key: string): Promise<string | null> {
    return this.cookies.get(key)?.value ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.cookies.set(key, value, {
      path: COOKIE_PATH,
      domain: this.domain,
      maxAge: COOKIE_MAX_AGE,
      secure: true,
      httpOnly: true,
      sameSite: "lax",
    });
  }

  async removeItem(key: string): Promise<void> {
    this.cookies.delete(key);
  }
}
