/**
 * Playable instruments, as records.
 *
 * Same rule the rest of the project follows: adding an instrument is adding an
 * entry here, never editing the pad grid or the keyboard. Each record owns its
 * own construction, so a new voice cannot require a change anywhere else.
 *
 * The synths are deliberately gritty rather than clean -- this is a studio
 * inside a beat-em-up set in a city at night, and a pristine grand piano would
 * sound like it wandered in from another application.
 */

import * as Tone from 'tone';

export type InstrumentKind = 'melodic' | 'drum';

export interface InstrumentDef {
  id: string;
  label: string;
  kind: InstrumentKind;
  /** Short description shown under the instrument picker. */
  blurb: string;
  /** Pads/keys are laid out from these notes. Drums map one pad per note. */
  notes: readonly string[];
  /** Labels shown on the pads, parallel to `notes`. Melodic voices use `notes`. */
  padLabels?: readonly string[];
  create(): Tone.PolySynth | Tone.Sampler | Tone.NoiseSynth | Tone.MembraneSynth;
}

/** Two octaves of C major, the default melodic layout. */
const C_MAJOR_TWO_OCTAVES = [
  'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4',
  'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5',
] as const;

/** A minor pentatonic is hard to play a wrong note on -- good for a first pad. */
const MINOR_PENTATONIC = [
  'C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4', 'F4',
  'G4', 'Bb4', 'C5', 'Eb5', 'F5', 'G5', 'Bb5', 'C6',
] as const;

export const INSTRUMENTS: readonly InstrumentDef[] = [
  {
    id: 'neon-keys',
    label: 'Neon Keys',
    kind: 'melodic',
    blurb: 'Detuned saw pad. Sits under everything.',
    notes: C_MAJOR_TWO_OCTAVES,
    create: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 28 },
        // Slow attack so held chords swell rather than stab.
        envelope: { attack: 0.04, decay: 0.3, sustain: 0.5, release: 1.1 },
        volume: -14,
      }),
  },
  {
    id: 'basement-bass',
    label: 'Basement Bass',
    kind: 'melodic',
    blurb: 'Round sub bass. Play low and slow.',
    notes: ['C1', 'D1', 'E1', 'F1', 'G1', 'A1', 'B1', 'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3'],
    create: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.4 },
        volume: -8,
      }),
  },
  {
    id: 'street-lead',
    label: 'Street Lead',
    kind: 'melodic',
    blurb: 'FM lead with bite. Cuts through a busy mix.',
    notes: MINOR_PENTATONIC,
    create: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2.5,
        modulationIndex: 8,
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.6 },
        volume: -16,
      }),
  },
  {
    id: 'block-kit',
    label: 'Block Kit',
    kind: 'drum',
    blurb: 'Membrane drums. Tuned low to high across the pads.',
    // A membrane synth is pitched, so a "kit" is one voice across pitches --
    // cheap, and it keeps every pad on a single disposable node.
    notes: ['C1', 'E1', 'G1', 'C2', 'E2', 'G2', 'C3', 'E3'],
    padLabels: ['Kick', 'Kick+', 'Tom', 'Tom+', 'Rim', 'Rim+', 'Tick', 'Tick+'],
    create: () =>
      new Tone.MembraneSynth({
        pitchDecay: 0.03,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.9 },
        volume: -8,
      }),
  },
  {
    id: 'static-kit',
    label: 'Static Kit',
    kind: 'drum',
    blurb: 'Noise percussion. Hats, claps and sweeps.',
    notes: ['C2', 'C2', 'C2', 'C2', 'C2', 'C2', 'C2', 'C2'],
    padLabels: ['Hat', 'Hat+', 'Clap', 'Snare', 'Shake', 'Sweep', 'Crash', 'Noise'],
    create: () =>
      new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
        volume: -20,
      }),
  },
] as const;

export const DEFAULT_INSTRUMENT_ID = INSTRUMENTS[0]!.id;

export function findInstrument(id: string): InstrumentDef {
  return INSTRUMENTS.find((instrument) => instrument.id === id) ?? INSTRUMENTS[0]!;
}

/**
 * Triggers one voice.
 *
 * Exists because `NoiseSynth` takes no pitch while the others require one, and
 * every caller would otherwise repeat that branch. Called straight from a
 * pointer handler, so it must never allocate or await.
 */
export function triggerInstrument(
  voice: ReturnType<InstrumentDef['create']>,
  note: string,
  duration: Tone.Unit.Time = '8n',
  time?: number,
): void {
  if (voice instanceof Tone.NoiseSynth) {
    voice.triggerAttackRelease(duration, time);
    return;
  }
  voice.triggerAttackRelease(note, duration, time);
}
