/**
 * The studio's audio engine.
 *
 * Framework-free on purpose -- no React imports -- so the graph outlives any
 * particular screen and can be driven from tests. `useStudio` is the only
 * bridge between this and the UI.
 *
 * The one rule that matters here: **there is exactly one `AudioContext` in the
 * app**. The soundtrack player creates it lazily on first playback and exposes
 * it via `getAudioContext()`; Tone adopts that. Two contexts fight over the
 * output device, and mobile Safari suspends one of them without warning. When
 * the player has not unlocked a context yet, Tone creates its own and the
 * player adopts *that* instead -- either way there is one.
 */

import * as Tone from 'tone';

/** Master output level, before the analyser tap. */
const DEFAULT_MASTER_GAIN = 0.85;
/**
 * Matches `analysis.ts` so studio playback and soundtrack playback are analysed
 * identically -- the game must not react differently to the same audio.
 */
const ANALYSER_FFT_SIZE = 1024;

export interface StudioEngine {
  readonly context: AudioContext;
  /** Everything audible routes through here. */
  readonly master: Tone.Gain;
  /** Tap for visualisers and for the shared beat analysis. */
  readonly analyser: AnalyserNode;
  dispose(): void;
}

let engine: StudioEngine | null = null;

/**
 * Builds the engine, adopting `existing` when one is supplied.
 *
 * Idempotent: calling it again returns the engine already built. Callers that
 * need a genuinely fresh graph must `disposeStudioEngine()` first.
 */
export function getStudioEngine(existing?: AudioContext | null): StudioEngine {
  if (engine) return engine;

  if (existing) {
    // Wrap, do not replace: Tone drives the context the rest of the app is
    // already playing through.
    Tone.setContext(new Tone.Context({ context: existing }));
  }

  const context = Tone.getContext().rawContext as unknown as AudioContext;
  const master = new Tone.Gain(DEFAULT_MASTER_GAIN);
  const analyser = context.createAnalyser();
  analyser.fftSize = ANALYSER_FFT_SIZE;

  // master -> analyser -> speakers. The analyser is a pass-through, so the tap
  // costs nothing audible.
  master.connect(Tone.getDestination());
  Tone.connect(master, analyser);

  engine = {
    context,
    master,
    analyser,
    dispose() {
      master.dispose();
      analyser.disconnect();
      engine = null;
    },
  };
  return engine;
}

/** The engine if one has been built, without building one. */
export function peekStudioEngine(): StudioEngine | null {
  return engine;
}

export function disposeStudioEngine(): void {
  engine?.dispose();
  engine = null;
}

/**
 * Browsers only start audio from inside a user gesture. Safe to call on every
 * transport start -- it resolves immediately once running.
 */
export async function unlockStudioAudio(): Promise<void> {
  if (Tone.getContext().state !== 'running') await Tone.start();
}

/**
 * Lower latency for live playing, higher for stable arrangement playback.
 * Tone's default lookahead is generous; playing pads through it feels laggy.
 */
export function setLiveLatencyMode(live: boolean): void {
  Tone.getContext().lookAhead = live ? 0.01 : 0.1;
}
