/**
 * Strike a Pose's look and feel (rules in strikePose.ts, runner in MinigameStage.tsx): a spotlit
 * catwalk with the four characters up top, the pose card in the middle that drains like a fuse, and a
 * four-tile cross under your thumb. Right answers pop, flash and shower stars; wrong ones buckle.
 */

import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { t as tr } from '@/lib/i18n';
import { Squash } from './juiceEngine';
import { SEAT_COLORS, type MinigameCartridge, type RenderInfo, type StageView } from './minigameKit';
import { POSE, POSE_NAMES, TILE_CENTERS, cardVisible, createStrikePose, poseResults, roundPhase, roundValue, stepStrikePose, type PoseState } from './strikePose';
import { STAGE_W, backlight, outlined } from './stageArt';

const crossY = (view: StageView) => view.h * 0.79;
const charX = (i: number) => 75 + i * 150;
const charY = (view: StageView) => view.h * 0.3;

interface Art {
  squash: Squash[];
  /** Per runner: when they last scored or fumbled, and which. */
  flashAt: number[];
  flashKind: ('right' | 'wrong' | null)[];
  lastClock: number;
  shown: number[];
}
const arts = new WeakMap<PoseState, Art>();
function artFor(s: PoseState): Art {
  let a = arts.get(s);
  if (!a) {
    a = { squash: s.runners.map(() => new Squash()), flashAt: s.runners.map(() => -1e9), flashKind: s.runners.map(() => null), lastClock: 0, shown: s.runners.map(() => 0) };
    arts.set(s, a);
  }
  return a;
}

/** A stick-figure pose, centred on (x, y); size is the half height. */
export function drawPoseIcon(ctx: CanvasRenderingContext2D, pose: number, x: number, y: number, size: number, color: string) {
  const k = size / 50;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (pts: [number, number][]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  };
  const head = (hx: number, hy: number) => {
    ctx.beginPath();
    ctx.arc(hx, hy, 11, 0, Math.PI * 2);
    ctx.fill();
  };
  switch (pose) {
    case 0: // hero: one fist to the sky, one on the hip
      head(0, -36);
      line([[0, -24], [0, 14]]);
      line([[0, -18], [16, -34], [26, -52]]);
      line([[0, -14], [-18, -2], [-8, 6]]);
      line([[0, 14], [-16, 46]]);
      line([[0, 14], [16, 46]]);
      break;
    case 1: // flex: both arms bent
      head(0, -36);
      line([[0, -24], [0, 14]]);
      line([[0, -16], [-24, -10], [-24, -32]]);
      line([[0, -16], [24, -10], [24, -32]]);
      line([[0, 14], [-14, 46]]);
      line([[0, 14], [14, 46]]);
      break;
    case 2: // star: arms and legs flung out
      head(0, -40);
      line([[0, -28], [0, 8]]);
      line([[0, -22], [-34, -44]]);
      line([[0, -22], [34, -44]]);
      line([[0, 8], [-30, 46]]);
      line([[0, 8], [30, 46]]);
      break;
    default: // crouch: knees bent, hands forward
      head(-6, -18);
      line([[-6, -8], [0, 16]]);
      line([[-4, -2], [22, 6], [34, 0]]);
      line([[0, 16], [20, 22], [14, 46]]);
      line([[0, 16], [-20, 28], [-26, 46]]);
      break;
  }
  ctx.restore();
}

function drawStage(ctx: CanvasRenderingContext2D, view: StageView, s: PoseState, clock: number, calm: boolean) {
  const bg = ctx.createLinearGradient(0, 0, 0, view.h);
  bg.addColorStop(0, '#0d0626');
  bg.addColorStop(0.45, '#2a0f4f');
  bg.addColorStop(1, '#07041a');
  ctx.fillStyle = bg;
  ctx.fillRect(-60, -60, STAGE_W + 120, view.h + 120);
  // Spotlight beams from the rig above onto each character.
  const cy = charY(view);
  for (let i = 0; i < 4; i++) {
    const x = charX(i);
    const c = SEAT_COLORS[i];
    const sway = calm ? 0 : Math.sin(clock / 700 + i * 1.7) * 14;
    const g = ctx.createLinearGradient(0, 0, 0, cy + 60);
    g.addColorStop(0, `${c}00`);
    g.addColorStop(1, `${c}44`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 6 + sway * 0.3, 0);
    ctx.lineTo(x + 6 + sway * 0.3, 0);
    ctx.lineTo(x + 62 + sway, cy + 64);
    ctx.lineTo(x - 62 + sway, cy + 64);
    ctx.closePath();
    ctx.fill();
  }
  // The catwalk floor.
  ctx.fillStyle = '#1a0b3a';
  ctx.fillRect(0, cy + 50, STAGE_W, 34);
  ctx.fillStyle = '#ff3fd2';
  ctx.fillRect(0, cy + 50, STAGE_W, 3);
  // Crowd silhouettes along the bottom of the catwalk.
  ctx.fillStyle = '#05030f';
  for (let i = 0; i < 18; i++) {
    const bob = calm ? 0 : Math.sin(clock / 260 + i * 2.1) * 3;
    ctx.beginPath();
    ctx.arc(i * 36 + 8, cy + 102 + bob + (i % 3) * 3, 15, 0, Math.PI * 2);
    ctx.fill();
  }
  void s;
}

function drawChars(ctx: CanvasRenderingContext2D, view: StageView, s: PoseState, art: Art, info: RenderInfo) {
  const { clock, calm, me } = info;
  const phase = roundPhase(s);
  const y = charY(view);
  for (const r of s.runners) {
    const def = CHARACTERS_BY_ID[r.characterId];
    if (!def) continue;
    const x = charX(r.index);
    const c = SEAT_COLORS[r.index % 4];
    const since = clock - art.flashAt[r.index];
    const k = Math.max(0, 1 - since / 600);
    const kind = art.flashKind[r.index];
    drawShadow(ctx, x, y + 46, 34);
    backlight(ctx, x, y, 86, c);
    ctx.save();
    ctx.translate(x + (kind === 'wrong' ? Math.sin(since / 22) * 5 * k : 0), y + 46);
    const sq = art.squash[r.index];
    ctx.scale(sq.scaleX, sq.scaleY);
    const anim = kind === 'wrong' && k > 0 ? 'hurt' : kind === 'right' && k > 0 ? 'attack' : 'idle';
    const hop = kind === 'right' ? Math.sin(Math.min(1, since / 420) * Math.PI) * 26 * (1 - Math.min(1, since / 420) * 0.2) : 0;
    drawRig(ctx, def.rig, def.palette, anim, clock + r.index * 211, 0, -hop, r.index < 2 ? 1 : -1, 3.4);
    ctx.restore();
    // Camera flashes when someone nails it.
    if (!calm && kind === 'right' && k > 0.6) {
      ctx.fillStyle = `rgba(255,255,255,${(k - 0.6) * 1.8})`;
      ctx.beginPath();
      ctx.arc(x, y - 10, 90, 0, Math.PI * 2);
      ctx.fill();
    }
    // Their pick floats above once they answer.
    if (r.pick >= 0 && (r.index === me || phase !== 'go' || r.rankThisRound > 0)) {
      ctx.fillStyle = 'rgba(7,6,26,.75)';
      ctx.beginPath();
      ctx.arc(x, y - 78, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = 3;
      ctx.stroke();
      drawPoseIcon(ctx, r.pick, x, y - 78, 17, '#ffffff');
      if (r.rankThisRound > 0) outlined(ctx, `#${r.rankThisRound}`, x + 30, y - 94, 18, r.rankThisRound === 1 ? '#ffd23f' : '#ffffff');
    }
    // Score plate.
    art.shown[r.index] += (r.score - art.shown[r.index]) * 0.18;
    ctx.fillStyle = 'rgba(7,6,26,.75)';
    ctx.fillRect(x - 48, y + 62, 96, 30);
    ctx.fillStyle = c;
    ctx.fillRect(x - 48, y + 62, 96, 3);
    outlined(ctx, String(Math.round(art.shown[r.index])), x, y + 86, 24, c, 80);
    if (r.index === me) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 48, y + 62, 96, 30);
    }
    if (r.streak >= 2) outlined(ctx, `x${r.streak}`, x, y + 108, 16, '#ffd23f');
  }
}

function drawCard(ctx: CanvasRenderingContext2D, view: StageView, s: PoseState, info: RenderInfo) {
  const { clock, calm } = info;
  const phase = roundPhase(s);
  const t = s.now - s.roundStart;
  const cx = STAGE_W / 2;
  const cy = view.h * 0.5;
  const kind = s.kinds[s.round];
  const pose = s.poses[s.round];
  const double = kind === 'double';
  // Card.
  const pop = phase === 'ready' ? 0.85 + 0.15 * Math.min(1, t / 250) : 1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  ctx.fillStyle = '#fff4dc';
  ctx.strokeStyle = double ? '#ffd23f' : '#ff3fd2';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(-110, -92, 220, 184, 18);
  ctx.fill();
  ctx.stroke();
  if (cardVisible(s)) {
    drawPoseIcon(ctx, pose, 0, -8, 62, '#2a1a3a');
    outlined(ctx, tr(`lokParty.pose.${POSE_NAMES[pose]}`), 0, 78, 28, double ? '#ff8a3c' : '#ff3fd2', 200);
  } else {
    outlined(ctx, '?', 0, 30, 110, '#7a5cff', 200);
    outlined(ctx, tr('lokParty.pose.memory'), 0, 78, 22, '#7a5cff', 200);
  }
  ctx.restore();
  // Fuse ring that drains during the window.
  if (phase === 'go') {
    const left = 1 - (t - POSE.readyMs) / POSE.windowMs;
    ctx.strokeStyle = left < 0.3 ? '#ff3b5c' : '#38f2ff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, 134, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, left));
    ctx.stroke();
  }
  // Round banner.
  outlined(ctx, tr('lokParty.pose.round', { n: s.round + 1, total: POSE.rounds }), cx, view.h * 0.5 - 106, 22, '#ffffff');
  if (double) {
    const w = calm ? 1 : 1 + 0.06 * Math.sin(clock / 120);
    ctx.save();
    ctx.translate(cx + 112, cy - 92);
    ctx.rotate(0.2);
    ctx.scale(w, w);
    outlined(ctx, tr('lokParty.pose.double'), 0, 0, 24, '#ffd23f', 130);
    ctx.restore();
  }
  if (phase === 'ready') outlined(ctx, tr('lokParty.pose.ready'), cx, cy + 128, 34, '#ffd23f');
}

function drawTiles(ctx: CanvasRenderingContext2D, view: StageView, s: PoseState, info: RenderInfo) {
  const { clock, me } = info;
  const cx = STAGE_W / 2;
  const cy = crossY(view);
  const phase = roundPhase(s);
  const r = s.runners[me];
  const locked = !!r && (s.now < r.lockedUntil || r.pick >= 0 || phase !== 'go');
  for (let i = 0; i < 4; i++) {
    const c = TILE_CENTERS[i];
    const x = cx + c.x;
    const y = cy + c.y;
    const isRight = phase === 'reveal' && s.poses[s.round] === i;
    const mine = !!r && r.pick === i;
    ctx.fillStyle = isRight ? '#2aa84a' : mine ? '#38f2ff' : locked ? '#241441' : '#32205f';
    ctx.strokeStyle = isRight ? '#9bff8a' : '#7a5cff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x - POSE.tile, y - POSE.tile, POSE.tile * 2, POSE.tile * 2, 14);
    ctx.fill();
    ctx.stroke();
    const bounce = isRight ? 1 + 0.08 * Math.sin(clock / 90) : 1;
    drawPoseIcon(ctx, i, x, y, 30 * bounce, locked && !isRight && !mine ? '#6d5aa8' : '#ffffff');
  }
}

export const strikePose: MinigameCartridge<PoseState> = {
  id: 'pose',
  accent: '#ff3fd2',
  bpm: 128,
  labels: (t) => ({ title: t('lokParty.pose.title'), prompt: t('lokParty.pose.prompt'), hint: t('lokParty.pose.hint') }),
  create: (seed, seats) => createStrikePose(seed, seats),
  step: stepStrikePose,
  isOver: (s) => s.over,
  timeLeftMs: (s) => s.durationMs - s.now,
  scores: (s) => s.runners.map((r) => r.score),
  results: poseResults,
  toWorld: (view, x, y) => ({ x: x - STAGE_W / 2, y: y - crossY(view) }),
  toStage: (view, x, y) => ({ x: x + STAGE_W / 2, y: y + crossY(view) }),

  render(ctx, s, info) {
    const art = artFor(s);
    const dt = info.clock - art.lastClock;
    art.lastClock = info.clock;
    for (const sq of art.squash) sq.step(dt);
    drawStage(ctx, info.view, s, info.clock, info.calm);
    drawChars(ctx, info.view, s, art, info);
    drawCard(ctx, info.view, s, info);
    drawTiles(ctx, info.view, s, info);
  },

  react(s, fx, info) {
    const { view, clock, me } = info;
    const art = artFor(s);
    for (const e of s.events) {
      switch (e.type) {
        case 'show':
          fx.chime(false);
          break;
        case 'right': {
          const x = charX(e.index);
          const y = charY(view);
          art.flashAt[e.index] = clock;
          art.flashKind[e.index] = 'right';
          art.squash[e.index].launch(1);
          const c = SEAT_COLORS[e.index % 4];
          fx.burst(x, y - 20, c, 14, { speed: 0.5, size: 6 });
          fx.burst(x, y - 20, '#ffd23f', 10, { speed: 0.4, size: 7 });
          fx.toast(x, y - 120, e.rank === 1 ? tr('lokParty.pose.first', { n: e.points }) : `+${e.points}`, c, e.rank === 1 ? 40 : 28);
          if (e.index === me) {
            fx.chime(e.rank === 1);
            if (e.rank === 1) fx.impact(x, y, 0.4);
          }
          if (e.rank === 1) fx.sound('bank');
          if (e.streak >= 3) fx.toast(x, y + 130, tr('lokParty.pose.streak', { n: e.streak }), '#ffd23f', 30);
          break;
        }
        case 'wrong': {
          const x = charX(e.index);
          const y = charY(view);
          art.flashAt[e.index] = clock;
          art.flashKind[e.index] = 'wrong';
          art.squash[e.index].land(1);
          fx.burst(x, y - 20, '#ff3b5c', 8, { speed: 0.35 });
          fx.toast(x, y - 110, tr('lokParty.pose.wrong'), '#ff3b5c', 30);
          fx.sound('hit');
          if (e.index === me) fx.flash('#ff3b5c', 90);
          break;
        }
        case 'reveal':
          if (s.runners.every((r) => r.pick < 0)) fx.toast(STAGE_W / 2, view.h * 0.5, tr('lokParty.pose.tooSlow'), '#ff3b5c', 36);
          break;
        case 'hide':
          fx.sound('hit');
          break;
      }
    }
  },
};
