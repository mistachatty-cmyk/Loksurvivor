/**
 * MinigameStage -- runs any Lok Party minigame cartridge (see minigameKit.ts). It owns the canvas,
 * touch and keys, the fixed-step loop with hit-stop, the camera, particles, popup text, the HUD, and
 * the shared entrance and podium (stageArt.ts). A cartridge only brings rules and art.
 */

import { useEffect, useRef } from 'react';
import { useT } from '@/lib/i18n';
import { createJuice, drawRefractionRings, impact } from './juiceEngine';
import { ENTRANCE, PODIUM_MS, SEAT_COLORS, type MinigameCartridge, type MinigameResult, type MinigameSeat, type RenderInfo, type StageFx, type StageInput, type StageView } from './minigameKit';
import { STAGE_W, countdownAt, drawEntrance, drawPodium, outlined } from './stageArt';

const STEP = 1000 / 60;
const TAP_MS = 200;
const TAP_SLOP = 26;

interface Props<S> {
  cartridge: MinigameCartridge<S>;
  seed: number;
  seats: MinigameSeat[];
  onDone: (results: MinigameResult[]) => void;
  getAudioContext: () => AudioContext | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  color: string;
  size: number;
  gravity: number;
  smoke: boolean;
}

interface Toast {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  born: number;
}

export function MinigameStage<S>({ cartridge, seed, seats, onDone, getAudioContext }: Props<S>) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const labels = {
    ...cartridge.labels(t),
    go: t('lokParty.stage.go'),
    you: t('lokParty.drop.you'),
    skip: t('lokParty.stage.skip'),
    finish: t('lokParty.rush.over'),
    dash: t('lokParty.stage.dash'),
  };
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  // The match is fixed at mount; a parent re-render must not restart it.
  const fixed = useRef({ cartridge, seats });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { cartridge: game, seats: roster } = fixed.current;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const juice = createJuice(getAudioContext, { motion: calm ? 0 : 1, bpm: game.bpm ?? 128 });
    const state = game.create(seed, roster);
    const me = Math.max(0, roster.findIndex((s) => !s.bot));
    const view: StageView = { w: STAGE_W, h: 900 };
    const particles: Particle[] = [];
    const toasts: Toast[] = [];
    const keys = new Set<string>();
    let flash: { color: string; until: number; ms: number } | null = null;
    let dpr = 1;
    let fit = 1;
    let offX = 0;
    let raf = 0;
    let last = performance.now();
    let clock = 0;
    let intro = 0;
    let acc = 0;
    let lastBeat: number | null = null;
    let overAt = 0;
    let finished = false;
    let results: MinigameResult[] | null = null;
    // Pointer state, in stage units. Mouse: the character follows the cursor and a click dashes at
    // once (on press, not release). Touch: one finger steers, a quick tap dashes, and a second thumb
    // can hit the DASH button, which also fires on press.
    const touches = new Map<number, { x: number; y: number; downAt: number; sx: number; sy: number; button: boolean }>();
    let mover: number | null = null;
    let hover: { x: number; y: number } | null = null;
    let tap: { x: number; y: number } | null = null;
    let action = false;
    let seenTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    let buttonPressedAt = -1e9;
    const button = () => ({ x: STAGE_W - 92, y: view.h - 130, r: 70 });
    const showButton = () => seenTouch && !!game.dashReady;

    const info = (): RenderInfo => ({ view, clock, me, calm });

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      // Fill a portrait phone edge to edge; on a wide screen keep a centred column.
      fit = Math.min(canvas.width / STAGE_W, canvas.height / 860);
      offX = (canvas.width - STAGE_W * fit) / 2;
      view.h = canvas.height / fit;
    };
    resize();

    const toStage = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      return { x: (((e.clientX - box.left) / box.width) * canvas.width - offX) / fit, y: (((e.clientY - box.top) / box.height) * canvas.height) / fit };
    };
    const skipIntro = () => {
      if (intro < ENTRANCE.countdownAt) intro = ENTRANCE.countdownAt;
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      skipIntro();
      const pt = toStage(e);
      if (e.pointerType === 'mouse') {
        hover = pt;
        if (e.button === 0) tap = pt;
        return;
      }
      seenTouch = true;
      const b = button();
      if (showButton() && Math.hypot(pt.x - b.x, pt.y - b.y) < b.r + 14) {
        action = true;
        buttonPressedAt = clock;
        touches.set(e.pointerId, { ...pt, downAt: clock, sx: pt.x, sy: pt.y, button: true });
        return;
      }
      touches.set(e.pointerId, { ...pt, downAt: clock, sx: pt.x, sy: pt.y, button: false });
      if (mover === null) mover = e.pointerId;
    };
    const move = (e: PointerEvent) => {
      const pt = toStage(e);
      if (e.pointerType === 'mouse') {
        hover = pt;
        return;
      }
      const t0 = touches.get(e.pointerId);
      if (t0 && !t0.button) Object.assign(t0, pt);
    };
    const up = (e: PointerEvent) => {
      const t0 = touches.get(e.pointerId);
      if (!t0) return;
      touches.delete(e.pointerId);
      if (!t0.button && clock - t0.downAt < TAP_MS && Math.hypot(t0.x - t0.sx, t0.y - t0.sy) < TAP_SLOP) tap = { x: t0.x, y: t0.y };
      if (mover === e.pointerId) mover = [...touches.entries()].find(([, v]) => !v.button)?.[0] ?? null;
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hover = null;
      else up(e);
    };
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const moves = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'];
      if (k === ' ' || k === 'enter') {
        e.preventDefault();
        if (e.type === 'keydown' && !e.repeat) {
          skipIntro();
          action = true;
        }
        return;
      }
      if (!moves.includes(k)) return;
      e.preventDefault();
      if (e.type === 'keydown') keys.add(k);
      else keys.delete(k);
    };
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', leave);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);

    const fx: StageFx = {
      impact: (x, y, weight) => impact(juice, clock, (offX + x * fit) / dpr, (y * fit) / dpr, weight),
      burst: (x, y, color, count, opts = {}) => {
        if (calm) return;
        const speed = opts.speed ?? 0.35;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + i * 0.7;
          const v = speed * (0.45 + ((i * 37) % 11) / 11);
          particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.smoke ? 0.02 : 0.1), born: clock, life: opts.smoke ? 900 : 560, color, size: opts.size ?? 8, gravity: opts.gravity ?? (opts.smoke ? -0.00008 : 0.0009), smoke: !!opts.smoke });
        }
        if (particles.length > 500) particles.splice(0, particles.length - 500);
      },
      toast: (x, y, text, color, size = 34) => {
        // Keep popup words on screen.
        const margin = Math.min(STAGE_W / 2, size * 2.2);
        const tx = Math.max(margin, Math.min(STAGE_W - margin, x));
        let ty = Math.max(size + 100, y);
        // Stack instead of overlapping a recent popup.
        for (let tries = 0; tries < 4; tries++) {
          const hit = toasts.find((o) => clock - o.born < 500 && Math.abs(o.x - tx) < 220 && Math.abs(o.y - ty) < (o.size + size) * 0.6);
          if (!hit) break;
          ty = hit.y - (hit.size + size) * 0.62;
        }
        toasts.push({ x: tx, y: Math.max(size + 100, ty), text, color, size, born: clock });
        if (toasts.length > 10) toasts.shift();
      },
      flash: (color, ms) => {
        if (!calm) flash = { color, until: clock + ms, ms };
      },
      sound: (kind) => juice.chimes.accent(kind),
      chime: (bright) => {
        juice.chimes.pickup(clock, { bright });
      },
    };

    const inputForMe = (): StageInput => {
      const kx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
      const ky = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
      const finger = mover !== null ? touches.get(mover) : undefined;
      const held = finger && clock - finger.downAt >= 60 ? finger : hover;
      const holding = !!held;
      const input: StageInput = {
        keys: { x: kx, y: ky },
        aim: held ? game.toWorld(view, held.x, held.y) : null,
        holding,
        tap: tap ? game.toWorld(view, tap.x, tap.y) : null,
        action,
      };
      tap = null;
      action = false;
      return input;
    };

    const drawHud = () => {
      const scores = game.scores(state);
      const left = Math.max(0, Math.ceil(game.timeLeftMs(state) / 1000));
      outlined(ctx, String(left), STAGE_W / 2, 62, 50, left <= 5 ? '#ff3fd2' : '#ffffff');
      outlined(ctx, String(scores[me] ?? 0), 90, 58, 44, '#ffd23f');
      outlined(ctx, labelsRef.current.you, 90, 92, 20, '#ffffff');
      scores.forEach((score, i) => {
        if (i === me) return;
        const row = i < me ? i : i - 1;
        outlined(ctx, String(score), STAGE_W - 60, 44 + row * 34, 26, SEAT_COLORS[i % 4]);
      });
    };

    const draw = () => {
      const L = labelsRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#07061a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const jolt = juice.camera.shake();
      ctx.setTransform(fit, 0, 0, fit, offX + jolt.dx * fit, jolt.dy * fit);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, STAGE_W, view.h);
      ctx.clip();
      ctx.save();
      const zoom = juice.camera.zoomValue;
      ctx.translate(STAGE_W / 2, view.h / 2);
      ctx.scale(zoom, zoom);
      ctx.rotate(jolt.rot);
      ctx.translate(-STAGE_W / 2, -view.h / 2);
      game.render(ctx, state, info());
      for (const p of particles) {
        const age = clock - p.born;
        const k = 1 - age / p.life;
        if (k <= 0) continue;
        ctx.globalAlpha = p.smoke ? k * 0.45 : Math.min(1, k * 1.6);
        ctx.fillStyle = p.color;
        const size = p.smoke ? p.size * (1 + age / 300) : p.size * (0.5 + k * 0.5);
        const x = p.x + p.vx * age;
        const y = p.y + p.vy * age + p.gravity * age * age;
        if (p.smoke) {
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      for (const toast of toasts) {
        const age = clock - toast.born;
        const pop = calm ? 1 : 1 + Math.max(0, 1 - age / 160) * 0.8;
        ctx.save();
        ctx.translate(toast.x, toast.y - age * 0.07);
        ctx.scale(pop, pop);
        ctx.globalAlpha = Math.min(1, Math.max(0, (900 - age) / 250));
        outlined(ctx, toast.text, 0, 0, toast.size, toast.color);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (flash && clock < flash.until) {
        ctx.globalAlpha = Math.max(0, (flash.until - clock) / flash.ms) * 0.55;
        ctx.fillStyle = flash.color;
        ctx.fillRect(0, 0, STAGE_W, view.h);
        ctx.globalAlpha = 1;
      }
      if (intro >= ENTRANCE.playAt && !results) {
        drawHud();
        game.hud?.(ctx, state, info());
        if (showButton()) {
          const b = button();
          const ready = Math.max(0, Math.min(1, game.dashReady!(state, me)));
          const pressed = clock - buttonPressedAt < 120;
          ctx.save();
          ctx.translate(b.x, b.y);
          if (pressed) ctx.scale(0.9, 0.9);
          ctx.globalAlpha = ready >= 1 ? 0.92 : 0.55;
          ctx.fillStyle = ready >= 1 ? '#ffd23f' : '#3b2a20';
          ctx.strokeStyle = '#07061a';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(0, 0, b.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(0, 0, b.r - 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ready);
          ctx.stroke();
          ctx.globalAlpha = 1;
          outlined(ctx, L.dash, 0, 10, 28, ready >= 1 ? '#3b2a20' : '#ffffff', b.r * 1.7);
          ctx.restore();
        }
      }
      if (intro < ENTRANCE.playAt + ENTRANCE.goMs) {
        drawEntrance(ctx, {
          h: view.h,
          t: intro,
          calm,
          accent: game.accent,
          seats: roster.map((s, i) => ({ characterId: s.characterId, you: i === me })),
          labels: { title: L.title, prompt: L.prompt, hint: L.hint, go: L.go, you: L.you, skip: L.skip },
        });
      }
      if (results) drawPodium(ctx, { h: view.h, clock, since: clock - overAt, calm, me, title: L.finish, you: L.you, results });
      ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawRefractionRings(ctx, canvas, juice.waves, clock, dpr);
    };

    const frame = (ts: number) => {
      const dt = Math.min(100, Math.max(0, ts - last));
      last = ts;
      clock += dt;
      intro += dt;
      // Countdown beats: a tick on 3, 2, 1 and a big hit on GO.
      const beat = countdownAt(intro);
      if (beat !== lastBeat && beat !== null) {
        if (beat === 0) {
          juice.chimes.accent('slam');
          juice.camera.punch();
          juice.camera.addTrauma(0.4);
        } else juice.chimes.pickup(clock, { bright: false });
      }
      lastBeat = beat;
      if (intro >= ENTRANCE.playAt && !game.isOver(state)) {
        acc += juice.hitStop.simDt(clock, dt);
        while (acc >= STEP && !game.isOver(state)) {
          acc -= STEP;
          game.step(state, roster.map((_, i) => (i === me ? inputForMe() : null)), STEP);
          game.react(state, fx, info());
        }
      }
      juice.camera.step(dt);
      juice.waves.prune(clock);
      while (particles.length && clock - particles[0].born > particles[0].life) particles.shift();
      while (toasts.length && clock - toasts[0].born > 900) toasts.shift();
      if (game.isOver(state) && !results) {
        results = game.results(state);
        overAt = clock;
        juice.chimes.accent('bank');
      }
      draw();
      if (results && !finished && clock - overAt >= PODIUM_MS) {
        finished = true;
        doneRef.current(results);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('pointerleave', leave);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
    };
  }, [seed, getAudioContext]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ touchAction: 'none' }} aria-label={labels.title} />;
}
