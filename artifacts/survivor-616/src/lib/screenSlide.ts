/**
 * Page order for the nav dock and the rules for sliding between pages. Pure and DOM-free so the
 * direction and swipe decisions are unit-tested; `ui/ScreenSlide.tsx` is the thin React shell.
 */

export interface DockPage {
  id: string;
  /** Screen names that count as being on this page (a page can own a few related screens). */
  screens: readonly string[];
}

/** Left-to-right order of the pages in the nav dock. Swiping walks this list. */
export const DOCK_PAGES: readonly DockPage[] = [
  { id: 'hub', screens: ['hub'] },
  { id: 'areas', screens: ['areas'] },
  { id: 'roster', screens: ['roster'] },
  { id: 'card-shop', screens: ['card-shop', 'vendor', 'workshop'] },
  { id: 'inventory', screens: ['inventory'] },
  { id: 'lok-shop', screens: ['lok-shop'] },
  { id: 'settings', screens: ['settings'] },
];

export function pageScreens(id: string): string[] {
  return [...(DOCK_PAGES.find((page) => page.id === id)?.screens ?? [id])];
}

/** Index of the dock page a screen belongs to, or -1 when it is not a dock page. */
export function dockIndexFor(screenName: string): number {
  return DOCK_PAGES.findIndex((page) => page.screens.includes(screenName));
}

export type SlideKind = 'none' | 'next' | 'prev' | 'rise';

/** Screens drawn on a canvas or that own the whole viewport: never wrapped in an animation. */
const NO_SLIDE_SCREENS = new Set(['run', 'arena', 'sector-command', 'lokpet-battle', 'weapon-training-arena', 'map-editor', 'studio', 'jukebox']);

/** How the new screen should arrive: from the right (further along the dock), the left (back), or a soft rise. */
export function slideKind(from: string, to: string): SlideKind {
  if (from === to) return 'none';
  if (NO_SLIDE_SCREENS.has(to) || NO_SLIDE_SCREENS.has(from)) return 'none';
  const a = dockIndexFor(from);
  const b = dockIndexFor(to);
  if (a >= 0 && b >= 0 && a !== b) return b > a ? 'next' : 'prev';
  return 'rise';
}

export interface SwipeSample {
  dx: number;
  dy: number;
  ms: number;
}

export const SWIPE_MIN_DISTANCE = 72;
export const SWIPE_MAX_MS = 700;
/** The swipe must be at least this much more sideways than vertical, so scrolling never turns pages. */
export const SWIPE_AXIS_RATIO = 1.8;

/** The dock page a finger swipe should open, or null when it is not a deliberate sideways swipe. */
export function swipeTargetId(screenName: string, swipe: SwipeSample): string | null {
  const index = dockIndexFor(screenName);
  if (index < 0) return null;
  const { dx, dy, ms } = swipe;
  if (ms > SWIPE_MAX_MS || Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(dx) < Math.abs(dy) * SWIPE_AXIS_RATIO) return null;
  // Finger moving left pulls the next page in from the right.
  const next = DOCK_PAGES[index + (dx < 0 ? 1 : -1)];
  return next ? next.id : null;
}
