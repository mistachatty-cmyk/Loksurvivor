/**
 * Dungeon objective art: the stairs-down doorway, the way-out marker and the treasure chest.
 * Procedural Canvas2D, no bitmaps. Every animation is a pure function of `w.now`.
 */
import { drawGlyph } from '../../ui/lokGlyphCanvas';
import type { World } from '@/game/engine/world';
import { drawShadow } from './sprite';

const STONE_DARK = '#171a22';
const STONE = '#3a3f4d';
const STONE_LIGHT = '#6b7388';

/** A stone archway with steps going down, torch light on both sides and motes rising out of the dark. */
export function drawDungeonEntrances(ctx: CanvasRenderingContext2D, w: World): void {
  const e = w.endless;
  if (!e || e.inDungeon) return;
  const pulse = 0.5 + Math.sin(w.now / 380) * 0.5;
  for (const en of e.dungeonEntrances) {
    const x = en.x - en.w / 2, y = en.y - en.h / 2, W = en.w, H = en.h;
    ctx.save();
    drawShadow(ctx, en.x, y + H + 2, W * 0.6);
    // Dark mouth, lit from below by the stairs.
    const mouth = ctx.createLinearGradient(0, y, 0, y + H);
    mouth.addColorStop(0, '#05060a');
    mouth.addColorStop(1, '#2a1d10');
    ctx.fillStyle = mouth;
    ctx.fillRect(x + 4, y + 4, W - 8, H - 4);
    // Steps going down into the dark.
    for (let i = 0; i < 4; i += 1) {
      const sy = y + H - 6 - i * (H / 7), inset = 6 + i * 3;
      ctx.fillStyle = i % 2 ? '#3a2a18' : '#4d3920';
      ctx.fillRect(x + inset, sy, W - inset * 2, Math.max(2, H / 14));
    }
    // Posts, lintel and a keystone.
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(x - 3, y - 3, 9, H + 6);
    ctx.fillRect(x + W - 6, y - 3, 9, H + 6);
    ctx.fillRect(x - 3, y - 6, W + 6, 9);
    ctx.fillStyle = STONE;
    ctx.fillRect(x - 3, y - 3, 3, H + 6);
    ctx.fillRect(x + W, y - 3, 3, H + 6);
    ctx.fillRect(x - 3, y - 6, W + 6, 3);
    ctx.fillStyle = STONE_LIGHT;
    ctx.fillRect(en.x - 5, y - 8, 10, 6);
    // Torch flames either side that flicker out of step.
    for (const [side, phase] of [[-1, 0], [1, 2.1]] as const) {
      const fx = en.x + side * (W / 2 + 9), fy = y + 10;
      const flick = 0.6 + Math.sin(w.now / 90 + phase) * 0.25 + Math.sin(w.now / 37 + phase) * 0.15;
      const glow = ctx.createRadialGradient(fx, fy, 1, fx, fy, 26 * flick);
      glow.addColorStop(0, 'rgba(255,190,90,0.5)');
      glow.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(fx - 28, fy - 28, 56, 56);
      ctx.fillStyle = '#f0a848';
      ctx.beginPath();
      ctx.moveTo(fx - 3, fy + 4); ctx.lineTo(fx, fy - 7 * flick - 2); ctx.lineTo(fx + 3, fy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(fx - 1, fy - 1, 2, 4);
    }
    // Motes drifting up out of the stairwell.
    ctx.fillStyle = '#ffd89a';
    for (let i = 0; i < 5; i += 1) {
      const life = ((w.now / 30 + i * 21) % 100) / 100;
      ctx.globalAlpha = (1 - life) * (0.4 + pulse * 0.3);
      ctx.fillRect(x + 8 + ((i * 37) % (W - 16)), y + H - 6 - life * (H + 12), 2, 2);
    }
    ctx.globalAlpha = 0.6 + pulse * 0.3;
    drawGlyph(ctx, 'dashes', en.x, y - 20 - pulse * 3, 10);
    ctx.restore();
  }
}

/** A glowing way-out door with chevrons that run toward the exit. No text: the chevrons carry the meaning. */
export function drawDungeonExit(ctx: CanvasRenderingContext2D, w: World): void {
  const e = w.endless;
  if (!e || (!e.inDungeon && !e.inBuilding) || !e.exitZone) return;
  const ex = e.exitZone;
  const x = ex.x - ex.w / 2, y = ex.y - ex.h / 2;
  const pulse = 0.5 + Math.sin(w.now / 300) * 0.5;
  ctx.save();
  // Light spilling in from outside.
  const spill = ctx.createLinearGradient(x, 0, x + ex.w * 1.6, 0);
  spill.addColorStop(0, 'rgba(126,240,189,0.35)');
  spill.addColorStop(1, 'rgba(126,240,189,0)');
  ctx.globalAlpha = 0.5 + pulse * 0.3;
  ctx.fillStyle = spill;
  ctx.fillRect(x, y, ex.w * 1.6, ex.h);
  ctx.globalAlpha = 1;
  // Door frame.
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(x - 2, y - 2, ex.w + 4, 6);
  ctx.fillRect(x - 2, y + ex.h - 4, ex.w + 4, 6);
  ctx.fillStyle = '#7ef0bd';
  ctx.globalAlpha = 0.65 + pulse * 0.3;
  ctx.fillRect(x - 2, y - 2, ex.w + 4, 2);
  ctx.fillRect(x - 2, y + ex.h + 2, ex.w + 4, 2);
  ctx.fillRect(x - 2, y - 2, 3, ex.h + 4);
  // Three chevrons chasing each other toward the way out.
  for (let i = 0; i < 3; i += 1) {
    const t = ((w.now / 700 + i / 3) % 1);
    const cx = ex.x - 8 + t * 22;
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - 5, ex.y - 8); ctx.lineTo(cx + 3, ex.y); ctx.lineTo(cx - 5, ex.y + 8);
    ctx.lineTo(cx - 8, ex.y + 8); ctx.lineTo(cx, ex.y); ctx.lineTo(cx - 8, ex.y - 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Treasure chest. Locked: dim, chained, latch mark. Unlocked: gold glow, sparkles and a lid that
 * breathes open. Opened: lid up, light pouring out. The state is visible without any text.
 */
export function drawDungeonChest(ctx: CanvasRenderingContext2D, w: World): void {
  const chest = w.endless?.dungeonChest;
  if (!chest || !w.endless?.inDungeon) return;
  const pulse = 0.5 + Math.sin(w.now / 260) * 0.5;
  const x = chest.x, y = chest.y;
  const open = chest.opened ? 1 : chest.unlocked ? 0.12 + pulse * 0.1 : 0;
  const warm = chest.unlocked || chest.opened;
  ctx.save();
  drawShadow(ctx, x, y + 14, 26);
  if (warm) {
    const halo = ctx.createRadialGradient(x, y - 4, 4, x, y - 4, 44 + pulse * 8);
    halo.addColorStop(0, chest.opened ? 'rgba(255,230,140,0.55)' : 'rgba(255,209,102,0.4)');
    halo.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - 56, y - 60, 112, 112);
  }
  ctx.globalAlpha = warm ? 1 : 0.7;
  // Body: planks and iron bands.
  const wood = warm ? '#8a5a1c' : '#3d4452', woodDark = warm ? '#5d3a10' : '#262b36', band = warm ? '#d9a63c' : '#6b7388';
  ctx.fillStyle = woodDark;
  ctx.fillRect(x - 21, y - 6, 42, 20);
  ctx.fillStyle = wood;
  for (let i = 0; i < 3; i += 1) ctx.fillRect(x - 20, y - 5 + i * 6, 40, 5);
  ctx.fillStyle = band;
  ctx.fillRect(x - 21, y - 6, 4, 20);
  ctx.fillRect(x + 17, y - 6, 4, 20);
  ctx.fillRect(x - 21, y + 11, 42, 3);
  // Light pouring from the gap when open.
  if (open > 0) {
    ctx.fillStyle = chest.opened ? '#fff1b0' : '#ffd166';
    ctx.globalAlpha = 0.7 + pulse * 0.3;
    ctx.fillRect(x - 17, y - 6 - open * 6, 34, 3 + open * 6);
    ctx.globalAlpha = warm ? 1 : 0.7;
  }
  // Lid, lifting with `open`.
  const lift = open * 12;
  ctx.fillStyle = woodDark;
  ctx.fillRect(x - 22, y - 16 - lift, 44, 11);
  ctx.fillStyle = wood;
  ctx.fillRect(x - 21, y - 15 - lift, 42, 6);
  ctx.fillStyle = band;
  ctx.fillRect(x - 22, y - 16 - lift, 44, 2);
  ctx.fillRect(x - 22, y - 7 - lift, 44, 2);
  ctx.fillRect(x - 21, y - 16 - lift, 4, 11);
  ctx.fillRect(x + 17, y - 16 - lift, 4, 11);
  if (!warm) {
    // Chains across the lid and a latch.
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(x - 22, y - 14); ctx.lineTo(x + 22, y + 10); ctx.moveTo(x + 22, y - 14); ctx.lineTo(x - 22, y + 10); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#cbd5e1';
    drawGlyph(ctx, 'lock', x, y - 3, 12);
  } else {
    ctx.fillStyle = chest.opened ? '#fff1b0' : '#ffe9a0';
    for (let i = 0; i < 4; i += 1) {
      const life = ((w.now / 24 + i * 25) % 100) / 100;
      ctx.globalAlpha = (1 - life) * 0.9;
      drawGlyph(ctx, 'spark', x - 18 + ((i * 29) % 36), y - 12 - life * 34, 7 + (1 - life) * 4);
    }
  }
  ctx.restore();
}
