/**
 * Dampen to filter settings.
 *
 * The Jukebox muffles the music with a low-pass filter and, as it opens up,
 * gives the low end a small lift. The numbers are starting values to tune by
 * ear; they live here, in one place, so every Lok app hears the same thing.
 *
 *   lowpass Hz = 20000 * 0.5 ^ (dampen * 1.2)   (about 1.1 kHz at 3.5, 5.7 kHz at 1.5, 20 kHz at 0)
 *   bass shelf = 4 dB * (1 - dampen / 3.5)       (0 dB at dampen 3.5, +4 dB at 0)
 */

export const OPEN_HZ = 20000;
export const MIN_HZ = 120;
export const MAX_DAMPEN = 6;
export const MAX_BASS_DB = 4;
/** Seconds constant for `AudioParam.setTargetAtTime`: about 1.8 s to settle. */
export const TONE_RAMP_SECONDS = 0.6;

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

export function dampenToTone(dampen) {
  const d = clamp(Number.isFinite(dampen) ? dampen : 0, 0, MAX_DAMPEN);
  const lowpassHz = clamp(Math.round(OPEN_HZ * Math.pow(0.5, d * 1.2)), MIN_HZ, OPEN_HZ);
  const bassDb = Math.round(MAX_BASS_DB * (1 - clamp(d / 3.5, 0, 1)) * 100) / 100;
  return { lowpassHz, bassDb };
}

/** The filter state that changes nothing you can hear. */
export const TRANSPARENT_TONE = Object.freeze({ lowpassHz: OPEN_HZ, bassDb: 0 });
