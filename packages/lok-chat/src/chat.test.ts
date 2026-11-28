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
    assert.ok(!/signal|zebra/i.test(feeling.text));
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
