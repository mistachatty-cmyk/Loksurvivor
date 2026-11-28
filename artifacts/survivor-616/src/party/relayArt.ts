/**
 * Rooftop Relay's look and feel (rules in relay.ts, runner in MinigameStage.tsx): two lanes of night
 * rooftops scrolling past, a runner per team with the baton, partners waiting at the half-way
 * hand-off, gaps with a glowing drop, vents to hop, and speed lines on the turbo leg.
 */

import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { t as tr } from '@/lib/i18n';
import { Squash } from './juiceEngine';
import { SEAT_COLORS, type MinigameCartridge, type RenderInfo, type StageView } from './minigameKit';
import { RELAY, activeSeat, createRelay, isAirborne, relayResults, stepRelay, teamOrder, type RelayState, type Team } from './relay';
import { STAGE_W, backlight, outlined } from './stageArt';

const RUN_X = 190;
const laneY = (view: StageView, lane: number) => view.h * (lane === 0 ? 0.3 : 0.62);
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
/** Which lane a team is drawn in: yours on top. */
const laneOf = (team: number, me: number) => (team === me % 2 ? 0 : 1);

interface Art {
  squash: Squash[];
  lastClock: number;
  shake: number[];
  passAt: number[];
  finishAt: number[];
}
const arts = new WeakMap<RelayState, Art>();
const artFor = (s: RelayState): Art => {
  let a = arts.get(s);
  if (!a) {
    a = { squash: [new Squash(), new Squash()], lastClock: 0, shake: [-1e9, -1e9], passAt: [-1e9, -1e9], finishAt: [-1e9, -1e9] };
    arts.set(s, a);
  }
  return a;
};

function drawLane(ctx: CanvasRenderingContext2D, view: StageView, s: RelayState, t: Team, lane: number, art: Art, info: RenderInfo) {
  const { clock, calm, me } = info;
  const y0 = laneY(view, lane);
  const gy = y0 + 70;
  const color = SEAT_COLORS[t.id];
  const sx = (wx: number) => RUN_X + (wx - t.x);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y0 - 150, STAGE_W, 290);
  ctx.clip();
  // Sky and distant skyline.
  const sky = ctx.createLinearGradient(0, y0 - 150, 0, y0 + 140);
  sky.addColorStop(0, '#0b0626');
  sky.addColorStop(0.7, '#2a1259');
  sky.addColorStop(1, '#120a33');
  ctx.fillStyle = sky;
  ctx.fillRect(0, y0 - 150, STAGE_W, 290);
  for (let i = 0; i < 30; i++) {
    ctx.globalAlpha = calm ? 0.7 : 0.4 + 0.6 * Math.abs(Math.sin(clock / 700 + i));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hash(i) * STAGE_W, y0 - 150 + hash(i + 50) * 110, 2, 2);
  }
  ctx.globalAlpha = 1;
  for (const [par, base, col] of [[0.15, 62, '#1a0f3d'], [0.3, 42, '#241450']] as const) {
    ctx.fillStyle = col;
    const off = (t.x * par) % 140;
    for (let i = -1; i < 6; i++) {
      const bx = i * 140 - off;
      const h = 40 + hash(i + Math.floor((t.x * par) / 140) * 7) * base;
      ctx.fillRect(bx, gy - h - 10, 96, h + 10);
    }
  }
  // Roofs: solid except where gaps are.
  const gaps = s.obstacles.filter((o) => o.kind === 'gap');
  let cursor = -200;
  const roofEnd = RELAY.length + 400;
  const segs: [number, number][] = [];
  for (const g of gaps) {
    segs.push([cursor, g.x]);
    cursor = g.x + g.w;
  }
  segs.push([cursor, roofEnd]);
  for (const [a, b] of segs) {
    const x1 = sx(a);
    const x2 = sx(b);
    if (x2 < -20 || x1 > STAGE_W + 20) continue;
    ctx.fillStyle = '#1b1240';
    ctx.fillRect(x1, gy, x2 - x1, 80);
    ctx.fillStyle = '#3a2a8a';
    ctx.fillRect(x1, gy, x2 - x1, 6);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x1, gy, x2 - x1, 2);
    ctx.globalAlpha = 1;
    // Roof windows.
    ctx.fillStyle = 'rgba(255,210,63,.18)';
    for (let wx = Math.ceil(a / 70) * 70; wx < b; wx += 70) {
      const px = sx(wx);
      if (px > -10 && px < STAGE_W + 10) ctx.fillRect(px, gy + 26, 18, 14);
    }
  }
  // Gap glow and vents.
  for (const o of s.obstacles) {
    const px = sx(o.x);
    if (px > STAGE_W + 40 || px + o.w < -40) continue;
    if (o.kind === 'gap') {
      const g = ctx.createLinearGradient(0, gy, 0, gy + 80);
      g.addColorStop(0, 'rgba(255,59,92,.55)');
      g.addColorStop(1, 'rgba(7,6,26,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px, gy, o.w, 80);
    } else {
      ctx.fillStyle = '#2f2a5e';
      ctx.fillRect(px - 2, gy - 22, o.w + 4, 22);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(px - 2, gy - 22, o.w + 4, 3);
      ctx.strokeStyle = '#8a7cff';
      ctx.lineWidth = 2;
      const spin = calm ? 0 : clock / 90;
      ctx.beginPath();
      ctx.moveTo(px + o.w / 2 - 10 * Math.cos(spin), gy - 12);
      ctx.lineTo(px + o.w / 2 + 10 * Math.cos(spin), gy - 12);
      ctx.stroke();
    }
  }
  // Hand-off banner and finish line.
  const half = sx(RELAY.length / 2);
  if (half > -40 && half < STAGE_W + 40) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(half - 36, gy - 90, 72, 90);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.fillRect(half - 2, gy - 110, 4, 110);
    outlined(ctx, tr('lokParty.relay.handoff'), half, gy - 116, 16, color, 120);
  }
  const fin = sx(RELAY.length);
  if (fin > -40 && fin < STAGE_W + 40) {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#07061a';
      ctx.fillRect(fin - 4, gy - 120 + i * 15, 8, 15);
      ctx.fillStyle = i % 2 ? '#07061a' : '#ffffff';
      ctx.fillRect(fin + 4, gy - 120 + i * 15, 8, 15);
    }
    outlined(ctx, tr('lokParty.relay.finish'), fin + 6, gy - 126, 18, '#ffffff', 100);
  }

  // Partner waiting at the hand-off, then the old runner cooling down there.
  const waitX = RELAY.length / 2 + 54;
  const partnerSeat = s.runners[t.seats[1]];
  const firstSeat = s.runners[t.seats[0]];
  const pdef = partnerSeat && CHARACTERS_BY_ID[partnerSeat.characterId];
  const fdef = firstSeat && CHARACTERS_BY_ID[firstSeat.characterId];
  if (t.leg === 0 && pdef) {
    const px = sx(waitX);
    if (px > -50 && px < STAGE_W + 50) {
      drawShadow(ctx, px, gy + 2, 22);
      backlight(ctx, px, gy - 34, 50, color);
      drawRig(ctx, pdef.rig, pdef.palette, 'idle', clock + 300, px, gy, -1, 3.3);
    }
  }
  if (t.leg === 1 && fdef) {
    const px = sx(waitX - 40);
    if (px > -50 && px < STAGE_W + 50) {
      drawShadow(ctx, px, gy + 2, 22);
      ctx.globalAlpha = 0.9;
      drawRig(ctx, fdef.rig, fdef.palette, 'attack', clock, px, gy, 1, 3.3);
      ctx.globalAlpha = 1;
    }
  }

  // The runner.
  const seat = s.runners[activeSeat(s, t)];
  const def = seat && CHARACTERS_BY_ID[seat.characterId];
  if (def) {
    const airT = isAirborne(s, t) ? 1 - (t.jumpUntil - s.now) / RELAY.jumpMs : 0;
    const lift = airT > 0 ? 4 * airT * (1 - airT) * 120 : 0;
    const stumbled = s.now < t.stumbleUntil;
    const turbo = s.now < t.turboUntil;
    const since = clock - art.shake[t.id];
    drawShadow(ctx, RUN_X, gy + 2, 24 * (1 - lift / 260));
    backlight(ctx, RUN_X, gy - 36 - lift, 62, color);
    if (turbo && !calm) {
      ctx.strokeStyle = `${color}99`;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const ly = gy - 20 - i * 14 + ((clock / 20 + i * 31) % 6);
        ctx.beginPath();
        ctx.moveTo(RUN_X - 40 - ((clock / 4 + i * 47) % 110), ly);
        ctx.lineTo(RUN_X - 14, ly);
        ctx.stroke();
      }
    }
    ctx.save();
    ctx.translate(RUN_X + (stumbled ? Math.sin(since / 26) * 4 * Math.max(0, 1 - since / 500) : 0), gy - lift);
    const sq = art.squash[t.id];
    ctx.scale(sq.scaleX, sq.scaleY);
    drawRig(ctx, def.rig, def.palette, stumbled ? 'hurt' : airT > 0 ? 'attack' : 'walk', clock * (turbo ? 1.5 : 1), 0, 0, 1, 3.6, { flash: stumbled && Math.floor(clock / 70) % 2 === 0 });
    ctx.restore();
    // The baton.
    ctx.save();
    ctx.translate(RUN_X + 16, gy - 62 - lift);
    ctx.rotate(-0.5 + (calm ? 0 : Math.sin(clock / 120) * 0.12));
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-3, -13, 6, 26);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3, -13, 6, 5);
    ctx.restore();
    if (lane === 0 && t.id === me % 2) outlined(ctx, tr('lokParty.drop.you'), RUN_X, gy + 28, 14, color);
  }
  // Lane label.
  ctx.fillStyle = 'rgba(7,6,26,.7)';
  ctx.fillRect(0, y0 - 150, 130, 26);
  outlined(ctx, tr('lokParty.relay.team', { n: t.id + 1 }), 65, y0 - 130, 17, color, 120);
  // Finished banner.
  if (t.finishedAt) {
    const place = s.finishOrder.indexOf(t.id) + 1;
    ctx.fillStyle = 'rgba(7,6,26,.6)';
    ctx.fillRect(0, y0 - 150, STAGE_W, 290);
    outlined(ctx, place === 1 ? tr('lokParty.relay.first') : tr('lokParty.relay.second'), STAGE_W / 2, y0 + 10, 54, place === 1 ? '#ffd23f' : '#ffffff');
  }
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, y0 - 150, STAGE_W, 290);
}

function drawHud(ctx: CanvasRenderingContext2D, s: RelayState, info: RenderInfo) {
  const x0 = 60;
  const w = STAGE_W - 120;
  const y = 64;
  ctx.fillStyle = 'rgba(7,6,26,.7)';
  ctx.fillRect(x0 - 6, y - 14, w + 12, 28);
  ctx.fillStyle = '#3a2a8a';
  ctx.fillRect(x0, y - 2, w, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0 + w / 2 - 1, y - 8, 2, 16);
  for (const t of s.teams) {
    const px = x0 + (Math.min(RELAY.length, t.x) / RELAY.length) * w;
    ctx.fillStyle = SEAT_COLORS[t.id];
    ctx.beginPath();
    ctx.arc(px, y + (t.id === info.me % 2 ? -1 : 1), 8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s.now < 4500) {
    const pulse = 1 + 0.05 * Math.sin(info.clock / 100);
    ctx.save();
    ctx.translate(STAGE_W / 2, info.view.h * 0.465);
    ctx.scale(pulse, pulse);
    outlined(ctx, tr('lokParty.relay.tap'), 0, 0, 34, '#ffd23f');
    ctx.restore();
  }
}

export const rooftopRelay: MinigameCartridge<RelayState> = {
  id: 'relay',
  accent: '#7cff6b',
  bpm: 138,
  labels: (t) => ({ title: t('lokParty.relay.title'), prompt: t('lokParty.relay.prompt'), hint: t('lokParty.relay.hint') }),
  create: (seed, seats) => createRelay(seed, seats),
  step: stepRelay,
  isOver: (s) => s.over,
  timeLeftMs: (s) => s.durationMs - s.now,
  scores: (s) => s.runners.map((r) => Math.round(s.teams[r.team].x)),
  results: relayResults,
  toWorld: (_view, x, y) => ({ x, y }),
  toStage: (_view, x, y) => ({ x, y }),
  hud: drawHud,

  render(ctx, s, info) {
    const art = artFor(s);
    const dt = info.clock - art.lastClock;
    art.lastClock = info.clock;
    for (const sq of art.squash) sq.step(dt);
    ctx.fillStyle = '#07041a';
    ctx.fillRect(-60, -60, STAGE_W + 120, info.view.h + 120);
    for (const t of s.teams) drawLane(ctx, info.view, s, t, laneOf(t.id, info.me), art, info);
    // The team table under the lanes.
    const order = teamOrder(s);
    outlined(ctx, tr('lokParty.relay.lead', { n: order[0] + 1 }), STAGE_W / 2, info.view.h * 0.84, 26, SEAT_COLORS[order[0]]);
  },

  react(s, fx, info) {
    const { view, clock, me } = info;
    const art = artFor(s);
    for (const e of s.events) {
      const lane = laneOf(e.team, me);
      const gy = laneY(view, lane) + 70;
      switch (e.type) {
        case 'jump':
          art.squash[e.team].launch(0.9);
          fx.burst(RUN_X, gy, SEAT_COLORS[e.team], 5, { speed: 0.2, size: 4 });
          if (e.team === me % 2) fx.chime(false);
          break;
        case 'land':
          art.squash[e.team].land(0.8);
          fx.burst(RUN_X, gy, '#ffffff', 5, { speed: 0.25, size: 4 });
          break;
        case 'clear':
          if (e.kind === 'gap' && e.team === me % 2) fx.toast(RUN_X + 60, gy - 120, tr('lokParty.relay.nice'), '#7cff6b', 26);
          break;
        case 'stumble':
          art.squash[e.team].land(1.3);
          art.shake[e.team] = clock;
          fx.burst(RUN_X, gy - 20, '#ff3b5c', 12, { speed: 0.45 });
          fx.toast(RUN_X + 40, gy - 130, e.kind === 'gap' ? tr('lokParty.relay.fell') : tr('lokParty.relay.oof'), '#ff3b5c', 34);
          fx.sound('hit');
          if (e.team === me % 2) fx.impact(RUN_X, gy - 40, 0.5);
          break;
        case 'pass':
          art.passAt[e.team] = clock;
          fx.burst(RUN_X, gy - 50, '#ffd23f', e.clean ? 24 : 10, { speed: 0.6, size: 7 });
          fx.toast(RUN_X + 60, gy - 150, e.clean ? tr('lokParty.relay.turbo') : tr('lokParty.relay.pass'), e.clean ? '#ffd23f' : '#ffffff', e.clean ? 44 : 30);
          fx.sound('bank');
          if (e.team === me % 2) fx.impact(RUN_X, gy - 40, 0.45);
          break;
        case 'finish':
          art.finishAt[e.team] = clock;
          fx.burst(STAGE_W / 2, laneY(view, lane), e.place === 1 ? '#ffd23f' : '#ffffff', e.place === 1 ? 40 : 16, { speed: 0.8, size: 8, gravity: 0.4 });
          if (e.place === 1) {
            fx.flash('#ffffff', 140);
            fx.sound('slam');
          }
          fx.chime(e.place === 1);
          break;
      }
    }
  },
};
