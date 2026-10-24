/**
 * What the phone's lock screen, earbuds and car display show for the song: the title, the album
 * and the app icon, plus the playhead. Pure helpers; `musicPlayer.tsx` hands the result to the
 * browser's Media Session. No artist is ever invented: bundled songs are credited to the game
 * itself and a player's own files carry no artist line at all.
 */
export interface SessionTrack {
  title: string;
  album?: string;
  source: 'bundled' | 'local';
}

export interface SessionMeta {
  title: string;
  artist: string;
  album: string;
  artwork: { src: string; sizes: string; type: string }[];
}

export function sessionMetaFor(track: SessionTrack, baseUrl: string): SessionMeta {
  return {
    title: track.title,
    artist: track.source === 'bundled' ? '616 Survivor' : '',
    album: track.album ?? '',
    artwork: [
      { src: `${baseUrl}icon-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${baseUrl}icon-192.png`, sizes: '192x192', type: 'image/png' },
    ],
  };
}

export interface SessionPosition {
  duration: number;
  position: number;
  playbackRate: number;
}

/** The playhead for the lock screen, or null while the length is unknown (the browser throws on bad values). */
export function positionStateFor(duration: number, position: number, rate = 1): SessionPosition | null {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return null;
  return { duration, position: Math.max(0, Math.min(position, duration)), playbackRate: rate > 0 && Number.isFinite(rate) ? rate : 1 };
}

/** Where a skip-back or skip-forward button lands, never before the start. */
export function skipTarget(current: number, offset: number, direction: 1 | -1): number {
  return Math.max(0, (Number.isFinite(current) ? current : 0) + direction * Math.abs(offset));
}
