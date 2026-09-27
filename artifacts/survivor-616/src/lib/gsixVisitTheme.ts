import { useSyncExternalStore } from 'react';

/**
 * GSix hands its site theme to games in the link: `?lok_theme=<id>&lok_palette=<7 hex>`
 * (see @lok/skins `withThemeHandoff` in the Gsixhub repo). Here it only recolors the
 * menus for this browser tab. It never unlocks or equips anything in the theme shop,
 * and "Use my Survivor theme" drops it straight away.
 */
export interface VisitTheme {
  id: string;
  colors: { bg: string; ink: string; muted: string; accent: string; accentAlt: string; highlight: string; steel: string };
}

const STORAGE_KEY = 'lok.visitTheme.v1';
const ORDER = ['bg', 'ink', 'muted', 'accent', 'accentAlt', 'highlight', 'steel'] as const;

export function parseVisitTheme(search: string): VisitTheme | null {
  const params = new URLSearchParams(search);
  const id = params.get('lok_theme');
  const parts = params.get('lok_palette')?.split('-') ?? [];
  if (!id || !/^[a-z0-9-]{1,40}$/.test(id)) return null;
  if (parts.length !== ORDER.length || !parts.every((part) => /^[0-9a-f]{6}$/i.test(part))) return null;
  const colors = Object.fromEntries(ORDER.map((key, index) => [key, `#${parts[index]!.toLowerCase()}`])) as VisitTheme['colors'];
  return { id, colors };
}

/** "#ff8a3d" -> "24 100% 62%", the "H S% L%" form the shadcn tokens in index.css use. */
export function hexToHslTriplet(hex: string, lightnessShift = 0): string {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  const hue = Math.round((h * 60 + 360) % 360);
  const light = Math.min(100, Math.max(0, Math.round(l * 100) + lightnessShift));
  return `${hue} ${Math.round(s * 100)}% ${light}%`;
}

/** Inline custom properties; inline style outranks the [data-ui-theme] rules in index.css. */
export function visitThemeStyle(theme: VisitTheme): Record<string, string> {
  const { bg, ink, muted, accent, accentAlt } = theme.colors;
  const surface = hexToHslTriplet(bg, 5);
  const raised = hexToHslTriplet(bg, 9);
  const line = hexToHslTriplet(accentAlt);
  return {
    '--background': hexToHslTriplet(bg),
    '--foreground': hexToHslTriplet(ink),
    '--card': surface,
    '--card-foreground': hexToHslTriplet(ink),
    '--card-border': line,
    '--popover': surface,
    '--popover-foreground': hexToHslTriplet(ink),
    '--popover-border': line,
    '--primary': hexToHslTriplet(accent),
    '--primary-foreground': hexToHslTriplet(bg),
    '--secondary': raised,
    '--secondary-foreground': hexToHslTriplet(ink),
    '--muted': surface,
    '--muted-foreground': hexToHslTriplet(muted),
    '--accent': hexToHslTriplet(accentAlt),
    '--accent-foreground': hexToHslTriplet(accent),
    '--border': line,
    '--input': line,
    '--ring': hexToHslTriplet(accent),
  };
}

let current: VisitTheme | null | undefined;
const listeners = new Set<() => void>();

function read(): VisitTheme | null {
  if (current !== undefined) return current;
  current = null;
  if (typeof window === 'undefined') return current;
  try {
    const fromUrl = parseVisitTheme(window.location.search);
    if (fromUrl) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
      const url = new URL(window.location.href);
      url.searchParams.delete('lok_theme');
      url.searchParams.delete('lok_palette');
      window.history.replaceState(window.history.state, '', url);
      current = fromUrl;
    } else {
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as VisitTheme | null;
      current = stored?.id && stored.colors ? stored : null;
    }
  } catch {
    // Private mode or blocked storage: the game keeps its own theme.
  }
  return current;
}

export function dismissVisitTheme() {
  current = null;
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* nothing stored */ }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useVisitTheme(): VisitTheme | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
