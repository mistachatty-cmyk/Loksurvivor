/**
 * Shared Canvas2D art for every Lok Party minigame: the entrance (title slam, character lineup,
 * controls card, 3-2-1-GO) and the podium finish. Drawn in stage units (600 wide). Procedural only:
 * characters are their own rigs.
 */

import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { drawRig } from '@/game/render/sprite';
import { ENTRANCE, SEAT_COLORS } from './minigameKit';

export const STAGE_W = 600;

export function outlined(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, maxW = STAGE_W - 30) {
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size / 5);
  ctx.strokeStyle = '#07061a';
  ctx.strokeText(s, x, y, maxW);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y, maxW);
}

/** A pool of light behind a figure, so dark outfits never vanish into a night scene. */
export function backlight(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${color}cc`);
  g.addColorStop(0.55, `${color}44`);
  g.addColorStop(1, `${color}00`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const easeOutBack = (p: number) => {
  const c = 1.9;
  const q = p - 1;
  return 1 + (c + 1) * q * q * q + c * q * q;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface EntranceSeat {
  characterId: string;
  you: boolean;
}

export interface EntranceLabels {
  title: string;
  prompt: string;
  hint: string;
  go: string;
  you: string;
  skip: string;
}

/** Which countdown number shows at a time, 3..1, 0 for GO, or null outside the countdown. */
export function countdownAt(t: number): number | null {
  if (t < ENTRANCE.countdownAt) return null;
  if (t >= ENTRANCE.playAt + ENTRANCE.goMs) return null;
  if (t >= ENTRANCE.playAt) return 0;
  return 3 - Math.floor((t - ENTRANCE.countdownAt) / ENTRANCE.beatMs);
}

export function drawEntrance(
  ctx: CanvasRenderingContext2D,
  o: { h: number; t: number; calm: boolean; accent: string; seats: EntranceSeat[]; labels: EntranceLabels },
) {
  const { h, t, calm, accent, seats, labels } = o;
  const mid = STAGE_W / 2;
  const playing = t >= ENTRANCE.playAt;
  if (!playing) {
    // Dim the game behind, with speed stripes rushing past.
    ctx.fillStyle = 'rgba(7,6,26,0.82)';
    ctx.fillRect(0, 0, STAGE_W, h);
    if (!calm) {
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = i % 2 ? `${accent}22` : 'rgba(255,63,210,0.12)';
        const y = (i * 97 + t * 0.9) % (h + 80) - 40;
        ctx.fillRect(((i * 211 + t * 1.6) % (STAGE_W + 400)) - 300, y, 260, 10);
      }
    }
  }

  const top = h * 0.2;
  const clear = calm ? (t >= ENTRANCE.countdownAt ? 0 : 1) : 1 - clamp01((t - ENTRANCE.countdownAt) / 260);
  if (!playing && clear > 0) {
    // Title slams in from huge, with a white flash on impact.
    const p = clamp01(t / ENTRANCE.titleMs);
    const scale = calm ? 1 : 1 + (1 - easeOutBack(p)) * 2.4;
    ctx.save();
    ctx.translate(mid, top);
    ctx.scale(scale, scale);
    ctx.globalAlpha = clamp01(p * 3) * clear;
    outlined(ctx, labels.title, 0, 0, 62, accent);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (!calm && t > ENTRANCE.titleMs && t < ENTRANCE.titleMs + 140) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - (t - ENTRANCE.titleMs) / 140)})`;
      ctx.fillRect(0, 0, STAGE_W, h);
    }

    // The lineup: each character slides in from alternating sides and strikes a pose.
    const rowY = top + 250;
    seats.forEach((seat, i) => {
      const def = CHARACTERS_BY_ID[seat.characterId];
      if (!def) return;
      const born = ENTRANCE.lineupMs + i * ENTRANCE.lineupEachMs;
      const q = clamp01((t - born) / 380);
      if (q <= 0) return;
      const x = 75 + i * 150;
      const from = i % 2 === 0 ? -260 : 260;
      const sx = calm ? x : x + from * (1 - easeOutBack(q));
      const color = SEAT_COLORS[i % 4];
      ctx.globalAlpha = clamp01(q * 2) * clear;
      ctx.fillStyle = color;
      ctx.fillRect(sx - 64, rowY + 14, 128, 10);
      backlight(ctx, sx, rowY - 60, 95, color);
      drawRig(ctx, def.rig, def.palette, q < 1 ? 'walk' : t - born < 900 ? 'attack' : 'idle', t, sx, rowY + 10, 1, 3.6);
      outlined(ctx, seat.you ? labels.you : def.name, sx, rowY + 58, seat.you ? 26 : 20, seat.you ? '#ffd23f' : '#ffffff', 140);
      ctx.globalAlpha = 1;
    });

    // Controls card.
    const cardIn = clamp01((t - 1500) / 300);
    if (cardIn > 0) {
      const y = rowY + 120 + (1 - cardIn) * 40;
      ctx.globalAlpha = cardIn * clear;
      ctx.fillStyle = '#FAF6EE';
      ctx.strokeStyle = '#3b2a20';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(40, y, STAGE_W - 80, 112, 18);
      ctx.fill();
      ctx.stroke();
      ctx.font = '900 28px system-ui, sans-serif';
      ctx.fillStyle = '#3b2a20';
      ctx.textAlign = 'center';
      ctx.fillText(labels.prompt, mid, y + 46, STAGE_W - 120);
      ctx.font = '700 21px system-ui, sans-serif';
      ctx.fillText(labels.hint, mid, y + 84, STAGE_W - 120);
      ctx.globalAlpha = 1;
    }
    if (t < ENTRANCE.countdownAt) outlined(ctx, labels.skip, mid, h - 40, 20, 'rgba(255,255,255,0.7)');
  }

  const n = countdownAt(t);
  if (n !== null) {
    const since = n === 0 ? t - ENTRANCE.playAt : (t - ENTRANCE.countdownAt) % ENTRANCE.beatMs;
    const pop = calm ? 1 : 1 + Math.max(0, 1 - since / 220) * 0.9;
    ctx.save();
    ctx.translate(mid, h * 0.5);
    ctx.scale(pop, pop);
    if (n === 0) ctx.globalAlpha = clamp01(1 - (since - 400) / 300);
    outlined(ctx, n === 0 ? labels.go : String(n), 0, 40, n === 0 ? 150 : 170, n === 0 ? '#7cff6b' : '#ffd23f');
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export interface PodiumEntry {
  index: number;
  characterId: string;
  banked: number;
}

/** The finish: everyone on a step by placement, the winner jumping under confetti. */
export function drawPodium(
  ctx: CanvasRenderingContext2D,
  o: { h: number; clock: number; since: number; calm: boolean; me: number; title: string; you: string; results: PodiumEntry[] },
) {
  const { h, clock, since, calm, me, results } = o;
  const mid = STAGE_W / 2;
  const fade = clamp01(since / 350);
  ctx.fillStyle = `rgba(12,8,40,${0.88 * fade})`;
  ctx.fillRect(0, 0, STAGE_W, h);
  const middle = h / 2;
  const floor = middle + 230;
  backlight(ctx, 230, floor - 330, 260, '#ffd23f');
  if (!calm) {
    for (let c = 0; c < 70; c++) {
      ctx.fillStyle = SEAT_COLORS[c % 4];
      ctx.fillRect((c * 97) % STAGE_W, ((c * 151 + clock * (0.12 + (c % 5) * 0.03)) % (h + 40)) - 20, 8, 13);
    }
  }
  const slam = calm ? 1 : 1 + Math.max(0, 1 - since / 300) * 1.2;
  ctx.save();
  ctx.translate(mid, middle - 230);
  ctx.scale(slam, slam);
  outlined(ctx, o.title, 0, 0, 68, '#ffd23f');
  ctx.restore();
  results.forEach((res, place) => {
    const def = CHARACTERS_BY_ID[res.characterId];
    if (!def) return;
    // Steps rise one by one, last place first.
    const rise = calm ? 1 : clamp01((since - 250 - (3 - place) * 180) / 320);
    if (rise <= 0) return;
    const x = [230, 95, 365, 500][place] ?? 500;
    const full = [210, 150, 105, 60][place] ?? 60;
    const top = floor - full * easeOutBack(rise);
    const color = SEAT_COLORS[res.index % 4];
    ctx.fillStyle = color;
    ctx.fillRect(x - 60, top, 120, floor - top);
    const bounce = place === 0 && !calm ? Math.abs(Math.sin(clock / 160)) * 34 : 0;
    backlight(ctx, x, top - 60 - bounce, 90, color);
    drawRig(ctx, def.rig, def.palette, place === 0 ? 'attack' : place === 3 ? 'hurt' : 'idle', clock, x, top - bounce, 1, place === 0 ? 5 : 4);
    outlined(ctx, `${place + 1}`, x, top + 44, 36, '#ffffff');
    outlined(ctx, String(res.banked), x, floor + 40, 30, res.index === me ? '#ffd23f' : '#ffffff');
    if (res.index === me) outlined(ctx, o.you, x, floor + 74, 26, '#ffd23f');
  });
}
