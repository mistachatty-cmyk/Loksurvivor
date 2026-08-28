/**
 * How content reacts to the music.
 *
 * Following the repo's load-bearing rule, making a new enemy or area move to
 * the beat is adding a record here (or a `react` array on the def), never
 * editing the simulation loop. The loop reads these declarations; it does not
 * know about any particular enemy.
 *
 * A reaction is read as: "when `source` fires, drive `target` by `amount`".
 * Visual targets are applied in `render/draw.ts` so they can never perturb the
 * simulation; the rest are applied in `engine/world.ts`.
 */

import type { AudioFrame, FrequencyBand } from '@/game/audio/beatBus';

export type ReactionSource =
  /** Every beat. */
  | 'beat'
  /** The first beat of each bar. */
  | 'downbeat'
  /** Any detected transient, on or off the grid. */
  | 'onset'
  /** Continuous -- follows one frequency band's energy. */
  | 'band'
  /** Continuous -- follows broadband loudness. */
  | 'energy';

export type ReactionTarget =
  /** Visual: sprite scale multiplier. */
  | 'scale'
  /** Simulation: movement speed multiplier. */
  | 'speed'
  /** Visual: additive glow around the actor. */
  | 'glow'
  /** Visual: light radius multiplier, for area lights. */
  | 'lightRadius'
  /** Visual: screen shake, added to `World.shake`. */
  | 'shake';

export interface BeatReaction {
  source: ReactionSource;
  target: ReactionTarget;
  /** Required when `source` is `'band'`. */
  band?: FrequencyBand;
  /** Strength at full intensity. Interpretation depends on `target`. */
  amount: number;
  /**
   * Decay time for the edge-triggered sources (`beat`, `downbeat`, `onset`).
   * Ignored by the continuous ones.
   */
  decayMs?: number;
}

/** Visual targets never touch the simulation, so the renderer owns them. */
const VISUAL_TARGETS: ReadonlySet<ReactionTarget> = new Set<ReactionTarget>([
  'scale',
  'glow',
  'lightRadius',
]);

export function isVisualTarget(target: ReactionTarget): boolean {
  return VISUAL_TARGETS.has(target);
}

/**
 * Current 0..1 intensity of one reaction.
 *
 * `pulse` is the shared decaying envelope the world keeps for edge-triggered
 * sources -- see `World.beatPulse` / `World.downbeatPulse` / `World.onsetPulse`.
 * Continuous sources ignore it and read the frame directly.
 */
export function reactionIntensity(
  reaction: BeatReaction,
  frame: AudioFrame,
  pulses: { beat: number; downbeat: number; onset: number },
): number {
  switch (reaction.source) {
    case 'beat':
      return pulses.beat;
    case 'downbeat':
      return pulses.downbeat;
    case 'onset':
      return pulses.onset;
    case 'band':
      return reaction.band ? frame.bands[reaction.band] : 0;
    case 'energy':
      return frame.energy;
    default:
      return 0;
  }
}

/**
 * Total multiplier a set of reactions applies to one target, e.g. 1.18 for a
 * sprite that should be 18% bigger on this frame. Reactions naming a different
 * target are skipped, so a def can carry one flat list.
 */
export function reactionMultiplier(
  reactions: readonly BeatReaction[] | undefined,
  target: ReactionTarget,
  frame: AudioFrame,
  pulses: { beat: number; downbeat: number; onset: number },
): number {
  if (!reactions || reactions.length === 0) return 1;
  let multiplier = 1;
  for (const reaction of reactions) {
    if (reaction.target !== target) continue;
    multiplier += reaction.amount * reactionIntensity(reaction, frame, pulses);
  }
  return multiplier;
}

/* ------------------------------------------------------------------ */
/* Authoring presets                                                   */
/* ------------------------------------------------------------------ */

/**
 * Named reaction sets so content records stay one line. Add a preset here
 * rather than repeating tuning across a dozen enemy defs.
 */
export const REACTION_PRESETS = {
  /** Swells on kick drums. Reads well on big, slow enemies. */
  bassBulge: [
    { source: 'band', band: 'sub', target: 'scale', amount: 0.22 },
    { source: 'band', band: 'sub', target: 'glow', amount: 0.35 },
  ],
  /** A tight snap on every beat. Good for small, twitchy enemies. */
  beatTwitch: [
    { source: 'beat', target: 'scale', amount: 0.14, decayMs: 120 },
  ],
  /** Lunges on the downbeat -- turns a chaser into a metronome. */
  downbeatLunge: [
    { source: 'downbeat', target: 'speed', amount: 0.55, decayMs: 260 },
    { source: 'downbeat', target: 'scale', amount: 0.1, decayMs: 260 },
  ],
  /** Player-side bob. Subtle on purpose; the player sprite is always on screen. */
  playerBob: [
    { source: 'beat', target: 'scale', amount: 0.06, decayMs: 150 },
  ],
  /** Neon and streetlights breathing with the track. */
  neonBreathe: [
    { source: 'energy', target: 'lightRadius', amount: 0.3 },
    { source: 'downbeat', target: 'lightRadius', amount: 0.25, decayMs: 300 },
  ],
} satisfies Record<string, BeatReaction[]>;
