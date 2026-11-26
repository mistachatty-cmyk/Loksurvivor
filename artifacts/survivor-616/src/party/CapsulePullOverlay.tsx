/**
 * CapsulePullOverlay -- the Gold L capsule crack (Lok Party Slice 2).
 *
 * Vertical, one-thumb layout (reference 03): the capsule sits mid-screen, the reward card rises
 * to thumb height. Tap, swipe across the seam, or hold to crack it; the seam glows wider at each
 * stage, then a refraction burst, confetti, and the player's own rig modeling each reward.
 */

import { useEffect, useRef } from 'react';
import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { useT } from '@/lib/i18n';
import type { SpritePalette } from '@/game/types';
import { createJuice, drawRefractionRings, impact, Squash } from './juiceEngine';
import { createPull, pullHold, pullStep, pullSwipe, pullTap, seamGlow, type PullEvent } from './capsulePull';
import { COSMETICS_BY_ID, type CosmeticDef, type Shard } from './lokPartyMeta';

const CREAM = '#FAF6EE';
const RIG_SCALE = 4.6;
const ESPRESSO = '#3b2a20';
const RARITY_COLOR: Record<CosmeticDef['rarity'], string> = { common: '#38f2ff', rare: '#7cff6b', epic: '#ff3fd2', legendary: '#ffd23f' };
/** Accent colors for palette shards: the rig wears them on reveal. */
const PALETTE_ACCENTS: Record<string, string> = {
  'palette-monroe-neon': '#38f2ff',
  'palette-pawnford-dusk': '#e0a85a',
  'palette-thaw-glacier': '#bff3ff',
  'palette-astral-plum': '#b56cff',
};

interface Props {
  characterId: string;
  shards: Shard[];
  getAudioContext: () => AudioContext | null;
  onDone: () => void;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function CapsulePullOverlay({ characterId, shards, getAudioContext, onDone }: Props) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const textRef = useRef({ prompt: t('lokParty.pull.prompt'), tapNext: t('lokParty.pull.next'), done: t('lokParty.pull.done') });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const motion = prefersReducedMotion() ? 0 : 1;
    const juice = createJuice(getAudioContext, { motion, bpm: 96 });
    const pull = createPull(shards.length);
    const squash = new Squash();
    const capsuleSquash = new Squash();
    const def = CHARACTERS_BY_ID[characterId];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    type Bit = { x: number; y: number; vx: number; vy: number; r: number; vr: number; life: number; color: string; w: number; h: number };
    const bits: Bit[] = [];
    const confetti = (x: number, y: number, n: number, colors: string[]) => {
      const count = Math.round(n * (motion ? 1 : 0.3));
      for (let i = 0; i < count; i += 1) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
        const sp = 260 + Math.random() * 520;
        bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * 6, vr: (Math.random() - 0.5) * 18, life: 0, color: colors[i % colors.length], w: 4 + Math.random() * 6, h: 2 + Math.random() * 4 });
      }
    };

    let now = 0;
    let last = performance.now();
    let raf = 0;
    let shakeX = 0;
    const capsuleXY = () => ({ x: W / 2, y: H * 0.38 });

    const handle = (events: PullEvent[]) => {
      const c = capsuleXY();
      for (const e of events) {
        if (e.kind === 'stage') {
          impact(juice, now, c.x, c.y, 0.35 + e.stage * 0.2);
          capsuleSquash.land(0.6 + e.stage * 0.2);
          juice.chimes.pickup(now, { bright: true });
          juice.chimes.pickup(now + 1, { bright: true });
        } else if (e.kind === 'burst') {
          impact(juice, now, c.x, c.y, 1);
          juice.waves.spawn(c.x, c.y, now + 60, 1.4);
          juice.chimes.accent('crack');
          juice.chimes.accent('bank');
          confetti(c.x, c.y, 120, ['#ffd23f', '#fff3b0', '#38f2ff', '#ff3fd2', '#7cff6b']);
        } else if (e.kind === 'reveal') {
          const shard = shards[e.index];
          const cos = shard ? COSMETICS_BY_ID[shard.cosmeticId] : undefined;
          squash.launch(1);
          juice.camera.punch(0.1);
          if (cos) confetti(W / 2, H * 0.62, cos.rarity === 'legendary' ? 90 : cos.rarity === 'epic' ? 60 : 30, [RARITY_COLOR[cos.rarity], CREAM]);
          juice.chimes.accent(cos?.rarity === 'legendary' || cos?.rarity === 'epic' ? 'bank' : 'crack');
        } else if (e.kind === 'done') {
          cancelAnimationFrame(raf);
          doneRef.current();
        }
      }
    };

    // Input: pointerdown cracks (never pointerup); a drag across the seam adds by distance; holding adds over time.
    let down: { id: number; x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { id: e.pointerId, x: e.clientX, y: e.clientY };
      handle(pullTap(pull, now));
      pullHold(pull, true, now);
    };
    const onMove = (e: PointerEvent) => {
      if (!down || down.id !== e.pointerId) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      // Only motion across the seam (mostly horizontal) counts.
      if (Math.abs(dx) > Math.abs(dy)) handle(pullSwipe(pull, dx, now));
      down.x = e.clientX;
      down.y = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (down?.id === e.pointerId) down = null;
      pullHold(pull, false, now);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handle(pullTap(pull, now));
      }
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    // A button left focused under the overlay must not be pressed again by Enter or Space.
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.addEventListener('keydown', onKey);

    const frame = (ts: number) => {
      const dt = Math.min(100, ts - last);
      last = ts;
      now += dt;
      handle(pullStep(pull, dt, now));
      juice.camera.step(dt);
      juice.waves.prune(now);
      squash.step(dt);
      capsuleSquash.step(dt);
      for (const b of bits) {
        b.life += dt;
        b.x += (b.vx * dt) / 1000;
        b.y += (b.vy * dt) / 1000;
        b.vy += (900 * dt) / 1000;
        b.vx *= 0.99;
        b.r += (b.vr * dt) / 1000;
      }
      for (let i = bits.length - 1; i >= 0; i -= 1) if (bits[i].life > 2200 || bits[i].y > H + 40) bits.splice(i, 1);
      // Tremble grows with crack.
      shakeX = motion && pull.phase === 'cracking' ? Math.sin(now / 22) * pull.crack * 3 : 0;
      draw();
      raf = requestAnimationFrame(frame);
    };

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const bg = ctx.createRadialGradient(W * dpr * 0.5, H * dpr * 0.38, 10, W * dpr * 0.5, H * dpr * 0.38, Math.max(W, H) * dpr * 0.8);
      bg.addColorStop(0, '#2a1d5c');
      bg.addColorStop(1, '#07061a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { dx, dy } = juice.camera.shake();
      const z = juice.camera.zoomValue;
      ctx.save();
      ctx.translate(W / 2 + dx, H / 2 + dy);
      ctx.scale(z, z);
      ctx.translate(-W / 2, -H / 2);

      const c = capsuleXY();
      const glow = seamGlow(pull, now);
      const size = Math.min(W * 0.42, H * 0.26);
      if (pull.phase === 'idle' || pull.phase === 'cracking') drawCapsule(ctx, c.x + shakeX, c.y, size, glow, now, capsuleSquash);
      else if (pull.phase === 'burst') drawHalves(ctx, c.x, c.y, size, (now - pull.burstAt) / 650);

      // Rig + reward reveal.
      if (pull.phase === 'reveal' || pull.phase === 'burst') {
        const shard = pull.revealIndex >= 0 ? shards[pull.revealIndex] : undefined;
        const cos = shard ? COSMETICS_BY_ID[shard.cosmeticId] : undefined;
        if (def && pull.phase === 'reveal') {
          const fx = W / 2;
          const fy = H * 0.56;
          // Light pillar in the reward's rarity color.
          if (cos) {
            // Soft light pillar: stacked columns so the edges fade instead of cutting off.
            for (const [half, a] of [[90, 0.12], [60, 0.16], [30, 0.22]] as const) {
              const pg = ctx.createLinearGradient(0, fy - 300, 0, fy + 10);
              pg.addColorStop(0, 'rgba(0,0,0,0)');
              pg.addColorStop(1, hexA(RARITY_COLOR[cos.rarity], a));
              ctx.fillStyle = pg;
              ctx.beginPath();
              ctx.ellipse(fx, fy - 140, half, 160, 0, 0, Math.PI * 2);
              ctx.fill();
            }
            const floor = ctx.createRadialGradient(fx, fy, 2, fx, fy, 110);
            floor.addColorStop(0, hexA(RARITY_COLOR[cos.rarity], 0.45));
            floor.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = floor;
            ctx.beginPath();
            ctx.ellipse(fx, fy, 110, 34, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          drawShadow(ctx, fx, fy + 2, 34);
          const palette: SpritePalette = cos && PALETTE_ACCENTS[cos.id] ? { ...def.palette, accent: PALETTE_ACCENTS[cos.id], accentBright: PALETTE_ACCENTS[cos.id], glow: PALETTE_ACCENTS[cos.id] } : def.palette;
          ctx.save();
          ctx.translate(fx, fy);
          ctx.scale(squash.scaleX, squash.scaleY);
          if (cos?.kind === 'cape') drawCape(ctx, RARITY_COLOR[cos.rarity], now);
          drawRig(ctx, def.rig, palette, 'idle', now, 0, 0, 1, RIG_SCALE);
          if (cos?.kind === 'hat') drawHat(ctx, cos.id, -def.rig.pixelHeight * RIG_SCALE);
          ctx.restore();
        }
      }
      // Confetti.
      for (const b of bits) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - b.life / 2200);
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }
      ctx.restore();
      // Refraction rings re-sample the frame.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawRefractionRings(ctx, canvas, juice.waves, now, dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCard();
    };

    // Reward card at thumb height: pixel-on-cream with espresso border.
    const drawCard = () => {
      const text = textRef.current;
      const cardW = Math.min(W - 32, 360);
      const x = (W - cardW) / 2;
      const y = H * 0.7;
      if (pull.phase === 'idle' || pull.phase === 'cracking') {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 15px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(text.prompt, W / 2, y + 20);
        // Crack meter.
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 30, y + 40, cardW - 60, 8);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + 30, y + 40, (cardW - 60) * pull.crack, 8);
        return;
      }
      if (pull.phase !== 'reveal') return;
      const shard = shards[pull.revealIndex];
      const cos = shard ? COSMETICS_BY_ID[shard.cosmeticId] : undefined;
      if (!cos) return;
      const age = Math.min(1, (now - pull.revealAt) / 260);
      const rise = (1 - (1 - age) * (1 - age)) * 1;
      const cy = y + (1 - rise) * 60;
      ctx.globalAlpha = rise;
      ctx.fillStyle = ESPRESSO;
      roundRect(ctx, x, cy + 4, cardW, 112, 14);
      ctx.fill();
      ctx.fillStyle = CREAM;
      ctx.strokeStyle = ESPRESSO;
      ctx.lineWidth = 3;
      roundRect(ctx, x, cy, cardW, 112, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = RARITY_COLOR[cos.rarity];
      ctx.fillRect(x + 14, cy + 14, 8, 84);
      ctx.textAlign = 'left';
      ctx.fillStyle = ESPRESSO;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText(`${cos.rarity.toUpperCase()}  ${cos.kind.replace(/-/g, ' ').toUpperCase()}`, x + 34, cy + 30);
      ctx.font = '900 22px ui-sans-serif, system-ui';
      ctx.fillText(titleCase(cos.id), x + 34, cy + 60);
      ctx.font = '13px ui-sans-serif, system-ui';
      ctx.globalAlpha = rise * 0.75;
      ctx.fillText(pull.revealIndex + 1 < shards.length ? text.tapNext : text.done, x + 34, cy + 90);
      ctx.fillText(`${pull.revealIndex + 1} / ${shards.length}`, x + cardW - 58, cy + 90);
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [characterId, shards, getAudioContext]);

  return <canvas ref={canvasRef} data-testid="capsule-pull" className="fixed inset-0 z-50 h-full w-full" style={{ touchAction: 'none' }} />;
}

// ------------------------------------------------------------------ drawing

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function titleCase(id: string): string {
  return id
    .split('-')
    .slice(1)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function capsuleGradient(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  g.addColorStop(0, '#fff7c8');
  g.addColorStop(0.35, '#ffd23f');
  g.addColorStop(0.7, '#c9850f');
  g.addColorStop(1, '#6b3d05');
  return g;
}

function drawL(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = ESPRESSO;
  ctx.lineWidth = w * 0.13;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(-w * 0.14, -h * 0.28);
  ctx.lineTo(-w * 0.14, h * 0.22);
  ctx.lineTo(w * 0.2, h * 0.22);
  ctx.stroke();
}

function drawCapsule(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, glow: number, now: number, sq: Squash) {
  const w = size * 0.62;
  const h = size;
  ctx.save();
  ctx.translate(x, y + Math.sin(now / 420) * 5);
  ctx.scale(sq.scaleX, sq.scaleY);
  // Halo.
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, size * 0.9);
  halo.addColorStop(0, `rgba(255,210,63,${0.25 + glow * 0.45})`);
  halo.addColorStop(1, 'rgba(255,210,63,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.fillStyle = capsuleGradient(ctx, w, h);
  ctx.strokeStyle = ESPRESSO;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, w / 2);
  ctx.fill();
  ctx.stroke();
  // Specular stripe.
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.roundRect(-w * 0.32, -h * 0.4, w * 0.12, h * 0.55, w * 0.06);
  ctx.fill();
  // The seam: a line that becomes a widening, glowing crack.
  const open = glow * 7;
  ctx.shadowColor = '#fff3b0';
  ctx.shadowBlur = 8 + glow * 30;
  ctx.fillStyle = glow > 0.02 ? `rgba(255,250,220,${0.5 + glow * 0.5})` : ESPRESSO;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -1 - open);
  for (let i = 1; i <= 6; i += 1) ctx.lineTo(-w / 2 + (w * i) / 6, (i % 2 ? -1 : 1) * (2 + open));
  for (let i = 6; i >= 0; i -= 1) ctx.lineTo(-w / 2 + (w * i) / 6, (i % 2 ? 1 : -1) * (2 + open) * 0.4 + open * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  drawL(ctx, w, h);
  ctx.restore();
}

function drawHalves(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, p: number) {
  const t = Math.min(1, Math.max(0, p));
  const w = size * 0.62;
  const h = size;
  const fade = 1 - t;
  // Flash.
  ctx.save();
  ctx.globalAlpha = fade;
  const flash = ctx.createRadialGradient(x, y, 2, x, y, size * (1 + t * 2));
  flash.addColorStop(0, 'rgba(255,255,255,0.95)');
  flash.addColorStop(0.4, 'rgba(255,210,63,0.5)');
  flash.addColorStop(1, 'rgba(255,210,63,0)');
  ctx.fillStyle = flash;
  ctx.fillRect(x - size * 3, y - size * 3, size * 6, size * 6);
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(x + dir * t * size * 0.9, y + dir * -t * size * 0.6 + t * t * size);
    ctx.rotate(dir * t * 1.4);
    ctx.fillStyle = capsuleGradient(ctx, w, h);
    ctx.strokeStyle = ESPRESSO;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (dir < 0) ctx.roundRect(-w / 2, -h / 2, w, h / 2, [w / 2, w / 2, 0, 0]);
    else ctx.roundRect(-w / 2, 0, w, h / 2, [0, 0, w / 2, w / 2]);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawCape(ctx: CanvasRenderingContext2D, color: string, now: number) {
  const sway = Math.sin(now / 300) * 6;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = ESPRESSO;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-22, -110);
  ctx.lineTo(22, -110);
  ctx.lineTo(30 + sway, -6);
  ctx.lineTo(-30 + sway, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHat(ctx: CanvasRenderingContext2D, id: string, top: number) {
  ctx.save();
  ctx.strokeStyle = ESPRESSO;
  ctx.lineWidth = 2;
  if (id === 'hat-gold-crown') {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(-22, top + 4);
    ctx.lineTo(-22, top - 14);
    ctx.lineTo(-11, top - 4);
    ctx.lineTo(0, top - 20);
    ctx.lineTo(11, top - 4);
    ctx.lineTo(22, top - 14);
    ctx.lineTo(22, top + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = '#38f2ff';
    ctx.beginPath();
    ctx.roundRect(-20, top - 12, 40, 16, [10, 10, 0, 0]);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(4, top, 26, 5);
    ctx.strokeRect(4, top, 26, 5);
  }
  ctx.restore();
}
