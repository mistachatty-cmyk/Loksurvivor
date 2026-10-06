/**
 * Return trip for a sign-in that started inside the GSix arcade player.
 *
 * Providers cannot render inside the player's iframe, so sign-in takes over the
 * whole page and lands back on this game's own address. When it started in the
 * arcade, send the player back to that arcade page afterwards (the embed shares
 * this origin's session) instead of leaving them on the standalone game. The
 * hub tells the embed where it lives with `?arcade=/games/<key>`.
 */
const ARCADE_ORIGIN = 'https://gsix.online';
const STORAGE_KEY = 'survivor616.arcadeReturn.v1';
const MAX_AGE_MS = 10 * 60 * 1000;
/** Same-site absolute paths only: no scheme, no host, no `//`, no query. */
const PATH_PATTERN = /^\/(?!\/)[A-Za-z0-9\-_/]*$/;

export function arcadePathFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get('arcade');
  return raw && PATH_PATTERN.test(raw) ? raw : null;
}

export function arcadeReturnUrl(path: string): string {
  return `${ARCADE_ORIGIN}${path}?signedin=survivor616`;
}

export function isArcadeReturnFresh(savedAt: number, now: number): boolean {
  return Number.isFinite(savedAt) && now - savedAt >= 0 && now - savedAt <= MAX_AGE_MS;
}

function isFramed(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top;
}

/** Call from inside the player just before sign-in leaves the page. */
export function rememberArcadeReturn(): void {
  if (!isFramed()) return;
  const path = arcadePathFromSearch(window.location.search);
  if (!path) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Storage blocked: the player simply stays on the standalone page.
  }
}

/** The arcade address to go back to, once, or null when sign-in did not start there. */
export function consumeArcadeReturn(): string | null {
  if (typeof window === 'undefined' || isFramed()) return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    localStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(stored) as { path?: unknown; at?: unknown };
    if (typeof parsed.path !== 'string' || typeof parsed.at !== 'number') return null;
    if (!PATH_PATTERN.test(parsed.path) || !isArcadeReturnFresh(parsed.at, Date.now())) return null;
    return arcadeReturnUrl(parsed.path);
  } catch {
    return null;
  }
}
