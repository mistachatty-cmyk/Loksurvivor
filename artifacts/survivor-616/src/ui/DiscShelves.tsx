/**
 * The soundtrack as shelves of discs: one row per album (or playlist), each row a Disc Cascade
 * Carousel. Swipe up or down to slide the next shelf in. On the centered disc:
 *   - tap plays or pauses it;
 *   - Spin mode lets you turn it by hand without changing the song;
 *   - dragging it up pulls the song out to a full screen.
 *
 * Shared by the Jukebox Room and the "Outside the hideout" arrival screen. Only one shelf's
 * carousel is ever mounted, so a second album costs no extra memory on a phone. Both the shelves
 * and the hand gestures have an on/off switch in Settings (`jukeboxPrefs`); off gives the old
 * single tap-only row.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import DiscCascadeCarousel from '@/components/ui/disc-cascade-carousel';
import { startingDisc, type DiscTrack } from '@/game/audio/jukeboxDiscs';
import { buildShelves, entriesOf, shelfDiscItem, shelfIndexFor, stepShelf, type ShelfEntry, type ShelfTrack } from '@/game/audio/jukeboxShelves';
import { useMusicPlayer } from '@/game/audio/musicPlayer';
import { readDiscPulse, type DiscPulseLevel } from '@/lib/discPulse';
import { readDiscGestures, readLastShelf, readShelves, writeLastShelf } from '@/lib/jukeboxPrefs';
import { useT } from '@/lib/i18n';
import { setCrashScreen } from '@/lib/lokCrash';
import { DiscPullOut } from './DiscPullOut';
import { DiscPulse } from './DiscPulse';
import { DiscSpinSurface } from './DiscSpinSurface';
import { SealedDiscHint } from './SealedDiscHint';

/** How far (px) a drag must go before it counts as a pull or a shelf swipe. */
const PULL_PX = 84;
const SWIPE_PX = 48;
const DECIDE_PX = 10;
/** A quick flick counts even when short (px per ms). */
const FLICK = 0.7;

const CSS = `
@keyframes shelf-in-next{from{opacity:0;transform:translateY(9dvh)}}
@keyframes shelf-in-prev{from{opacity:0;transform:translateY(-9dvh)}}
.shelf-row[data-enter=next]{animation:shelf-in-next .4s cubic-bezier(.16,1,.3,1) backwards}
.shelf-row[data-enter=prev]{animation:shelf-in-prev .4s cubic-bezier(.16,1,.3,1) backwards}
@media (prefers-reduced-motion:reduce){.shelf-row[data-enter]{animation:none}}
`;

interface ViewShelf {
  id: string;
  title: string;
  entries: ShelfEntry[];
}

export interface DiscShelvesHandle {
  /** Pulls the centered disc's song out to a full screen (same as dragging it up). */
  pullOut: () => void;
}

export interface DiscShelvesProps {
  lite?: boolean;
  discSize: string;
  ariaLabel: string;
  /** Prefix for the crash report's screen name, e.g. `jukebox-disc`. */
  crashPrefix: string;
  /** Spin mode is switched by the screen's own button. */
  spinMode?: boolean;
  /** Called when a tap starts a song (the arrival screen stops its rain here). */
  onPlay?: () => void;
  /** Shown when there is nothing to put on a shelf. */
  emptyText?: string;
}

interface RowProps {
  entries: ShelfEntry[];
  currentId: string | undefined;
  isPlaying: boolean;
  pulseLevel: DiscPulseLevel;
  lite?: boolean;
  discSize: string;
  ariaLabel: string;
  onSelect: (index: number) => void;
  onCenter: (index: number) => void;
}

/** One shelf: the carousel and the pulse behind it. Remounted per shelf, so its state starts fresh. */
function ShelfRow({ entries, currentId, isPlaying, pulseLevel, lite, discSize, ariaLabel, onSelect, onCenter }: RowProps) {
  const tracks = useMemo(() => entries.map((e) => e.track), [entries]);
  const items = useMemo(() => entries.map((e) => shelfDiscItem(e.track, e.position, e.shelfTitle)), [entries]);
  const playing = tracks.findIndex((t) => t.id === currentId);
  const current = playing >= 0 ? playing : startingDisc(tracks, null);
  const [center, setCenter] = useState(current);
  const centerRef = useRef(onCenter);
  centerRef.current = onCenter;
  useEffect(() => centerRef.current(current), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <DiscPulse
        color={items[center]?.palette?.[1] ?? '#7dd3fc'}
        active={isPlaying && tracks[center]?.id === currentId}
        playing={isPlaying}
        level={pulseLevel}
        discSize={discSize}
      />
      <DiscCascadeCarousel
        items={items}
        index={current}
        loop
        lite={lite ?? true}
        height="100%"
        discSize={discSize}
        background="transparent"
        frame={false}
        details={false}
        reviews={false}
        controls={false}
        hint=""
        indexLabel=""
        brand=""
        ariaLabel={ariaLabel}
        onIndexChange={(i) => {
          setCenter(i);
          centerRef.current(i);
        }}
        onSelect={(_item, index) => onSelect(index)}
      />
    </>
  );
}

interface Gesture {
  id: number;
  x0: number;
  y0: number;
  t0: number;
  inDisc: boolean;
  mode: 'undecided' | 'pull' | 'shelf' | 'sideways';
  lift: number;
  buzzed: boolean;
  lastY: number;
  lastT: number;
  vy: number;
}

export const DiscShelves = forwardRef<DiscShelvesHandle, DiscShelvesProps>(function DiscShelves(
  { lite, discSize, ariaLabel, crashPrefix, spinMode = false, onPlay, emptyText },
  ref,
) {
  const t = useT();
  const { tracks, currentTrack, isPlaying, playTrack, togglePlay, soundtrackObjectiveCompletions } = useMusicPlayer();
  const [shelvesOn] = useState(readShelves);
  const [gestures] = useState(readDiscGestures);
  const [pulseLevel] = useState(readDiscPulse);
  const [hint, setHint] = useState<DiscTrack | null>(null);
  const [pulled, setPulled] = useState<string | null>(null);
  const [centerIdx, setCenterIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const shelves = useMemo(() => buildShelves(tracks as ShelfTrack[]), [tracks]);
  const view = useMemo<ViewShelf[]>(() => {
    if (shelves.length === 0) return [];
    if (shelvesOn) {
      return shelves.map((s) => ({ id: s.id, title: s.title, entries: s.tracks.map((track, position) => ({ track, shelfTitle: s.title, position })) }));
    }
    return [{ id: 'shelf:all', title: '', entries: entriesOf(shelves) }];
  }, [shelves, shelvesOn]);

  const [shelfIdx, setShelfIdx] = useState(() => shelfIndexFor(view.map((v) => ({ id: v.id, title: v.title, tracks: v.entries.map((e) => e.track) })), currentTrack?.id, readLastShelf()));
  const [enter, setEnter] = useState<'next' | 'prev' | undefined>(undefined);
  const safeIdx = Math.min(shelfIdx, Math.max(0, view.length - 1));
  const shelf = view[safeIdx];
  const multi = view.length > 1;

  const goShelf = useCallback(
    (delta: number) => {
      if (view.length < 2) return;
      setHint(null);
      setEnter(delta > 0 ? 'next' : 'prev');
      setShelfIdx((i) => stepShelf(Math.min(i, view.length - 1), delta, view.length));
    },
    [view.length],
  );
  const jumpTo = useCallback(
    (index: number) => {
      if (index === safeIdx || index < 0 || index >= view.length) return;
      setHint(null);
      setEnter(index > safeIdx ? 'next' : 'prev');
      setShelfIdx(index);
    },
    [safeIdx, view.length],
  );

  useEffect(() => {
    if (shelf && shelvesOn) writeLastShelf(shelf.id);
  }, [shelf, shelvesOn]);

  // When the music moves to a song on another shelf, the room follows it.
  const lastTrackId = useRef(currentTrack?.id);
  useEffect(() => {
    const id = currentTrack?.id;
    if (id === lastTrackId.current) return;
    lastTrackId.current = id;
    if (!id) return;
    const holding = view.findIndex((s) => s.entries.some((e) => e.track.id === id));
    if (holding >= 0 && holding !== safeIdx) jumpTo(holding);
  }, [currentTrack?.id, view, safeIdx, jumpTo]);

  const select = useCallback(
    (index: number) => {
      const entry = shelf?.entries[index];
      if (!entry) return;
      setCrashScreen(`${crashPrefix}:${entry.track.id}`);
      if (entry.track.locked) {
        setHint(entry.track);
        return;
      }
      setHint(null);
      if (currentTrack?.id === entry.track.id) {
        if (!isPlaying) onPlay?.();
        togglePlay();
      } else {
        onPlay?.();
        playTrack(entry.track.id);
      }
    },
    [shelf, crashPrefix, currentTrack?.id, isPlaying, onPlay, togglePlay, playTrack],
  );

  const pullOut = useCallback(() => {
    const entry = shelf?.entries[centerIdx];
    if (!entry) return;
    if (entry.track.locked) {
      setHint(entry.track);
      return;
    }
    setHint(null);
    // Pulling a song out means listening to it: start it, or pick it back up if it was paused.
    if (currentTrack?.id !== entry.track.id) {
      onPlay?.();
      playTrack(entry.track.id);
    } else if (!isPlaying) {
      onPlay?.();
      togglePlay();
    }
    setPulled(entry.track.id);
  }, [shelf, centerIdx, currentTrack?.id, isPlaying, onPlay, playTrack, togglePlay]);

  useImperativeHandle(ref, () => ({ pullOut }), [pullOut]);

  // ---- hand gestures on the shelf -------------------------------------------------------------
  const gesture = useRef<Gesture | null>(null);
  const swallowClick = useRef(false);
  const wheelLock = useRef(0);

  const tiltEl = () => wrapRef.current?.querySelector<HTMLElement>('.dcc-slide[data-active] .dcc-tilt') ?? null;
  const discContains = (x: number, y: number) => {
    const stage = wrapRef.current?.querySelector<HTMLElement>('.dcc-stage');
    if (!stage) return false;
    const r = stage.getBoundingClientRect();
    return Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) <= r.width / 2;
  };
  const dropDisc = () => {
    const el = tiltEl();
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
    }
  };

  // The press is classified in the capture phase, before the carousel sees it: a mostly-vertical
  // drag is ours (pull or shelf swipe) and is hidden from the carousel so finger drift cannot
  // also scroll the row sideways. The end is caught on the window so a release anywhere finishes it.
  const endRef = useRef<(e: PointerEvent) => void>(() => {});
  const onWindowEnd = useCallback((e: PointerEvent) => endRef.current(e), []);
  useEffect(
    () => () => {
      window.removeEventListener('pointerup', onWindowEnd);
      window.removeEventListener('pointercancel', onWindowEnd);
    },
    [onWindowEnd],
  );

  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (!gestures || e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest('[data-shelf-ui]') || target.closest('[data-testid="disc-spin-surface"]')) return;
    gesture.current = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, inDisc: discContains(e.clientX, e.clientY),
      mode: 'undecided', lift: 0, buzzed: false, lastY: e.clientY, lastT: e.timeStamp, vy: 0,
    };
    window.addEventListener('pointerup', onWindowEnd);
    window.addEventListener('pointercancel', onWindowEnd);
  };

  const onPointerMoveCapture = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    const dt = Math.max(1, e.timeStamp - g.lastT);
    g.vy = g.vy * 0.6 + ((e.clientY - g.lastY) / dt) * 0.4;
    g.lastY = e.clientY;
    g.lastT = e.timeStamp;
    if (g.mode === 'undecided') {
      if (Math.hypot(dx, dy) < DECIDE_PX) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.3) {
        if (g.inDisc && dy < 0 && !spinMode) {
          g.mode = 'pull';
          const el = tiltEl();
          if (el) el.style.transition = 'none';
        } else if (multi) {
          g.mode = 'shelf';
        } else {
          g.mode = 'sideways';
        }
      } else {
        g.mode = 'sideways';
      }
    }
    if (g.mode === 'pull' || g.mode === 'shelf') e.stopPropagation();
    if (g.mode === 'pull') {
      g.lift = Math.max(0, Math.min(280, -dy));
      const el = tiltEl();
      if (el) el.style.transform = `translate3d(0, ${-g.lift}px, 0) scale(${1 + g.lift / 900})`;
      if (g.lift >= PULL_PX && !g.buzzed) {
        g.buzzed = true;
        try {
          navigator.vibrate?.(8);
        } catch {
          /* haptics are optional */
        }
      }
    }
  };

  endRef.current = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    window.removeEventListener('pointerup', onWindowEnd);
    window.removeEventListener('pointercancel', onWindowEnd);
    const cancelled = e.type === 'pointercancel';
    const dy = e.clientY - g.y0;
    if (g.mode === 'pull') {
      swallowClick.current = true;
      const open = !cancelled && (g.lift >= PULL_PX || (g.vy < -FLICK && g.lift > 36));
      dropDisc();
      if (open) pullOut();
    } else if (g.mode === 'shelf') {
      swallowClick.current = true;
      if (!cancelled) {
        if (dy <= -SWIPE_PX || g.vy < -FLICK) goShelf(1);
        else if (dy >= SWIPE_PX || g.vy > FLICK) goShelf(-1);
      }
    }
    if (swallowClick.current) window.setTimeout(() => (swallowClick.current = false), 80);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!multi || Math.abs(e.deltaY) < 24 || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    const now = performance.now();
    if (now - wheelLock.current < 480) return;
    wheelLock.current = now;
    goShelf(e.deltaY > 0 ? 1 : -1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!multi) return;
    if (e.key === 'PageDown') {
      e.preventDefault();
      goShelf(1);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      goShelf(-1);
    }
  };

  if (!shelf) {
    return emptyText ? (
      <p className="mx-auto mt-[6dvh] max-w-xs px-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/50" data-testid="arrival-discs-empty">
        {emptyText}
      </p>
    ) : null;
  }

  const pulledEntry = pulled ? shelf.entries.find((e) => e.track.id === pulled) ?? view.flatMap((s) => s.entries).find((e) => e.track.id === pulled) : undefined;

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full"
      style={gestures ? { touchAction: 'none' } : undefined}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onClickCapture={(e) => {
        if (swallowClick.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      data-testid="disc-shelves"
      data-no-swipe=""
      data-shelf={shelf.id}
    >
      <style>{CSS}</style>

      {multi ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[7] flex flex-col items-center pt-1" data-shelf-ui>
            <div className="pointer-events-auto flex max-w-full items-center gap-1">
              <button type="button" onClick={() => goShelf(-1)} aria-label={t('disc.shelf.prev')} title={t('disc.shelf.prev')} className="p-1.5 text-white/65 hover:text-white" data-testid="button-shelf-prev">
                <ChevronUp size={18} />
              </button>
              <p className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-white/85" data-testid="shelf-title">{shelf.title}</p>
              <button type="button" onClick={() => goShelf(1)} aria-label={t('disc.shelf.next')} title={t('disc.shelf.next')} className="p-1.5 text-white/65 hover:text-white" data-testid="button-shelf-next">
                <ChevronDown size={18} />
              </button>
            </div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{t('disc.shelf.count', { n: String(shelf.entries.length) })}</p>
          </div>
          <nav className="absolute right-1 top-1/2 z-[7] flex -translate-y-1/2 flex-col" aria-label={t('disc.shelf.rail')} data-shelf-ui>
            {view.map((s, i) => {
              const holdsCurrent = s.entries.some((e) => e.track.id === currentTrack?.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jumpTo(i)}
                  aria-label={t('disc.shelf.go', { title: s.title })}
                  aria-current={i === safeIdx ? 'true' : undefined}
                  className="grid h-7 w-7 place-items-center"
                  data-testid={`button-shelf-dot-${i}`}
                >
                  <span
                    className={`block rounded-full transition-all ${i === safeIdx ? 'h-3 w-3 bg-white' : 'h-2 w-2 bg-white/35'} ${holdsCurrent && isPlaying ? 'ring-2 ring-fuchsia-300/80' : ''}`}
                  />
                </button>
              );
            })}
          </nav>
        </>
      ) : null}

      {/* While a song is pulled out the shelf beneath is not drawn at all (display:none frees its
          3D layers); two full 3D scenes at once is what ran phones out of memory. State is kept. */}
      <div
        key={shelf.id}
        className="shelf-row absolute inset-0"
        data-enter={enter}
        style={pulledEntry ? { display: 'none' } : undefined}
      >
        <ShelfRow
          entries={shelf.entries}
          currentId={currentTrack?.id}
          isPlaying={isPlaying}
          pulseLevel={pulseLevel}
          lite={lite}
          discSize={discSize}
          ariaLabel={ariaLabel}
          onSelect={select}
          onCenter={setCenterIdx}
        />
      </div>

      {gestures && spinMode && !pulledEntry ? (
        <DiscSpinSurface containerRef={wrapRef} discSize={discSize} label={t('disc.spin.surface')} onTap={() => select(centerIdx)} />
      ) : null}

      {hint ? (
        <div className="absolute inset-x-0 top-[96%] z-50 px-4">
          <SealedDiscHint track={hint} completed={soundtrackObjectiveCompletions} onClose={() => setHint(null)} />
        </div>
      ) : null}

      {pulledEntry ? (
        <DiscPullOut
          trackId={pulledEntry.track.id}
          item={shelfDiscItem(pulledEntry.track, pulledEntry.position, pulledEntry.shelfTitle)}
          lite={lite}
          onClose={() => setPulled(null)}
        />
      ) : null}
    </div>
  );
});
