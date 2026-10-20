import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Repeat, Repeat1, Shuffle, Volume1, Volume2, VolumeX } from 'lucide-react';
import { formatTime, useMusicPlayer } from '@/game/audio/musicPlayer';
import { positionFromPointer, sliderToVolume, volumeToSlider } from '@/game/audio/volumeCurve';
import { useT } from '@/lib/i18n';

const SPEEDS = [0.75, 1, 1.25];
const PANEL_GAP = 6;

interface Place {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  up: boolean;
}

/** Fixed position derived from the anchor, so the soundbar itself never grows. */
function placeFrom(anchor: HTMLElement): Place {
  const r = anchor.getBoundingClientRect();
  const width = Math.min(Math.max(r.width, 224), window.innerWidth - 16);
  const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
  const up = r.top + r.height / 2 > window.innerHeight / 2;
  return up
    ? { left, width, bottom: window.innerHeight - r.top + PANEL_GAP, up }
    : { left, width, top: r.bottom + PANEL_GAP, up };
}

/**
 * Opt-in extras for the open soundbar: volume, seek, shuffle/repeat, speed.
 * Drawn as an overlay (portal + fixed) so opening it changes nothing about the
 * bar's own footprint, and it is never shown until the player asks for it.
 */
export function SoundbarPanel({ anchorRef, onClose }: { anchorRef: RefObject<HTMLElement | null>; onClose: () => void }) {
  const t = useT();
  const player = useMusicPlayer();
  const panelRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [dragging, setDragging] = useState(false);

  const reposition = useCallback(() => {
    if (anchorRef.current) setPlace(placeFrom(anchorRef.current));
  }, [anchorRef]);

  useLayoutEffect(reposition, [reposition]);
  useEffect(() => {
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [reposition]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [anchorRef, onClose]);

  const level = player.muted ? 0 : player.volume;
  const slider = volumeToSlider(level);
  const pct = Math.round(slider * 100);
  const setFromPointer = (clientX: number) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (box) player.setVolume(sliderToVolume(positionFromPointer(clientX, box.left, box.width)));
  };
  const nudge = (delta: number) => player.setVolume(sliderToVolume(Math.max(0, Math.min(1, slider + delta))));
  const VolumeIcon = level === 0 ? VolumeX : level < 0.35 ? Volume1 : Volume2;
  const RepeatIcon = player.repeat === 'one' ? Repeat1 : Repeat;
  const speedIndex = Math.max(0, SPEEDS.indexOf(player.playbackRate));
  const duration = player.durationSec > 0 ? player.durationSec : 0;

  if (!place) return null;

  const row = (n: number) => ({ animationDelay: `${n * 30}ms` });
  const toggleBtn = 'grid h-7 w-7 shrink-0 place-items-center border transition';

  return createPortal(
    <div
      ref={panelRef}
      className={`soundbar-panel fixed z-[101] border border-white/25 bg-black/90 p-2 text-white/85 shadow-xl backdrop-blur-sm ${place.up ? 'soundbar-panel-up' : ''}`}
      style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom }}
      role="group"
      aria-label={t('soundbar.more.aria')}
      data-testid="soundbar-panel"
    >
      <div className="soundbar-row flex items-center gap-2" style={row(0)}>
        <button
          type="button"
          onClick={player.toggleMute}
          className="grid h-7 w-7 shrink-0 place-items-center text-primary hover:text-white"
          aria-label={level === 0 ? t('soundbar.unmute') : t('soundbar.mute')}
          data-testid="button-global-music-mute"
        >
          <VolumeIcon className="h-4 w-4" />
        </button>
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={t('soundbar.volume')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${pct}%`}
          className="soundbar-track relative h-7 flex-1 cursor-pointer touch-none"
          data-dragging={dragging || undefined}
          data-testid="slider-global-music-volume"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            setFromPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (dragging) setFromPointer(e.clientX);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onWheel={(e) => nudge(e.deltaY < 0 ? 0.05 : -0.05)}
          onKeyDown={(e) => {
            const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.05 : 0;
            if (step) {
              e.preventDefault();
              nudge(step);
            } else if (e.key === 'Home') player.setVolume(0);
            else if (e.key === 'End') player.setVolume(1);
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/15" />
          <div className="soundbar-fill absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ width: `${pct}%` }} />
          <div className="soundbar-thumb absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" style={{ left: `${pct}%` }} />
        </div>
        <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-white/70" data-testid="soundbar-volume-readout">
          {pct}
        </span>
      </div>

      <div className="soundbar-row mt-1 flex items-center gap-2 font-mono text-[10px] tabular-nums text-white/60" style={row(1)}>
        <span className="w-9 text-right">{formatTime(player.progressSec)}</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(player.progressSec, duration || 1)}
          disabled={duration === 0}
          onChange={(e) => player.seek(Number(e.target.value))}
          className="h-1 flex-1 accent-primary"
          aria-label={t('soundbar.seek')}
          data-testid="slider-global-music-seek"
        />
        <span className="w-9">{formatTime(player.durationSec)}</span>
      </div>

      <div className="soundbar-row mt-1 flex items-center justify-between gap-2" style={row(2)}>
        <button
          type="button"
          onClick={player.toggleShuffle}
          aria-pressed={player.shuffle}
          aria-label={t('soundbar.shuffle')}
          className={`${toggleBtn} ${player.shuffle ? 'border-primary text-primary' : 'border-white/20 text-white/65 hover:border-primary'}`}
          data-testid="button-global-music-shuffle"
        >
          <Shuffle className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={player.cycleRepeat}
          aria-label={`${t('soundbar.repeat')}: ${player.repeat}`}
          className={`${toggleBtn} ${player.repeat !== 'off' ? 'border-primary text-primary' : 'border-white/20 text-white/65 hover:border-primary'}`}
          data-testid="button-global-music-repeat"
        >
          <RepeatIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => player.setPlaybackRate(SPEEDS[(speedIndex + 1) % SPEEDS.length]!)}
          aria-label={t('soundbar.speed')}
          className="h-7 min-w-[3rem] border border-white/20 px-2 font-mono text-[10px] font-bold text-white/80 hover:border-primary hover:text-primary"
          data-testid="button-global-music-speed"
        >
          {player.playbackRate}x
        </button>
      </div>
    </div>,
    document.body,
  );
}
