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
      const nowMs = context.currentTime * 1000;
      if (!shouldPlayCue(cueId, nowMs, lastPlayedAtMs.get(cueId), activeVoices)) return;

      const params = resolveSfxParams(cueId, style);
      const pitchMult = onBeat ? ON_BEAT_PITCH_MULT : 1;
      const gainMult = onBeat ? ON_BEAT_GAIN_MULT : 1;
      const durationSec = params.durationMs / 1000;
      const peak = Math.max(0.0001, Math.min(1, params.gain * gainMult));

      try {
        const now = context.currentTime;

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
