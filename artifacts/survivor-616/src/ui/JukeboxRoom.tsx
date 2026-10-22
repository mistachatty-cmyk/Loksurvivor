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
import { Library, Pause, Play, Settings2, SkipBack, SkipForward, X } from 'lucide-react';
import { dampenToTone, gradeFrom, groupBands, IDLE_BANDS, smoothBands, type GroupedBands } from '@lok/jukebox';

import DiscCascadeCarousel from '@/components/ui/disc-cascade-carousel';
import { beatBus } from '@/game/audio/beatBus';
import { albumTracks, discItemFor, startingDisc } from '@/game/audio/jukeboxDiscs';
import { formatTime, useMusicPlayer } from '@/game/audio/musicPlayer';
import { armDiscGuard, watchDiscGuard } from '@/lib/discGuard';
import { useT } from '@/lib/i18n';
import { setCrashScreen } from '@/lib/lokCrash';
import { SealedDiscHint } from './SealedDiscHint';
import type { DiscTrack } from '@/game/audio/jukeboxDiscs';
import { useTheaterLevel } from '@/lib/useTheaterLevel';
import { readDiscPulse } from '@/lib/discPulse';
import { readReactiveBg, reactiveBgGain, readTheaterMix, writeTheaterMix } from '@/lib/jukeboxPrefs';
import { DiscPulse } from './DiscPulse';

const FADE_MS = 900;

export interface JukeboxRoomProps {
  onClose: () => void;
  /** Shortcuts so the room never feels like a dead end. */
  onOpenMusic?: () => void;
  onOpenSettings?: () => void;
}

export default function JukeboxRoom({ onClose, onOpenMusic, onOpenSettings }: JukeboxRoomProps) {
  const t = useT();
  const music = useMusicPlayer();
  const { tracks, currentTrack, isPlaying, playTrack, togglePlay, next, previous, seek, progressSec, durationSec, setTheaterTone, soundtrackObjectiveCompletions } = music;
  const [hint, setHint] = useState<DiscTrack | null>(null);
  const [theaterMix, setTheaterMix] = useState(readTheaterMix);
  const { level, wake } = useTheaterLevel({ paused: !isPlaying, theaterMix });
  const [safety] = useState(armDiscGuard);
  useEffect(() => watchDiscGuard(), []);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const vigRef = useRef<HTMLDivElement | null>(null);

  const discTracks = useMemo(() => albumTracks(tracks), [tracks]);
  const items = useMemo(() => discTracks.map(discItemFor), [discTracks]);
  const [pulseLevel] = useState(readDiscPulse);
  const [bgGain] = useState(() => reactiveBgGain(readReactiveBg()));
  const current = useMemo(() => {
    const i = discTracks.findIndex((d) => d.id === currentTrack?.id);
    return i >= 0 ? i : startingDisc(discTracks, null);
  }, [discTracks, currentTrack?.id]);
  const palette = items[current]?.palette ?? ['#0a0a0f', '#888', '#c8a24a'];

  useEffect(() => {
    writeTheaterMix(theaterMix);
  }, [theaterMix]);

  // Muffle / open the mix with the level. Always hand the sound back on exit.
  useEffect(() => {
    setTheaterTone(dampenToTone(level.dampen));
  }, [level.dampen, setTheaterTone]);
  useEffect(() => () => setTheaterTone(null), [setTheaterTone]);

  // Color grade from the shared beat feed (never a second analyser). It writes
  // opacity straight onto two small layers, about 12 times a second: never onto
  // an ancestor of the 3D discs (that restyles all of them) and never through a
  // full-screen filter. Both made phone browsers run out of memory.
  useEffect(() => {
    const glow = glowRef.current;
    const vig = vigRef.current;
    if (!glow || !vig) return;
    const paint = (g: { glow: number; vignette: number }) => {
      glow.style.opacity = (0.12 + g.glow * 0.5 * bgGain).toFixed(3);
      vig.style.opacity = (0.6 + (g.vignette - 0.6) * bgGain).toFixed(3);
    };
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduced || bgGain === 0) {
      paint(gradeFrom(IDLE_BANDS, 0.3));
      return;
    }
    let timer = 0;
    let last = performance.now();
    let smooth: GroupedBands = IDLE_BANDS;
    const tick = () => {
      const now = performance.now();
      const frame = beatBus.read();
      smooth = smoothBands(smooth, groupBands(frame.bands), now - last);
      last = now;
      paint(gradeFrom(smooth, frame.energy));
    };
    const start = () => {
      window.clearInterval(timer);
      last = performance.now();
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
  }, [bgGain]);

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
      onMouseMove={wake}
      onKeyDown={wake}
      data-testid="screen-jukebox-room"
      data-theater-level={level.level}
      role="region"
      aria-label={t('jukebox.title')}
    >
      <div
        ref={glowRef}
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse at 50% 45%, ${palette[1]} 0%, ${palette[2]} 28%, ${palette[0]} 70%, #000 100%)`,
          opacity: 0.2,
          transition: 'background 1.2s ease',
        }}
      />
      <div
        ref={vigRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, #000 130%)', opacity: 0.6 }}
      />

      <div className="absolute inset-x-0 top-[14dvh] h-[58dvh]">
        {items.length > 0 ? (
          <DiscPulse
            color={items[current]?.palette?.[1] ?? '#7dd3fc'}
            active={isPlaying}
            level={pulseLevel}
            discSize="clamp(170px, 50vw, 340px)"
          />
        ) : null}
        {items.length > 0 ? (
          <DiscCascadeCarousel
            items={items}
            index={current}
            loop
            lite={safety.lite}
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
              if (!track) return;
              setCrashScreen(`jukebox-disc:${track.id}`);
              if (track.locked) {
                setHint(track);
                return;
              }
              setHint(null);
              if (currentTrack?.id === track.id) togglePlay();
              else playTrack(track.id);
            }}
          />
        ) : null}
      </div>

      {hint ? (
        <div className="absolute inset-x-0 top-[calc(14dvh+58dvh)] z-50 px-4">
          <SealedDiscHint track={hint} completed={soundtrackObjectiveCompletions} onClose={() => setHint(null)} />
        </div>
      ) : null}

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

      <div
        className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-1 text-white/80"
        style={uiStyle}
      >
        {onOpenMusic ? (
          <button type="button" onClick={onOpenMusic} aria-label={t('jukebox.library')} title={t('jukebox.library')} className="p-2" data-testid="button-jukebox-library">
            <Library size={22} />
          </button>
        ) : null}
        {onOpenSettings ? (
          <button type="button" onClick={onOpenSettings} aria-label={t('jukebox.settings')} title={t('jukebox.settings')} className="p-2" data-testid="button-jukebox-settings">
            <Settings2 size={22} />
          </button>
        ) : null}
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
