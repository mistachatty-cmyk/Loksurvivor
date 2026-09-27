import { useEffect, useRef } from 'react';
import anime from 'animejs';
import { DUR, EASE, prefersReducedMotion } from '../motion';

/**
 * Written against anime.js v3's default-export API (`anime({ targets, ... })`,
 * `anime.stagger`), matching the version this repo installs -- see
 * `useCountUp.ts` for the same pattern. On v4, swap to the named `animate`/
 * `stagger` imports; the hook surfaces here don't change.
 */

type AnimeHandle = { pause: () => void; revert?: () => void };

const stop = (handle: AnimeHandle | null) => {
  if (!handle) return;
  // revert() restores inline styles anime wrote; pause() alone can strand an
  // element mid-transform if the component unmounts on a bad frame. v3's
  // instances don't expose revert(), so this is a no-op there.
  handle.revert?.();
  handle.pause();
};

/**
 * Runs an animation whenever `trigger` changes to a new value — a level number
 * going up, a pickup id arriving. Skipped on first render, because mounting is
 * not an event the player caused.
 */
export const useAnimeOnChange = <T,>(
  trigger: T,
  run: (el: HTMLElement) => AnimeHandle | void,
  ref: React.RefObject<HTMLElement | null>,
): void => {
  const previous = useRef<T>(trigger);
  const handle = useRef<AnimeHandle | null>(null);

  useEffect(() => {
    if (previous.current === trigger) return;
    previous.current = trigger;

    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    stop(handle.current);
    handle.current = run(el) ?? null;

    return () => stop(handle.current);
    // `run` is intentionally excluded: callers pass inline closures, and
    // including it would re-fire the animation on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, ref]);
};

/**
 * Staggered entrance for a list of children — hub nav, menu rows, the shop
 * grid. One orchestrated reveal per screen, not a fade on every card.
 */
export const useStaggeredEntrance = (
  ref: React.RefObject<HTMLElement | null>,
  childSelector: string,
  options: { enabled?: boolean; delay?: number } = {},
): void => {
  const { enabled = true, delay = 0 } = options;
  const handle = useRef<AnimeHandle | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const children = el.querySelectorAll<HTMLElement>(childSelector);
    if (children.length === 0) return;

    if (prefersReducedMotion()) {
      // Land on the end state immediately rather than leaving items at
      // opacity 0 — a skipped animation must never hide content.
      children.forEach((child) => {
        child.style.opacity = '1';
        child.style.transform = 'none';
      });
      return;
    }

    handle.current = anime({
      targets: children,
      opacity: [0, 1],
      translateY: [14, 0],
      duration: DUR.nav,
      delay: anime.stagger(DUR.navStagger, { start: delay }),
      easing: EASE.out,
    }) as unknown as AnimeHandle;

    return () => stop(handle.current);
  }, [ref, childSelector, enabled, delay]);
};
