/**
 * The pulled-out song: one disc, full screen, spinning while the song plays. Reached by dragging
 * the centered disc up (or the "pull the song out" button). Only this song is shown: a big disc
 * that can be spun by hand without touching playback, a scrubber, play/pause and a repeat switch.
 * Swipe down, press Escape or tap the arrow to put the disc back.
 *
 * Rendered in a portal on the page body so no transform or filter on a parent can bend a fixed
 * layout (`.agents/memory/fixed-popups-and-ancestor-filters.md`).
 */
import { FavoriteButton } from './FavoriteButton';
import { formatListening, useListening } from '@/lib/listening';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Pause, Play, Repeat, Repeat1 } from 'lucide-react';

import DiscCascadeCarousel, { type DiscCascadeItem } from '@/components/ui/disc-cascade-carousel';
import { formatTime, useMusicPlayer } from '@/game/audio/musicPlayer';
import { readDiscPulse } from '@/lib/discPulse';
import { readKeepAwake } from '@/lib/jukeboxPrefs';
import { useSavingPower } from '@/lib/powerSaver';
import { useWakeLock } from '@/lib/useWakeLock';
import { useT } from '@/lib/i18n';
import { setCrashScreen } from '@/lib/lokCrash';
import { DiscPulse } from './DiscPulse';
import { DiscSpinSurface } from './DiscSpinSurface';

const DISC_SIZE = 'clamp(200px, min(74vw, 44dvh), 460px)';
const LEAVE_MS = 240;
const DISMISS_PX = 96;

const CSS = `
.pullout{animation:pullout-in .42s cubic-bezier(.16,1,.3,1) both}
.pullout[data-leaving]{animation:pullout-out ${LEAVE_MS}ms ease-in both}
.pullout[data-paused] .dcc-root .dcc-slide .dcc-idle{animation-play-state:paused!important}
@keyframes pullout-in{from{opacity:0;transform:translateY(16dvh) scale(.9)}to{opacity:1;transform:none}}
@keyframes pullout-out{to{opacity:0;transform:translateY(20dvh) scale(.88)}}
@media (prefers-reduced-motion:reduce){.pullout,.pullout[data-leaving]{animation-duration:1ms}}
`;

export interface DiscPullOutProps {
  trackId: string;
  item: DiscCascadeItem;
  /** Phones and low-memory devices: the lighter disc drawing. */
  lite?: boolean;
  onClose: () => void;
}

export function DiscPullOut({ trackId, item, lite, onClose }: DiscPullOutProps) {
  const t = useT();
  const { currentTrack, isPlaying, togglePlay, seek, progressSec, durationSec, repeat, cycleRepeat } = useMusicPlayer();
  const [leaving, setLeaving] = useState(false);
  const saving = useSavingPower();
  const [storedPulse] = useState(readDiscPulse);
  const pulseLevel = saving ? 'off' : storedPulse;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const swipe = useRef<{ id: number; y0: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const leaveTimer = useRef(0);

  const palette = item.palette ?? ['#0a0a0f', '#888', '#c8a24a'];
  // The song is only "pulled out" while it is the one playing; otherwise the disc just sits there.
  const playingThis = currentTrack?.id === trackId && isPlaying;
  const [keepAwake] = useState(readKeepAwake);
  useWakeLock(keepAwake && !saving && playingThis);

  useEffect(() => {
    setCrashScreen(`jukebox-pullout:${trackId}`);
    closeRef.current?.focus();
    return () => {
      window.clearTimeout(leaveTimer.current);
    };
  }, [trackId]);

  const close = () => {
    if (leaving) return;
    setLeaving(true);
    leaveTimer.current = window.setTimeout(onClose, LEAVE_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('button, input, [data-no-dismiss]')) return;
    swipe.current = { id: e.pointerId, y0: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (s && s.id === e.pointerId && e.clientY - s.y0 > DISMISS_PX) close();
  };

  const ownTrack = currentTrack?.id === trackId;
  const duration = ownTrack ? durationSec : 0;
  const progress = ownTrack ? progressSec : 0;
  const stat = useListening().stats[trackId];
  const playedLine = stat && stat.plays > 0 ? t(stat.plays === 1 ? 'listening.playedOnce' : 'listening.played', { n: stat.plays, time: formatListening(stat.seconds) }) : null;
  const repeatLabel = t(repeat === 'one' ? 'disc.pull.repeat.one' : repeat === 'all' ? 'disc.pull.repeat.all' : 'disc.pull.repeat.off');

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="pullout fixed inset-0 z-[80] flex flex-col overflow-hidden bg-black text-white"
      data-testid="disc-pullout"
      data-paused={playingThis ? undefined : ''}
      data-leaving={leaving ? '' : undefined}
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <style>{CSS}</style>
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse at 50% 42%, color-mix(in srgb, ${palette[1]} 38%, transparent) 0%, color-mix(in srgb, ${palette[2]} 18%, transparent) 34%, ${palette[0]} 72%, #000 100%)`,
        }}
      />

      <div className="relative z-10 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label={t('disc.pull.back')}
          title={t('disc.pull.back')}
          className="rounded-full p-2 text-white/85 hover:text-white"
          data-testid="button-pullout-close"
        >
          <ChevronDown size={28} />
        </button>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">{t('disc.pull.title')}</p>
        <span className="w-11" aria-hidden="true" />
      </div>

      <div ref={stageRef} className="relative z-10 mx-auto mt-2 h-[50dvh] w-full max-w-xl flex-none">
        <DiscPulse color={palette[1]} active={playingThis} playing={isPlaying} level={pulseLevel} discSize={DISC_SIZE} />
        <DiscCascadeCarousel
          items={[item]}
          height="100%"
          discSize={DISC_SIZE}
          spin={7}
          lite={lite}
          background="transparent"
          frame={false}
          details={false}
          reviews={false}
          controls={false}
          hint=""
          indexLabel=""
          brand=""
          ariaLabel={item.title}
        />
        <div data-no-dismiss>
          <DiscSpinSurface containerRef={stageRef} discSize={DISC_SIZE} label={t('disc.spin.surface')} onTap={togglePlay} />
        </div>
      </div>

      <div className="relative z-10 mt-auto flex flex-col gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="text-center">
          <h2 className="truncate text-xl font-black uppercase tracking-wide">{item.title}</h2>
          {item.fine ? <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">{item.fine}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="w-10 text-right font-mono text-[10px] text-white/55">{formatTime(progress)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            value={Math.min(Math.floor(progress), Math.max(1, Math.floor(duration)))}
            disabled={!ownTrack}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label={t('jukebox.seek')}
            className="h-1 flex-1 accent-white"
          />
          <span className="w-10 font-mono text-[10px] text-white/55">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-center gap-8">
          <button
            type="button"
            onClick={cycleRepeat}
            aria-label={repeatLabel}
            title={repeatLabel}
            aria-pressed={repeat === 'one'}
            className={`rounded-full p-2 ${repeat === 'one' ? 'text-white' : 'text-white/55'}`}
            data-testid="button-pullout-repeat"
          >
            {repeat === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playingThis ? t('jukebox.pause') : t('jukebox.play')}
            className="rounded-full border border-white/45 p-4"
            data-testid="button-pullout-play"
          >
            {playingThis ? <Pause size={28} /> : <Play size={28} />}
          </button>
          <FavoriteButton trackId={trackId} size={22} testId="button-pullout-favorite" />
        </div>
        {playedLine ? <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/45" data-testid="text-pullout-played">{playedLine}</p> : null}
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">{t('disc.pull.spinHint')}</p>
      </div>
    </div>,
    document.body,
  );
}
