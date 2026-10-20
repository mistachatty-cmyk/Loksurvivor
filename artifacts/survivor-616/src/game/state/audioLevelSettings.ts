/**
 * Device-local volume for the two synthesized layers the player can't reach
 * from anywhere else: gameplay sound effects and the hideout's room ambience.
 * Stored as whole percentages (0-100). The default of 100 keeps the loudness
 * these layers had before the sliders existed.
 */
const SFX_KEY = 'survivor616.sfxVolume';
const AMBIENCE_KEY = 'survivor616.ambienceVolume';
const DEFAULT_PERCENT = 100;

/** Pure parser so the stored string can be checked without a browser. */
export function parseVolumePercent(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw.trim() === '') return DEFAULT_PERCENT;
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_PERCENT;
  return Math.round(Math.max(0, Math.min(100, value)));
}

function readPercent(key: string): number {
  try {
    return parseVolumePercent(window.localStorage.getItem(key));
  } catch {
    return DEFAULT_PERCENT;
  }
}

function writePercent(key: string, percent: number): void {
  try {
    window.localStorage.setItem(key, String(percent));
  } catch {
    // Storage unavailable -- the choice lasts until reload.
  }
}

// Read once and kept in memory: the SFX engine asks on every cue.
let sfxPercent: number | null = null;
let ambiencePercent: number | null = null;

export function getSfxVolumePercent(): number {
  sfxPercent ??= readPercent(SFX_KEY);
  return sfxPercent;
}

export function setSfxVolumePercent(percent: number): void {
  sfxPercent = parseVolumePercent(String(percent));
  writePercent(SFX_KEY, sfxPercent);
}

export function getAmbienceVolumePercent(): number {
  ambiencePercent ??= readPercent(AMBIENCE_KEY);
  return ambiencePercent;
}

export function setAmbienceVolumePercent(percent: number): void {
  ambiencePercent = parseVolumePercent(String(percent));
  writePercent(AMBIENCE_KEY, ambiencePercent);
}

/** Multiplier in 0..1 for the audio graph. */
export function sfxVolumeGain(): number {
  return getSfxVolumePercent() / 100;
}

export function ambienceVolumeGain(): number {
  return getAmbienceVolumePercent() / 100;
}
