// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Lok Game Directory: the table of every game and mode a crew can open.
 *
 * Each game registers its own rows (one row per game or per mode). The Crew Hub only reads this table, so a
 * game with no row is simply not in the hub. Rows say how many players, whether the mode is online, local
 * (same room) or offline, how a room is made (the invite kind from invite.ts), where it lives (a route in the
 * game's own app), and the oldest SDK version that understands it.
 *
 * Pure and framework-free. No Lok-only names in the core: a customer app can fill its own directory.
 */

import type { InviteKind } from "./invite";

export type DirectoryKind = "online" | "local" | "offline";

export interface DirectoryRow {
  /** Unique, lowercase, dot-separated: "<app>.<mode>", for example "party.board". */
  id: string;
  /** The app that owns the row, for example "party" or "qnk". */
  app: string;
  /** Player-facing names. Games localise these themselves; the table keeps the English fallback. */
  name: string;
  modeName?: string;
  /** Looks up an original glyph in the game's glyph set; never an emoji or character. */
  glyph: string;
  kind: DirectoryKind;
  minPlayers: number;
  maxPlayers: number;
  /** How a shared room is made. Null for offline rows and for modes with no room. */
  invite: InviteKind | null;
  /** In-app route the game opens (a path or hash the game understands). */
  route: string;
  /** Oldest SDK version that can follow a launch for this row, "major.minor.patch". */
  minSdk: string;
}

const ID = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
const SDK = /^\d+\.\d+\.\d+$/;

/** Compares "1.10.0" style versions: negative if a is older, 0 equal, positive if newer. */
export function compareSdk(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** Returns a list of plain problems; an empty list means the row is good. */
export function validateRow(row: DirectoryRow): string[] {
  const errors: string[] = [];
  if (!ID.test(row.id)) errors.push(`id "${row.id}" must look like app.mode in lowercase`);
  else if (row.id.split(".")[0] !== row.app) errors.push(`id "${row.id}" must start with its app "${row.app}"`);
  if (!row.name.trim()) errors.push("name is empty");
  if (!row.glyph.trim() || /[^\x20-\x7e]/.test(row.glyph)) errors.push("glyph must be a plain key, not a character");
  if (!Number.isInteger(row.minPlayers) || !Number.isInteger(row.maxPlayers) || row.minPlayers < 1 || row.maxPlayers < row.minPlayers) {
    errors.push("player counts must be whole numbers with min at least 1 and max at least min");
  }
  if (!row.route.trim()) errors.push("route is empty");
  if (!SDK.test(row.minSdk)) errors.push(`minSdk "${row.minSdk}" must look like 1.10.0`);
  if (row.kind === "offline" && row.invite) errors.push("an offline row cannot have an invite kind");
  if (row.kind === "online" && !row.invite) errors.push("an online row needs an invite kind so a room can be made");
  return errors;
}

export interface GameDirectory {
  /** Adds rows. Throws on a bad or duplicate row so mistakes show up in tests, not in the hub. */
  register(rows: DirectoryRow[]): void;
  all(): DirectoryRow[];
  find(id: string): DirectoryRow | undefined;
  /** Online and local rows: what the hub shows on top. Optionally only those a crew of this size can play. */
  multiplayer(crewSize?: number): DirectoryRow[];
  /** Offline rows: the scroll underneath, "Play on your own". */
  offline(): DirectoryRow[];
  forApp(app: string): DirectoryRow[];
}

export function createGameDirectory(initial: DirectoryRow[] = []): GameDirectory {
  const rows = new Map<string, DirectoryRow>();
  const dir: GameDirectory = {
    register(list) {
      for (const row of list) {
        const errors = validateRow(row);
        if (errors.length) throw new Error(`Game directory row ${row.id}: ${errors.join("; ")}`);
        if (rows.has(row.id)) throw new Error(`Game directory row ${row.id} is already registered`);
        rows.set(row.id, row);
      }
    },
    all: () => [...rows.values()],
    find: (id) => rows.get(id),
    multiplayer: (crewSize) =>
      [...rows.values()].filter((r) => r.kind !== "offline" && (crewSize == null || (crewSize >= r.minPlayers && crewSize <= r.maxPlayers))),
    offline: () => [...rows.values()].filter((r) => r.kind === "offline"),
    forApp: (app) => [...rows.values()].filter((r) => r.app === app),
  };
  dir.register(initial);
  return dir;
}
