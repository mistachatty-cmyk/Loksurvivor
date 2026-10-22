/**
 * A neon pulse behind the centred disc that moves with the music. Built to be cheap on phones and
 * never get stale:
 *  - it is a SIBLING behind the carousel, never an ancestor, so nothing here can make the 3D discs repaint;
 *  - only `transform` and `opacity` ever change, on a handful of tiny layers (no animated blurs or shadows);
 *  - every effect has its own switch (Settings > Jukebox & soundtracks): halo, rings, arcs, beat pulse,
 *    tempo spin, and breathing disc size;
 *  - the beat pulse is locked to the song's own beat phase and the arcs turn at the song's tempo, so the
 *    effect follows the track rather than a fixed loop;
 *  - rings stay inside the gap to the neighbouring discs, and changing song fades the effect out, swaps the
 *    colour while it is invisible, then fades it back in: no remount, no jump;
 *  - the heavy layers only start a moment after a song starts, so a tap never pays for decoding and drawing
 *    in the same instant.
 */
import { useEffect, useRef, useState } from 'react';

import { beatBus } from '@/game/audio/beatBus';
import { readDiscFx, type DiscFx, type DiscPulseLevel } from '@/lib/discPulse';

export interface DiscPulseProps {
  /** Accent colour of the disc in the middle. */
  color: string;
  /** True while that disc's song is playing. */
  active: boolean;
  level: DiscPulseLevel;
  /** Same CSS length the carousel uses for its discs. */
  discSize: string;
  /** Per-effect switches; read from device settings when not given. */
  fx?: DiscFx;
}

const FRAME_MS = 33;
const WARM_UP_MS = 900;
const SWITCH_MS = 450;

export function DiscPulse({ color, active, level, discSize, fx: fxProp }: DiscPulseProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<HTMLDivElement>(null);
  const beatRef = useRef<HTMLSpanElement>(null);
  const arcRefs = useRef<HTMLSpanElement[]>([]);
  const [fxStored] = useState(readDiscFx);
  const fx = fxProp ?? fxStored;
  const full = level === 'full';
  const [live, setLive] = useState(false);
  const shownColor = useRef(color);

  // Heavy layers wait a beat after a song starts.
  useEffect(() => {
    if (!active) {
      setLive(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setLive(true), WARM_UP_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  // Song change: fade out, swap colour while invisible, fade back in.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || shownColor.current === color) return undefined;
    root.setAttribute('data-switch', '');
    const swap = window.setTimeout(() => {
      root.style.setProperty('--dp-c', color);
      shownColor.current = color;
    }, SWITCH_MS / 2);
    const done = window.setTimeout(() => root.removeAttribute('data-switch'), SWITCH_MS);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(done);
    };
  }, [color]);

  useEffect(() => {
    if (level === 'off') return undefined;
    const halo = haloRef.current;
    const rings = ringsRef.current;
    const beatEl = beatRef.current;
    if (!halo || !rings) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) {
      halo.style.transform = 'scale(1.06)';
      halo.style.opacity = active ? '0.4' : '0';
      return undefined;
    }
    const discSlide = fx.size ? rootRef.current?.parentElement?.querySelector<HTMLElement>('.dcc-slide[data-active]') ?? null : null;
    let raf = 0;
    let last = 0;
    let energy = 0;
    let kick = 0;
    let rate = 1;
    let lastBeatIndex = -1;
    let accent = 0;
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
      if (fx.halo) {
        const scale = 1.04 + energy * (full ? 0.13 : 0.08) + kick * (full ? 0.05 : 0.025);
        halo.style.transform = `scale(${scale.toFixed(3)})`;
        halo.style.opacity = (0.22 + energy * 0.6 + kick * 0.15).toFixed(3);
      }
      rings.style.transform = `scale(${(1 + energy * 0.05).toFixed(3)})`;
      if (beatEl && fx.beat && frame && frame.bpm > 0) {
        // Locked to the song's own beat: bursts out at each beat and fades by the next, harder on the bar line.
        if (frame.beatIndex !== lastBeatIndex) {
          lastBeatIndex = frame.beatIndex;
          accent = frame.downbeat ? 1 : 0.65;
        }
        const p = frame.phase;
        beatEl.style.transform = `scale(${(1 + p * 0.22).toFixed(3)})`;
        beatEl.style.opacity = (Math.pow(1 - p, 2) * 0.55 * accent).toFixed(3);
      }
      if (fx.tempoSpin && frame && frame.bpm > 0) {
        // Arcs turn at the song's tempo (120 BPM is the base speed); eased so a tempo change never jolts.
        rate += (Math.max(0.5, Math.min(2, frame.bpm / 120)) - rate) * 0.08;
        for (const arc of arcRefs.current) {
          const animation = arc?.getAnimations?.()[0];
          if (animation) animation.playbackRate = rate;
        }
      }
      if (discSlide) {
        // The real disc breathes with the music, eased by the carousel's own transition.
        discSlide.style.setProperty('--dcc-lift', `calc(var(--dcc-s) * ${(energy * 0.07 + kick * 0.02).toFixed(3)})`);
      }
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      discSlide?.style.removeProperty('--dcc-lift');
    };
  }, [active, level, full, fx.halo, fx.beat, fx.tempoSpin, fx.size, live]);

  if (level === 'off') return null;
  const setArc = (index: number) => (el: HTMLSpanElement | null) => {
    if (el) arcRefs.current[index] = el;
  };
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="dpulse"
      data-active={active ? '' : undefined}
      data-level={level}
      style={{ width: discSize, '--dp-c': shownColor.current } as React.CSSProperties}
    >
      {fx.halo ? <div ref={haloRef} className="dpulse-halo" /> : <div ref={haloRef} hidden />}
      <div ref={ringsRef} className="dpulse-rings">
        {live && fx.rings ? (
          <>
            <span className="dpulse-ring" style={{ animationDuration: '4.8s', animationDelay: '0s' }} />
            {full ? (
              <>
                <span className="dpulse-ring" style={{ animationDuration: '5.3s', animationDelay: '-1.7s' }} />
                <span className="dpulse-ring" style={{ animationDuration: '5.9s', animationDelay: '-3.9s' }} />
              </>
            ) : null}
          </>
        ) : null}
        {live && fx.beat ? <span ref={beatRef} className="dpulse-beat" /> : null}
        {live && fx.arcs && full ? (
          <>
            <span ref={setArc(0)} className="dpulse-arc" />
            <span ref={setArc(1)} className="dpulse-arc dpulse-arc-b" />
          </>
        ) : null}
      </div>
    </div>
  );
}
