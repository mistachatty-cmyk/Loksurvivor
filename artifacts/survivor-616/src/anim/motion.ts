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
 * Shared motion vocabulary for every layer. Numbers are milliseconds; `ease`
 * holds framer-motion bezier arrays. The same values are mirrored as CSS
 * variables (`--dur-*`, `--ease-*`) in index.css -- keep the two in step.
 */
export const MOTION = {
  dur: { instant: 80, fast: 140, base: 220, slow: 340, hero: 560 },
  ease: {
    out: [0.16, 1, 0.3, 1],
    inOut: [0.4, 0, 0.2, 1],
    pop: [0.34, 1.56, 0.64, 1],
  },
  /** Per-item stagger, capped so long lists never make the last tile wait. */
  stagger: (index: number, step = 0.04, cap = 8): number => Math.min(index, cap) * step,
} as const;

/** framer-motion transition for a panel arriving or leaving, in seconds. */
export const PANEL_TRANSITION = { duration: MOTION.dur.base / 1000, ease: MOTION.ease.out } as const;

/**
 * Players can force animation on from Settings or the title screen when their
 * device's reduced-motion setting is on (some phones and low-power modes turn
 * it on without the player knowing). 'system' follows the device; 'full'
 * always animates. Stored on this device only.
 */
export type MotionMode = 'system' | 'full';
const MOTION_STORAGE_KEY = 'survivor616.motion';
const MOTION_EVENT = 'survivor616:motion-change';
const LIVE_FEED_SEEN_KEY = 'survivor616.live-feed-seen';
let liveFeedMayFollowDevice = true;

/** Give a new device one title-screen preview before its motion preference can pause the feed. */
export function registerLiveFeedLoad(): void {
  if (typeof window === 'undefined') return;
  try {
    liveFeedMayFollowDevice = window.localStorage.getItem(LIVE_FEED_SEEN_KEY) === '1';
    window.localStorage.setItem(LIVE_FEED_SEEN_KEY, '1');
  } catch {
    // With no persistent storage, honor the device's accessibility preference.
    liveFeedMayFollowDevice = true;
  }
}

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

/** The first app load shows the live feed; later loads can honor a device pause request. */
export const liveFeedPausedByDevice = (): boolean => liveFeedMayFollowDevice && prefersReducedMotion();

export type ShakeLevel = 'off' | 'low' | 'normal';
const SHAKE_KEY = 'survivor616.shake';

export function getShakeLevel(): ShakeLevel {
  try {
    const v = window.localStorage.getItem(SHAKE_KEY);
    return v === 'off' || v === 'low' ? v : 'normal';
  } catch {
    return 'normal';
  }
}

export function setShakeLevel(level: ShakeLevel): void {
  try {
    window.localStorage.setItem(SHAKE_KEY, level);
  } catch {
    // Storage unavailable -- the choice lasts until reload.
  }
}

/** Screen-shake strength: 0 for players who want it off or have reduced motion on, else the player's scale. */
export const shakeScale = (): number => {
  if (prefersReducedMotion()) return 0;
  const level = getShakeLevel();
  return level === 'off' ? 0 : level === 'low' ? 0.4 : 1;
};
