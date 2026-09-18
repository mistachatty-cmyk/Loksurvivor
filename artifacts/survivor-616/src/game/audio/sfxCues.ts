/**
 * Gameplay SFX cue data.
 *
 * Pure content and pure logic only -- no `AudioContext`, no `tone` import --
 * so this module runs under the plain `node:test` suite (mirrors the
 * pure/live split `audio/studio/studio.test.ts` establishes: data here,
 * actual Web Audio node creation in `sfxEngine.ts`, untested by design).
 *
 * `SFX_CUE_BASE` is the "what does a level-up actually sound like" content,
 * one entry per event -- same role `BedProfile`/`WEATHER_BEDS` play in
 * `ambience.ts`. A purchasable sound pack (`soundPacks.ts`) never redefines
 * these; it only supplies an `SfxStyleDef`, a small fixed set of knobs that
 * reskin every cue uniformly (mirrors `palette(seed)`'s "4 colors that
 * actually vary" idea in `data/authoring.ts`), so adding a new `SfxCueId`
 * later never means re-authoring every pack.
 */

export type SfxCueId =
  | 'hit'
  | 'critHit'
  | 'kill'
  | 'bossKill'
  | 'playerHurt'
  | 'playerDown'
  | 'extraLifeSave'
  | 'levelUp'
  | 'pickupXp'
  | 'pickupCred'
  | 'pickupHealth'
  | 'pickupKey'
  | 'lootBox'
  | 'cardPack'
  | 'dash'
  | 'ultimate'
  | 'waveStart'
  | 'bossWarning'
  | 'obstacleBreak'
  | 'uiClick'
  | 'uiNav'
  | 'purchase'
  | 'purchaseFail'
  | 'lowHealth';

/** One `sfxEvents` entry the sim pushes; drained and played once per rendered frame. */
export interface SfxEvent {
  cue: SfxCueId;
  /** Landed on the beat -- see `isOnBeat(w)` in `engine/world.ts`. Bonus only, never a penalty. */
  onBeat: boolean;
}

export interface SfxCueBaseParams {
  wave: OscillatorType;
  /** Starting frequency, Hz. */
  freqStart: number;
  /** Ending frequency for a pitch sweep, Hz. Defaults to `freqStart` (no sweep). */
  freqEnd?: number;
  durationMs: number;
  /** Peak gain, 0..1. */
  gain: number;
  /** 0..1 white noise blended under the tone -- impacts/breaks read grittier with it. */
  noiseMix?: number;
}

export const SFX_CUE_BASE: Record<SfxCueId, SfxCueBaseParams> = {
  hit: { wave: 'square', freqStart: 220, freqEnd: 140, durationMs: 55, gain: 0.16, noiseMix: 0.25 },
  critHit: { wave: 'square', freqStart: 340, freqEnd: 160, durationMs: 80, gain: 0.22, noiseMix: 0.35 },
  kill: { wave: 'sawtooth', freqStart: 260, freqEnd: 60, durationMs: 140, gain: 0.2, noiseMix: 0.2 },
  bossKill: { wave: 'sawtooth', freqStart: 180, freqEnd: 40, durationMs: 520, gain: 0.3, noiseMix: 0.3 },
  playerHurt: { wave: 'triangle', freqStart: 180, freqEnd: 90, durationMs: 120, gain: 0.22, noiseMix: 0.3 },
  playerDown: { wave: 'sawtooth', freqStart: 220, freqEnd: 40, durationMs: 700, gain: 0.28 },
  extraLifeSave: { wave: 'triangle', freqStart: 440, freqEnd: 880, durationMs: 420, gain: 0.24 },
  levelUp: { wave: 'triangle', freqStart: 440, freqEnd: 990, durationMs: 320, gain: 0.24 },
  pickupXp: { wave: 'sine', freqStart: 660, freqEnd: 880, durationMs: 70, gain: 0.12 },
  pickupCred: { wave: 'sine', freqStart: 520, freqEnd: 780, durationMs: 90, gain: 0.14 },
  pickupHealth: { wave: 'sine', freqStart: 392, freqEnd: 523, durationMs: 130, gain: 0.16 },
  pickupKey: { wave: 'triangle', freqStart: 587, freqEnd: 880, durationMs: 160, gain: 0.18 },
  lootBox: { wave: 'sawtooth', freqStart: 300, freqEnd: 700, durationMs: 260, gain: 0.22 },
  cardPack: { wave: 'triangle', freqStart: 500, freqEnd: 750, durationMs: 200, gain: 0.2 },
  dash: { wave: 'sine', freqStart: 900, freqEnd: 300, durationMs: 110, gain: 0.14, noiseMix: 0.15 },
  ultimate: { wave: 'sawtooth', freqStart: 120, freqEnd: 480, durationMs: 480, gain: 0.3, noiseMix: 0.2 },
  waveStart: { wave: 'square', freqStart: 220, freqEnd: 330, durationMs: 260, gain: 0.2 },
  bossWarning: { wave: 'square', freqStart: 160, freqEnd: 110, durationMs: 460, gain: 0.26, noiseMix: 0.15 },
  obstacleBreak: { wave: 'square', freqStart: 150, freqEnd: 60, durationMs: 160, gain: 0.2, noiseMix: 0.5 },
  uiClick: { wave: 'sine', freqStart: 720, freqEnd: 640, durationMs: 35, gain: 0.1 },
  uiNav: { wave: 'sine', freqStart: 520, freqEnd: 660, durationMs: 60, gain: 0.11 },
  purchase: { wave: 'triangle', freqStart: 600, freqEnd: 900, durationMs: 180, gain: 0.18 },
  purchaseFail: { wave: 'square', freqStart: 220, freqEnd: 140, durationMs: 140, gain: 0.16 },
  lowHealth: { wave: 'sine', freqStart: 220, freqEnd: 220, durationMs: 90, gain: 0.13 },
};

/** The small, fixed set of knobs a purchasable sound pack varies. */
export interface SfxStyleDef {
  /** Overrides every cue's base waveform when set (e.g. an all-square "8-bit" pack). */
  waveOverride?: OscillatorType;
  /** Multiplies every cue's frequency. */
  pitchMult: number;
  /** Multiplies every cue's gain, clamped to 0..1. */
  brightnessMult: number;
  /** Multiplies every cue's noise blend, clamped to 0..1. */
  noiseMult: number;
  /** Multiplies every cue's duration. */
  decayMult: number;
}

/** The neutral style: every purchasable pack is authored as a variation on this. */
export const DEFAULT_SFX_STYLE: SfxStyleDef = {
  pitchMult: 1,
  brightnessMult: 1,
  noiseMult: 1,
  decayMult: 1,
};

/** Small fixed bonus applied to gain/pitch when a cue lands on the beat -- mirrors `ON_BEAT_CRIT_MULT`. Bonus only, never a penalty off-beat. */
export const ON_BEAT_GAIN_MULT = 1.15;
export const ON_BEAT_PITCH_MULT = 1.03;

/** Merges base cue content with a pack's style. Pure -- no audio node created here. */
export function resolveSfxParams(cueId: SfxCueId, style: SfxStyleDef): SfxCueBaseParams {
  const base = SFX_CUE_BASE[cueId];
  const pitch = style.pitchMult;
  const freqEnd = base.freqEnd ?? base.freqStart;
  return {
    wave: style.waveOverride ?? base.wave,
    freqStart: base.freqStart * pitch,
    freqEnd: freqEnd * pitch,
    durationMs: Math.max(10, base.durationMs * style.decayMult),
    gain: Math.max(0, Math.min(1, base.gain * style.brightnessMult)),
    noiseMix:
      base.noiseMix === undefined ? undefined : Math.max(0, Math.min(1, base.noiseMix * style.noiseMult)),
  };
}

/**
 * Minimum ms between two plays of the same cue. A swarm-kill moment (the
 * game routinely runs 850-1000+ simultaneous enemies, see
 * `.agents/memory/swarm-performance-2026-09-12.md`) would otherwise stack
 * hundreds of overlapping oscillators from `hit`/`kill` alone. Cues absent
 * here (level-up, ultimate, wave banners, purchases...) are rare enough to
 * never need throttling.
 */
export const MIN_RETRIGGER_MS: Partial<Record<SfxCueId, number>> = {
  hit: 45,
  critHit: 60,
  kill: 45,
  bossKill: 200,
  obstacleBreak: 70,
  pickupXp: 120,
  pickupCred: 120,
  pickupHealth: 150,
  pickupKey: 150,
  dash: 150,
  lowHealth: 1500,
  uiClick: 40,
  uiNav: 60,
};

/** Hard ceiling on concurrent voices, independent of per-cue throttling -- guards against several *different* cues landing in the same frame. */
export const MAX_CONCURRENT_VOICES = 12;

/**
 * Whether `cueId` is allowed to play right now. Pure -- the caller owns
 * `lastPlayedAtMs`/`activeVoices` bookkeeping (see `sfxEngine.ts`).
 */
export function shouldPlayCue(
  cueId: SfxCueId,
  nowMs: number,
  lastPlayedAtMs: number | undefined,
  activeVoices: number,
): boolean {
  if (activeVoices >= MAX_CONCURRENT_VOICES) return false;
  const minInterval = MIN_RETRIGGER_MS[cueId];
  if (minInterval === undefined || lastPlayedAtMs === undefined) return true;
  return nowMs - lastPlayedAtMs >= minInterval;
}
