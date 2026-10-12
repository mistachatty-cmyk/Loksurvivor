/**
 * Pure rules for how rescued crew (and cameo NPCs) live on the hideout strip:
 * they stand about, pace, fiddle with things, wander over to a prop, stop to
 * talk with each other, greet you when you walk up, and react when you use
 * something nearby. No canvas, no React, no clock -- callers pass `dt`/`now`
 * (strip milliseconds) and an injected `rng`, same convention as
 * `hideoutPets.ts`.
 *
 * Personality is the whole point: `CrewTemperament` (data/crewTemperaments.ts)
 * sets how fast and how bouncy someone walks, how far they stray, how soon they
 * get up to something, and whether they seek you out, keep their distance, or
 * would rather work with their hands. The same rules therefore read as a brisk
 * shopkeeper, a slow bell-keeper, a runner who cannot stand still.
 *
 * Everything here is cosmetic: nothing in this file touches the save, and crew
 * never claim rewards -- only the player's own operator does (see
 * `.agents/memory/hideout-interactables.md`).
 */

import { DEFAULT_CREW_TEMPERAMENT, type CrewTemperament } from '@/game/data/crewTemperaments';
import type { HideoutEmote } from '@/game/data/hideoutEvents';

export type CrewBehavior =
  | 'stand'
  | 'pace'
  | 'tinker'
  | 'lookout'
  | 'visit'
  | 'approach'
  | 'retreat'
  | 'chat'
  | 'chatWait'
  | 'talk'
  | 'dance'
  | 'react';

export interface CrewActor {
  id: string;
  t: CrewTemperament;
  /** Along the walking range, 0..1; the actor's own spot. */
  homeFrac: number;
  homeX: number;
  x: number;
  facing: 1 | -1;
  behavior: CrewBehavior;
  targetX: number;
  /** Strip time the current behavior ends (for timed ones). */
  until: number;
  /** Strip time the next idea may start. */
  nextAt: number;
  moving: boolean;
  /** Walk-pace bookkeeping. */
  legs: number;
  returning: boolean;
  pauseUntil: number;
  /** Conversation bookkeeping. */
  partner: string | null;
  exchange: number;
  exchangeTotal: number;
  speakAt: number;
  /** What they are doing at a prop, if anything. */
  visitProp: { id: string; art: string; x: number } | null;
  usingProp: boolean;
  bubble: { text: string; born: number; until: number } | null;
  emote: { glyph: HideoutEmote; born: number; until: number } | null;
  emoteAt: number;
  hopUntil: number;
  lastGreetAt: number;
  /** Which side to flip to while tinkering, so it reads as busywork, not a freeze. */
  flipAt: number;
}

export interface CrewProp {
  id: string;
  x: number;
  art: string;
}

export type CrewEvent =
  | { kind: 'say'; id: string; line: string; ms: number }
  | { kind: 'visit'; id: string; propId: string };

export interface CrewStepInput {
  now: number;
  dt: number;
  range: { min: number; max: number };
  operatorX: number;
  /** Non-crew props in the room, for visits. */
  props: ReadonlyArray<CrewProp>;
  rng: () => number;
  /** A line for this crew member to say; undefined means "emote only". */
  speak?: (id: string) => string | undefined;
  /**
   * Something the player did is being said right now (a crew member they tapped, or a note about a
   * prop): crew chatter waits so two speech bubbles never talk over each other.
   */
  quiet?: boolean;
  /** Reduced motion: nobody walks or acts on their own; speech and emotes still run their course. */
  still?: boolean;
}

const MIN_GAP = 40;
const CHAT_GAP = 46;
const GREET_PX = 95;
const GREET_COOLDOWN_MS = 50_000;
const ARRIVED_PX = 1.5;
const PROP_STAND_PX = 24;
const MAX_LINE_CHARS = 96;
/** Length of every little hop (greeting, speaking, a bell ringing). */
const HOP_MS = 500;

const between = (rng: () => number, lo: number, hi: number): number => lo + (hi - lo) * rng();
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** What each kind of prop makes a visiting crew member do. */
const PROP_VISIT: Record<string, { emote: HideoutEmote; ms: [number, number]; sit?: boolean }> = {
  lamp: { emote: 'spark', ms: [2500, 4200] },
  crate: { emote: 'spark', ms: [2800, 4600] },
  bell: { emote: 'note', ms: [1800, 2800] },
  scope: { emote: 'bang', ms: [3000, 5000] },
  jar: { emote: 'star', ms: [2500, 4000] },
  stash: { emote: 'star', ms: [2500, 4000] },
  seat: { emote: 'zzz', ms: [4500, 8000], sit: true },
  jukebox: { emote: 'note', ms: [4000, 7000] },
  cat: { emote: 'adore', ms: [3000, 5200] },
  door: { emote: 'bang', ms: [2200, 3600] },
};

export function createCrewActor(id: string, t: CrewTemperament | undefined, homeFrac: number, range: { min: number; max: number }, now: number, rng: () => number): CrewActor {
  const homeX = range.min + homeFrac * (range.max - range.min);
  return {
    id,
    t: t ?? DEFAULT_CREW_TEMPERAMENT,
    homeFrac,
    homeX,
    x: homeX,
    facing: rng() < 0.5 ? 1 : -1,
    behavior: 'stand',
    targetX: homeX,
    until: 0,
    // Staggered so a room does not set off all at once.
    nextAt: now + between(rng, 300, 3500),
    moving: false,
    legs: 0,
    returning: false,
    pauseUntil: 0,
    partner: null,
    exchange: 0,
    exchangeTotal: 0,
    speakAt: 0,
    visitProp: null,
    usingProp: false,
    bubble: null,
    emote: null,
    emoteAt: 0,
    hopUntil: 0,
    lastGreetAt: Number.NEGATIVE_INFINITY,
    flipAt: 0,
  };
}

/**
 * Keep the actor list in step with the crew standing in this room, and with
 * the strip's width (a resize rescales positions instead of teleporting them).
 */
export function syncCrew(
  actors: Map<string, CrewActor>,
  wanted: ReadonlyArray<{ id: string; homeFrac: number; t?: CrewTemperament }>,
  range: { min: number; max: number },
  now: number,
  rng: () => number,
  previousRange: { min: number; max: number } | null,
): void {
  for (const w of wanted) {
    const existing = actors.get(w.id);
    if (!existing) actors.set(w.id, createCrewActor(w.id, w.t, w.homeFrac, range, now, rng));
    else {
      existing.homeFrac = w.homeFrac;
      existing.t = w.t ?? existing.t;
    }
  }
  for (const id of [...actors.keys()]) if (!wanted.some((w) => w.id === id)) actors.delete(id);
  const widthBefore = previousRange ? previousRange.max - previousRange.min : 0;
  const rescale = previousRange !== null && widthBefore > 0 && (previousRange.min !== range.min || previousRange.max !== range.max);
  for (const a of actors.values()) {
    a.homeX = range.min + a.homeFrac * (range.max - range.min);
    if (rescale) {
      const k = (range.max - range.min) / widthBefore;
      a.x = range.min + (a.x - previousRange!.min) * k;
      a.targetX = range.min + (a.targetX - previousRange!.min) * k;
    }
  }
}

function setEmote(a: CrewActor, glyph: HideoutEmote, now: number, ms: number): void {
  a.emote = { glyph, born: now, until: now + ms };
}

function faceToward(a: CrewActor, x: number): void {
  if (Math.abs(x - a.x) > 2) a.facing = x > a.x ? 1 : -1;
}

/** Walk one frame toward `target`. Returns true once there. */
function stepToward(a: CrewActor, target: number, speed: number, dt: number): boolean {
  const delta = target - a.x;
  if (Math.abs(delta) <= ARRIVED_PX) {
    a.x = target;
    a.moving = false;
    return true;
  }
  const step = Math.min(Math.abs(delta), speed * dt);
  a.x += Math.sign(delta) * step;
  a.facing = delta > 0 ? 1 : -1;
  a.moving = true;
  return false;
}

function goHome(a: CrewActor): void {
  a.behavior = 'pace';
  a.legs = 0;
  a.returning = true;
  a.targetX = a.homeX;
  a.pauseUntil = 0;
}

function becomeIdle(a: CrewActor, now: number, rng: () => number, quick = false): void {
  a.behavior = 'stand';
  a.moving = false;
  a.partner = null;
  a.visitProp = null;
  a.usingProp = false;
  a.returning = false;
  // Restless people get up to something again sooner.
  a.nextAt = now + between(rng, quick ? 600 : 1500, quick ? 1600 : 4800) * (1.7 - a.t.restless);
}

function endChat(a: CrewActor, other: CrewActor | undefined, now: number, rng: () => number): void {
  for (const x of [a, other]) {
    if (!x) continue;
    x.partner = null;
    x.exchange = 0;
    if (Math.abs(x.x - x.homeX) > 6) goHome(x);
    else becomeIdle(x, now, rng);
    x.nextAt = now + between(rng, 7000, 14000) * (1.7 - x.t.social);
  }
}

function bubbleMs(text: string): number {
  return clamp(1700 + text.length * 48, 2400, 6200);
}

function pickWeighted<T>(entries: ReadonlyArray<readonly [T, number]>, rng: () => number): T | null {
  let total = 0;
  for (const [, w] of entries) total += Math.max(0, w);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const [value, w] of entries) {
    roll -= Math.max(0, w);
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

type Idea = 'pace' | 'tinker' | 'lookout' | 'visit' | 'chat' | 'stand';

function decide(a: CrewActor, actors: ReadonlyArray<CrewActor>, input: CrewStepInput): void {
  const { now, rng, range, props } = input;
  const t = a.t;
  const rangeW = range.max - range.min;
  const partners = actors.filter((o) => o !== a && o.behavior === 'stand' && Math.abs(o.x - a.x) < rangeW * 0.75);
  const near = props.filter((p) => Math.abs(p.x - a.homeX) <= t.roam * 2.4 + 40);
  const idea = pickWeighted<Idea>([
    ['pace', 0.2 + t.restless * 0.9],
    ['tinker', t.busy * 0.9],
    ['lookout', 0.25 + (1 - t.restless) * 0.25],
    ['visit', near.length > 0 ? t.curious * 0.85 : 0],
    ['chat', partners.length > 0 ? t.social * 1.15 : 0],
    ['stand', 0.15 + (1 - t.restless) * 0.5],
  ], rng) ?? 'stand';

  switch (idea) {
    case 'pace': {
      a.behavior = 'pace';
      a.legs = 1 + Math.floor(rng() * 2);
      a.returning = false;
      const side = rng() < 0.5 ? -1 : 1;
      a.targetX = clamp(a.homeX + side * t.roam * between(rng, 0.45, 1), range.min, range.max);
      a.pauseUntil = 0;
      break;
    }
    case 'tinker':
      a.behavior = 'tinker';
      a.until = now + between(rng, 2600, 5200);
      a.emoteAt = now + between(rng, 500, 1100);
      a.flipAt = now + between(rng, 900, 1700);
      a.moving = false;
      break;
    case 'lookout':
      a.behavior = 'lookout';
      a.until = now + between(rng, 3200, 5200);
      a.flipAt = now + between(rng, 1200, 2000);
      a.moving = false;
      break;
    case 'visit': {
      const prop = near[Math.min(near.length - 1, Math.floor(rng() * near.length))]!;
      a.behavior = 'visit';
      a.visitProp = { id: prop.id, art: prop.art, x: prop.x };
      a.usingProp = false;
      const side = a.x <= prop.x ? -1 : 1;
      a.targetX = clamp(prop.x + side * PROP_STAND_PX, range.min, range.max);
      break;
    }
    case 'chat': {
      const partner = partners.reduce((best, o) => (Math.abs(o.x - a.x) < Math.abs(best.x - a.x) ? o : best));
      const side = a.x <= partner.x ? -1 : 1;
      a.behavior = 'chat';
      a.partner = partner.id;
      a.exchange = 0;
      a.exchangeTotal = 2 + (rng() < 0.5 ? 1 : 0);
      a.speakAt = 0;
      a.targetX = clamp(partner.x + side * CHAT_GAP, range.min, range.max);
      partner.behavior = 'chatWait';
      partner.partner = a.id;
      partner.moving = false;
      partner.exchange = 0;
      break;
    }
    default:
      becomeIdle(a, now, rng);
  }
}

function greet(a: CrewActor, input: CrewStepInput): void {
  const { now, rng, operatorX, range } = input;
  a.lastGreetAt = now;
  const t = a.t;
  const away = a.x <= operatorX ? -1 : 1;
  if (rng() < t.shy && t.shy > 0.45) {
    a.behavior = 'retreat';
    a.targetX = clamp(a.x + away * between(rng, 50, 90), range.min, range.max);
    setEmote(a, 'drop', now, 1600);
    return;
  }
  if (rng() < t.curious && t.curious > 0.5) {
    a.behavior = 'approach';
    a.until = now + 5500;
    a.targetX = clamp(operatorX - away * 38, range.min, range.max);
    setEmote(a, 'bang', now, 1300);
    a.hopUntil = now + HOP_MS;
    return;
  }
  faceToward(a, operatorX);
  if (rng() < t.social && t.social > 0.35) {
    setEmote(a, 'note', now, 1500);
    a.hopUntil = now + HOP_MS;
  }
}

/** Advance every crew member one frame. Mutates actors; pushes any `say`/`visit` events. */
export function stepCrew(actors: ReadonlyArray<CrewActor>, input: CrewStepInput, events: CrewEvent[]): void {
  const { now, dt, range, operatorX, rng } = input;
  const byId = new Map(actors.map((a) => [a.id, a] as const));

  for (const a of actors) {
    if (a.bubble && now >= a.bubble.until) a.bubble = null;
    if (a.emote && now >= a.emote.until) a.emote = null;
    a.moving = false;
    const t = a.t;
    if (input.still) {
      if (a.behavior === 'talk' && now >= a.until) becomeIdle(a, now, rng, true);
      if (a.behavior === 'dance' || a.behavior === 'react') { if (now >= a.until) becomeIdle(a, now, rng, true); }
      continue;
    }
    const interruptible = a.behavior === 'stand' || a.behavior === 'pace' || a.behavior === 'tinker' || a.behavior === 'lookout' || a.behavior === 'visit';
    if (interruptible && Math.abs(operatorX - a.x) < GREET_PX && now - a.lastGreetAt > GREET_COOLDOWN_MS) greet(a, input);

    switch (a.behavior) {
      case 'stand':
        // Idle people turn to whoever is near.
        if (Math.abs(operatorX - a.x) < 220) faceToward(a, operatorX);
        if (now >= a.nextAt) decide(a, actors, input);
        break;

      case 'pace': {
        if (now < a.pauseUntil) break;
        if (stepToward(a, a.targetX, t.speed, dt)) {
          if (a.returning) {
            becomeIdle(a, now, rng);
          } else if (a.legs > 0) {
            a.legs -= 1;
            a.pauseUntil = now + between(rng, 350, 1200);
            const side = a.targetX >= a.homeX ? -1 : 1;
            a.targetX = clamp(a.homeX + side * t.roam * between(rng, 0.3, 0.9), range.min, range.max);
          } else {
            a.returning = true;
            a.targetX = a.homeX;
            a.pauseUntil = now + between(rng, 300, 900);
          }
        }
        break;
      }

      case 'tinker':
        if (now >= a.flipAt) {
          a.facing = a.facing === 1 ? -1 : 1;
          a.flipAt = now + between(rng, 900, 1900);
        }
        if (now >= a.emoteAt) {
          setEmote(a, 'spark', now, 700);
          a.emoteAt = now + between(rng, 1100, 2000);
        }
        if (now >= a.until) becomeIdle(a, now, rng);
        break;

      case 'lookout':
        if (now >= a.flipAt) {
          a.facing = a.facing === 1 ? -1 : 1;
          a.flipAt = now + between(rng, 1400, 2400);
        }
        if (now >= a.until) becomeIdle(a, now, rng);
        break;

      case 'visit': {
        const v = a.visitProp;
        if (!v) { becomeIdle(a, now, rng); break; }
        if (!a.usingProp) {
          if (stepToward(a, a.targetX, t.speed, dt)) {
            const spec = PROP_VISIT[v.art] ?? { emote: 'star' as HideoutEmote, ms: [2200, 3600] as [number, number] };
            a.usingProp = true;
            a.until = now + between(rng, spec.ms[0], spec.ms[1]);
            faceToward(a, v.x);
            setEmote(a, spec.emote, now, Math.min(2200, a.until - now));
            events.push({ kind: 'visit', id: a.id, propId: v.id });
          }
        } else if (now >= a.until) {
          goHome(a);
        }
        break;
      }

      case 'approach':
        if (stepToward(a, a.targetX, t.speed * 1.1, dt)) {
          faceToward(a, operatorX);
          if (now >= a.until || Math.abs(operatorX - a.x) > 150) goHome(a);
        } else if (now >= a.until) {
          goHome(a);
        }
        break;

      case 'retreat':
        if (stepToward(a, a.targetX, t.speed * 1.35, dt)) becomeIdle(a, now, rng, true);
        break;

      case 'chat': {
        const partner = a.partner ? byId.get(a.partner) : undefined;
        if (!partner || partner.behavior !== 'chatWait') { endChat(a, undefined, now, rng); break; }
        if (a.speakAt === 0) {
          // Still walking over. Never walks past the other person.
          if (stepToward(a, a.targetX, t.speed, dt)) {
            faceToward(a, partner.x);
            faceToward(partner, a.x);
            a.speakAt = now + 350;
          }
          break;
        }
        faceToward(a, partner.x);
        faceToward(partner, a.x);
        if (now >= a.speakAt && input.quiet) {
          a.speakAt = now + 400;
        } else if (now >= a.speakAt) {
          const speaker = a.exchange % 2 === 0 ? a : partner;
          let line = input.speak?.(speaker.id);
          if (line && line.length > MAX_LINE_CHARS) line = undefined;
          const ms = line ? bubbleMs(line) : 1500;
          if (line) {
            speaker.bubble = { text: line, born: now, until: now + ms };
            events.push({ kind: 'say', id: speaker.id, line, ms });
          } else {
            setEmote(speaker, rng() < 0.5 ? 'laugh' : 'note', now, 1300);
          }
          speaker.hopUntil = now + HOP_MS;
          a.exchange += 1;
          a.speakAt = now + ms + 300;
          if (a.exchange >= a.exchangeTotal) a.until = a.speakAt;
        }
        if (a.exchange >= a.exchangeTotal && now >= a.until) endChat(a, partner, now, rng);
        break;
      }

      case 'chatWait': {
        const other = a.partner ? byId.get(a.partner) : undefined;
        if (!other || other.behavior !== 'chat' || other.partner !== a.id) becomeIdle(a, now, rng);
        break;
      }

      case 'talk':
        if (now >= a.until) becomeIdle(a, now, rng, true);
        break;

      case 'dance':
      case 'react':
        if (now >= a.until) becomeIdle(a, now, rng, true);
        break;
    }
    a.x = clamp(a.x, range.min, range.max);
  }

  // Nobody walks through anybody (talking partners stand at their own gap).
  for (let i = 0; i < actors.length; i += 1) {
    for (let j = i + 1; j < actors.length; j += 1) {
      const p = actors[i]!;
      const q = actors[j]!;
      if (p.partner === q.id || q.partner === p.id) continue;
      const gap = Math.abs(q.x - p.x);
      if (gap >= MIN_GAP) continue;
      const push = (MIN_GAP - gap) / 2;
      const dir = q.x === p.x ? (i < j ? 1 : -1) : Math.sign(q.x - p.x);
      p.x = clamp(p.x - dir * push, range.min, range.max);
      q.x = clamp(q.x + dir * push, range.min, range.max);
    }
  }
}

/** The player tapped this crew member: stop, turn to them, and hold the conversation. */
export function talkTo(a: CrewActor, actors: ReadonlyArray<CrewActor>, line: string, now: number, operatorX: number, rng: () => number): number {
  if (a.partner) {
    const other = actors.find((o) => o.id === a.partner);
    if (other) { other.partner = null; becomeIdle(other, now, rng, true); }
  }
  const ms = bubbleMs(line);
  a.behavior = 'talk';
  a.partner = null;
  a.visitProp = null;
  a.usingProp = false;
  a.moving = false;
  a.until = now + ms + 200;
  a.bubble = { text: line, born: now, until: now + ms };
  a.hopUntil = now + HOP_MS;
  a.lastGreetAt = now;
  faceToward(a, operatorX);
  return ms;
}

/** The operator used a prop: crew within earshot look over, and a jukebox gets them dancing. */
export function reactToProp(actors: ReadonlyArray<CrewActor>, prop: { x: number; art: string }, now: number, rng: () => number, reach: number): void {
  for (const a of actors) {
    if (a.behavior === 'chat' || a.behavior === 'chatWait' || a.behavior === 'talk') continue;
    if (Math.abs(a.x - prop.x) > reach) continue;
    faceToward(a, prop.x);
    a.moving = false;
    a.visitProp = null;
    a.usingProp = false;
    if (prop.art === 'jukebox') {
      // The shy ones stay put; everyone else gets down to it.
      if (rng() < a.t.shy * 0.8) { setEmote(a, 'drop', now, 1400); a.behavior = 'react'; a.until = now + 1400; continue; }
      a.behavior = 'dance';
      a.until = now + between(rng, 6500, 9500);
      setEmote(a, 'note', now, 2200);
    } else {
      a.behavior = 'react';
      a.until = now + between(rng, 1100, 1900);
      setEmote(a, prop.art === 'bell' ? 'bang' : prop.art === 'lamp' ? 'spark' : 'star', now, 1300);
      if (prop.art === 'bell') a.hopUntil = now + HOP_MS;
    }
  }
}

export interface CrewPose {
  anim: 'idle' | 'walk';
  /** Pixels off the ground. */
  lift: number;
  scaleX: number;
  scaleY: number;
}

/** Draw-time posture from what the actor is doing: gait, working, dancing, nodding, hopping. */
export function crewPose(a: CrewActor, now: number, reduceMotion: boolean): CrewPose {
  if (reduceMotion) return { anim: 'idle', lift: 0, scaleX: 1, scaleY: 1 };
  const t = a.t;
  let lift = 0;
  let scaleX = 1;
  let scaleY = 1;
  let anim: 'idle' | 'walk' = 'idle';

  if (a.moving) {
    anim = 'walk';
    lift = Math.abs(Math.sin(now * t.cadence)) * t.bounce;
    scaleY = 1 + Math.sin(now * t.cadence * 2) * 0.012 * t.bounce;
  } else if (a.behavior === 'tinker' || (a.behavior === 'visit' && a.usingProp)) {
    // Working with their hands: quick small bobs and a lean.
    lift = Math.abs(Math.sin(now / 120)) * 1.6;
    scaleX = 1 + Math.sin(now / 150) * 0.035;
  } else if (a.behavior === 'dance') {
    lift = Math.abs(Math.sin(now / 190)) * (3 + t.bounce);
    scaleX = 1 + Math.sin(now / 190) * 0.06;
    scaleY = 1 - Math.sin(now / 190) * 0.03;
  } else if (a.bubble) {
    // Talking: a small nod on the beat of the words.
    lift = Math.abs(Math.sin(now / 140)) * 1.2;
  }
  if (a.visitProp && a.usingProp && PROP_VISIT[a.visitProp.art]?.sit) {
    lift = -2;
    scaleY = 0.88;
  }
  if (now < a.hopUntil) {
    const p = 1 - (a.hopUntil - now) / HOP_MS;
    lift += Math.sin(clamp(p, 0, 1) * Math.PI) * 8;
  }
  return { anim, lift, scaleX, scaleY };
}
