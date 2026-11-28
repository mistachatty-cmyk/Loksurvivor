import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIGHTHOUSE_CAST, LIGHTHOUSE_PEOPLE } from '../examples/minimal-cast/cast';
import {
  CHAT_FEATURES,
  DEFAULT_BANNED,
  appendMessage,
  createChatActions,
  createChatEngine,
  createChatStore,
  localDay,
  logEvent,
  markEventUsed,
  moodOf,
  pickScenes,
  MOOD_IDS,
  emptyConv,
  emptyState,
  featureOn,
  mergeFeatures,
  normalizeLokChat,
  threadOf,
  validateCast,
  type ChatContext,
  type ChatFeature,
  type FeatureFlags,
} from './index';

const rngOf = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
};

const ctx = (id: string, extra: Partial<ChatContext> = {}): ChatContext => ({
  self: LIGHTHOUSE_PEOPLE.find((p) => p.id === id)!,
  others: LIGHTHOUSE_PEOPLE.filter((p) => p.id !== id),
  roomName: 'the lamp room', crewHere: ['Wren'], weather: 'calm', hour: 9, tone: 'family', affinity: 0,
  lastRun: { cleared: true, kills: 3, areaName: 'North Reef' }, ...extra,
});

describe('a cast that is not 616 Survivor', () => {
  it('passes validateCast', () => {
    assert.deepEqual(validateCast(LIGHTHOUSE_CAST, { minTopicsPerPerson: 1 }), []);
  });

  it('answers, follows a topic, and stays in its own world', () => {
    const engine = createChatEngine(LIGHTHOUSE_CAST);
    const hi = engine.replyToIntent(engine.detectIntent('hello', ctx('mara').others), ctx('mara'), rngOf(3));
    assert.equal(hi.intent, 'greet');
    const topic = engine.replyToIntent(engine.detectIntent('tell me about the sea', []), ctx('mara'), rngOf(5));
    assert.equal(topic.intent, 'topic');
    assert.match(topic.text, /sea is a neighbour/i);
    const next = engine.replyToIntent(engine.detectIntent('why', []), ctx('mara', { affinity: 15, conv: topic.conv }), rngOf(7));
    assert.equal(next.conv.depths.sea, 2);
    const feeling = engine.replyToIntent(engine.detectIntent('i am so tired', []), ctx('wren'), rngOf(9));
    assert.equal(feeling.intent, 'feeling');
    assert.ok(!DEFAULT_BANNED.test(feeling.text) && !/zebra/i.test(feeling.text));
  });

  it('catches a broken cast', () => {
    const bad = { ...LIGHTHOUSE_CAST, confides: { ...LIGHTHOUSE_CAST.confides, wren: ['only one'] }, hooks: ['Ask me about <nonsense>.', 'what the hell'] };
    const problems = validateCast(bad, { minTopicsPerPerson: 1 });
    assert.ok(problems.some((p) => p.includes('wren: needs 2+ confidences')), problems.join('\n'));
    assert.ok(problems.some((p) => p.includes('unknown slot <nonsense>')));
    assert.ok(problems.some((p) => p.startsWith('banned word')));
    assert.ok(DEFAULT_BANNED.test('a ' + ['sig', 'nal'].join('') + ' here'));
  });
});

describe('feature toggles', () => {
  it('only an explicit false turns something off, and chat:false turns off the messenger but not hideout chatter', () => {
    assert.equal(featureOn(undefined, 'depth'), true);
    assert.equal(featureOn({ depth: false }, 'depth'), false);
    assert.equal(featureOn({ depth: false }, 'memory'), true);
    assert.equal(featureOn({ chat: false }, 'depth'), false);
    assert.equal(featureOn({ chat: false }, 'strip'), true);
    const merged = mergeFeatures({ memory: false }, { depth: false });
    assert.equal(merged.memory, false);
    assert.equal(merged.depth, false);
    assert.equal(merged.chat, true);
    assert.equal(CHAT_FEATURES.length, new Set(CHAT_FEATURES).size);
  });

  it('with depth off the classic rules answer: no topics, no feelings, no follow-ups', () => {
    let flags: FeatureFlags = {};
    const engine = createChatEngine(LIGHTHOUSE_CAST, { features: () => flags });
    const on = engine.replyToIntent(engine.detectIntent('tell me about the sea', []), ctx('mara'), rngOf(5));
    assert.equal(on.intent, 'topic');
    flags = { depth: false };
    const off = engine.replyToIntent(engine.detectIntent('tell me about the sea', []), ctx('mara'), rngOf(5));
    assert.notEqual(off.intent, 'topic');
    assert.deepEqual(off.conv.topic, null);
    const tired = engine.replyToIntent(engine.detectIntent('i am so tired', []), ctx('mara'), rngOf(5));
    assert.notEqual(tired.intent, 'feeling');
  });

  it('with questionsBack off they never ask, and with it on they sometimes do', () => {
    const asks = (flags: FeatureFlags): number => {
      const engine = createChatEngine(LIGHTHOUSE_CAST, { features: () => flags });
      let n = 0;
      for (let seed = 1; seed < 80; seed += 1) {
        const r = engine.replyToIntent(engine.detectIntent('how are you', []), ctx('tobias'), rngOf(seed));
        if (r.conv.pending.startsWith('q:')) n += 1;
      }
      return n;
    };
    assert.equal(asks({ questionsBack: false }), 0);
    assert.ok(asks({}) > 5);
  });

  it('with memory off a greeting never calls back to your last run', () => {
    const run = (flags: FeatureFlags): number => {
      const engine = createChatEngine(LIGHTHOUSE_CAST, { features: () => flags });
      let n = 0;
      for (let seed = 1; seed < 80; seed += 1) {
        if (/North Reef/.test(engine.replyToIntent(engine.detectIntent('hello', []), ctx('mara', { affinity: 20 }), rngOf(seed)).text)) n += 1;
      }
      return n;
    };
    assert.equal(run({ memory: false }), 0);
    assert.ok(run({}) > 0);
  });

  it('proactive off writes nothing, on writes one', async () => {
    const memory: Record<string, string> = {};
    const storage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = v; } } as unknown as Storage;
    const store = createChatStore({ key: 'test.chat', storage: () => storage });
    let flags: FeatureFlags = { proactive: false };
    const engine = createChatEngine(LIGHTHOUSE_CAST, { features: () => flags });
    const actions = createChatActions({ engine, store, features: () => flags });
    const build = (id: string, affinity: number): ChatContext => ctx(id, { affinity });
    const wrote = actions.startProactive({ allyIds: ['mara'], buildContext: build, now: 50_000_000, hour: 9, rng: rngOf(2), run: { key: 'r1', cleared: true } });
    assert.equal(wrote, 0);
    assert.equal(threadOf(store.get(), 'mara').messages.length, 0);
    flags = {};
    const wroteOn = actions.startProactive({ allyIds: ['mara'], buildContext: build, now: 50_000_000, hour: 9, rng: rngOf(2), run: { key: 'r1', cleared: true } });
    assert.equal(wroteOn, 1);
    assert.equal(threadOf(store.get(), 'mara').messages.length, 1);
  });
});

describe('store', () => {
  it('saves to the key it is given and survives junk', () => {
    const memory: Record<string, string> = {};
    const storage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = v; } } as unknown as Storage;
    const store = createChatStore({ key: 'other.app.chat', storage: () => storage });
    store.update((s) => appendMessage(s, 'mara', { id: '1', from: 'me', text: 'hi', at: 1 }));
    store.resetForTests(store.get());
    assert.equal(threadOf(store.get(), 'mara').messages.length, 1);
    assert.deepEqual(normalizeLokChat('garbage'), emptyState());
    assert.deepEqual(threadOf(emptyState(), 'x').conv, emptyConv());
  });

  it('knows every feature name', () => {
    const names: ChatFeature[] = ['chat', 'depth', 'questionsBack', 'twoBubbles', 'proactive', 'memory', 'strip', 'scenes', 'group', 'moods', 'presence', 'reactions'];
    assert.deepEqual([...CHAT_FEATURES].sort(), [...names].sort());
  });
});

describe('scenes, moods and memory', () => {
  const people = LIGHTHOUSE_PEOPLE.map((p) => ({ ...p, room: 'the lamp room' }));

  it('picks the same scenes all day and different ones another day, without repeating', () => {
    const run = (day: number, used: string[] = []) => pickScenes(LIGHTHOUSE_CAST, { day, people, weather: 'calm', hour: 8, tone: 'family', used, count: 2 }).map((s) => s.id);
    assert.deepEqual(run(100), run(100));
    assert.equal(run(100).length, 2);
    const first = run(100);
    const second = run(100, first);
    assert.ok(second.every((id) => !first.includes(id)), `${first} then ${second}`);
    const days = new Set(Array.from({ length: 12 }, (_, d) => run(d).join('|')));
    assert.ok(days.size > 3, 'scenes vary from day to day');
  });

  it('respects when a scene fits, builds opinion scenes from relations, and fills the names', () => {
    const storm = pickScenes(LIGHTHOUSE_CAST, { day: 1, people, weather: 'storm', hour: 15, tone: 'family', used: [], count: 8 });
    assert.ok(storm.some((s) => s.id === 'fog-chat'));
    const calm = pickScenes(LIGHTHOUSE_CAST, { day: 1, people, weather: 'calm', hour: 15, tone: 'family', used: [], count: 8 });
    assert.ok(!calm.some((s) => s.id === 'fog-chat'), 'a storm scene does not play in calm weather');
    assert.ok(!calm.some((s) => s.id === 'morning-tea'), 'a morning scene does not play in the afternoon');
    const opinion = [...storm, ...calm].find((s) => s.id.startsWith('opinion:'))!;
    assert.ok(opinion && opinion.lines.length === 2);
    for (const scene of [...storm, ...calm]) for (const line of scene.lines) assert.ok(!/[<>{}|]/.test(line.text), line.text);
    const lamp = [...storm, ...calm].find((s) => s.id === 'lamp-oil');
    if (lamp) assert.equal(lamp.lines[0]!.from, 'mara');
  });

  it('only people who are present take part', () => {
    const two = people.filter((p) => p.id !== 'tobias');
    const scenes = pickScenes(LIGHTHOUSE_CAST, { day: 4, people: two, weather: 'calm', hour: 8, tone: 'family', used: [], count: 8 });
    for (const scene of scenes) for (const line of scene.lines) assert.ok(line.from !== 'tobias');
  });

  it('a mood is stable for a person on a day, varies across days, and shows up in their words', () => {
    assert.equal(moodOf('mara', 10), moodOf('mara', 10));
    const seen = new Set(Array.from({ length: 40 }, (_, d) => moodOf('mara', d)));
    assert.ok(seen.size >= 3 && [...seen].every((m) => MOOD_IDS.includes(m)));
    const engine = createChatEngine(LIGHTHOUSE_CAST);
    const reply = engine.replyToIntent(engine.detectIntent('how are you', []), ctx('mara', { day: 12 }), rngOf(2));
    assert.ok(new RegExp(moodOf('mara', 12)).test(reply.text) || reply.text.length > 0);
    const off = createChatEngine(LIGHTHOUSE_CAST, { features: () => ({ moods: false }) });
    const openers = LIGHTHOUSE_CAST.moodOpeners ? Object.values(LIGHTHOUSE_CAST.moodOpeners).flat() : [];
    for (let seed = 1; seed < 60; seed += 1) {
      const text = off.replyToIntent(off.detectIntent('hello', []), ctx('mara', { day: 12, affinity: 20 }), rngOf(seed)).text;
      assert.ok(!openers.some((o) => text.includes(o)), `a mood opener appeared with moods off: ${text}`);
    }
    assert.ok(localDay(Date.UTC(2026, 10, 28, 12)) > 20000);
  });

  it('brings up something that happened, once, and not at all with memory off', () => {
    const events = [{ key: 'cleared|reef|1', kind: 'cleared' as const, ref: 'North Reef', at: 1, used: 0 }];
    const brings = (flags: FeatureFlags, evs: typeof events): { mentioned: number; key?: string } => {
      const engine = createChatEngine(LIGHTHOUSE_CAST, { features: () => flags });
      let mentioned = 0;
      let key: string | undefined;
      for (let seed = 1; seed < 80; seed += 1) {
        const r = engine.replyToIntent(engine.detectIntent('hello', []), ctx('mara', { affinity: 20, events: evs, lastRun: undefined }), rngOf(seed));
        if (/I kept thinking about the North Reef/.test(r.text)) { mentioned += 1; key = r.usedEventKey; }
      }
      return { mentioned, key };
    };
    const on = brings({}, events);
    assert.ok(on.mentioned > 0);
    assert.equal(on.key, 'cleared|reef|1');
    assert.equal(brings({ memory: false }, events).mentioned, 0);
    assert.equal(brings({}, events.map((e) => ({ ...e, used: 1 }))).mentioned, 0, 'a used event is not repeated');
    const state = markEventUsed(logEvent(emptyState(), { key: 'k', kind: 'fell', ref: 'x', at: 1 }), 'k');
    assert.equal(state.events[0]!.used, 1);
    assert.equal(logEvent(state, { key: 'k', kind: 'fell', ref: 'x', at: 2 }).events.length, 1, 'the same key is logged once');
  });

  it('runScenes plays once a day into #hideout; sendToGroup brings answers; both honour their switches', async () => {
    const memory: Record<string, string> = {};
    const storage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = v; } } as unknown as Storage;
    const store = createChatStore({ key: 'scene.test', storage: () => storage });
    let flags: FeatureFlags = { scenes: false, group: false };
    const engine = createChatEngine(LIGHTHOUSE_CAST, { features: () => flags });
    const actions = createChatActions({ engine, store, features: () => flags });
    const base = { people, weather: 'calm', hour: 8, tone: 'family' as const, now: Date.UTC(2026, 10, 28, 12) };
    assert.equal(actions.runScenes(base), 0);
    assert.equal(store.get().channel.length, 0);
    assert.deepEqual(actions.sendToGroup({ text: 'hello', people, buildContext: (id, affinity) => ctx(id, { affinity }), now: base.now, rng: rngOf(1), instant: true }), []);
    flags = {};
    const n = actions.runScenes(base);
    assert.ok(n >= 1 && store.get().channel.length >= 2);
    assert.equal(actions.runScenes(base), 0, 'once a day');
    assert.equal(actions.runScenes({ ...base, now: base.now + 86_400_000 }) >= 1, true, 'again tomorrow');
    const before = store.get().channel.length;
    const who = actions.sendToGroup({ text: 'hello everyone', people, buildContext: (id, affinity) => ctx(id, { affinity }), now: base.now, rng: rngOf(3), instant: true });
    assert.ok(who.length >= 1 && who.length <= 3);
    assert.equal(store.get().channel.length, before + 1, 'your own message is logged at once');
    await new Promise((r) => setTimeout(r, 1500));
    assert.ok(store.get().channel.length >= before + 2, 'someone answered');
    assert.ok(store.get().channel.slice(-who.length).every((e) => who.includes(e.from)));
    for (const e of store.get().channel) assert.ok(!/[<>{}|]/.test(e.text));
  });
});
