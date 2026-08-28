/**
 * Publishes the studio transport's grid onto the beat bus.
 *
 * This is the payoff of the whole audio architecture: when the studio is the
 * thing making sound, the game stops *guessing* the tempo and is handed the
 * truth. Nothing downstream changes -- the bus already ranks `'studio'` above
 * `'detected'`, so every reaction written against detection starts running on a
 * perfect grid the moment the transport rolls.
 *
 * Two details carry the whole thing:
 *
 * `Tone.Draw` is why audio and canvas stay locked. Transport callbacks fire
 * ahead of real time (that lookahead is what makes scheduling sample-accurate),
 * so publishing straight from one would flash the game's beat reactions ~100ms
 * before the sound arrives. `Draw.schedule` holds the visual side until the
 * frame whose wall-clock actually matches.
 *
 * Beat position is read from the transport's own tick counter rather than
 * counted up per callback. A dropped or coalesced draw would desynchronise a
 * counter permanently; ticks are the transport's ground truth and cannot drift.
 */

import * as Tone from 'tone';

import { beatBus } from '@/game/audio/beatBus';

/** Silence: the studio publishes a grid, not spectrum. */
const NO_BANDS = Object.freeze({ sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0 });

let repeatId: number | null = null;
let beatsPerBarSetting = 4;

/** Whether the studio currently drives the bus. */
export function studioClockRunning(): boolean {
  return repeatId !== null;
}

/**
 * Starts publishing an exact grid, one frame per quarter note.
 *
 * Idempotent -- starting an already-running clock is a no-op rather than a
 * second subscription, which would double every beat reaction in the game.
 */
export function startStudioClock(beatsPerBar = 4): void {
  if (repeatId !== null) return;
  beatsPerBarSetting = beatsPerBar;

  const transport = Tone.getTransport();

  repeatId = transport.scheduleRepeat((time) => {
    // Resolve position at the scheduled audio time, not at draw time.
    const beat = transport.getTicksAtTime(time) / transport.PPQ;
    const beatIndex = Math.round(beat);
    const bpm = transport.bpm.getValueAtTime(time);

    Tone.getDraw().schedule(() => {
      beatBus.publish(
        {
          bpm,
          // The grid is authored, not inferred: there is nothing to doubt.
          confidence: 1,
          beat: beatIndex,
          bar: beatIndex / beatsPerBarSetting,
          phase: 0,
          beatIndex,
          downbeat: beatIndex % beatsPerBarSetting === 0,
          energy: 0,
          bands: NO_BANDS,
          onset: false,
        },
        'studio',
      );
    }, time);
  }, '4n');
}

/**
 * Advances `phase` between beats.
 *
 * The quarter-note callback alone would step the bus once per beat, and every
 * continuous reaction reading `phase` would stutter at 1-4Hz instead of moving.
 * The run loop calls this once per rendered frame to fill in the gap, which is
 * cheap: it reads a clock and republishes the same frame with a new phase.
 */
export function tickStudioClock(): void {
  if (repeatId === null) return;
  const transport = Tone.getTransport();
  if (transport.state !== 'started') return;

  const beat = transport.ticks / transport.PPQ;
  const beatIndex = Math.floor(beat);
  beatBus.publish(
    {
      bpm: transport.bpm.value,
      confidence: 1,
      beat,
      bar: beat / beatsPerBarSetting,
      phase: beat - beatIndex,
      beatIndex,
      // Edge flags belong to the scheduled callback, which knows exactly when
      // the beat lands; a polled frame would re-raise them for several frames.
      downbeat: false,
      onset: false,
    },
    'studio',
  );
}

/**
 * Stops publishing and hands the bus back, so live detection of whatever the
 * soundtrack player is doing takes over again.
 */
export function stopStudioClock(): void {
  if (repeatId !== null) {
    Tone.getTransport().clear(repeatId);
    repeatId = null;
  }
  // Drop anything Draw is still holding, or a queued beat would publish after
  // the release and strand the bus with a stale studio frame.
  Tone.getDraw().cancel();
  beatBus.release('studio');
}
