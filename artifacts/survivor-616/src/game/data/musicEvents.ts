/**
 * Music-driven gameplay events: a threshold on the currently-playing
 * soundtrack's loudness/frequency-band energy (see `audio/beatBus.ts`)
 * triggers a one-shot spawn/palette action during a run.
 *
 * This is deliberately separate from `data/reactivity.ts`'s `BeatReaction`,
 * which drives *continuous* per-actor multipliers (speed, sprite scale).
 * These are *discrete*, edge/threshold-triggered one-shot actions -- spawn a
 * squad now, burst enemies now, shift the palette now -- consulted through
 * `applyMusicEvents` in `engine/world.ts`, the one seam that ever reads them.
 *
 * Never touches audio/music playback itself -- only gameplay/visual state.
 */

import type { FrequencyBand } from '@/game/audio/beatBus';
import type { WaveDef } from '@/game/types';

export interface MusicEventTrigger {
  source: 'band' | 'energy';
  /** Required when source is 'band'. */
  band?: FrequencyBand;
  /** 0..1; fires once intensity reaches this, subject to `cooldownMs`. */
  threshold: number;
  /** Minimum time between firings of this event. */
  cooldownMs: number;
}

export type MusicEventEffect =
  | { kind: 'squad'; factionId: string; formation?: NonNullable<WaveDef['formation']>; hpMult?: number }
  | { kind: 'burst'; enemyId: string; count: number; formation?: NonNullable<WaveDef['formation']>; hpMult?: number }
  /** Resolved against `THEMED_PALETTES` (data/themedPalettes.ts) -- reuses the existing named-palette registry rather than a new authoring surface. */
  | { kind: 'palette'; paletteId: string };

export interface MusicSpawnEvent {
  id: string;
  trigger: MusicEventTrigger;
  effect: MusicEventEffect;
}
