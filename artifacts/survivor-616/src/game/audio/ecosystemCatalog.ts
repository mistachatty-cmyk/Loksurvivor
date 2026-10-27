import { parseCatalog } from '@/lib/lok-music/catalog';
import type { LokPlaylist } from '@/lib/lok-music/types';
import snapshot from './lok-music-catalog.json';

export const ECOSYSTEM_RELEASES = parseCatalog(snapshot)!;
export function ecosystemTrackId(release: LokPlaylist, id: string): string {
  return release.source?.app === 'survivor616' ? id : `${release.id}:${id}`;
}
export function ecosystemTracks(releases: LokPlaylist[]) {
  const seen = new Set<string>();
  return releases.flatMap((release) => release.tracks.flatMap((track, index) => {
    const id = ecosystemTrackId(release, track.id);
    if (seen.has(id)) return [];
    seen.add(id);
    const localPath = release.source?.app === 'survivor616' && track.url?.startsWith('https://survivor.gsix.online/music/')
      ? `${import.meta.env?.BASE_URL ?? '/'}music/${track.url.split('/music/')[1]}` : track.url!;
    return [{ id, title: track.title, url: localPath, source: 'bundled' as const,
      album: release.title, size: 0, duration: track.durationSec ?? null,
      trackNumber: release.id.endsWith('.lokifed-take-1') ? index : index + 1,
      unlockObjectiveCount: track.gate?.objectives ?? 0, unlockApp: track.gate?.app,
      sourceApp: release.source?.app, sourceName: release.source?.name,
      releaseKind: release.kind ?? 'album', releaseId: release.id, authoredBpm: track.bpm,
      creditLabel: track.credit?.label, creditUrl: track.credit?.url }];
  }));
}
export function ecosystemAlbums(releases: LokPlaylist[]) {
  return releases.map((release) => ({ id: release.legacyAlbumId ?? `release:${release.id}`, title: release.title,
    sourceApp: release.source?.app, sourceName: release.source?.name, kind: release.kind ?? 'album',
    trackIds: release.tracks.map((track) => ecosystemTrackId(release, track.id)) }));
}
