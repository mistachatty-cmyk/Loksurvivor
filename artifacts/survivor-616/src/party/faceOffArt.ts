/**
 * Face Off's look and feel (rules in faceOff.ts, runner in MinigameStage.tsx): a big drawing pad shaped
 * like your character's face with a faint guide, three rivals sketching in small frames above, and a
 * 2x2 gallery reveal with scores and a winner's crown.
 */

import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { drawRig } from '@/game/render/sprite';
import { t as tr } from '@/lib/i18n';
import { FACE, createFaceOff, faceResults, guideFor, roundPhase, roundScore, stepFaceOff, type FaceRunner, type FaceState } from './faceOff';
import { SEAT_COLORS, type MinigameCartridge, type RenderInfo, type StageView } from './minigameKit';
import { STAGE_W, backlight, outlined } from './stageArt';

const BIG = 0.95;
const bigCenter = (view: StageView) => ({ x: STAGE_W / 2, y: view.h * 0.55 });

/** Centres and scale of each runner's face in the reveal gallery. */
function galleryCell(view: StageView, i: number) {
  const cols = 2;
  const w = STAGE_W / cols;
  const top = view.h * 0.17;
  const rowH = (view.h * 0.74) / 2;
  return { x: (i % cols) * w + w / 2, y: top + Math.floor(i / cols) * rowH + rowH / 2, k: Math.min(0.5, (rowH - 60) / (FACE.halfH * 2)) };
}
/** Small frames for the rivals during the draw. */
function thumbCell(view: StageView, slot: number) {
  return { x: 100 + slot * 200, y: view.h * 0.13, k: 0.22 };
}

interface Art {
  lastClock: number;
  revealAt: number;
  shown: number[];
}
const arts = new WeakMap<FaceState, Art>();
const artFor = (s: FaceState): Art => {
  let a = arts.get(s);
  if (!a) {
    a = { lastClock: 0, revealAt: -1e9, shown: s.runners.map(() => 0) };
    arts.set(s, a);
  }
  return a;
};

function drawFace(ctx: CanvasRenderingContext2D, r: FaceRunner, cx: number, cy: number, k: number, opts: { guide?: boolean; clock: number; calm: boolean; color: string; prompt: FaceState['prompts'][number] }) {
  const def = CHARACTERS_BY_ID[r.characterId];
  const pal = def?.palette;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  // Head, hair/hood, ears.
  ctx.fillStyle = pal?.bodyDark ?? '#3a2a55';
  ctx.beginPath();
  ctx.ellipse(0, -30, FACE.halfW + 6, FACE.halfH - 6, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal?.skin ?? '#e8b890';
  ctx.beginPath();
  ctx.ellipse(0, 0, FACE.halfW - 10, FACE.halfH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal?.body ?? '#6a4aa8';
  ctx.beginPath();
  ctx.ellipse(0, -FACE.halfH + 34, FACE.halfW - 18, 70, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // Eyes and mouth.
  ctx.fillStyle = '#ffffff';
  for (const sx of [-60, 60]) {
    ctx.beginPath();
    ctx.ellipse(sx, -28, 26, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = pal?.ink ?? '#14102a';
  for (const sx of [-56, 64]) {
    ctx.beginPath();
    ctx.arc(sx, -26, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = pal?.ink ?? '#14102a';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-34, 96);
  ctx.quadraticCurveTo(0, 124, 34, 96);
  ctx.stroke();
  // Guide.
  if (opts.guide) {
    ctx.strokeStyle = `rgba(255,255,255,${opts.calm ? 0.5 : 0.35 + 0.15 * Math.sin(opts.clock / 260)})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 10]);
    for (const line of guideFor(opts.prompt)) {
      ctx.beginPath();
      line.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // The doodle itself.
  ctx.strokeStyle = opts.color;
  ctx.fillStyle = opts.color;
  ctx.lineWidth = FACE.brush * 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const stroke of r.strokes) {
    if (stroke.length === 1) {
      ctx.beginPath();
      ctx.arc(stroke[0].x, stroke[0].y, FACE.brush, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    stroke.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, s: FaceState, info: RenderInfo) {
  const phase = roundPhase(s);
  const t = s.now - s.roundStart;
  const view = info.view;
  const prompt = s.prompts[s.round];
  const left = Math.max(0, 1 - t / FACE.drawMs);
  outlined(ctx, tr('lokParty.face.round', { n: s.round + 1, total: FACE.rounds }), STAGE_W / 2, 56, 20, '#ffffff');
  if (phase === 'draw') {
    outlined(ctx, tr('lokParty.face.draw', { what: tr(`lokParty.face.${prompt}`) }), STAGE_W / 2, view.h * 0.24, 38, '#ffd23f', STAGE_W - 40);
    ctx.fillStyle = 'rgba(7,6,26,.7)';
    ctx.fillRect(60, view.h * 0.255, STAGE_W - 120, 12);
    ctx.fillStyle = left < 0.25 ? '#ff3b5c' : '#38f2ff';
    ctx.fillRect(60, view.h * 0.255, (STAGE_W - 120) * left, 12);
  } else {
    outlined(ctx, tr('lokParty.face.reveal'), STAGE_W / 2, view.h * 0.115, 34, '#ffd23f');
  }
}

export const faceOff: MinigameCartridge<FaceState> = {
  id: 'face',
  accent: '#ffd23f',
  bpm: 118,
  labels: (t) => ({ title: t('lokParty.face.title'), prompt: t('lokParty.face.prompt'), hint: t('lokParty.face.hint') }),
  create: (seed, seats) => createFaceOff(seed, seats),
  step: stepFaceOff,
  isOver: (s) => s.over,
  timeLeftMs: (s) => s.durationMs - s.now,
  scores: (s) => s.runners.map((r) => r.score),
  results: faceResults,
  toWorld: (view, x, y) => {
    const c = bigCenter(view);
    return { x: (x - c.x) / BIG, y: (y - c.y) / BIG };
  },
  toStage: (view, x, y) => {
    const c = bigCenter(view);
    return { x: c.x + x * BIG, y: c.y + y * BIG };
  },
  hud: drawHud,

  render(ctx, s, info) {
    const { view, clock, calm, me } = info;
    const art = artFor(s);
    art.lastClock = clock;
    const bg = ctx.createLinearGradient(0, 0, 0, view.h);
    bg.addColorStop(0, '#1a0b3a');
    bg.addColorStop(1, '#07041a');
    ctx.fillStyle = bg;
    ctx.fillRect(-60, -60, STAGE_W + 120, view.h + 120);
    const phase = roundPhase(s);
    const prompt = s.prompts[s.round];
    if (phase === 'draw') {
      // Rivals in small frames, you big.
      let slot = 0;
      for (const r of s.runners) {
        if (r.index === me) continue;
        const c = thumbCell(view, slot++);
        ctx.fillStyle = 'rgba(7,6,26,.6)';
        ctx.strokeStyle = SEAT_COLORS[r.index % 4];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(c.x - 80, c.y - 46, 160, 92, 12);
        ctx.fill();
        ctx.stroke();
        drawFace(ctx, r, c.x, c.y, c.k, { clock, calm, color: SEAT_COLORS[r.index % 4], prompt });
      }
      const c = bigCenter(view);
      backlight(ctx, c.x, c.y, 280, SEAT_COLORS[me % 4]);
      const mine = s.runners[me];
      drawFace(ctx, mine, c.x, c.y, BIG, { guide: true, clock, calm, color: SEAT_COLORS[me % 4], prompt });
      // Pen dot and live score.
      if (mine.penDown) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(c.x + mine.pen.x * BIG, c.y + mine.pen.y * BIG, FACE.brush * BIG + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      const live = roundScore(mine, prompt);
      art.shown[me] += (live - art.shown[me]) * 0.2;
      outlined(ctx, `${Math.round(art.shown[me])}%`, STAGE_W / 2, c.y + FACE.halfH * BIG + 60, 34, '#ffffff');
    } else {
      // Gallery.
      const best = Math.max(...s.runners.map((r) => r.roundScores[s.round] ?? 0));
      for (const r of s.runners) {
        const c = galleryCell(view, r.index);
        const pts = r.roundScores[s.round] ?? 0;
        const isBest = pts === best && pts > 0;
        const pop = Math.min(1, (clock - art.revealAt - r.index * 140) / 260);
        if (pop <= 0) continue;
        const sc = c.k * (0.7 + 0.3 * pop);
        backlight(ctx, c.x, c.y, 200, SEAT_COLORS[r.index % 4]);
        drawFace(ctx, r, c.x, c.y, sc, { clock, calm, color: SEAT_COLORS[r.index % 4], prompt });
        outlined(ctx, `+${pts}`, c.x, c.y + FACE.halfH * sc + 38, 34, isBest ? '#ffd23f' : '#ffffff');
        if (isBest) {
          ctx.save();
          ctx.translate(c.x, c.y - FACE.halfH * sc - 14);
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath();
          ctx.moveTo(-26, 0); ctx.lineTo(-26, -26); ctx.lineTo(-13, -12); ctx.lineTo(0, -34); ctx.lineTo(13, -12); ctx.lineTo(26, -26); ctx.lineTo(26, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        const def = CHARACTERS_BY_ID[r.characterId];
        if (def && pop >= 1) drawRig(ctx, def.rig, def.palette, isBest ? 'attack' : 'idle', clock + r.index * 90, c.x + 120, c.y + FACE.halfH * sc + 10, -1, 1.6);
      }
    }
    // Total plates along the bottom.
    const w = STAGE_W / 4;
    for (const r of s.runners) {
      const x = r.index * w + w / 2;
      ctx.fillStyle = 'rgba(7,6,26,.7)';
      ctx.fillRect(x - w / 2 + 6, view.h - 64, w - 12, 44);
      ctx.fillStyle = SEAT_COLORS[r.index % 4];
      ctx.fillRect(x - w / 2 + 6, view.h - 64, w - 12, 4);
      outlined(ctx, String(r.score), x, view.h - 30, 28, SEAT_COLORS[r.index % 4], w - 24);
    }
  },

  react(s, fx, info) {
    const { view, clock } = info;
    const art = artFor(s);
    for (const e of s.events) {
      switch (e.type) {
        case 'prompt':
          fx.chime(false);
          fx.toast(STAGE_W / 2, view.h * 0.4, tr(`lokParty.face.${e.prompt}`).toUpperCase(), '#ffd23f', 52);
          break;
        case 'reveal':
          art.revealAt = clock;
          fx.flash('#ffffff', 120);
          fx.sound('slam');
          break;
        case 'scored': {
          const c = galleryCell(view, e.index);
          if (e.rank === 1 && e.points > 0) {
            fx.burst(c.x, c.y - 40, '#ffd23f', 24, { speed: 0.6, size: 7, gravity: 0.5 });
            fx.chime(true);
          }
          if (e.points >= 85) fx.toast(c.x, c.y - 90, tr('lokParty.face.great'), SEAT_COLORS[e.index % 4], 34);
          break;
        }
      }
    }
  },
};
