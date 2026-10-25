/**
 * The Jukebox Room: a dark, full-screen theater for the Lokifed soundtrack.
 * Floating discs, a color grade that follows the music, and almost no UI.
 *
 * Three theater levels (rules in `@lok/jukebox`): Level 1 full UI and a muffled
 * mix for 4 s after a touch, Level 2 translucent UI for the next 20 s, then
 * Level 3 with the UI gone and the mix fully open until the screen is touched.
 * The first touch at Level 3 only wakes the room; it never presses a button.
 */
import { FavoriteButton } from './FavoriteButton';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpFromLine, Library, Moon, Pause, Play, Repeat, Repeat1, RotateCw, Settings2, Shuffle, SlidersHorizontal, SkipBack, SkipForward, X } from 'lucide-react';
import { dampenToTone, gradeFrom, groupBands, IDLE_BANDS, smoothBands, type GroupedBands } from '@lok/jukebox';

import { beatBus } from '@/game/audio/beatBus';
import { buildShelves, paletteOf, type ShelfTrack } from '@/game/audio/jukeboxShelves';
import { formatTime, useMusicPlayer } from '@/game/audio/musicPlayer';
import { armDiscGuard, watchDiscGuard } from '@/lib/discGuard';
import { useT } from '@/lib/i18n';
import { JukeboxListenButton } from './ListenTogether';
import { applyPreset, isFlatEq, nextPreset, presetFor, useEq, writeEq } from '@/lib/musicEq';
import { useTheaterLevel } from '@/lib/useTheaterLevel';
import { readDiscPulse } from '@/lib/discPulse';
import { formatCountdown, nextSleepStep } from '@/lib/sleepTimer';
import { useSavingPower } from '@/lib/powerSaver';
import { useWakeLock } from '@/lib/useWakeLock';
import { readDiscGestures, readKeepAwake, readReactiveBg, reactiveBgGain, readTheaterMix, writeTheaterMix } from '@/lib/jukeboxPrefs';
import { DiscShelves, type DiscShelvesHandle } from './DiscShelves';

const FADE_MS = 900;

export interface JukeboxRoomProps {
  onClose: () => void;
  /** Shortcuts so the room never feels like a dead end. */
  onOpenMusic?: () => void;
  onOpenSettings?: () => void;
}

export default function JukeboxRoom({ onClose, onOpenMusic, onOpenSettings }: JukeboxRoomProps) {
  const t = useT();
  const eq = useEq();
  const music = useMusicPlayer();
  const { tracks, currentTrack, isPlaying, togglePlay, next, previous, seek, progressSec, durationSec, setTheaterTone, shuffle, toggleShuffle, repeat, cycleRepeat } = music;
  const [spinMode, setSpinMode] = useState(false);
  const [gestures] = useState(readDiscGestures);
  const shelvesRef = useRef<DiscShelvesHandle | null>(null);
  const [keepAwake] = useState(readKeepAwake);
  const saving = useSavingPower();
  useWakeLock(keepAwake && !saving && isPlaying);

  // Sleep timer: pauses the music when it runs out. It lives only while the room is open.
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepLeftMs, setSleepLeftMs] = useState(0);
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;
  const toggleRef = useRef(togglePlay);
  toggleRef.current = togglePlay;
  useEffect(() => {
    if (sleepMin <= 0) {
      setSleepLeftMs(0);
      return;
    }
    const endsAt = Date.now() + sleepMin * 60_000;
    setSleepLeftMs(sleepMin * 60_000);
    const timer = window.setInterval(() => {
      const left = endsAt - Date.now();
      if (left <= 0) {
        window.clearInterval(timer);
        if (playingRef.current) toggleRef.current();
        setSleepMin(0);
        return;
      }
      setSleepLeftMs(left);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sleepMin]);
  const [theaterMix, setTheaterMix] = useState(readTheaterMix);
  const { level, wake } = useTheaterLevel({ paused: !isPlaying, theaterMix });
  const [safety] = useState(armDiscGuard);
  useEffect(() => watchDiscGuard(), []);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const vigRef = useRef<HTMLDivElement | null>(null);

  const shelves = useMemo(() => buildShelves(tracks as ShelfTrack[]), [tracks]);
  const palette = useMemo(() => paletteOf(shelves, currentTrack?.id), [shelves, currentTrack?.id]);
  const [storedGain] = useState(() => reactiveBgGain(readReactiveBg()));
  // Battery saver rests the music-reactive glow.
  const bgGain = saving ? 0 : storedGain;

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

  // Keyboard: space play/pause, N next, P previous, S shuffle, R repeat, F pull the song out.
  const keysRef = useRef({ togglePlay, next, previous, toggleShuffle, cycleRepeat });
  keysRef.current = { togglePlay, next, previous, toggleShuffle, cycleRepeat };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      // Typing fields keep their keys, the pull-out view has its own, and Space on a focused button presses it.
      if (el?.closest('input, textarea, select, [role="dialog"], [contenteditable="true"]')) return;
      const key = e.key.toLowerCase();
      if (key === ' ' && el?.closest('button, [role="button"]')) return;
      const k = keysRef.current;
      if (key === ' ') k.togglePlay();
      else if (key === 'n') k.next();
      else if (key === 'p') k.previous();
      else if (key === 's') k.toggleShuffle();
      else if (key === 'r') k.cycleRepeat();
      else if (key === 'f') shelvesRef.current?.pullOut();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
        <DiscShelves
          ref={shelvesRef}
          lite={safety.lite}
          discSize="clamp(170px, 50vw, 340px)"
          ariaLabel={t('jukebox.title')}
          crashPrefix="jukebox-disc"
          spinMode={spinMode}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10" style={uiStyle}>
        <p className="truncate text-center font-mono text-xs uppercase tracking-[0.25em] text-white/70">
          {currentTrack?.title ?? t('jukebox.pick')}
        </p>
        {spinMode ? <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">{t('disc.spin.hint')}</p> : null}
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
        <div className="flex items-center justify-center gap-4">
          {gestures ? (
            <button
              type="button"
              onClick={() => setSpinMode((on) => !on)}
              aria-pressed={spinMode}
              aria-label={spinMode ? t('disc.spin.off') : t('disc.spin.on')}
              title={spinMode ? t('disc.spin.off') : t('disc.spin.on')}
              className={`rounded-full p-2 ${spinMode ? 'bg-white/20 text-white' : 'text-white/70'}`}
              data-testid="button-disc-spin"
            >
              <RotateCw size={20} />
            </button>
          ) : null}
          <button type="button" onClick={previous} aria-label={t('jukebox.prev')} className="p-2 text-white/80"><SkipBack size={22} /></button>
          <button type="button" onClick={togglePlay} aria-label={isPlaying ? t('jukebox.pause') : t('jukebox.play')} className="rounded-full border border-white/40 p-3">
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button type="button" onClick={next} aria-label={t('jukebox.next')} className="p-2 text-white/80"><SkipForward size={22} /></button>
          {gestures ? (
            <button
              type="button"
              onClick={() => shelvesRef.current?.pullOut()}
              aria-label={t('disc.pull.button')}
              title={t('disc.pull.hint')}
              className="rounded-full p-2 text-white/70"
              data-testid="button-disc-pullout"
            >
              <ArrowUpFromLine size={20} />
            </button>
          ) : null}
        </div>
        <div className="flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={toggleShuffle}
            aria-pressed={shuffle}
            aria-label={t('jukebox.shuffle')}
            title={t('jukebox.shuffle')}
            className={`rounded-full p-2 ${shuffle ? 'bg-white/20 text-white' : 'text-white/60'}`}
            data-testid="button-jukebox-shuffle"
          >
            <Shuffle size={18} />
          </button>
          <FavoriteButton trackId={currentTrack?.id} size={18} className="" testId="button-jukebox-favorite" />
          <button
            type="button"
            onClick={cycleRepeat}
            aria-label={t(repeat === 'one' ? 'disc.pull.repeat.one' : repeat === 'all' ? 'disc.pull.repeat.all' : 'disc.pull.repeat.off')}
            title={t(repeat === 'one' ? 'disc.pull.repeat.one' : repeat === 'all' ? 'disc.pull.repeat.all' : 'disc.pull.repeat.off')}
            aria-pressed={repeat !== 'off'}
            className={`rounded-full p-2 ${repeat !== 'off' ? 'bg-white/20 text-white' : 'text-white/60'}`}
            data-testid="button-jukebox-repeat"
          >
            {repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
          <button
            type="button"
            onClick={() => writeEq(applyPreset(eq, nextPreset(eq)))}
            aria-pressed={!isFlatEq(eq)}
            aria-label={t('jukebox.eq', { name: t(`sound.preset.${presetFor(eq) ?? 'flat'}` as never) })}
            title={t('jukebox.eq', { name: t(`sound.preset.${presetFor(eq) ?? 'flat'}` as never) })}
            className={`rounded-full p-2 ${!isFlatEq(eq) ? 'bg-white/20 text-white' : 'text-white/60'}`}
            data-testid="button-jukebox-eq"
          >
            <SlidersHorizontal size={18} />
          </button>
          <JukeboxListenButton />
          <button
            type="button"
            onClick={() => setSleepMin((m) => nextSleepStep(m))}
            aria-pressed={sleepMin > 0}
            aria-label={sleepMin > 0 ? t('jukebox.sleep.left', { time: formatCountdown(sleepLeftMs) }) : t('jukebox.sleep')}
            title={t('jukebox.sleep')}
            className={`flex items-center gap-1.5 rounded-full p-2 ${sleepMin > 0 ? 'bg-white/20 text-white' : 'text-white/60'}`}
            data-testid="button-jukebox-sleep"
          >
            <Moon size={18} />
            {sleepMin > 0 ? <span className="font-mono text-[10px] tracking-wider">{formatCountdown(sleepLeftMs)}</span> : null}
          </button>
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
