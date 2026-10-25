/**
 * Listening together: one crew member (the host) picks the music and everyone following hears the same
 * song at the same place. Messages are tiny and carry only a song id and a position, never audio, so
 * only songs that every player's game already has (the soundtrack) can be shared.
 */
export type ListenKind = 'start' | 'state' | 'stop' | 'join' | 'leave';

export interface ListenMessage {
  kind: ListenKind;
  trackId?: string;
  positionSec?: number;
  playing?: boolean;
  /** The host's periodic repeat of its place, as opposed to a change the host just made. */
  heartbeat?: boolean;
  /** Who is speaking, for the invite line. */
  name?: string;
}

/** Past this much difference a follower jumps to the host's place instead of drifting along. */
export const DRIFT_SEEK_SEC = 1.5;
/** The host repeats its place this often while playing, so late joiners and phones that stalled catch up. */
export const HEARTBEAT_MS = 8000;
const MAX_ID = 120;
const MAX_NAME = 40;
const MAX_POSITION = 60 * 60 * 6;

const KINDS: readonly ListenKind[] = ['start', 'state', 'stop', 'join', 'leave'];

/** Anything off the network is untrusted: unknown kinds, wrong types and silly numbers all come back null or clamped. */
export function parseListenMessage(payload: unknown): ListenMessage | null {
  if (!payload || typeof payload !== 'object') return null;
  const r = payload as Record<string, unknown>;
  if (typeof r.kind !== 'string' || !KINDS.includes(r.kind as ListenKind)) return null;
  const out: ListenMessage = { kind: r.kind as ListenKind };
  if (typeof r.trackId === 'string' && r.trackId.length > 0 && r.trackId.length <= MAX_ID) out.trackId = r.trackId;
  if (typeof r.positionSec === 'number' && Number.isFinite(r.positionSec)) out.positionSec = Math.min(MAX_POSITION, Math.max(0, r.positionSec));
  if (typeof r.playing === 'boolean') out.playing = r.playing;
  if (r.heartbeat === true) out.heartbeat = true;
  if (typeof r.name === 'string') out.name = r.name.replace(/[\u0000-\u001f<>]/g, '').slice(0, MAX_NAME).trim();
  if ((out.kind === 'start' || out.kind === 'state') && !out.trackId) return null;
  return out;
}

export type FollowAction =
  | { type: 'play-track'; trackId: string; positionSec: number }
  | { type: 'seek'; positionSec: number }
  | { type: 'toggle' }
  | { type: 'none' };

interface Mine { trackId: string | null; positionSec: number; playing: boolean }

/**
 * What a follower should do to match a host message. `explicit` is true for the host's own changes
 * (song, play, pause) and false for the periodic heartbeat, which only corrects drift and never
 * starts or stops the music, so a follower who paused for a moment is not yanked back.
 */
export function followActions(host: Required<Pick<ListenMessage, 'trackId'>> & ListenMessage, mine: Mine, explicit: boolean): FollowAction[] {
  const hostPos = host.positionSec ?? 0;
  const hostPlaying = host.playing ?? true;
  if (mine.trackId !== host.trackId) {
    if (!explicit) return [{ type: 'none' }];
    return [{ type: 'play-track', trackId: host.trackId, positionSec: hostPos }, ...(hostPlaying ? [] : [{ type: 'toggle' } as const])];
  }
  const actions: FollowAction[] = [];
  if (explicit && mine.playing !== hostPlaying) actions.push({ type: 'toggle' });
  if (Math.abs(mine.positionSec - hostPos) > DRIFT_SEEK_SEC && (hostPlaying ? mine.playing || explicit : true)) actions.push({ type: 'seek', positionSec: hostPos });
  return actions.length ? actions : [{ type: 'none' }];
}

/** True when the host's own change is worth announcing: a new song, play or pause, or a jump in position. */
export function hostChanged(prev: { trackId: string | null; playing: boolean; positionSec: number } | null, next: { trackId: string | null; playing: boolean; positionSec: number }): boolean {
  if (!prev) return true;
  if (prev.trackId !== next.trackId || prev.playing !== next.playing) return true;
  // A normal tick moves about as far as the clock did; a bigger jump is a seek.
  return Math.abs(next.positionSec - prev.positionSec) > DRIFT_SEEK_SEC + 1;
}
