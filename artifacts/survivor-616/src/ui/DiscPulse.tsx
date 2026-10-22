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
  /** True while the centred disc's own song is playing. */
  active: boolean;
  /** True while any song plays: the effect stays alive, dimmer, on a disc that is not the playing one. */
  playing?: boolean;
  level: DiscPulseLevel;
  /** Same CSS length the carousel uses for its discs. */
  discSize: string;
  /** Per-effect switches; read from device settings when not given. */
  fx?: DiscFx;
}

const FRAME_MS = 33;
const WARM_UP_MS = 900;
const SWITCH_MS = 750;

export function DiscPulse({ color, active, playing: playingProp, level, discSize, fx: fxProp }: DiscPulseProps) {
  const playing = playingProp ?? active;
  const rootRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<HTMLDivElement>(null);
  const beatRef = useRef<HTMLSpanElement>(null);
  const shimmerRef = useRef<HTMLSpanElement>(null);
  const washRef = useRef<HTMLDivElement>(null);
  const spokeRefs = useRef<HTMLSpanElement[]>([]);
  const [burstKey, setBurstKey] = useState(0);
  const arcRefs = useRef<HTMLSpanElement[]>([]);
  const [fxStored] = useState(readDiscFx);
  const fx = fxProp ?? fxStored;
  const full = level !== 'soft';
  const wild = level === 'wild';
  const amp = wild ? 3 : full ? 1.8 : 1;
  const [live, setLive] = useState(false);
  const shownColor = useRef(color);

  // Heavy layers wait a beat after a song starts.
  useEffect(() => {
    if (!playing) {
      setLive(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setLive(true), WARM_UP_MS);
    return () => window.clearTimeout(timer);
  }, [playing]);

  // Song change: fade out, swap colour while invisible, fade back in.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || shownColor.current === color) return undefined;
    root.setAttribute('data-switch', '');
    if (fx.burst) setBurstKey((k) => k + 1);
    const swap = window.setTimeout(() => {
      root.style.setProperty('--dp-c', color);
      shownColor.current = color;
    }, 120);
    const done = window.setTimeout(() => root.removeAttribute('data-switch'), SWITCH_MS);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(done);
    };
  }, [color, fx.burst]);

  useEffect(() => {
    if (level === 'off') return undefined;
    const halo = haloRef.current;
    const rings = ringsRef.current;
    const beatEl = beatRef.current;
    const shimmerEl = shimmerRef.current;
    const washEl = full ? washRef.current : null;
    const spokes = fx.spectrum && full ? spokeRefs.current.slice(0, wild ? 28 : 16) : [];
    if (!halo || !rings) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) {
      halo.style.transform = 'scale(1.06)';
      halo.style.opacity = playing ? '0.4' : '0';
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
    let hi = 0;
    // A disc that is not the playing one still reacts, just softer.
    const gain = active ? 1 : 0.55;
    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      if (now - last < FRAME_MS || document.hidden) return;
      last = now;
      const frame = playing ? beatBus.read() : null;
      const bass = frame ? (frame.bands.sub + frame.bands.bass) / 2 : 0;
      const target = frame ? Math.max(frame.energy * 0.7, bass) : 0;
      // Quick to rise, slow to fall: a punchy but never jittery response.
      energy += (target - energy) * (target > energy ? 0.45 : 0.1);
      kick = frame?.onset ? 1 : kick * 0.84;
      if (fx.halo) {
        const scale = 1.04 + (energy * 0.09 + kick * 0.03) * amp * gain;
        halo.style.transform = `scale(${scale.toFixed(3)})`;
        halo.style.opacity = ((0.22 + energy * 0.6 + kick * 0.18) * (active ? 1 : 0.7)).toFixed(3);
      }
      rings.style.transform = `scale(${(1 + energy * 0.05).toFixed(3)})`;
      if (beatEl && fx.beat && frame && frame.bpm > 0) {
        // Locked to the song's own beat: bursts out at each beat and fades by the next, harder on the bar line.
        if (frame.beatIndex !== lastBeatIndex) {
          lastBeatIndex = frame.beatIndex;
          accent = frame.downbeat ? 1 : 0.65;
        }
        const p = frame.phase;
        beatEl.style.transform = `scale(${(1 + p * 0.22 * amp).toFixed(3)})`;
        beatEl.style.opacity = (Math.pow(1 - p, 2) * (0.55 + kick * 0.25) * accent * gain).toFixed(3);
      }
      if (washEl && fx.wash) {
        // A wide colour wash that swells with the bass and fills the scene behind the discs.
        washEl.style.opacity = Math.min(0.75, (0.08 + energy * 0.8 + kick * 0.15) * gain).toFixed(3);
        washEl.style.transform = `scale(${(1 + bass * 0.3 + kick * 0.08).toFixed(3)})`;
      }
      if (spokes.length > 0 && fx.spectrum) {
        // A ring of bars around the disc, mirrored left and right: bass at the bottom, treble at the top.
        const b = frame?.bands;
        const levels = b ? [b.sub, b.bass, b.lowMid, b.mid, b.high] : [0, 0, 0, 0, 0];
        const n = spokes.length;
        for (let i = 0; i < n; i += 1) {
          const f = i / n;
          const m = (f < 0.5 ? f * 2 : (1 - f) * 2) * 4;
          const lo = Math.floor(m);
          const v = levels[lo]! + ((levels[Math.min(4, lo + 1)] ?? 0) - levels[lo]!) * (m - lo);
          const s = 0.1 + Math.min(1, v * 1.7 + kick * 0.25) * (wild ? 1.5 : 1);
          const el = spokes[i];
          if (el) el.style.transform = `rotate(${((360 / n) * i).toFixed(2)}deg) translateY(calc(var(--dp-w) * .5)) scaleY(${s.toFixed(3)})`;
        }
      }
      if (shimmerEl && fx.shimmer) {
        // Treble sparkle: the ring brightens and trembles with the mids and highs, smoothed so it never flickers.
        const highs = frame ? (frame.bands.high * 0.7 + frame.bands.mid * 0.3) : 0;
        hi += (highs - hi) * (highs > hi ? 0.5 : 0.12);
        shimmerEl.style.opacity = Math.min(0.8, hi * 1.1 * gain).toFixed(3);
        shimmerEl.style.transform = `scale(${(1.1 + hi * 0.12 * amp).toFixed(3)}) rotate(${((now / 40) % 360).toFixed(1)}deg)`;
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
        discSlide.style.setProperty('--dcc-lift', `calc(var(--dcc-s) * ${Math.min(0.22, (energy * 0.05 + kick * 0.015) * amp).toFixed(3)})`);
      }
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      discSlide?.style.removeProperty('--dcc-lift');
    };
  }, [active, playing, level, full, fx.halo, fx.beat, fx.shimmer, fx.wash, fx.spectrum, fx.tempoSpin, fx.size, wild, amp, live]);

  if (level === 'off') return null;
  const setArc = (index: number) => (el: HTMLSpanElement | null) => {
    if (el) arcRefs.current[index] = el;
  };
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="dpulse"
      data-active={playing ? '' : undefined}
      data-ambient={playing && !active ? '' : undefined}
      data-level={level}
      style={{ width: discSize, '--dp-w': discSize, '--dp-ring-max': wild ? 1.9 : full ? 1.5 : 1.34, '--dp-c': shownColor.current } as React.CSSProperties}
    >
      {live && fx.wash && full ? <div ref={washRef} className="dpulse-wash" /> : null}
      {fx.burst && burstKey > 0 ? <span key={burstKey} className="dpulse-burst" /> : null}
      {fx.halo ? <div ref={haloRef} className="dpulse-halo" /> : <div ref={haloRef} hidden />}
      <div ref={ringsRef} className="dpulse-rings">
        {live && fx.rings && active ? (
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
        {live && fx.spectrum && full ? (
          <div className="dpulse-spokes">
            {Array.from({ length: wild ? 28 : 16 }, (_, i) => (
              <span key={i} ref={(el) => { if (el) spokeRefs.current[i] = el; }} className="dpulse-spoke" />
            ))}
          </div>
        ) : null}
        {live && fx.beat ? <span ref={beatRef} className="dpulse-beat" /> : null}
        {live && fx.shimmer ? <span ref={shimmerRef} className="dpulse-shimmer" /> : null}
        {live && fx.arcs && full && active ? (
          <>
            <span ref={setArc(0)} className="dpulse-arc" />
            <span ref={setArc(1)} className="dpulse-arc dpulse-arc-b" />
          </>
        ) : null}
      </div>
    </div>
  );
}
