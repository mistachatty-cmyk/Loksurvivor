/**
 * RingRunScreen -- Ring Run Rush, the 30-second neon-street sprint (Lok Party minigame).
 *
 * Same family as the Ring Runs in the main game: cyan speed rings, gold coin rings, magenta surge
 * rings, a chain meter that builds a multiplier, rivals with glowing laser trails, and a Victory
 * Token burst for the winner. The sim is ringRun.ts (pure, seeded); this file is feel: parallax
 * city, spring camera, hit-stop, refraction rings, pentatonic chimes that climb with the chain.
 *
 * Controls: swipe up/down (or the two lane buttons, W/S, arrows, D-pad) to change lane;
 * tap the jump button, Space or gamepad A to jump. Everything fires on press.
 */

import { useEffect, useMemo, useRef } from 'react';
import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { BURST_TOKENS } from '@/game/data/ringRuns';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { useT } from '@/lib/i18n';
import { subscribeActions } from '@/lib/lokInput';
import { Squash, createJuice, drawRefractionRings, impact, type Juice } from './juiceEngine';
import { botSkillsForTier } from './lokDrop';
import { RUSH, NO_INPUT, createRingRun, hash01, piecesBetween, rushResults, rushTimeLeftMs, stepRingRun, type Piece, type RushEvent, type RushInput, type RushState } from './ringRun';
import { seatOrder } from './LokDropScreen';

const VIEW_W = 1000;
const VIEW_H = 600;
const STEP = 1000 / 60;
const RX = 250; // where the human runner stands on screen
const LANE_Y = [330, 424, 518];
const LANE_K = [0.9, 1, 1.1];
const RIG_SCALE = 1.9;
const LANE_COLORS = ['#38f2ff', '#ff3fd2', '#ffd23f', '#7cff6b'];
const RING = { ring: '#46e6ff', high: '#e86bff', gold: '#ffc94d' } as const;
const GLOW = { ring: '#b5f7ff', high: '#f9c4ff', gold: '#fff0b0' } as const;
const COUNTDOWN_MS = 2100;
const BEST_KEY = 'lokparty.rush.best.v1';

export interface RingRunProps {
  seed: number;
  playerId: string;
  onDone: (s: RushState, newBest: boolean) => void;
  getAudioContext: () => AudioContext | null;
  ladderTier: number;
  durationMs?: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
interface Toast {
  x: number;
  y: number;
  text: string;
  born: number;
  color: string;
  big: boolean;
}

function reducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function readBest(): number {
  try {
    const v = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}
function writeBest(v: number): void {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.round(v)));
  } catch {
    /* private mode */
  }
}

/** Seat roster: the human plus three laser rivals whose skill follows the Solo Blitz tier. */
export function rushRoster(playerId: string, tier: number) {
  const skills = [0, ...botSkillsForTier(tier)];
  return seatOrder(playerId).map((id, i) => ({ characterId: id, bot: i !== 0, botSkill: skills[i] }));
}

export function RingRunArena({ seed, playerId, onDone, getAudioContext, ladderTier, durationMs = RUSH.durationMs }: RingRunProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<RushInput>({ laneDelta: 0, jumpPressed: false });
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const labels = useMemo(
    () => ({
      go: t('lokParty.rush.go'),
      score: t('lokParty.rush.score'),
      chain: t('lokParty.rush.chain'),
      final: t('lokParty.rush.final'),
      finish: t('lokParty.rush.finish'),
      best: t('lokParty.rush.newBest'),
      boost: t('lokParty.rush.boost'),
      stumble: t('lokParty.rush.stumble'),
      up: t('lokParty.rush.laneUp'),
      down: t('lokParty.rush.laneDown'),
      jump: t('lokParty.rush.jump'),
      you: t('lokParty.drop.you'),
    }),
    [t],
  );
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const motion = reducedMotion() ? 0 : 1;
    const juice: Juice = createJuice(getAudioContext, { motion, bpm: 124 });
    const L = labelsRef.current;
    const state = createRingRun(seed, rushRoster(playerId, ladderTier), durationMs);
    const squash = state.players.map(() => new Squash());
    const sparks: Spark[] = [];
    const toasts: Toast[] = [];
    const trail: { x: number; lane: number; born: number; color: string }[] = [];
    const bestBefore = readBest();
    let banner: { text: string; until: number; color: string } | null = null;
    let raf = 0;
    let last = performance.now();
    let realNow = 0;
    let acc = 0;
    let ended = false;
    let endAt = 0;
    let lastCount = 4;
    let newBest = false;
    let bestShown = false;
    let fastBpm = false;
    let flash = 0;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let fit = 1;
    let offX = 0;
    let offY = 0;
    let portrait = false;
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      portrait = h > w;
      // Portrait: crop the street sides so the runner stays big.
      fit = portrait ? Math.min(h / VIEW_H, w / (VIEW_W * 0.62)) : Math.min(w / VIEW_W, h / VIEW_H);
      offX = portrait ? w / 2 - (RX + 150) * fit : (w - VIEW_W * fit) / 2;
      offY = (h - VIEW_H * fit) / 2;
    };
    resize();
    window.addEventListener('resize', resize);
    const cam = juice.camera;
    cam.x = VIEW_W / 2;
    cam.y = VIEW_H / 2;

    const toCss = (vx: number, vy: number) => ({ x: offX + vx * fit, y: offY + vy * fit });
    const burst = (x: number, y: number, n: number, colors: string[], speed = 280) => {
      const count = Math.round(n * (motion ? 1 : 0.35));
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = speed * (0.4 + Math.random() * 0.8);
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90, life: 0, max: 360 + Math.random() * 420, color: colors[i % colors.length], size: 2 + Math.random() * 3 });
      }
      if (sparks.length > 320) sparks.splice(0, sparks.length - 320);
    };

    const camDist = () => state.players[0].dist;
    const sxOf = (dist: number) => RX + (dist - camDist());
    const syOf = (lane: number, z = 0) => (LANE_Y[Math.round(lane)] ?? LANE_Y[1]) - z * 0.9 * (LANE_K[Math.round(lane)] ?? 1);

    const handleEvent = (e: RushEvent) => {
      const mine = e.who === 0;
      const p = state.players[e.who];
      const sx = sxOf(e.x);
      const lane = Math.min(2, Math.max(0, e.lane));
      const sy = syOf(lane, 0) - 46 * LANE_K[lane];
      const c = toCss(sx, sy);
      const pan = Math.max(-1, Math.min(1, (sx / VIEW_W) * 2 - 1));
      switch (e.kind) {
        case 'ring':
        case 'high':
        case 'gold': {
          const col = RING[e.kind];
          burst(sx, sy, e.kind === 'gold' ? 30 : 12, [col, GLOW[e.kind], '#ffffff']);
          if (mine) {
            juice.chimes.pickup(realNow, { pan, bright: e.kind !== 'ring' });
            toasts.push({ x: sx + 10, y: sy - 24, text: `+${e.value ?? 0}`, born: realNow, color: col, big: e.kind === 'gold' });
            if (e.kind === 'gold') impact(juice, realNow, c.x, c.y, 0.7);
            if (navigator.vibrate && e.kind === 'gold') navigator.vibrate(18);
          }
          break;
        }
        case 'mult-up':
          if (mine) {
            const w = e.weight;
            banner = { text: `x${e.mult}`, until: realNow + 900, color: '#ffd23f' };
            juice.camera.punch(0.05 + 0.05 * w);
            juice.chimes.accent('bank', pan);
            burst(RX, syOf(p.lane, 0) - 60, 22, ['#ffd23f', '#ffffff', '#ff3fd2'], 340);
            flash = 1;
          }
          break;
        case 'boost':
          burst(sx, sy + 30, 18, ['#46e6ff', '#ffffff'], 380);
          if (mine) {
            toasts.push({ x: sx, y: sy - 30, text: L.boost, born: realNow, color: '#46e6ff', big: true });
            juice.chimes.accent('bank', pan);
            juice.camera.addTrauma(0.15 * motion);
          }
          break;
        case 'rock-hit':
        case 'wall-hit':
          burst(sx, sy, 16, ['#c7b8a3', '#8f7a63', '#ffffff'], 320);
          squash[e.who].land(1);
          if (mine) {
            impact(juice, realNow, c.x, c.y, e.weight);
            juice.chimes.accent('hit', pan);
            toasts.push({ x: RX, y: syOf(p.lane, 0) - 110, text: L.stumble, born: realNow, color: '#ff3f5a', big: true });
            if (navigator.vibrate) navigator.vibrate(40);
          } else juice.camera.addTrauma(0.05 * motion);
          break;
        case 'combo-break':
          if (mine) banner = { text: '', until: 0, color: '#fff' };
          break;
        case 'jump':
          squash[e.who].launch(0.7);
          break;
        case 'land':
          squash[e.who].land(0.6);
          if (mine) burst(RX, syOf(p.lane, 0), 6, ['#c9c4ff'], 120);
          break;
        case 'rush-warn':
          banner = { text: L.final, until: realNow + 1600, color: '#ff3f5a' };
          if (!fastBpm) {
            fastBpm = true;
            juice.bus.bpm = 146;
          }
          break;
        case 'finish':
          banner = { text: L.finish, until: realNow + 1800, color: '#7cff6b' };
          juice.chimes.accent('slam');
          impact(juice, realNow, offX + RX * fit, offY + 300 * fit, 1);
          break;
        default:
          break;
      }
    };

    // ---------------------------------------------------------------- input
    const pushLane = (d: number) => {
      inputRef.current.laneDelta = d;
    };
    const offActions = subscribeActions((a) => {
      if (a.kind === 'dir') {
        if (a.dy !== 0) pushLane(a.dy);
        else if (a.dx > 0) inputRef.current.jumpPressed = true;
      } else if (a.kind === 'primary') inputRef.current.jumpPressed = true;
    });
    let swipe: { id: number; y: number; x: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => {
      void getAudioContext()?.resume?.();
      swipe = { id: e.pointerId, y: e.clientY, x: e.clientX, t: performance.now() };
    };
    const onMove = (e: PointerEvent) => {
      if (!swipe || swipe.id !== e.pointerId) return;
      const dy = e.clientY - swipe.y;
      if (Math.abs(dy) > 26 && Math.abs(dy) > Math.abs(e.clientX - swipe.x)) {
        pushLane(Math.sign(dy));
        swipe.y = e.clientY;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (swipe && swipe.id === e.pointerId) {
        const quick = performance.now() - swipe.t < 220 && Math.hypot(e.clientX - swipe.x, e.clientY - swipe.y) < 12;
        if (quick) inputRef.current.jumpPressed = true;
        swipe = null;
      }
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const readInput = (): RushInput => {
      const out = { laneDelta: inputRef.current.laneDelta, jumpPressed: inputRef.current.jumpPressed };
      inputRef.current.laneDelta = 0;
      inputRef.current.jumpPressed = false;
      return out;
    };

    // ---------------------------------------------------------------- draw
    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#07061a';
      ctx.fillRect(0, 0, W, H);
      ctx.setTransform(dpr * fit, 0, 0, dpr * fit, dpr * offX, dpr * offY);
      cam.apply(ctx, VIEW_W, VIEW_H);
      const pulse = juice.bus.pulse(getAudioContext()?.currentTime ?? realNow / 1000);
      const me = state.players[0];
      const dist = me.dist;
      drawCity(ctx, dist, realNow, pulse, me.mult);
      drawStreet(ctx, dist, realNow, pulse);

      // Depth-sorted pieces and runners.
      type Item = { y: number; x: number; draw: () => void };
      const items: Item[] = [];
      const from = dist - RX - 90;
      const to = dist + (VIEW_W - RX) + 120;
      for (const pc of piecesBetween(state, from, to)) {
        const sx = sxOf(pc.x);
        const ly = LANE_Y[pc.lane];
        const taken = me.taken.has(pc.id) && (pc.kind === 'ring' || pc.kind === 'high' || pc.kind === 'gold' || pc.kind === 'boost');
        if (taken) continue;
        items.push({ y: ly, x: sx, draw: () => drawPiece(ctx, pc, sx, ly, LANE_K[pc.lane], realNow, pulse) });
      }
      // Laser trails first (under the runners).
      for (const p of state.players) {
        const k = LANE_K[Math.round(p.laneY)] ?? 1;
        const sx = p.index === 0 ? RX : Math.max(40, Math.min(VIEW_W - 40, sxOf(p.dist)));
        const sy = laneScreenY(p.laneY) - 40 * k - p.z * 0.9 * k;
        const len = 40 + (p.speed - RUSH.baseSpeed) * 0.9 + (state.now < p.boostUntil ? 120 : 0);
        const g = ctx.createLinearGradient(sx - len, 0, sx, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, LANE_COLORS[p.index] + (p.index === 0 ? 'cc' : '99'));
        ctx.fillStyle = g;
        ctx.fillRect(sx - len, sy - 2.5, len, 5);
      }
      state.players.forEach((p, i) => {
        const k = LANE_K[Math.round(p.laneY)] ?? 1;
        const sx = i === 0 ? RX : Math.max(40, Math.min(VIEW_W - 40, sxOf(p.dist)));
        const gy = laneScreenY(p.laneY);
        items.push({
          y: gy + i * 0.01,
          x: sx,
          draw: () => {
            const def = CHARACTERS_BY_ID[p.characterId];
            const stunned = state.now < p.stunUntil;
            drawShadow(ctx, sx, gy + 2, (16 - p.z * 0.06) * k);
            if (!def) return;
            squash[i].velocityStretch((p.speed - RUSH.baseSpeed) / 200);
            ctx.save();
            ctx.translate(sx, gy - p.z * 0.9 * k);
            ctx.scale(squash[i].scaleX, squash[i].scaleY);
            const off = i !== 0 && Math.abs(sxOf(p.dist) - sx) > 1;
            if (off) ctx.globalAlpha = 0.55;
            drawRig(ctx, def.rig, def.palette, stunned ? 'hurt' : p.grounded ? 'walk' : 'attack', realNow * (0.9 + p.speed / 700), 0, 0, 1, RIG_SCALE * k, { flash: stunned && Math.floor(realNow / 60) % 2 === 0 });
            ctx.restore();
            // Marker + off-screen arrow.
            ctx.save();
            ctx.fillStyle = LANE_COLORS[i];
            const hy = gy - p.z * 0.9 * k - 96 * k;
            ctx.beginPath();
            ctx.moveTo(sx - 7, hy - 8);
            ctx.lineTo(sx + 7, hy - 8);
            ctx.lineTo(sx, hy);
            ctx.closePath();
            ctx.fill();
            if (p.mult > 1) {
              ctx.font = 'bold 15px ui-monospace, monospace';
              ctx.textAlign = 'center';
              ctx.lineWidth = 4;
              ctx.strokeStyle = '#07061a';
              ctx.strokeText(`x${p.mult}`, sx, hy - 12);
              ctx.fillText(`x${p.mult}`, sx, hy - 12);
            }
            ctx.restore();
          },
        });
      });
      items.sort((a, b) => a.y - b.y || a.x - b.x);
      for (const it of items) it.draw();

      // Speed streaks in front, stronger with the multiplier.
      if (motion) {
        ctx.save();
        ctx.strokeStyle = 'rgba(190,230,255,0.22)';
        ctx.lineWidth = 2;
        const n = 8 + me.mult * 3;
        for (let i = 0; i < n; i += 1) {
          const h = hash01(i, 3, 11);
          const y = 250 + h * 330;
          const x = (((hash01(i, 5, 9) * 1400 - dist * (1.6 + h)) % 1400) + 1400) % 1400 - 200;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 40 + me.mult * 8, y);
          ctx.stroke();
        }
        ctx.restore();
      }
      for (const s of sparks) {
        ctx.globalAlpha = Math.max(0, 1 - s.life / s.max);
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
      ctx.globalAlpha = 1;
      for (const tt of toasts) {
        const age = realNow - tt.born;
        ctx.globalAlpha = Math.max(0, 1 - age / 900);
        ctx.font = `bold ${tt.big ? 26 : 20}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#07061a';
        ctx.strokeText(tt.text, tt.x, tt.y - age * 0.06);
        ctx.fillStyle = tt.color;
        ctx.fillText(tt.text, tt.x, tt.y - age * 0.06);
      }
      ctx.globalAlpha = 1;
      ctx.restore(); // camera

      // Chain flash when the multiplier steps up.
      if (flash > 0.02) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(255,210,63,${0.16 * flash})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawRefractionRings(ctx, canvas, juice.waves, realNow, dpr);
      ctx.setTransform(dpr * fit, 0, 0, dpr * fit, dpr * offX, dpr * offY);
      drawHud(ctx, state, L, banner, realNow, portrait ? { left: -offX / fit, right: (canvas.clientWidth - offX) / fit } : { left: 0, right: VIEW_W }, bestBefore);
    };

    const countdownOverlay = () => {
      const left = COUNTDOWN_MS - realNow;
      const n = Math.ceil(left / 700);
      ctx.setTransform(dpr * fit, 0, 0, dpr * fit, dpr * offX, dpr * offY);
      const frac = (left % 700) / 700;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 120px ui-sans-serif, system-ui';
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#07061a';
      ctx.fillStyle = n <= 0 ? '#7cff6b' : '#ffd23f';
      ctx.globalAlpha = Math.min(1, 0.4 + frac);
      const label = n <= 0 ? L.go : String(n);
      const sc = 1 + (1 - frac) * 0.18;
      ctx.translate(VIEW_W / 2, 250);
      ctx.scale(sc, sc);
      ctx.strokeText(label, 0, 0);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      realNow += dt;
      if (realNow < COUNTDOWN_MS) {
        const n = Math.ceil((COUNTDOWN_MS - realNow) / 700);
        if (n < lastCount) {
          lastCount = n;
          juice.chimes.pickup(realNow, { bright: n === 0 });
        }
        readInput();
      } else {
        if (lastCount !== -1) {
          lastCount = -1;
          banner = { text: L.go, until: realNow + 700, color: '#7cff6b' };
          juice.chimes.accent('bank');
        }
        const simDt = juice.hitStop.simDt(realNow, dt);
        acc += simDt;
        let steps = 0;
        while (acc >= STEP && steps < 5 && !state.over) {
          stepRingRun(state, [readInput(), null, null, null], STEP);
          for (const e of state.events) handleEvent(e);
          acc -= STEP;
          steps += 1;
        }
      }
      cam.step(dt);
      juice.waves.prune(realNow);
      squash.forEach((s) => s.step(dt));
      flash *= 0.9;
      for (const s of sparks) {
        s.life += dt;
        s.x += (s.vx * dt) / 1000;
        s.y += (s.vy * dt) / 1000;
        s.vy += (700 * dt) / 1000;
        s.x -= (state.players[0].speed * dt) / 1000 * 0.2;
      }
      for (let i = sparks.length - 1; i >= 0; i -= 1) if (sparks[i].life >= sparks[i].max) sparks.splice(i, 1);
      for (let i = toasts.length - 1; i >= 0; i -= 1) if (realNow - toasts[i].born > 900) toasts.splice(i, 1);
      void trail;
      draw();
      if (realNow < COUNTDOWN_MS) countdownOverlay();
      const me = state.players[0];
      if (!bestShown && me.score > bestBefore && bestBefore > 0 && !state.over) {
        bestShown = true;
        newBest = true;
        banner = { text: L.best, until: realNow + 1400, color: '#ffd23f' };
        juice.chimes.accent('crack');
      }
      if (state.over && !ended) {
        ended = true;
        endAt = realNow;
        if (me.score > bestBefore) {
          newBest = true;
          writeBest(me.score);
        }
        // Victory token burst for the winner, in the same colors as the main game's tokens.
        const winner = rushResults(state)[0];
        const wp = state.players[winner.index];
        const cx = winner.index === 0 ? RX : Math.max(120, Math.min(VIEW_W - 120, sxOf(wp.dist)));
        for (let i = 0; i < 46; i += 1) burst(cx, 300, 1, [BURST_TOKENS[i % BURST_TOKENS.length].color, BURST_TOKENS[i % BURST_TOKENS.length].trim], 520);
      }
      if (ended && realNow - endAt > 2200) {
        doneRef.current(state, newBest);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      offActions();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one match per mount
  }, [seed, playerId, getAudioContext]);

  const btn = 'absolute grid place-items-center rounded-full border-4 font-black active:scale-90';
  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0">
        <button
          type="button"
          tabIndex={-1}
          aria-label={labels.up}
          onPointerDown={(e) => {
            e.stopPropagation();
            inputRef.current.laneDelta = -1;
          }}
          className={`${btn} pointer-events-auto bottom-28 left-5 h-16 w-16`}
          style={{ borderColor: '#38f2ff', background: '#38f2ff22', touchAction: 'none' }}
        >
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <path d="M5 17 L13 8 L21 17" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={labels.down}
          onPointerDown={(e) => {
            e.stopPropagation();
            inputRef.current.laneDelta = 1;
          }}
          className={`${btn} pointer-events-auto bottom-6 left-5 h-16 w-16`}
          style={{ borderColor: '#38f2ff', background: '#38f2ff22', touchAction: 'none' }}
        >
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <path d="M5 9 L13 18 L21 9" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={labels.jump}
          onPointerDown={(e) => {
            e.stopPropagation();
            inputRef.current.jumpPressed = true;
          }}
          className={`${btn} pointer-events-auto bottom-6 right-6 h-24 w-24 text-sm`}
          style={{ borderColor: '#ffd23f', background: '#ffd23f22', color: '#fff', boxShadow: '0 0 24px #ffd23f66', touchAction: 'none' }}
        >
          {labels.jump}
        </button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ helpers

function laneScreenY(laneY: number): number {
  const a = Math.max(0, Math.min(2, laneY));
  const i = Math.floor(a);
  const f = a - i;
  return LANE_Y[i] + ((LANE_Y[Math.min(2, i + 1)] ?? LANE_Y[i]) - LANE_Y[i]) * f;
}

// ------------------------------------------------------------------ drawing

function drawCity(ctx: CanvasRenderingContext2D, dist: number, now: number, pulse: number, mult: number) {
  const sky = ctx.createLinearGradient(0, -200, 0, 300);
  sky.addColorStop(0, '#0b0820');
  sky.addColorStop(0.55, '#2a1458');
  sky.addColorStop(1, '#a8366e');
  ctx.fillStyle = sky;
  ctx.fillRect(-300, -300, VIEW_W + 600, 700);
  // Sun disc and haze.
  const sun = ctx.createRadialGradient(780, 214, 8, 780, 214, 150);
  sun.addColorStop(0, 'rgba(255,214,120,0.9)');
  sun.addColorStop(0.4, 'rgba(255,120,150,0.35)');
  sun.addColorStop(1, 'rgba(255,120,150,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(600, 60, 360, 320);
  // Three parallax skylines: far, mid, near.
  const layers: [number, number, string, string, number][] = [
    [0.1, 150, '#2a1d5c', '#3b2a78', 0.18],
    [0.22, 210, '#1e1548', '#2d1f66', 0.35],
    [0.4, 262, '#140e33', '#1d1448', 0.7],
  ];
  layers.forEach(([par, base, c1, c2, lit], li) => {
    const off = dist * par;
    const first = Math.floor(off / 110) - 1;
    for (let i = first; i < first + 14; i += 1) {
      const w = 70 + hash01(i, li, 1) * 70;
      const h = 60 + hash01(i, li, 2) * (90 + li * 40);
      const x = i * 110 - off;
      const g = ctx.createLinearGradient(x, base - h, x + w, base);
      g.addColorStop(0, c2);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.fillRect(x, base - h, w, h + 40);
      // Rim light on the sun side.
      ctx.fillStyle = 'rgba(255,150,170,0.18)';
      ctx.fillRect(x + w - 3, base - h, 3, h + 40);
      for (let wy = base - h + 8; wy < base - 8; wy += 12) {
        for (let wx = x + 6; wx < x + w - 8; wx += 12) {
          const r = hash01(i * 31 + Math.floor(wx), Math.floor(wy), li + 4);
          if (r > lit) continue;
          ctx.fillStyle = r < lit * 0.35 ? '#ffd9a0' : '#8fe9ff';
          ctx.globalAlpha = 0.55 + 0.35 * hash01(i, Math.floor(wy), 8);
          ctx.fillRect(wx, wy, 5, 6);
        }
      }
      ctx.globalAlpha = 1;
      // Neon sign on some near buildings, pulsing on the beat.
      if (li === 2 && hash01(i, 9, 3) > 0.62) {
        const sc = ['#38f2ff', '#ff3fd2', '#ffd23f'][i % 3 < 0 ? 0 : Math.abs(i) % 3];
        ctx.save();
        ctx.shadowColor = sc;
        ctx.shadowBlur = 14;
        ctx.fillStyle = sc;
        ctx.globalAlpha = 0.6 + 0.35 * pulse;
        ctx.fillRect(x + 10, base - h + 18, w - 20, 7);
        ctx.fillRect(x + 10, base - h + 30, (w - 20) * 0.6, 5);
        ctx.restore();
      }
    }
  });
  void now;
  void mult;
}

function drawStreet(ctx: CanvasRenderingContext2D, dist: number, now: number, pulse: number) {
  // Sidewalk and curb along the back.
  const walk = ctx.createLinearGradient(0, 262, 0, 290);
  walk.addColorStop(0, '#3a2c5a');
  walk.addColorStop(1, '#2a2048');
  ctx.fillStyle = walk;
  ctx.fillRect(-300, 262, VIEW_W + 600, 30);
  ctx.fillStyle = '#0f0a26';
  ctx.fillRect(-300, 290, VIEW_W + 600, 6);
  // Lamp posts at world speed.
  const spacing = 320;
  const first = Math.floor((dist - RX - 60) / spacing);
  for (let i = first; i < first + 5; i += 1) {
    const x = RX + i * spacing - dist;
    ctx.fillStyle = '#120c2c';
    ctx.fillRect(x - 3, 190, 6, 100);
    ctx.fillRect(x - 3, 188, 26, 5);
    const g = ctx.createRadialGradient(x + 22, 198, 2, x + 22, 220, 120);
    g.addColorStop(0, 'rgba(255,214,150,0.55)');
    g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 100, 190, 240, 260);
    ctx.fillStyle = '#fff2c4';
    ctx.fillRect(x + 18, 193, 10, 5);
  }
  // Asphalt: wet and reflective, three lanes.
  const road = ctx.createLinearGradient(0, 296, 0, 600);
  road.addColorStop(0, '#1b1440');
  road.addColorStop(0.5, '#272058');
  road.addColorStop(1, '#171034');
  ctx.fillStyle = road;
  ctx.fillRect(-300, 296, VIEW_W + 600, 340);
  // Lane dividers scroll with distance.
  for (const y of [377, 471]) {
    ctx.strokeStyle = 'rgba(255,230,160,0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([46, 38]);
    ctx.lineDashOffset = dist % 84;
    ctx.beginPath();
    ctx.moveTo(-300, y);
    ctx.lineTo(VIEW_W + 300, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Neon edge strips that breathe on the beat.
  for (const [y, c] of [
    [298, '#38f2ff'],
    [566, '#ff3fd2'],
  ] as const) {
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = 16;
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.5 + 0.45 * pulse;
    ctx.fillRect(-300, y, VIEW_W + 600, 4);
    ctx.restore();
  }
  // Wet reflection streaks of the skyline lights.
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 12; i += 1) {
    const x = (((hash01(i, 4, 2) * 1200 - dist * 0.5) % 1200) + 1200) % 1200 - 100;
    ctx.fillStyle = i % 2 ? '#ff7ac8' : '#7ae8ff';
    ctx.fillRect(x, 310 + hash01(i, 6, 1) * 240, 4, 60 + hash01(i, 7, 1) * 40);
  }
  ctx.globalAlpha = 1;
  void now;
}

function drawRingShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, glow: string, spin: number, thick: number) {
  ctx.save();
  ctx.translate(cx, cy);
  // Soft halo.
  const h = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.9);
  h.addColorStop(0, color + '55');
  h.addColorStop(1, color + '00');
  ctx.fillStyle = h;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.9, r * 1.9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ring seen edge-on-ish: a tall ellipse whose width breathes with the spin.
  const w = r * (0.32 + 0.1 * Math.sin(spin));
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = color;
  ctx.lineWidth = thick;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = glow;
  ctx.lineWidth = Math.max(1.5, thick * 0.35);
  ctx.beginPath();
  ctx.ellipse(-w * 0.1, -r * 0.05, w * 0.9, r * 0.92, 0, Math.PI * 1.05, Math.PI * 1.75);
  ctx.stroke();
  ctx.restore();
}

function drawPiece(ctx: CanvasRenderingContext2D, pc: Piece, sx: number, ly: number, k: number, now: number, pulse: number) {
  const spin = now / 260 + pc.id;
  switch (pc.kind) {
    case 'ring':
      drawShadow(ctx, sx, ly + 2, 9 * k);
      drawRingShape(ctx, sx, ly - 46 * k, 26 * k, RING.ring, GLOW.ring, spin, 5 * k);
      break;
    case 'high': {
      drawShadow(ctx, sx, ly + 2, 8 * k);
      const cy = ly - 112 * k;
      ctx.strokeStyle = 'rgba(232,107,255,0.35)';
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, ly);
      ctx.lineTo(sx, cy + 26 * k);
      ctx.stroke();
      ctx.setLineDash([]);
      drawRingShape(ctx, sx, cy + Math.sin(spin) * 3, 26 * k, RING.high, GLOW.high, spin, 5 * k);
      break;
    }
    case 'gold': {
      drawShadow(ctx, sx, ly + 2, 12 * k);
      const cy = ly - 56 * k;
      drawRingShape(ctx, sx, cy, 38 * k, RING.gold, GLOW.gold, spin, 7 * k);
      for (let i = 0; i < 3; i += 1) {
        const a = spin * 1.4 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = '#fff6c8';
        ctx.fillRect(sx + Math.cos(a) * 20 * k - 2, cy + Math.sin(a) * 40 * k - 2, 4, 4);
      }
      break;
    }
    case 'boost': {
      // Chevron pad lying on the street.
      ctx.save();
      ctx.translate(sx, ly + 6);
      ctx.scale(1, 0.4);
      ctx.fillStyle = 'rgba(70,230,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 44 * k, 44 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = RING.ring;
      ctx.lineWidth = 6;
      ctx.shadowColor = RING.ring;
      ctx.shadowBlur = 14;
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      for (let c = -1; c <= 1; c += 1) {
        ctx.beginPath();
        ctx.moveTo(c * 22 - 10, -22);
        ctx.lineTo(c * 22 + 12, 0);
        ctx.lineTo(c * 22 - 10, 22);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'rock': {
      drawShadow(ctx, sx, ly + 3, 22 * k);
      ctx.save();
      ctx.translate(sx, ly);
      ctx.scale(k, k);
      const g = ctx.createLinearGradient(-22, -44, 22, 0);
      g.addColorStop(0, '#b6a58f');
      g.addColorStop(1, '#5d4f44');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#2a2018';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.lineTo(-26, -20);
      ctx.lineTo(-12, -40);
      ctx.lineTo(10, -42);
      ctx.lineTo(26, -22);
      ctx.lineTo(24, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(-14, -34);
      ctx.lineTo(6, -38);
      ctx.lineTo(-4, -24);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'wall': {
      drawShadow(ctx, sx, ly + 3, 26 * k);
      ctx.save();
      ctx.translate(sx, ly);
      ctx.scale(k, k);
      ctx.fillStyle = '#2b2150';
      ctx.fillRect(-26, -96, 52, 96);
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = i % 2 ? '#1a1218' : '#ffcb3c';
        ctx.beginPath();
        ctx.moveTo(-26, -96 + i * 16);
        ctx.lineTo(26, -96 + i * 16 - 10);
        ctx.lineTo(26, -96 + i * 16 + 6);
        ctx.lineTo(-26, -96 + i * 16 + 16);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = '#ff3f5a';
      ctx.lineWidth = 3;
      ctx.strokeRect(-26, -96, 52, 96);
      ctx.restore();
      break;
    }
  }
}

interface View {
  left: number;
  right: number;
}

function drawHud(ctx: CanvasRenderingContext2D, s: RushState, L: { score: string; chain: string }, banner: { text: string; until: number; color: string } | null, now: number, view: View, best: number) {
  const me = s.players[0];
  const left = view.left + 16;
  const right = view.right - 16;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // Score and chain, top-left.
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px ui-monospace, monospace';
  ctx.fillStyle = '#c9c2ff';
  ctx.fillText(L.score.toUpperCase(), left, 30);
  ctx.font = '900 44px ui-sans-serif, system-ui';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#07061a';
  ctx.strokeText(String(me.score), left, 74);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(me.score), left, 74);
  if (best > 0) {
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillStyle = me.score > best ? '#ffd23f' : '#9d97d6';
    ctx.fillText(`BEST ${best}`, left, 92);
  }
  // Multiplier chip with a fading chain bar.
  const hold = me.combo > 0 ? Math.max(0, 1 - (s.now - me.lastRingAt) / RUSH.comboHoldMs) : 0;
  const chipX = left;
  const chipY = 104;
  ctx.fillStyle = 'rgba(7,6,26,0.7)';
  ctx.strokeStyle = me.mult > 1 ? '#ffd23f' : '#4a4290';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(chipX, chipY, 150, 34, 17);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.roundRect(chipX + 4, chipY + 24, Math.max(0, 142 * hold), 6, 3);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = '900 20px ui-sans-serif, system-ui';
  ctx.fillStyle = me.mult > 1 ? '#ffd23f' : '#c9c2ff';
  ctx.fillText(`x${me.mult}`, chipX + 12, chipY + 21);
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.fillStyle = '#c9c2ff';
  ctx.fillText(`${L.chain.toUpperCase()} ${me.combo}`, chipX + 60, chipY + 20);
  // Timer, top-center.
  const mid = (view.left + view.right) / 2;
  const secs = Math.ceil(rushTimeLeftMs(s) / 1000);
  ctx.textAlign = 'center';
  ctx.font = '900 40px ui-sans-serif, system-ui';
  const urgent = secs <= 5;
  ctx.strokeStyle = '#07061a';
  ctx.lineWidth = 6;
  ctx.strokeText(String(secs), mid, 56);
  ctx.fillStyle = urgent && Math.floor(now / 200) % 2 === 0 ? '#ff3f5a' : '#ffffff';
  ctx.fillText(String(secs), mid, 56);
  // Standings, top-right.
  const order = [...s.players].sort((a, b) => b.score - a.score || a.index - b.index);
  ctx.textAlign = 'right';
  order.forEach((p, i) => {
    const y = 30 + i * 24;
    ctx.fillStyle = 'rgba(7,6,26,0.6)';
    ctx.beginPath();
    ctx.roundRect(right - 128, y - 15, 128, 21, 8);
    ctx.fill();
    ctx.fillStyle = LANE_COLORS[p.index];
    ctx.fillRect(right - 124, y - 11, 4, 13);
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.fillStyle = p.index === 0 ? '#ffffff' : '#c9c2ff';
    ctx.fillText(String(p.score), right - 8, y + 1);
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}`, right - 114, y + 1);
    ctx.textAlign = 'right';
  });
  // Track progress strip with all four runners.
  const total = Math.max(1, Math.max(...s.players.map((p) => p.dist)));
  const bx = mid - 150;
  ctx.fillStyle = 'rgba(7,6,26,0.55)';
  ctx.fillRect(bx, 70, 300, 6);
  s.players.forEach((p) => {
    ctx.fillStyle = LANE_COLORS[p.index];
    ctx.beginPath();
    ctx.arc(bx + 4 + (p.dist / total) * 292, 73, p.index === 0 ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
  // Banner.
  if (banner && banner.until > now && banner.text) {
    const age = Math.min(1, (banner.until - now) / 400);
    ctx.globalAlpha = age;
    ctx.textAlign = 'center';
    ctx.font = '900 54px ui-sans-serif, system-ui';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#07061a';
    ctx.strokeText(banner.text.toUpperCase(), mid, 190);
    ctx.fillStyle = banner.color;
    ctx.fillText(banner.text.toUpperCase(), mid, 190);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
