/**
 * LOK Chat rules: understand a typed message, answer in the speaker's own voice, and
 * remember how well you two know each other. Pure and seeded (no `Math.random`, no
 * clock, no network): given the same message, context and rng it always answers the
 * same, so it is testable and costs nothing to run (docs/LOK_COST_DISCIPLINE.md: no LLM
 * in the loop at runtime).
 *
 * Understanding is keyword intent matching (`INTENT_RULES`), not a model. Replies are
 * assembled from authored content (`data/lokChatData.ts`) plus the crew voice records
 * (`data/crewVoices.ts`) and live facts: the room, the weather, the time of day, who is
 * nearby, how your last run went and your companion's name. A reply never echoes what
 * the player typed, so nothing a player writes can come back out of the game.
 */

import {
  CONFIDE_DEFLECTIONS,
  CREW_CONFIDES,
  CREW_FALLBACKS,
  CREW_RELATIONS,
  INTENT_RULES,
  INTENT_TEMPLATES,
  PROACTIVE_LINES,
  RUN_LINES,
  TIME_WORDS,
  type ChatIntent,
  type TemplatedIntent,
} from '@/game/data/lokChatData';
import { CREW_VOICES, FALLBACK_VOICE, SHARED_POOLS } from '@/game/data/crewVoices';
import { expandTemplate, generateCrewLine, type Pools, type Tone } from '@/game/engine/crewTalk';
import type { HideoutWeather } from '@/game/types';

export type { ChatIntent } from '@/game/data/lokChatData';

/* ------------------------------------------------------------------ */
/* Relationship                                                        */
/* ------------------------------------------------------------------ */

export type AffinityTier = 'new' | 'friend' | 'close';

/** Points needed for each step; talking to someone is how you earn them. */
export const AFFINITY_THRESHOLDS = { friend: 12, close: 40 } as const;
export const AFFINITY_MAX = 100;

export function affinityTier(points: number): AffinityTier {
  if (points >= AFFINITY_THRESHOLDS.close) return 'close';
  if (points >= AFFINITY_THRESHOLDS.friend) return 'friend';
  return 'new';
}

/** Something new to say to them earns more than repeating yourself; nonsense earns nothing. */
export function affinityGain(intent: ChatIntent, timesAskedBefore: number): number {
  if (intent === 'unknown') return 0;
  if (timesAskedBefore === 0) return intent === 'confide' ? 5 : 3;
  return timesAskedBefore < 4 ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* Understanding                                                       */
/* ------------------------------------------------------------------ */

export interface ChatPerson {
  id: string;
  name: string;
  role: string;
}

export interface DetectedIntent {
  intent: ChatIntent;
  subject?: ChatPerson;
}

export const MAX_MESSAGE_CHARS = 200;

const normalize = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE_CHARS);

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Which other crew member the message mentions, by full name, first name or id. */
export function findSubject(text: string, others: readonly ChatPerson[]): ChatPerson | undefined {
  const flat = normalize(text);
  let best: { person: ChatPerson; at: number } | undefined;
  for (const person of others) {
    const names = new Set([person.name.toLowerCase(), person.name.toLowerCase().split(' ')[0]!, person.id.toLowerCase().replace(/-/g, ' ')]);
    for (const name of names) {
      if (name.length < 3) continue;
      const m = new RegExp(`\\b${escapeRe(name)}\\b`).exec(flat);
      if (m && (!best || m.index < best.at)) best = { person, at: m.index };
    }
  }
  return best?.person;
}

/** Stronger intents that win over "you mentioned somebody". */
const OVERRIDES_SUBJECT: ReadonlySet<ChatIntent> = new Set(['bye', 'thanks', 'confide', 'joke', 'run', 'pet', 'weather']);

export function detectIntent(text: string, others: readonly ChatPerson[] = []): DetectedIntent {
  const flat = normalize(text);
  if (!flat) return { intent: 'unknown' };
  let intent: ChatIntent = 'unknown';
  for (const [candidate, pattern] of INTENT_RULES) {
    if (pattern.test(flat)) { intent = candidate; break; }
  }
  const subject = findSubject(flat, others);
  if (subject && !OVERRIDES_SUBJECT.has(intent)) return { intent: 'crew', subject };
  return { intent, subject };
}

/* ------------------------------------------------------------------ */
/* Replying                                                            */
/* ------------------------------------------------------------------ */

export interface ChatContext {
  self: ChatPerson;
  /** Other rescued crew, for "what about Vee?". */
  others: readonly ChatPerson[];
  roomName: string;
  /** Names of crew standing in the speaker's room, not counting them. */
  crewHere: readonly string[];
  weather: HideoutWeather;
  /** Local hour, 0-23. */
  hour: number;
  lastRun?: { cleared: boolean; kills: number; areaName: string };
  petName?: string;
  tone: Tone;
  /** Affinity points with this person. */
  affinity: number;
}

export interface ChatReply {
  text: string;
  intent: ChatIntent;
  subjectId?: string;
}

const WEATHER_STATE: Record<HideoutWeather, string[]> = {
  clear: ['clear', 'dry', 'calm'],
  rain: ['raining', 'wet', 'pouring'],
  fog: ['foggy', 'thick with fog'],
  snow: ['snowing', 'cold and white'],
  heat: ['hot', 'sticky'],
};

const MOODS = ['tired', 'hopeful', 'stubborn', 'restless', 'fine', 'a little proud of everyone', 'a little worn out', 'steady'];

export function timeBucket(hour: number): keyof typeof TIME_WORDS {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function poolsFor(ctx: ChatContext, ownPool: readonly string[], subject?: ChatPerson): Pools {
  const run = ctx.lastRun;
  return {
    ...SHARED_POOLS,
    mood: MOODS,
    name: [ctx.self.name],
    role: [ctx.self.role.toLowerCase()],
    room: [ctx.roomName],
    weather: WEATHER_STATE[ctx.weather],
    crew: ctx.crewHere.length > 0 ? [...ctx.crewHere] : ['everybody'],
    pet: [ctx.petName ?? 'your pet'],
    area: [run?.areaName ?? 'last run'],
    time: TIME_WORDS[timeBucket(ctx.hour)],
    own: ownPool.length > 0 ? ownPool : ['the work'],
    subject: [subject?.name ?? 'them'],
    subjectRole: [(subject?.role ?? 'someone').toLowerCase()],
  };
}

const pickFrom = <T>(items: readonly T[], rng: () => number): T => items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;

/** Lines for once you know each other: warmer greetings. */
const FRIEND_GREETINGS: Record<Tone, string[]> = {
  family: ['{Hey, you!|There you are.|Good to hear from you.} {You know you can message me any time.|I was hoping it would be you.}'],
  wry: ['{Oh, it is you.|You again. Good.} {I was about to get lonely, which is unacceptable.|Say something. I have a bet going.}'],
};
const CLOSE_FLOURISH = ['{You know where to find me.|Glad it is you.|Always.}'];

function templateFor(intent: TemplatedIntent, tone: Tone, tier: AffinityTier, rng: () => number): string {
  if (intent === 'greet' && tier !== 'new' && rng() < 0.6) return pickFrom(FRIEND_GREETINGS[tone], rng);
  const list = INTENT_TEMPLATES[intent][tone];
  return pickFrom(list.length > 0 ? list : INTENT_TEMPLATES[intent].family, rng);
}

function sentence(template: string, ctx: ChatContext, pools: Pools, rng: () => number): string {
  return expandTemplate(template, { tone: ctx.tone, pools }, rng);
}

function runLine(ctx: ChatContext, pools: Pools, rng: () => number): string {
  const kind = !ctx.lastRun ? 'none' : ctx.lastRun.cleared ? 'cleared' : 'fell';
  return sentence(pickFrom(RUN_LINES[kind][ctx.tone], rng), ctx, pools, rng);
}

function crewLine(ctx: ChatContext, subject: ChatPerson | undefined, pools: Pools, rng: () => number): string {
  if (!subject) return sentence('{Who do you mean?|Which one?|Ask me about someone by name.}', ctx, pools, rng);
  if (subject.id === ctx.self.id) return sentence('{That is me. Ask something else.|You are talking to them.}', ctx, pools, rng);
  const authored = CREW_RELATIONS[ctx.self.id]?.[subject.id];
  if (authored) return authored;
  return sentence(pickFrom(CREW_FALLBACKS[ctx.tone], rng), ctx, pools, rng);
}

function oneReply(intent: ChatIntent, subject: ChatPerson | undefined, ctx: ChatContext, rng: () => number, recent: readonly string[]): string {
  const voice = CREW_VOICES[ctx.self.id] ?? FALLBACK_VOICE;
  const pools = poolsFor(ctx, voice.own, subject);
  const tier = affinityTier(ctx.affinity);
  let text: string;
  switch (intent) {
    case 'crew':
      text = crewLine(ctx, subject, pools, rng);
      break;
    case 'run':
      text = runLine(ctx, pools, rng);
      break;
    case 'pet':
      text = ctx.petName
        ? sentence(templateFor('pet', ctx.tone, tier, rng), ctx, pools, rng)
        : sentence('{No LokPet with you? Get one. The place is livelier with something small underfoot.|You should find a LokPet. I would.}', ctx, pools, rng);
      break;
    case 'joke': {
      const jokes = voice.wry.length > 0 ? voice.wry : voice.topics;
      text = sentence(pickFrom(jokes, rng), ctx, pools, rng);
      break;
    }
    case 'story':
      text = generateCrewLine(voice, { tone: ctx.tone, pools }, rng, recent);
      break;
    case 'confide': {
      if (tier === 'new') text = pickFrom(CONFIDE_DEFLECTIONS, rng);
      else {
        const lines = CREW_CONFIDES[ctx.self.id];
        text = lines && lines.length > 0 ? pickFrom(lines, rng) : sentence('{I do not say this often.|Between us:} the work keeps me honest, and you keep it worth doing.', ctx, pools, rng);
      }
      break;
    }
    case 'unknown': {
      const base = sentence(templateFor('unknown', ctx.tone, tier, rng), ctx, pools, rng);
      text = rng() < 0.4 ? `${sentence(pickFrom(voice.openers, rng), ctx, pools, rng)} ${base}` : base;
      break;
    }
    default:
      text = sentence(templateFor(intent, ctx.tone, tier, rng), ctx, pools, rng);
  }
  if (tier === 'close' && intent !== 'unknown' && intent !== 'confide' && rng() < 0.25) {
    text = `${text} ${sentence(pickFrom(CLOSE_FLOURISH, rng), ctx, pools, rng)}`;
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** Answer one intent. Re-rolls to avoid repeating anything in `recent`. */
export function replyToIntent(detected: DetectedIntent, ctx: ChatContext, rng: () => number, recent: readonly string[] = []): ChatReply {
  let text = '';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    text = oneReply(detected.intent, detected.subject, ctx, rng, recent);
    if (text && !recent.includes(text)) break;
  }
  return { text, intent: detected.intent, subjectId: detected.subject?.id };
}

/** Understand `message` and answer it. */
export function composeReply(message: string, ctx: ChatContext, rng: () => number, recent: readonly string[] = []): ChatReply {
  return replyToIntent(detectIntent(message, ctx.others), ctx, rng, recent);
}

/** How long the typing indicator shows for a reply, so short answers do not feel instant. */
export function typingMs(text: string): number {
  return Math.max(700, Math.min(2600, 500 + text.length * 18));
}

/* ------------------------------------------------------------------ */
/* Quick replies                                                       */
/* ------------------------------------------------------------------ */

export interface QuickReply {
  /** Stable id for keys and the "asked before" count. */
  id: string;
  intent: ChatIntent;
  subject?: ChatPerson;
  labelKey: `lokChat.quick.${string}`;
  labelParams?: Record<string, string>;
}

/** Up to `limit` suggestions, favouring things you have not asked this person yet. */
export function quickReplies(ctx: ChatContext, asked: Partial<Record<ChatIntent, number>>, limit = 5): QuickReply[] {
  const tier = affinityTier(ctx.affinity);
  const nearby = ctx.others.find((p) => ctx.crewHere.includes(p.name)) ?? ctx.others[0];
  const options: QuickReply[] = [
    { id: 'howAreYou', intent: 'howAreYou', labelKey: 'lokChat.quick.howAreYou' },
    { id: 'story', intent: 'story', labelKey: 'lokChat.quick.story' },
    { id: 'work', intent: 'work', labelKey: 'lokChat.quick.work' },
  ];
  if (ctx.lastRun) options.push({ id: 'run', intent: 'run', labelKey: 'lokChat.quick.run' });
  if (ctx.petName) options.push({ id: 'pet', intent: 'pet', labelKey: 'lokChat.quick.pet', labelParams: { pet: ctx.petName } });
  if (nearby) options.push({ id: `crew:${nearby.id}`, intent: 'crew', subject: nearby, labelKey: 'lokChat.quick.crew', labelParams: { name: nearby.name } });
  options.push({ id: 'advice', intent: 'advice', labelKey: 'lokChat.quick.advice' });
  options.push({ id: 'joke', intent: 'joke', labelKey: 'lokChat.quick.joke' });
  options.push({ id: 'weather', intent: 'weather', labelKey: 'lokChat.quick.weather' });
  if (tier !== 'new') options.push({ id: 'confide', intent: 'confide', labelKey: 'lokChat.quick.confide' });
  // Stable sort: fewer past asks first, authored order otherwise.
  return options
    .map((option, order) => ({ option, order, seen: asked[option.intent] ?? 0 }))
    .sort((a, b) => a.seen - b.seen || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.option);
}

/* ------------------------------------------------------------------ */
/* Messages they start                                                 */
/* ------------------------------------------------------------------ */

export type ProactiveKind = keyof typeof PROACTIVE_LINES;

export function proactiveLine(kind: ProactiveKind, ctx: ChatContext, rng: () => number): string {
  const voice = CREW_VOICES[ctx.self.id] ?? FALLBACK_VOICE;
  return sentence(pickFrom(PROACTIVE_LINES[kind], rng), ctx, poolsFor(ctx, voice.own), rng).replace(/\s+/g, ' ').trim();
}

export interface ProactiveCandidate {
  id: string;
  affinity: number;
  /** When they last started a conversation, ms. 0 if never. */
  lastProactiveAt: number;
  /** When anyone last wrote in this thread, ms. 0 if never. */
  lastActivityAt: number;
}

export interface ProactiveInput {
  now: number;
  hour: number;
  candidates: readonly ProactiveCandidate[];
  /** A finished run that nobody has reacted to yet. */
  freshRun?: { cleared: boolean };
  /** Cap on how many people write at once. */
  max?: number;
}

export const PROACTIVE_GAP_MS = 6 * 60 * 60 * 1000;
export const WELCOME_BACK_MS = 3 * 24 * 60 * 60 * 1000;

/** Who should start a conversation right now, and about what. Calm by design: a few per day at most. */
export function chooseProactive(input: ProactiveInput): Array<{ id: string; kind: ProactiveKind }> {
  const max = input.max ?? 2;
  const ready = input.candidates
    .filter((c) => input.now - c.lastProactiveAt >= PROACTIVE_GAP_MS)
    .sort((a, b) => b.affinity - a.affinity || (a.id < b.id ? -1 : 1));
  const out: Array<{ id: string; kind: ProactiveKind }> = [];
  if (input.freshRun) {
    for (const c of ready.slice(0, max)) out.push({ id: c.id, kind: input.freshRun.cleared ? 'afterRunCleared' : 'afterRunFell' });
    return out;
  }
  const away = ready.find((c) => c.lastActivityAt > 0 && input.now - c.lastActivityAt >= WELCOME_BACK_MS);
  if (away) return [{ id: away.id, kind: 'welcomeBack' }];
  const friends = ready.filter((c) => affinityTier(c.affinity) !== 'new');
  const bucket = timeBucket(input.hour);
  if (friends[0] && (bucket === 'morning' || bucket === 'evening')) return [{ id: friends[0].id, kind: bucket }];
  return out;
}
