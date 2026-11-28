/**
 * Gem Vacuum Frenzy's look and feel (rules in gemVacuum.ts, runner in MinigameStage.tsx): a neon vault
 * floor with four glowing bank pads, a vacuum cone on every character, gems that pop in and stream
 * into the nozzle, and bank bursts that fling the pile into your score.
 */

import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { t as tr } from '@/lib/i18n';
import { Squash } from './juiceEngine';
import { GEMS, createGemVacuum, gemResults, padCenter, stepGemVacuum, type Gem, type GemRunner, type GemState } from './gemVacuum';
import { SEAT_COLORS, type MinigameCartridge, type RenderInfo, type StageView } from './minigameKit';
import { STAGE_W, backlight, outlined } from './stageArt';

const TILT = 0.82;
const RIG = 3.7;

function layout(view: StageView) {
  const s = Math.min(1.04, (view.h - 200) / (GEMS.half * 2 * TILT));
  return { cx: STAGE_W / 2, cy: view.h * 0.53, s: Math.max(0.5, s) };
}
const project = (view: StageView, x: number, y: number) => {
  const l = layout(view);
  return { x: l.cx + x * l.s, y: l.cy + y * l.s * TILT };
};

interface Art {
  squash: Squash[];
  lastClock: number;
  /** Seconds-ish since each runner last banked, for the pad flare. */
  flare: number[];
  shownScore: number[];
}
const arts = new WeakMap<GemState, Art>();
function artFor(s: GemState): Art {
  let a = arts.get(s);
  if (!a) {
    a = { squash: s.runners.map(() => new Squash()), lastClock: 0, flare: s.runners.map(() => -1e9), shownScore: s.runners.map(() => 0) };
    arts.set(s, a);
  }
  return a;
}

const GEM_COLORS: Record<Gem['kind'], string> = { gem: '#38f2ff', gold: '#ffd23f', bomb: '#ff3b5c' };

function drawFloor(ctx: CanvasRenderingContext2D, view: StageView, s: GemState, clock: number, calm: boolean) {
  const bg = ctx.createLinearGradient(0, 0, 0, view.h);
  bg.addColorStop(0, '#07052a');
  bg.addColorStop(0.5, '#120a3a');
  bg.addColorStop(1, '#04030f');
  ctx.fillStyle = bg;
  ctx.fillRect(-60, -60, STAGE_W + 120, view.h + 120);

  const l = layout(view);
  const a = project(view, -GEMS.half, -GEMS.half);
  const b = project(view, GEMS.half, GEMS.half);
  // The floor slab.
  const floor = ctx.createLinearGradient(0, a.y, 0, b.y);
  floor.addColorStop(0, '#1b1060');
  floor.addColorStop(1, '#0d0838');
  ctx.fillStyle = floor;
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  // Grid lines that scroll slowly toward you; still when calm.
  ctx.strokeStyle = 'rgba(120,90,255,.22)';
  ctx.lineWidth = 1.5;
  const off = calm ? 0 : (clock / 40) % 40;
  for (let g = -GEMS.half; g <= GEMS.half; g += 40) {
    const p = project(view, g, -GEMS.half);
    const q = project(view, g, GEMS.half);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    const gy = Math.min(GEMS.half, Math.max(-GEMS.half, g + off - 20));
    const h1 = project(view, -GEMS.half, gy);
    const h2 = project(view, GEMS.half, gy);
    ctx.beginPath();
    ctx.moveTo(h1.x, h1.y);
    ctx.lineTo(h2.x, h2.y);
    ctx.stroke();
  }
  // Neon border, pulsing harder in the frenzy.
  const pulse = s.frenzy ? 0.6 + 0.4 * Math.sin(clock / 90) : 0.7;
  ctx.strokeStyle = s.frenzy ? `rgba(255,210,63,${pulse})` : 'rgba(56,242,255,.8)';
  ctx.lineWidth = 5;
  ctx.shadowColor = s.frenzy ? '#ffd23f' : '#38f2ff';
  ctx.shadowBlur = calm ? 0 : 16;
  ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.shadowBlur = 0;
  // Thick lip under the front edge.
  ctx.fillStyle = '#080522';
  ctx.fillRect(a.x - 4, b.y + 2, b.x - a.x + 8, 18 * l.s);
}

function drawPads(ctx: CanvasRenderingContext2D, view: StageView, s: GemState, art: Art, clock: number, calm: boolean) {
  for (const r of s.runners) {
    const c = SEAT_COLORS[r.index % 4];
    const p0 = padCenter(r.index);
    const p = project(view, p0.x, p0.y);
    const l = layout(view);
    const rad = GEMS.padRadius * l.s;
    const flare = Math.max(0, 1 - (clock - art.flare[r.index]) / 700);
    const breathe = calm ? 0.5 : 0.5 + 0.5 * Math.sin(clock / 400 + r.index);
    backlight(ctx, p.x, p.y, rad * (1.6 + flare), c);
    ctx.fillStyle = `${c}${flare > 0 ? '66' : '33'}`;
    ctx.strokeStyle = c;
    ctx.lineWidth = 4 + flare * 4;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rad, rad * TILT, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.35 + breathe * 0.3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rad * 0.62, rad * 0.62 * TILT, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // The banked pile on the pad.
    const stack = Math.min(14, Math.floor(r.banked / 3));
    for (let i = 0; i < stack; i++) {
      const gx = p.x + ((i % 4) - 1.5) * 9 * l.s;
      const gy = p.y - 4 - Math.floor(i / 4) * 7 * l.s + (i % 2) * 2;
      drawDiamond(ctx, gx, gy, 5 * l.s, c, 0.9);
    }
  }
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.2);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r * 1.2);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.2);
  ctx.lineTo(x + r * 0.5, y - r * 0.1);
  ctx.lineTo(x - r * 0.2, y - r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawGem(ctx: CanvasRenderingContext2D, view: StageView, s: GemState, g: Gem, clock: number, calm: boolean) {
  const p = project(view, g.x, g.y);
  const l = layout(view);
  const age = Math.min(1, (s.now - g.born) / 220);
  const pop = age < 1 ? 1 + 0.5 * Math.sin(age * Math.PI) : 1;
  const bob = calm ? 0 : Math.sin(clock / 260 + g.id) * 2;
  if (g.kind === 'bomb') {
    const flash = !calm && Math.floor(clock / 180) % 2 === 0;
    drawShadow(ctx, p.x, p.y + 6, 12 * l.s);
    ctx.fillStyle = '#1a1226';
    ctx.strokeStyle = flash ? '#ff3b5c' : '#6b2a45';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 8 + bob, 13 * l.s * pop, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffd23f' : '#ff8a3c';
    ctx.fillRect(p.x - 2, p.y - 30 + bob, 4, 7);
    ctx.fillStyle = '#ff3b5c';
    ctx.font = `900 ${14 * l.s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('!', p.x, p.y - 3 + bob);
    return;
  }
  const c = GEM_COLORS[g.kind];
  const sz = (g.kind === 'gold' ? 11 : 8) * l.s * pop;
  drawShadow(ctx, p.x, p.y + 4, sz * 1.1);
  if (!calm) backlight(ctx, p.x, p.y - 6 + bob, sz * 3, c);
  drawDiamond(ctx, p.x, p.y - 8 + bob, sz, c);
}

function drawRunner(ctx: CanvasRenderingContext2D, view: StageView, s: GemState, r: GemRunner, art: Art, info: RenderInfo) {
  const def = CHARACTERS_BY_ID[r.characterId];
  if (!def) return;
  const { clock, calm, me } = info;
  const l = layout(view);
  const c = SEAT_COLORS[r.index % 4];
  const p = project(view, r.x, r.y);
  const boosting = s.now < r.boostUntil;
  const stunned = s.now < r.stunUntil;
  const blink = s.now < r.invulnUntil && !stunned && Math.floor(clock / 90) % 2 === 0;

  // The vacuum field.
  const field = (boosting ? GEMS.boostVacRadius : GEMS.vacRadius) * l.s;
  if (!stunned) {
    ctx.strokeStyle = `${c}${boosting ? 'cc' : '66'}`;
    ctx.lineWidth = boosting ? 4 : 2;
    ctx.setLineDash([10, 12]);
    ctx.lineDashOffset = calm ? 0 : -clock / 30;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, field, field * TILT, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  drawShadow(ctx, p.x, p.y + 2, 24 * l.s);
  ctx.strokeStyle = c;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, 30 * l.s, 30 * l.s * TILT, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (r.index === me) {
    const ready = Math.min(1, 1 - (r.boostReadyAt - s.now) / GEMS.boostCooldownMs);
    ctx.strokeStyle = ready >= 1 ? '#ffffff' : '#ffd23f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 37 * l.s, 37 * l.s * TILT, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, ready));
    ctx.stroke();
  }
  backlight(ctx, p.x, p.y - 30, 56 * l.s, c);
  ctx.globalAlpha = blink ? 0.45 : 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  const sq = art.squash[r.index];
  const heavy = Math.min(1, r.carry / 20);
  ctx.scale(sq.scaleX * (1 + heavy * 0.08), sq.scaleY * (1 - heavy * 0.05));
  if (stunned) ctx.rotate(Math.sin(clock / 50) * 0.12);
  const moving = Math.hypot(r.vx, r.vy) > 30;
  drawRig(ctx, def.rig, def.palette, stunned ? 'hurt' : boosting ? 'attack' : moving ? 'walk' : 'idle', clock + r.index * 133, 0, 0, r.facing, RIG * l.s, { flash: stunned && Math.floor(clock / 70) % 2 === 0 });
  ctx.restore();
  ctx.globalAlpha = 1;

  // The nozzle: a bright cone toward the nearest gem in reach shows the pull.
  if (!stunned && !calm) {
    for (const g of s.gems) {
      if (g.kind === 'bomb') continue;
      const d = Math.hypot(g.x - r.x, g.y - r.y);
      if (d < (boosting ? GEMS.boostVacRadius : GEMS.vacRadius) && d > GEMS.pickRadius) {
        const q = project(view, g.x, g.y);
        ctx.strokeStyle = `${c}55`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 20 * l.s);
        ctx.lineTo(q.x, q.y - 8);
        ctx.stroke();
      }
    }
  }
  // The load: a tower of gems and a count above the head.
  if (r.carry > 0) {
    const n = Math.min(10, Math.ceil(r.carry / 3));
    for (let i = 0; i < n; i++) {
      drawDiamond(ctx, p.x + Math.sin(clock / 300 + i) * 3, p.y - 84 * l.s - i * 5 * l.s, 5 * l.s, i % 3 === 0 ? '#ffd23f' : c, 0.95);
    }
    outlined(ctx, `x${r.carry}`, p.x + 22 * l.s, p.y - 82 * l.s, 18 * l.s, '#ffffff');
  }
  if (r.index === me) outlined(ctx, tr('lokParty.drop.you'), p.x, p.y + 34 * l.s, 14, c);
  if (stunned) {
    for (let i = 0; i < 3; i++) {
      const a = clock / 120 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(p.x + Math.cos(a) * 20 - 3, p.y - 74 * l.s + Math.sin(a) * 6 - 3, 6, 6);
    }
  }
}

function drawHud(ctx: CanvasRenderingContext2D, s: GemState, info: RenderInfo) {
  const art = artFor(s);
  const w = STAGE_W / 4;
  s.runners.forEach((r) => {
    const x = r.index * w + w / 2;
    art.shownScore[r.index] += (r.banked - art.shownScore[r.index]) * 0.2;
    const c = SEAT_COLORS[r.index % 4];
    ctx.fillStyle = 'rgba(7,6,26,.7)';
    ctx.fillRect(x - w / 2 + 6, 62, w - 12, 44);
    ctx.fillStyle = c;
    ctx.fillRect(x - w / 2 + 6, 62, w - 12, 4);
    outlined(ctx, String(Math.round(art.shownScore[r.index])), x - 6, 98, 28, c, w - 30);
    if (r.carry > 0) outlined(ctx, `+${r.carry}`, x + 34, 98, 16, '#ffffff', 40);
    if (r.index === info.me) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - w / 2 + 6, 62, w - 12, 44);
    }
  });
  if (s.frenzy && s.durationMs - s.now > 0) {
    const pulse = 1 + 0.06 * Math.sin(info.clock / 90);
    ctx.save();
    ctx.translate(STAGE_W / 2, 140);
    ctx.scale(pulse, pulse);
    outlined(ctx, tr('lokParty.gems.frenzy'), 0, 0, 30, '#ffd23f');
    ctx.restore();
  }
}

export const gemVacuum: MinigameCartridge<GemState> = {
  id: 'gems',
  accent: '#38f2ff',
  bpm: 150,
  labels: (t) => ({ title: t('lokParty.gems.title'), prompt: t('lokParty.gems.prompt'), hint: t('lokParty.gems.hint') }),
  create: (seed, seats) => createGemVacuum(seed, seats),
  step: stepGemVacuum,
  isOver: (s) => s.over,
  timeLeftMs: (s) => s.durationMs - s.now,
  scores: (s) => s.runners.map((r) => r.banked),
  results: gemResults,
  toWorld: (view, x, y) => {
    const l = layout(view);
    return { x: (x - l.cx) / l.s, y: (y - l.cy) / (l.s * TILT) };
  },
  toStage: project,
  hud: drawHud,
  dashReady: (s, me) => {
    const r = s.runners[me];
    return r ? 1 - Math.max(0, r.boostReadyAt - s.now) / GEMS.boostCooldownMs : 1;
  },

  render(ctx, s, info) {
    const { view, clock, calm } = info;
    const art = artFor(s);
    const dt = clock - art.lastClock;
    art.lastClock = clock;
    for (const sq of art.squash) sq.step(dt);
    for (const r of s.runners) art.squash[r.index].velocityStretch(Math.hypot(r.vx, r.vy) / 400);
    drawFloor(ctx, view, s, clock, calm);
    drawPads(ctx, view, s, art, clock, calm);
    const order = [...s.runners].sort((a, b) => a.y - b.y);
    const things: { y: number; draw: () => void }[] = [];
    for (const g of s.gems) things.push({ y: g.y, draw: () => drawGem(ctx, view, s, g, clock, calm) });
    for (const r of order) things.push({ y: r.y, draw: () => drawRunner(ctx, view, s, r, art, info) });
    things.sort((a, b) => a.y - b.y);
    for (const t of things) t.draw();
  },

  react(s, fx, info) {
    const { view, clock, me } = info;
    const art = artFor(s);
    const at = (x: number, y: number) => project(view, x, y);
    for (const e of s.events) {
      switch (e.type) {
        case 'pick': {
          const p = at(e.x, e.y);
          art.squash[e.index].land(0.25);
          if (e.index === me) fx.chime(e.kind === 'gold');
          fx.burst(p.x, p.y - 10, GEM_COLORS[e.kind], e.kind === 'gold' ? 8 : 3, { speed: 0.2, size: 4 });
          break;
        }
        case 'bank': {
          const p = at(e.x, e.y);
          art.flare[e.index] = clock;
          art.squash[e.index].launch(0.5);
          fx.burst(p.x, p.y - 20, SEAT_COLORS[e.index % 4], Math.min(36, 8 + e.amount * 2), { speed: 0.6, size: 6, gravity: 0.5 });
          fx.burst(p.x, p.y - 20, '#ffd23f', 10, { speed: 0.4, size: 5 });
          if (e.amount >= 8) {
            fx.impact(p.x, p.y - 20, Math.min(0.9, e.amount / 20));
            fx.toast(p.x, p.y - 70, tr('lokParty.gems.bank', { n: e.amount }), SEAT_COLORS[e.index % 4], 34 + Math.min(14, e.amount));
          } else {
            fx.toast(p.x, p.y - 60, `+${e.amount}`, SEAT_COLORS[e.index % 4], 26);
          }
          fx.sound('bank');
          break;
        }
        case 'steal': {
          const p = at(e.x, e.y);
          art.squash[e.from].land(1.2);
          art.squash[e.to].launch(0.7);
          fx.impact(p.x, p.y - 36, 0.7);
          fx.burst(p.x, p.y - 36, '#ffffff', 12, { speed: 0.5 });
          fx.toast(p.x, p.y - 100, e.amount > 0 ? tr('lokParty.gems.steal', { n: e.amount }) : tr('lokParty.gems.bump'), SEAT_COLORS[e.to % 4], 38);
          fx.sound('hit');
          break;
        }
        case 'bomb': {
          const p = at(e.x, e.y);
          fx.impact(p.x, p.y - 20, 1);
          fx.burst(p.x, p.y - 20, '#ff8a3c', 22, { speed: 0.7, smoke: true });
          fx.burst(p.x, p.y - 20, '#ffd23f', 12, { speed: 0.5 });
          fx.flash('#ff3b5c', 140);
          fx.toast(p.x, p.y - 80, tr('lokParty.rumble.boom'), '#ff8a3c', 48);
          fx.sound('slam');
          art.squash[e.index].land(1.4);
          break;
        }
        case 'boost': {
          const r = s.runners[e.index];
          const p = at(r.x, r.y);
          art.squash[e.index].launch(1);
          fx.burst(p.x, p.y, SEAT_COLORS[e.index % 4], 10, { speed: 0.3, size: 5 });
          if (e.index === me) fx.chime(false);
          break;
        }
        case 'frenzy':
          fx.flash('#ffd23f', 220);
          fx.toast(STAGE_W / 2, view.h * 0.36, tr('lokParty.gems.frenzy'), '#ffd23f', 64);
          fx.sound('slam');
          break;
      }
    }
  },
};
