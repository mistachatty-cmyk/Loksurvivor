/**
 * The studio's document model.
 *
 * Deliberately free of Tone types and of any Web Audio object: a project is
 * plain JSON so it can be persisted, exported as a `.616song` file, diffed, and
 * unit-tested under `node --test` with no browser. Decoded audio lives in a
 * separate runtime map keyed by `bufferId` (see `importer.ts`) and is never
 * serialised -- a project references the player's own files, it does not carry
 * them.
 */

export const STUDIO_PROJECT_VERSION = 1;
export const STUDIO_STORAGE_KEY = 'survivor616.studio.v1';

export const MIN_BPM = 40;
export const MAX_BPM = 240;
/** Beats in a bar. Only 4/4 is authored today, but clips already store beats. */
export const BEATS_PER_BAR = 4;

export interface StudioClip {
  id: string;
  /** Key into the runtime buffer map; absent means the source is gone. */
  bufferId: string;
  /** Display name, defaults to the imported filename. */
  name: string;
  /** Position on the timeline, in beats from the start. */
  startBeat: number;
  /** Length in beats. */
  lengthBeats: number;
}

export interface StudioTrack {
  id: string;
  name: string;
  /** 0..1 linear. */
  gain: number;
  /** -1 (left) .. 1 (right). */
  pan: number;
  muted: boolean;
  soloed: boolean;
  clips: StudioClip[];
}

export interface StudioProject {
  version: number;
  name: string;
  bpm: number;
  beatsPerBar: number;
  tracks: StudioTrack[];
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clampBpm(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 120;
  return clamp(Math.round(numeric), MIN_BPM, MAX_BPM);
}

let idCounter = 0;
/** Ids only need to be unique within a project, not globally. */
export function studioId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function createTrack(name: string): StudioTrack {
  return { id: studioId('track'), name, gain: 0.8, pan: 0, muted: false, soloed: false, clips: [] };
}

export function createProject(name = 'Untitled'): StudioProject {
  return {
    version: STUDIO_PROJECT_VERSION,
    name,
    bpm: 120,
    beatsPerBar: BEATS_PER_BAR,
    tracks: [createTrack('Track 1'), createTrack('Track 2')],
  };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function secondsPerBeat(bpm: number): number {
  return 60 / clampBpm(bpm);
}

/** Where the project ends, in beats -- at least one bar so the grid is usable. */
export function projectLengthBeats(project: StudioProject): number {
  let end = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) end = Math.max(end, clip.startBeat + clip.lengthBeats);
  }
  return Math.max(project.beatsPerBar, Math.ceil(end / project.beatsPerBar) * project.beatsPerBar);
}

/**
 * Whether a track should be heard, accounting for solo. Any soloed track
 * silences every track that is not itself soloed -- the standard DAW rule, and
 * the reason mute cannot be evaluated per track in isolation.
 */
export function trackAudible(project: StudioProject, track: StudioTrack): boolean {
  if (track.muted) return false;
  const anySoloed = project.tracks.some((t) => t.soloed);
  return anySoloed ? track.soloed : true;
}

/* ------------------------------------------------------------------ */
/* Serialisation                                                       */
/* ------------------------------------------------------------------ */

function sanitizeClip(raw: unknown): StudioClip | null {
  if (!raw || typeof raw !== 'object') return null;
  const clip = raw as Partial<StudioClip>;
  if (typeof clip.bufferId !== 'string' || clip.bufferId === '') return null;
  const startBeat = typeof clip.startBeat === 'number' && Number.isFinite(clip.startBeat) ? Math.max(0, clip.startBeat) : 0;
  const lengthBeats =
    typeof clip.lengthBeats === 'number' && Number.isFinite(clip.lengthBeats) && clip.lengthBeats > 0
      ? clip.lengthBeats
      : 4;
  return {
    id: typeof clip.id === 'string' && clip.id ? clip.id : studioId('clip'),
    bufferId: clip.bufferId,
    name: typeof clip.name === 'string' ? clip.name : 'Clip',
    startBeat,
    lengthBeats,
  };
}

function sanitizeTrack(raw: unknown): StudioTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const track = raw as Partial<StudioTrack>;
  return {
    id: typeof track.id === 'string' && track.id ? track.id : studioId('track'),
    name: typeof track.name === 'string' ? track.name : 'Track',
    gain: typeof track.gain === 'number' && Number.isFinite(track.gain) ? clamp(track.gain, 0, 1) : 0.8,
    pan: typeof track.pan === 'number' && Number.isFinite(track.pan) ? clamp(track.pan, -1, 1) : 0,
    muted: track.muted === true,
    soloed: track.soloed === true,
    clips: Array.isArray(track.clips)
      ? track.clips.map(sanitizeClip).filter((clip): clip is StudioClip => clip !== null)
      : [],
  };
}

/**
 * Rebuilds a project from untrusted JSON -- a `.616song` file someone was sent,
 * or a `localStorage` entry written by an older build. Never throws; anything
 * unreadable falls back to a default, because losing a session to one bad field
 * is worse than silently repairing it.
 */
export function parseProject(raw: unknown): StudioProject {
  if (!raw || typeof raw !== 'object') return createProject();
  const parsed = raw as Partial<StudioProject>;
  const tracks = Array.isArray(parsed.tracks)
    ? parsed.tracks.map(sanitizeTrack).filter((track): track is StudioTrack => track !== null)
    : [];
  return {
    version: STUDIO_PROJECT_VERSION,
    name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Untitled',
    bpm: clampBpm(parsed.bpm),
    beatsPerBar:
      typeof parsed.beatsPerBar === 'number' && parsed.beatsPerBar >= 1
        ? Math.round(parsed.beatsPerBar)
        : BEATS_PER_BAR,
    tracks: tracks.length > 0 ? tracks : createProject().tracks,
  };
}

export function serializeProject(project: StudioProject): string {
  return JSON.stringify(project, null, 2);
}

export function loadStoredProject(): StudioProject {
  if (typeof localStorage === 'undefined') return createProject();
  try {
    const raw = localStorage.getItem(STUDIO_STORAGE_KEY);
    return raw ? parseProject(JSON.parse(raw) as unknown) : createProject();
  } catch {
    return createProject();
  }
}

export function storeProject(project: StudioProject): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(project));
  } catch {
    // A full or disabled store must not interrupt playback.
  }
}
