/**
 * Gameplay SFX playback -- browser-only, not covered by `node:test` (mirrors
 * `ambience.ts`/`studio/instruments.ts`'s split: pure cue data in
 * `sfxCues.ts`, actual Web Audio node creation here).
 *
 * Raw Web Audio, not Tone.js: these are cheap one-shot blips fired at
 * gameplay-event frequency, not instrument tracks, so the lighter API (and
 * `ambience.ts`'s already-proven "asset-free procedural" idiom) is the
 * better fit. Reuses the app's one shared `AudioContext` -- see
 * `studio-engine.md`'s "one AudioContext, always" rule -- and never opens
 * its own. SFX is decoration, never a hard dependency: every node operation
 * is guarded, and a null/closed context degrades to a silent no-op engine.
 */

import {
  resolveSfxParams,
  shouldPlayCue,
  ON_BEAT_GAIN_MULT,
  ON_BEAT_PITCH_MULT,
  type SfxCueId,
  type SfxStyleDef,
} from './sfxCues';
import { sfxVolumeGain } from '@/game/state/audioLevelSettings';

export interface SfxEngine {
  play(cueId: SfxCueId, style: SfxStyleDef, onBeat: boolean): void;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

/** Bus level -- kept modest so gameplay SFX sit under the player's own soundtrack, same philosophy `ambience.ts` states for its bed. */
const SFX_MASTER_GAIN = 0.5;

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Synthesizes an expressive cat meow in Web Audio using formant filtering and pitch envelopes. */
function playMeowVoice(
  context: AudioContext,
  master: GainNode,
  cueId: SfxCueId,
  pitchMult: number,
  gainMult: number,
  now: number,
  onEnded: () => void,
) {
  // Determine duration and pitch contour tuned to the specific gameplay cue
  let baseFreq = 420 * pitchMult;
  let peakFreq = 780 * pitchMult;
  let endFreq = 480 * pitchMult;
  let duration = 0.22;
  let volume = 0.22 * gainMult;

  if (cueId === 'hit') {
    baseFreq = 500 * pitchMult;
    peakFreq = 720 * pitchMult;
    endFreq = 550 * pitchMult;
    duration = 0.12;
    volume = 0.18 * gainMult;
  } else if (cueId === 'critHit') {
    baseFreq = 620 * pitchMult;
    peakFreq = 960 * pitchMult;
    endFreq = 650 * pitchMult;
    duration = 0.18;
    volume = 0.25 * gainMult;
  } else if (cueId === 'kill') {
    baseFreq = 440 * pitchMult;
    peakFreq = 880 * pitchMult;
    endFreq = 340 * pitchMult;
    duration = 0.26;
    volume = 0.26 * gainMult;
  } else if (cueId === 'bossKill') {
    baseFreq = 320 * pitchMult;
    peakFreq = 820 * pitchMult;
    endFreq = 260 * pitchMult;
    duration = 0.55;
    volume = 0.32 * gainMult;
  } else if (cueId === 'playerHurt' || cueId === 'playerDown') {
    baseFreq = 580 * pitchMult;
    peakFreq = 480 * pitchMult;
    endFreq = 280 * pitchMult;
    duration = 0.28;
    volume = 0.24 * gainMult;
  } else if (cueId === 'levelUp') {
    baseFreq = 523 * pitchMult;
    peakFreq = 1046 * pitchMult;
    endFreq = 784 * pitchMult;
    duration = 0.42;
    volume = 0.28 * gainMult;
  } else if (cueId.startsWith('pickup') || cueId === 'speedTally') {
    baseFreq = 700 * pitchMult;
    peakFreq = 980 * pitchMult;
    endFreq = 840 * pitchMult;
    duration = 0.10;
    volume = 0.16 * gainMult;
  } else if (cueId === 'uiClick' || cueId === 'uiNav') {
    baseFreq = 650 * pitchMult;
    peakFreq = 850 * pitchMult;
    endFreq = 700 * pitchMult;
    duration = 0.08;
    volume = 0.14 * gainMult;
  } else if (cueId === 'dash') {
    baseFreq = 400 * pitchMult;
    peakFreq = 850 * pitchMult;
    endFreq = 620 * pitchMult;
    duration = 0.15;
    volume = 0.2 * gainMult;
  }

  const osc = context.createOscillator();
  osc.type = 'triangle';

  // Meow pitch trajectory: starts with rising glide ("m-ee-"), then gently bends down ("-oww")
  const riseTime = duration * 0.4;
  osc.frequency.setValueAtTime(Math.max(40, baseFreq), now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, peakFreq), now + riseTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);

  // Formant filter (cat mouth envelope)
  const formant = context.createBiquadFilter();
  formant.type = 'bandpass';
  formant.Q.value = 3.2;
  formant.frequency.setValueAtTime(Math.max(200, baseFreq * 1.8), now);
  formant.frequency.exponentialRampToValueAtTime(Math.max(200, peakFreq * 2.2), now + riseTime);
  formant.frequency.exponentialRampToValueAtTime(Math.max(200, endFreq * 1.5), now + duration);

  // Subtle purr modulation
  const purrOsc = context.createOscillator();
  const purrGain = context.createGain();
  purrOsc.frequency.value = 24; // 24Hz purr rumble
  purrGain.gain.value = 18;
  purrOsc.connect(osc.frequency);
  purrOsc.start(now);
  purrOsc.stop(now + duration + 0.05);

  const gain = context.createGain();
  const attack = Math.min(0.025, duration * 0.25);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(formant).connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + duration + 0.03);

  osc.onended = () => {
    try {
      osc.disconnect();
      formant.disconnect();
      gain.disconnect();
      purrGain.disconnect();
      purrOsc.disconnect();
    } catch {
      // Ignored
    }
    onEnded();
  };
}

const NOOP_ENGINE: SfxEngine = {
  play() {},
  setEnabled() {},
  dispose() {},
};

/**
 * Creates a one-shot SFX engine bound to `context`. Pass the app's shared
 * context from `useMusicPlayer().ensureAudioContext()` -- never construct a
 * new `AudioContext` for this. Returns a safe no-op engine when `context` is
 * null (audio unavailable, or not yet unlocked by a user gesture).
 */
export function createSfxEngine(context: AudioContext | null): SfxEngine {
  if (!context) return NOOP_ENGINE;

  let enabled = true;
  let activeVoices = 0;
  const lastPlayedAtMs = new Map<SfxCueId, number>();

  let master: GainNode | null;
  try {
    master = context.createGain();
    master.gain.value = SFX_MASTER_GAIN;
    master.connect(context.destination);
  } catch {
    return NOOP_ENGINE;
  }

  return {
    play(cueId, style, onBeat) {
      if (!enabled || context.state === 'closed' || !master) return;
      master.gain.value = SFX_MASTER_GAIN * sfxVolumeGain();
      const nowMs = context.currentTime * 1000;
      if (!shouldPlayCue(cueId, nowMs, lastPlayedAtMs.get(cueId), activeVoices)) return;

      const pitchMult = onBeat ? ON_BEAT_PITCH_MULT : 1;
      const gainMult = onBeat ? ON_BEAT_GAIN_MULT : 1;

      try {
        const now = context.currentTime;

        if (style.meowMode || cueId === 'meow') {
          activeVoices += 1;
          playMeowVoice(
            context,
            master,
            cueId,
            style.pitchMult * pitchMult,
            style.brightnessMult * gainMult,
            now,
            () => {
              activeVoices = Math.max(0, activeVoices - 1);
            },
          );
          lastPlayedAtMs.set(cueId, nowMs);
          return;
        }

        const params = resolveSfxParams(cueId, style);
        const durationSec = params.durationMs / 1000;
        const peak = Math.max(0.0001, Math.min(1, params.gain * gainMult));

        const osc = context.createOscillator();
        osc.type = params.wave;
        const freqEnd = params.freqEnd ?? params.freqStart;
        osc.frequency.setValueAtTime(Math.max(20, params.freqStart * pitchMult), now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd * pitchMult), now + durationSec);

        const voiceGain = context.createGain();
        const attack = Math.min(0.012, durationSec * 0.3);
        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.exponentialRampToValueAtTime(peak, now + attack);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
        osc.connect(voiceGain).connect(master);
        osc.start(now);
        osc.stop(now + durationSec + 0.02);

        activeVoices += 1;
        osc.onended = () => {
          activeVoices = Math.max(0, activeVoices - 1);
          try {
            osc.disconnect();
            voiceGain.disconnect();
          } catch {
            // Already torn down with the context.
          }
        };

        if (params.noiseMix && params.noiseMix > 0) {
          const noise = context.createBufferSource();
          noise.buffer = noiseBuffer(context, durationSec);
          const noiseFilter = context.createBiquadFilter();
          noiseFilter.type = 'bandpass';
          noiseFilter.frequency.value = Math.max(200, params.freqStart);
          const noiseGain = context.createGain();
          const noisePeak = Math.max(0.0001, peak * params.noiseMix);
          noiseGain.gain.setValueAtTime(0.0001, now);
          noiseGain.gain.exponentialRampToValueAtTime(noisePeak, now + 0.005);
          noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
          noise.connect(noiseFilter).connect(noiseGain).connect(master);
          noise.start(now);
          noise.stop(now + durationSec + 0.02);
          noise.onended = () => {
            try {
              noise.disconnect();
              noiseFilter.disconnect();
              noiseGain.disconnect();
            } catch {
              // Already torn down with the context.
            }
          };
        }

        lastPlayedAtMs.set(cueId, nowMs);
      } catch {
        // A dropped cue is not worth tearing the engine down for.
      }
    },
    setEnabled(next) {
      enabled = next;
    },
    dispose() {
      try {
        master?.disconnect();
      } catch {
        // Already torn down with the context.
      }
      master = null;
    },
  };
}
