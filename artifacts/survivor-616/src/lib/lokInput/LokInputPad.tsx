/**
 * LokInputPad -- the little translucent button that shows and switches the input mode
 * (mouse, keyboard, gamepad). Tap to cycle, drag to move it anywhere, lock it in place.
 * Original line art, no external icons. Standalone: text comes in through `labels`.
 */

import { useEffect, useRef, useState } from 'react';
import { getPrefs, nextMode, onPrefs, popBlip, setPrefs, type LokInputMode, type LokInputPrefs } from './core';

export interface LokInputLabels {
  pointer: string;
  keyboard: string;
  gamepad: string;
  lock: string;
  unlock: string;
  aria: string;
  /** One short line of controls per mode, shown under the pad while it is open. */
  legend: Record<LokInputMode, string>;
}

const INK = '#faf6ee';
const GLOW: Record<LokInputMode, string> = { pointer: '#38f2ff', keyboard: '#ffd23f', gamepad: '#ff3fd2' };

function Symbol({ mode }: { mode: LokInputMode }) {
  const c = GLOW[mode];
  const common = { fill: 'none', stroke: c, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  if (mode === 'pointer')
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <path d="M8 3 V19 L12 15.5 L15 22 L18 20.5 L15 14.5 L20.5 14 Z" {...common} />
      </svg>
    );
  if (mode === 'keyboard')
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="2.5" y="6.5" width="21" height="13" rx="3" {...common} />
        <path d="M7 11 H8 M11 11 H12 M15 11 H16 M19 11 H20 M8 15.5 H18" {...common} />
      </svg>
    );
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M7 8.5 H19 C22 8.5 24 12 24 15.5 C24 18.5 22.5 19.5 21 19.5 C19.5 19.5 19 18 17.5 17 H8.5 C7 18 6.5 19.5 5 19.5 C3.5 19.5 2 18.5 2 15.5 C2 12 4 8.5 7 8.5 Z" {...common} />
      <path d="M8 11.5 V15 M6.3 13.2 H9.7" {...common} />
      <circle cx="17" cy="12.5" r="1" fill={c} />
      <circle cx="19.5" cy="14.5" r="1" fill={c} />
    </svg>
  );
}

export function LokInputPad({ labels, getAudioContext }: { labels: LokInputLabels; getAudioContext: () => AudioContext | null }) {
  const [prefs, setLocal] = useState<LokInputPrefs>(getPrefs);
  const [open, setOpen] = useState(false);
  const [pops, setPops] = useState(0);
  const drag = useRef<{ id: number; dx: number; dy: number; moved: boolean; sx: number; sy: number } | null>(null);
  const closeTimer = useRef(0);

  useEffect(() => onPrefs(setLocal), []);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const pop = () => {
    setPops((n) => n + 1);
    popBlip(getAudioContext, getPrefs().mode);
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, sx: e.clientX, sy: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || getPrefs().locked) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 7) return;
    d.moved = true;
    setPrefs({ x: (e.clientX - d.dx) / window.innerWidth, y: (e.clientY - d.dy) / window.innerHeight });
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (d.moved) return;
    // A tap: cycle the mode with a pop, and keep the legend open for a moment.
    setPrefs({ mode: nextMode(getPrefs().mode) });
    pop();
    setOpen(true);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 3200);
  };

  const mode = prefs.mode;
  const glow = GLOW[mode];
  return (
    <div
      className="fixed z-[60] select-none"
      style={{ left: `${prefs.x * 100}%`, top: `${prefs.y * 100}%`, touchAction: 'none', opacity: open ? 0.95 : 0.55, transition: 'opacity 200ms' }}
      data-testid="lok-input-pad"
    >
      <style>{`@keyframes lokpop{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.1);opacity:0}}@keyframes lokbump{0%{transform:scale(.82)}55%{transform:scale(1.14)}100%{transform:scale(1)}}`}</style>
      <div className="flex items-center gap-1.5">
        <div
          role="button"
          tabIndex={-1}
          aria-label={`${labels.aria}: ${labels[mode]}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => (drag.current = null)}
          className="relative grid h-11 w-11 place-items-center rounded-full"
          style={{ background: 'rgba(7,6,26,0.55)', border: `2px solid ${glow}`, boxShadow: `0 0 14px ${glow}55`, cursor: prefs.locked ? 'pointer' : 'grab', backdropFilter: 'blur(2px)' }}
        >
          <span key={pops} className="absolute inset-0 rounded-full" style={{ border: `2px solid ${glow}`, animation: pops ? 'lokpop 420ms ease-out forwards' : undefined, pointerEvents: 'none' }} />
          <span key={`b${pops}`} style={{ display: 'grid', animation: pops ? 'lokbump 260ms ease-out' : undefined }}>
            <Symbol mode={mode} />
          </span>
        </div>
        {open ? (
          <div
            role="button"
            tabIndex={-1}
            aria-label={prefs.locked ? labels.unlock : labels.lock}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPrefs({ locked: !getPrefs().locked });
              pop();
            }}
            className="grid h-8 w-8 place-items-center rounded-full"
            style={{ background: 'rgba(7,6,26,0.55)', border: `2px solid ${prefs.locked ? '#7cff6b' : INK}` }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3" y="7" width="10" height="7" rx="2" fill="none" stroke={prefs.locked ? '#7cff6b' : INK} strokeWidth="1.8" />
              <path d={prefs.locked ? 'M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7' : 'M5.5 7 V5 a2.5 2.5 0 0 1 4.6 -1.4'} fill="none" stroke={prefs.locked ? '#7cff6b' : INK} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
        ) : null}
      </div>
      {open ? (
        <div className="mt-1.5 max-w-[220px] rounded-lg px-2 py-1 text-[11px] font-bold leading-tight" style={{ background: 'rgba(7,6,26,0.6)', color: INK, border: `1px solid ${glow}66` }}>
          <div style={{ color: glow }}>{labels[mode]}</div>
          {labels.legend[mode]}
        </div>
      ) : null}
    </div>
  );
}
