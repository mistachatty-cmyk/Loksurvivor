/**
 * Hideout room ambience -- optional, procedural, asset-free.
 *
 * Every bed here is synthesized in the browser from noise and a couple of
 * oscillators: no audio files ship for this, nothing is fetched, and it
 * reuses the app's single `AudioContext` (see the studio-engine "one
 * AudioContext, always" rule) rather than opening a second one that iOS
 * would suspend.
 *
 * It is deliberately a *bed*, mixed well under the soundtrack: the player's
 * own music stays the thing you hear. The whole layer is off unless the
 * player turns it on (`meta.hideoutAmbienceEnabled`).
 */

import type { HideoutSceneDef } from '@/game/types';

export interface AmbienceHandle {
  /** 0..1, applied to the whole bed. */
  setLevel: (level: number) => void;
  /** Fades out and releases every node. Safe to call twice. */
  stop: () => void;
}

/** A short looping noise buffer -- the base layer of rain, fog and hiss. */
function noiseBuffer(context: AudioContext, seconds = 2): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

interface BedProfile {
  /** Low-pass cutoff for the noise layer, Hz. Lower reads as further away. */
  cutoffHz: number;
  /** Noise level relative to the bed's own gain. */
  noiseLevel: number;
  /** Optional pitched drone (room tone, pipes, a distant grid hum). */
  droneHz?: number;
  droneLevel?: number;
  /** Mean seconds between one-shot accents (drips, creaks, ticks). 0 = none. */
  accentEverySec?: number;
  accentHz?: number;
  /** A sparse, slow melody of soft notes (Hz) -- the room humming to itself. */
  melody?: { notes: number[]; everySec: number; wave: OscillatorType };
}

/**
 * One profile per hideout weather, with the cellar handled separately below --
 * its "glass heat" room is the one the player is asked to sit and listen in,
 * so it gets more than the shared heat bed.
 */
const WEATHER_BEDS: Record<string, BedProfile> = {
  rain: { melody: { notes: [196, 233.08, 261.63, 311.13, 349.23], everySec: 5.5, wave: 'sine' }, cutoffHz: 2400, noiseLevel: 0.5, accentEverySec: 5.5, accentHz: 1500 },
  fog: { melody: { notes: [146.83, 174.61, 220, 261.63], everySec: 7, wave: 'sine' }, cutoffHz: 480, noiseLevel: 0.32, droneHz: 62, droneLevel: 0.16 },
  heat: { melody: { notes: [220, 277.18, 329.63, 415.3], everySec: 6, wave: 'triangle' }, cutoffHz: 900, noiseLevel: 0.2, droneHz: 96, droneLevel: 0.14 },
  snow: { cutoffHz: 700, noiseLevel: 0.22 },
  clear: { melody: { notes: [174.61, 220, 261.63, 329.63], everySec: 6.5, wave: 'sine' }, cutoffHz: 620, noiseLevel: 0.16, droneHz: 48, droneLevel: 0.12 },
};

/**
 * The cellar's own bed: the pipe hum the room's flavor text keeps promising,
 * plus slow water drips and a soft vinyl crackle for the record grotto.
 */
const CELLAR_BED: BedProfile = {
  melody: { notes: [220, 261.63, 293.66, 392, 440], everySec: 4.5, wave: 'triangle' },
  cutoffHz: 1100,
  noiseLevel: 0.24,
  droneHz: 74,
  droneLevel: 0.2,
  accentEverySec: 3.2,
  accentHz: 820,
};

function bedFor(scene: HideoutSceneDef): BedProfile {
  if (scene.biome === 'cellar') return CELLAR_BED;
  return WEATHER_BEDS[scene.weather] ?? WEATHER_BEDS.clear!;
}

/**
 * Starts a room's ambience bed. Returns null when Web Audio is unavailable or
 * the context is closed -- ambience is decoration, never a hard dependency, so
 * every caller treats null as "no ambience" rather than an error.
 */
export function startHideoutAmbience(
  context: AudioContext | null,
  scene: HideoutSceneDef,
  level: number,
): AmbienceHandle | null {
  if (!context || context.state === 'closed') return null;

  const profile = bedFor(scene);
  let stopped = false;

  try {
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer(context);
    noise.loop = true;
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = profile.cutoffHz;
    const noiseGain = context.createGain();
    noiseGain.gain.value = profile.noiseLevel;
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start();

    let drone: OscillatorNode | null = null;
    if (profile.droneHz) {
      drone = context.createOscillator();
      drone.type = 'sine';
      drone.frequency.value = profile.droneHz;
      const droneGain = context.createGain();
      droneGain.gain.value = profile.droneLevel ?? 0.12;
      drone.connect(droneGain).connect(master);
      drone.start();
    }

    // Accents are scheduled one at a time rather than on an interval, so a
    // backgrounded tab (where timers are throttled) simply gets fewer of
    // them instead of a burst all at once when it comes back.
    let accentTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleAccent = () => {
      if (stopped || !profile.accentEverySec) return;
      const wait = profile.accentEverySec * (0.55 + Math.random() * 0.9) * 1000;
      accentTimer = setTimeout(() => {
        if (stopped || context.state === 'closed') return;
        try {
          const now = context.currentTime;
          const ping = context.createOscillator();
          ping.type = 'sine';
          ping.frequency.setValueAtTime((profile.accentHz ?? 900) * (0.85 + Math.random() * 0.4), now);
          ping.frequency.exponentialRampToValueAtTime(Math.max(80, (profile.accentHz ?? 900) * 0.4), now + 0.18);
          const gain = context.createGain();
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.09, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
          ping.connect(gain).connect(master);
          ping.start(now);
          ping.stop(now + 0.25);
        } catch {
          // A dropped accent is not worth tearing the bed down for.
        }
        scheduleAccent();
      }, wait);
    };
    scheduleAccent();

    // A slow music-box line over the bed. Each note is a soft, quickly decaying
    // pluck, chosen by a small random walk along the room's scale so it wanders
    // instead of looping -- and chained timeouts keep it one note at a time.
    let melodyTimer: ReturnType<typeof setTimeout> | null = null;
    let melodyIndex = 0;
    const scheduleMelody = () => {
      const m = profile.melody;
      if (stopped || !m) return;
      const wait = m.everySec * (0.6 + Math.random() * 1.2) * 1000;
      melodyTimer = setTimeout(() => {
        if (stopped || context.state === 'closed') return;
        try {
          melodyIndex = Math.max(0, Math.min(m.notes.length - 1, melodyIndex + Math.floor(Math.random() * 3) - 1));
          const now = context.currentTime;
          const voice = context.createOscillator();
          voice.type = m.wave;
          voice.frequency.value = m.notes[melodyIndex]!;
          const env = context.createGain();
          env.gain.setValueAtTime(0.0001, now);
          env.gain.exponentialRampToValueAtTime(0.07, now + 0.03);
          env.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
          voice.connect(env).connect(master);
          voice.start(now);
          voice.stop(now + 1.7);
        } catch {
          // A dropped note is not worth tearing the bed down for.
        }
        scheduleMelody();
      }, wait);
    };
    scheduleMelody();

    const setLevel = (next: number) => {
      const clamped = Math.max(0, Math.min(1, next));
      try {
        master.gain.setTargetAtTime(clamped, context.currentTime, 0.4);
      } catch {
        master.gain.value = clamped;
      }
    };
    setLevel(level);

    return {
      setLevel,
      stop: () => {
        if (stopped) return;
        stopped = true;
        if (accentTimer !== null) clearTimeout(accentTimer);
        if (melodyTimer !== null) clearTimeout(melodyTimer);
        try {
          const now = context.currentTime;
          master.gain.setTargetAtTime(0, now, 0.15);
          noise.stop(now + 0.6);
          drone?.stop(now + 0.6);
          setTimeout(() => {
            try {
              master.disconnect();
            } catch {
              // Already torn down with the context.
            }
          }, 900);
        } catch {
          // Context went away underneath us -- nothing left to release.
        }
      },
    };
  } catch {
    return null;
  }
}
