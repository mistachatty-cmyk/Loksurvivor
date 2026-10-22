import { useEffect, useRef } from 'react';

import { beatBus } from '@/game/audio/beatBus';
import { reactiveBgGain, type ReactiveBgLevel } from '@/lib/jukeboxPrefs';

/**
 * A music-reactive glow that sits BEHIND everything as a sibling layer. Opacity only, about
 * 12 writes a second, paused while the tab is hidden, and still under reduced motion.
 * It is never an ancestor of the 3D discs.
 */
export function ReactiveBackdrop({ level, color }: { level: ReactiveBgLevel; color: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const gain = reactiveBgGain(level);
    if (gain === 0) {
      el.style.opacity = '0';
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduced) {
      el.style.opacity = (0.12 * gain).toFixed(3);
      return;
    }
    let timer = 0;
    let smooth = 0;
    const tick = () => {
      const f = beatBus.read();
      const target = Math.min(1, f.energy * 0.7 + f.bands.bass * 0.5 + (f.onset ? 0.25 : 0));
      smooth += (target - smooth) * 0.35;
      el.style.opacity = (0.1 * gain + smooth * 0.55 * gain).toFixed(3);
    };
    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(tick, 80);
    };
    const onVisibility = () => {
      if (document.hidden) window.clearInterval(timer);
      else start();
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [level]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
      data-testid="reactive-backdrop"
      style={{
        background: `radial-gradient(ellipse at 50% 38%, ${color} 0%, transparent 62%)`,
        opacity: 0,
      }}
    />
  );
}
