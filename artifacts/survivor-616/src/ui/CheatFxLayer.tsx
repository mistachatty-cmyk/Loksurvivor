/**
 * Plays the Easter-egg effects. Procedural CSS only (no assets); every layer animates
 * transform/opacity, sits on its own fixed element and is never an ancestor of game UI, so it
 * cannot stress Safari the way filters on a parent would.
 */
import { useEffect, useState } from 'react';

import type { CheatFx } from '@/game/data/cheatCodes';
import { prefersReducedMotion } from '@/anim/motion';
import { CHEAT_FX_EVENT, CHEAT_FX_MS } from '@/lib/cheatFx';

const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: ((i * 37) % 100) + (i % 3) * 0.7,
  delay: (i % 7) * 90,
  hue: (i * 47) % 360,
  drift: ((i % 5) - 2) * 22,
  size: 6 + (i % 4) * 2,
}));

export function CheatFxLayer() {
  const [active, setActive] = useState<{ fx: CheatFx; key: number } | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const onFx = (event: Event) => {
      const fx = (event as CustomEvent<CheatFx>).detail;
      window.clearTimeout(timer);
      setActive({ fx, key: Date.now() });
      timer = window.setTimeout(() => setActive(null), prefersReducedMotion() ? 1200 : CHEAT_FX_MS[fx]);
    };
    window.addEventListener(CHEAT_FX_EVENT, onFx);
    return () => { window.removeEventListener(CHEAT_FX_EVENT, onFx); window.clearTimeout(timer); };
  }, []);

  if (!active) return null;
  const reduced = prefersReducedMotion();
  return (
    <div className="cheatfx" aria-hidden="true" data-testid={`cheat-fx-${active.fx}`} key={active.key}>
      {active.fx === 'confetti' && !reduced
        ? CONFETTI.map((piece, i) => (
            <span
              key={i}
              className="cheatfx-piece"
              style={{
                left: `${piece.left}%`,
                width: piece.size,
                height: piece.size * 1.6,
                background: `hsl(${piece.hue} 90% 60%)`,
                animationDelay: `${piece.delay}ms`,
                ['--cf-drift' as string]: `${piece.drift}px`,
              }}
            />
          ))
        : null}
      {active.fx === 'disco' ? <div className="cheatfx-disco" data-reduced={reduced ? '1' : undefined} /> : null}
      {active.fx === 'pulse616' ? <div className="cheatfx-616">616</div> : null}
    </div>
  );
}
