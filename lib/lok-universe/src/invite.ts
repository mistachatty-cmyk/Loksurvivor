// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Lok invites: one link and QR grammar for every Lok game.
 *
 * A link is `https://<game host>/?go=<kind>.<CODE>`. The old per-game links (`?friend=`, `?room=`, `?match=`,
 * `?four=`, `?join=`, `?watch=`, `?hall`) still work; `parseInvite` reads both. A scanned QR is just the link.
 *
 * Pure: no DOM, no network. Storage is passed in so tests can use a plain object. Rules and the per-game
 * route map live in docs/LOK_INVITES.md (Lok-EcoSystsem).
 */

export type InviteGame = "survivor" | "qnk";
export type InviteKind = "friend" | "room" | "match" | "four" | "hall" | "watch";
/** What the receiving game should open. Each game maps these to its own screen. */
export type InviteMode = "friend-add" | "room-join" | "match-join" | "four-join" | "hall-enter" | "watch-join";

export interface Invite { kind: InviteKind; code: string | null }

export const INVITE_GAMES: Record<InviteGame, { host: string; name: string }> = {
  survivor: { host: "https://survivor.gsix.online", name: "616 Survivor" },
  qnk: { host: "https://queens.gsix.online", name: "Loks Queens N Kings" },
};

interface KindInfo {
  mode: InviteMode;
  /** Games that can open it; the first is the home game when a link must hop across games. */
  games: InviteGame[];
  /** Needs a signed-in player (a guest sign-in counts). */
  identity: boolean;
  /** True when the link carries a code. */
  coded: boolean;
  /** Old query parameters that mean this kind, per game. */
  legacy: Partial<Record<InviteGame, string[]>>;
  /** Plain words for the welcome card. */
  what: string;
}

export const INVITE_KINDS: Record<InviteKind, KindInfo> = {
  friend: { mode: "friend-add", games: ["survivor", "qnk"], identity: true, coded: true, legacy: { survivor: ["friend"], qnk: ["friend"] }, what: "a friend invite" },
  room: { mode: "room-join", games: ["survivor", "qnk"], identity: false, coded: true, legacy: { survivor: ["room"], qnk: ["join"] }, what: "a private room" },
  match: { mode: "match-join", games: ["qnk"], identity: true, coded: true, legacy: { qnk: ["match"] }, what: "a match invite" },
  four: { mode: "four-join", games: ["qnk"], identity: true, coded: true, legacy: { qnk: ["four"] }, what: "a private four-player hall" },
  hall: { mode: "hall-enter", games: ["qnk"], identity: true, coded: false, legacy: { qnk: ["hall"] }, what: "the Public Hall" },
  watch: { mode: "watch-join", games: ["qnk"], identity: false, coded: true, legacy: { qnk: ["watch", "crowd"] }, what: "a live match to watch" },
};

const KINDS = Object.keys(INVITE_KINDS) as InviteKind[];
const FRIEND_BODY = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

/** Returns the clean code for a kind, or null when it is not a valid code. Codes never contain 0, 1, I or O (read-aloud safe). */
export function normalizeInviteCode(kind: InviteKind, raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (kind === "hall") return null;
  if (kind === "friend") {
    const body = text.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^LOK/, "");
    return FRIEND_BODY.test(body) ? `LOK-${body.slice(0, 4)}-${body.slice(4)}` : null;
  }
  if (kind === "match") return /^[A-Za-z0-9-]{4,12}$/.test(text) ? text : null;
  const up = text.toUpperCase();
  const re = kind === "four" ? /^[A-HJ-NP-Z2-9]{6}$/ : /^[A-HJ-NP-Z2-9]{4,8}$/;
  return re.test(up) ? up : null;
}

function make(kind: InviteKind, raw: string | null): Invite | null {
  if (kind === "hall") return { kind, code: null };
  const code = normalizeInviteCode(kind, raw);
  return code ? { kind, code } : null;
}

/** Reads a query string (`?go=four.K7M2QX` or an old-style parameter). `game` decides which old parameters count. */
export function parseInvite(search: string, game: InviteGame): Invite | null {
  let q: URLSearchParams;
  try { q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`); } catch { return null; }
  const go = q.get("go");
  if (go) {
    const dot = go.indexOf(".");
    const kind = (dot < 0 ? go : go.slice(0, dot)) as InviteKind;
    if ((KINDS as string[]).includes(kind)) {
      const found = make(kind, dot < 0 ? null : go.slice(dot + 1));
      if (found) return found;
    }
  }
  // Old links, most specific first.
  for (const kind of ["four", "match", "room", "friend", "watch", "hall"] as InviteKind[]) {
    for (const key of INVITE_KINDS[kind].legacy[game] ?? []) {
      if (kind === "hall") { if (q.has(key)) return { kind, code: null }; continue; }
      const found = make(kind, q.get(key));
      if (found) return found;
    }
  }
  return null;
}

/** The link a friend opens, or scans as a QR. Opens the home game for that kind unless `game` says otherwise. */
export function buildInviteUrl(invite: Invite, game?: InviteGame): string {
  const info = INVITE_KINDS[invite.kind];
  const target = game && info.games.includes(game) ? game : info.games[0]!;
  const go = invite.code ? `${invite.kind}.${encodeURIComponent(invite.code)}` : invite.kind;
  return `${INVITE_GAMES[target].host}/?go=${go}`;
}

/** Text for a share sheet. */
export function inviteShareText(invite: Invite, game?: InviteGame): string {
  const info = INVITE_KINDS[invite.kind];
  const target = game && info.games.includes(game) ? game : info.games[0]!;
  return `Join me for ${info.what} in ${INVITE_GAMES[target].name}: ${buildInviteUrl(invite, target)}`;
}

/** What the game that received a link should do: open a mode here, or hop to the game that owns it. */
export type InviteDestination =
  | { action: "open"; mode: InviteMode; code: string | null }
  | { action: "redirect"; url: string };

export function inviteDestination(invite: Invite, here: InviteGame): InviteDestination {
  const info = INVITE_KINDS[invite.kind];
  if (info.games.includes(here)) return { action: "open", mode: info.mode, code: invite.code };
  return { action: "redirect", url: buildInviteUrl(invite) };
}

export type OnboardingStep = "identity" | "primer" | "enter";
export interface OnboardingContext {
  /** Signed in with a Lok account or a guest sign-in. */
  signedIn: boolean;
  /** Primer ids this player has already seen on this device (`primer-<mode>`). */
  seenPrimers: readonly string[];
}

/** Ordered steps between "followed a link" and "in the right mode". Games render each step their own way. */
export function inviteOnboarding(invite: Invite, ctx: OnboardingContext): OnboardingStep[] {
  const info = INVITE_KINDS[invite.kind];
  const steps: OnboardingStep[] = [];
  if (info.identity && !ctx.signedIn) steps.push("identity");
  if (!ctx.seenPrimers.includes(primerId(invite.kind))) steps.push("primer");
  steps.push("enter");
  return steps;
}

export const primerId = (kind: InviteKind): string => `primer-${INVITE_KINDS[kind].mode}`;

/** A QR code may hold a full link or a bare code. Only links to Lok hosts are accepted. */
export function parseScanned(text: string, here: InviteGame): Invite | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const known = Object.values(INVITE_GAMES).some((g) => new URL(g.host).hostname === url.hostname);
    if (!known || url.protocol !== "https:") return null;
    const owner = (Object.keys(INVITE_GAMES) as InviteGame[]).find((g) => new URL(INVITE_GAMES[g].host).hostname === url.hostname) ?? here;
    return parseInvite(url.search, owner);
  } catch {
    return make("friend", raw);
  }
}

// ---- Parked invite: survives a sign-in round trip (providers send people back to the site root) ----
export interface MiniStorage { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export const INVITE_STASH_KEY = "lok.invite.pending";
export const INVITE_TTL_MS = 10 * 60 * 1000;

export function stashInvite(invite: Invite, storage: MiniStorage, now = Date.now()): void {
  try { storage.setItem(INVITE_STASH_KEY, JSON.stringify({ k: invite.kind, c: invite.code, at: now })); } catch { /* storage refused: the invite is simply lost */ }
}

/** Returns the parked invite once and forgets it. Expired or damaged entries are dropped. */
export function takeInvite(storage: MiniStorage, now = Date.now()): Invite | null {
  try {
    const raw = storage.getItem(INVITE_STASH_KEY);
    storage.removeItem(INVITE_STASH_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { k?: unknown; c?: unknown; at?: unknown };
    if (typeof j.at !== "number" || now - j.at > INVITE_TTL_MS || now < j.at) return null;
    if (typeof j.k !== "string" || !(KINDS as string[]).includes(j.k)) return null;
    return make(j.k as InviteKind, typeof j.c === "string" ? j.c : null);
  } catch { return null; }
}
