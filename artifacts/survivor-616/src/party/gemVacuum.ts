/**
 * Gem Vacuum Frenzy: the sixth Lok Party mode. Four characters in a glowing arena, each with a vacuum that
 * sucks in nearby gems. You carry what you suck up (the load slows you down), and only gems you walk back
 * to your own pad count. Dash into a rival and they spill half their load for you to hoover up. Bombs
 * knock your pile loose. The last stretch is a gold frenzy.
 *
 * Pure and seeded like the other minigames: no DOM, so it runs in node:test, and every client builds the
 * same gem drops from the seed. World units: the arena is a square centred on (0, 0).
 */

import { createRng } from '@/game/engine/math';
import type { MinigameResult, MinigameSeat, StageInput } from './minigameKit';

export const GEMS = {
  durationMs: 35_000,
  half: 280,
  frenzyMs: 8_000,
  body: 24,
  walkAccel: 3000,
  walkMax: 250,
  friction: 6,
  /** Each carried gem costs this share of speed, down to minSpeedShare. */
  loadSlow: 0.011,
  minSpeedShare: 0.55,
  carryCap: 30,
  vacRadius: 78,
  boostVacRadius: 150,
  vacPull: 520,
  pickRadius: 28,
  boostMs: 650,
  boostCooldownMs: 2200,
  boostSpeed: 520,
  padRadius: 62,
  padInset: 222,
  spawnEveryMs: 240,
  frenzyEveryMs: 110,
  maxGems: 46,
  goldChance: 0.14,
  bombChance: 0.05,
  stunMs: 700,
  stealShare: 0.5,
  victimInvulnMs: 900,
  bombRadius: 120,
} as const;

export type GemKind = 'gem' | 'gold' | 'bomb';

export interface Gem {
  id: number;
  kind: GemKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Time it appeared, for the pop-in. */
  born: number;
}

export interface GemRunner {
  index: number;
  characterId: string;
  bot: boolean;
  skill: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  carry: number;
  banked: number;
  boostUntil: number;
  boostReadyAt: number;
  stunUntil: number;
  invulnUntil: number;
  steals: number;
  thinkAt: number;
  aimX: number;
  aimY: number;
}

export type GemEvent =
  | { type: 'bank'; index: number; amount: number; x: number; y: number }
  | { type: 'steal'; from: number; to: number; amount: number; x: number; y: number }
  | { type: 'bomb'; index: number; lost: number; x: number; y: number }
  | { type: 'boost'; index: number }
  | { type: 'pick'; index: number; kind: GemKind; x: number; y: number }
  | { type: 'frenzy' };

export interface GemState {
  seed: number;
  rng: () => number;
  now: number;
  durationMs: number;
  over: boolean;
  runners: GemRunner[];
  gems: Gem[];
  nextGemId: number;
  nextSpawnAt: number;
  frenzy: boolean;
  events: GemEvent[];
}

const len = (x: number, y: number) => Math.hypot(x, y);

export const padCenter = (index: number): { x: number; y: number } => {
  const i = GEMS.padInset;
  return [
    { x: -i, y: -i },
    { x: i, y: -i },
    { x: -i, y: i },
    { x: i, y: i },
  ][index % 4];
};

export function createGemVacuum(seed: number, seats: MinigameSeat[], durationMs: number = GEMS.durationMs): GemState {
  const runners = seats.map((seat, index): GemRunner => {
    const p = padCenter(index);
    return {
      index,
      characterId: seat.characterId,
      bot: seat.bot,
      skill: seat.botSkill ?? 0.5,
      x: p.x * 0.6,
      y: p.y * 0.6,
      vx: 0,
      vy: 0,
      facing: p.x > 0 ? -1 : 1,
      carry: 0,
      banked: 0,
      boostUntil: 0,
      boostReadyAt: 0,
      stunUntil: 0,
      invulnUntil: 0,
      steals: 0,
      thinkAt: 0,
      aimX: 0,
      aimY: 0,
    };
  });
  const s: GemState = {
    seed,
    rng: createRng(seed),
    now: 0,
    durationMs,
    over: false,
    runners,
    gems: [],
    nextGemId: 1,
    nextSpawnAt: 0,
    frenzy: false,
    events: [],
  };
  // A first scatter so nobody starts on an empty floor.
  for (let i = 0; i < 18; i++) spawnGem(s, true);
  return s;
}

function spawnGem(s: GemState, opening = false) {
  if (s.gems.length >= GEMS.maxGems) return;
  const r = s.rng();
  const kind: GemKind = r < GEMS.bombChance && !opening ? 'bomb' : r < GEMS.bombChance + (s.frenzy ? 0.5 : GEMS.goldChance) ? 'gold' : 'gem';
  // Keep the pads clear: gems land in the middle band and the lanes between pads.
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 6; tries++) {
    x = (s.rng() * 2 - 1) * (GEMS.half - 24);
    y = (s.rng() * 2 - 1) * (GEMS.half - 24);
    let nearPad = false;
    for (let i = 0; i < 4; i++) {
      const p = padCenter(i);
      if (len(x - p.x, y - p.y) < GEMS.padRadius + 20) nearPad = true;
    }
    if (!nearPad) break;
  }
  s.gems.push({ id: s.nextGemId++, kind, x, y, vx: 0, vy: 0, born: s.now });
}

const speedFor = (r: GemRunner, boosting: boolean) => {
  const share = Math.max(GEMS.minSpeedShare, 1 - r.carry * GEMS.loadSlow);
  return (boosting ? GEMS.boostSpeed : GEMS.walkMax) * share;
};

const vacRadius = (r: GemRunner, now: number) => (now < r.boostUntil ? GEMS.boostVacRadius : GEMS.vacRadius);

function startBoost(s: GemState, r: GemRunner, dx: number, dy: number) {
  if (s.now < r.boostReadyAt || s.now < r.stunUntil) return;
  r.boostUntil = s.now + GEMS.boostMs;
  r.boostReadyAt = s.now + GEMS.boostCooldownMs;
  const d = len(dx, dy);
  if (d > 0.001) {
    r.vx = (dx / d) * GEMS.boostSpeed;
    r.vy = (dy / d) * GEMS.boostSpeed;
  } else {
    r.vx += r.facing * -GEMS.boostSpeed * 0.4;
  }
  s.events.push({ type: 'boost', index: r.index });
}

/** The gem scatter when a runner spills part of their load. */
function spill(s: GemState, r: GemRunner, amount: number, towards?: GemRunner) {
  let left = amount;
  while (left > 0 && s.gems.length < GEMS.maxGems + 12) {
    const value = left >= 3 && s.rng() < 0.3 ? 3 : 1;
    const a = s.rng() * Math.PI * 2;
    const sp = 170 + s.rng() * 220;
    s.gems.push({ id: s.nextGemId++, kind: value === 3 ? 'gold' : 'gem', x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: s.now });
    left -= value;
  }
  if (towards) towards.invulnUntil = Math.max(towards.invulnUntil, s.now + 120);
}

function botThink(s: GemState, r: GemRunner) {
  const pad = padCenter(r.index);
  const frenzyNear = s.durationMs - s.now < 5_000;
  const bankAt = 6 + Math.round((1 - r.skill) * 10) - (frenzyNear ? 4 : 0);
  if (r.carry >= bankAt || (frenzyNear && r.carry > 0 && len(pad.x - r.x, pad.y - r.y) < 260)) {
    r.aimX = pad.x;
    r.aimY = pad.y;
    return;
  }
  let best: Gem | null = null;
  let bestScore = -Infinity;
  for (const g of s.gems) {
    if (g.kind === 'bomb' && r.skill > 0.3) continue;
    const d = len(g.x - r.x, g.y - r.y);
    const value = g.kind === 'gold' ? 3.2 : g.kind === 'bomb' ? 0.4 : 1;
    const score = value * 120 - d;
    if (score > bestScore) {
      bestScore = score;
      best = g;
    }
  }
  if (best) {
    r.aimX = best.x;
    r.aimY = best.y;
  } else {
    r.aimX = pad.x * 0.2;
    r.aimY = pad.y * 0.2;
  }
  // Skilled bots hunt a fat load.
  if (r.skill > 0.45) {
    let prey: GemRunner | null = null;
    for (const o of s.runners) {
      if (o === r || o.carry < 6 || s.now < o.invulnUntil) continue;
      if (len(o.x - r.x, o.y - r.y) < 190 && (!prey || o.carry > prey.carry)) prey = o;
    }
    if (prey && r.carry < 12) {
      r.aimX = prey.x;
      r.aimY = prey.y;
    }
  }
}

export function stepGemVacuum(s: GemState, inputs: (StageInput | null)[], dtMs: number): void {
  s.events = [];
  if (s.over) return;
  s.now += dtMs;
  const dt = dtMs / 1000;

  if (!s.frenzy && s.durationMs - s.now <= GEMS.frenzyMs) {
    s.frenzy = true;
    s.events.push({ type: 'frenzy' });
  }

  // Spawn.
  while (s.now >= s.nextSpawnAt) {
    spawnGem(s);
    s.nextSpawnAt += s.frenzy ? GEMS.frenzyEveryMs : GEMS.spawnEveryMs;
  }

  for (const r of s.runners) {
    const input = inputs[r.index] ?? null;
    const stunned = s.now < r.stunUntil;
    let mx = 0;
    let my = 0;
    let wantBoost = false;
    if (r.bot) {
      if (s.now >= r.thinkAt) {
        r.thinkAt = s.now + 140 + (1 - r.skill) * 260;
        botThink(s, r);
      }
      const dx = r.aimX - r.x;
      const dy = r.aimY - r.y;
      const d = len(dx, dy);
      if (d > 8) {
        mx = dx / d;
        my = dy / d;
      }
      if (r.skill > 0.35 && d > 120 && s.now >= r.boostReadyAt && s.rng() < 0.012 + r.skill * 0.01) wantBoost = true;
    } else if (input) {
      if (input.holding && input.aim) {
        const dx = input.aim.x - r.x;
        const dy = input.aim.y - r.y;
        const d = len(dx, dy);
        if (d > 10) {
          mx = dx / d;
          my = dy / d;
        }
      } else {
        const d = len(input.keys.x, input.keys.y);
        if (d > 0.01) {
          mx = input.keys.x / Math.max(1, d);
          my = input.keys.y / Math.max(1, d);
        }
      }
      if (input.action || input.tap) wantBoost = true;
    }
    if (wantBoost) startBoost(s, r, mx, my);

    const boosting = s.now < r.boostUntil;
    const max = speedFor(r, boosting);
    if (!stunned) {
      r.vx += mx * GEMS.walkAccel * dt;
      r.vy += my * GEMS.walkAccel * dt;
    }
    const fric = Math.exp(-(mx || my ? GEMS.friction * 0.55 : GEMS.friction * 1.6) * dt);
    r.vx *= fric;
    r.vy *= fric;
    const sp = len(r.vx, r.vy);
    const cap = boosting ? GEMS.boostSpeed : max;
    if (sp > cap) {
      r.vx = (r.vx / sp) * cap;
      r.vy = (r.vy / sp) * cap;
    }
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    const lim = GEMS.half - GEMS.body;
    r.x = Math.max(-lim, Math.min(lim, r.x));
    r.y = Math.max(-lim, Math.min(lim, r.y));
    if (Math.abs(r.vx) > 20) r.facing = r.vx > 0 ? 1 : -1;
  }

  // Dashing into a rival spills their load.
  for (const r of s.runners) {
    if (s.now >= r.boostUntil) continue;
    for (const o of s.runners) {
      if (o === r || s.now < o.invulnUntil) continue;
      if (len(o.x - r.x, o.y - r.y) > GEMS.body * 2 + 6) continue;
      const lost = Math.floor(o.carry * GEMS.stealShare);
      o.invulnUntil = s.now + GEMS.victimInvulnMs;
      o.stunUntil = s.now + 420;
      const a = Math.atan2(o.y - r.y, o.x - r.x);
      o.vx += Math.cos(a) * 520;
      o.vy += Math.sin(a) * 520;
      if (lost > 0) {
        o.carry -= lost;
        spill(s, o, lost, r);
        r.steals += lost;
      }
      s.events.push({ type: 'steal', from: o.index, to: r.index, amount: lost, x: o.x, y: o.y });
    }
  }

  // Gems: drift, get pulled in, get collected.
  for (let gi = s.gems.length - 1; gi >= 0; gi--) {
    const g = s.gems[gi];
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.vx *= Math.exp(-3.2 * dt);
    g.vy *= Math.exp(-3.2 * dt);
    const lim = GEMS.half - 10;
    if (Math.abs(g.x) > lim) { g.x = Math.sign(g.x) * lim; g.vx *= -0.5; }
    if (Math.abs(g.y) > lim) { g.y = Math.sign(g.y) * lim; g.vy *= -0.5; }
    let taken = false;
    for (const r of s.runners) {
      if (s.now < r.stunUntil) continue;
      const d = len(g.x - r.x, g.y - r.y);
      if (g.kind === 'bomb') {
        if (d < GEMS.pickRadius) {
          const lost = Math.ceil(r.carry * 0.5);
          r.carry -= lost;
          r.stunUntil = s.now + GEMS.stunMs;
          if (lost > 0) spill(s, r, lost);
          s.events.push({ type: 'bomb', index: r.index, lost, x: g.x, y: g.y });
          // The blast knocks neighbours too.
          for (const o of s.runners) {
            if (o === r) continue;
            const od = len(o.x - g.x, o.y - g.y);
            if (od < GEMS.bombRadius) {
              const a = Math.atan2(o.y - g.y, o.x - g.x);
              o.vx += Math.cos(a) * 480;
              o.vy += Math.sin(a) * 480;
            }
          }
          taken = true;
          break;
        }
        continue;
      }
      if (d < vacRadius(r, s.now) && r.carry < GEMS.carryCap) {
        const pull = GEMS.vacPull * (1 - d / (vacRadius(r, s.now) + 20)) + 120;
        g.vx += ((r.x - g.x) / Math.max(d, 1)) * pull * dt * 6;
        g.vy += ((r.y - g.y) / Math.max(d, 1)) * pull * dt * 6;
      }
      if (d < GEMS.pickRadius && r.carry < GEMS.carryCap) {
        r.carry = Math.min(GEMS.carryCap, r.carry + (g.kind === 'gold' ? 3 : 1));
        s.events.push({ type: 'pick', index: r.index, kind: g.kind, x: g.x, y: g.y });
        taken = true;
        break;
      }
    }
    if (taken) s.gems.splice(gi, 1);
  }

  // Banking on your own pad.
  for (const r of s.runners) {
    if (r.carry <= 0 || s.now < r.stunUntil) continue;
    const p = padCenter(r.index);
    if (len(r.x - p.x, r.y - p.y) < GEMS.padRadius) {
      r.banked += r.carry;
      s.events.push({ type: 'bank', index: r.index, amount: r.carry, x: p.x, y: p.y });
      r.carry = 0;
    }
  }

  if (s.now >= s.durationMs) s.over = true;
}

export function gemResults(s: GemState): MinigameResult[] {
  return [...s.runners]
    .sort((a, b) => b.banked - a.banked || b.steals - a.steals || a.index - b.index)
    .map((r, i) => ({ index: r.index, characterId: r.characterId, placement: i + 1, banked: r.banked }));
}
