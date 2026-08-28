/**
 * Bridges Tone.Transport → beatBus with exact timing, using Tone.Draw to
 * sync visual events to the RAF frame that matches the audio time.
 *
 * Without Tone.Draw, publishing from the audio callback would fire ~100 ms
 * early (lookahead scheduling), and visuals would run ahead of the audio.
 * Tone.Draw defers until the wall-clock time matches, locking audio and
 * Canvas together at 60 fps.
 *
 * Between beats, RunScreen interpolates `phase` from Transport.seconds so
 * motion is smooth rather than stepping.
 */

import * as Tone from 'tone';
import { beatBus, type AudioFrame } from '@/game/audio/beatBus';
import { BEATS_PER_BAR } from './project';

let scheduledRepeat: NodeJS.Timeout | null = null;
let beatAccumulator = 0;

/**
 * Starts publishing the exact grid to beatBus on every quarter note.
 * Safe to call if already running (idempotent).
 */
export function startStudioClock(bpm: number, beatsPerBar: number): void {
  if (scheduledRepeat !== null) return;

  beatAccumulator = 0;

  // Publish exact frame on every quarter note.
  Tone.Transport.scheduleRepeat((time: number) => {
    Tone.Draw.schedule(() => {
      const beat = beatAccumulator;
      const beatIndex = Math.floor(beat);
      const bar = beat / beatsPerBar;
      const phase = beat - beatIndex;
      const downbeat = beatIndex % beatsPerBar === 0;

      const frame: Partial<AudioFrame> = {
        bpm,
        confidence: 1,
        beat,
        bar,
        phase,
        beatIndex,
        downbeat,
        energy: 0,
        bands: { sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0 },
        onset: false,
        source: 'studio',
      };

      beatBus.publish(frame, 'studio');
      beatAccumulator += 1;
    }, time);
  }, '4n');

  scheduledRepeat = setInterval(() => {
    // Keep the publication alive by re-checking state.
    // This ensures cleanup happens if the transport stops externally.
    if (Tone.getTransport().state === 'stopped') {
      stopStudioClock();
    }
  }, 100);
}

export function stopStudioClock(): void {
  if (scheduledRepeat !== null) {
    clearInterval(scheduledRepeat);
    scheduledRepeat = null;
  }
  Tone.Transport.cancel();
  beatBus.release('studio');
}

/** Current beat phase (0..1 within the current beat) for smooth interpolation. */
export function getStudioPhase(bpm: number): number {
  const transport = Tone.getTransport();
  const secondsPerBeat = 60 / bpm;
  const beat = transport.seconds / secondsPerBeat;
  return beat - Math.floor(beat);
}
