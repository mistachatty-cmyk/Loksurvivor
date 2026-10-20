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
import {
  ALLY_TOPICS,
  FEELING_LINES,
  HOOKS,
  LAST_RUN_CALLBACKS,
  LAST_TOPIC_CALLBACKS,
  MORE_OFFERS,
  NO_THANKS,
  NO_TOPIC,
  QUESTIONS,
  SHARED_TOPICS,
  SMALLTALK_LINES,
  TAKE_YOUR_TIME,
  TOPIC_DEFLECTIONS,
  TOPIC_EXHAUSTED,
  type QuestionDef,
  type TopicDef,
} from '@/game/data/lokChatTopics';
import { analysisFor, analyze, emptyConv, type Analysis, type ConvState, type Follow } from '@/game/engine/lokChatTalk';
import { expandTemplate, generateCrewLine, type Pools, type Tone } from '@/game/engine/crewTalk';
import type { CrewVoice } from '@/game/engine/crewTalk';
import type { HideoutWeather } from '@/game/types';

export type { ChatIntent } from '@/game/data/lokChatData';
export { analysisFor, emptyConv } from '@/game/engine/lokChatTalk';
export type { Analysis, ConvState, Feeling, Follow } from '@/game/engine/lokChatTalk';

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
  if (intent === 'unknown' || intent === 'smalltalk') return 0;
  // Staying on a subject is how people get close, so following up pays steadily.
  if (intent === 'followUp') return timesAskedBefore < 40 ? 2 : 0;
  if (intent === 'topic') return timesAskedBefore === 0 ? 3 : timesAskedBefore < 12 ? 2 : 0;
  if (intent === 'feeling') return timesAskedBefore === 0 ? 3 : timesAskedBefore < 6 ? 1 : 0;
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
  /** What the message was like (a feeling, a "why?", a "yes"). Absent for quick replies and tests. */
  analysis?: Analysis;
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
  const analysis = analyze(flat, text.includes('?'));
  let intent: ChatIntent = 'unknown';
  for (const [candidate, pattern] of INTENT_RULES) {
    if (pattern.test(flat)) { intent = candidate; break; }
  }
  const subject = findSubject(flat, others);
  if (subject && !OVERRIDES_SUBJECT.has(intent)) return { intent: 'crew', subject, analysis };
  return { intent, subject, analysis };
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
  /** Where this conversation is: the topic, any question waiting for an answer, how deep each went. */
  conv?: ConvState;
}

export interface ChatReply {
  text: string;
  intent: ChatIntent;
  subjectId?: string;
  /** The conversation after this reply, to be saved with the thread. */
  conv: ConvState;
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

function poolsFor(ctx: ChatContext, ownPool: readonly string[], subject?: ChatPerson, extra: Pools = {}): Pools {
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
    ...extra,
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
    case 'topic':
    case 'followUp':
    case 'feeling':
    case 'smalltalk':
      text = sentence(templateFor('unknown', ctx.tone, tier, rng), ctx, pools, rng);
      break;
    default:
      text = sentence(templateFor(intent, ctx.tone, tier, rng), ctx, pools, rng);
  }
  if (tier === 'close' && intent !== 'unknown' && intent !== 'confide' && rng() < 0.25) {
    text = `${text} ${sentence(pickFrom(CLOSE_FLOURISH, rng), ctx, pools, rng)}`;
  }
  return text.replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* Conversation: topics, follow-ups, feelings, questions back          */
/* ------------------------------------------------------------------ */

/** Intents that are plainly about something else, so a keyword topic must not hijack them. */
const STRONG: ReadonlySet<ChatIntent> = new Set<ChatIntent>(['bye', 'thanks', 'confide', 'joke', 'run', 'pet', 'weather']);
const LAYERS_BY_TIER: Record<AffinityTier, number> = { new: 1, friend: 2, close: 3 };
const NEVER = /(?!)/;

function topicsFor(ctx: ChatContext, voice: CrewVoice): TopicDef[] {
  const confides = CREW_CONFIDES[ctx.self.id] ?? [];
  const own: TopicDef = {
    key: 'own', label: 'my work', pattern: NEVER,
    layers: [voice.topics, voice.wry.length > 0 ? voice.wry : voice.topics, confides.length > 0 ? confides : voice.topics],
  };
  return [...(ALLY_TOPICS[ctx.self.id] ?? []), ...SHARED_TOPICS, own];
}

const matchTopic = (flat: string, topics: readonly TopicDef[]): TopicDef | undefined => topics.find((t) => t.pattern.test(flat));

const cloneConv = (conv: ConvState | undefined): ConvState => {
  const base = conv ?? emptyConv();
  return { ...base, depths: { ...base.depths }, asked: [...base.asked] };
};

interface Said { text: string; intent: ChatIntent }

function converse(detectedIn: DetectedIntent, ctx: ChatContext, rng: () => number): { text: string; intent: ChatIntent; subjectId?: string; conv: ConvState } {
  const voice = CREW_VOICES[ctx.self.id] ?? FALLBACK_VOICE;
  const tier = affinityTier(ctx.affinity);
  const conv = cloneConv(ctx.conv);
  const a = detectedIn.analysis;
  const topics = topicsFor(ctx, voice);
  let detected = detectedIn;

  const say = (template: string, extra: Pools = {}, subject?: ChatPerson): string =>
    sentence(template, ctx, poolsFor(ctx, voice.own, subject ?? detected.subject, extra), rng);
  const sayOne = (list: readonly string[], extra: Pools = {}): string => say(pickFrom(list, rng), extra);

  /** A topic we could offer next, favouring the ones only this person has. */
  const pickHook = (): TopicDef | undefined => {
    const mine = ALLY_TOPICS[ctx.self.id] ?? [];
    const pool = [...(rng() < 0.5 ? mine : []), ...topics.filter((t) => t.label && t.layers.length > 1)];
    const open = pool.filter((t) => (conv.depths[t.key] ?? 0) < Math.min(t.layers.length, LAYERS_BY_TIER[tier]));
    const list = open.length > 0 ? open : pool;
    return list.length > 0 ? pickFrom(list, rng) : undefined;
  };
  const offerHook = (): string => {
    const hook = pickHook();
    if (!hook) return '';
    conv.pending = `offer:${hook.key}`;
    return say(pickFrom(HOOKS, rng), { hook: [hook.label] });
  };

  const serve = (topic: TopicDef): Said => {
    if (topic.layers.length === 1) return { text: sayOne(topic.layers[0]!), intent: 'topic' };
    const depth = conv.depths[topic.key] ?? 0;
    const unlocked = LAYERS_BY_TIER[tier];
    conv.topic = { key: topic.key, depth };
    if (depth >= topic.layers.length) return { text: `${sayOne(TOPIC_EXHAUSTED)} ${offerHook()}`.trim(), intent: 'followUp' };
    if (depth >= unlocked) return { text: `${sayOne(TOPIC_DEFLECTIONS)} ${offerHook()}`.trim(), intent: 'followUp' };
    conv.depths[topic.key] = depth + 1;
    conv.topic = { key: topic.key, depth: depth + 1 };
    conv.lastTopicLabel = topic.label;
    let text = sayOne(topic.layers[depth]!);
    if (depth + 1 < Math.min(unlocked, topic.layers.length) && rng() < 0.55) {
      text = `${text} ${sayOne(MORE_OFFERS)}`;
      conv.pending = 'more';
    }
    return { text, intent: depth === 0 ? 'topic' : 'followUp' };
  };

  const currentTopic = (): TopicDef | undefined => (conv.topic ? topics.find((t) => t.key === conv.topic!.key) : undefined);

  const classic = (): Said => {
    let text = oneReply(detected.intent, detected.subject, ctx, rng, []);
    if (a && detected.intent !== 'greet' && detected.intent !== 'unknown' && detected.intent !== 'bye' && /^(hi|hey|hello|yo|sup|howdy|hiya)\b/.test(a.flat)) {
      text = `${pickFrom(['Hey.', 'Hi, you.', 'Hello.'], rng)} ${text}`;
    }
    if (detected.intent === 'greet' && tier !== 'new' && rng() < 0.5) {
      if (ctx.lastRun) text = `${text} ${sayOne(LAST_RUN_CALLBACKS)}`;
      else if (conv.lastTopicLabel) text = `${text} ${sayOne(LAST_TOPIC_CALLBACKS, { lastTopic: [conv.lastTopicLabel] })}`;
    }
    return { text, intent: detected.intent };
  };

  const answerPending = (analysis: Analysis): Said => {
    const pending = conv.pending;
    conv.pending = '';
    if (analysis.feeling && analysis.follow !== 'yes' && analysis.follow !== 'no') return { text: sayOne(FEELING_LINES[analysis.feeling]), intent: 'feeling' };
    const offered = pending === 'more' || pending.startsWith('offer:');
    const kind = analysis.follow === 'yes' || analysis.follow === 'no' || analysis.follow === 'unsure' ? analysis.follow : offered && (analysis.follow === 'ack' || analysis.follow === 'laugh') ? 'yes' : 'other';
    if (pending === 'more' || pending.startsWith('offer:')) {
      const topic = pending === 'more' ? currentTopic() : topics.find((t) => t.key === pending.slice(6));
      if (kind === 'yes' && topic) return serve(topic);
      if (kind === 'no') return { text: `${sayOne(NO_THANKS)} ${offerHook()}`.trim(), intent: 'followUp' };
      if (kind === 'unsure') return { text: sayOne(TAKE_YOUR_TIME), intent: 'followUp' };
      if (analysis.feeling) return { text: sayOne(FEELING_LINES[analysis.feeling]), intent: 'feeling' };
      return topic ? serve(topic) : { text: sayOne(SMALLTALK_LINES.statement), intent: 'followUp' };
    }
    const question: QuestionDef | undefined = QUESTIONS.find((q) => `q:${q.id}` === pending);
    if (!question) return { text: sayOne(SMALLTALK_LINES.statement), intent: 'followUp' };
    const branch = question.free || kind === 'yes' && question.yes.length === 0 ? 'other' : kind;
    const list = question[branch].length > 0 ? question[branch] : question.other;
    return { text: sayOne(list), intent: 'followUp' };
  };

  const fallback = (analysis: Analysis): Said => {
    let intent: ChatIntent = 'unknown';
    let text: string;
    if (analysis.feeling) { text = sayOne(FEELING_LINES[analysis.feeling]); intent = 'feeling'; }
    else if (analysis.follow === 'laugh') { text = sayOne(SMALLTALK_LINES.laugh); intent = 'smalltalk'; }
    else if (analysis.follow === 'ack' || analysis.follow === 'yes' || analysis.follow === 'no') { text = sayOne(SMALLTALK_LINES.ack); intent = 'smalltalk'; }
    else if (analysis.question) text = sayOne(SMALLTALK_LINES.question);
    else text = sayOne(SMALLTALK_LINES.statement);
    const hook = rng() < 0.85 ? offerHook() : '';
    return { text: hook ? `${text} ${hook}` : text, intent };
  };

  let said: Said;
  if (a && conv.pending && (a.follow === 'yes' || a.follow === 'no' || a.follow === 'unsure' || a.follow === 'ack' || a.follow === 'laugh' || a.feeling || (detected.intent === 'unknown' && !a.follow && !matchTopic(a.flat, topics)))) {
    said = answerPending(a);
  } else {
    conv.pending = '';
    if (a?.follow === 'pronoun' && conv.lastSubjectId && !detected.subject && (detected.intent === 'unknown' || detected.intent === 'story')) {
      const earlier = ctx.others.find((o) => o.id === conv.lastSubjectId);
      if (earlier) detected = { ...detected, intent: 'crew', subject: earlier };
    }
    if (a?.follow === 'andYou' && (detected.intent === 'unknown' || detected.intent === 'story')) detected = { ...detected, intent: 'howAreYou' };

    if (a && (a.follow === 'why' || a.follow === 'more') && !STRONG.has(detected.intent) && detected.intent !== 'crew') {
      const topic = currentTopic();
      said = topic ? serve(topic) : { text: sayOne(NO_TOPIC), intent: 'followUp' };
    } else {
      const topic = a && !STRONG.has(detected.intent) && detected.intent !== 'crew' ? matchTopic(a.flat, topics) : undefined;
      if (topic) said = serve(topic);
      else if (a && detected.intent === 'unknown') said = fallback(a);
      else said = classic();
    }
  }

  if (detected.intent === 'crew' && detected.subject) conv.lastSubjectId = detected.subject.id;

  // Now and then they ask you something back, which makes the next answer part of the conversation.
  if (!conv.pending && said.intent !== 'bye' && said.intent !== 'thanks' && said.intent !== 'confide' && said.intent !== 'smalltalk' && !said.text.endsWith('?') && said.text.length < 210 && rng() < 0.3) {
    const fresh = QUESTIONS.filter((q) => !conv.asked.includes(q.id));
    if (fresh.length > 0) {
      const q = pickFrom(fresh, rng);
      said = { ...said, text: `${said.text} ${say(q.ask)}` };
      conv.pending = `q:${q.id}`;
      conv.asked = [...conv.asked, q.id].slice(-6);
    }
  }

  return { text: said.text.replace(/\s+/g, ' ').trim(), intent: said.intent, subjectId: detected.subject?.id, conv };
}

/** Answer one message. Re-rolls to avoid repeating anything in `recent`. */
export function replyToIntent(detected: DetectedIntent, ctx: ChatContext, rng: () => number, recent: readonly string[] = []): ChatReply {
  let result = converse(detected, ctx, rng);
  for (let attempt = 1; attempt < 6; attempt += 1) {
    if (result.text && !recent.some((r) => r === result.text || result.text.startsWith(r))) break;
    result = converse(detected, ctx, rng);
  }
  return result;
}

/** A quick-reply button as if the player had typed it. */
export function detectedFromQuick(q: QuickReply): DetectedIntent {
  return q.follow ? { intent: 'unknown', subject: q.subject, analysis: analysisFor(q.follow) } : { intent: q.intent, subject: q.subject };
}

/**
 * Sometimes a longer reply arrives as two bubbles, the way people send a thought and then
 * the rest of it. Returns one or two pieces.
 */
export function splitReply(text: string, rng: () => number): string[] {
  if (text.length < 110 || rng() < 0.5) return [text];
  const middle = text.length / 2;
  let best = -1;
  for (const m of text.matchAll(/[.!?] /g)) {
    const at = (m.index ?? 0) + 1;
    if (at < 30 || text.length - at < 30) continue;
    if (best < 0 || Math.abs(at - middle) < Math.abs(best - middle)) best = at;
  }
  return best < 0 ? [text] : [text.slice(0, best).trim(), text.slice(best).trim()];
}

/** Understand `message` and answer it. */
export function composeReply(message: string, ctx: ChatContext, rng: () => number, recent: readonly string[] = []): ChatReply {
  return replyToIntent(detectIntent(message, ctx.others), ctx, rng, recent);
}

/** How long the typing indicator shows for a reply, so short answers do not feel instant. */
export function typingMs(text: string, pace = 1): number {
  return Math.round(Math.max(700, Math.min(2600, 500 + text.length * 18)) * pace);
}

/* ------------------------------------------------------------------ */
/* Quick replies                                                       */
/* ------------------------------------------------------------------ */

export interface QuickReply {
  /** Stable id for keys and the "asked before" count. */
  id: string;
  intent: ChatIntent;
  subject?: ChatPerson;
  /** A follow-up ("tell me more", "yes") rather than a new subject. */
  follow?: Follow;
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
  const lead: QuickReply[] = [];
  const conv = ctx.conv;
  if (conv?.pending) {
    lead.push({ id: 'yes', intent: 'unknown', follow: 'yes', labelKey: 'lokChat.quick.yes' }, { id: 'no', intent: 'unknown', follow: 'no', labelKey: 'lokChat.quick.no' }, { id: 'unsure', intent: 'unknown', follow: 'unsure', labelKey: 'lokChat.quick.unsure' });
  } else if (conv?.topic && conv.topic.depth < LAYERS_BY_TIER[tier]) {
    lead.push({ id: 'more', intent: 'unknown', follow: 'more', labelKey: 'lokChat.quick.more' });
  }
  return [...lead, ...options
    .map((option, order) => ({ option, order, seen: asked[option.intent] ?? 0 }))
    .sort((a, b) => a.seen - b.seen || a.order - b.order)
    .map((entry) => entry.option)].slice(0, limit);
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
