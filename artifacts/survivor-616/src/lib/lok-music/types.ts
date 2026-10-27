// Generated from Lok-EcoSystsem/lok-music; DO NOT EDIT HERE.
/**
 * The Lok playlist standard, v1. Full rules live in STANDARD.md.
 *
 * A playlist is a small JSON file any app can host as a static asset. It lists
 * tracks by URL; the audio itself is never copied into the player, the hub or
 * a database, so publishing a playlist costs nothing beyond the file hosting
 * the app already has.
 */
export const PLAYLIST_SCHEMA = 'lok.playlist/v1';

/** MP3 is the interchange baseline; the rest are accepted for playback. */
export const BASELINE_MIME = 'audio/mpeg';

export interface TrackGate {
  /** The app whose progress opens this track (an authored, in-game unlock). */
  app: string;
  /** Hosts that can read that app's progress compare against this number. */
  objectives: number;
  /** What one objective is called in that app, singular: "run objective". Defaults to "objective". */
  unit?: string;
}

export interface TrackCredit {
  label: string;
  /** https only. */
  url: string;
}

export interface LokTrack {
  /** Unique within its playlist. */
  id: string;
  title: string;
  artist?: string;
  album?: string;
  /** Direct https link to an audio file. Absent for a device-only local file. */
  url?: string;
  mime?: string;
  durationSec?: number;
  /** Optional authored tempo for beat-synced companions and visualizers. */
  bpm?: number;
  gate?: TrackGate;
  credit?: TrackCredit;
}

export type ReleaseKind = 'soundtrack' | 'album' | 'ep' | 'playlist' | 'single';

export interface LokCatalog {
  schema: 'lok.catalog/v1';
  version: number;
  projects: Array<{ app: string; name: string; url?: string }>;
  playlists: LokPlaylist[];
}

export interface LokPlaylist {
  kind?: ReleaseKind;
  legacyAlbumId?: string;
  schema: typeof PLAYLIST_SCHEMA;
  id: string;
  title: string;
  /** Default artist for tracks that do not name their own. Only set it when it is true. */
  artist?: string;
  /** The game or app the songs came from. `url` (https) is where to play it. */
  source?: { app: string; name: string; url?: string };
  tracks: LokTrack[];
}

export type RepeatMode = 'off' | 'all' | 'one';

/**
 * Why a track can be played right now.
 * - free: not gated, or the host's own gate check passed
 * - connected: the Lok account's progress in the gating app meets the gate
 * - earned: it was on air once and was played, so it stays open forever
 * - onair: this hour's drop, open for a limited time; playing it makes it `earned`
 * - locked: not playable yet
 */
export type AccessKind = 'free' | 'connected' | 'earned' | 'onair' | 'locked';

/** A track as the player holds it: ids are namespaced so playlists never collide. */
export interface PlayerTrack extends LokTrack {
  key: string;
  /** Which list the track came from, for grouping in the picker. */
  group: string;
  origin: 'catalog' | 'link' | 'device';
  access: AccessKind;
  locked: boolean;
  /** The game or app this song came from, when the playlist says so. */
  sourceApp?: string;
  releaseId?: string;
  releaseKind?: ReleaseKind;
  sourceName?: string;
  sourceUrl?: string;
}

export interface OnAirDrop {
  key: string;
  title: string;
  openedAt: number;
  closesAt: number;
}

export interface PlayerNotice {
  id: string;
  kind: 'drop' | 'unlocked' | 'connected' | 'locked';
  text: string;
  trackKey?: string;
}

/**
 * How the player learns what an account has unlocked. The package stays
 * dependency-free, so the host wires this to its own backend (the GSix hub
 * uses two small Supabase tables); without an adapter everything works from
 * this device alone.
 */
export interface UnlockAdapter {
  /** Objective counts by app key, e.g. { survivor616: 4 }. */
  loadProgress(): Promise<Record<string, number>>;
  /** Track keys earned from drops, on any device. */
  loadUnlocked(): Promise<string[]>;
  saveUnlocked(keys: string[]): Promise<void>;
}

export interface PlayerSnapshot {
  tracks: PlayerTrack[];
  currentKey: string | null;
  playing: boolean;
  buffering: boolean;
  progressSec: number;
  durationSec: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  catalogStatus: 'idle' | 'loading' | 'ready' | 'partial';
  error: string | null;
  /** Drops open right now, including ones the listener already earned. */
  onAir: OnAirDrop[];
  /** When the next drop opens, or null before the catalog is loaded. */
  nextDropAt: number | null;
  /** Gated tracks that are open / in total, for the "unlocked X of Y" line. */
  gatedOpen: number;
  gatedTotal: number;
  connection: 'none' | 'checking' | 'connected';
  /** The latest thing the listener should be told about. */
  notice: PlayerNotice | null;
}

