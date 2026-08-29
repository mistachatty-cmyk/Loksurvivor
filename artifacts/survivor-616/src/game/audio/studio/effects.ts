/**
 * Insert effects, as records.
 *
 * Each entry owns its construction and declares the one or two parameters
 * worth exposing -- a full parameter tree per effect would be a worse UI than
 * no effect at all on a phone, which is the screen this has to work on.
 *
 * `set(node, value)` is what makes a slider generic: the UI moves a 0..1
 * number and the record decides what that means, so no component ever needs to
 * know a reverb has `decay` and a filter has `frequency`.
 */

import * as Tone from 'tone';

export interface EffectParam {
  id: string;
  label: string;
  /** Normalised 0..1, so every control is the same slider. */
  defaultValue: number;
  set(node: Tone.ToneAudioNode, value: number): void;
}

export interface EffectDef {
  id: string;
  label: string;
  blurb: string;
  create(): Tone.ToneAudioNode;
  params: readonly EffectParam[];
}

/** Maps 0..1 onto a range, exponentially where the ear hears it that way. */
function lerp(value: number, min: number, max: number): number {
  return min + (max - min) * Math.max(0, Math.min(1, value));
}
function expLerp(value: number, min: number, max: number): number {
  return min * (max / min) ** Math.max(0, Math.min(1, value));
}

export const EFFECTS: readonly EffectDef[] = [
  {
    id: 'reverb',
    label: 'Reverb',
    blurb: 'Room and space.',
    create: () => new Tone.Reverb({ decay: 2.4, wet: 0.3 }),
    params: [
      {
        id: 'wet',
        label: 'Amount',
        defaultValue: 0.3,
        set: (node, value) => ((node as Tone.Reverb).wet.value = value),
      },
      {
        id: 'decay',
        label: 'Size',
        defaultValue: 0.4,
        // Reverb rebuilds its impulse response on decay changes, which is why
        // this is a coarse range rather than something to sweep live.
        set: (node, value) => ((node as Tone.Reverb).decay = lerp(value, 0.3, 8)),
      },
    ],
  },
  {
    id: 'delay',
    label: 'Delay',
    blurb: 'Echo, synced to the grid.',
    create: () => new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.35, wet: 0.3 }),
    params: [
      {
        id: 'wet',
        label: 'Amount',
        defaultValue: 0.3,
        set: (node, value) => ((node as Tone.FeedbackDelay).wet.value = value),
      },
      {
        id: 'feedback',
        label: 'Repeats',
        defaultValue: 0.35,
        // Capped below 1: feedback at or above unity never decays and the
        // track climbs to full scale on its own.
        set: (node, value) => ((node as Tone.FeedbackDelay).feedback.value = lerp(value, 0, 0.85)),
      },
    ],
  },
  {
    id: 'filter',
    label: 'Filter',
    blurb: 'Open or close the top end.',
    create: () => new Tone.Filter({ frequency: 8000, type: 'lowpass', rolloff: -24 }),
    params: [
      {
        id: 'frequency',
        label: 'Cutoff',
        defaultValue: 1,
        // Exponential: pitch is logarithmic, so a linear sweep spends most of
        // its travel in the top octave where nothing much happens.
        set: (node, value) => ((node as Tone.Filter).frequency.value = expLerp(value, 120, 16_000)),
      },
      {
        id: 'q',
        label: 'Resonance',
        defaultValue: 0.1,
        set: (node, value) => ((node as Tone.Filter).Q.value = lerp(value, 0, 12)),
      },
    ],
  },
  {
    id: 'distortion',
    label: 'Distortion',
    blurb: 'Dirt and drive.',
    create: () => new Tone.Distortion({ distortion: 0.4, wet: 0.5 }),
    params: [
      {
        id: 'distortion',
        label: 'Drive',
        defaultValue: 0.4,
        set: (node, value) => ((node as Tone.Distortion).distortion = value),
      },
      {
        id: 'wet',
        label: 'Mix',
        defaultValue: 0.5,
        set: (node, value) => ((node as Tone.Distortion).wet.value = value),
      },
    ],
  },
  {
    id: 'chorus',
    label: 'Chorus',
    blurb: 'Width and shimmer.',
    create: () => new Tone.Chorus({ frequency: 1.5, depth: 0.6, wet: 0.4 }).start(),
    params: [
      {
        id: 'depth',
        label: 'Depth',
        defaultValue: 0.6,
        set: (node, value) => ((node as Tone.Chorus).depth = value),
      },
      {
        id: 'wet',
        label: 'Mix',
        defaultValue: 0.4,
        set: (node, value) => ((node as Tone.Chorus).wet.value = value),
      },
    ],
  },
  {
    id: 'crusher',
    label: 'Bitcrush',
    blurb: 'Downsampled and broken.',
    create: () => new Tone.BitCrusher({ bits: 6 }),
    params: [
      {
        id: 'bits',
        label: 'Bits',
        defaultValue: 0.5,
        // Inverted: moving the slider up should sound like more effect, and
        // fewer bits is more crush.
        set: (node, value) => ((node as Tone.BitCrusher).bits.value = Math.round(lerp(1 - value, 1, 16))),
      },
      {
        id: 'wet',
        label: 'Mix',
        defaultValue: 1,
        set: (node, value) => ((node as Tone.BitCrusher).wet.value = value),
      },
    ],
  },
] as const;

export function findEffect(id: string): EffectDef | undefined {
  return EFFECTS.find((effect) => effect.id === id);
}
