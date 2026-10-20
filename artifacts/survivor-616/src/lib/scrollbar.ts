/**
 * Scrollbar preference. The default is a slim, low-profile bar tinted by the
 * active UI theme (CSS reads `--primary`, which every `data-ui-theme` sets).
 * Stored on this device only; mirrored onto <html data-scrollbar / data-scrollbar-tint>.
 */
export type ScrollbarStyle = 'slim' | 'hidden' | 'standard';
export type ScrollbarTint = 'theme' | 'neutral';

const STYLE_KEY = 'survivor616.scrollbar';
const TINT_KEY = 'survivor616.scrollbar-tint';
const CHANGE_EVENT = 'survivor616:scrollbar-change';

const STYLES: readonly ScrollbarStyle[] = ['slim', 'hidden', 'standard'];
const TINTS: readonly ScrollbarTint[] = ['theme', 'neutral'];

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export const getScrollbarStyle = (): ScrollbarStyle => read(STYLE_KEY, STYLES, 'slim');
export const getScrollbarTint = (): ScrollbarTint => read(TINT_KEY, TINTS, 'theme');

export function applyScrollbarPrefs(style = getScrollbarStyle(), tint = getScrollbarTint()): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-scrollbar', style);
  root.setAttribute('data-scrollbar-tint', tint);
}

function save(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable -- the choice lasts until reload.
  }
  applyScrollbarPrefs();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const setScrollbarStyle = (style: ScrollbarStyle): void => save(STYLE_KEY, style);
export const setScrollbarTint = (tint: ScrollbarTint): void => save(TINT_KEY, tint);
export const SCROLLBAR_CHANGE_EVENT = CHANGE_EVENT;
