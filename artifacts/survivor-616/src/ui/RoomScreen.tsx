/**
 * A walkable room: your selected character walks around a `RoomLayout`, and every object in it does one thing
 * (opens a panel, leads through a door, pulls the hall lever, shows a note). Used for the 616 bedroom and the
 * universal hall. Keyboard (WASD, arrows, E or Enter to use), tap-to-walk on touch, and an on-screen button for
 * the object in reach so it never needs a precise tap. All movement and collision come from the shared rooms
 * contract (`lib/lok-universe/src/rooms.ts`). Reduced motion removes the bob and glow pulses' motion only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nearestAnchor, startPos, stepAvatar, useTiles, type RoomAnchor, type RoomLayout, type RoomPos } from '../../../../lib/lok-universe/src/rooms';
import { drawRig, drawShadow } from '@/game/render/sprite';
import type { CharacterDef } from '@/game/types';
import { useT } from '@/lib/i18n';
import { drawAnchor, drawRoomBase, type RoomSkin } from './roomSkins';

const SPEED = 150;          // world units per second
const AVATAR_SCALE = 1.7;

export interface RoomScreenProps {
  layout: RoomLayout;
  skin: RoomSkin;
  character: CharacterDef;
  /** The text shown on the use button for an object. */
  labelFor: (a: RoomAnchor) => string;
  onUse: (a: RoomAnchor) => void;
  onBack: () => void;
  title: string;
  /** Lever state for drawing; only the bedroom has one. */
  leverPublic?: boolean;
  /** A short message to show (lever result, notes). Shown for a few seconds. */
  notice?: string;
  /** Live save info drawn on objects. */
  status?: Record<string, { count?: number; alert?: boolean }>;
  testId: string;
}

export function RoomScreen({ layout, skin, character, labelFor, onUse, onBack, title, leverPublic = false, notice, status, testId }: RoomScreenProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const posRef = useRef<RoomPos>(startPos(layout));
  const keysRef = useRef<Set<string>>(new Set());
  const targetRef = useRef<{ pos: RoomPos; use?: string } | null>(null);
  const facingRef = useRef<1 | -1>(1);
  const movingRef = useRef(false);
  const focusRef = useRef<string | null>(null);
  const [focus, setFocus] = useState<RoomAnchor | null>(null);
  const reduceMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const useRef2 = useRef(onUse);
  useRef2.current = onUse;
  const statusRef = useRef(status);
  statusRef.current = status;
  const leverRef = useRef(leverPublic);
  leverRef.current = leverPublic;

  const use = useCallback((a: RoomAnchor | null) => { if (a && a.enabled !== false) useRef2.current(a); else if (a) useRef2.current(a); }, []);

  useEffect(() => {
    posRef.current = startPos(layout);
    targetRef.current = null;
  }, [layout]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keysRef.current.add(k); targetRef.current = null; e.preventDefault(); }
      if (k === 'e' || k === 'enter' || k === ' ') { const a = nearestAnchor(layout, posRef.current); if (a) { e.preventDefault(); use(a); } }
      if (k === 'escape') onBack();
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [layout, onBack, use]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const start = last;
    const frame = (nowMs: number) => {
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      // Fit the room to the canvas, keeping it sharp on high-density screens.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
      const worldW = layout.cols * layout.tile, worldH = layout.rows * layout.tile;
      const scale = Math.min(cw / worldW, ch / worldH);

      // Movement: keys first, otherwise walk toward a tapped target (and use what was tapped on arrival).
      let dx = 0, dy = 0;
      const keys = keysRef.current;
      if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
      if (keys.has('arrowright') || keys.has('d')) dx += 1;
      if (keys.has('arrowup') || keys.has('w')) dy -= 1;
      if (keys.has('arrowdown') || keys.has('s')) dy += 1;
      const tgt = targetRef.current;
      if (dx === 0 && dy === 0 && tgt) {
        const vx = tgt.pos.x - posRef.current.x, vy = tgt.pos.y - posRef.current.y;
        const d = Math.hypot(vx, vy);
        if (d < 4) {
          const usedId = tgt.use;
          targetRef.current = null;
          if (usedId) use(layout.anchors.find((a) => a.id === usedId) ?? null);
        } else { dx = vx / d; dy = vy / d; }
      }
      const len = Math.hypot(dx, dy);
      movingRef.current = len > 0;
      if (len > 0) {
        const before = posRef.current;
        posRef.current = stepAvatar(layout, before, (dx / len) * SPEED * dt, (dy / len) * SPEED * dt);
        if (dx !== 0) facingRef.current = dx > 0 ? 1 : -1;
        if (targetRef.current && posRef.current.x === before.x && posRef.current.y === before.y) targetRef.current = null;   // stuck: give up
      }

      const near = nearestAnchor(layout, posRef.current);
      if ((near?.id ?? null) !== focusRef.current) { focusRef.current = near?.id ?? null; setFocus(near); }

      const now = nowMs - start;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = skin.ink;
      ctx.fillRect(0, 0, cw, ch);
      ctx.save();
      ctx.translate((cw - worldW * scale) / 2, (ch - worldH * scale) / 2);
      ctx.scale(scale, scale);
      const state = { now: reduceMotion ? 0 : now, focusId: focusRef.current, leverPublic: leverRef.current, status: statusRef.current };
      drawRoomBase(ctx, layout, skin, state);
      // Draw objects and the avatar sorted by their feet so the avatar walks behind and in front of furniture.
      const feetY = posRef.current.y;
      const drawables: Array<{ y: number; draw: () => void }> = layout.anchors.map((a) => ({ y: (a.row + a.h) * layout.tile, draw: () => drawAnchor(ctx, layout, skin, a, state) }));
      drawables.push({
        y: feetY,
        draw: () => {
          drawShadow(ctx, posRef.current.x, feetY + 2, 11);
          const bob = reduceMotion || !movingRef.current ? 0 : Math.abs(Math.sin(now / 110)) * 1.5;
          drawRig(ctx, character.rig, character.palette, movingRef.current ? 'walk' : 'idle', now, posRef.current.x, feetY - bob, facingRef.current, AVATAR_SCALE, { outline: true });
        },
      });
      drawables.sort((p, q) => p.y - q.y).forEach((d) => d.draw());
      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [layout, skin, character, reduceMotion, use]);

  /** Tap or click: on an object, walk to the nearest free tile beside it and use it; on the floor, just walk there. */
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const worldW = layout.cols * layout.tile, worldH = layout.rows * layout.tile;
    const scale = Math.min(rect.width / worldW, rect.height / worldH);
    const wx = (e.clientX - rect.left - (rect.width - worldW * scale) / 2) / scale;
    const wy = (e.clientY - rect.top - (rect.height - worldH * scale) / 2) / scale;
    const hit = layout.anchors.find((a) => wx >= a.col * layout.tile && wx < (a.col + a.w) * layout.tile && wy >= a.row * layout.tile && wy < (a.row + a.h) * layout.tile);
    if (hit) {
      const tiles = useTiles(layout, hit);
      if (tiles.length === 0) return;
      const best = tiles.reduce((b, c) => (Math.hypot(c.col - posRef.current.x / layout.tile, c.row - posRef.current.y / layout.tile) < Math.hypot(b.col - posRef.current.x / layout.tile, b.row - posRef.current.y / layout.tile) ? c : b));
      targetRef.current = { pos: { x: (best.col + 0.5) * layout.tile, y: (best.row + 0.5) * layout.tile }, use: hit.id };
    } else {
      targetRef.current = { pos: { x: Math.max(layout.tile * 0.4, Math.min(worldW - layout.tile * 0.4, wx)), y: Math.max(layout.tile * 2.4, Math.min(worldH - layout.tile * 0.4, wy)) } };
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-black text-white" data-testid={testId}>
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <button type="button" onClick={onBack} className="border border-white/25 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest hover:border-white/70" data-testid={`${testId}-back`}>{t('room.back')}</button>
        <h1 className="font-mono text-xs font-bold uppercase tracking-[.25em] text-white/80">{title}</h1>
        <span className="w-16" aria-hidden />
      </header>
      <canvas ref={canvasRef} onPointerDown={onPointerDown} className="min-h-0 w-full flex-1 touch-none" style={{ imageRendering: 'pixelated' }} aria-label={title} data-testid={`${testId}-canvas`} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {notice ? <p className="pointer-events-auto max-w-md border border-white/25 bg-black/80 px-3 py-2 text-center font-mono text-[11px] uppercase tracking-widest text-amber-100" role="status" data-testid={`${testId}-notice`}>{notice}</p> : null}
        {focus ? (
          <button type="button" onClick={() => use(focus)} className="pointer-events-auto min-h-11 min-w-48 border border-cyan-200/70 bg-black/85 px-5 py-2 font-mono text-xs font-bold uppercase tracking-widest text-cyan-100 transition active:scale-95 hover:bg-cyan-950" data-testid={`${testId}-use`}>
            {labelFor(focus)}
          </button>
        ) : <p className="font-mono text-[10px] uppercase tracking-widest text-white/45">{t('room.hint')}</p>}
      </div>
    </div>
  );
}
