/**
 * Red Light, Green Light's look and feel (rules in redLight.ts, runner in MinigameStage.tsx): four lanes
 * run up the screen toward a giant owl on a gate in the distance. On green its back is turned; on the
 * warning its head swivels; on red it faces you with glowing eyes. Tap on red and a laser finds you: a
 * fireball, a shockwave, a scorch mark, and the runner's own parts flying everywhere.
 */

import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { t as tr } from '@/lib/i18n';
import { SEAT_COLORS, type MinigameCartridge, type RenderInfo, type StageView } from './minigameKit';
import { LIGHT, createRedLight, lightResults, stepRedLight, type LightState } from './redLight';
import { STAGE_W, outlined } from './stageArt';

const startY = (v: StageView) => v.h * 0.86;
const finishY = (v: StageView) => v.h * 0.3;
const OWL_H = 190;

/** 0 at the start line, 1 at the finish. Runners shrink toward the owl for depth. */
function pos(view: StageView, lane: number, dist: number) {
  const t = Math.min(1, dist / LIGHT.track);
  const spacing = 112 - 52 * t;
  const y = startY(view) - Math.pow(t, 0.92) * (startY(view) - finishY(view));
  return { x: STAGE_W / 2 + (lane - 1.5) * spacing, y, k: 1 - 0.5 * t };
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  born: number;
  floor: number;
}
interface Blast {
  x: number;
  y: number;
  born: number;
  color: string;
}
interface Art {
  lastTap: number[];
  pieces: Piece[];
  blasts: Blast[];
  beams: { index: number; born: number; x: number; y: number }[];
  scorch: { x: number; y: number; r: number }[];
  lastClock: number;
  taps: number;
}
const arts = new WeakMap<LightState, Art>();
function artFor(s: LightState): Art {
  let a = arts.get(s);
  if (!a) {
    a = { lastTap: s.runners.map(() => -1e9), pieces: [], blasts: [], beams: [], scorch: [], lastClock: 0, taps: 0 };
    arts.set(s, a);
  }
  return a;
}

/** How far round the owl's head is: -1 facing away, 1 facing the runners. */
function facing(s: LightState, now: number): number {
  if (s.phase === 'green') return -1;
  if (s.phase === 'warn') return -1 + 2 * Math.min(1, (now - s.phaseStart) / LIGHT.warnMs);
  return 1;
}

function drawSky(ctx: CanvasRenderingContext2D, view: StageView, clock: number, calm: boolean) {
  const g = ctx.createLinearGradient(0, 0, 0, view.h);
  g.addColorStop(0, '#1a1245');
  g.addColorStop(0.45, '#5b2a6e');
  g.addColorStop(0.62, '#f2745a');
  g.addColorStop(1, '#2b1a3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, STAGE_W, view.h);
  // A hazy sun behind the owl and a skyline of dark blocks.
  const fy = finishY(view);
  const sun = ctx.createRadialGradient(STAGE_W / 2, fy - 40, 10, STAGE_W / 2, fy - 40, 260);
  sun.addColorStop(0, 'rgba(255,210,120,0.8)');
  sun.addColorStop(1, 'rgba(255,210,120,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, STAGE_W, view.h);
  ctx.fillStyle = '#1b1030';
  for (let i = 0; i < 14; i += 1) {
    const w = 38 + ((i * 29) % 26);
    const h = 40 + ((i * 53) % 90);
    ctx.fillRect(i * 46 - 10, fy + 20 - h, w, h + 60);
  }
  if (!calm) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 24; i += 1) ctx.fillRect((i * 97) % STAGE_W, ((i * 41) % Math.floor(fy * 0.8)) + 4, 2, 2 + ((Math.floor(clock / 400) + i) % 3 === 0 ? 1 : 0));
  }
}

function drawTrack(ctx: CanvasRenderingContext2D, view: StageView, s: LightState) {
  const y0 = startY(view) + 40;
  const y1 = finishY(view);
  const wBottom = 4 * 112 + 40;
  const wTop = 4 * 60 + 20;
  ctx.fillStyle = '#3a2d4d';
  ctx.beginPath();
  ctx.moveTo(STAGE_W / 2 - wBottom / 2, y0);
  ctx.lineTo(STAGE_W / 2 + wBottom / 2, y0);
  ctx.lineTo(STAGE_W / 2 + wTop / 2, y1);
  ctx.lineTo(STAGE_W / 2 - wTop / 2, y1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a2038';
  ctx.fillRect(0, y0, STAGE_W, view.h - y0);
  ctx.fillRect(0, y1 - 4, STAGE_W / 2 - wTop / 2, 8);
  ctx.fillRect(STAGE_W / 2 + wTop / 2, y1 - 4, STAGE_W / 2 - wTop / 2, 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3;
  for (let l = 0; l <= 4; l += 1) {
    const a = pos(view, l - 0.5, 0);
    const b = pos(view, l - 0.5, LIGHT.track);
    ctx.beginPath();
    ctx.moveTo(a.x, startY(view) + 20);
    ctx.lineTo(b.x, finishY(view));
    ctx.stroke();
  }
  // Start line and a checkered finish line.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(STAGE_W / 2 - wBottom / 2 + 10, startY(view) + 14, wBottom - 20, 5);
  const fw = wTop;
  for (let i = 0; i < 14; i += 1) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#111111';
    ctx.fillRect(STAGE_W / 2 - fw / 2 + (i * fw) / 14, y1 - 6, fw / 14, 12);
  }
  void s;
}

function drawOwl(ctx: CanvasRenderingContext2D, view: StageView, s: LightState, clock: number, calm: boolean) {
  const f = facing(s, s.now);
  const ox = STAGE_W / 2;
  const base = finishY(view) - 6;
  const H = OWL_H;
  const red = s.phase === 'red';
  // The gate it stands on.
  ctx.fillStyle = '#241838';
  ctx.fillRect(ox - 150, base - 18, 300, 24);
  ctx.fillRect(ox - 110, base - 40, 18, 40);
  ctx.fillRect(ox + 92, base - 40, 18, 40);
  if (red) {
    const g = ctx.createRadialGradient(ox, base - H * 0.75, 6, ox, base - H * 0.75, 190);
    g.addColorStop(0, `rgba(255,40,40,${0.45 + (calm ? 0 : 0.2 * Math.sin(clock / 70))})`);
    g.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(ox - 200, base - H * 1.6, 400, H * 1.8);
  }
  // Body.
  const bodyW = H * 0.62;
  ctx.fillStyle = f > 0 ? '#7a5636' : '#5a3d26';
  ctx.beginPath();
  ctx.ellipse(ox, base - H * 0.34, bodyW / 2, H * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = f > 0 ? '#e2c9a0' : '#4a3220';
  for (let r = 0; r < 4; r += 1) for (let c = -1; c <= 1; c += 1) {
    ctx.beginPath();
    ctx.arc(ox + c * 22 + (r % 2) * 11, base - H * 0.5 + r * 17, 11, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = '#3d2918';
  ctx.beginPath();
  ctx.ellipse(ox - bodyW * 0.46, base - H * 0.36, 16, H * 0.27, 0.15, 0, Math.PI * 2);
  ctx.ellipse(ox + bodyW * 0.46, base - H * 0.36, 16, H * 0.27, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Head: width follows the swivel so it visibly turns.
  const hy = base - H * 0.78;
  const hr = H * 0.26;
  const sx = Math.max(0.28, Math.abs(f));
  ctx.fillStyle = '#6b4a2f';
  ctx.beginPath();
  ctx.ellipse(ox, hy, hr * sx + hr * 0.25, hr, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ox - hr * 0.8, hy - hr * 0.7);
  ctx.lineTo(ox - hr * 0.95, hy - hr * 1.5);
  ctx.lineTo(ox - hr * 0.25, hy - hr * 0.95);
  ctx.moveTo(ox + hr * 0.8, hy - hr * 0.7);
  ctx.lineTo(ox + hr * 0.95, hy - hr * 1.5);
  ctx.lineTo(ox + hr * 0.25, hy - hr * 0.95);
  ctx.fill();
  if (f > 0.15) {
    const gx = f * hr * 0.1;
    ctx.fillStyle = '#e8d9b8';
    ctx.beginPath();
    ctx.ellipse(ox - hr * 0.4 * f + gx, hy, hr * 0.42 * f, hr * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(ox + hr * 0.4 * f + gx, hy, hr * 0.42 * f, hr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const eye = red ? '#ff1f1f' : '#ffcf3c';
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.ellipse(ox - hr * 0.4 * f + gx, hy, hr * 0.3 * f, hr * 0.34, 0, 0, Math.PI * 2);
    ctx.ellipse(ox + hr * 0.4 * f + gx, hy, hr * 0.3 * f, hr * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(ox - hr * 0.4 * f + gx, hy, hr * 0.1 * f, hr * 0.2, 0, 0, Math.PI * 2);
    ctx.ellipse(ox + hr * 0.4 * f + gx, hy, hr * 0.1 * f, hr * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e59a2c';
    ctx.beginPath();
    ctx.moveTo(ox + gx - 8 * f, hy + hr * 0.2);
    ctx.lineTo(ox + gx + 8 * f, hy + hr * 0.2);
    ctx.lineTo(ox + gx, hy + hr * 0.62);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#3d2918';
    ctx.lineWidth = 3;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(ox + i * 9, hy - hr * 0.6);
      ctx.lineTo(ox + i * 11, hy + hr * 0.5);
      ctx.stroke();
    }
  }
}

function eyePoints(view: StageView) {
  const hy = finishY(view) - 6 - OWL_H * 0.78;
  const hr = OWL_H * 0.26;
  return [
    { x: STAGE_W / 2 - hr * 0.4, y: hy },
    { x: STAGE_W / 2 + hr * 0.4, y: hy },
  ];
}

function drawRunners(ctx: CanvasRenderingContext2D, view: StageView, s: LightState, art: Art, info: RenderInfo) {
  const order = s.runners.map((r) => r).sort((a, b) => a.dist - b.dist);
  for (const r of order) {
    if (!r.alive) continue;
    const def = CHARACTERS_BY_ID[r.characterId];
    if (!def) continue;
    const p = pos(view, r.index, r.dist);
    const running = info.clock - art.lastTap[r.index] < 170;
    const done = r.finishOrder > 0;
    drawShadow(ctx, p.x, p.y, 26 * p.k);
    const shiver = s.phase === 'red' && !done && !info.calm ? Math.sin(info.clock / 35 + r.index) * 1.4 : 0;
    drawRig(ctx, def.rig, def.palette, done ? 'attack' : running ? 'walk' : 'idle', info.clock * (running ? 1.4 : 1), p.x + shiver, p.y, 1, 3.2 * p.k + 0.4);
    if (r.index === info.me) {
      ctx.fillStyle = SEAT_COLORS[r.index % 4];
      ctx.strokeStyle = '#07061a';
      ctx.lineWidth = 3;
      const ay = p.y - 92 * p.k - 14 + (info.calm ? 0 : Math.sin(info.clock / 180) * 3);
      ctx.beginPath();
      ctx.moveTo(p.x, ay + 10);
      ctx.lineTo(p.x - 9, ay - 6);
      ctx.lineTo(p.x + 9, ay - 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, view: StageView, s: LightState, art: Art, clock: number, calm: boolean) {
  for (const sc of art.scorch) {
    ctx.fillStyle = 'rgba(8,6,12,0.55)';
    ctx.beginPath();
    ctx.ellipse(sc.x, sc.y, sc.r, sc.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const eyes = eyePoints(view);
  art.beams = art.beams.filter((b) => clock - b.born < 280);
  for (const b of art.beams) {
    const k = 1 - (clock - b.born) / 280;
    for (const e of eyes) {
      ctx.strokeStyle = `rgba(255,40,40,${0.85 * k})`;
      ctx.lineWidth = 12 * k + (calm ? 0 : Math.random() * 4);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${k})`;
      ctx.lineWidth = 4 * k;
      ctx.stroke();
    }
  }
  art.blasts = art.blasts.filter((b) => clock - b.born < 520);
  for (const b of art.blasts) {
    const age = (clock - b.born) / 520;
    const r = 30 + 110 * Math.sqrt(age);
    const g = ctx.createRadialGradient(b.x, b.y - 30, 4, b.x, b.y - 30, r);
    g.addColorStop(0, `rgba(255,255,230,${1 - age})`);
    g.addColorStop(0.35, `rgba(255,170,40,${0.9 * (1 - age)})`);
    g.addColorStop(1, 'rgba(200,30,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y - 30, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - age)})`;
    ctx.lineWidth = 6 * (1 - age);
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, r * 1.4, r * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  art.pieces = art.pieces.filter((p) => clock - p.born < 1700);
  for (const p of art.pieces) {
    const t = (clock - p.born) / 1000;
    let y = p.y + p.vy * t + 900 * t * t;
    let x = p.x + p.vx * t;
    if (y > p.floor) {
      const bounce = Math.min(1, (t - Math.sqrt((2 * (p.floor - p.y)) / 900)) * 2);
      y = p.floor - Math.abs(Math.sin(bounce * 5)) * 16 * (1 - bounce);
      x = p.x + p.vx * Math.min(t, 0.9);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot + p.vr * t);
    ctx.globalAlpha = Math.min(1, (1700 - (clock - p.born)) / 400);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  void s;
}

export const redLight: MinigameCartridge<LightState> = {
  id: 'redlight',
  accent: '#ff3b2c',
  bpm: 120,
  labels: (t) => ({ title: t('lokParty.redlight.title'), prompt: t('lokParty.redlight.prompt'), hint: t('lokParty.redlight.hint') }),
  create: (seed, seats) => createRedLight(seed, seats),
  step: stepRedLight,
  isOver: (s) => s.over,
  timeLeftMs: (s) => s.durationMs - s.now,
  scores: (s) => s.runners.map((r) => (r.finishOrder > 0 ? 100 : Math.round(r.alive ? r.dist : r.dist * 0.5))),
  results: lightResults,
  toWorld: (_view, x, y) => ({ x, y }),
  toStage: (_view, x, y) => ({ x, y }),

  render(ctx, s, info) {
    const art = artFor(s);
    art.lastClock = info.clock;
    drawSky(ctx, info.view, info.clock, info.calm);
    drawTrack(ctx, info.view, s);
    drawOwl(ctx, info.view, s, info.clock, info.calm);
    drawRunners(ctx, info.view, s, art, info);
    drawEffects(ctx, info.view, s, art, info.clock, info.calm);
  },

  react(s, fx, info) {
    const { view, clock, me } = info;
    const art = artFor(s);
    for (const e of s.events) {
      switch (e.type) {
        case 'green':
          fx.chime(true);
          fx.toast(STAGE_W / 2, view.h * 0.5, tr('lokParty.redlight.go'), '#5fe36f', 64);
          break;
        case 'warn':
          fx.sound('crack');
          break;
        case 'red':
          fx.sound('slam');
          fx.toast(STAGE_W / 2, view.h * 0.5, tr('lokParty.redlight.freeze'), '#ff3b2c', 64);
          fx.flash('#ff3b2c', 110);
          break;
        case 'tap': {
          art.lastTap[e.index] = clock;
          if (e.index === me) {
            art.taps += 1;
            if (art.taps % 4 === 0) fx.chime(false);
          }
          break;
        }
        case 'zap': {
          const r = s.runners[e.index];
          const p = pos(view, e.index, r.dist);
          const def = CHARACTERS_BY_ID[r.characterId];
          art.beams.push({ index: e.index, born: clock, x: p.x, y: p.y - 40 * p.k });
          art.blasts.push({ x: p.x, y: p.y, born: clock, color: '#ffb03c' });
          art.scorch.push({ x: p.x, y: p.y, r: 34 * p.k + 12 });
          const colors = def ? [def.palette.body, def.palette.bodyDark, def.palette.accent, def.palette.skin, def.palette.ink] : ['#ffffff', '#ff7a3c'];
          for (let i = 0; i < 14; i += 1) {
            const a = (i / 14) * Math.PI * 2 + e.index;
            const sp = 160 + ((i * 53) % 260);
            art.pieces.push({
              x: p.x,
              y: p.y - 40 * p.k,
              vx: Math.cos(a) * sp,
              vy: -260 - ((i * 37) % 340),
              rot: i,
              vr: ((i % 2 ? 1 : -1) * (6 + (i % 5))),
              w: 7 + ((i * 7) % 11),
              h: 6 + ((i * 11) % 12),
              color: colors[i % colors.length],
              born: clock,
              floor: p.y + ((i * 13) % 16),
            });
          }
          fx.burst(p.x, p.y - 30, '#ff7a3c', 40, { speed: 0.9, size: 9, gravity: 0.7 });
          fx.burst(p.x, p.y - 30, '#ffe27a', 26, { speed: 0.7, size: 7 });
          fx.burst(p.x, p.y - 20, '#2a2330', 18, { speed: 0.35, size: 14, smoke: true });
          fx.impact(p.x, p.y - 30, e.index === me ? 1 : 0.8);
          fx.flash(e.index === me ? '#ff3b2c' : '#ffffff', e.index === me ? 200 : 90);
          fx.sound('slam');
          fx.toast(p.x, p.y - 110 * p.k - 20, tr('lokParty.redlight.zapped'), SEAT_COLORS[e.index % 4], 40);
          break;
        }
        case 'finish': {
          const r = s.runners[e.index];
          const p = pos(view, e.index, r.dist);
          const c = SEAT_COLORS[e.index % 4];
          fx.burst(p.x, p.y - 30, c, 20, { speed: 0.6, size: 7 });
          fx.burst(p.x, p.y - 30, '#ffd23f', 14, { speed: 0.5, size: 6 });
          fx.toast(p.x, p.y - 100 * p.k, e.order === 1 ? tr('lokParty.redlight.first') : tr('lokParty.redlight.safe'), c, e.order === 1 ? 44 : 30);
          fx.sound('bank');
          if (e.index === me) fx.impact(p.x, p.y - 30, 0.5);
          break;
        }
      }
    }
  },

  hud(ctx, s, info) {
    const { view, clock, me, calm } = info;
    const mine = s.runners[me];
    const red = s.phase === 'red';
    const warn = s.phase === 'warn';
    // The light: three lamps and a word, always readable at a glance.
    const lampY = 120;
    const lamps = ['#ff3b2c', '#ffcf3c', '#5fe36f'];
    const lit = red ? 0 : warn ? 1 : 2;
    lamps.forEach((c, i) => {
      ctx.fillStyle = i === lit ? c : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(STAGE_W / 2 + (i - 1) * 34, lampY, 12, 0, Math.PI * 2);
      ctx.fill();
    });
    const word = red ? tr('lokParty.redlight.freeze') : warn ? tr('lokParty.redlight.warn') : tr('lokParty.redlight.go');
    outlined(ctx, word, STAGE_W / 2, lampY + 52, 38, red ? '#ff3b2c' : warn ? '#ffcf3c' : '#5fe36f');
    if (!mine) return;
    let line = '';
    let color = '#ffffff';
    if (!mine.alive) {
      line = tr('lokParty.redlight.boom');
      color = '#ff3b2c';
    } else if (mine.finishOrder > 0) {
      line = tr('lokParty.redlight.safeLine');
      color = '#ffd23f';
    } else if (red) {
      line = tr('lokParty.redlight.hold');
      color = '#ff3b2c';
    } else {
      line = tr('lokParty.redlight.tapTap');
      color = '#5fe36f';
    }
    const pulse = calm ? 1 : 1 + 0.06 * Math.sin(clock / 90);
    ctx.save();
    ctx.translate(STAGE_W / 2, view.h - 34);
    ctx.scale(pulse, pulse);
    outlined(ctx, line, 0, 0, 34, color);
    ctx.restore();
  },
};
