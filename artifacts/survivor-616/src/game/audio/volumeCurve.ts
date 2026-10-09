/**
 * Soundbar volume helpers. Audio volume is linear, so the quiet end of a plain
 * slider is far too touchy. The slider position is squared on the way in and
 * square-rooted on the way out so each step sounds about as big as the last.
 */
export const VOLUME_STORAGE_KEY = 'survivor616.music.volume';

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export function sliderToVolume(position: number): number {
  const p = clamp01(position);
  return p * p;
}

export function volumeToSlider(volume: number): number {
  return Math.sqrt(clamp01(volume));
}

/** Slider position (0..1) for a pointer x inside a track's bounding box. */
export function positionFromPointer(clientX: number, left: number, width: number): number {
  if (width <= 0) return 0;
  return clamp01((clientX - left) / width);
}

export interface StoredVolume {
  volume: number;
  muted: boolean;
}

export const DEFAULT_VOLUME: StoredVolume = { volume: 0.7, muted: false };

/** Parses the saved value; anything unreadable falls back to the default. */
export function parseStoredVolume(raw: string | null): StoredVolume {
  if (!raw) return DEFAULT_VOLUME;
  try {
    const data = JSON.parse(raw) as Partial<StoredVolume> | null;
    if (!data || typeof data.volume !== 'number' || !Number.isFinite(data.volume)) return DEFAULT_VOLUME;
    return { volume: clamp01(data.volume), muted: data.muted === true };
  } catch {
    return DEFAULT_VOLUME;
  }
}
