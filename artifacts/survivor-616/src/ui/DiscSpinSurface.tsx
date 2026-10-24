/**
 * An invisible circle laid over the chosen disc that lets it be spun by hand, like a record:
 * drag around the middle and the disc follows, flick and it coasts to a stop. It never changes
 * the song. A short tap on it is handed back (`onTap`) so a tap still plays or pauses.
 *
 * It writes one CSS variable on the chosen disc's own spinning layer and nothing else, so no
 * other disc repaints (see `.agents/memory/mobile-stability-2026-10-22.md`).
 */
import { useCallback, useEffect, useRef, type RefObject } from 'react';

import { angleAround, coast, isTap, releaseSpeed, turnBetween, type SpinSample } from '@/lib/discSpin';

const SPIN_VAR = '--dcc-user-spin';
/** Degrees of turning between small haptic ticks (phones that support it). */
const TICK_EVERY = 40;

interface Drag {
  id: number;
  cx: number;
  cy: number;
  lastAngle: number;
  total: number;
  samples: SpinSample[];
  x0: number;
  y0: number;
  t0: number;
  travel: number;
  ticks: number;
}

export interface DiscSpinSurfaceProps {
  /** Any ancestor holding the carousel; the chosen disc is looked up inside it. */
  containerRef: RefObject<HTMLElement | null>;
  /** Same CSS length the carousel uses for its discs. */
  discSize: string;
  /** Called for a short tap that did not spin the disc. */
  onTap?: () => void;
  label: string;
  /** Where the disc sits from the top of the carousel (the carousel's stage is at 52%). */
  top?: string;
}

export function DiscSpinSurface({ containerRef, discSize, onTap, label, top = '52%' }: DiscSpinSurfaceProps) {
  const angleRef = useRef(0);
  const speedRef = useRef(0);
  const rafRef = useRef(0);
  const dragRef = useRef<Drag | null>(null);

  const target = useCallback(
    () => containerRef.current?.querySelector<HTMLElement>('.dcc-slide[data-active] .dcc-roll') ?? null,
    [containerRef],
  );
  const apply = useCallback(
    (deg: number) => {
      angleRef.current = deg;
      target()?.style.setProperty(SPIN_VAR, `${deg.toFixed(2)}deg`);
    },
    [target],
  );
  const readAngle = useCallback(() => {
    const raw = target()?.style.getPropertyValue(SPIN_VAR) ?? '';
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [target]);

  const stopCoast = useCallback(() => {
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    speedRef.current = 0;
  }, []);

  const startCoast = useCallback(
    (speed: number) => {
      stopCoast();
      speedRef.current = speed;
      if (speed === 0) return;
      let last = performance.now();
      const frame = (now: number) => {
        const step = coast(angleRef.current, speedRef.current, now - last);
        last = now;
        apply(step.angle);
        speedRef.current = step.speed;
        rafRef.current = step.speed === 0 ? 0 : window.requestAnimationFrame(frame);
      };
      rafRef.current = window.requestAnimationFrame(frame);
    },
    [apply, stopCoast],
  );

  useEffect(() => stopCoast, [stopCoast]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    stopCoast();
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const start = readAngle();
    angleRef.current = start;
    dragRef.current = {
      id: e.pointerId,
      cx,
      cy,
      lastAngle: angleAround(cx, cy, e.clientX, e.clientY),
      total: 0,
      samples: [{ t: e.timeStamp, angle: 0 }],
      x0: e.clientX,
      y0: e.clientY,
      t0: e.timeStamp,
      travel: 0,
      ticks: 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    d.travel = Math.max(d.travel, Math.hypot(e.clientX - d.x0, e.clientY - d.y0));
    const a = angleAround(d.cx, d.cy, e.clientX, e.clientY);
    const delta = turnBetween(d.lastAngle, a);
    d.lastAngle = a;
    d.total += delta;
    apply(angleRef.current + delta);
    d.samples.push({ t: e.timeStamp, angle: d.total });
    if (d.samples.length > 8) d.samples.shift();
    const ticks = Math.floor(Math.abs(d.total) / TICK_EVERY);
    if (ticks !== d.ticks) {
      d.ticks = ticks;
      try {
        navigator.vibrate?.(3);
      } catch {
        /* haptics are optional */
      }
    }
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    if (!cancelled && isTap(d.travel, e.timeStamp - d.t0)) {
      onTap?.();
      return;
    }
    startCoast(cancelled ? 0 : releaseSpeed(d.samples));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      angleRef.current = readAngle();
      startCoast(e.key === 'ArrowRight' ? 520 : -520);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid="disc-spin-surface"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onKeyDown={onKeyDown}
      className="absolute z-[6] cursor-grab rounded-full outline-none ring-1 ring-white/25 focus-visible:ring-2 focus-visible:ring-white/70 active:cursor-grabbing"
      style={{
        left: '50%',
        top,
        width: discSize,
        aspectRatio: '1 / 1',
        transform: 'translate(-50%, -50%)',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        boxShadow: '0 0 0 6px rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.12)',
      }}
    />
  );
}
