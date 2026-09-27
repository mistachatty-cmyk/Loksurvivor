import { useRef } from 'react';
import anime from 'animejs';
import { DUR, EASE } from '../motion';
import { useAnimeOnChange } from '../hooks/useAnime';

/**
 * Fires once per level-up: a short radial wash from the edges plus the level
 * numeral punching in. Sits above the play field and below the HUD readouts, so
 * it never obscures health or the clock.
 *
 * Deliberately the only full-screen effect in the game. If a second one lands
 * later, one of them is wrong.
 */
export function LevelUpFlash({ level }: { level: number }) {
  const washRef = useRef<HTMLDivElement>(null);
  const numeralRef = useRef<HTMLDivElement>(null);

  useAnimeOnChange(
    level,
    (el) =>
      anime({
        targets: el,
        opacity: [0, 0.55, 0],
        scale: [1.12, 1],
        duration: DUR.flash,
        easing: EASE.sharp,
      }) as never,
    washRef,
  );

  useAnimeOnChange(
    level,
    (el) =>
      anime({
        targets: el,
        opacity: [0, 1, 1, 0],
        scale: [0.82, 1, 1, 1.04],
        duration: DUR.flash + 380,
        easing: EASE.pop,
      }) as never,
    numeralRef,
  );

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'grid',
        placeItems: 'center',
        zIndex: 20,
      }}
    >
      <div
        ref={washRef}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          background:
            'radial-gradient(circle at 50% 55%, transparent 42%, rgba(94,234,212,0.22) 100%)',
        }}
      />
      <div
        ref={numeralRef}
        style={{
          opacity: 0,
          fontWeight: 700,
          fontSize: 'clamp(40px, 9vw, 88px)',
          letterSpacing: '-0.03em',
          color: '#5EEAD4',
          textShadow: '0 0 32px rgba(94,234,212,0.45)',
        }}
      >
        Lv {level}
      </div>
    </div>
  );
}

/**
 * Screen-reader path. The flash is `aria-hidden` because a decorative wash is
 * noise in a screen reader; this announces the same event as text.
 */
export function LevelUpAnnouncement({ level }: { level: number }) {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      Level {level}
    </div>
  );
}
