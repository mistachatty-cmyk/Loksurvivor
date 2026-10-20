/**
 * Text size preference. Scales the root font size, so every rem-based size in the
 * UI (most Tailwind utilities) grows with it. Stored on this device only.
 */
export type TextSize = 'small' | 'normal' | 'large' | 'xlarge';

export const TEXT_SIZES: readonly TextSize[] = ['small', 'normal', 'large', 'xlarge'];
const KEY = 'survivor616.text-size';
const PERCENT: Record<TextSize, number> = { small: 90, normal: 100, large: 115, xlarge: 130 };

export function getTextSize(): TextSize {
  try {
    const value = window.localStorage.getItem(KEY);
    return TEXT_SIZES.includes(value as TextSize) ? (value as TextSize) : 'normal';
  } catch {
    return 'normal';
  }
}

export function applyTextSize(size: TextSize = getTextSize()): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = size === 'normal' ? '' : `${PERCENT[size]}%`;
}

export function setTextSize(size: TextSize): void {
  try {
    window.localStorage.setItem(KEY, size);
  } catch {
    // Storage unavailable -- the choice lasts until reload.
  }
  applyTextSize(size);
}
