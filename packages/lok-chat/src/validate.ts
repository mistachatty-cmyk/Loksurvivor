/**
 * `validateCast`: the safety and quality gate every app's cast passes (in its own tests). It checks
 * the authored text without running a conversation: banned words, broken template markup, unknown
 * slots, missing confidences, topics without layers, and opinions about people who do not exist.
 */
import type { ChatCast, TopicDef } from './types';

/** Words that must never reach a player. Built from pieces so this file itself stays clean of the banned naming word. */
export const DEFAULT_BANNED = new RegExp(
  '\\b(' + ['sig', 'nal'].join('') + '\\w*|damn\\w*|hell|crap\\w*|shit\\w*|fuck\\w*|bitch\\w*|bastard\\w*|ass|piss\\w*|sex\\w*|kill\\w*|murder\\w*|blood\\w*|gore|drunk|drugs?|weed|beer|whiskey)\\b',
  'i',
);

/** Slots the engine always fills, on top of the cast's own `sharedPools` keys. */
export const ENGINE_SLOTS = ['mood', 'name', 'role', 'room', 'weather', 'crew', 'pet', 'area', 'time', 'own', 'subject', 'subjectRole', 'hook', 'lastTopic'];

export interface ValidateOptions {
  banned?: RegExp;
  /** Topics every person must be able to talk about (shared + their own). */
  minTopicsPerPerson?: number;
  /** Required personal lines per person. */
  minConfides?: number;
  maxLineLength?: number;
}

function collect(cast: ChatCast): string[] {
  const out: string[] = [];
  const push = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(push);
    else if (v && typeof v === 'object' && !(v instanceof RegExp)) Object.values(v).forEach(push);
  };
  const { intentRules: _rules, ...rest } = cast;
  push(rest);
  return out;
}

const topicsOf = (cast: ChatCast, id: string): TopicDef[] => [...(cast.topicsByPerson[id] ?? []), ...cast.sharedTopics];

export function validateCast(cast: ChatCast, options: ValidateOptions = {}): string[] {
  const problems: string[] = [];
  const banned = options.banned ?? DEFAULT_BANNED;
  const minTopics = options.minTopicsPerPerson ?? 6;
  const minConfides = options.minConfides ?? 2;
  const maxLen = options.maxLineLength ?? 420;
  const slots = new Set([...ENGINE_SLOTS, ...Object.keys(cast.sharedPools)]);

  for (const text of collect(cast)) {
    if (banned.test(text)) problems.push(`banned word: ${text}`);
    if (text.length > maxLen) problems.push(`line too long (${text.length}): ${text.slice(0, 60)}`);
    let depth = 0;
    for (const ch of text) {
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      if (depth < 0) break;
    }
    if (depth !== 0) problems.push(`unbalanced braces: ${text}`);
    for (const m of text.matchAll(/<([a-zA-Z]+)>/g)) {
      if (!slots.has(m[1]!)) problems.push(`unknown slot <${m[1]}>: ${text}`);
    }
  }

  const people = Object.keys(cast.voices);
  for (const id of people) {
    if ((cast.confides[id]?.length ?? 0) < minConfides) problems.push(`${id}: needs ${minConfides}+ confidences`);
    if (topicsOf(cast, id).length < minTopics) problems.push(`${id}: fewer than ${minTopics} topics`);
  }
  for (const [speaker, map] of Object.entries(cast.relations)) {
    if (!cast.voices[speaker]) problems.push(`relations: unknown speaker ${speaker}`);
    for (const subject of Object.keys(map)) if (!cast.voices[subject]) problems.push(`relations: ${speaker} talks about unknown ${subject}`);
  }
  for (const [id, topics] of Object.entries(cast.topicsByPerson)) {
    if (!cast.voices[id]) problems.push(`topics: unknown person ${id}`);
    for (const topic of topics) {
      if (topic.layers.length < 1 || topic.layers.some((layer) => layer.length === 0)) problems.push(`${id}/${topic.key}: empty layer`);
    }
  }
  const seen = new Set<string>();
  for (const topic of cast.sharedTopics) {
    if (seen.has(topic.key)) problems.push(`duplicate shared topic ${topic.key}`);
    seen.add(topic.key);
    if (topic.layers.length > 1 && !topic.label) problems.push(`${topic.key}: layered topic needs a label`);
    if (topic.layers.some((layer) => layer.length === 0)) problems.push(`${topic.key}: empty layer`);
  }
  return problems;
}
