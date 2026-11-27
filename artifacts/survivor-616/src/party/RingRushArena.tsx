/**
 * RingRushArena -- the screen for Ring Run Rush (rules in ringRush.ts). Portrait first, one thumb:
 * drag to steer. Art rule: runners are our own procedural rigs; the street is drawn here.
 */

import { setPadGameplay } from '@/lib/consolePad';
import { lokPad } from '../../../../lib/lok-universe/src/gamepad';
import { isSavingPower } from '@/lib/powerSaver';
import { useEffect, useRef } from 'react';
import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { RING_STYLES } from '@/game/data/ringRuns';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { useT } from '@/lib/i18n';
import { ENTRANCE, PODIUM_MS } from './minigameKit';
import { drawEntrance, drawPodium } from './stageArt';
import { Squash, createJuice, drawRefractionRings } from './juiceEngine';
import { RUSH, createRingRush, rushMultiplier, rushResults, stepRingRush, type RushInput, type RushResult, type RushState } from './ringRush';

const W = 600;
const MID = W / 2;
const HALF = 262; // street half width where runners stand
const FOCAL = 430; // smaller means a deeper, faster looking street
const STEP = 1000 / 60;
const LANE_COLORS = ['#38f2ff', '#ff3fd2', '#ffd23f', '#7cff6b'];

interface Props {
  seed: number;
  roster: { characterId: string; bot: boolean; botSkill?: number }[];
  onDone: (results: RushResult[]) => void;
  getAudioContext: () => AudioContext | null;
}

/** The camera: the canvas is always 600 wide; its height follows the phone. */
interface View {
  h: number;
  horizon: number;
  base: number; // screen y where a row is judged
}

/** A point on the street, `ahead` units in front of the runners, as screen position and size. */
function project(v: View, x: number, ahead: number) {
  const k = FOCAL / (FOCAL + Math.max(-FOCAL * 0.6, ahead));
  return { x: MID + x * HALF * k, y: v.horizon + (v.base - v.horizon) * k, k };
}

function quad(ctx: CanvasRenderingContext2D, color: string, points: [number, number][]) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => ctx[i === 0 ? 'moveTo' : 'lineTo'](x, y));
  ctx.closePath();
  ctx.fill();
}

function drawStreet(ctx: CanvasRenderingContext2D, v: View, distance: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, v.horizon + 40);
  sky.addColorStop(0, '#120a38');
  sky.addColorStop(0.65, '#4a1f6b');
  sky.addColorStop(1, '#ff7a59');
  ctx.fillStyle = sky;
  ctx.fillRect(-40, -40, W + 80, v.horizon + 80);
  // Far skyline.
  for (let i = 0; i < 14; i++) {
    const tall = 40 + ((i * 53) % 90);
    ctx.fillStyle = '#1d1146';
    ctx.fillRect(i * 46 - 20, v.horizon - tall, 40, tall + 2);
    ctx.fillStyle = '#ffd23f';
    for (let w = 0; w < 4; w++) if ((i + w) % 3 !== 0) ctx.fillRect(i * 46 - 12 + (w % 2) * 16, v.horizon - tall + 8 + Math.floor(w / 2) * 16, 5, 7);
  }
  ctx.fillStyle = '#0d0a24';
  ctx.fillRect(-40, v.horizon, W + 80, v.h - v.horizon + 40);

  const near = -250;
  const far = 40000;
  const edge = (x: number, ahead: number): [number, number] => {
    const p = project(v, x, ahead);
    return [p.x, p.y];
  };
  quad(ctx, '#1b1740', [edge(-1, far), edge(1, far), edge(1, near), edge(-1, near)]);
  // Neon curbs.
  for (const [side, color] of [[-1, '#ff3fd2'], [1, '#38f2ff']] as const) quad(ctx, color, [edge(side, far), edge(side * 1.05, far), edge(side * 1.05, near), edge(side, near)]);
  // Lane dashes and road bars rushing toward the camera.
  const gap = 160;
  for (let at = gap * 24 - (distance % gap); at > near; at -= gap) {
    for (const x of [-0.31, 0.31]) quad(ctx, 'rgba(255,255,255,0.22)', [edge(x - 0.012, at + 70), edge(x + 0.012, at + 70), edge(x + 0.012, at), edge(x - 0.012, at)]);
  }
  // Buildings on both sides, farthest first.
  const block = 300;
  const first = Math.floor(distance / block);
  for (let n = first + 12; n >= first; n--) {
    const at = n * block - distance;
    for (const side of [-1, 1]) {
      const p = project(v, side * 1.22, at);
      const q = project(v, side * 1.22, at + block * 0.82);
      const tall = 260 + (((n * 37 + side * 11) % 5) + 5) % 5 * 55;
      const shade = ((n + (side > 0 ? 1 : 0)) % 2 + 2) % 2 === 0 ? '#2e2168' : '#4a1f5e';
      quad(ctx, shade, [[p.x, p.y], [q.x, q.y], [q.x, q.y - tall * q.k], [p.x, p.y - tall * p.k]]);
      quad(ctx, '#1a1240', [[p.x, p.y], [p.x + side * 420 * p.k, p.y], [p.x + side * 420 * p.k, p.y - tall * p.k], [p.x, p.y - tall * p.k]]);
      ctx.fillStyle = (((n + side) % 3) + 3) % 3 === 0 ? '#ffd23f' : '#38f2ff';
      for (let w = 0; w < 3; w++) ctx.fillRect(p.x + side * (30 + w * 62) * p.k - 14 * p.k, p.y - (tall - 55) * p.k, 28 * p.k, 40 * p.k);
    }
  }
}

function drawRingGate(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, color: string, glow: string) {
  // An upright hoop standing on the road, big enough to run through.
  const rx = RUSH.ringHalf * HALF * k * 0.95;
  const ry = 82 * k;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 28 * k;
  ctx.strokeStyle = color;
  ctx.lineWidth = 15 * k;
  ctx.beginPath();
  ctx.ellipse(x, y - ry, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = glow;
  ctx.lineWidth = 4 * k;
  ctx.stroke();
  ctx.restore();
}

function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, spin: number) {
  const r = RUSH.boulderHalf * HALF * k;
  drawShadow(ctx, x, y, r);
  ctx.save();
  ctx.translate(x, y - r * 0.85);
  ctx.rotate(spin);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rr = r * (i % 2 === 0 ? 1 : 0.84);
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
  body.addColorStop(0, '#9aa6cc');
  body.addColorStop(1, '#3a4262');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = '#7cc8ff';
  ctx.lineWidth = 6 * k;
  ctx.stroke();
  ctx.fillStyle = '#2b3150';
  ctx.fillRect(-r * 0.45, -r * 0.25, r * 0.4, r * 0.28);
  ctx.fillRect(r * 0.15, r * 0.2, r * 0.3, r * 0.2);
  ctx.restore();
}

/** A pool of light behind a runner, so dark outfits never vanish into the night street. */
function backlight(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${color}cc`);
  g.addColorStop(0.55, `${color}44`);
  g.addColorStop(1, `${color}00`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function RingRushArena({ seed, roster, onDone, getAudioContext }: Props) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const labels = {
    title: t('lokParty.rush.title'),
    prompt: t('lokParty.rush.prompt'),
    over: t('lokParty.rush.over'),
    hint: t('lokParty.rush.hint'),
    go: t('lokParty.stage.go'),
    skip: t('lokParty.stage.skip'),
    you: t('lokParty.drop.you'),
  };
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  // The match is fixed at mount; a parent re-render must not restart the run.
  const rosterRef = useRef(roster);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const juice = createJuice(getAudioContext, { motion: calm ? 0 : 1, bpm: 128 });
    const state: RushState = createRingRush(seed, rosterRef.current);
    const me = state.runners.findIndex((r) => !r.bot);
    const input: RushInput = { mx: 0, target: null };
    const keys = new Set<string>();
    const toasts: { x: number; text: string; color: string; born: number }[] = [];
    const squash = state.runners.map(() => new Squash());
    const sparks: { x: number; y: number; vx: number; vy: number; born: number; color: string }[] = [];
    const burst = (x: number, y: number, color: string, n: number) => {
      if (calm) return;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const v = 0.14 + (i % 3) * 0.08;
        sparks.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 0.12, born: clock, color });
      }
    };
    let dpr = 1;
    let fit = 1;
    const view: View = { h: 900, horizon: 220, base: 700 };
    let offX = 0;
    let offY = 0;
    let raf = 0;
    let last = performance.now();
    let clock = 0;
    let intro = 0;
    let acc = 0;
    let overAt = 0;
    const hopAt = state.runners.map(() => -999);
    let finished = false;

    const resize = () => {
      dpr = Math.min(isSavingPower() ? 1 : 2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      // Fill a portrait phone edge to edge; on a wide screen keep a centred column.
      fit = Math.min(canvas.width / W, canvas.height / 860);
      offX = (canvas.width - W * fit) / 2;
      offY = 0;
      view.h = canvas.height / fit;
      view.horizon = view.h * 0.27;
      view.base = view.h - 300;
    };
    resize();

    const aim = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      const px = ((e.clientX - box.left) / box.width) * canvas.width;
      input.target = Math.max(-1, Math.min(1, ((px - offX) / fit - MID) / HALF));
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      if (intro < ENTRANCE.countdownAt) intro = ENTRANCE.countdownAt;
      aim(e);
    };
    const move = (e: PointerEvent) => {
      if (e.pressure > 0 || e.buttons > 0) aim(e);
    };
    const lift = () => {
      input.target = null;
    };
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!['arrowleft', 'arrowright', 'a', 'd'].includes(k)) return;
      e.preventDefault();
      if (e.type === 'keydown') keys.add(k);
      else keys.delete(k);
    };
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', lift);
    canvas.addEventListener('pointercancel', lift);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
    setPadGameplay(true);
    const offPad = lokPad.subscribe((f) => {
      if (f.pressed.has('a') || f.pressed.has('menu')) {
        if (intro < ENTRANCE.countdownAt) intro = ENTRANCE.countdownAt;
      }
    });

    const text = (s: string, x: number, y: number, size: number, color: string) => {
      ctx.font = `900 ${size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(4, size / 6);
      ctx.strokeStyle = '#07061a';
      ctx.strokeText(s, x, y, W - 30);
      ctx.fillStyle = color;
      ctx.fillText(s, x, y, W - 30);
    };

    const draw = () => {
      const L = labelsRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#07061a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const jolt = juice.camera.shake();
      ctx.setTransform(fit, 0, 0, fit, offX + jolt.dx * fit, offY + jolt.dy * fit);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, view.h);
      ctx.clip();
      // Spring zoom punch around the player.
      const zoom = juice.camera.zoomValue;
      ctx.translate(MID, view.base);
      ctx.scale(zoom, zoom);
      ctx.translate(-MID, -view.base);
      drawStreet(ctx, view, state.distance);
      // Speed streaks once the combo is hot.
      const heat = rushMultiplier(state.runners[me]?.combo ?? 0);
      if (heat >= 3 && !calm && !state.over) {
        ctx.fillStyle = heat >= 5 ? 'rgba(255,63,210,0.5)' : 'rgba(56,242,255,0.38)';
        for (let i = 0; i < heat * 4; i++) ctx.fillRect(((i * 137) % W), ((i * 211 + clock * 1.5) % (view.h + 120)) - 120, 3, 60 + heat * 12);
      }
      for (let i = state.course.length - 1; i >= 0; i--) {
        const row = state.course[i];
        const ahead = row.at - state.distance;
        if (ahead < -150 || ahead > 2600) continue;
        // Rows already passed fade out so they never hide the runners.
        ctx.globalAlpha = ahead < 0 ? Math.max(0, 1 + ahead / 150) * 0.5 : Math.min(1, (2600 - ahead) / 700);
        if (row.type === 'boulder') {
          for (const l of row.lanes) {
            const p = project(view, RUSH.lanes[l], ahead);
            drawRock(ctx, p.x, p.y, p.k, calm ? 0 : state.distance / 110 + l);
          }
        } else {
          const p = project(view, RUSH.lanes[row.lane], ahead);
          drawRingGate(ctx, p.x, p.y, p.k, RING_STYLES[row.kind].color, RING_STYLES[row.kind].glow);
        }
        ctx.globalAlpha = 1;
      }
      // Rivals run a few steps behind so all four stay in view; the player is drawn on top.
      const order = state.runners.filter((r) => r.index !== me).concat(state.runners[me] ?? []);
      order.forEach((r, i) => {
        const def = CHARACTERS_BY_ID[r.characterId];
        if (!def || state.over) return;
        const mineRunner = r.index === me;
        const stunned = state.now < r.stunUntil;
        // A little hop whenever this runner takes a ring.
        const age = clock - hopAt[r.index];
        const hop = age < 260 && !calm ? Math.sin((age / 260) * Math.PI) * 26 : 0;
        const p = project(view, r.x, mineRunner ? 0 : -22 - i * 24);
        const y = p.y;
        const color = LANE_COLORS[r.index % 4];
        const size = (mineRunner ? 4.8 : 2.9) * p.k;
        backlight(ctx, p.x, y - size * 11, size * 20, color);
        drawShadow(ctx, p.x, y + 4, size * 9);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(p.x, y + 4, size * 10, size * 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Afterimages at a top combo.
        if (mineRunner && heat >= 4 && !calm) {
          for (let g = 2; g >= 1; g--) {
            ctx.globalAlpha = 0.18 * (3 - g);
            drawRig(ctx, def.rig, def.palette, 'walk', clock - g * 70, p.x, y - hop + g * 26, 1, size);
          }
          ctx.globalAlpha = 1;
        }
        ctx.save();
        ctx.translate(p.x, y - hop);
        ctx.scale(squash[r.index].scaleX, squash[r.index].scaleY);
        drawRig(ctx, def.rig, def.palette, stunned ? 'hurt' : 'walk', clock, 0, 0, 1, size, { flash: stunned && Math.floor(clock / 60) % 2 === 0 });
        ctx.restore();
        ctx.globalAlpha = 1;
        // Dizzy stars circle a runner who hit a boulder.
        if (stunned) {
          for (let k = 0; k < 3; k++) {
            const ang = clock / 140 + (k * Math.PI * 2) / 3;
            text('*', p.x + Math.cos(ang) * 36, y - 24 * size + Math.sin(ang) * 9, 34, '#ffd23f');
          }
        }
        if (mineRunner) text(L.you, p.x, y + 42, 24, '#ffffff');
      });
      for (const spark of sparks) {
        const age = clock - spark.born;
        ctx.globalAlpha = Math.max(0, 1 - age / 520);
        ctx.fillStyle = spark.color;
        ctx.fillRect(spark.x + spark.vx * age - 4, spark.y + spark.vy * age + age * age * 0.0004 - 4, 8, 8);
      }
      ctx.globalAlpha = 1;
      for (const toast of toasts) text(toast.text, toast.x, view.base - 150 - (clock - toast.born) * 0.08, 30, toast.color);

      const mine = state.runners[me];
      const left = Math.max(0, Math.ceil((state.durationMs - state.now) / 1000));
      text(String(left), MID, 60, 46, left <= 5 ? '#ff3fd2' : '#ffffff');
      if (mine) {
        text(`${mine.score}`, 110, 56, 40, '#ffd23f');
        text(`x${rushMultiplier(mine.combo)}`, 110, 96, 28, '#38f2ff');
      }
      state.runners
        .filter((r) => r.index !== me)
        .forEach((r, i) => text(`${r.score}`, W - 70, 46 + i * 34, 24, LANE_COLORS[r.index % 4]));

      const middle = view.h / 2;
      if (intro < ENTRANCE.playAt + ENTRANCE.goMs) {
        drawEntrance(ctx, {
          h: view.h,
          t: intro,
          calm,
          accent: '#38f2ff',
          seats: state.runners.map((r) => ({ characterId: r.characterId, you: r.index === me })),
          labels: { title: L.title, prompt: L.prompt, hint: L.hint, go: L.go, you: L.you, skip: L.skip },
        });
      } else if (state.over) {
        drawPodium(ctx, { h: view.h, clock, since: clock - overAt, calm, me, title: L.over, you: L.you, results: rushResults(state) });
      }
      ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawRefractionRings(ctx, canvas, juice.waves, clock, dpr);
    };

    const frame = (ts: number) => {
      const dt = Math.min(100, Math.max(0, ts - last));
      last = ts;
      clock += dt;
      intro += dt;
      if (state.over) overAt ||= clock;
      juice.camera.step(dt);
      juice.waves.prune(clock);
      for (const sq of squash) sq.step(dt);
      while (sparks.length && clock - sparks[0].born > 520) sparks.shift();
      while (toasts.length && clock - toasts[0].born > 600) toasts.shift();
      if (intro >= ENTRANCE.playAt && !state.over) {
        acc += dt;
        while (acc >= STEP && !state.over) {
          acc -= STEP;
          input.mx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
          const pf = lokPad.frame;
          if (input.mx === 0 && pf.connected) input.mx = pf.lx || (pf.down.has('right') ? 1 : 0) - (pf.down.has('left') ? 1 : 0);
          stepRingRush(state, state.runners.map((r) => (r.index === me ? input : null)), STEP);
          for (const e of state.events) {
            const runner = state.runners[e.index];
            if (e.type === 'ring') {
              hopAt[e.index] = clock;
              squash[e.index].launch(e.index === me ? 1 : 0.6);
            } else if (e.type === 'crash') squash[e.index].land(1.2);
            if (e.index !== me) continue;
            const x = project(view, runner.x, 0).x;
            // Shockwaves are placed in CSS pixels.
            const wave = (strength: number) => juice.waves.spawn((offX + x * fit) / dpr, (offY + (view.base - 60) * fit) / dpr, clock, strength);
            if (e.type === 'ring') {
              const color = RING_STYLES[e.kind!].color;
              juice.chimes.pickup(clock, { bright: e.kind !== 'speed' });
              toasts.push({ x, text: `+${e.points}`, color, born: clock });
              burst(x, view.base - 70, color, 14);
              // The big effect is saved for a new multiplier step.
              if (runner.combo % 3 === 0) {
                wave(1);
                juice.camera.punch();
              }
            } else if (e.type === 'crash') {
              juice.chimes.accent('hit');
              juice.camera.addTrauma(0.9);
              burst(x, view.base - 70, '#7cc8ff', 22);
              wave(1.3);
            }
          }
        }
      }
      draw();
      if (state.over) {
        overAt ||= clock;
        if (!finished && clock - overAt >= PODIUM_MS) {
          finished = true;
          doneRef.current(rushResults(state));
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', lift);
      canvas.removeEventListener('pointercancel', lift);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
      setPadGameplay(false);
      offPad();
    };
  }, [seed, getAudioContext]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} aria-label={labels.title} />;
}
