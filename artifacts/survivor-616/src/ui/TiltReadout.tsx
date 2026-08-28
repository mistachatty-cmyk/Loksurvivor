/**
 * Live tilt diagnostics.
 *
 * Tilt is the one input that cannot be checked from a desk: orientation events
 * do not fire on a laptop, so the only honest way to answer "is this working?"
 * is to put the numbers on screen and let the player look at their own phone.
 *
 * It also names the two ways tilt fails silently, because both look identical
 * to broken code from the outside:
 *   - the page is not on HTTPS, so no event is ever delivered
 *   - permission was never granted, so no event is ever delivered
 *
 * Values are written straight to the DOM from an animation frame rather than
 * held in React state -- this updates at 60Hz and re-rendering the settings
 * tree that fast to move a dot would be absurd.
 */

import { useEffect, useRef } from 'react';

import { gyroNeedsSecureContext, useGyroInput } from '@/game/input/gyro';

export interface TiltReadoutProps {
  enabled: boolean;
  sensitivity: number;
  invertY: boolean;
}

const ORIENTATION_LABELS: Record<number, string> = {
  0: 'Portrait',
  90: 'Landscape',
  180: 'Portrait (inverted)',
  270: 'Landscape (other way)',
};

export function TiltReadout({ enabled, sensitivity, invertY }: TiltReadoutProps) {
  const { readingRef, recenter } = useGyroInput({ enabled, sensitivity, invertY });

  const dotRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const anglesRef = useRef<HTMLSpanElement>(null);
  const outputRef = useRef<HTMLSpanElement>(null);
  const holdRef = useRef<HTMLSpanElement>(null);

  const insecure = gyroNeedsSecureContext();

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const reading = readingRef.current;

      if (dotRef.current) {
        // 40px of travel each way, so full deflection is unmistakable.
        dotRef.current.style.transform = `translate(${reading.x * 40}px, ${reading.y * 40}px)`;
        dotRef.current.style.opacity = reading.active ? '1' : '0.25';
      }
      if (statusRef.current) {
        statusRef.current.textContent = reading.active ? 'receiving' : 'no signal';
        statusRef.current.className = reading.active
          ? 'font-mono text-emerald-300'
          : 'font-mono text-amber-300';
      }
      if (anglesRef.current) {
        anglesRef.current.textContent = `β ${reading.beta.toFixed(1)}°  γ ${reading.gamma.toFixed(1)}°`;
      }
      if (outputRef.current) {
        outputRef.current.textContent = `x ${reading.x.toFixed(2)}  y ${reading.y.toFixed(2)}`;
      }
      if (holdRef.current) {
        holdRef.current.textContent =
          ORIENTATION_LABELS[reading.screenAngle] ?? `${reading.screenAngle}°`;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, readingRef]);

  if (!enabled) return null;

  return (
    <div className="mt-4 border border-border/70 bg-background/50 p-4" data-testid="panel-tilt-readout">
      {insecure && (
        <p className="mb-3 border border-amber-300/40 bg-amber-400/10 p-2 text-xs text-amber-200" data-testid="text-tilt-insecure">
          This page is not on a secure connection, so the browser will never send
          orientation. Open the site over https rather than by local network address.
        </p>
      )}

      <div className="flex items-center gap-4">
        <div className="relative grid h-24 w-24 shrink-0 place-items-center border border-border bg-black/40">
          {/* Crosshair, so centre is obvious at a glance. */}
          <div className="absolute h-px w-full bg-white/10" />
          <div className="absolute h-full w-px bg-white/10" />
          <div
            ref={dotRef}
            className="h-3 w-3 rounded-full bg-emerald-300 transition-opacity"
            data-testid="dot-tilt"
          />
        </div>

        <dl className="min-w-0 flex-1 space-y-1 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Sensor</dt>
            <dd><span ref={statusRef} className="font-mono text-amber-300" data-testid="text-tilt-status">no signal</span></dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Raw</dt>
            <dd><span ref={anglesRef} className="font-mono text-white" data-testid="text-tilt-angles">—</span></dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Steering</dt>
            <dd><span ref={outputRef} className="font-mono text-white" data-testid="text-tilt-output">—</span></dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Held</dt>
            <dd><span ref={holdRef} className="font-mono text-white" data-testid="text-tilt-orientation">—</span></dd>
          </div>
        </dl>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={recenter}
          className="border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:border-emerald-300/60 hover:text-white"
          data-testid="button-tilt-recenter"
        >
          Set neutral
        </button>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Hold the device how you play and set the neutral. The dot should follow
          your tilt, and rotating the device should not change which way it moves.
        </p>
      </div>
    </div>
  );
}
