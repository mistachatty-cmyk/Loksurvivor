/**
 * Million Horde crowd layer: millions of *real* individual enemies stored as
 * flat typed arrays (structure-of-arrays), not a counter.
 *
 * Every member has its own position and enemy kind. A member is 10 bytes
 * (two float32 + one uint16), so ten million fit in ~100 MB of typed memory
 * with no per-member object, no GC pressure and nothing to allocate while
 * playing.
 *
 * Cost does not scale with population. Each step visits a fixed budget of
 * members (a rotating, block-sliced sweep), so one million and ten million
 * cost the same per frame; a block that is visited less often simply moves in
 * proportionally larger strides. Members walk toward the player, stop in a
 * crowd shell just outside the camera, and are promoted into fully simulated
 * `EnemyActor`s as live-actor slots free up -- so every weapon, status and
 * kill still goes through the one `damageEnemy` choke point and nothing in the
 * combat code knows this layer exists.
 *
 * Pure and deterministic: driven only by the arguments it is given (sim clock,
 * player position), never wall-clock time or `Math.random`.
 */
import type { EnemyDef } from '@/game/types';

/** Members per time-stamp block; the sweep always processes whole blocks. */
export const HORDE_BLOCK = 1024;
/** Crowd members the renderer can sample per frame. */
export const HORDE_VISIBLE_CAPACITY = 6144;
/** Promotion candidates remembered between sweeps. */
const CANDIDATE_CAPACITY = 96;
/** Dots per square world unit in the waiting shell; bounds its thickness. */
const SHELL_DENSITY = 5;
/**
 * A member within this distance of its shell radius counts as "arrived" and
 * is left alone, so a walking player does not make every member re-step on
 * every visit (the camera margin in `setHordeView` is wider than this).
 */
const ARRIVE_SLACK = 40;
const MAX_STRIDE_SEC = 6;

export interface HordeKind {
  def: EnemyDef;
  hpMult: number;
  /** World units per second, with run-wide speed modifiers already applied. */
  speed: number;
}

export interface HordeSweep {
  px: number;
  py: number;
  /**
   * Radius of the waiting shell's inner edge, measured in a metric where world
   * y is stretched by `ky`: the shell is an ellipse hugging the camera box,
   * not a circle that would leave wide screens' side edges empty.
   */
  hold: number;
  ky: number;
  /** Half extents of the box whose members the renderer may draw. */
  drawHalfW: number;
  drawHalfH: number;
}

export class HordeField {
  readonly capacity: number;
  /** Members currently alive in the field. */
  count = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly kind: Uint16Array;
  readonly kinds: HordeKind[] = [];
  /** `kinds[k].speed`, flat, so the sweep never dereferences an object per member. */
  private readonly speedByKind = new Float32Array(0x10000);
  /** Indices recently seen inside the draw box (ring buffer; validated when drawn). */
  readonly visible = new Int32Array(HORDE_VISIBLE_CAPACITY);
  visibleCount = 0;
  /** Members that reached the shell this sweep, newest last. */
  readonly candidates = new Int32Array(CANDIDATE_CAPACITY);
  candidateCount = 0;

  private readonly stamp: Float64Array;
  private readonly kindIndex = new Map<string, number>();
  private visibleHead = 0;
  private cursorBlock = 0;

  constructor(capacity: number) {
    this.capacity = Math.max(HORDE_BLOCK, Math.floor(capacity));
    this.x = new Float32Array(this.capacity);
    this.y = new Float32Array(this.capacity);
    this.kind = new Uint16Array(this.capacity);
    this.stamp = new Float64Array(Math.ceil(this.capacity / HORDE_BLOCK));
  }

  /** Thickness of the waiting shell for the current population. */
  shellDepth(hold: number): number {
    return Math.max(0, Math.sqrt(hold * hold + this.count / (Math.PI * SHELL_DENSITY)) - hold);
  }

  registerKind(def: EnemyDef, hpMult: number, speed: number): number {
    // Quantised so a slowly rising difficulty curve cannot mint a new kind
    // every frame (kinds are a uint16 index).
    const q = Math.round(hpMult * 20) / 20;
    const key = `${def.id}|${q}|${Math.round(speed)}`;
    const found = this.kindIndex.get(key);
    if (found !== undefined) return found;
    if (this.kinds.length >= 0xffff) return this.kinds.length - 1;
    const index = this.kinds.length;
    this.kinds.push({ def, hpMult: q, speed });
    this.speedByKind[index] = speed;
    this.kindIndex.set(key, index);
    return index;
  }

  /**
   * Add up to `n` members of `kind` scattered over a rectangle around
   * (cx, cy). `seed` makes the scatter deterministic; returns how many fit.
   */
  addBatch(kind: number, n: number, cx: number, cy: number, spreadX: number, spreadY: number, seed: number, now: number): number {
    const room = this.capacity - this.count;
    const amount = Math.min(n, room);
    if (amount <= 0) return 0;
    let s = (seed | 0) || 0x9e3779b9;
    const x = this.x;
    const y = this.y;
    const k = this.kind;
    let at = this.count;
    // Blocks wholly created by this batch start their clocks now, so a new
    // member never "catches up" a stride it did not live through.
    for (let b = Math.floor((at + HORDE_BLOCK - 1) / HORDE_BLOCK); b <= Math.floor((at + amount - 1) / HORDE_BLOCK); b += 1) {
      if (b * HORDE_BLOCK >= at) this.stamp[b] = now;
    }
    for (let i = 0; i < amount; i += 1) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      const u = (s >>> 0) / 4294967296;
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      const v = (s >>> 0) / 4294967296;
      x[at] = cx + (u - 0.5) * spreadX;
      y[at] = cy + (v - 0.5) * spreadY;
      k[at] = kind;
      at += 1;
    }
    this.count = at;
    return amount;
  }

  /** Remove member `i` in O(1) by moving the last member into its slot. */
  removeAt(i: number): void {
    const last = this.count - 1;
    if (i < 0 || i > last) return;
    if (i !== last) {
      this.x[i] = this.x[last]!;
      this.y[i] = this.y[last]!;
      this.kind[i] = this.kind[last]!;
    }
    this.count = last;
  }

  /**
   * Advance a fixed budget of members (whole blocks, round-robin). Members
   * walk toward the player and stop at their own radius within the shell
   * (backing off if the player walks into them); ones that have arrived are recorded as promotion candidates, and ones
   * inside the draw box are recorded for the renderer.
   */
  sweep(now: number, view: HordeSweep, budget: number): void {
    this.candidateCount = 0;
    const total = this.count;
    if (total === 0) return;
    const blockCount = Math.ceil(total / HORDE_BLOCK);
    const blocks = Math.min(blockCount, Math.max(1, Math.floor(budget / HORDE_BLOCK)));
    const depth = this.shellDepth(view.hold);
    const { px, py, hold, ky, drawHalfW, drawHalfH } = view;
    const invKy = 1 / ky;
    const x = this.x;
    const y = this.y;
    const kind = this.kind;
    const speeds = this.speedByKind;
    const visible = this.visible;
    for (let done = 0; done < blocks; done += 1) {
      if (this.cursorBlock >= blockCount) this.cursorBlock = 0;
      const block = this.cursorBlock++;
      const from = block * HORDE_BLOCK;
      const to = Math.min(total, from + HORDE_BLOCK);
      const stride = Math.min(MAX_STRIDE_SEC, Math.max(0, (now - this.stamp[block]!) / 1000));
      this.stamp[block] = now;
      for (let i = from; i < to; i += 1) {
        const dx = px - x[i]!;
        const dy = (py - y[i]!) * ky;
        const d2 = dx * dx + dy * dy;
        // Stable per-index depth spreads the crowd through the shell.
        const shell = hold + depth * (((Math.imul(i, 0x9e3779b1) >>> 12) & 0xfff) / 4096);
        const outer = shell + ARRIVE_SLACK;
        const inner = shell - ARRIVE_SLACK;
        if (d2 > outer * outer) {
          const d = Math.sqrt(d2);
          const step = Math.min(speeds[kind[i]!]! * stride, d - shell);
          x[i] = x[i]! + (dx / d) * step;
          y[i] = y[i]! + (dy / d) * step * invKy;
        } else if (d2 < inner * inner) {
          // The player walked into the shell: fall back out of the camera
          // rather than standing on screen where nothing can hit us.
          const d = Math.sqrt(d2) || 1;
          const step = Math.min(speeds[kind[i]!]! * stride, shell - d);
          x[i] = x[i]! - (dx / d) * step;
          y[i] = y[i]! - (dy / d) * step * invKy;
        } else if (this.candidateCount < CANDIDATE_CAPACITY) {
          this.candidates[this.candidateCount++] = i;
        }
        const ax = x[i]! - px;
        const ay = y[i]! - py;
        if (ax > -drawHalfW && ax < drawHalfW && ay > -drawHalfH && ay < drawHalfH) {
          visible[this.visibleHead] = i;
          this.visibleHead = (this.visibleHead + 1) % HORDE_VISIBLE_CAPACITY;
          if (this.visibleCount < HORDE_VISIBLE_CAPACITY) this.visibleCount += 1;
        }
      }
    }
  }

  /** Sort candidates high-to-low so removing them never shifts a lower one. */
  sortCandidatesDescending(): void {
    const c = this.candidates;
    for (let i = 1; i < this.candidateCount; i += 1) {
      const v = c[i]!;
      let j = i - 1;
      while (j >= 0 && c[j]! < v) {
        c[j + 1] = c[j]!;
        j -= 1;
      }
      c[j + 1] = v;
    }
  }
}
