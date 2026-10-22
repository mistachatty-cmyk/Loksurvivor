/**
 * Drives the Jukebox Room's three theater levels from touches. All the timing
 * rules live in `@lok/jukebox`; this hook only owns the clock and the timer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { levelAt, nextChangeIn, type TheaterLevel } from '@lok/jukebox';

export interface UseTheaterLevelOptions {
  paused: boolean;
  theaterMix: boolean;
}

export function useTheaterLevel({ paused, theaterMix }: UseTheaterLevelOptions) {
  const touchedAt = useRef(performance.now());
  const [level, setLevel] = useState<TheaterLevel>(() => levelAt(0, { paused, theaterMix }));
  const timer = useRef<number | null>(null);

  const evaluate = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const since = performance.now() - touchedAt.current;
    const options = { paused, theaterMix };
    const next = levelAt(since, options);
    setLevel((prev) => (prev.level === next.level && prev.dampen === next.dampen ? prev : next));
    const wait = nextChangeIn(since, options);
    if (wait !== null) timer.current = window.setTimeout(evaluate, wait + 20);
  }, [paused, theaterMix]);

  useEffect(() => {
    evaluate();
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [evaluate]);

  /** A touch, key press or mouse move: back to Level 1 and restart the clock. */
  const wake = useCallback(() => {
    touchedAt.current = performance.now();
    evaluate();
  }, [evaluate]);

  return { level, wake };
}
