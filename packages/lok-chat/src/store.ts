/**
 * LOK Chat's saved conversations. Device-local (`localStorage`), deliberately not part of
 * an app's own save: it is chatter, not progress, and it must never put a malformed value in
 * front of `normalizeMeta`. The functions up to the "store" divider are pure (state in,
 * state out) so they can be tested without a browser; the store below wires them to
 * storage and React.
 */

import { useSyncExternalStore } from 'react';

import { AFFINITY_MAX, affinityTier, type AffinityTier } from './engine';
import { emptyConv, type ConvState } from './talk';
import type { ChatEvent, ChatEventKind, ChatIntent } from './types';

export const MESSAGES_PER_THREAD = 80;
export const CHANNEL_ENTRIES = 60;
export const EVENT_LOG = 40;
export const SCENE_MEMORY = 24;
const RECENT_LINES = 12;
export const ME = 'me';

export interface ChatMessage {
  id: string;
  /** `me` or an ally id. */
  from: string;
  text: string;
  at: number;
}

export interface ChatThread {
  messages: ChatMessage[];
  affinity: number;
  unread: number;
  /** How many times each kind of thing has been asked, for variety and affinity. */
  intents: Partial<Record<ChatIntent, number>>;
  lastProactiveAt: number;
  /** Their last few lines, so they do not repeat themselves. */
  recent: string[];
  /** What they are talking about and any question waiting on you (ids and counts, never your words). */
  conv: ConvState;
}

export interface ChannelEntry {
  id: string;
  from: string;
  text: string;
  at: number;
  roomName?: string;
}

export interface LokChatState {
  version: 1;
  threads: Record<string, ChatThread>;
  /** Lines the crew said around the hideout, newest last. */
  channel: ChannelEntry[];
  /** The last finished run the crew have already reacted to. */
  lastRunReactedKey: string;
  /** Crew-to-crew scenes: the last day they ran and which ones played lately (no repeats). */
  scenes: { day: number; used: string[] };
  /** Things that happened, for people to bring up later (capped; ids and names only). */
  events: ChatEvent[];
}

export const emptyThread = (): ChatThread => ({ messages: [], affinity: 0, unread: 0, intents: {}, lastProactiveAt: 0, recent: [], conv: emptyConv() });
export const emptyState = (): LokChatState => ({ version: 1, threads: {}, channel: [], lastRunReactedKey: '', scenes: { day: -1, used: [] }, events: [] });

export const threadOf = (state: LokChatState, id: string): ChatThread => state.threads[id] ?? emptyThread();

function withThread(state: LokChatState, id: string, thread: ChatThread): LokChatState {
  return { ...state, threads: { ...state.threads, [id]: thread } };
}

/** Add a message. Theirs count as unread unless the thread is open. */
export function appendMessage(state: LokChatState, id: string, message: ChatMessage, opts: { unread?: boolean } = {}): LokChatState {
  const thread = threadOf(state, id);
  const messages = [...thread.messages, message].slice(-MESSAGES_PER_THREAD);
  const theirs = message.from !== ME;
  return withThread(state, id, {
    ...thread,
    messages,
    unread: theirs && opts.unread ? thread.unread + 1 : thread.unread,
    recent: theirs ? [...thread.recent, message.text].slice(-RECENT_LINES) : thread.recent,
  });
}

export function markRead(state: LokChatState, id: string): LokChatState {
  const thread = threadOf(state, id);
  return thread.unread === 0 ? state : withThread(state, id, { ...thread, unread: 0 });
}

export function recordIntent(state: LokChatState, id: string, intent: ChatIntent): LokChatState {
  const thread = threadOf(state, id);
  return withThread(state, id, { ...thread, intents: { ...thread.intents, [intent]: (thread.intents[intent] ?? 0) + 1 } });
}

/** Add points. `tierUp` is set when this crossed into a warmer tier. */
export function addAffinity(state: LokChatState, id: string, points: number): { state: LokChatState; tierUp?: AffinityTier } {
  if (points <= 0) return { state };
  const thread = threadOf(state, id);
  const next = Math.min(AFFINITY_MAX, thread.affinity + points);
  const before = affinityTier(thread.affinity);
  const after = affinityTier(next);
  return { state: withThread(state, id, { ...thread, affinity: next }), tierUp: after !== before ? after : undefined };
}

export function setConv(state: LokChatState, id: string, conv: ConvState): LokChatState {
  return withThread(state, id, { ...threadOf(state, id), conv });
}

export function setProactiveAt(state: LokChatState, id: string, at: number): LokChatState {
  return withThread(state, id, { ...threadOf(state, id), lastProactiveAt: at });
}

export function logChannel(state: LokChatState, entry: ChannelEntry): LokChatState {
  const last = state.channel[state.channel.length - 1];
  // The same person saying the same thing twice in a row is noise.
  if (last && last.from === entry.from && last.text === entry.text) return state;
  return { ...state, channel: [...state.channel, entry].slice(-CHANNEL_ENTRIES) };
}

/** Remember that a day's scenes played. */
export function recordScenes(state: LokChatState, day: number, ids: readonly string[]): LokChatState {
  return { ...state, scenes: { day, used: [...state.scenes.used, ...ids].slice(-SCENE_MEMORY) } };
}

/** Log something that happened, once (by its key). */
export function logEvent(state: LokChatState, event: { key: string; kind: ChatEventKind; ref: string; at: number }): LokChatState {
  if (state.events.some((e) => e.key === event.key)) return state;
  return { ...state, events: [...state.events, { ...event, used: 0 }].slice(-EVENT_LOG) };
}

export function markEventUsed(state: LokChatState, key: string): LokChatState {
  if (!state.events.some((e) => e.key === key)) return state;
  return { ...state, events: state.events.map((e) => (e.key === key ? { ...e, used: e.used + 1 } : e)) };
}

export const totalUnread = (state: LokChatState): number => Object.values(state.threads).reduce((n, thread) => n + thread.unread, 0);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const str = (value: unknown): string => (typeof value === 'string' ? value : '');

function normalizeConv(raw: unknown): ConvState {
  const conv = emptyConv();
  if (!isRecord(raw)) return conv;
  if (isRecord(raw.topic) && str(raw.topic.key)) conv.topic = { key: str(raw.topic.key).slice(0, 40), depth: Math.max(0, Math.min(5, Math.floor(num(raw.topic.depth)))) };
  conv.pending = str(raw.pending).slice(0, 60);
  if (isRecord(raw.depths)) {
    for (const [k, v] of Object.entries(raw.depths).slice(0, 60)) conv.depths[k.slice(0, 40)] = Math.max(0, Math.min(5, Math.floor(num(v))));
  }
  if (Array.isArray(raw.asked)) conv.asked = raw.asked.filter((x): x is string => typeof x === 'string').slice(-6).map((x) => x.slice(0, 40));
  conv.lastSubjectId = str(raw.lastSubjectId).slice(0, 64);
  conv.lastTopicLabel = str(raw.lastTopicLabel).slice(0, 60);
  return conv;
}

/** Accept anything out of storage and return a valid state (never throws, drops what it cannot trust). */
export function normalizeLokChat(raw: unknown): LokChatState {
  if (!isRecord(raw)) return emptyState();
  const threads: Record<string, ChatThread> = {};
  if (isRecord(raw.threads)) {
    for (const [id, value] of Object.entries(raw.threads)) {
      if (!isRecord(value) || id.length > 64) continue;
      const messages: ChatMessage[] = [];
      if (Array.isArray(value.messages)) {
        for (const m of value.messages) {
          if (!isRecord(m) || !str(m.text) || !str(m.from)) continue;
          messages.push({ id: str(m.id) || `${num(m.at)}-${messages.length}`, from: str(m.from).slice(0, 64), text: str(m.text).slice(0, 400), at: num(m.at) });
        }
      }
      const intents: Partial<Record<ChatIntent, number>> = {};
      if (isRecord(value.intents)) for (const [k, v] of Object.entries(value.intents)) intents[k as ChatIntent] = Math.max(0, Math.floor(num(v)));
      threads[id] = {
        messages: messages.slice(-MESSAGES_PER_THREAD),
        affinity: Math.max(0, Math.min(AFFINITY_MAX, Math.floor(num(value.affinity)))),
        unread: Math.max(0, Math.min(messages.length, Math.floor(num(value.unread)))),
        intents,
        lastProactiveAt: num(value.lastProactiveAt),
        conv: normalizeConv(value.conv),
        recent: Array.isArray(value.recent) ? value.recent.filter((r): r is string => typeof r === 'string').slice(-RECENT_LINES) : [],
      };
    }
  }
  const channel: ChannelEntry[] = [];
  if (Array.isArray(raw.channel)) {
    for (const e of raw.channel) {
      if (!isRecord(e) || !str(e.text) || !str(e.from)) continue;
      channel.push({ id: str(e.id) || `${num(e.at)}-${channel.length}`, from: str(e.from).slice(0, 64), text: str(e.text).slice(0, 400), at: num(e.at), roomName: str(e.roomName) || undefined });
    }
  }
  const scenes = isRecord(raw.scenes)
    ? { day: Math.floor(num(raw.scenes.day, -1)), used: Array.isArray(raw.scenes.used) ? raw.scenes.used.filter((x): x is string => typeof x === 'string').slice(-SCENE_MEMORY).map((x) => x.slice(0, 80)) : [] }
    : { day: -1, used: [] };
  const KINDS: readonly string[] = ['cleared', 'fell', 'rescued', 'pet'];
  const events: ChatEvent[] = [];
  if (Array.isArray(raw.events)) {
    for (const e of raw.events) {
      if (!isRecord(e) || !str(e.key) || !KINDS.includes(str(e.kind)) || !str(e.ref)) continue;
      events.push({ key: str(e.key).slice(0, 120), kind: str(e.kind) as ChatEventKind, ref: str(e.ref).slice(0, 60), at: num(e.at), used: Math.max(0, Math.min(9, Math.floor(num(e.used)))) });
    }
  }
  return { version: 1, threads, channel: channel.slice(-CHANNEL_ENTRIES), lastRunReactedKey: str(raw.lastRunReactedKey).slice(0, 120), scenes, events: events.slice(-EVENT_LOG) };
}

/* ------------------------------------------------------------------ */
/* The store                                                           */
/* ------------------------------------------------------------------ */

const SAVE_DELAY_MS = 400;

export interface ChatStoreOptions {
  /** localStorage key, e.g. `survivor616.lokchat.v1`. */
  key: string;
  /** Defaults to `window.localStorage` when it exists. */
  storage?: () => Storage | null;
}

/** One app's saved chat: an external store plus a React hook. State lives in memory, saves shortly after a change. */
export function createChatStore(options: ChatStoreOptions) {
  let state: LokChatState | null = null;
  const listeners = new Set<() => void>();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let idCounter = 0;

  const storage = (): Storage | null => {
    if (options.storage) return options.storage();
    try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
  };

  function load(): LokChatState {
    try {
      const raw = storage()?.getItem(options.key);
      return raw ? normalizeLokChat(JSON.parse(raw)) : emptyState();
    } catch {
      return emptyState();
    }
  }

  function flush(): void {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try { if (state) storage()?.setItem(options.key, JSON.stringify(state)); } catch { /* lasts until reload */ }
  }

  function scheduleSave(): void {
    if (saveTimer) return;
    saveTimer = setTimeout(flush, SAVE_DELAY_MS);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }

  const get = (): LokChatState => {
    if (!state) state = load();
    return state;
  };

  /** Apply a pure update and tell subscribers. */
  function update(fn: (current: LokChatState) => LokChatState): LokChatState {
    const next = fn(get());
    if (next !== state) {
      state = next;
      scheduleSave();
      for (const listener of listeners) listener();
    }
    return next;
  }

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };

  return {
    get,
    update,
    subscribe,
    /** Forget every conversation, relationship and channel line on this device. */
    clear: (): void => { update(() => emptyState()); },
    /** For tests: forget everything held in memory. */
    resetForTests: (next: LokChatState = emptyState()): void => {
      state = next;
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    },
    newMessageId: (at: number): string => { idCounter += 1; return `${at}-${idCounter}`; },
    /** Subscribe a component to a slice of the chat state; re-renders only when the slice changes. */
    useChat: <T,>(select: (s: LokChatState) => T): T => useSyncExternalStore(subscribe, () => select(get()), () => select(emptyState())),
  };
}

export type ChatStore = ReturnType<typeof createChatStore>;
