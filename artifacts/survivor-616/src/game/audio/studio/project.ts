/**
 * The studio's document model.
 *
 * Deliberately free of Tone types and of any Web Audio object: a project is
 * plain JSON so it can be persisted, bundled with sources, diffed, and
 * unit-tested under `node --test` with no browser. Decoded audio lives in a
 * separate runtime map keyed by `bufferId` (see `importer.ts`) and is never
 * serialised inline. Portable bundles carry the stored source files alongside
 * the document.
 */

export const STUDIO_PROJECT_VERSION = 2;
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
  /** Non-destructive start point within the source, in seconds. */
  sourceOffsetSeconds?: number;
  gain?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
}

export interface StudioMidiClip {
  id: string;
  name: string;
  startBeat: number;
  lengthBeats: number;
  /** Note positions are relative to the clip. */
  notes: StudioNote[];
}

export interface StudioDrumHit {
  step: number;
  pad: number;
  velocity: number;
}

export interface StudioDrumPattern {
  id: string;
  name: string;
  bars: number;
  swing: number;
  hits: StudioDrumHit[];
}

export interface StudioDrumPad {
  name: string;
  /** Built-in sounds are generated locally; custom sounds use shared media ids. */
  sourceId?: string;
  trimStartSeconds: number;
  trimEndSeconds: number;
  tuneSemitones: number;
  gain: number;
  chokeGroup: number;
}

export interface StudioDrumKit {
  id: string;
  name: string;
  palette: 'core' | 'rust' | 'neon' | 'custom';
  pads: StudioDrumPad[];
}

export interface StudioDrumClip {
  id: string;
  patternId: string;
  kitId: string;
  startBeat: number;
  lengthBeats: number;
}

/** One effect in a track's insert chain. */
export interface StudioEffect {
  id: string;
  /** Which `EffectDef` this is an instance of. */
  effectId: string;
  /** Normalised 0..1 values, keyed by `EffectParam.id`. */
  params: Record<string, number>;
}

/**
 * One note on an instrument track.
 *
 * Pitch is a MIDI number rather than a name so transposing and drawing are
 * arithmetic; names are for display only.
 */
export interface StudioNote {
  id: string;
  /** MIDI note number. 60 is middle C. */
  pitch: number;
  startBeat: number;
  lengthBeats: number;
  /** 0..1. */
  velocity: number;
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
  midiClips: StudioMidiClip[];
  drumClips: StudioDrumClip[];
  /** Ordered insert chain. Order is the signal path.  */
  effects: StudioEffect[];
  /**
   * Set when this track plays a synth rather than audio clips. An audio track
   * and an instrument track differ only by this field being present, so one
   * mixer, one insert chain and one solo rule cover both.
   */
  instrumentId?: string;
  /** Notes, when this is an instrument track. */
  notes: StudioNote[];
}

export interface StudioProject {
  version: number;
  name: string;
  bpm: number;
  beatsPerBar: number;
  tracks: StudioTrack[];
  patterns: StudioDrumPattern[];
  kits: StudioDrumKit[];
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
  return {
    id: studioId('track'),
    name,
    gain: 0.8,
    pan: 0,
    muted: false,
    soloed: false,
    clips: [],
    midiClips: [],
    drumClips: [],
    effects: [],
    notes: [],
  };
}

export function createProject(name = 'Untitled'): StudioProject {
  return {
    version: STUDIO_PROJECT_VERSION,
    name,
    bpm: 120,
    beatsPerBar: BEATS_PER_BAR,
    tracks: [createTrack('Track 1'), createTrack('Track 2')],
    patterns: [createPattern()],
    kits: [createBuiltinKit('core'), createBuiltinKit('rust'), createBuiltinKit('neon')],
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
    for (const note of track.notes) end = Math.max(end, note.startBeat + note.lengthBeats);
    for (const clip of track.midiClips) end = Math.max(end, clip.startBeat + clip.lengthBeats);
    for (const clip of track.drumClips) end = Math.max(end, clip.startBeat + clip.lengthBeats);
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
    sourceOffsetSeconds: typeof clip.sourceOffsetSeconds === 'number' && Number.isFinite(clip.sourceOffsetSeconds) ? Math.max(0, clip.sourceOffsetSeconds) : 0,
    gain: typeof clip.gain === 'number' && Number.isFinite(clip.gain) ? clamp(clip.gain, 0, 2) : 1,
    fadeInSeconds: typeof clip.fadeInSeconds === 'number' && Number.isFinite(clip.fadeInSeconds) ? Math.max(0, clip.fadeInSeconds) : 0,
    fadeOutSeconds: typeof clip.fadeOutSeconds === 'number' && Number.isFinite(clip.fadeOutSeconds) ? Math.max(0, clip.fadeOutSeconds) : 0,
  };
}

function sanitizeEffect(raw: unknown): StudioEffect | null {
  if (!raw || typeof raw !== 'object') return null;
  const effect = raw as Partial<StudioEffect>;
  if (typeof effect.effectId !== 'string' || effect.effectId === '') return null;
  const params: Record<string, number> = {};
  if (effect.params && typeof effect.params === 'object') {
    for (const [key, value] of Object.entries(effect.params)) {
      if (typeof value === 'number' && Number.isFinite(value)) params[key] = clamp(value, 0, 1);
    }
  }
  return {
    id: typeof effect.id === 'string' && effect.id ? effect.id : studioId('effect'),
    effectId: effect.effectId,
    params,
  };
}

/** MIDI's full range; anything outside it is a corrupt value, not a low note. */
const MIN_PITCH = 0;
const MAX_PITCH = 127;

function sanitizeNote(raw: unknown): StudioNote | null {
  if (!raw || typeof raw !== 'object') return null;
  const note = raw as Partial<StudioNote>;
  if (typeof note.pitch !== 'number' || !Number.isFinite(note.pitch)) return null;
  return {
    id: typeof note.id === 'string' && note.id ? note.id : studioId('note'),
    pitch: Math.round(clamp(note.pitch, MIN_PITCH, MAX_PITCH)),
    startBeat:
      typeof note.startBeat === 'number' && Number.isFinite(note.startBeat)
        ? Math.max(0, note.startBeat)
        : 0,
    lengthBeats:
      typeof note.lengthBeats === 'number' && Number.isFinite(note.lengthBeats) && note.lengthBeats > 0
        ? note.lengthBeats
        : 1,
    velocity:
      typeof note.velocity === 'number' && Number.isFinite(note.velocity)
        ? clamp(note.velocity, 0, 1)
        : 0.8,
  };
}

const PAD_NAMES = ['Kick', 'Snare', 'Closed Hat', 'Open Hat', 'Clap', 'Tom Low', 'Tom High', 'Rim', 'Shaker', 'Cowbell', 'Perc 1', 'Perc 2', 'Crash', 'Ride', 'Sub', 'Accent'];

export function createBuiltinKit(palette: 'core' | 'rust' | 'neon'): StudioDrumKit {
  const name = palette === 'core' ? 'Core 616' : palette === 'rust' ? 'Survivor Rust' : 'Survivor Neon';
  return {
    id: `builtin:${palette}`,
    name,
    palette,
    pads: PAD_NAMES.map((padName, index) => ({
      name: padName,
      trimStartSeconds: 0,
      trimEndSeconds: 0,
      tuneSemitones: 0,
      gain: 1,
      chokeGroup: index === 2 || index === 3 ? 1 : 0,
    })),
  };
}

export function createPattern(name = 'Pattern 1', bars = 1): StudioDrumPattern {
  return { id: studioId('pattern'), name, bars: Math.round(clamp(bars, 1, 4)), swing: 0, hits: [] };
}

export function setPatternHit(project: StudioProject, patternId: string, step: number, pad: number, velocity: number): StudioProject {
  return {
    ...project,
    patterns: project.patterns.map((pattern) => {
      if (pattern.id !== patternId || !Number.isInteger(step) || step < 0 || step >= pattern.bars * 16 || !Number.isInteger(pad) || pad < 0 || pad >= 16) return pattern;
      const hits = pattern.hits.filter((hit) => hit.step !== step || hit.pad !== pad);
      return { ...pattern, hits: velocity > 0 ? [...hits, { step, pad, velocity: clamp(velocity, 0, 1) }] : hits };
    }),
  };
}

export function duplicatePattern(project: StudioProject, patternId: string): StudioProject {
  const source = project.patterns.find((pattern) => pattern.id === patternId);
  return source ? { ...project, patterns: [...project.patterns, { ...source, id: studioId('pattern'), name: `${source.name} Copy`, hits: source.hits.map((hit) => ({ ...hit })) }] } : project;
}

export function addDrumClip(project: StudioProject, trackId: string, patternId: string, kitId: string, startBeat: number): StudioProject {
  const pattern = project.patterns.find((item) => item.id === patternId);
  if (!pattern || !project.kits.some((kit) => kit.id === kitId)) return project;
  const clip: StudioDrumClip = { id: studioId('drum-clip'), patternId, kitId, startBeat: Math.max(0, Math.round(startBeat)), lengthBeats: pattern.bars * 4 };
  return { ...project, tracks: project.tracks.map((track) => track.id === trackId ? { ...track, drumClips: [...track.drumClips, clip] } : track) };
}

export function drumEvents(project: StudioProject): Array<{ trackId: string; clipId: string; pad: number; beat: number; velocity: number; kit: StudioDrumKit }> {
  const events: Array<{ trackId: string; clipId: string; pad: number; beat: number; velocity: number; kit: StudioDrumKit }> = [];
  for (const track of project.tracks) for (const clip of track.drumClips) {
    const pattern = project.patterns.find((item) => item.id === clip.patternId);
    const kit = project.kits.find((item) => item.id === clip.kitId);
    if (!pattern || !kit) continue;
    const patternBeats = pattern.bars * 4;
    for (let offset = 0; offset < clip.lengthBeats; offset += patternBeats) for (const hit of pattern.hits) {
      const beat = clip.startBeat + offset + hit.step * 0.25 + (hit.step % 2 ? pattern.swing * 0.125 : 0);
      if (beat < clip.startBeat + clip.lengthBeats) events.push({ trackId: track.id, clipId: clip.id, pad: hit.pad, beat, velocity: hit.velocity, kit });
    }
  }
  return events;
}

function sanitizeMidiClip(raw: unknown): StudioMidiClip | null {
  if (!raw || typeof raw !== 'object') return null;
  const clip = raw as Partial<StudioMidiClip>;
  return {
    id: typeof clip.id === 'string' && clip.id ? clip.id : studioId('midi'),
    name: typeof clip.name === 'string' ? clip.name : 'Melody',
    startBeat: Number.isFinite(clip.startBeat) ? Math.max(0, clip.startBeat!) : 0,
    lengthBeats: Number.isFinite(clip.lengthBeats) ? Math.max(0.25, clip.lengthBeats!) : 4,
    notes: Array.isArray(clip.notes) ? clip.notes.map(sanitizeNote).filter((note): note is StudioNote => note !== null) : [],
  };
}

function sanitizeDrumClip(raw: unknown): StudioDrumClip | null {
  if (!raw || typeof raw !== 'object') return null;
  const clip = raw as Partial<StudioDrumClip>;
  if (typeof clip.patternId !== 'string' || typeof clip.kitId !== 'string') return null;
  return {
    id: typeof clip.id === 'string' && clip.id ? clip.id : studioId('drum-clip'),
    patternId: clip.patternId,
    kitId: clip.kitId,
    startBeat: Number.isFinite(clip.startBeat) ? Math.max(0, clip.startBeat!) : 0,
    lengthBeats: Number.isFinite(clip.lengthBeats) ? Math.max(0.25, clip.lengthBeats!) : 4,
  };
}

function sanitizePattern(raw: unknown): StudioDrumPattern | null {
  if (!raw || typeof raw !== 'object') return null;
  const pattern = raw as Partial<StudioDrumPattern>;
  const bars = Number.isFinite(pattern.bars) ? Math.round(clamp(pattern.bars!, 1, 4)) : 1;
  return {
    id: typeof pattern.id === 'string' && pattern.id ? pattern.id : studioId('pattern'),
    name: typeof pattern.name === 'string' ? pattern.name : 'Pattern',
    bars,
    swing: Number.isFinite(pattern.swing) ? clamp(pattern.swing!, 0, 0.75) : 0,
    hits: Array.isArray(pattern.hits) ? pattern.hits.flatMap((hit) =>
      Number.isInteger(hit?.step) && hit.step >= 0 && hit.step < bars * 16 &&
      Number.isInteger(hit?.pad) && hit.pad >= 0 && hit.pad < 16
        ? [{ step: hit.step, pad: hit.pad, velocity: Number.isFinite(hit.velocity) ? clamp(hit.velocity, 0, 1) : 0.8 }]
        : []) : [],
  };
}

function sanitizeKit(raw: unknown): StudioDrumKit | null {
  if (!raw || typeof raw !== 'object') return null;
  const kit = raw as Partial<StudioDrumKit>;
  if (!Array.isArray(kit.pads) || kit.pads.length !== 16) return null;
  return {
    id: typeof kit.id === 'string' && kit.id ? kit.id : studioId('kit'),
    name: typeof kit.name === 'string' ? kit.name : 'Kit',
    palette: ['core', 'rust', 'neon', 'custom'].includes(kit.palette ?? '') ? kit.palette! : 'custom',
    pads: kit.pads.map((pad, index) => ({
      name: typeof pad?.name === 'string' ? pad.name : `Pad ${index + 1}`,
      ...(typeof pad?.sourceId === 'string' ? { sourceId: pad.sourceId } : {}),
      trimStartSeconds: Number.isFinite(pad?.trimStartSeconds) ? Math.max(0, pad.trimStartSeconds) : 0,
      trimEndSeconds: Number.isFinite(pad?.trimEndSeconds) ? Math.max(0, pad.trimEndSeconds) : 0,
      tuneSemitones: Number.isFinite(pad?.tuneSemitones) ? clamp(pad.tuneSemitones, -24, 24) : 0,
      gain: Number.isFinite(pad?.gain) ? clamp(pad.gain, 0, 2) : 1,
      chokeGroup: Number.isFinite(pad?.chokeGroup) ? Math.round(clamp(pad.chokeGroup, 0, 8)) : 0,
    })),
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
    midiClips: Array.isArray(track.midiClips)
      ? track.midiClips.map(sanitizeMidiClip).filter((clip): clip is StudioMidiClip => clip !== null)
      : [],
    drumClips: Array.isArray(track.drumClips)
      ? track.drumClips.map(sanitizeDrumClip).filter((clip): clip is StudioDrumClip => clip !== null)
      : [],
    effects: Array.isArray(track.effects)
      ? track.effects.map(sanitizeEffect).filter((effect): effect is StudioEffect => effect !== null)
      : [],
    // Spread rather than assigning undefined: an explicit `undefined` key is
    // dropped by JSON.stringify, so a track carrying one is not identical to
    // itself after a save and load.
    ...(typeof track.instrumentId === 'string' && track.instrumentId
      ? { instrumentId: track.instrumentId }
      : {}),
    notes: Array.isArray(track.notes)
      ? track.notes.map(sanitizeNote).filter((note): note is StudioNote => note !== null)
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
  for (const track of tracks) {
    if (track.notes.length === 0) continue;
    const first = Math.floor(Math.min(...track.notes.map((note) => note.startBeat)) / 4) * 4;
    const last = Math.max(...track.notes.map((note) => note.startBeat + note.lengthBeats));
    track.midiClips.push({
      id: studioId('midi'), name: 'Imported notes', startBeat: first,
      lengthBeats: Math.max(4, Math.ceil((last - first) / 4) * 4),
      notes: track.notes.map((note) => ({ ...note, startBeat: note.startBeat - first })),
    });
    track.notes = [];
  }
  return {
    version: STUDIO_PROJECT_VERSION,
    name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Untitled',
    bpm: clampBpm(parsed.bpm),
    beatsPerBar:
      typeof parsed.beatsPerBar === 'number' && parsed.beatsPerBar >= 1
        ? Math.round(parsed.beatsPerBar)
        : BEATS_PER_BAR,
    tracks: tracks.length > 0 ? tracks : createProject().tracks,
    patterns: Array.isArray(parsed.patterns) ? parsed.patterns.map(sanitizePattern).filter((pattern): pattern is StudioDrumPattern => pattern !== null) : [createPattern()],
    kits: Array.isArray(parsed.kits) ? parsed.kits.map(sanitizeKit).filter((kit): kit is StudioDrumKit => kit !== null) : [createBuiltinKit('core'), createBuiltinKit('rust'), createBuiltinKit('neon')],
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

/* ------------------------------------------------------------------ */
/* Edits                                                               */
/* ------------------------------------------------------------------ */

/**
 * Every edit is a pure function returning a new project.
 *
 * The UI therefore never hand-rolls a spread over nested arrays -- which is
 * where "I moved a fader and it wiped my clips" bugs come from -- and each edit
 * is testable without React or an audio context.
 */

export function updateTrack(
  project: StudioProject,
  trackId: string,
  patch: Partial<Omit<StudioTrack, 'id' | 'clips'>>,
): StudioProject {
  return {
    ...project,
    tracks: project.tracks.map((track) => (track.id === trackId ? { ...track, ...patch } : track)),
  };
}

export function addTrack(project: StudioProject, name?: string): StudioProject {
  return {
    ...project,
    tracks: [...project.tracks, createTrack(name ?? `Track ${project.tracks.length + 1}`)],
  };
}

/** Removing the last track is refused: a project with no tracks has no UI. */
export function removeTrack(project: StudioProject, trackId: string): StudioProject {
  if (project.tracks.length <= 1) return project;
  return { ...project, tracks: project.tracks.filter((track) => track.id !== trackId) };
}

export function addClip(
  project: StudioProject,
  trackId: string,
  clip: Omit<StudioClip, 'id'>,
): StudioProject {
  const withId: StudioClip = { ...clip, id: studioId('clip'), sourceOffsetSeconds: clip.sourceOffsetSeconds ?? 0, gain: clip.gain ?? 1, fadeInSeconds: clip.fadeInSeconds ?? 0, fadeOutSeconds: clip.fadeOutSeconds ?? 0 };
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === trackId ? { ...track, clips: [...track.clips, withId] } : track,
    ),
  };
}

export function removeClip(project: StudioProject, clipId: string): StudioProject {
  return {
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => clip.id !== clipId),
      midiClips: track.midiClips.filter((clip) => clip.id !== clipId),
      drumClips: track.drumClips.filter((clip) => clip.id !== clipId),
    })),
  };
}

export function duplicateClip(project: StudioProject, clipId: string): StudioProject {
  return {
    ...project,
    tracks: project.tracks.map((track) => {
      const audio = track.clips.find((clip) => clip.id === clipId);
      if (audio) return { ...track, clips: [...track.clips, { ...audio, id: studioId('clip'), startBeat: audio.startBeat + audio.lengthBeats }] };
      const midi = track.midiClips.find((clip) => clip.id === clipId);
      if (midi) return { ...track, midiClips: [...track.midiClips, { ...midi, id: studioId('midi'), startBeat: midi.startBeat + midi.lengthBeats, notes: midi.notes.map((note) => ({ ...note, id: studioId('note') })) }] };
      const drum = track.drumClips.find((clip) => clip.id === clipId);
      return drum ? { ...track, drumClips: [...track.drumClips, { ...drum, id: studioId('drum-clip'), startBeat: drum.startBeat + drum.lengthBeats }] } : track;
    }),
  };
}

export function trimAudioClip(project: StudioProject, clipId: string, edge: 'start' | 'end', amountBeats: number): StudioProject {
  const delta = Math.round(amountBeats * 4) / 4;
  return { ...project, tracks: project.tracks.map((track) => ({ ...track, clips: track.clips.map((clip) => {
    if (clip.id !== clipId) return clip;
    if (edge === 'start') {
      const cut = clamp(delta, -Math.min(clip.startBeat, (clip.sourceOffsetSeconds ?? 0) / secondsPerBeat(project.bpm)), clip.lengthBeats - 0.25);
      return { ...clip, startBeat: clip.startBeat + cut, lengthBeats: clip.lengthBeats - cut, sourceOffsetSeconds: Math.max(0, (clip.sourceOffsetSeconds ?? 0) + cut * secondsPerBeat(project.bpm)) };
    }
    return { ...clip, lengthBeats: Math.max(0.25, clip.lengthBeats + delta) };
  }) })) };
}

export function splitAudioClip(project: StudioProject, clipId: string, atBeat: number): StudioProject {
  return { ...project, tracks: project.tracks.map((track) => ({ ...track, clips: track.clips.flatMap((clip) => {
    if (clip.id !== clipId || atBeat <= clip.startBeat || atBeat >= clip.startBeat + clip.lengthBeats) return [clip];
    const leftLength = Math.round((atBeat - clip.startBeat) * 4) / 4;
    if (leftLength <= 0 || leftLength >= clip.lengthBeats) return [clip];
    return [
      { ...clip, lengthBeats: leftLength },
      { ...clip, id: studioId('clip'), startBeat: clip.startBeat + leftLength, lengthBeats: clip.lengthBeats - leftLength, sourceOffsetSeconds: (clip.sourceOffsetSeconds ?? 0) + leftLength * secondsPerBeat(project.bpm) },
    ];
  }) })) };
}

export function patchAudioClip(project: StudioProject, clipId: string, patch: Pick<Partial<StudioClip>, 'gain' | 'fadeInSeconds' | 'fadeOutSeconds'>): StudioProject {
  return { ...project, tracks: project.tracks.map((track) => ({ ...track, clips: track.clips.map((clip) => clip.id === clipId ? {
    ...clip,
    ...(patch.gain !== undefined ? { gain: clamp(patch.gain, 0, 2) } : {}),
    ...(patch.fadeInSeconds !== undefined ? { fadeInSeconds: Math.max(0, patch.fadeInSeconds) } : {}),
    ...(patch.fadeOutSeconds !== undefined ? { fadeOutSeconds: Math.max(0, patch.fadeOutSeconds) } : {}),
  } : clip) })) };
}

/**
 * Moves a clip, optionally to a different track.
 *
 * `startBeat` is snapped to whole beats and floored at zero: a clip dragged
 * before the start of the song would otherwise schedule at a negative time,
 * which the transport silently never fires.
 */
export function moveClip(
  project: StudioProject,
  clipId: string,
  startBeat: number,
  toTrackId?: string,
): StudioProject {
  let moving: StudioClip | undefined;
  const without = project.tracks.map((track) => {
    const found = track.clips.find((clip) => clip.id === clipId);
    if (!found) return track;
    moving = { ...found, startBeat: Math.max(0, Math.round(startBeat * 4) / 4) };
    return { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) };
  });
  if (!moving) {
    const source = project.tracks.find((track) => track.midiClips.some((clip) => clip.id === clipId) || track.drumClips.some((clip) => clip.id === clipId));
    if (!source) return project;
    const destination = toTrackId ?? source.id;
    const midi = source.midiClips.find((clip) => clip.id === clipId);
    const drum = source.drumClips.find((clip) => clip.id === clipId);
    return { ...project, tracks: project.tracks.map((track) => ({
      ...track,
      midiClips: [...track.midiClips.filter((clip) => clip.id !== clipId), ...(track.id === destination && midi ? [{ ...midi, startBeat: Math.max(0, Math.round(startBeat * 4) / 4) }] : [])],
      drumClips: [...track.drumClips.filter((clip) => clip.id !== clipId), ...(track.id === destination && drum ? [{ ...drum, startBeat: Math.max(0, Math.round(startBeat * 4) / 4) }] : [])],
    })) };
  }

  const targetId = toTrackId ?? project.tracks.find((t) => t.clips.some((c) => c.id === clipId))?.id;
  return {
    ...project,
    tracks: without.map((track) =>
      track.id === targetId ? { ...track, clips: [...track.clips, moving!] } : track,
    ),
  };
}

/** Solo is exclusive-toggle: soloing a track clears any other. */
export function toggleSolo(project: StudioProject, trackId: string): StudioProject {
  const target = project.tracks.find((track) => track.id === trackId);
  const next = !(target?.soloed ?? false);
  return {
    ...project,
    tracks: project.tracks.map((track) => ({ ...track, soloed: track.id === trackId ? next : false })),
  };
}

export function addEffect(project: StudioProject, trackId: string, effectId: string, params: Record<string, number>): StudioProject {
  const effect: StudioEffect = { id: studioId('effect'), effectId, params };
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === trackId ? { ...track, effects: [...track.effects, effect] } : track,
    ),
  };
}

export function removeEffect(project: StudioProject, trackId: string, effectInstanceId: string): StudioProject {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === trackId
        ? { ...track, effects: track.effects.filter((effect) => effect.id !== effectInstanceId) }
        : track,
    ),
  };
}

export function setEffectParam(
  project: StudioProject,
  trackId: string,
  effectInstanceId: string,
  paramId: string,
  value: number,
): StudioProject {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id !== trackId
        ? track
        : {
            ...track,
            effects: track.effects.map((effect) =>
              effect.id === effectInstanceId
                ? { ...effect, params: { ...effect.params, [paramId]: clamp(value, 0, 1) } }
                : effect,
            ),
          },
    ),
  };
}

/* --- instrument tracks ------------------------------------------------ */

/** Turns a track into an instrument track, or back into an audio track. */
export function setTrackInstrument(
  project: StudioProject,
  trackId: string,
  instrumentId: string | undefined,
): StudioProject {
  return {
    ...project,
    tracks: project.tracks.map((track) => (track.id === trackId ? { ...track, instrumentId } : track)),
  };
}

export function addNote(project: StudioProject, trackId: string, note: Omit<StudioNote, 'id'>): StudioProject {
  const withId: StudioNote = { ...note, id: studioId('note'), startBeat: Math.max(0, Math.round(note.startBeat * 4) / 4) };
  return {
    ...project,
    tracks: project.tracks.map((track) => {
      if (track.id !== trackId) return track;
      const target = track.midiClips.find((clip) => withId.startBeat >= clip.startBeat && withId.startBeat < clip.startBeat + clip.lengthBeats);
      if (target) return { ...track, midiClips: track.midiClips.map((clip) => clip.id === target.id ? {
        ...clip,
        lengthBeats: Math.max(clip.lengthBeats, Math.ceil((withId.startBeat + withId.lengthBeats - clip.startBeat) / 4) * 4),
        notes: [...clip.notes, { ...withId, startBeat: withId.startBeat - clip.startBeat }],
      } : clip) };
      const first = Math.floor(withId.startBeat / 4) * 4;
      const midiClip: StudioMidiClip = { id: studioId('midi'), name: 'Melody', startBeat: first, lengthBeats: Math.max(4, Math.ceil((withId.startBeat + withId.lengthBeats - first) / 4) * 4), notes: [{ ...withId, startBeat: withId.startBeat - first }] };
      return { ...track, midiClips: [...track.midiClips, midiClip] };
    }),
  };
}

export function flattenTrackNotes(track: StudioTrack): StudioNote[] {
  return [
    ...track.notes,
    ...track.midiClips.flatMap((clip) => clip.notes.map((note) => ({ ...note, startBeat: note.startBeat + clip.startBeat }))),
  ];
}

export function patchNote(project: StudioProject, trackId: string, noteId: string, patch: Pick<Partial<StudioNote>, 'lengthBeats' | 'velocity'>): StudioProject {
  const edit = (note: StudioNote) => note.id === noteId ? {
    ...note,
    ...(patch.lengthBeats !== undefined ? { lengthBeats: Math.max(0.25, Math.round(patch.lengthBeats * 4) / 4) } : {}),
    ...(patch.velocity !== undefined ? { velocity: clamp(patch.velocity, 0, 1) } : {}),
  } : note;
  return { ...project, tracks: project.tracks.map((track) => track.id === trackId ? {
    ...track, notes: track.notes.map(edit), midiClips: track.midiClips.map((clip) => {
      const notes = clip.notes.map(edit);
      const last = Math.max(clip.lengthBeats, ...notes.map((note) => note.startBeat + note.lengthBeats));
      return { ...clip, lengthBeats: Math.ceil(last / 4) * 4, notes };
    }),
  } : track) };
}

export function quantizeTrackNotes(project: StudioProject, trackId: string, grid = 0.25): StudioProject {
  const snap = (beat: number) => Math.max(0, Math.round(beat / grid) * grid);
  return { ...project, tracks: project.tracks.map((track) => track.id === trackId ? {
    ...track,
    notes: track.notes.map((note) => ({ ...note, startBeat: snap(note.startBeat) })),
    midiClips: track.midiClips.map((clip) => ({ ...clip, notes: clip.notes.map((note) => ({ ...note, startBeat: snap(note.startBeat) })) })),
  } : track) };
}

export function removeNote(project: StudioProject, trackId: string, noteId: string): StudioProject {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === trackId ? { ...track, notes: track.notes.filter((note) => note.id !== noteId), midiClips: track.midiClips.map((clip) => ({ ...clip, notes: clip.notes.filter((note) => note.id !== noteId) })) } : track,
    ),
  };
}

/**
 * Moves a note. Pitch snaps to a semitone and start to the given grid, because
 * a piano roll that lets a note land between semitones is not a piano roll.
 */
export function moveNote(
  project: StudioProject,
  trackId: string,
  noteId: string,
  pitch: number,
  startBeat: number,
  snapBeats = 0.25,
): StudioProject {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id !== trackId
        ? track
        : {
            ...track,
            notes: track.notes.map((note) =>
              note.id !== noteId
                ? note
                : {
                    ...note,
                    pitch: Math.round(clamp(pitch, 0, 127)),
                    startBeat: Math.max(0, Math.round(startBeat / snapBeats) * snapBeats),
                  },
            ),
            midiClips: track.midiClips.map((clip) => {
              if (!clip.notes.some((note) => note.id === noteId)) return clip;
              const absolute = Math.max(0, Math.round(startBeat / snapBeats) * snapBeats);
              const newStart = Math.min(clip.startBeat, absolute);
              const shift = clip.startBeat - newStart;
              const notes = clip.notes.map((note) => note.id === noteId
                ? { ...note, pitch: Math.round(clamp(pitch, 0, 127)), startBeat: absolute - newStart }
                : { ...note, startBeat: note.startBeat + shift });
              const end = Math.max(clip.startBeat + clip.lengthBeats, absolute + (clip.notes.find((note) => note.id === noteId)?.lengthBeats ?? 1));
              return { ...clip, startBeat: newStart, lengthBeats: Math.ceil((end - newStart) / 4) * 4, notes };
            }),
          },
    ),
  };
}
