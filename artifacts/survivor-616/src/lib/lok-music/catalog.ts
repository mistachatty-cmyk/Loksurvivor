// Generated from Lok-EcoSystsem/lok-music; DO NOT EDIT HERE.
import { PLAYLIST_SCHEMA, type LokPlaylist, type LokTrack, type LokCatalog, type ReleaseKind } from './types';

/** Lok Ecosystem owns the catalog; GSix serves its generated public mirror. */
export const DEFAULT_CATALOGS = ['https://gsix.online/lok-music-catalog.json'];
export const CATALOG_TTL_MS = 600_000;

const MAX_TRACKS = 500;
const MAX_TEXT = 200;

/**
 * Streaming services are never fetched or embedded here. Their audio is not
 * the listener's to hand over, and the player only ever plays files someone
 * controls: their own device, or a direct link to a file they host.
 */
const STREAMING_HOSTS = [
  'youtube.com', 'youtu.be', 'spotify.com', 'soundcloud.com', 'music.apple.com',
  'apple.com', 'tidal.com', 'deezer.com', 'pandora.com', 'amazon.com', 'bandcamp.com',
];

/** https everywhere; plain http only for localhost so the standard can be developed against locally. */
function secure(url: URL): boolean {
  return url.protocol === 'https:' || (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
}

export type LinkCheck = { ok: true; url: string } | { ok: false; reason: string };

export function checkLink(raw: string): LinkCheck {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return { ok: false, reason: 'That is not a valid link.' }; }
  if (!secure(url)) return { ok: false, reason: 'Links must start with https://.' };
  const host = url.hostname.toLowerCase();
  if (STREAMING_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
    return { ok: false, reason: 'Streaming-service links cannot be played here. Save your own file and add it from your device, or link to a file you host.' };
  }
  return { ok: true, url: url.toString() };
}

function text(value: unknown, max = MAX_TEXT): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function httpsUrl(value: unknown): string | undefined {
  const raw = text(value, 2048);
  if (!raw) return undefined;
  try { const url = new URL(raw); return secure(url) ? url.toString() : undefined; } catch { return undefined; }
}

/** Validates untrusted JSON into a playlist, dropping anything malformed instead of throwing. */
export function parsePlaylist(input: unknown): LokPlaylist | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (raw.schema !== PLAYLIST_SCHEMA) return null;
  const id = text(raw.id, 80);
  const title = text(raw.title);
  if (!id || !title || !Array.isArray(raw.tracks)) return null;

  const seen = new Set<string>();
  const tracks: LokTrack[] = [];
  for (const entry of raw.tracks.slice(0, MAX_TRACKS)) {
    if (!entry || typeof entry !== 'object') continue;
    const t = entry as Record<string, unknown>;
    const trackId = text(t.id, 80);
    const trackTitle = text(t.title);
    const url = httpsUrl(t.url);
    if (!trackId || !trackTitle || !url || seen.has(trackId)) continue;
    seen.add(trackId);
    const track: LokTrack = { id: trackId, title: trackTitle, url };
    const artist = text(t.artist); if (artist) track.artist = artist;
    const album = text(t.album); if (album) track.album = album;
    const mime = text(t.mime, 60); if (mime) track.mime = mime;
    if (typeof t.durationSec === 'number' && t.durationSec > 0 && t.durationSec < 86_400) track.durationSec = Math.round(t.durationSec);
    const gate = t.gate as Record<string, unknown> | undefined;
    if (gate && text(gate.app, 60) && typeof gate.objectives === 'number' && gate.objectives >= 0) {
      track.gate = { app: text(gate.app, 60)!, objectives: Math.floor(gate.objectives) };
      const unit = text(gate.unit, 30); if (unit) track.gate.unit = unit;
    }
    const credit = t.credit as Record<string, unknown> | undefined;
    if (credit && text(credit.label, 80) && httpsUrl(credit.url)) {
      track.credit = { label: text(credit.label, 80)!, url: httpsUrl(credit.url)! };
    }
    tracks.push(track);
  }
  if (tracks.length === 0) return null;

  const source = raw.source as Record<string, unknown> | undefined;
  return {
    schema: PLAYLIST_SCHEMA,
    id,
    title,
    kind: ['soundtrack', 'album', 'ep', 'playlist', 'single'].includes(String(raw.kind)) ? raw.kind as ReleaseKind : 'album',
    legacyAlbumId: text(raw.legacyAlbumId, 120),
    artist: text(raw.artist),
    source: source && text(source.app, 60) && text(source.name, 80)
      ? { app: text(source.app, 60)!, name: text(source.name, 80)!, ...(httpsUrl(source.url) ? { url: httpsUrl(source.url)! } : {}) }
      : undefined,
    tracks,
  };
}

/** Accept both a legacy single release and the complete ecosystem catalog. */
export function parseCatalog(input: unknown): LokPlaylist[] | null {
  const legacy = parsePlaylist(input);
  if (legacy) return [legacy];
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<LokCatalog>;
  if (raw.schema !== 'lok.catalog/v1' || raw.version !== 1 || !Array.isArray(raw.playlists) || raw.playlists.length > 200) return null;
  const playlists: LokPlaylist[] = [];
  const ids = new Set<string>();
  for (const entry of raw.playlists) {
    const playlist = parsePlaylist(entry);
    if (!playlist || !playlist.source || ids.has(playlist.id)) return null;
    ids.add(playlist.id);
    playlists.push(playlist);
  }
  return playlists.length ? playlists : null;
}

const cache = new Map<string, { at: number; pending: Promise<LokPlaylist[] | null> }>();
/** Shared ten-minute metadata cache; it never fetches audio. Failed requests can retry. */
export function fetchCatalog(url: string): Promise<LokPlaylist[] | null> {
  const existing = cache.get(url);
  if (existing && Date.now() - existing.at < CATALOG_TTL_MS) return existing.pending;
  const pending = fetch(url, { credentials: 'omit' }).then(async (res) => res.ok ? parseCatalog(await res.json()) : null)
    .catch(() => null).then((result) => { if (!result && cache.get(url)?.pending === pending) cache.delete(url); return result; });
  cache.set(url, { at: Date.now(), pending });
  return pending;
}

export async function fetchPlaylist(url: string): Promise<LokPlaylist | null> {
  return (await fetchCatalog(url))?.[0] ?? null;
}
