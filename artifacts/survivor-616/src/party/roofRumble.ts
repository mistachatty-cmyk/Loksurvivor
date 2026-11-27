/**
 * Roof Rumble: the third Lok Party minigame. Four characters on a neon rooftop that crumbles inward.
 * Drag to move, tap to dash into a rival and shove them off the edge. Boom barrels drop in and blast
 * everyone nearby; dash into one to set it off early. A knockout (a rival falls within a few seconds
 * of your hit) is +3; falling yourself is -1. You drop back in after a fall, so nobody sits out.
 *
 * Pure and seeded like ringRush.ts: no DOM, so it runs in node:test, and every client builds the same
 * roof from the seed. World units: the roof is a disc centred on (0, 0).
 */

import { createRng } from '@/game/engine/math';
import type { MinigameResult, MinigameSeat, StageInput } from './minigameKit';

export const RUMBLE = {
  durationMs: 30_000,
  radius: 330,
  minRadius: 150,
  shrinkFromMs: 6_000,
  shrinkToMs: 26_000,
  body: 30,
  walkAccel: 2100,
  walkMax: 255,
  friction: 5.5,
  dashSpeed: 900,
  dashMs: 230,
  dashCooldownMs: 850,
  hitDash: 1000,
  clashBounce: 620,
  stunMs: 380,
  fallMs: 1400,
  dropMs: 520,
  invulnMs: 1100,
  creditMs: 3500,
  barrelFirstMs: 3_500,
  barrelEveryMs: 4_200,
  barrelDropMs: 900,
  barrelFuseMs: 3_200,
  barrelRadius: 26,
  blastRadius: 175,
  blastForce: 1300,
  points: { ko: 3, fall: -1 },
  /** Roof Collapse: the floor is concentric rings that drop away from the outside in. */
  rings: [330, 250, 180, 120],
  ringDropAt: [9_000, 16_000, 23_000],
  ringWarnMs: 1_700,
} as const;

/**
 * Arenas share every rule except how the floor gives way.
 * sumo: the edge crumbles inward smoothly (Roof Rumble).
 * collapse: whole rings crack, flash and drop, one at a time (Roof Collapse).
 */
export type RumbleArena = 'sumo' | 'collapse';

export interface RumbleRunner {
  index: number;
  characterId: string;
  bot: boolean;
  skill: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  dashUntil: number;
  dashReadyAt: number;
  stunUntil: number;
  invulnUntil: number;
  /** Set while dropping back in from the sky after a fall; no control or contact until then. */
  dropUntil: number;
  /** When the runner went over the edge, or 0 while on the roof. */
  fallingSince: number;
  fallX: number;
  fallY: number;
  lastHitBy: number;
  lastHitAt: number;
  score: number;
  kos: number;
  falls: number;
  thinkAt: number;
  aimX: number;
  aimY: number;
}

export interface RumbleBarrel {
  id: number;
  x: number;
  y: number;
  landAt: number;
  fuseAt: number;
  landed: boolean;
  gone: boolean;
}

export type RumbleEvent =
  | { type: 'dash'; index: number; x: number; y: number }
  | { type: 'bump'; by: number; index: number; x: number; y: number; weight: number }
  | { type: 'clash'; a: number; b: number; x: number; y: number }
  | { type: 'fall'; index: number; x: number; y: number }
  | { type: 'ko'; by: number; index: number; x: number; y: number }
  | { type: 'land'; index: number; x: number; y: number }
  | { type: 'barrelDrop'; x: number; y: number }
  | { type: 'barrelLand'; x: number; y: number }
  | { type: 'boom'; by: number; x: number; y: number }
  | { type: 'crumble'; radius: number }
  | { type: 'ringWarn'; inner: number; outer: number }
  | { type: 'ringDrop'; inner: number; outer: number };

export interface RumbleState {
  seed: number;
  arena: RumbleArena;
  /** Collapse: how many outer rings have dropped. */
  ringsDropped: number;
  ringsWarned: number;
  now: number;
  durationMs: number;
  radius: number;
  runners: RumbleRunner[];
  barrels: RumbleBarrel[];
  nextBarrelAt: number;
  nextBarrelId: number;
  lastCrumble: number;
  over: boolean;
  events: RumbleEvent[];
  rng: () => number;
}

const len = (x: number, y: number) => Math.hypot(x, y);

/** Collapse: rings dropped by a time. */
export function ringsDroppedAt(now: number): number {
  return RUMBLE.ringDropAt.filter((at) => now >= at).length;
}

/** Collapse: the ring currently cracking, if any (index into the drop schedule). */
export function crackingRing(now: number): number {
  return RUMBLE.ringDropAt.findIndex((at) => now >= at - RUMBLE.ringWarnMs && now < at);
}

export function rumbleRadius(now: number, arena: RumbleArena = 'sumo'): number {
  if (arena === 'collapse') return RUMBLE.rings[ringsDroppedAt(now)];
  const p = Math.min(1, Math.max(0, (now - RUMBLE.shrinkFromMs) / (RUMBLE.shrinkToMs - RUMBLE.shrinkFromMs)));
  return RUMBLE.radius - (RUMBLE.radius - RUMBLE.minRadius) * p;
}

export function createRoofRumble(seed: number, seats: MinigameSeat[], arena: RumbleArena = 'sumo', durationMs: number = RUMBLE.durationMs): RumbleState {
  const runners = seats.map((seat, index): RumbleRunner => {
    const a = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, seats.length) + Math.PI / 4;
    return {
      index,
      characterId: seat.characterId,
      bot: seat.bot,
      skill: seat.botSkill ?? 0.5,
      x: Math.cos(a) * 150,
      y: Math.sin(a) * 150,
      vx: 0,
      vy: 0,
      facing: Math.cos(a) > 0 ? -1 : 1,
      dashUntil: 0,
      dashReadyAt: 0,
      stunUntil: 0,
      invulnUntil: 0,
      dropUntil: 0,
      fallingSince: 0,
      fallX: 0,
      fallY: 0,
      lastHitBy: -1,
      lastHitAt: -1e9,
      score: 0,
      kos: 0,
      falls: 0,
      thinkAt: 0,
      aimX: 0,
      aimY: 0,
    };
  });
  return {
    seed,
    arena,
    ringsDropped: 0,
    ringsWarned: 0,
    now: 0,
    durationMs,
    radius: RUMBLE.radius,
    runners,
    barrels: [],
    nextBarrelAt: RUMBLE.barrelFirstMs,
    nextBarrelId: 1,
    lastCrumble: RUMBLE.radius,
    over: false,
    events: [],
    rng: createRng(seed),
  };
}

const onRoof = (r: RumbleRunner, now: number) => r.fallingSince === 0 && now >= r.dropUntil;

function dash(s: RumbleState, r: RumbleRunner, dx: number, dy: number) {
  const d = len(dx, dy);
  if (d < 1 || s.now < r.dashReadyAt || s.now < r.stunUntil) return;
  r.vx = (dx / d) * RUMBLE.dashSpeed;
  r.vy = (dy / d) * RUMBLE.dashSpeed;
  r.dashUntil = s.now + RUMBLE.dashMs;
  r.dashReadyAt = s.now + RUMBLE.dashCooldownMs;
  if (Math.abs(dx) > 4) r.facing = dx > 0 ? 1 : -1;
  s.events.push({ type: 'dash', index: r.index, x: r.x, y: r.y });
}

function hit(s: RumbleState, victim: RumbleRunner, by: number, nx: number, ny: number, force: number, stunMs: number) {
  victim.vx = nx * force;
  victim.vy = ny * force;
  victim.dashUntil = 0;
  victim.stunUntil = s.now + stunMs;
  if (by >= 0 && by !== victim.index) {
    victim.lastHitBy = by;
    victim.lastHitAt = s.now;
  }
}

function explode(s: RumbleState, b: RumbleBarrel, by: number) {
  if (b.gone) return;
  b.gone = true;
  s.events.push({ type: 'boom', by, x: b.x, y: b.y });
  for (const r of s.runners) {
    if (!onRoof(r, s.now) || s.now < r.invulnUntil) continue;
    const dx = r.x - b.x;
    const dy = r.y - b.y;
    const d = len(dx, dy);
    if (d > RUMBLE.blastRadius) continue;
    const ang = d < 1 ? s.rng() * Math.PI * 2 : Math.atan2(dy, dx);
    const force = 320 + (1 - d / RUMBLE.blastRadius) * RUMBLE.blastForce;
    hit(s, r, by, Math.cos(ang), Math.sin(ang), force, 520);
  }
  // Chain reaction.
  for (const other of s.barrels) {
    if (!other.gone && other.landed && len(other.x - b.x, other.y - b.y) < RUMBLE.blastRadius * 0.8) explode(s, other, by);
  }
}

/** Where it is safe to stand: during a crack, the ring about to drop does not count. */
export function safeRadius(s: RumbleState): number {
  if (s.arena !== 'collapse') return s.radius;
  const i = crackingRing(s.now);
  return i >= 0 ? RUMBLE.rings[i + 1] : s.radius;
}

function botThink(s: RumbleState, r: RumbleRunner) {
  // A sharper bot thinks more often and aims truer.
  r.thinkAt = s.now + 110 + (1 - r.skill) * 260 + s.rng() * 80;
  const fromCentre = len(r.x, r.y);
  if (fromCentre > safeRadius(s) - 70) {
    r.aimX = r.x * 0.2;
    r.aimY = r.y * 0.2;
    return;
  }
  const ready = s.now >= r.dashReadyAt;
  // A landed barrel next to a rival is worth a dash.
  if (ready && r.skill > 0.45) {
    for (const b of s.barrels) {
      if (b.gone || !b.landed) continue;
      const near = s.runners.some((o) => o !== r && onRoof(o, s.now) && len(o.x - b.x, o.y - b.y) < 130);
      const mine = len(r.x - b.x, r.y - b.y);
      if (near && mine < 260 && mine > RUMBLE.blastRadius * 0.55 && s.rng() < r.skill) {
        dash(s, r, b.x - r.x, b.y - r.y);
        return;
      }
    }
  }
  let target: RumbleRunner | null = null;
  let best = -Infinity;
  for (const o of s.runners) {
    if (o === r || !onRoof(o, s.now) || s.now < o.invulnUntil) continue;
    const value = len(o.x, o.y) / s.radius - len(o.x - r.x, o.y - r.y) / 700;
    if (value > best) {
      best = value;
      target = o;
    }
  }
  if (!target) {
    r.aimX = 0;
    r.aimY = 0;
    return;
  }
  const out = Math.max(1, len(target.x, target.y));
  // Get between the rival and the centre, then shove outward.
  r.aimX = target.x - (target.x / out) * 70;
  r.aimY = target.y - (target.y / out) * 70;
  const dx = target.x - r.x;
  const dy = target.y - r.y;
  const d = len(dx, dy);
  const lined = (dx * target.x + dy * target.y) / (d * out);
  if (ready && d < 210 && lined > 0.55 - (1 - r.skill) * 0.5) {
    const err = (s.rng() - 0.5) * (1 - r.skill) * 0.8;
    const ang = Math.atan2(dy + target.vy * 0.12, dx + target.vx * 0.12) + err;
    dash(s, r, Math.cos(ang), Math.sin(ang));
  }
}

export function stepRoofRumble(s: RumbleState, inputs: (StageInput | null)[], dtMs: number): void {
  s.events.length = 0;
  if (s.over) return;
  s.now += dtMs;
  const dt = dtMs / 1000;
  s.radius = rumbleRadius(s.now, s.arena);
  if (s.arena === 'collapse') {
    const cracking = crackingRing(s.now);
    if (cracking >= 0 && s.ringsWarned <= cracking) {
      s.ringsWarned = cracking + 1;
      s.events.push({ type: 'ringWarn', inner: RUMBLE.rings[cracking + 1], outer: RUMBLE.rings[cracking] });
    }
    const dropped = ringsDroppedAt(s.now);
    while (s.ringsDropped < dropped) {
      s.events.push({ type: 'ringDrop', inner: RUMBLE.rings[s.ringsDropped + 1], outer: RUMBLE.rings[s.ringsDropped] });
      s.ringsDropped++;
    }
  } else {
    while (s.lastCrumble - s.radius >= 10) {
      s.lastCrumble -= 10;
      s.events.push({ type: 'crumble', radius: s.lastCrumble });
    }
  }

  // Barrels drop in, land, and blow on their own after a fuse.
  if (s.now >= s.nextBarrelAt) {
    s.nextBarrelAt += RUMBLE.barrelEveryMs;
    const a = s.rng() * Math.PI * 2;
    const d = Math.sqrt(s.rng()) * s.radius * 0.55;
    const b: RumbleBarrel = { id: s.nextBarrelId++, x: Math.cos(a) * d, y: Math.sin(a) * d, landAt: s.now + RUMBLE.barrelDropMs, fuseAt: s.now + RUMBLE.barrelDropMs + RUMBLE.barrelFuseMs, landed: false, gone: false };
    s.barrels.push(b);
    s.events.push({ type: 'barrelDrop', x: b.x, y: b.y });
  }
  for (const b of s.barrels) {
    if (b.gone) continue;
    if (!b.landed && s.now >= b.landAt) {
      b.landed = true;
      s.events.push({ type: 'barrelLand', x: b.x, y: b.y });
    }
    if (b.landed && (s.now >= b.fuseAt || len(b.x, b.y) > s.radius)) explode(s, b, -1);
  }

  for (const r of s.runners) {
    if (r.fallingSince) {
      if (s.now - r.fallingSince >= RUMBLE.fallMs) {
        const a = s.rng() * Math.PI * 2;
        r.x = Math.cos(a) * s.radius * 0.3;
        r.y = Math.sin(a) * s.radius * 0.3;
        r.vx = 0;
        r.vy = 0;
        r.fallingSince = 0;
        r.dropUntil = s.now + RUMBLE.dropMs;
        r.invulnUntil = r.dropUntil + RUMBLE.invulnMs;
        r.lastHitBy = -1;
      }
      continue;
    }
    if (r.dropUntil && s.now >= r.dropUntil) {
      r.dropUntil = 0;
      s.events.push({ type: 'land', index: r.index, x: r.x, y: r.y });
    }
    if (!onRoof(r, s.now)) continue;

    const control = s.now >= r.stunUntil;
    let ax = 0;
    let ay = 0;
    if (control && r.bot) {
      if (s.now >= r.thinkAt) botThink(s, r);
      ax = r.aimX - r.x;
      ay = r.aimY - r.y;
      if (len(ax, ay) < 14) ax = ay = 0;
    } else if (control) {
      const input = inputs[r.index];
      if (input?.tap) {
        // Aim assist: a tap near a rival dashes straight at them.
        let tx = input.tap.x;
        let ty = input.tap.y;
        let near = 110;
        for (const o of s.runners) {
          const d = len(o.x - input.tap.x, o.y - input.tap.y);
          if (o !== r && onRoof(o, s.now) && d < near) {
            near = d;
            tx = o.x;
            ty = o.y;
          }
        }
        dash(s, r, tx - r.x, ty - r.y);
      }
      else if (input?.action) dash(s, r, input.keys.x || r.facing, input.keys.y);
      if (input?.holding && input.aim) {
        ax = input.aim.x - r.x;
        ay = input.aim.y - r.y;
        if (len(ax, ay) < 14) ax = ay = 0;
      } else if (input) {
        ax = input.keys.x;
        ay = input.keys.y;
      }
    }

    const dashing = s.now < r.dashUntil;
    const a = len(ax, ay);
    if (!dashing && a > 0 && len(r.vx, r.vy) < RUMBLE.walkMax) {
      r.vx += (ax / a) * RUMBLE.walkAccel * dt;
      r.vy += (ay / a) * RUMBLE.walkAccel * dt;
      if (Math.abs(ax) > 4) r.facing = ax > 0 ? 1 : -1;
    }
    const drag = Math.exp(-(dashing ? 1.2 : RUMBLE.friction) * dt);
    r.vx *= drag;
    r.vy *= drag;
    r.x += r.vx * dt;
    r.y += r.vy * dt;
  }

  // Contact: a dash into a rival is a shove; two dashes clash and both bounce.
  const live = s.runners.filter((r) => onRoof(r, s.now));
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = len(dx, dy);
      if (d >= RUMBLE.body * 2 || d < 0.001) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (RUMBLE.body * 2 - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (closing <= 0) continue;
      const aDash = s.now < a.dashUntil;
      const bDash = s.now < b.dashUntil;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const bSafe = s.now < b.invulnUntil;
      const aSafe = s.now < a.invulnUntil;
      if (aDash && bDash) {
        if (!aSafe) hit(s, a, b.index, -nx, -ny, RUMBLE.clashBounce, RUMBLE.stunMs);
        if (!bSafe) hit(s, b, a.index, nx, ny, RUMBLE.clashBounce, RUMBLE.stunMs);
        s.events.push({ type: 'clash', a: a.index, b: b.index, x: mx, y: my });
      } else if (aDash && !bSafe) {
        hit(s, b, a.index, nx, ny, RUMBLE.hitDash, RUMBLE.stunMs);
        a.vx *= 0.25;
        a.vy *= 0.25;
        a.dashUntil = 0;
        s.events.push({ type: 'bump', by: a.index, index: b.index, x: mx, y: my, weight: 1 });
      } else if (bDash && !aSafe) {
        hit(s, a, b.index, -nx, -ny, RUMBLE.hitDash, RUMBLE.stunMs);
        b.vx *= 0.25;
        b.vy *= 0.25;
        b.dashUntil = 0;
        s.events.push({ type: 'bump', by: b.index, index: a.index, x: mx, y: my, weight: 1 });
      } else {
        // A walking bump: trade a little momentum.
        const k = closing * 0.6;
        a.vx -= nx * k;
        a.vy -= ny * k;
        b.vx += nx * k;
        b.vy += ny * k;
      }
    }
  }

  for (const r of live) {
    if (s.now < r.dashUntil) {
      for (const b of s.barrels) {
        if (!b.gone && b.landed && len(r.x - b.x, r.y - b.y) < RUMBLE.body + RUMBLE.barrelRadius) explode(s, b, r.index);
      }
    }
  }

  for (const r of s.runners) {
    if (!onRoof(r, s.now) || len(r.x, r.y) <= s.radius + RUMBLE.body * 0.2) continue;
    r.fallingSince = s.now;
    r.fallX = r.x;
    r.fallY = r.y;
    r.falls++;
    r.score = Math.max(0, r.score + RUMBLE.points.fall);
    s.events.push({ type: 'fall', index: r.index, x: r.x, y: r.y });
    const by = s.runners[r.lastHitBy];
    if (by && s.now - r.lastHitAt <= RUMBLE.creditMs) {
      by.kos++;
      by.score += RUMBLE.points.ko;
      s.events.push({ type: 'ko', by: by.index, index: r.index, x: r.x, y: r.y });
    }
  }

  if (s.now >= s.durationMs) s.over = true;
}

export function rumbleResults(s: RumbleState): MinigameResult[] {
  return [...s.runners]
    .sort((a, b) => b.score - a.score || b.kos - a.kos || a.falls - b.falls || a.index - b.index)
    .map((r, i) => ({ index: r.index, characterId: r.characterId, placement: i + 1, banked: r.score }));
}
