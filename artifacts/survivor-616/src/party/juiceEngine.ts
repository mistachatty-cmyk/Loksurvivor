/**
 * juiceEngine.ts -- the shared "feel" layer for Lok Party (Slice 1).
 *
 * Zero dependencies, no DOM at import time, and every piece that can be pure is pure so
 * `node:test` covers it. One instance per mode; board rolls, minigames and loot pulls all
 * share the same numbers so they feel like one game.
 *
 * Pieces:
 * - SpringCamera: spring-damped zoom punch (8-14 percent) plus trauma screen shake.
 * - HitStop: 45-75 ms physics freeze on heavy hits.
 * - Shockwaves: Canvas2D refraction ring (annulus clip, 1.06x redraw, 2 px cyan/magenta split, 180 ms).
 * - Squash: velocity-driven squash and stretch (land 1.25 x 0.78, launch 0.85 x 1.2) on a spring.
 * - InputBuffer / Coyote: 100 ms press buffer, 80 ms coyote window.
 * - BeatBus + PentatonicChimes: pickups climb a pentatonic ladder, quantized to the beat,
 *   played on the app's ONE shared AudioContext (never a second one: iOS suspends it).
 *
 * Rule for every caller: react on pointerdown / keydown, never on pointerup.
 * Reduced motion: pass `motion` 0..1; shake, zoom and refraction scale by it, hit-stop and
 * squash stay (they read as timing, not motion).
 */

// ---------------------------------------------------------------------------
// Tunables (one place, so every mode feels the same)
// ---------------------------------------------------------------------------

export const JUICE = {
  zoomPunchMin: 0.08,
  zoomPunchMax: 0.14,
  springStiffness: 420,
  springDamping: 26,
  shakeMaxPx: 14,
  shakeMaxRad: 0.035,
  traumaDecayPerSec: 1.6,
  hitStopMinMs: 45,
  hitStopMaxMs: 75,
  ringMs: 180,
  ringScale: 1.06,
  ringSplitPx: 2,
  ringWidthPx: 26,
  ringMaxRadius: 150,
  inputBufferMs: 100,
  coyoteMs: 80,
  squashLand: { x: 1.25, y: 0.78 },
  squashLaunch: { x: 0.85, y: 1.2 },
  squashStiffness: 520,
  squashDamping: 18,
  chimeIdleResetMs: 650,
} as const;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------------------
// Damped spring (semi-implicit Euler, stable at 60 Hz and at 120 Hz)
// ---------------------------------------------------------------------------

export interface Spring1 {
  value: number;
  velocity: number;
  target: number;
}

export function stepSpring(s: Spring1, dtSec: number, stiffness: number, damping: number): Spring1 {
  // Sub-step so a long frame (tab switch) cannot explode the spring.
  let { value, velocity } = s;
  const steps = Math.max(1, Math.ceil(dtSec / (1 / 120)));
  const h = dtSec / steps;
  for (let i = 0; i < steps; i += 1) {
    const accel = -stiffness * (value - s.target) - damping * velocity;
    velocity += accel * h;
    value += velocity * h;
  }
  return { value, velocity, target: s.target };
}

// ---------------------------------------------------------------------------
// Camera: zoom punch + trauma shake
// ---------------------------------------------------------------------------

/** Cheap deterministic 1D noise in -1..1 (smooth, so shake rolls instead of jittering). */
export function noise1(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const h = (n: number) => {
    const x = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

/** Velocity per unit of peak displacement for an underdamped spring kicked from rest. */
function punchKick(k: number, c: number): number {
  const w = Math.sqrt(k);
  const zeta = c / (2 * w);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const tp = Math.atan(wd / (zeta * w)) / wd;
  return 1 / (Math.exp(-zeta * w * tp) * Math.sin(wd * tp) / wd);
}
const PUNCH_KICK = punchKick(JUICE.springStiffness, JUICE.springDamping);

export class SpringCamera {
  x = 0;
  y = 0;
  /** Base zoom the camera rests at. */
  baseZoom = 1;
  private zoom: Spring1 = { value: 1, velocity: 0, target: 1 };
  trauma = 0;
  private t = 0;
  motion = 1;

  /** Snap zoom in by `amount` (clamped 8-14 percent); the spring brings it back. */
  punch(amount: number = JUICE.zoomPunchMin): void {
    const a = clamp(amount, JUICE.zoomPunchMin, JUICE.zoomPunchMax) * this.motion;
    // Kick velocity so the overshoot peaks at exactly `a` (in about four frames), then rebounds.
    this.zoom.velocity += a * PUNCH_KICK;
  }

  /** Trauma 0..1; shake is trauma squared so small hits stay small. */
  addTrauma(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  step(dtMs: number): void {
    const dt = dtMs / 1000;
    this.t += dt;
    this.zoom.target = this.baseZoom;
    this.zoom = stepSpring(this.zoom, dt, JUICE.springStiffness, JUICE.springDamping);
    this.trauma = Math.max(0, this.trauma - JUICE.traumaDecayPerSec * dt);
  }

  get zoomValue(): number {
    return this.zoom.value;
  }

  /** Shake offset this frame: { dx, dy, rot }. */
  shake(): { dx: number; dy: number; rot: number } {
    const k = this.trauma * this.trauma * this.motion;
    const f = this.t * 28;
    return {
      dx: JUICE.shakeMaxPx * k * noise1(f, 1),
      dy: JUICE.shakeMaxPx * k * noise1(f, 2),
      rot: JUICE.shakeMaxRad * k * noise1(f, 3),
    };
  }

  /** Apply to a context already sized to the viewport; call ctx.restore() after drawing. */
  apply(ctx: CanvasRenderingContext2D, viewW: number, viewH: number): void {
    const { dx, dy, rot } = this.shake();
    const z = this.zoomValue;
    ctx.save();
    ctx.translate(viewW / 2 + dx, viewH / 2 + dy);
    ctx.rotate(rot);
    ctx.scale(z, z);
    ctx.translate(-this.x, -this.y);
  }
}

// ---------------------------------------------------------------------------
// Hit-stop
// ---------------------------------------------------------------------------

export function hitStopMs(weight: number): number {
  // weight 0..1 maps onto 45..75 ms
  const w = clamp(weight, 0, 1);
  return Math.round(JUICE.hitStopMinMs + (JUICE.hitStopMaxMs - JUICE.hitStopMinMs) * w);
}

export class HitStop {
  private until = 0;
  /** Freeze physics; a lighter hit never shortens a heavier one already running. */
  hit(nowMs: number, weight: number): void {
    this.until = Math.max(this.until, nowMs + hitStopMs(weight));
  }
  frozen(nowMs: number): boolean {
    return nowMs < this.until;
  }
  /** Physics dt this frame: 0 while frozen. Particles and shake keep the real dt. */
  simDt(nowMs: number, dtMs: number): number {
    return this.frozen(nowMs) ? 0 : dtMs;
  }
}

// ---------------------------------------------------------------------------
// Shockwave refraction ring (Canvas2D lens warp)
// ---------------------------------------------------------------------------

export interface Shockwave {
  x: number;
  y: number;
  bornMs: number;
  strength: number;
}

export class Shockwaves {
  list: Shockwave[] = [];
  motion = 1;
  spawn(x: number, y: number, nowMs: number, strength = 1): void {
    if (this.motion <= 0) return;
    this.list.push({ x, y, bornMs: nowMs, strength: clamp(strength, 0.3, 1.5) });
    if (this.list.length > 6) this.list.shift();
  }
  prune(nowMs: number): void {
    this.list = this.list.filter((w) => nowMs - w.bornMs < JUICE.ringMs);
  }
}

/** 0..1 progress, eased out so the ring rushes outward then slows. */
export function ringProgress(w: Shockwave, nowMs: number): number {
  const p = clamp((nowMs - w.bornMs) / JUICE.ringMs, 0, 1);
  return 1 - (1 - p) * (1 - p);
}

/**
 * Draws every live ring by re-sampling `source` (the frame already rendered) inside an
 * annulus, scaled 1.06x about the impact, with a 2 px cyan and magenta split.
 * `source` is in screen pixels; ring coordinates are screen pixels too.
 */
export function drawRefractionRings(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource & { width: number; height: number },
  waves: Shockwaves,
  nowMs: number,
  pixelRatio = 1,
): void {
  const motion = waves.motion;
  for (const w of waves.list) {
    const p = ringProgress(w, nowMs);
    if (p >= 1) continue;
    const r = (12 + JUICE.ringMaxRadius * w.strength * p) * pixelRatio;
    const band = JUICE.ringWidthPx * (1 - p * 0.6) * pixelRatio;
    const inner = Math.max(0, r - band);
    const fade = (1 - p) * motion;
    const cx = w.x * pixelRatio;
    const cy = w.y * pixelRatio;
    const s = 1 + (JUICE.ringScale - 1) * (1 - p);
    const split = JUICE.ringSplitPx * pixelRatio * (1 - p);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
    ctx.clip();
    // Magnified copy of the frame inside the band: the "lens".
    ctx.setTransform(s, 0, 0, s, cx * (1 - s), cy * (1 - s));
    ctx.globalAlpha = 0.9 * fade;
    ctx.drawImage(source, 0, 0);
    // Chromatic fringe: tinted offsets added on top.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * fade;
    ctx.filter = 'none';
    ctx.drawImage(source, split, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(0, 240, 255, ${0.3 * fade})`;
    ctx.fillRect(cx - r - split, cy - r, r * 2, r * 2);
    ctx.fillStyle = `rgba(255, 40, 200, ${0.26 * fade})`;
    ctx.fillRect(cx - r + split, cy - r, r * 2, r * 2);
    ctx.restore();

    // Crisp rim lines so the ring reads even on a flat background.
    ctx.save();
    ctx.lineWidth = 3 * pixelRatio;
    ctx.globalAlpha = Math.min(1, 1.1 * fade);
    ctx.shadowBlur = 10 * pixelRatio;
    ctx.shadowColor = '#ffffff';
    ctx.strokeStyle = '#38f2ff';
    ctx.beginPath();
    ctx.arc(cx - split, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ff3fd2';
    ctx.beginPath();
    ctx.arc(cx + split, cy, r - 2 * pixelRatio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Squash and stretch
// ---------------------------------------------------------------------------

export class Squash {
  private sx: Spring1 = { value: 1, velocity: 0, target: 1 };
  private sy: Spring1 = { value: 1, velocity: 0, target: 1 };
  land(intensity = 1): void {
    const k = clamp(intensity, 0, 1.4);
    this.sx.value = 1 + (JUICE.squashLand.x - 1) * k;
    this.sy.value = 1 + (JUICE.squashLand.y - 1) * k;
  }
  launch(intensity = 1): void {
    const k = clamp(intensity, 0, 1.4);
    this.sx.value = 1 + (JUICE.squashLaunch.x - 1) * k;
    this.sy.value = 1 + (JUICE.squashLaunch.y - 1) * k;
  }
  /** Gentle continuous stretch along speed (0..1), for runners and rolling capsules. */
  velocityStretch(speed01: number): void {
    const s = clamp(speed01, 0, 1) * 0.08;
    this.sx.target = 1 - s;
    this.sy.target = 1 + s;
  }
  step(dtMs: number): void {
    const dt = dtMs / 1000;
    this.sx = stepSpring(this.sx, dt, JUICE.squashStiffness, JUICE.squashDamping);
    this.sy = stepSpring(this.sy, dt, JUICE.squashStiffness, JUICE.squashDamping);
  }
  get scaleX(): number {
    return this.sx.value;
  }
  get scaleY(): number {
    return this.sy.value;
  }
}

// ---------------------------------------------------------------------------
// Input feel: buffer + coyote
// ---------------------------------------------------------------------------

export class InputBuffer<A extends string = string> {
  private pressed = new Map<A, number>();
  constructor(private windowMs: number = JUICE.inputBufferMs) {}
  press(action: A, nowMs: number): void {
    this.pressed.set(action, nowMs);
  }
  /** True (and clears) when `action` was pressed within the buffer window. */
  consume(action: A, nowMs: number): boolean {
    const at = this.pressed.get(action);
    if (at === undefined) return false;
    if (nowMs - at > this.windowMs) {
      this.pressed.delete(action);
      return false;
    }
    this.pressed.delete(action);
    return true;
  }
  peek(action: A, nowMs: number): boolean {
    const at = this.pressed.get(action);
    return at !== undefined && nowMs - at <= this.windowMs;
  }
}

export class Coyote {
  private lastOk = -Infinity;
  constructor(private windowMs: number = JUICE.coyoteMs) {}
  /** Call every frame the action is legal (grounded, off cooldown, inside a zone). */
  mark(nowMs: number): void {
    this.lastOk = nowMs;
  }
  ok(nowMs: number): boolean {
    return nowMs - this.lastOk <= this.windowMs;
  }
  spend(): void {
    this.lastOk = -Infinity;
  }
}

// ---------------------------------------------------------------------------
// Beat bus + pentatonic chimes
// ---------------------------------------------------------------------------

/** Major pentatonic scale degrees in semitones. */
export const PENTATONIC = [0, 2, 4, 7, 9] as const;

/** Frequency of ladder step `n` above `rootHz` (wraps up an octave every five steps). */
export function pentatonicHz(step: number, rootHz = 523.25): number {
  const s = Math.max(0, Math.floor(step));
  const octave = Math.floor(s / PENTATONIC.length);
  const semis = PENTATONIC[s % PENTATONIC.length] + 12 * octave;
  return rootHz * Math.pow(2, semis / 12);
}

export class BeatBus {
  bpm: number;
  /** Seconds (on the AudioContext clock) where beat 0 fell. */
  originSec: number;
  private listeners = new Set<(beat: number) => void>();
  private lastBeat = -1;
  constructor(bpm = 118, originSec = 0) {
    this.bpm = bpm;
    this.originSec = originSec;
  }
  get beatSec(): number {
    return 60 / this.bpm;
  }
  beatAt(timeSec: number): number {
    return (timeSec - this.originSec) / this.beatSec;
  }
  /** Next grid time at or after `timeSec`; `division` 4 = sixteenth notes. */
  quantize(timeSec: number, division = 4): number {
    const step = this.beatSec / division;
    const n = Math.ceil((timeSec - this.originSec - 1e-6) / step);
    return this.originSec + n * step;
  }
  /** 0..1 pulse that peaks on each beat; drives neon, banners and HUD borders. */
  pulse(timeSec: number): number {
    const f = this.beatAt(timeSec);
    const frac = f - Math.floor(f);
    return Math.pow(1 - frac, 3);
  }
  on(fn: (beat: number) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  /** Call once a frame; fires listeners on each whole beat crossed. */
  tick(timeSec: number): void {
    const b = Math.floor(this.beatAt(timeSec));
    if (b !== this.lastBeat) {
      this.lastBeat = b;
      this.listeners.forEach((fn) => fn(b));
    }
  }
}

/** Pure ladder state: pickups in a quick run climb; a pause resets to the root. */
export interface ChimeLadder {
  step: number;
  lastMs: number;
}

export function nextChime(ladder: ChimeLadder, nowMs: number, maxStep = 14): ChimeLadder {
  const step = nowMs - ladder.lastMs > JUICE.chimeIdleResetMs ? 0 : Math.min(maxStep, ladder.step + 1);
  return { step, lastMs: nowMs };
}

/**
 * Plays chimes on the shared context. Construct with a getter so this never creates its own
 * AudioContext; when the getter returns null (no gesture yet) chimes are silently skipped.
 */
export class PentatonicChimes {
  private ladder: ChimeLadder = { step: 0, lastMs: -Infinity };
  private voices = 0;
  volume = 0.16;
  constructor(private getContext: () => AudioContext | null, private bus: BeatBus) {}

  /** A pickup chime that climbs the ladder; returns the step played (or -1 if silent). */
  pickup(nowMs: number, opts: { pan?: number; bright?: boolean } = {}): number {
    this.ladder = nextChime(this.ladder, nowMs);
    this.play(pentatonicHz(this.ladder.step), opts.bright ? 0.22 : 0.14, opts.pan ?? 0, true);
    return this.ladder.step;
  }

  /** One-off accent (crack, bank, slam): a short interval on the root. */
  accent(kind: 'crack' | 'bank' | 'slam' | 'hit', pan = 0): void {
    const table = { crack: [12, 19], bank: [0, 7, 12], slam: [-12, -5], hit: [-5] } as const;
    for (const semis of table[kind]) this.play(523.25 * Math.pow(2, semis / 12), kind === 'slam' ? 0.5 : 0.18, pan, kind !== 'slam');
  }

  private play(hz: number, lengthSec: number, pan: number, quantize: boolean): void {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running' || this.voices >= 10) return;
    const start = quantize ? this.bus.quantize(ctx.currentTime + 0.005, 4) : ctx.currentTime;
    // Never wait more than a sixteenth at 90 bpm; a late chime feels laggy.
    const at = start - ctx.currentTime > 0.17 ? ctx.currentTime : start;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc2.type = 'sine';
    osc.frequency.setValueAtTime(hz, at);
    osc2.frequency.setValueAtTime(hz * 2, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(this.volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + lengthSec);
    let out: AudioNode = gain;
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      gain.connect(panner);
      out = panner;
    }
    out.connect(ctx.destination);
    osc.connect(gain);
    osc2.connect(gain);
    this.voices += 1;
    osc.onended = () => {
      this.voices -= 1;
      try {
        gain.disconnect();
        out.disconnect();
      } catch {
        /* already gone */
      }
    };
    osc.start(at);
    osc2.start(at);
    osc.stop(at + lengthSec + 0.02);
    osc2.stop(at + lengthSec + 0.02);
  }
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

export interface Juice {
  camera: SpringCamera;
  hitStop: HitStop;
  waves: Shockwaves;
  bus: BeatBus;
  chimes: PentatonicChimes;
}

/** One-call setup. `motion` 0 for reduced motion, 1 for full. */
export function createJuice(getContext: () => AudioContext | null, opts: { motion?: number; bpm?: number } = {}): Juice {
  const camera = new SpringCamera();
  const waves = new Shockwaves();
  const motion = clamp(opts.motion ?? 1, 0, 1);
  camera.motion = motion;
  waves.motion = motion;
  const bus = new BeatBus(opts.bpm ?? 118, getContext()?.currentTime ?? 0);
  return { camera, hitStop: new HitStop(), waves, bus, chimes: new PentatonicChimes(getContext, bus) };
}

/** A heavy impact in one call: hit-stop, punch, trauma, ring. */
export function impact(j: Juice, nowMs: number, screenX: number, screenY: number, weight: number): void {
  const w = clamp(weight, 0, 1);
  j.hitStop.hit(nowMs, w);
  j.camera.punch(JUICE.zoomPunchMin + (JUICE.zoomPunchMax - JUICE.zoomPunchMin) * w);
  j.camera.addTrauma(0.25 + 0.45 * w);
  j.waves.spawn(screenX, screenY, nowMs, 0.6 + 0.6 * w);
}
