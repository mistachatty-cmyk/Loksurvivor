/**
 * A loading screen you can walk around in. While a crew run connects (or a heavy screen loads), the player's
 * own operator strolls a quiet 616 street: left and right keys, or a press on the left or right of the screen,
 * walk; up, space or a press in the middle hops. Glowing chips can be picked up, pads bounce, pigeons scatter.
 * It is only a toy: nothing here is saved or paid out. Procedural canvas art only, capped at 30 frames a
 * second, and it stops drawing while the page is hidden.
 */
import { useEffect, useRef, useState } from 'react';

import type { CharacterDef } from '@/game/types';
import { drawRig } from '@/game/render/sprite';
import { useT } from '@/lib/i18n';

interface Props {
  /** The operator who walks. Falls back to a plain silhouette if none is given. */
  character?: CharacterDef | null;
  title: string;
  /** What is happening right now, in words. */
  status: string;
  /** 0..1 while known; null shows a gentle moving bar. */
  progress?: number | null;
  /** When true the button to continue is shown. */
  ready?: boolean;
  onEnter?: () => void;
  /** A way out while waiting. */
  onCancel?: () => void;
  cancelLabel?: string;
}

const FRAME_MS = 1000 / 30;
const GRAVITY = 1500;
const WALK_SPEED = 120;
const SCALE = 2.4;
const SPACING = 360;

/** Small deterministic noise so the street is the same every visit without storing anything. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Thing { kind: 'chip' | 'pad' | 'pigeon' | 'lamp'; x: number; taken?: boolean; scatter?: number }

function thingsAround(cell: number): Thing[] {
  const base = cell * SPACING;
  const out: Thing[] = [{ kind: 'lamp', x: base + 40 }];
  const roll = hash(cell * 3.1);
  if (roll < 0.34) out.push({ kind: 'pad', x: base + 190 });
  else if (roll < 0.66) out.push({ kind: 'pigeon', x: base + 250 });
  for (let i = 0; i < 2; i += 1) if (hash(cell * 7.7 + i) < 0.7) out.push({ kind: 'chip', x: base + 90 + i * 70 + hash(cell + i) * 40 });
  return out;
}

export function WalkingLoader({ character, title, status, progress = null, ready = false, onEnter, onCancel, cancelLabel }: Props) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef(new Set<string>());
  const press = useRef<'left' | 'right' | null>(null);
  const jumpQueued = useRef(false);
  const [chips, setChips] = useState(0);
  const live = useRef({ progress, ready, character });
  live.current = { progress, ready, character };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) keys.current.add(key);
      if ([' ', 'arrowup', 'w'].includes(key)) { jumpQueued.current = true; if (key === ' ' || key === 'arrowup') event.preventDefault(); }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const player = { x: 0, y: 0, vy: 0, facing: 1 as 1 | -1, walking: false };
    const cells = new Map<number, Thing[]>();
    const sparks: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
    let collected = 0;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let clock = 0;
    let width = 1;
    let height = 1;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const bw = Math.round(width * ratio);
      const bh = Math.round(height * ratio);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      ctx.setTransform(bw / width, 0, 0, bh / height, 0, 0);
    };
    resize();

    const thingsFor = (cell: number) => {
      let list = cells.get(cell);
      if (!list) { list = thingsAround(cell); cells.set(cell, list); if (cells.size > 40) cells.delete(cells.keys().next().value as number); }
      return list;
    };

    const step = (dt: number) => {
      const groundY = 0;
      const left = keys.current.has('arrowleft') || keys.current.has('a') || press.current === 'left';
      const right = keys.current.has('arrowright') || keys.current.has('d') || press.current === 'right';
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      player.walking = dir !== 0;
      if (dir !== 0) { player.x += dir * WALK_SPEED * dt; player.facing = dir > 0 ? 1 : -1; }
      if (jumpQueued.current && player.y >= groundY) player.vy = -520;
      jumpQueued.current = false;
      player.vy += GRAVITY * dt;
      player.y = Math.min(groundY, player.y + player.vy * dt);
      if (player.y >= groundY) player.vy = 0;
      const cell = Math.floor(player.x / SPACING);
      for (let c = cell - 1; c <= cell + 1; c += 1) {
        for (const thing of thingsFor(c)) {
          const dx = Math.abs(thing.x - player.x);
          if (thing.kind === 'chip' && !thing.taken && dx < 16 && player.y > -70) {
            thing.taken = true; collected += 1; setChips(collected);
            for (let i = 0; i < 6 && !reduced; i += 1) sparks.push({ x: thing.x, y: -50, vx: (hash(i + clock) - 0.5) * 120, vy: -60 - hash(i * 3) * 80, life: 0.5 });
          } else if (thing.kind === 'pad' && dx < 22 && player.y >= groundY - 2 && player.vy >= 0) {
            player.vy = -760;
          } else if (thing.kind === 'pigeon' && dx < 70 && !thing.scatter && !reduced) {
            thing.scatter = 0.0001;
          }
          if (thing.scatter) thing.scatter += dt;
        }
      }
      for (const spark of sparks) { spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.vy += 300 * dt; spark.life -= dt; }
      while (sparks.length && sparks[0]!.life <= 0) sparks.shift();
    };

    const draw = () => {
      const { progress: p, ready: isReady } = live.current;
      const ground = height * 0.74;
      const camX = player.x - width * 0.5;
      // Sky: slowly drifts from dusk to night to dawn.
      const phase = (clock / 90) % 1;
      const night = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
      const sky = ctx.createLinearGradient(0, 0, 0, ground);
      sky.addColorStop(0, `rgb(${Math.round(18 + 30 * (1 - night))},${Math.round(14 + 18 * (1 - night))},${Math.round(44 + 40 * (1 - night))})`);
      sky.addColorStop(1, `rgb(${Math.round(70 + 120 * (1 - night))},${Math.round(40 + 40 * (1 - night))},${Math.round(90 + 20 * (1 - night))})`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      // Stars.
      ctx.fillStyle = `rgba(255,255,255,${0.15 + night * 0.6})`;
      for (let i = 0; i < 40; i += 1) ctx.fillRect(hash(i) * width, hash(i + 90) * ground * 0.6, 1.5, 1.5);
      // Far skyline (slow), then near buildings.
      for (const layer of [{ speed: 0.18, shade: 0.22, tall: 150, w: 70 }, { speed: 0.42, shade: 0.32, tall: 110, w: 90 }]) {
        const cellW = layer.w;
        const first = Math.floor((camX * layer.speed) / cellW) - 1;
        for (let i = first; i < first + Math.ceil(width / cellW) + 3; i += 1) {
          const h = 40 + hash(i * 1.7 + layer.tall) * layer.tall;
          const x = i * cellW - camX * layer.speed;
          ctx.fillStyle = `rgb(${Math.round(30 * layer.shade * 3)},${Math.round(26 * layer.shade * 3)},${Math.round(56 * layer.shade * 3)})`;
          ctx.fillRect(x, ground - h, cellW - 6, h);
          ctx.fillStyle = `rgba(255,224,150,${0.25 + night * 0.4})`;
          for (let wy = ground - h + 8; wy < ground - 10; wy += 14) for (let wx = x + 8; wx < x + cellW - 14; wx += 14) if (hash(wx * 0.31 + wy * 0.7 + i) < 0.4) ctx.fillRect(wx, wy, 4, 5);
        }
      }
      // Pavement and road line.
      ctx.fillStyle = '#1b1830'; ctx.fillRect(0, ground, width, height - ground);
      ctx.fillStyle = '#2a2547'; ctx.fillRect(0, ground, width, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      const dash = 60;
      for (let x = -((camX % (dash * 2)) + dash * 2); x < width + dash; x += dash * 2) ctx.fillRect(x, ground + (height - ground) * 0.55, dash, 3);

      // Things on the street.
      const cell = Math.floor(player.x / SPACING);
      for (let c = cell - 3; c <= cell + 3; c += 1) {
        for (const thing of thingsFor(c)) {
          const sx = thing.x - camX;
          if (sx < -40 || sx > width + 40) continue;
          if (thing.kind === 'lamp') {
            ctx.fillStyle = '#3b3766'; ctx.fillRect(sx - 2, ground - 96, 4, 96); ctx.fillRect(sx - 2, ground - 96, 18, 4);
            ctx.fillStyle = `rgba(255,236,170,${0.5 + night * 0.5})`; ctx.fillRect(sx + 12, ground - 92, 8, 5);
            const glow = ctx.createRadialGradient(sx + 16, ground - 88, 2, sx + 16, ground - 60, 80);
            glow.addColorStop(0, `rgba(255,236,170,${0.28 * night + 0.05})`); glow.addColorStop(1, 'rgba(255,236,170,0)');
            ctx.fillStyle = glow; ctx.fillRect(sx - 70, ground - 150, 170, 170);
          } else if (thing.kind === 'pad') {
            ctx.fillStyle = '#f472b6'; ctx.fillRect(sx - 18, ground - 6, 36, 6);
            ctx.fillStyle = '#fdf2f8'; ctx.fillRect(sx - 14, ground - 8, 28, 2);
          } else if (thing.kind === 'chip' && !thing.taken) {
            const bob = Math.sin(clock * 3 + thing.x) * 4;
            ctx.fillStyle = '#67e8f9'; ctx.fillRect(sx - 5, ground - 54 + bob, 10, 10);
            ctx.fillStyle = '#ecfeff'; ctx.fillRect(sx - 2, ground - 51 + bob, 4, 4);
          } else if (thing.kind === 'pigeon') {
            const flown = thing.scatter ?? 0;
            const fx = sx + flown * 160;
            const fy = ground - 7 - flown * flown * 120 - flown * 90;
            ctx.fillStyle = '#9ca3af'; ctx.fillRect(fx - 6, fy - 6, 12, 6); ctx.fillRect(fx + 3, fy - 10, 5, 5);
            if (flown > 0) { ctx.fillRect(fx - 8, fy - 12 + Math.sin(clock * 30) * 3, 8, 3); }
          }
        }
      }
      for (const spark of sparks) { ctx.fillStyle = `rgba(103,232,249,${Math.max(0, spark.life * 2)})`; ctx.fillRect(spark.x - camX, ground + spark.y, 3, 3); }

      // The walker.
      const px = width * 0.5;
      const py = ground + player.y;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px, ground + 2, 16 - Math.min(8, -player.y / 12), 5, 0, 0, Math.PI * 2); ctx.fill();
      const who = live.current.character;
      if (who) drawRig(ctx, who.rig, who.palette, player.walking && player.y >= -1 ? 'walk' : 'idle', clock * 1000, px, py, player.facing, SCALE);
      else { ctx.fillStyle = '#e9d5ff'; ctx.fillRect(px - 8, py - 44, 16, 44); }

      // Loading bar at the bottom edge of the street.
      const barW = Math.min(width - 48, 360);
      const bx = (width - barW) / 2;
      const by = height - 78;
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(bx, by, barW, 6);
      ctx.fillStyle = isReady ? '#34d399' : '#f0abfc';
      if (p === null || p === undefined) { const seg = barW * 0.28; ctx.fillRect(bx + ((clock * 0.45) % 1) * (barW - seg), by, seg, 6); }
      else ctx.fillRect(bx, by, barW * Math.max(0, Math.min(1, p)), 6);
    };

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = time; return; }
      acc += time - last; last = time;
      if (acc < FRAME_MS) return;
      const dt = Math.min(acc, 100) / 1000;
      acc = 0; clock += dt;
      if (Math.floor(clock * 4) % 20 === 0) resize();
      step(dt);
      draw();
    };
    raf = requestAnimationFrame(frame);
    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    if (fraction < 0.36) press.current = 'left';
    else if (fraction > 0.64) press.current = 'right';
    else jumpQueued.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const stopPress = () => { press.current = null; };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black" data-testid="walking-loader">
      <canvas ref={canvasRef} className="block h-full w-full touch-none select-none" onPointerDown={onPointerDown} onPointerUp={stopPress} onPointerCancel={stopPress} onPointerLeave={stopPress} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 px-4 pt-[max(1.5rem,var(--safe-top))] text-center">
        <h2 className="font-mono text-lg font-black uppercase tracking-[0.2em] text-white drop-shadow">{title}</h2>
        <p className="font-mono text-xs text-fuchsia-100" role="status" aria-live="polite" data-testid="walking-status">{status}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">{t('walk.hint')}</p>
      </div>
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3 px-4 pb-[max(0.25rem,var(--safe-bottom))]">
        <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-200" data-testid="walking-chips">{t('walk.chips', { n: String(chips) })}</span>
        {ready && onEnter ? <button type="button" onClick={onEnter} className="border border-emerald-300/60 bg-emerald-400/20 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-emerald-50" data-testid="button-walking-enter">{t('walk.enter')}</button> : null}
        {onCancel ? <button type="button" onClick={onCancel} className="border border-white/30 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white/80 hover:text-white" data-testid="button-walking-cancel">{cancelLabel ?? t('walk.back')}</button> : null}
      </div>
    </div>
  );
}
