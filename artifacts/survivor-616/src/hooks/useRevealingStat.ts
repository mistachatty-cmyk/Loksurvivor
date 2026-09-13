/**
 * Displays a persistent lifetime stat (bestiary kills, cred, loot tokens,
 * character mastery, ...) frozen at whatever value the player last actually
 * watched it catch up to, then animates it to the true current value the
 * instant it becomes visible on screen -- opening a page that already shows
 * it, or scrolling one into view, both count; a plain hover also counts as
 * a bonus trigger. Deltas earned off-screen (finishing a run, etc.) simply
 * queue up until then, via `useCountUp` (unchanged) doing the actual tween.
 *
 * Never a source of truth: `meta.revealedStats` is a pure display cache,
 * so nothing here should ever be read by unlock/afford/complete checks --
 * see `MetaState.revealedStats`'s doc comment in `types.ts`. A number
 * gating an immediate decision (Vendor affordability, a Claim button)
 * should keep reading `meta` directly instead of using this hook.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { useCountUp, type UseCountUpOptions } from './useCountUp';
import { useMeta } from '@/game/state/metaStore';

export interface RevealingStatResult<T extends HTMLElement> {
  display: number;
  ref: RefObject<T | null>;
}

export function useRevealingStat<T extends HTMLElement = HTMLElement>(
  key: string,
  trueValue: number,
  options: UseCountUpOptions = {},
): RevealingStatResult<T> {
  const { meta, revealStat } = useMeta();
  const revealedValue = meta.revealedStats[key] ?? trueValue;
  const display = useCountUp(revealedValue, options);
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    // Nothing pending -- no observer needed until the next match moves this
    // stat out of sync again.
    if (!el || revealedValue === trueValue) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) revealStat(key, trueValue);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [key, trueValue, revealedValue, revealStat]);

  return { display, ref };
}
