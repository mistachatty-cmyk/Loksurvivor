/**
 * Motion tokens for the anime.js chrome layer.
 *
 * One place for durations and easings so the level-up flash, a loot pop, and
 * the hub nav all move like the same hand drew them. Framer-motion keeps its
 * own values where it already lives — this layer is additive, exactly as the
 * count-up pass was.
 */

/** Matches the spring feel used across Lok UI. */
export const EASE = {
  /** Arrivals: fast in, long settle. */
  out: 'cubicBezier(0.16, 1, 0.3, 1)',
  /** Departures and flashes: quick and unsentimental. */
  sharp: 'cubicBezier(0.4, 0, 0.2, 1)',
  /** Overshoot, for the one moment that earns it. */
  pop: 'cubicBezier(0.34, 1.56, 0.64, 1)',
} as const;

export const DUR = {
  flash: 420,
  pop: 260,
  nav: 380,
  navStagger: 45,
} as const;

/**
 * Reduced motion is checked at call time rather than cached in a module
 * constant — players toggle it mid-session, especially on mobile, and a cached
 * value would strand them until reload.
 *
 * Also honors the in-game "Reduce motion" override (Settings -> PC & Browser),
 * applied as a `force-reduce-motion` class on `<html>` by `App.tsx` -- the OS
 * setting stays the primary source of truth, this is just an escape hatch on
 * top of it for a player whose OS setting doesn't reflect their preference.
 * `document` doesn't exist under this file's plain `node:test` suite (no
 * jsdom), so that half is guarded the same way the `window` check already is.
 */
export const prefersReducedMotion = (): boolean =>
  (typeof document !== 'undefined' && document.documentElement.classList.contains('force-reduce-motion')) ||
  (typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
