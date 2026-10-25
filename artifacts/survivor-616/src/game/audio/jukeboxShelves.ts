/**
 * Shelves: the bundled songs grouped by album, one row of discs per album.
 *
 * Pure and React-free, like `jukeboxDiscs.ts`. A new album is just another group of bundled
 * tracks in the player's catalog: it shows up as a new shelf with no change here. Songs that
 * have no hand-made disc style (anything outside Lokifed) get a disc generated from the song
 * id, so the same song always has the same look and nothing needs drawing by hand.
 */
import type { DiscCascadeItem, DiscPattern } from '@/components/ui/disc-cascade-carousel';
import { discItemFor, type DiscTrack } from './jukeboxDiscs';

export interface ShelfTrack extends DiscTrack {
  album?: string;
}

export interface DiscShelf<T extends ShelfTrack = ShelfTrack> {
  id: string;
  title: string;
  tracks: T[];
}

/** The hand-made Lokifed disc styles belong to this album only. */
const LOKIFED_ALBUM_PREFIX = 'Lokifed';
const FALLBACK_SHELF = 'Soundtrack';

/** Bundled songs grouped by album, albums in catalog order. Player-added files never get a disc. */
export function buildShelves<T extends ShelfTrack>(tracks: readonly T[]): DiscShelf<T>[] {
  const shelves: DiscShelf<T>[] = [];
  for (const track of tracks) {
    if (track.source !== 'bundled') continue;
    const title = track.album?.trim() || FALLBACK_SHELF;
    let shelf = shelves.find((s) => s.title === title);
    if (!shelf) {
      shelf = { id: `shelf:${title}`, title, tracks: [] };
      shelves.push(shelf);
    }
    shelf.tracks.push(track);
  }
  for (const shelf of shelves) {
    if (shelf.tracks.every((t) => typeof t.trackNumber === 'number')) {
      shelf.tracks.sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
    }
  }
  return shelves;
}

/** Shelf ids that belong to the player (hearts, recent plays), not to an album. */
export const PERSONAL_SHELF_PREFIX = 'mine:';
export const FAVORITES_SHELF_ID = `${PERSONAL_SHELF_PREFIX}favorites`;
/** More than this many playlists would bury the albums; the rest stay in the library. */
export const MAX_PLAYLIST_SHELVES = 8;
export const RECENT_SHELF_ID = `${PERSONAL_SHELF_PREFIX}recent`;

/**
 * Puts the player's own shelves in front of the albums: hearted songs, then recently played ones.
 * Only songs that have a disc (the bundled ones) can appear, and an empty shelf is never added.
 */
export function withPersonalShelves<T extends ShelfTrack>(
  shelves: readonly DiscShelf<T>[],
  mine: {
    favoriteIds: readonly string[];
    recentIds: readonly string[];
    titles: { favorites: string; recent: string };
    /** The player's own playlists from the library, each becoming a shelf of the songs that have a disc. */
    playlists?: ReadonlyArray<{ id: string; name: string; trackIds: readonly string[] }>;
  },
): DiscShelf<T>[] {
  const byId = new Map<string, T>();
  for (const shelf of shelves) for (const track of shelf.tracks) byId.set(track.id, track);
  const pick = (ids: readonly string[]) => ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const out: DiscShelf<T>[] = [];
  const favorites = pick(mine.favoriteIds);
  if (favorites.length > 0) out.push({ id: FAVORITES_SHELF_ID, title: mine.titles.favorites, tracks: favorites });
  const recent = pick(mine.recentIds);
  if (recent.length > 0) out.push({ id: RECENT_SHELF_ID, title: mine.titles.recent, tracks: recent });
  for (const playlist of (mine.playlists ?? []).slice(0, MAX_PLAYLIST_SHELVES)) {
    const tracks = pick(playlist.trackIds);
    if (tracks.length > 0) out.push({ id: `${PERSONAL_SHELF_PREFIX}playlist:${playlist.id}`, title: playlist.name, tracks });
  }
  return [...out, ...shelves];
}

/** Every shelf end to end, for the single-row mode. Each entry remembers its shelf and place on it. */
export interface ShelfEntry<T extends ShelfTrack = ShelfTrack> {
  track: T;
  shelfTitle: string;
  position: number;
}

export function entriesOf<T extends ShelfTrack>(shelves: readonly DiscShelf<T>[]): ShelfEntry<T>[] {
  return shelves.flatMap((shelf) => shelf.tracks.map((track, position) => ({ track, shelfTitle: shelf.title, position })));
}

/** Which shelf holds a song (the one to open on), else the remembered shelf, else the first. */
export function shelfIndexFor(shelves: readonly DiscShelf[], playingId: string | null | undefined, rememberedId?: string | null): number {
  if (playingId) {
    // The album that owns the song comes first; the player's own shelves only when it was left open.
    const holding = shelves.findIndex((s) => !s.id.startsWith(PERSONAL_SHELF_PREFIX) && s.tracks.some((t) => t.id === playingId));
    if (holding >= 0) return holding;
  }
  if (rememberedId) {
    const remembered = shelves.findIndex((s) => s.id === rememberedId);
    if (remembered >= 0) return remembered;
  }
  return 0;
}

/** Wraps around both ends, so swiping past the last shelf comes back to the first. */
export function stepShelf(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}

const GENERATED_PATTERNS: readonly DiscPattern[] = ['sunburst', 'rings', 'halftone', 'horizon', 'stripes', 'eclipse', 'mosaic'];
const GENERATED_PALETTES: readonly [string, string, string][] = [
  ['#10151f', '#f97316', '#fde68a'],
  ['#1a0b2e', '#c084fc', '#22d3ee'],
  ['#0f1f1a', '#34d399', '#fef08a'],
  ['#1f1010', '#f87171', '#fcd34d'],
  ['#0b1a2e', '#60a5fa', '#f0abfc'],
  ['#1c1917', '#fbbf24', '#fb7185'],
  ['#111827', '#2dd4bf', '#a78bfa'],
  ['#2a1020', '#f472b6', '#facc15'],
];

/** A small, stable 32-bit hash of the song id (FNV-1a). */
export function idHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The short text printed on a generated disc: the part of the title before any dash, trimmed to fit. */
export function shortLabel(title: string, max = 18): string {
  const head = title.split(/\s[—–-]\s/)[0]?.trim() || title.trim();
  return head.length <= max ? head : `${head.slice(0, max - 1).trimEnd()}…`;
}

/** The carousel item for one song on a shelf. */
export function shelfDiscItem(track: ShelfTrack, position: number, shelfTitle: string): DiscCascadeItem {
  const hasHandMadeStyle = !track.album || track.album.startsWith(LOKIFED_ALBUM_PREFIX);
  if (track.locked || (hasHandMadeStyle && typeof track.trackNumber === 'number')) return discItemFor(track);
  const h = idHash(track.id);
  const num = position + 1 < 10 ? `0${position + 1}` : `${position + 1}`;
  return {
    title: track.title,
    label: shortLabel(track.title),
    pattern: GENERATED_PATTERNS[h % GENERATED_PATTERNS.length],
    palette: GENERATED_PALETTES[(h >>> 8) % GENERATED_PALETTES.length],
    fine: `${shelfTitle}  ·  Track ${num}`,
  };
}

/** The colours of a song's disc, for painting the room around it. Falls back to a neutral dark. */
export function paletteOf(shelves: readonly DiscShelf[], trackId: string | null | undefined): [string, string, string] {
  const fallback: [string, string, string] = ['#0a0a0f', '#888888', '#c8a24a'];
  if (!trackId) return fallback;
  for (const shelf of shelves) {
    const position = shelf.tracks.findIndex((t) => t.id === trackId);
    if (position >= 0) return shelfDiscItem(shelf.tracks[position]!, position, shelf.title).palette ?? fallback;
  }
  return fallback;
}
