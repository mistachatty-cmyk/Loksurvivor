/**
 * First anime.js usage in this codebase -- deliberately scoped to what
 * anime.js is actually good at (tweening plain numbers) rather than
 * replacing framer-motion, which already handles this project's layout/
 * presence transitions well. See docs/studio-remotion-architecture.md's
 * spirit: add tools beside what's already working, don't rewrite it.
 *
 * Animates a displayed number from its previous value up (or down) to a
 * new target whenever the target changes. Built for reward moments --
 * run-summary stat cards, cred/xp ticking up -- where a number visibly
 * climbing reads as more satisfying than it just appearing.
 */
import { useEffect, useRef, useState } from 'react';
import anime from 'animejs';

export interface UseCountUpOptions {
  /** ms. Defaults to a quick, readable tween -- this is chrome, not a focal animation. */
  durationMs?: number;
  /** Rounds the displayed value. Defaults to whole numbers, which covers every current use (kills, level, cred, seconds). */
  decimals?: number;
  /** Skip the tween and jump straight to `target` -- honor prefers-reduced-motion at the call site. */
  disabled?: boolean;
}

export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { durationMs = 900, decimals = 0, disabled = false } = options;
  const [display, setDisplay] = useState(disabled ? target : 0);
  const valueRef = useRef({ value: disabled ? target : 0 });
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (disabled) {
      valueRef.current.value = target;
      setDisplay(target);
      return;
    }

    // First mount counts up from 0 for the reveal beat; later changes to
    // `target` (e.g. a stat updating in place) tween from wherever the
    // number currently sits instead of resetting to 0.
    const from = hasMountedRef.current ? valueRef.current.value : 0;
    hasMountedRef.current = true;
    valueRef.current.value = from;

    const animation = anime({
      targets: valueRef.current,
      value: target,
      duration: durationMs,
      easing: 'easeOutCubic',
      round: decimals === 0 ? 1 : Math.pow(10, decimals),
      update: () => setDisplay(valueRef.current.value),
    });

    return () => animation.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, decimals, disabled]);

  return display;
}
