/**
 * The musical clock.
 *
 * One module-level singleton every part of the game reads to find out what the
 * music is doing right now. Two very different producers publish into it:
 *
 *   - `analysis.ts` estimates a grid from whatever the soundtrack player is
 *     playing (an imported mp3, a bundled track) -- source `'detected'`.
 *   - the in-game studio, when it exists, publishes its own transport's exact
 *     grid -- source `'studio'`.
 *
 * Consumers never care which. `source` and `confidence` are there so a consumer
 * can decide how hard to lean on the numbers, not so it has to branch on where
 * they came from.
 *
 * Deliberately not React state: this is read once per animation frame by the
 * run loop, and putting it in a context would re-render the tree 60x a second.
 * UI that wants it uses `useAudioFrame()`, which samples at a human rate.
 */

export type FrequencyBand = 'sub' | 'bass' | 'lowMid' | 'mid' | 'high';

export const FREQUENCY_BANDS: readonly FrequencyBand[] = [
  'sub',
  'bass',
  'lowMid',
  'mid',
  'high',
] as const;

export type BeatSource = 'none' | 'detected' | 'studio';

export interface AudioFrame {
  /** Beats per minute, 0 when nothing is playing or tempo is unknown. */
  bpm: number;
  /** 0..1 -- how much to trust `bpm`/`beat`. Always 1 for the studio grid. */
  confidence: number;
  /** Fractional beats since the source started. */
  beat: number;
  /** Fractional bars since the source started (4/4 assumed for detection). */
  bar: number;
  /** 0..1 position within the current beat. */
  phase: number;
  /** Integer beat count -- compare against a stored value to edge-trigger. */
  beatIndex: number;
  /** True only on frames where a bar starts. */
  downbeat: boolean;
  /** Broadband smoothed loudness, 0..1. */
  energy: number;
  /** Per-band smoothed energy, 0..1 each. */
  bands: Readonly<Record<FrequencyBand, number>>;
  /** True on frames where a transient was detected. */
  onset: boolean;
  /**
   * What is playing right now, or null for silence. Published by whichever
   * producer owns the bus so consumers get track identity from the same seam
   * as the beat -- there is deliberately no second way to learn about a track
   * change.
   */
  track: { id: string; title: string } | null;
  source: BeatSource;
}

export const SILENT_FRAME: AudioFrame = Object.freeze({
  bpm: 0,
  confidence: 0,
  beat: 0,
  bar: 0,
  phase: 0,
  beatIndex: 0,
  downbeat: false,
  energy: 0,
  bands: Object.freeze({ sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0 }),
  onset: false,
  track: null,
  source: 'none' as const,
});

type Listener = (frame: AudioFrame) => void;

/**
 * The studio's exact grid outranks detection: once it publishes, detected
 * frames are ignored until the studio explicitly hands control back with
 * `release('studio')`.
 */
const PRIORITY: Record<BeatSource, number> = { none: 0, detected: 1, studio: 2 };

let current: AudioFrame = SILENT_FRAME;
let holder: BeatSource = 'none';
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(current);
}

export const beatBus = {
  /** The latest frame. Cheap enough to call every animation frame. */
  read(): AudioFrame {
    return current;
  },

  /**
   * Merge a partial frame in. A lower-priority source is dropped while a
   * higher-priority one holds the bus, so detection running in the background
   * can never fight the studio's exact grid.
   */
  publish(partial: Partial<AudioFrame>, source: BeatSource): void {
    if (PRIORITY[source] < PRIORITY[holder]) return;
    holder = source;
    current = {
      ...current,
      ...partial,
      bands: partial.bands ? { ...partial.bands } : current.bands,
      source,
    };
    emit();
  },

  /** Hand the bus back. Only the current holder may release it. */
  release(source: BeatSource): void {
    if (holder !== source) return;
    holder = 'none';
    current = SILENT_FRAME;
    emit();
  },

  /** Which source currently owns the bus. */
  owner(): BeatSource {
    return holder;
  },

  /** Notified on every publish. For UI; the run loop polls `read()` instead. */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(current);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Test seam -- drops all state and listeners. */
  reset(): void {
    current = SILENT_FRAME;
    holder = 'none';
    listeners.clear();
  },
};

/**
 * True when `frame` crossed into a new beat since `previousBeatIndex`.
 * The run loop uses this to fire one-shot reactions exactly once per beat even
 * though it may take several fixed-timestep substeps per rendered frame.
 */
export function crossedBeat(frame: AudioFrame, previousBeatIndex: number): boolean {
  return frame.beatIndex > previousBeatIndex;
}

/**
 * How close `frame` sits to the nearest beat, in milliseconds. Used for the
 * on-beat crit window. Returns Infinity when there is no usable tempo.
 */
export function msFromNearestBeat(frame: AudioFrame): number {
  if (frame.bpm <= 0) return Number.POSITIVE_INFINITY;
  const beatMs = 60_000 / frame.bpm;
  const offset = frame.phase <= 0.5 ? frame.phase : 1 - frame.phase;
  return offset * beatMs;
}
