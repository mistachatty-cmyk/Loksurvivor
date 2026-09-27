import { useEffect, useRef } from 'react';
import anime from 'animejs';
import { DUR, EASE, prefersReducedMotion } from '../motion';

export interface LootPickup {
  id: string;
  label: string;
  /** Drives the accent. Rarity is information, not decoration. */
  tier?: 'common' | 'rare' | 'evolved';
}

const TIER_COLOR: Record<NonNullable<LootPickup['tier']>, string> = {
  common: '#E8EDF2',
  rare: '#5EEAD4',
  evolved: '#F2C14E',
};

/**
 * A pickup pops in, rises, and leaves. Each one animates on mount and removes
 * itself — no exit-animation bookkeeping, no presence wrapper, because the list
 * is append-only and short-lived.
 *
 * Rare and evolved drops get a slightly longer hold. That's the only difference
 * between tiers besides color: the eye should register "something better
 * happened" without the HUD shouting.
 */
export function LootPop({ pickup, onDone }: { pickup: LootPickup; onDone: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const tier = pickup.tier ?? 'common';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const hold = tier === 'common' ? 700 : 1100;

    if (prefersReducedMotion()) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      const timer = window.setTimeout(() => onDone(pickup.id), hold);
      return () => window.clearTimeout(timer);
    }

    const animation = anime({
      targets: el,
      opacity: [0, 1],
      scale: [0.78, 1],
      translateY: [10, 0],
      duration: DUR.pop,
      easing: EASE.pop,
    }) as unknown as { pause: () => void; revert?: () => void };

    const timer = window.setTimeout(() => {
      anime({
        targets: el,
        opacity: 0,
        translateY: -18,
        duration: 220,
        easing: EASE.sharp,
        complete: () => onDone(pickup.id),
      });
    }, hold);

    return () => {
      window.clearTimeout(timer);
      animation.revert?.();
      animation.pause();
    };
  }, [pickup.id, tier, onDone]);

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        fontWeight: 600,
        fontSize: 15,
        color: TIER_COLOR[tier],
        whiteSpace: 'nowrap',
      }}
    >
      {pickup.label}
    </div>
  );
}

/**
 * Stack container. Caps at four visible so a dense wave of drops doesn't paper
 * over the play field.
 */
export function LootFeed({ pickups, onExpire }: { pickups: LootPickup[]; onExpire: (id: string) => void }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        right: 16,
        bottom: 96,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
        pointerEvents: 'none',
        zIndex: 15,
      }}
    >
      {pickups.slice(-4).map((p) => (
        <LootPop key={p.id} pickup={p} onDone={onExpire} />
      ))}
    </div>
  );
}
