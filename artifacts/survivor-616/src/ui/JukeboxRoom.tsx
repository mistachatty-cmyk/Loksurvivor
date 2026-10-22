/**
 * The Jukebox Room: a dark, full-screen theater for the Lokifed soundtrack.
 * Floating discs, a color grade that follows the music, and almost no UI.
 *
 * Three theater levels (rules in `@lok/jukebox`): Level 1 full UI and a muffled
 * mix for 4 s after a touch, Level 2 translucent UI for the next 20 s, then
 * Level 3 with the UI gone and the mix fully open until the screen is touched.
 * The first touch at Level 3 only wakes the room; it never presses a button.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { dampenToTone, gradeFrom, groupBands, IDLE_BANDS, smoothBands, type GroupedBands } from '@lok/jukebox';

import DiscCascadeCarousel from '@/components/ui/disc-cascade-carousel';
import { beatBus } from '@/game/audio/beatBus';
import { albumTracks, discItemFor, startingDisc } from '@/game/audio/jukeboxDiscs';
import { formatTime, useMusicPlayer } from '@/game/audio/musicPlayer';
import { useT } from '@/lib/i18n';
import { useTheaterLevel } from '@/lib/useTheaterLevel';

const MIX_KEY = 'survivor616.jukebox.theater-mix.v1';
const FADE_MS = 900;

function readMix(): boolean {
  try {
    return window.localStorage.getItem(MIX_KEY) !== '0';
  } catch {
    return true;
  }
}

export interface JukeboxRoomProps {
  onClose: () => void;
}

export default function JukeboxRoom({ onClose }: JukeboxRoomProps) {
  const t = useT();
  const music = useMusicPlayer();
  const { tracks, currentTrack, isPlaying, playTrack, togglePlay, next, previous, seek, progressSec, durationSec, setTheaterTone } = music;
  const [theaterMix, setTheaterMix] = useState(readMix);
  const { level, wake } = useTheaterLevel({ paused: !isPlaying, theaterMix });
  const rootRef = useRef<HTMLDivElement | null>(null);

  const discTracks = useMemo(() => albumTracks(tracks), [tracks]);
  const items = useMemo(() => discTracks.map(discItemFor), [discTracks]);
  const current = useMemo(() => {
    const i = discTracks.findIndex((d) => d.id === currentTrack?.id);
    return i >= 0 ? i : startingDisc(discTracks, null);
  }, [discTracks, currentTrack?.id]);
  const palette = items[current]?.palette ?? ['#0a0a0f', '#888', '#c8a24a'];

  useEffect(() => {
    try {
      window.localStorage.setItem(MIX_KEY, theaterMix ? '1' : '0');
    } catch {
      // Preference just will not persist.
    }
  }, [theaterMix]);

  // Muffle / open the mix with the level. Always hand the sound back on exit.
  useEffect(() => {
    setTheaterTone(dampenToTone(level.dampen));
  }, [level.dampen, setTheaterTone]);
  useEffect(() => () => setTheaterTone(null), [setTheaterTone]);

  // Color grade from the shared beat feed (never a second analyser).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const set = (g: { glow: number; hue: number; vignette: number; grain: number }) => {
      root.style.setProperty('--jb-glow', g.glow.toFixed(3));
      root.style.setProperty('--jb-hue', `${g.hue.toFixed(1)}deg`);
      root.style.setProperty('--jb-vig', g.vignette.toFixed(3));
      root.style.setProperty('--jb-grain', g.grain.toFixed(3));
    };
    if (reduced) {
      set(gradeFrom(IDLE_BANDS, 0.3));
      return;
    }
    let raf = 0;
    let last = performance.now();
    let smooth: GroupedBands = IDLE_BANDS;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = now - last;
      last = now;
      const frame = beatBus.read();
      smooth = smoothBands(smooth, groupBands(frame.bands), dt);
      set(gradeFrom(smooth, frame.energy));
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // At Level 3 the first touch only wakes the room: swallow it in capture.
  const levelRef = useRef(level.level);
  levelRef.current = level.level;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const swallow = (e: Event) => {
      if (levelRef.current === 3) {
        e.stopPropagation();
        e.preventDefault();
        if (e.type === 'pointerdown') wake();
      } else if (e.type === 'pointerdown') {
        wake();
      }
    };
    const types = ['pointerdown', 'click'] as const;
    for (const type of types) root.addEventListener(type, swallow, true);
    return () => {
      for (const type of types) root.removeEventListener(type, swallow, true);
    };
  }, [wake]);

  const uiStyle = {
    opacity: level.uiOpacity,
    transition: `opacity ${FADE_MS}ms cubic-bezier(.16,1,.3,1)`,
    pointerEvents: level.level === 3 ? 'none' : 'auto',
  } as const;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 overflow-hidden bg-black text-white"
      style={{ '--jb-glow': 0.3, '--jb-hue': '0deg', '--jb-vig': 0.6, '--jb-grain': 0.04 } as React.CSSProperties}
      onMouseMove={wake}
      onKeyDown={wake}
      data-testid="screen-jukebox-room"
      data-theater-level={level.level}
      role="region"
      aria-label={t('jukebox.title')}
    >
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse at 50% 45%, ${palette[1]} 0%, ${palette[2]} 28%, ${palette[0]} 70%, #000 100%)`,
          opacity: 'calc(0.12 + var(--jb-glow) * 0.5)' as unknown as number,
          filter: 'hue-rotate(var(--jb-hue))',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, #000 130%)', opacity: 'var(--jb-vig)' as unknown as number }}
      />

      <div className="absolute inset-x-0 top-[14dvh] h-[58dvh]">
        {items.length > 0 ? (
          <DiscCascadeCarousel
            items={items}
            index={current}
            onIndexChange={(index) => {
              const track = discTracks[index];
              if (track && !track.locked && track.id !== currentTrack?.id) playTrack(track.id);
            }}
            loop
            height="58dvh"
            discSize="clamp(170px, 50vw, 340px)"
            background="transparent"
            frame={false}
            details={false}
            reviews={false}
            controls={false}
            hint=""
            indexLabel=""
            brand=""
            ariaLabel={t('jukebox.title')}
            onSelect={(_item, index) => {
              const track = discTracks[index];
              if (!track || track.locked) return;
              if (currentTrack?.id === track.id) togglePlay();
              else playTrack(track.id);
            }}
          />
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10" style={uiStyle}>
        <p className="truncate text-center font-mono text-xs uppercase tracking-[0.25em] text-white/70">
          {currentTrack?.title ?? t('jukebox.pick')}
        </p>
        <div className="flex items-center gap-3">
          <span className="w-10 text-right font-mono text-[10px] text-white/50">{formatTime(progressSec)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(durationSec))}
            value={Math.min(Math.floor(progressSec), Math.max(1, Math.floor(durationSec)))}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label={t('jukebox.seek')}
            className="h-1 flex-1 accent-white"
          />
          <span className="w-10 font-mono text-[10px] text-white/50">{formatTime(durationSec)}</span>
        </div>
        <div className="flex items-center justify-center gap-6">
          <button type="button" onClick={previous} aria-label={t('jukebox.prev')} className="p-2 text-white/80"><SkipBack size={22} /></button>
          <button type="button" onClick={togglePlay} aria-label={isPlaying ? t('jukebox.pause') : t('jukebox.play')} className="rounded-full border border-white/40 p-3">
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button type="button" onClick={next} aria-label={t('jukebox.next')} className="p-2 text-white/80"><SkipForward size={22} /></button>
        </div>
        <label className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/50">
          <input type="checkbox" checked={theaterMix} onChange={(e) => setTheaterMix(e.target.checked)} />
          {t('jukebox.theaterMix')}
        </label>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label={t('jukebox.close')}
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] p-2 text-white/80"
        style={uiStyle}
        data-testid="button-jukebox-close"
      >
        <X size={22} />
      </button>
    </div>
  );
}
