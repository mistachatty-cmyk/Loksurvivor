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
 * Players can force animation on from Settings or the title screen when their
 * device's reduced-motion setting is on (some phones and low-power modes turn
 * it on without the player knowing). 'system' follows the device; 'full'
 * always animates. Stored on this device only.
 */
export type MotionMode = 'system' | 'full';
const MOTION_STORAGE_KEY = 'survivor616.motion';
const MOTION_EVENT = 'survivor616:motion-change';

export function getMotionMode(): MotionMode {
  try {
    return window.localStorage.getItem(MOTION_STORAGE_KEY) === 'full' ? 'full' : 'system';
  } catch {
    return 'system';
  }
}

/** Mirrors the mode onto <html data-motion> so CSS can honor it too. */
export function applyMotionMode(mode: MotionMode = getMotionMode()): void {
  if (typeof document === 'undefined') return;
  if (mode === 'full') document.documentElement.setAttribute('data-motion', 'full');
  else document.documentElement.removeAttribute('data-motion');
}

export function setMotionMode(mode: MotionMode): void {
  try {
    window.localStorage.setItem(MOTION_STORAGE_KEY, mode);
  } catch {
    // Storage unavailable -- the choice lasts until reload.
  }
  applyMotionMode(mode);
  window.dispatchEvent(new Event(MOTION_EVENT));
}

/** True when the device asks for reduced motion and the player has not overridden it. */
export const deviceWantsReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reduced motion is checked at call time rather than cached in a module
 * constant — players toggle it mid-session, especially on mobile, and a cached
 * value would strand them until reload.
 */
export const prefersReducedMotion = (): boolean => getMotionMode() !== 'full' && deviceWantsReducedMotion();
