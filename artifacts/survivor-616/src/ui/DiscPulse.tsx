/**
 * A neon pulse behind the centred disc that moves with the music. Built to be cheap on phones and
 * never get stale:
 *  - it is a SIBLING behind the carousel, never an ancestor, so nothing here can make the 3D discs repaint;
 *  - only `transform` and `opacity` ever change, on a handful of tiny layers;
 *  - three expanding rings run on slightly different lengths, so their overlap keeps drifting instead of
 *    repeating; every loop starts and ends at zero opacity, so there is no visible seam;
 *  - a slow neon arc turns forever (a full turn is a perfect loop);
 *  - the halo follows the bass and kicks on each transient, smoothed so it never flickers;
 *  - changing song only changes the colour (it eases) and lets the smoothing settle: no remount, no jump.
 */
import { useEffect, useRef } from 'react';

import { beatBus } from '@/game/audio/beatBus';
import type { DiscPulseLevel } from '@/lib/discPulse';

export interface DiscPulseProps {
  /** Accent colour of the disc in the middle. */
  color: string;
  /** True while that disc's song is playing. */
  active: boolean;
  level: DiscPulseLevel;
  /** Same CSS length the carousel uses for its discs. */
  discSize: string;
}

const FRAME_MS = 33;

export function DiscPulse({ color, active, level, discSize }: DiscPulseProps) {
  const haloRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<HTMLDivElement>(null);
  const full = level === 'full';

  useEffect(() => {
    if (level === 'off') return undefined;
    const halo = haloRef.current;
    const rings = ringsRef.current;
    if (!halo || !rings) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    let last = 0;
    let energy = 0;
    let kick = 0;
    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      if (now - last < FRAME_MS || document.hidden) return;
      last = now;
      const frame = active ? beatBus.read() : null;
      const bass = frame ? (frame.bands.sub + frame.bands.bass) / 2 : 0;
      const target = frame ? Math.max(frame.energy * 0.7, bass) : 0;
      // Quick to rise, slow to fall: a punchy but never jittery response.
      energy += (target - energy) * (target > energy ? 0.45 : 0.1);
      kick = frame?.onset ? 1 : kick * 0.84;
      const scale = 1.04 + energy * (full ? 0.13 : 0.08) + kick * (full ? 0.05 : 0.025);
      halo.style.transform = `scale(${scale.toFixed(3)})`;
      halo.style.opacity = (0.22 + energy * 0.6 + kick * 0.15).toFixed(3);
      rings.style.transform = `scale(${(1 + energy * 0.05).toFixed(3)})`;
    };
    if (reduce) {
      halo.style.transform = 'scale(1.06)';
      halo.style.opacity = active ? '0.4' : '0';
      return undefined;
    }
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active, level, full]);

  if (level === 'off') return null;
  return (
    <div
      aria-hidden="true"
      className="dpulse"
      data-active={active ? '' : undefined}
      data-level={level}
      style={{ width: discSize, '--dp-c': color } as React.CSSProperties}
    >
      <div ref={haloRef} className="dpulse-halo" />
      <div ref={ringsRef} className="dpulse-rings">
        <span className="dpulse-ring" style={{ animationDuration: '4.8s', animationDelay: '0s' }} />
        {full ? (
          <>
            <span className="dpulse-ring" style={{ animationDuration: '5.3s', animationDelay: '-1.7s' }} />
            <span className="dpulse-ring" style={{ animationDuration: '5.9s', animationDelay: '-3.9s' }} />
            <span className="dpulse-arc" />
            <span className="dpulse-arc dpulse-arc-b" />
          </>
        ) : null}
      </div>
    </div>
  );
}
