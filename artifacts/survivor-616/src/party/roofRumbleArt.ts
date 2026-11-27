/**
 * Roof Rumble's look and feel (rules in roofRumble.ts, runner in MinigameStage.tsx): a 2.5D neon
 * rooftop high over the city at night, crumbling inward. Characters are their own procedural rigs.
 */

import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { t as tr } from '@/lib/i18n';
import { Squash } from './juiceEngine';
import { SEAT_COLORS, type MinigameCartridge, type RenderInfo, type StageView } from './minigameKit';
import { RUMBLE, crackingRing, createRoofRumble, rumbleResults, stepRoofRumble, type RumbleArena, type RumbleRunner, type RumbleState } from './roofRumble';
import { STAGE_W, backlight, outlined } from './stageArt';

const TILT = 0.7;
const SCALE = 0.88;
const RIG = 3.5;

function layout(view: StageView) {
  return { cx: STAGE_W / 2, cy: view.h * 0.53, s: SCALE };
}

const project = (view: StageView, x: number, y: number) => {
  const l = layout(view);
  return { x: l.cx + x * l.s, y: l.cy + y * l.s * TILT };
};

/** Per-match look state that the rules do not need: springs and trails. */
interface Art {
  squash: Squash[];
  trail: { x: number; y: number }[][];
  lastClock: number;
}
const arts = new WeakMap<RumbleState, Art>();
function artFor(s: RumbleState): Art {
  let a = arts.get(s);
  if (!a) {
    a = { squash: s.runners.map(() => new Squash()), trail: s.runners.map(() => []), lastClock: 0 };
    arts.set(s, a);
  }
  return a;
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

function drawBackdrop(ctx: CanvasRenderingContext2D, view: StageView, clock: number, calm: boolean) {
  const sky = ctx.createLinearGradient(0, 0, 0, view.h);
  sky.addColorStop(0, '#0b0626');
  sky.addColorStop(0.35, '#2a1259');
  sky.addColorStop(0.6, '#120a33');
  sky.addColorStop(1, '#05040f');
  ctx.fillStyle = sky;
  ctx.fillRect(-60, -60, STAGE_W + 120, view.h + 120);
  for (let i = 0; i < 46; i++) {
    const tw = calm ? 0.7 : 0.4 + 0.6 * Math.abs(Math.sin(clock / 600 + i));
    ctx.globalAlpha = tw;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hash(i) * STAGE_W, hash(i + 99) * view.h * 0.3, 2, 2);
  }
  ctx.globalAlpha = 1;
  backlight(ctx, 470, view.h * 0.1, 90, '#ffd9a0');
  ctx.fillStyle = '#fff1d0';
  ctx.beginPath();
  ctx.arc(470, view.h * 0.1, 34, 0, Math.PI * 2);
  ctx.fill();
  // The city far below: blocks of lit windows and car lights streaming along the streets.
  const ground = view.h * 0.3;
  for (let i = 0; i < 16; i++) {
    const w = 30 + hash(i + 3) * 40;
    const tall = 40 + hash(i + 7) * 90;
    const x = i * 40 - 10;
    ctx.fillStyle = i % 2 ? '#1c1045' : '#26135a';
    ctx.fillRect(x, ground - tall, w, tall + view.h);
    ctx.fillStyle = hash(i) > 0.5 ? '#ffd23f' : '#38f2ff';
    for (let k = 0; k < 6; k++) if (hash(i * 13 + k) > 0.45) ctx.fillRect(x + 5 + (k % 2) * 14, ground - tall + 8 + Math.floor(k / 2) * 16, 6, 8);
  }
  for (let lane = 0; lane < 3; lane++) {
    const y = view.h * (0.78 + lane * 0.07);
    for (let c = 0; c < 9; c++) {
      const x = ((c * 140 + (calm ? 0 : clock * (0.08 + lane * 0.04)) * (lane % 2 ? -1 : 1)) % (STAGE_W + 140) + STAGE_W + 140) % (STAGE_W + 140) - 70;
      ctx.fillStyle = lane % 2 ? '#ff5a6e' : '#fff3b0';
      ctx.fillRect(x, y, 14, 3);
    }
  }
}

function drawAntenna(ctx: CanvasRenderingContext2D, view: StageView, s: RumbleState, clock: number) {
  const base = project(view, 0, -s.radius * 0.98);
  ctx.strokeStyle = '#4b3a86';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(base.x - 30, base.y);
  ctx.lineTo(base.x, base.y - 190);
  ctx.lineTo(base.x + 30, base.y);
  ctx.moveTo(base.x - 18, base.y - 70);
  ctx.lineTo(base.x + 18, base.y - 70);
  ctx.moveTo(base.x - 10, base.y - 130);
  ctx.lineTo(base.x + 10, base.y - 130);
  ctx.stroke();
  if (Math.floor(clock / 500) % 2 === 0) backlight(ctx, base.x, base.y - 194, 26, '#ff3b5c');
  ctx.fillStyle = '#ff3b5c';
  ctx.beginPath();
  ctx.arc(base.x, base.y - 194, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoof(ctx: CanvasRenderingContext2D, view: StageView, s: RumbleState, clock: number, calm: boolean) {
  const { cx, cy } = layout(view);
  const rx = s.radius * SCALE;
  const ry = rx * TILT;
  // The building falls away below the roof, past the bottom of the screen.
  const wall = ctx.createLinearGradient(0, cy, 0, view.h);
  wall.addColorStop(0, '#2f2366');
  wall.addColorStop(1, '#0c0820');
  ctx.fillStyle = wall;
  ctx.fillRect(cx - rx, cy, rx * 2, view.h - cy + 40);
  for (let row = 0; row < 12; row++) {
    for (let col = -6; col <= 6; col++) {
      const x = cx + col * 44;
      if (Math.abs(col * 44) > rx - 22) continue;
      const lit = hash(row * 31 + col * 7) > 0.55;
      ctx.fillStyle = lit ? (hash(row + col) > 0.5 ? '#ffd23f' : '#38f2ff') : '#1a1240';
      ctx.fillRect(x - 10, cy + ry + 34 + row * 58, 20, 30);
    }
  }
  // Roof slab edge.
  ctx.fillStyle = '#1d1544';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 22, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Roof top.
  const top = ctx.createRadialGradient(cx, cy - ry * 0.3, 10, cx, cy, rx);
  top.addColorStop(0, '#4c3c8f');
  top.addColorStop(1, '#2a2160');
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = top;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 2;
  for (let g = -RUMBLE.radius; g <= RUMBLE.radius; g += 60) {
    const a = project(view, g, -RUMBLE.radius);
    const b = project(view, g, RUMBLE.radius);
    const c = project(view, -RUMBLE.radius, g);
    const d = project(view, RUMBLE.radius, g);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }
  // The Lok emblem in the middle.
  ctx.strokeStyle = 'rgba(56,242,255,0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 90 * SCALE, 90 * SCALE * TILT, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, TILT);
  ctx.font = '900 110px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,210,63,0.28)';
  ctx.fillText('L', 0, 4);
  ctx.restore();
  if (s.arena === 'collapse') drawRingSeams(ctx, view, s, clock, calm);
  // Hazard band along the edge; it pulses while the roof is crumbling.
  const shrinking = s.arena === 'sumo' && s.now > RUMBLE.shrinkFromMs && s.now < RUMBLE.shrinkToMs;
  const pulse = shrinking && !calm ? 0.55 + 0.45 * Math.sin(clock / 90) : 0.5;
  // Collapse reads its danger from the cracking ring instead.
  ctx.globalAlpha = s.arena === 'collapse' ? 0 : pulse;
  ctx.strokeStyle = '#ff3b5c';
  ctx.lineWidth = 34 * SCALE;
  ctx.setLineDash([22, 18]);
  ctx.lineDashOffset = calm ? 0 : -clock / 30;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 18 * SCALE, ry - 18 * SCALE * TILT, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.restore();
  // Neon rim.
  const finalRing = s.arena === 'collapse' && s.ringsDropped === RUMBLE.rings.length - 1;
  const rim = finalRing ? '#ffd23f' : '#38f2ff';
  ctx.save();
  ctx.shadowColor = rim;
  ctx.shadowBlur = finalRing && !calm ? 22 + 14 * Math.abs(Math.sin(clock / 140)) : 22;
  ctx.strokeStyle = rim;
  ctx.lineWidth = finalRing ? 9 : 6;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function annulus(ctx: CanvasRenderingContext2D, cx: number, cy: number, inner: number, outer: number) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, outer * SCALE, outer * SCALE * TILT, 0, 0, Math.PI * 2);
  ctx.moveTo(cx + inner * SCALE, cy);
  ctx.ellipse(cx, cy, inner * SCALE, inner * SCALE * TILT, 0, 0, Math.PI * 2);
  ctx.fill('evenodd');
}

/** Roof Collapse: the seams between floor rings, and the ring that is cracking. */
function drawRingSeams(ctx: CanvasRenderingContext2D, view: StageView, s: RumbleState, clock: number, calm: boolean) {
  const { cx, cy } = layout(view);
  ctx.strokeStyle = 'rgba(7,6,26,0.65)';
  ctx.lineWidth = 5;
  for (const r of RUMBLE.rings) {
    if (r >= s.radius) continue;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * SCALE, r * SCALE * TILT, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const i = crackingRing(s.now);
  if (i < 0) return;
  const outer = RUMBLE.rings[i];
  const inner = RUMBLE.rings[i + 1];
  const left = RUMBLE.ringDropAt[i] - s.now;
  const urgency = 1 - left / RUMBLE.ringWarnMs;
  const jx = calm ? 0 : Math.sin(clock / 23) * 4 * urgency;
  const jy = calm ? 0 : Math.cos(clock / 19) * 3 * urgency;
  // Flashes faster as the drop gets closer.
  const on = calm || Math.floor(clock / (60 + 180 * (1 - urgency))) % 2 === 0;
  ctx.fillStyle = on ? `rgba(255,59,92,${0.35 + 0.35 * urgency})` : 'rgba(255,210,63,0.18)';
  annulus(ctx, cx + jx, cy + jy, inner, outer);
  // Cracks spreading across the ring.
  ctx.strokeStyle = '#07061a';
  ctx.lineWidth = 3;
  const cracks = 10;
  for (let k = 0; k < cracks; k++) {
    const a = (k / cracks) * Math.PI * 2 + hash(i * 7 + k) * 0.4;
    const reach = inner + (outer - inner) * Math.min(1, urgency * 1.4);
    ctx.beginPath();
    for (let step = 0; step <= 4; step++) {
      const d = inner + ((reach - inner) * step) / 4;
      const wob = (hash(k * 13 + step) - 0.5) * 0.12;
      const p = project(view, Math.cos(a + wob) * d, Math.sin(a + wob) * d);
      ctx[step === 0 ? 'moveTo' : 'lineTo'](p.x + jx, p.y + jy);
    }
    ctx.stroke();
  }
  // The safe line: where the floor will still be.
  ctx.save();
  ctx.shadowColor = '#ffd23f';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = '#ffd23f';
  ctx.globalAlpha = calm ? 0.9 : 0.6 + 0.4 * Math.abs(Math.sin(clock / 110));
  ctx.lineWidth = 6;
  ctx.setLineDash([16, 10]);
  ctx.lineDashOffset = calm ? 0 : clock / 25;
  ctx.beginPath();
  ctx.ellipse(cx, cy, inner * SCALE, inner * SCALE * TILT, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Roof Collapse: a ring that just dropped breaks into chunks that tumble down the building. */
function drawFallingRings(ctx: CanvasRenderingContext2D, view: StageView, s: RumbleState, side: 'back' | 'front', calm: boolean) {
  const { cx, cy } = layout(view);
  const pieces = 20;
  RUMBLE.ringDropAt.forEach((at, i) => {
    const e = s.now - at;
    if (e < 0 || e > 1900) return;
    const outer = RUMBLE.rings[i];
    const inner = RUMBLE.rings[i + 1];
    const mid = (outer + inner) / 2;
    for (let k = 0; k < pieces; k++) {
      const a0 = (k / pieces) * Math.PI * 2;
      const a1 = ((k + 1) / pieces) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      if ((Math.sin(am) < 0) !== (side === 'back')) continue;
      // Each chunk lets go a beat apart, so the ring visibly shatters rather than sliding as one.
      const t = Math.max(0, e - hash(i * 31 + k) * 260);
      const drop = t * t * 0.0011 + t * 0.05;
      const out = t * 0.05;
      const spin = calm ? 0 : ((hash(k + i * 7) - 0.5) * t) / 170;
      const c = project(view, Math.cos(am) * mid, Math.sin(am) * mid);
      const sector = (y: number, fill: string) => {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.ellipse(cx, y, outer * SCALE, outer * SCALE * TILT, 0, a0, a1);
        ctx.ellipse(cx, y, inner * SCALE, inner * SCALE * TILT, 0, a1, a0, true);
        ctx.closePath();
        ctx.fill();
      };
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 1600);
      ctx.translate(c.x + Math.cos(am) * out, c.y + drop + Math.sin(am) * out * TILT);
      ctx.rotate(spin);
      ctx.translate(-c.x, -c.y);
      sector(cy + 20, '#1d1544');
      sector(cy, k % 2 ? '#4c3c8f' : '#43357f');
      ctx.strokeStyle = '#38f2ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, outer * SCALE, outer * SCALE * TILT, 0, a0, a1);
      ctx.stroke();
      ctx.restore();
    }
  });
  ctx.globalAlpha = 1;
}

function drawBarrel(ctx: CanvasRenderingContext2D, view: StageView, s: RumbleState, b: RumbleState['barrels'][number], clock: number, calm: boolean) {
  const p = project(view, b.x, b.y);
  if (!b.landed) {
    const k = 1 - Math.max(0, b.landAt - s.now) / RUMBLE.barrelDropMs;
    drawShadow(ctx, p.x, p.y, 10 + 22 * k);
    ctx.globalAlpha = 0.3 + 0.5 * k;
    ctx.strokeStyle = '#ff3b5c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 30, 30 * TILT, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawBarrelBody(ctx, p.x, p.y - (1 - k) * (1 - k) * 620, 1, clock, false);
    return;
  }
  const left = b.fuseAt - s.now;
  const urgent = 1 - Math.max(0, left) / RUMBLE.barrelFuseMs;
  // The blast zone, so everyone can read the danger.
  ctx.globalAlpha = 0.18 + 0.4 * urgent;
  ctx.fillStyle = '#ff3b5c';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, RUMBLE.blastRadius * SCALE, RUMBLE.blastRadius * SCALE * TILT, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawShadow(ctx, p.x, p.y, 30);
  const blinkMs = 80 + 400 * (1 - urgent);
  const on = Math.floor(clock / blinkMs) % 2 === 0;
  if (on) backlight(ctx, p.x, p.y - 34, 60 + urgent * 40, '#ff6a3d');
  const wobble = calm ? 0 : Math.sin(clock / 40) * urgent * 0.12;
  drawBarrelBody(ctx, p.x, p.y, 1 + urgent * 0.12, clock, on, wobble);
}

function drawBarrelBody(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, clock: number, lit: boolean, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.fillStyle = lit ? '#ff5a3d' : '#d3263f';
  ctx.strokeStyle = '#07061a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(-24, -62, 48, 62, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-24, -44, 48, 9);
  ctx.fillRect(-24, -20, 48, 9);
  ctx.fillStyle = '#07061a';
  ctx.font = '900 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, -28);
  // Fuse spark.
  ctx.strokeStyle = '#3b2a20';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -62);
  ctx.quadraticCurveTo(10, -74, 6, -82);
  ctx.stroke();
  ctx.fillStyle = Math.floor(clock / 70) % 2 ? '#ffffff' : '#ffd23f';
  ctx.beginPath();
  ctx.arc(6, -84, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRunner(ctx: CanvasRenderingContext2D, view: StageView, s: RumbleState, r: RumbleRunner, art: Art, info: RenderInfo) {
  const def = CHARACTERS_BY_ID[r.characterId];
  if (!def) return;
  const { clock, calm, me } = info;
  const color = SEAT_COLORS[r.index % 4];
  const p = project(view, r.x, r.y);
  let lift = 0;
  if (r.dropUntil > s.now) {
    const k = 1 - (r.dropUntil - s.now) / RUMBLE.dropMs;
    lift = (1 - k) * (1 - k) * 700;
  }
  const dashing = s.now < r.dashUntil;
  const stunned = s.now < r.stunUntil;
  const blink = s.now < r.invulnUntil && Math.floor(clock / 90) % 2 === 0;

  drawShadow(ctx, p.x, p.y + 2, 26 * (lift ? Math.max(0.3, 1 - lift / 700) : 1));
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, 32, 32 * TILT, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (r.index === me && !lift) {
    // Dash cooldown fills the ring.
    const ready = Math.min(1, 1 - (r.dashReadyAt - s.now) / RUMBLE.dashCooldownMs);
    ctx.strokeStyle = ready >= 1 ? '#ffffff' : '#ffd23f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 38, 38 * TILT, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, ready));
    ctx.stroke();
  }
  // Afterimages while dashing.
  if (!calm) {
    art.trail[r.index].forEach((pt, i, all) => {
      const q = project(view, pt.x, pt.y);
      ctx.globalAlpha = 0.12 + (0.3 * i) / all.length;
      drawRig(ctx, def.rig, def.palette, 'attack', clock, q.x, q.y, r.facing, RIG);
    });
    ctx.globalAlpha = 1;
  }
  backlight(ctx, p.x, p.y - 34 - lift, 62, color);
  ctx.globalAlpha = blink ? 0.45 : 1;
  const teetering = r.teeterUntil > s.now;
  if (teetering) backlight(ctx, p.x, p.y - 30, 70, '#ff3b5c');
  ctx.save();
  ctx.translate(p.x, p.y - lift);
  // Windmilling on the edge.
  if (teetering && !calm) ctx.rotate(Math.sin(clock / 28) * 0.3);
  ctx.scale(art.squash[r.index].scaleX, art.squash[r.index].scaleY);
  const speed = Math.hypot(r.vx, r.vy);
  const anim = dashing ? 'attack' : stunned ? 'hurt' : speed > 40 ? 'walk' : 'idle';
  drawRig(ctx, def.rig, def.palette, anim, clock, 0, 0, r.facing, RIG, { flash: stunned && Math.floor(clock / 60) % 2 === 0 });
  ctx.restore();
  ctx.globalAlpha = 1;
  const head = p.y - lift - 22 * RIG;
  if (teetering) {
    outlined(ctx, '!!', p.x, head - 6, 44, '#ff3b5c');
  } else if (stunned) {
    for (let k = 0; k < 3; k++) {
      const a = clock / 120 + (k * Math.PI * 2) / 3;
      outlined(ctx, '*', p.x + Math.cos(a) * 30, head - 6 + Math.sin(a) * 8, 30, '#ffd23f');
    }
  } else if (Math.hypot(r.x, r.y) > s.radius - 45 && !lift) {
    // Teetering on the edge.
    outlined(ctx, '!', p.x + (calm ? 0 : Math.sin(clock / 50) * 4), head - 4, 34, '#ff3b5c');
  }
  if (r.index === me) {
    const bob = calm ? 0 : Math.sin(clock / 180) * 5;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#07061a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x - 12, head - 34 + bob);
    ctx.lineTo(p.x + 12, head - 34 + bob);
    ctx.lineTo(p.x, head - 18 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawFaller(ctx: CanvasRenderingContext2D, view: StageView, s: RumbleState, r: RumbleRunner, clock: number) {
  const def = CHARACTERS_BY_ID[r.characterId];
  if (!def) return;
  const e = s.now - r.fallingSince;
  const p = project(view, r.fallX * 1.05, r.fallY * 1.05);
  const k = Math.max(0.25, 1 - e / RUMBLE.fallMs);
  ctx.save();
  ctx.translate(p.x, p.y + e * e * 0.0007 + e * 0.05);
  ctx.rotate((e / 140) * (r.index % 2 ? 1 : -1));
  ctx.globalAlpha = k;
  drawRig(ctx, def.rig, def.palette, 'hurt', clock, 0, 0, r.facing, RIG * k);
  ctx.restore();
  ctx.globalAlpha = 1;
}

const HITS = ['lokParty.rumble.hit1', 'lokParty.rumble.hit2', 'lokParty.rumble.hit3'] as const;

const makeRumble = (arena: RumbleArena): MinigameCartridge<RumbleState> => ({
  id: arena === 'collapse' ? 'collapse' : 'rumble',
  accent: arena === 'collapse' ? '#ffd23f' : '#ff3fd2',
  bpm: 140,
  labels: (t) =>
    arena === 'collapse'
      ? { title: t('lokParty.collapse.title'), prompt: t('lokParty.rumble.prompt'), hint: t('lokParty.collapse.hint') }
      : { title: t('lokParty.rumble.title'), prompt: t('lokParty.rumble.prompt'), hint: t('lokParty.rumble.hint') },
  create: (seed, seats) => createRoofRumble(seed, seats, arena),
  step: stepRoofRumble,
  isOver: (s) => s.over,
  timeLeftMs: (s) => s.durationMs - s.now,
  scores: (s) => s.runners.map((r) => r.score),
  results: rumbleResults,
  toWorld: (view, x, y) => {
    const l = layout(view);
    return { x: (x - l.cx) / l.s, y: (y - l.cy) / (l.s * TILT) };
  },
  toStage: project,
  hud: drawCollapseHud,
  dashReady: (s, me) => {
    const r = s.runners[me];
    return r ? 1 - Math.max(0, r.dashReadyAt - s.now) / RUMBLE.dashCooldownMs : 1;
  },

  render(ctx, s, info) {
    const { view, clock, calm } = info;
    const art = artFor(s);
    const dt = clock - art.lastClock;
    art.lastClock = clock;
    for (const sq of art.squash) sq.step(dt);
    for (const r of s.runners) {
      const trail = art.trail[r.index];
      if (s.now < r.dashUntil) trail.push({ x: r.x, y: r.y });
      else trail.shift();
      if (trail.length > 4) trail.shift();
    }
    drawBackdrop(ctx, view, clock, calm);
    drawAntenna(ctx, view, s, clock);
    // Fallers off the back edge drop behind the building.
    for (const r of s.runners) if (r.fallingSince && r.fallY < 0) drawFaller(ctx, view, s, r, clock);
    if (s.arena === 'collapse') drawFallingRings(ctx, view, s, 'back', calm);
    drawRoof(ctx, view, s, clock, calm);
    if (s.arena === 'collapse') drawFallingRings(ctx, view, s, 'front', calm);
    const things: { y: number; draw: () => void }[] = [];
    for (const b of s.barrels) if (!b.gone) things.push({ y: b.y, draw: () => drawBarrel(ctx, view, s, b, clock, calm) });
    for (const r of s.runners) if (!r.fallingSince) things.push({ y: r.y, draw: () => drawRunner(ctx, view, s, r, art, info) });
    things.sort((a, b) => a.y - b.y).forEach((th) => th.draw());
    for (const r of s.runners) if (r.fallingSince && r.fallY >= 0) drawFaller(ctx, view, s, r, clock);
  },

  react(s, fx, info) {
    const { view, me } = info;
    const art = artFor(s);
    const at = (x: number, y: number) => project(view, x, y);
    for (const e of s.events) {
      switch (e.type) {
        case 'dash': {
          const p = at(e.x, e.y);
          art.squash[e.index].launch(0.9);
          fx.burst(p.x, p.y, SEAT_COLORS[e.index % 4], 6, { speed: 0.22, size: 6 });
          if (e.index === me) fx.chime(false);
          break;
        }
        case 'bump': {
          const p = at(e.x, e.y);
          fx.impact(p.x, p.y - 40, 0.85);
          fx.burst(p.x, p.y - 40, '#ffd23f', 18, { speed: 0.55 });
          fx.burst(p.x, p.y - 40, '#ffffff', 8, { speed: 0.35, size: 6 });
          fx.toast(p.x, p.y - 110, tr(HITS[(e.by + e.index + s.runners[e.index].falls) % 3]), SEAT_COLORS[e.by % 4], 46);
          fx.sound('hit');
          art.squash[e.index].land(1.3);
          art.squash[e.by].launch(0.6);
          break;
        }
        case 'clash': {
          const p = at(e.x, e.y);
          fx.impact(p.x, p.y - 40, 0.6);
          fx.burst(p.x, p.y - 40, '#ffffff', 16, { speed: 0.5 });
          fx.toast(p.x, p.y - 110, tr('lokParty.rumble.clash'), '#ffffff', 40);
          fx.sound('hit');
          art.squash[e.a].land(1);
          art.squash[e.b].land(1);
          break;
        }
        case 'fall': {
          const p = at(e.x, e.y);
          fx.burst(p.x, p.y, '#4c3c8f', 10, { speed: 0.25, gravity: 0.0016 });
          if (e.index === me) {
            fx.sound('slam');
            fx.toast(p.x, p.y - 80, String(RUMBLE.points.fall), '#ff3b5c', 40);
          }
          break;
        }
        case 'ko': {
          const p = at(e.x, e.y);
          fx.toast(p.x, Math.min(p.y - 60, view.h - 120), tr('lokParty.rumble.ko', { points: RUMBLE.points.ko }), SEAT_COLORS[e.by % 4], 52);
          if (e.by === me) {
            fx.chime(true);
            fx.sound('bank');
          }
          break;
        }
        case 'land': {
          const p = at(e.x, e.y);
          art.squash[e.index].land(1.2);
          fx.impact(p.x, p.y, 0.25);
          fx.burst(p.x, p.y, SEAT_COLORS[e.index % 4], 12, { speed: 0.3 });
          break;
        }
        case 'barrelLand': {
          const p = at(e.x, e.y);
          fx.impact(p.x, p.y, 0.3);
          fx.burst(p.x, p.y, '#bfb6e6', 10, { speed: 0.25, smoke: true, size: 12 });
          fx.sound('slam');
          break;
        }
        case 'boom': {
          const p = at(e.x, e.y);
          fx.impact(p.x, p.y - 30, 1);
          fx.flash('#ffb347', 170);
          fx.burst(p.x, p.y - 30, '#ffd23f', 22, { speed: 0.7, size: 11 });
          fx.burst(p.x, p.y - 30, '#ff6a3d', 18, { speed: 0.5, size: 13 });
          fx.burst(p.x, p.y - 30, '#3a2f5a', 12, { speed: 0.16, size: 22, smoke: true });
          fx.toast(p.x, p.y - 120, tr('lokParty.rumble.boom'), '#ff9f2e', 72);
          fx.sound('crack');
          fx.sound('slam');
          break;
        }
        case 'crumble': {
          // Chunks break off the front edge and tumble down the building.
          for (let k = 0; k < 3; k++) {
            const a = (hash(e.radius + k * 17) * 0.9 + 0.05) * Math.PI;
            const p = at(Math.cos(a) * (e.radius + 10), Math.sin(a) * (e.radius + 10));
            fx.burst(p.x, p.y, k % 2 ? '#4c3c8f' : '#2a2160', 5, { speed: 0.14, size: 14, gravity: 0.0018 });
          }
          break;
        }
        case 'ringWarn': {
          // The banner under the timer says it; a popup here would cover the fight.
          fx.sound('crack');
          fx.flash('#ff3b5c', 140);
          break;
        }
        case 'ringTick': {
          fx.sound('hit');
          fx.flash('#ff3b5c', 70);
          const ring = crackingRing(s.now);
          if (ring >= 0) {
            const mid = (RUMBLE.rings[ring] + RUMBLE.rings[ring + 1]) / 2;
            for (let k = 0; k < 6; k++) {
              const a = (hash(s.now + k) * 0.9 + 0.05) * Math.PI;
              const p = at(Math.cos(a) * mid, Math.sin(a) * mid);
              fx.burst(p.x, p.y, '#bfb6e6', 3, { speed: 0.1, size: 10, smoke: true });
            }
          }
          break;
        }
        case 'ringDrop': {
          const front = at(0, e.outer);
          fx.impact(front.x, front.y, 1);
          fx.flash('#ffffff', 170);
          fx.sound('slam');
          fx.sound('crack');
          for (let k = 0; k < 20; k++) {
            const a = (k / 20) * Math.PI * 2;
            const p = at(Math.cos(a) * e.inner, Math.sin(a) * e.inner);
            fx.burst(p.x, p.y, '#bfb6e6', 2, { speed: 0.12, size: 14, smoke: true });
          }
          break;
        }
        case 'teeter': {
          if (e.index === me) fx.sound('hit');
          break;
        }
        case 'save': {
          const p = at(e.x, e.y);
          fx.impact(p.x, p.y - 30, 0.45);
          fx.burst(p.x, p.y - 30, '#ffd23f', 16, { speed: 0.45 });
          fx.toast(p.x, p.y - 110, tr('lokParty.rumble.clutch'), '#ffd23f', 54);
          if (e.index === me) fx.chime(true);
          art.squash[e.index].launch(1.2);
          break;
        }
        case 'multiKo': {
          const p = at(e.x, e.y);
          fx.toast(p.x, p.y - 150, tr(e.count >= 3 ? 'lokParty.rumble.triple' : 'lokParty.rumble.double'), SEAT_COLORS[e.by % 4], 62);
          fx.flash(SEAT_COLORS[e.by % 4], 120);
          break;
        }
        default:
          break;
      }
    }
  },
});

function drawCollapseHud(ctx: CanvasRenderingContext2D, s: RumbleState, info: RenderInfo) {
  if (s.arena !== 'collapse') return;
  const { clock, calm } = info;
  const cx = STAGE_W / 2;
  const cy = 128;
  const cracking = crackingRing(s.now);
  // Ring pips: outermost first. Lit while standing, red while cracking, dim once gone.
  RUMBLE.rings.forEach((_, k) => {
    const r = 34 - k * 8;
    const gone = k < s.ringsDropped;
    const flashing = k === cracking && (calm || Math.floor(clock / 110) % 2 === 0);
    ctx.strokeStyle = gone ? 'rgba(255,255,255,0.15)' : flashing ? '#ff3b5c' : k === RUMBLE.rings.length - 1 ? '#ffd23f' : '#38f2ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  // Slam banner right after a ring drops.
  const lastDrop = s.ringsDropped > 0 ? RUMBLE.ringDropAt[s.ringsDropped - 1] : -1e9;
  const since = s.now - lastDrop;
  if (since >= 0 && since < 1400) {
    const final = s.ringsDropped === RUMBLE.rings.length - 1;
    const slam = calm ? 1 : 1 + Math.max(0, 1 - since / 220) * 1.6;
    ctx.save();
    ctx.translate(cx, cy + 74);
    ctx.scale(slam, slam);
    ctx.globalAlpha = Math.min(1, (1400 - since) / 300);
    outlined(ctx, tr(final ? 'lokParty.collapse.finalRing' : 'lokParty.collapse.ringDown'), 0, 0, 56, final ? '#ffd23f' : '#ff3b5c');
    ctx.restore();
    ctx.globalAlpha = 1;
  } else if (cracking >= 0) {
    const left = RUMBLE.ringDropAt[cracking] - s.now;
    const n = Math.max(1, Math.ceil(left / RUMBLE.ringTickMs));
    const beat = (RUMBLE.ringWarnMs - left) % RUMBLE.ringTickMs;
    const pop = calm ? 1 : 1 + Math.max(0, 1 - beat / 200) * 0.35;
    ctx.save();
    ctx.translate(cx, cy + 66);
    ctx.scale(pop, pop);
    outlined(ctx, tr('lokParty.collapse.fallsIn', { n }), 0, 0, 34, '#ff3b5c');
    ctx.restore();
  } else if (s.ringsDropped === RUMBLE.rings.length - 1) {
    outlined(ctx, tr('lokParty.collapse.finalRing'), cx, cy + 66, 30, '#ffd23f');
  }
}

export const roofRumble = makeRumble('sumo');
export const roofCollapse = makeRumble('collapse');
