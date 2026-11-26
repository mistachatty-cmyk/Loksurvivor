/**
 * lokDrop.ts -- The Lok Drop, a 60-second skill-based loot vault (Lok Party Slice 1).
 *
 * Pure simulation: no DOM, no audio, no wall clock. The screen feeds input and draws; this file
 * owns every rule, so tests, bots and (later) online ghosts all run the same code.
 *
 * The loop:
 *   - Loot Capsules fall from the vault ceiling. Crack them (touch or dash) for loose loot;
 *     cracking one mid-air pays a bonus. Gold L capsules are rare and rich.
 *   - Crumbler Boulders roll across the floor. Getting hit spills what you carry; dashing into
 *     one cracks it open.
 *   - Dash into a rival to knock them away and spill their loot.
 *   - Carried loot is at risk. Stand in the Extraction Ring to bank it. The ring moves.
 *   - At 60 s the vault slams shut: anything still carried is lost. Most banked wins.
 *
 * World space: 1000 x 620 floor units, y grows toward the camera; z is height above the floor.
 */

import { Coyote, InputBuffer } from './juiceEngine';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

export const DROP = {
  durationMs: 60_000,
  width: 1000,
  height: 620,
  playerRadius: 18,
  moveSpeed: 260,
  accel: 2400,
  friction: 9,
  dashSpeed: 820,
  dashMs: 170,
  dashCooldownMs: 1050,
  stunMs: 520,
  spillShare: 0.5,
  boulderSpillShare: 0.4,
  capsuleRadius: 16,
  capsuleStartZ: 300,
  gravity: 900,
  airCrackZ: 24,
  airCrackBonus: 0.5,
  capsuleValue: 6,
  goldValue: 20,
  goldChance: 0.08,
  capsuleEveryMs: [900, 1400] as const,
  frenzyFromMs: 40_000,
  frenzyRate: 1.45,
  boulderEveryMs: [7500, 10500] as const,
  boulderRadius: 30,
  boulderSpeed: 230,
  boulderHp: 3,
  boulderValue: 12,
  tokenRadius: 9,
  pickupRadius: 30,
  ringRadius: 72,
  ringOpenMs: 6000,
  ringMoveEveryMs: 15_000,
  bankHoldMs: 450,
  slamWarnMs: 5000,
  clutchWindowMs: 8000,
} as const;

export type DropEventKind =
  | 'capsule-land'
  | 'capsule-crack'
  | 'gold-crack'
  | 'pickup'
  | 'dash'
  | 'hit'
  | 'boulder-hit'
  | 'boulder-crack'
  | 'bank'
  | 'ring-move'
  | 'slam-warn'
  | 'slam';

export interface DropEvent {
  kind: DropEventKind;
  x: number;
  y: number;
  /** Player index the event belongs to, if any. */
  who?: number;
  value?: number;
  /** 0..1 weight for juice (hit-stop, punch). */
  weight: number;
}

export interface DropPlayer {
  index: number;
  characterId: string;
  bot: boolean;
  botSkill: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  carried: number;
  banked: number;
  dashUntil: number;
  dashReadyAt: number;
  stunUntil: number;
  bankingSince: number | null;
  knockouts: number;
  knockedOut: number;
  capsulesCracked: number;
  airCracks: number;
  clutchBanks: number;
  maxCarried: number;
  input: InputBuffer<'dash'>;
  ringGrace: Coyote;
  /** Bot memory. */
  bot_target: { x: number; y: number } | null;
  bot_thinkAt: number;
}

export interface Capsule {
  id: number;
  x: number;
  y: number;
  z: number;
  vz: number;
  gold: boolean;
  bounces: number;
}

export interface Token {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  gold: boolean;
  bornAt: number;
}

export interface Boulder {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  spin: number;
}

export interface DropState {
  seed: number;
  /** Match length; 60 s standalone, 30 s as a board minigame. */
  durationMs: number;
  now: number;
  rng: () => number;
  players: DropPlayer[];
  capsules: Capsule[];
  tokens: Token[];
  boulders: Boulder[];
  ring: { x: number; y: number; open: boolean; movedAt: number };
  nextCapsuleAt: number;
  nextBoulderAt: number;
  nextId: number;
  slamWarned: boolean;
  over: boolean;
  events: DropEvent[];
}

export interface PlayerInput {
  /** -1..1 each; magnitude above 1 is clamped. */
  mx: number;
  my: number;
  /** True on the frame dash was pressed (pointerdown / keydown). */
  dashPressed: boolean;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function dropRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng: () => number, [lo, hi]: readonly [number, number]) => lo + (hi - lo) * rng();

export function createLokDrop(seed: number, roster: { characterId: string; bot: boolean; botSkill?: number }[], durationMs: number = DROP.durationMs): DropState {
  const rng = dropRng(seed);
  const corners = [
    [180, 160],
    [820, 160],
    [180, 470],
    [820, 470],
  ];
  const players = roster.slice(0, 4).map((r, i): DropPlayer => ({
    index: i,
    characterId: r.characterId,
    bot: r.bot,
    botSkill: Math.min(1, Math.max(0, r.botSkill ?? 0.6)),
    x: corners[i][0],
    y: corners[i][1],
    vx: 0,
    vy: 0,
    facing: i % 2 === 0 ? 1 : -1,
    carried: 0,
    banked: 0,
    dashUntil: 0,
    dashReadyAt: 0,
    stunUntil: 0,
    bankingSince: null,
    knockouts: 0,
    knockedOut: 0,
    capsulesCracked: 0,
    airCracks: 0,
    clutchBanks: 0,
    maxCarried: 0,
    input: new InputBuffer<'dash'>(),
    ringGrace: new Coyote(),
    bot_target: null,
    bot_thinkAt: 0,
  }));
  return {
    seed,
    durationMs: Math.max(15_000, durationMs),
    now: 0,
    rng,
    players,
    capsules: [],
    tokens: [],
    boulders: [],
    ring: { x: 500, y: 310, open: false, movedAt: 0 },
    nextCapsuleAt: 600,
    nextBoulderAt: between(rng, DROP.boulderEveryMs),
    nextId: 1,
    slamWarned: false,
    over: false,
    events: [],
  };
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

export function timeLeftMs(s: DropState): number {
  return Math.max(0, s.durationMs - s.now);
}

/**
 * Advance the match by `dtMs` (call with a fixed 1000/60). `inputs[i]` is ignored for bots.
 * Events emitted this step are in `s.events` (cleared at the start of each step).
 */
export function stepLokDrop(s: DropState, inputs: (PlayerInput | null)[], dtMs: number): void {
  if (s.over) return;
  s.events = [];
  const dt = dtMs / 1000;
  s.now += dtMs;

  spawnStuff(s);
  updateRing(s);

  for (const p of s.players) {
    const inp = p.bot ? botThink(s, p) : inputs[p.index] ?? { mx: 0, my: 0, dashPressed: false };
    if (inp.dashPressed) p.input.press('dash', s.now);
    movePlayer(s, p, inp, dt);
  }

  updateCapsules(s, dt);
  updateTokens(s, dt);
  updateBoulders(s, dt);
  resolvePlayerHits(s);
  pickups(s);
  banking(s);

  if (!s.slamWarned && timeLeftMs(s) <= DROP.slamWarnMs) {
    s.slamWarned = true;
    s.events.push({ kind: 'slam-warn', x: s.ring.x, y: s.ring.y, weight: 0.3 });
  }
  if (s.now >= s.durationMs) {
    s.over = true;
    for (const p of s.players) p.carried = 0;
    s.events.push({ kind: 'slam', x: DROP.width / 2, y: DROP.height / 2, weight: 1 });
  }
}

function spawnStuff(s: DropState): void {
  if (s.now >= s.nextCapsuleAt && s.now < s.durationMs - 1500) {
    const gold = s.rng() < DROP.goldChance;
    s.capsules.push({
      id: s.nextId++,
      x: 80 + s.rng() * (DROP.width - 160),
      y: 70 + s.rng() * (DROP.height - 140),
      z: DROP.capsuleStartZ + s.rng() * 120,
      vz: 0,
      gold,
      bounces: 0,
    });
    const rate = s.now >= s.durationMs - (DROP.durationMs - DROP.frenzyFromMs) ? DROP.frenzyRate : 1;
    s.nextCapsuleAt = s.now + between(s.rng, DROP.capsuleEveryMs) / rate;
  }
  if (s.now >= s.nextBoulderAt && s.now < s.durationMs - 3000) {
    const fromLeft = s.rng() < 0.5;
    const y = 90 + s.rng() * (DROP.height - 180);
    const angle = (s.rng() - 0.5) * 0.5;
    s.boulders.push({
      id: s.nextId++,
      x: fromLeft ? -DROP.boulderRadius : DROP.width + DROP.boulderRadius,
      y,
      vx: Math.cos(angle) * DROP.boulderSpeed * (fromLeft ? 1 : -1),
      vy: Math.sin(angle) * DROP.boulderSpeed,
      hp: DROP.boulderHp,
      spin: 0,
    });
    s.nextBoulderAt = s.now + between(s.rng, DROP.boulderEveryMs);
  }
}

function updateRing(s: DropState): void {
  const r = s.ring;
  const openAt = Math.min(DROP.ringOpenMs, s.durationMs * 0.1);
  if (!r.open && s.now >= openAt) {
    r.open = true;
    r.movedAt = s.now;
    s.events.push({ kind: 'ring-move', x: r.x, y: r.y, weight: 0.2 });
    return;
  }
  if (r.open && s.now - r.movedAt >= Math.min(DROP.ringMoveEveryMs, s.durationMs / 4) && timeLeftMs(s) > DROP.slamWarnMs) {
    // Pick a spot away from the old one and away from the walls.
    let best = { x: r.x, y: r.y, d: -1 };
    for (let i = 0; i < 6; i += 1) {
      const x = 140 + s.rng() * (DROP.width - 280);
      const y = 120 + s.rng() * (DROP.height - 240);
      const d = dist2(x, y, r.x, r.y);
      if (d > best.d) best = { x, y, d };
    }
    r.x = best.x;
    r.y = best.y;
    r.movedAt = s.now;
    for (const p of s.players) p.bankingSince = null;
    s.events.push({ kind: 'ring-move', x: r.x, y: r.y, weight: 0.3 });
  }
}

function movePlayer(s: DropState, p: DropPlayer, inp: PlayerInput, dt: number): void {
  const stunned = s.now < p.stunUntil;
  const dashing = s.now < p.dashUntil;
  let mx = Number.isFinite(inp.mx) ? inp.mx : 0;
  let my = Number.isFinite(inp.my) ? inp.my : 0;
  const mag = Math.hypot(mx, my);
  if (mag > 1) {
    mx /= mag;
    my /= mag;
  }
  if (!stunned && !dashing && s.now >= p.dashReadyAt && p.input.consume('dash', s.now)) {
    // Dash along input, or facing when idle.
    let dx = mx;
    let dy = my;
    if (Math.hypot(dx, dy) < 0.2) {
      dx = p.facing;
      dy = 0;
    }
    const d = Math.hypot(dx, dy) || 1;
    p.vx = (dx / d) * DROP.dashSpeed;
    p.vy = (dy / d) * DROP.dashSpeed;
    p.dashUntil = s.now + DROP.dashMs;
    p.dashReadyAt = s.now + DROP.dashCooldownMs;
    s.events.push({ kind: 'dash', x: p.x, y: p.y, who: p.index, weight: 0.15 });
  } else if (!stunned && !dashing) {
    const tx = mx * DROP.moveSpeed;
    const ty = my * DROP.moveSpeed;
    const k = Math.min(1, (DROP.accel * dt) / DROP.moveSpeed);
    p.vx += (tx - p.vx) * k;
    p.vy += (ty - p.vy) * k;
  } else {
    const f = Math.exp(-DROP.friction * dt * (dashing ? 0.3 : 1));
    p.vx *= f;
    p.vy *= f;
  }
  if (Math.abs(p.vx) > 8) p.facing = p.vx > 0 ? 1 : -1;
  p.x = Math.min(DROP.width - DROP.playerRadius, Math.max(DROP.playerRadius, p.x + p.vx * dt));
  p.y = Math.min(DROP.height - DROP.playerRadius, Math.max(DROP.playerRadius, p.y + p.vy * dt));
}

function crackCapsule(s: DropState, c: Capsule, who: DropPlayer | null): void {
  const air = c.z > DROP.airCrackZ;
  const base = c.gold ? DROP.goldValue : DROP.capsuleValue;
  const total = Math.round(base * (air ? 1 + DROP.airCrackBonus : 1));
  const pieces = c.gold ? 5 : 3;
  spillTokens(s, c.x, c.y, total, pieces, c.gold);
  if (who) {
    who.capsulesCracked += 1;
    if (air) who.airCracks += 1;
  }
  s.events.push({ kind: c.gold ? 'gold-crack' : 'capsule-crack', x: c.x, y: c.y, who: who?.index, value: total, weight: c.gold ? 0.9 : air ? 0.55 : 0.35 });
}

function spillTokens(s: DropState, x: number, y: number, total: number, pieces: number, gold: boolean): void {
  if (total <= 0) return;
  const n = Math.max(1, Math.min(pieces, total));
  let left = total;
  for (let i = 0; i < n; i += 1) {
    const value = i === n - 1 ? left : Math.max(1, Math.floor(total / n));
    left -= value;
    const a = (i / n) * Math.PI * 2 + s.rng() * 0.8;
    const sp = 140 + s.rng() * 120;
    s.tokens.push({ id: s.nextId++, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, value, gold, bornAt: s.now });
  }
}

function updateCapsules(s: DropState, dt: number): void {
  const keep: Capsule[] = [];
  for (const c of s.capsules) {
    c.vz -= DROP.gravity * dt;
    c.z += c.vz * dt;
    if (c.z <= 0) {
      c.z = 0;
      if (c.vz < -80 && c.bounces < 2) {
        c.vz = -c.vz * 0.42;
        c.bounces += 1;
        s.events.push({ kind: 'capsule-land', x: c.x, y: c.y, weight: c.bounces === 1 ? 0.2 : 0.08 });
      } else c.vz = 0;
    }
    let cracked = false;
    for (const p of s.players) {
      if (s.now < p.stunUntil) continue;
      const reach = DROP.playerRadius + DROP.capsuleRadius + (s.now < p.dashUntil ? 10 : 0);
      // Dashers can crack higher; walkers only crack near the floor.
      const zReach = s.now < p.dashUntil ? 90 : 40;
      if (c.z <= zReach && dist2(p.x, p.y, c.x, c.y) <= reach * reach) {
        crackCapsule(s, c, p);
        cracked = true;
        break;
      }
    }
    if (!cracked) keep.push(c);
  }
  s.capsules = keep;
}

function updateTokens(s: DropState, dt: number): void {
  const f = Math.exp(-4 * dt);
  for (const t of s.tokens) {
    t.x = Math.min(DROP.width - 10, Math.max(10, t.x + t.vx * dt));
    t.y = Math.min(DROP.height - 10, Math.max(10, t.y + t.vy * dt));
    t.vx *= f;
    t.vy *= f;
  }
}

function updateBoulders(s: DropState, dt: number): void {
  const keep: Boulder[] = [];
  for (const b of s.boulders) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin += (Math.hypot(b.vx, b.vy) / DROP.boulderRadius) * dt;
    if (b.y < DROP.boulderRadius || b.y > DROP.height - DROP.boulderRadius) b.vy = -b.vy;
    let alive = b.hp > 0;
    for (const p of s.players) {
      if (!alive) break;
      const r = DROP.playerRadius + DROP.boulderRadius;
      if (dist2(p.x, p.y, b.x, b.y) > r * r) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (s.now < p.dashUntil) {
        // Dashing into a boulder chips it; the dasher bounces off.
        b.hp -= 1;
        p.vx = (dx / d) * 380;
        p.vy = (dy / d) * 380;
        p.dashUntil = s.now;
        if (b.hp <= 0) {
          alive = false;
          spillTokens(s, b.x, b.y, DROP.boulderValue, 4, false);
          s.events.push({ kind: 'boulder-crack', x: b.x, y: b.y, who: p.index, value: DROP.boulderValue, weight: 0.8 });
        } else s.events.push({ kind: 'boulder-hit', x: b.x, y: b.y, who: p.index, weight: 0.45 });
      } else if (s.now >= p.stunUntil) {
        const spill = Math.floor(p.carried * DROP.boulderSpillShare);
        p.carried -= spill;
        spillTokens(s, p.x, p.y, spill, 3, false);
        p.stunUntil = s.now + DROP.stunMs;
        p.vx = (dx / d) * 520;
        p.vy = (dy / d) * 520;
        p.bankingSince = null;
        p.knockedOut += 1;
        s.events.push({ kind: 'hit', x: p.x, y: p.y, who: p.index, value: spill, weight: 0.7 });
      }
    }
    const out = b.x < -80 || b.x > DROP.width + 80;
    if (alive && !out) keep.push(b);
  }
  s.boulders = keep;
}

function resolvePlayerHits(s: DropState): void {
  const ps = s.players;
  for (let i = 0; i < ps.length; i += 1) {
    for (let j = i + 1; j < ps.length; j += 1) {
      const a = ps[i];
      const b = ps[j];
      const r = DROP.playerRadius * 2;
      if (dist2(a.x, a.y, b.x, b.y) > r * r) continue;
      const aDash = s.now < a.dashUntil;
      const bDash = s.now < b.dashUntil;
      if (aDash === bDash) {
        // Push apart (two dashers clash: both bounce, nobody spills).
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const push = (r - d) / 2 + 0.5;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        if (aDash) {
          a.dashUntil = b.dashUntil = s.now;
          s.events.push({ kind: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, weight: 0.5 });
        }
        continue;
      }
      const atk = aDash ? a : b;
      const vic = aDash ? b : a;
      if (s.now < vic.stunUntil) continue;
      const spill = Math.floor(vic.carried * DROP.spillShare);
      vic.carried -= spill;
      spillTokens(s, vic.x, vic.y, spill, 4, false);
      const d = Math.hypot(atk.vx, atk.vy) || 1;
      vic.vx = (atk.vx / d) * 560;
      vic.vy = (atk.vy / d) * 560;
      vic.stunUntil = s.now + DROP.stunMs;
      vic.bankingSince = null;
      vic.knockedOut += 1;
      atk.knockouts += 1;
      atk.dashUntil = s.now;
      atk.vx *= 0.2;
      atk.vy *= 0.2;
      s.events.push({ kind: 'hit', x: vic.x, y: vic.y, who: atk.index, value: spill, weight: Math.min(1, 0.55 + spill / 40) });
    }
  }
}

function pickups(s: DropState): void {
  const keep: Token[] = [];
  for (const t of s.tokens) {
    // Freshly spilled loot cannot be grabbed for a moment (so a knockback is a real swing).
    if (s.now - t.bornAt < 220) {
      keep.push(t);
      continue;
    }
    let taken = false;
    for (const p of s.players) {
      if (s.now < p.stunUntil) continue;
      if (dist2(p.x, p.y, t.x, t.y) <= DROP.pickupRadius * DROP.pickupRadius) {
        p.carried += t.value;
        p.maxCarried = Math.max(p.maxCarried, p.carried);
        s.events.push({ kind: 'pickup', x: t.x, y: t.y, who: p.index, value: t.value, weight: t.gold ? 0.2 : 0.05 });
        taken = true;
        break;
      }
    }
    if (!taken) keep.push(t);
  }
  s.tokens = keep;
}

function banking(s: DropState): void {
  const r = s.ring;
  if (!r.open) return;
  for (const p of s.players) {
    const inside = dist2(p.x, p.y, r.x, r.y) <= DROP.ringRadius * DROP.ringRadius;
    if (inside) p.ringGrace.mark(s.now);
    // 80 ms coyote: brushing the edge does not reset the hold.
    if (!p.ringGrace.ok(s.now) || s.now < p.stunUntil || p.carried <= 0) {
      if (!p.ringGrace.ok(s.now)) p.bankingSince = null;
      continue;
    }
    if (p.bankingSince === null) p.bankingSince = s.now;
    if (s.now - p.bankingSince >= DROP.bankHoldMs) {
      const v = p.carried;
      p.banked += v;
      p.carried = 0;
      p.bankingSince = null;
      if (timeLeftMs(s) <= DROP.clutchWindowMs) p.clutchBanks += 1;
      s.events.push({ kind: 'bank', x: p.x, y: p.y, who: p.index, value: v, weight: Math.min(1, 0.3 + v / 60) });
    }
  }
}

/** 0..1 hold progress, for the ring HUD. */
export function bankProgress(s: DropState, p: DropPlayer): number {
  if (p.bankingSince === null) return 0;
  return Math.min(1, (s.now - p.bankingSince) / DROP.bankHoldMs);
}

// ---------------------------------------------------------------------------
// Bots: greedy, readable, beatable (blueprint section 6: lightweight heuristic)
// ---------------------------------------------------------------------------

function botThink(s: DropState, p: DropPlayer): PlayerInput {
  const left = timeLeftMs(s);
  // Reaction time: weaker bots re-plan less often.
  if (s.now >= p.bot_thinkAt || !p.bot_target) {
    p.bot_thinkAt = s.now + 140 + (1 - p.botSkill) * 260;
    p.bot_target = chooseTarget(s, p, left);
  }
  const t = p.bot_target!;
  let mx = t.x - p.x;
  let my = t.y - p.y;
  const d = Math.hypot(mx, my) || 1;
  mx /= d;
  my /= d;
  // Sidestep boulders heading our way.
  for (const b of s.boulders) {
    const rx = p.x - b.x;
    const ry = p.y - b.y;
    const closing = rx * b.vx + ry * b.vy > 0;
    if (closing && rx * rx + ry * ry < 150 * 150) {
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const side = (-b.vy * rx + b.vx * ry) / sp >= 0 ? 1 : -1;
      mx = (-b.vy / sp) * side;
      my = (b.vx / sp) * side;
      break;
    }
  }
  // Dash at a rich, close rival, or at a low capsule in reach.
  let dashPressed = false;
  if (s.now >= p.dashReadyAt && s.now >= p.stunUntil) {
    for (const o of s.players) {
      if (o === p || s.now < o.stunUntil || o.carried < 8) continue;
      const dd = dist2(p.x, p.y, o.x, o.y);
      if (dd < 130 * 130 && s.rng() < 0.08 + p.botSkill * 0.12) {
        const od = Math.sqrt(dd) || 1;
        mx = (o.x - p.x) / od;
        my = (o.y - p.y) / od;
        dashPressed = true;
        break;
      }
    }
  }
  if (d < 6) {
    mx = 0;
    my = 0;
  }
  // Jitter so bots do not look like rails.
  mx += (s.rng() - 0.5) * 0.25 * (1 - p.botSkill);
  my += (s.rng() - 0.5) * 0.25 * (1 - p.botSkill);
  return { mx, my, dashPressed };
}

function chooseTarget(s: DropState, p: DropPlayer, left: number): { x: number; y: number } {
  const greed = 18 + p.botSkill * 22;
  const ring = s.ring;
  const toRing = Math.sqrt(dist2(p.x, p.y, ring.x, ring.y));
  const runHome = ring.open && p.carried > 0 && (p.carried >= greed || left < 4000 + (toRing / DROP.moveSpeed) * 1000);
  if (runHome) return { x: ring.x, y: ring.y };
  let best: { x: number; y: number; score: number } | null = null;
  for (const t of s.tokens) {
    const dd = Math.sqrt(dist2(p.x, p.y, t.x, t.y));
    const score = t.value / (40 + dd);
    if (!best || score > best.score) best = { x: t.x, y: t.y, score };
  }
  for (const c of s.capsules) {
    const dd = Math.sqrt(dist2(p.x, p.y, c.x, c.y));
    const eta = Math.max(0, c.z) / 300;
    const value = c.gold ? DROP.goldValue : DROP.capsuleValue;
    const score = (value * 0.9) / (60 + dd + eta * 80);
    if (!best || score > best.score) best = { x: c.x, y: c.y, score };
  }
  if (best) return { x: best.x, y: best.y };
  return ring.open ? { x: ring.x, y: ring.y } : { x: DROP.width / 2, y: DROP.height / 2 };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface DropResult {
  index: number;
  characterId: string;
  bot: boolean;
  placement: number;
  banked: number;
  knockouts: number;
  airCracks: number;
  clutchBanks: number;
  maxCarried: number;
}

export function dropResults(s: DropState): DropResult[] {
  const order = [...s.players].sort((a, b) => b.banked - a.banked || b.knockouts - a.knockouts || a.index - b.index);
  return order.map((p, i) => ({
    index: p.index,
    characterId: p.characterId,
    bot: p.bot,
    placement: i + 1,
    banked: p.banked,
    knockouts: p.knockouts,
    airCracks: p.airCracks,
    clutchBanks: p.clutchBanks,
    maxCarried: p.maxCarried,
  }));
}

/** Map a Lok Drop result onto the shared meta grade inputs. */
export function dropPerformance(s: DropState, r: DropResult) {
  const totalBanked = s.players.reduce((n, p) => n + p.banked, 0) || 1;
  const totalKo = s.players.reduce((n, p) => n + p.knockouts, 0);
  return {
    characterId: r.characterId,
    placement: r.placement,
    players: s.players.length,
    objective: (r.banked / totalBanked) * 2, // a fair share among four is 0.25; double so a clear lead reads as near 1
    skill: totalKo ? r.knockouts / totalKo : 0.5,
    clutch: r.clutchBanks + (r.airCracks >= 3 ? 1 : 0),
    risk: Math.min(1, r.maxCarried / 60),
    banked: r.banked,
    stats: { knockouts: r.knockouts, 'air-cracks': r.airCracks, 'loot-banked': r.banked },
  };
}

// ---------------------------------------------------------------------------
// Solo Blitz bot tiers: bots get sharper as the player's ladder tier rises
// ---------------------------------------------------------------------------

/**
 * Three bot skills for a Solo Blitz ladder tier (0 = Iron .. 8 = 616 Apex).
 * Iron bots are slow to react and greedy; Apex bots re-plan fast, bank on time and hunt carriers.
 * One bot always sits a little below the others so a match never feels like a wall.
 */
export function botSkillsForTier(tier: number): [number, number, number] {
  const t = Math.min(8, Math.max(0, Math.floor(Number.isFinite(tier) ? tier : 0)));
  const base = 0.3 + t * 0.075; // Iron 0.30 .. Apex 0.90
  const clamp01 = (v: number) => Math.round(Math.min(0.95, Math.max(0.15, v)) * 100) / 100;
  return [clamp01(base + 0.05), clamp01(base), clamp01(base - 0.12)];
}
