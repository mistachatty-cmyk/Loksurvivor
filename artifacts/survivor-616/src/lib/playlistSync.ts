/**
 * Cloud-synced playlists. A signed-in player's custom playlists follow them to other devices, but only
 * the parts that make sense there: names, order, and songs that ship with the game. Songs a player added
 * from their own files stay on the device that has them, and are never uploaded.
 *
 * The rule is the same as the save: the newest edit wins as a whole set. A device that has never synced and
 * already has playlists merges instead, so nothing made before signing in is lost.
 */

export const PLAYLIST_SYNC_SOURCE = 'survivor616.playlists';
export const MAX_SYNCED_PLAYLISTS = 40;
export const MAX_SYNCED_TRACKS = 300;
export const MAX_SYNCED_NAME = 60;

export interface SyncPlaylist {
  id: string;
  name: string;
  trackIds: string[];
}

export interface PlaylistSnapshot {
  savedAt: number;
  playlists: SyncPlaylist[];
}

interface PlaylistLike {
  id: string;
  name: string;
  trackIds: string[];
  builtIn?: boolean;
}

/** What may leave the device: custom playlists, trimmed, with only songs the game ships. */
export function syncablePlaylists(list: readonly PlaylistLike[], bundledIds: ReadonlySet<string>): SyncPlaylist[] {
  return list
    .filter((playlist) => !playlist.builtIn)
    .slice(0, MAX_SYNCED_PLAYLISTS)
    .map((playlist) => ({
      id: playlist.id,
      name: playlist.name.trim().slice(0, MAX_SYNCED_NAME) || 'Playlist',
      trackIds: playlist.trackIds.filter((id) => bundledIds.has(id)).slice(0, MAX_SYNCED_TRACKS),
    }));
}

export function playlistFingerprint(list: readonly SyncPlaylist[]): string {
  return JSON.stringify(list.map((playlist) => [playlist.id, playlist.name, playlist.trackIds]));
}

/** Reads whatever the cloud holds, ignoring anything malformed. */
export function parseSnapshot(raw: unknown, bundledIds: ReadonlySet<string>): PlaylistSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { savedAt?: unknown; playlists?: unknown };
  if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt) || !Array.isArray(value.playlists)) return null;
  const playlists: SyncPlaylist[] = [];
  for (const entry of value.playlists.slice(0, MAX_SYNCED_PLAYLISTS)) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as { id?: unknown; name?: unknown; trackIds?: unknown };
    if (typeof item.id !== 'string' || typeof item.name !== 'string' || !Array.isArray(item.trackIds)) continue;
    playlists.push({
      id: item.id.slice(0, 80),
      name: item.name.trim().slice(0, MAX_SYNCED_NAME) || 'Playlist',
      trackIds: item.trackIds.filter((id): id is string => typeof id === 'string' && bundledIds.has(id)).slice(0, MAX_SYNCED_TRACKS),
    });
  }
  return { savedAt: value.savedAt, playlists };
}

export type SyncDecision =
  | { action: 'none' }
  | { action: 'push'; playlists: SyncPlaylist[] }
  | { action: 'pull'; playlists: SyncPlaylist[] }
  | { action: 'merge'; playlists: SyncPlaylist[] };

/**
 * Chooses what to do when a device meets the cloud copy.
 * `localEditedAt` is when this device's playlists last changed; `neverSynced` is true until the first sync here.
 */
export function decideSync(
  local: readonly SyncPlaylist[],
  localEditedAt: number,
  cloud: PlaylistSnapshot | null,
  neverSynced: boolean,
): SyncDecision {
  if (!cloud) return local.length > 0 ? { action: 'push', playlists: [...local] } : { action: 'none' };
  if (neverSynced && local.length > 0) return { action: 'merge', playlists: mergePlaylists(local, cloud.playlists) };
  if (cloud.savedAt > localEditedAt) return { action: 'pull', playlists: cloud.playlists };
  if (localEditedAt > cloud.savedAt && playlistFingerprint(local) !== playlistFingerprint(cloud.playlists)) {
    return { action: 'push', playlists: [...local] };
  }
  return { action: 'none' };
}

/** Both sets together; for a playlist on both sides the longer song list wins, so nothing is dropped. */
export function mergePlaylists(local: readonly SyncPlaylist[], cloud: readonly SyncPlaylist[]): SyncPlaylist[] {
  const byId = new Map<string, SyncPlaylist>();
  for (const playlist of cloud) byId.set(playlist.id, playlist);
  for (const playlist of local) {
    const other = byId.get(playlist.id);
    if (!other) byId.set(playlist.id, playlist);
    else if (playlist.trackIds.length > other.trackIds.length) byId.set(playlist.id, { ...other, trackIds: playlist.trackIds });
  }
  return [...byId.values()].slice(0, MAX_SYNCED_PLAYLISTS);
}

/**
 * Turns the cloud's list into this device's playlists. Songs the player added from their own files are
 * kept on the playlists that already held them, after the synced songs.
 */
export function applyPulled(
  current: readonly PlaylistLike[],
  pulled: readonly SyncPlaylist[],
  bundledIds: ReadonlySet<string>,
): Array<{ id: string; name: string; trackIds: string[] }> {
  const localOnly = new Map<string, string[]>();
  for (const playlist of current) {
    if (playlist.builtIn) continue;
    localOnly.set(playlist.id, playlist.trackIds.filter((id) => !bundledIds.has(id)));
  }
  return pulled.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    trackIds: [...playlist.trackIds, ...(localOnly.get(playlist.id) ?? [])],
  }));
}
