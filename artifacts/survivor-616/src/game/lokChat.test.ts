import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { ALLIES } from '@/game/data/progression';
import { CREW_CONFIDES, CREW_RELATIONS, INTENT_TEMPLATES, PROACTIVE_LINES, RUN_LINES, type ChatIntent } from '@/game/data/lokChatData';
import {
  AFFINITY_THRESHOLDS,
  PROACTIVE_GAP_MS,
  WELCOME_BACK_MS,
  affinityGain,
  affinityTier,
  chooseProactive,
  composeReply,
  detectIntent,
  proactiveLine,
  quickReplies,
  replyToIntent,
  typingMs,
  type ChatContext,
  type ChatPerson,
} from '@/game/engine/lokChat';
import { createRng } from '@/game/engine/math';
import {
  CHANNEL_ENTRIES,
  MESSAGES_PER_THREAD,
  ME,
  addAffinity,
  appendMessage,
  emptyState,
  getLokChat,
  logChannel,
  markRead,
  normalizeLokChat,
  resetLokChatForTests,
  threadOf,
  totalUnread,
} from '@/game/state/lokChatStore';
import { deliver, logCrewLine, sendToAlly, setOpenThread, startProactive } from '@/game/state/lokChatActions';

const BANNED = /\b(signal\w*|damn\w*|hell|crap\w*|shit\w*|fuck\w*|bitch\w*|bastard\w*|ass|piss\w*|sex\w*|kill\w*|murder\w*|blood\w*|gore|drunk|drugs?|weed|beer|whiskey)\b/i;
const WEATHERS = ['clear', 'rain', 'fog', 'snow', 'heat'] as const;
const people: ChatPerson[] = ALLIES.map((a) => ({ id: a.id, name: a.name, role: a.role }));

const ctxFor = (id: string, extra: Partial<ChatContext> = {}): ChatContext => {
  const self = people.find((p) => p.id === id)!;
  return {
    self,
    others: people.filter((p) => p.id !== id),
    roomName: 'The Cellar',
    crewHere: ['Vee', 'Nyx'],
    weather: 'rain',
    hour: 20,
    lastRun: { cleared: true, kills: 120, areaName: 'Monroe Strip' },
    petName: 'Biscuit',
    tone: 'family',
    affinity: 0,
    ...extra,
  };
};

describe('LOK Chat understanding', () => {
  it('maps typed messages to intents', () => {
    const cases: Array<[string, ChatIntent]> = [
      ['hey!', 'greet'], ['hello there', 'greet'], ['how are you?', 'howAreYou'], ["how's it going", 'howAreYou'],
      ['what do you do here', 'work'], ['who are you', 'work'], ['where are you', 'room'],
      ['how did my last run go', 'run'], ['tell me a joke', 'joke'], ['how is my pet', 'pet'],
      ['is it raining', 'weather'], ['any advice?', 'advice'], ['thanks!', 'thanks'], ['bye', 'bye'],
      ['tell me something real', 'confide'], ["what's up", 'story'], ['asdfgh', 'unknown'], ['', 'unknown'],
    ];
    for (const [text, intent] of cases) assert.equal(detectIntent(text, people).intent, intent, `"${text}"`);
  });

  it('notices another crew member by name, first name or id, and prefers strong intents', () => {
    assert.equal(detectIntent('what do you think of Vee?', people).subject?.id, 'vee');
    assert.equal(detectIntent('tell me about sister constance', people).intent, 'crew');
    assert.equal(detectIntent('what about patch mercer', people).subject?.id, 'patch-mercer');
    assert.equal(detectIntent('thanks vee', people).intent, 'thanks', 'a thank-you stays a thank-you');
    assert.equal(detectIntent('hey nyx', people).intent, 'crew');
  });

  it('caps absurdly long messages and never throws on odd input', () => {
    assert.doesNotThrow(() => detectIntent('a'.repeat(50_000), people));
    assert.doesNotThrow(() => detectIntent('<script>alert(1)</script> {{|}} \u0000', people));
  });
});

describe('LOK Chat replies', () => {
  it('is deterministic for a seed and varied across seeds', () => {
    const a = composeReply('how are you', ctxFor('vee'), createRng(5));
    const b = composeReply('how are you', ctxFor('vee'), createRng(5));
    assert.equal(a.text, b.text);
    const distinct = new Set(Array.from({ length: 120 }, (_, i) => composeReply('tell me something', ctxFor('vee'), createRng(i)).text));
    assert.ok(distinct.size > 60, `only ${distinct.size} distinct story replies`);
  });

  it('never echoes what the player typed', () => {
    const reply = composeReply('zebrafish quokka marmalade', ctxFor('vee'), createRng(2));
    assert.ok(!/zebrafish|quokka|marmalade/i.test(reply.text));
  });

  it('uses live context: the area, the pet, the crew in the room', () => {
    assert.match(replyToIntent({ intent: 'run' }, ctxFor('vee'), createRng(1)).text, /Monroe Strip/);
    assert.match(replyToIntent({ intent: 'pet' }, ctxFor('vee'), createRng(1)).text, /Biscuit/);
    assert.match(replyToIntent({ intent: 'pet' }, ctxFor('vee', { petName: undefined }), createRng(1)).text, /LokPet/);
    assert.match(replyToIntent({ intent: 'room' }, ctxFor('vee'), createRng(1)).text, /Cellar/);
    const fell = replyToIntent({ intent: 'run' }, ctxFor('vee', { lastRun: { cleared: false, kills: 5, areaName: 'Old Market' } }), createRng(1)).text;
    assert.match(fell, /Old Market/);
  });

  it('answers questions about other crew from authored opinions, with a role-based fallback', () => {
    const vee = people.find((p) => p.id === 'mamajo')!;
    assert.equal(replyToIntent({ intent: 'crew', subject: vee }, ctxFor('vee'), createRng(1)).text, CREW_RELATIONS.vee!.mamajo);
    const ruth = people.find((p) => p.id === 'ruth')!;
    const fallback = replyToIntent({ intent: 'crew', subject: ruth }, ctxFor('sarge'), createRng(1)).text;
    assert.match(fallback, /Ruth/);
    assert.match(fallback, /market stall keeper/i);
  });

  it('keeps confidences for people you know, and says so politely when you do not yet', () => {
    const stranger = replyToIntent({ intent: 'confide' }, ctxFor('vee', { affinity: 0 }), createRng(1)).text;
    assert.ok(!CREW_CONFIDES.vee!.includes(stranger));
    const friend = replyToIntent({ intent: 'confide' }, ctxFor('vee', { affinity: AFFINITY_THRESHOLDS.friend }), createRng(1)).text;
    assert.ok(CREW_CONFIDES.vee!.includes(friend));
  });

  it('avoids repeating recent lines', () => {
    const first = replyToIntent({ intent: 'story' }, ctxFor('deacon'), createRng(9));
    const second = replyToIntent({ intent: 'story' }, ctxFor('deacon'), createRng(9), [first.text]);
    assert.notEqual(second.text, first.text);
  });

  it('every ally and every intent renders clean, resolved, banned-word-free text in both tones', () => {
    const intents: ChatIntent[] = ['greet', 'howAreYou', 'work', 'room', 'crew', 'run', 'pet', 'weather', 'advice', 'joke', 'story', 'confide', 'thanks', 'bye', 'unknown'];
    for (const ally of ALLIES) {
      for (const tone of ['family', 'wry'] as const) {
        for (const intent of intents) {
          for (let seed = 0; seed < 25; seed += 1) {
            const subject = people[(seed + 3) % people.length]!;
            const ctx = ctxFor(ally.id, { tone, weather: WEATHERS[seed % 5]!, affinity: seed % 3 === 0 ? 60 : seed % 3 === 1 ? 15 : 0, lastRun: seed % 4 === 0 ? undefined : { cleared: seed % 2 === 0, kills: seed, areaName: 'Monroe Strip' }, petName: seed % 5 === 0 ? undefined : 'Biscuit' });
            const { text } = replyToIntent({ intent, subject }, ctx, createRng(seed * 977 + 13));
            assert.ok(text.length > 6, `${ally.id}/${intent}: "${text}"`);
            assert.ok(!/[<>{}|]/.test(text), `unresolved markup in ${ally.id}/${intent}: ${text}`);
            assert.ok(!BANNED.test(text), `banned word in ${ally.id}/${intent}/${tone}: ${text}`);
            assert.ok(text.length < 360, `too long (${text.length}) in ${ally.id}/${intent}`);
          }
        }
      }
    }
  });

  it('scans every authored source string for banned words too', () => {
    const strings: string[] = [];
    for (const t of Object.values(INTENT_TEMPLATES)) strings.push(...t.family, ...t.wry);
    for (const set of Object.values(RUN_LINES)) strings.push(...set.family, ...set.wry);
    for (const list of Object.values(PROACTIVE_LINES)) strings.push(...list);
    for (const list of Object.values(CREW_CONFIDES)) strings.push(...list);
    for (const map of Object.values(CREW_RELATIONS)) strings.push(...Object.values(map));
    for (const s of strings) assert.ok(!BANNED.test(s), `banned word in authored text: ${s}`);
  });

  it('has authored confidences for every ally, and relations only between real allies', () => {
    const ids = new Set(ALLIES.map((a) => a.id));
    for (const ally of ALLIES) assert.ok((CREW_CONFIDES[ally.id]?.length ?? 0) >= 2, `${ally.id} has no confidences`);
    for (const [speaker, map] of Object.entries(CREW_RELATIONS)) {
      assert.ok(ids.has(speaker), `${speaker} is not an ally`);
      for (const subject of Object.keys(map)) assert.ok(ids.has(subject), `${speaker} has an opinion about ${subject}, who is not an ally`);
    }
  });

  it('paces typing by reply length within bounds', () => {
    assert.equal(typingMs('ok'), 700);
    assert.ok(typingMs('x'.repeat(500)) <= 2600);
    assert.ok(typingMs('x'.repeat(60)) > typingMs('x'.repeat(10)));
  });
});

describe('LOK Chat relationships and suggestions', () => {
  it('moves through tiers, rewards new topics over repeats and nothing for nonsense', () => {
    assert.equal(affinityTier(0), 'new');
    assert.equal(affinityTier(AFFINITY_THRESHOLDS.friend), 'friend');
    assert.equal(affinityTier(AFFINITY_THRESHOLDS.close), 'close');
    assert.ok(affinityGain('story', 0) > affinityGain('story', 1));
    assert.equal(affinityGain('story', 9), 0);
    assert.equal(affinityGain('unknown', 0), 0);
  });

  it('suggests things you have not asked yet, only offers real ones, and unlocks confidences with friendship', () => {
    const fresh = quickReplies(ctxFor('vee'), {});
    assert.ok(fresh.length <= 5 && fresh.length > 0);
    assert.ok(!fresh.some((q) => q.intent === 'confide'), 'not before you are friends');
    const asked = quickReplies(ctxFor('vee'), { howAreYou: 3, story: 3 });
    assert.ok(!asked.slice(0, 2).some((q) => q.intent === 'howAreYou' || q.intent === 'story'), 'asked-before topics sink');
    assert.ok(quickReplies(ctxFor('vee', { affinity: 50 }), {}, 10).some((q) => q.intent === 'confide'));
    assert.ok(!quickReplies(ctxFor('vee', { lastRun: undefined, petName: undefined }), {}, 10).some((q) => q.intent === 'run' || q.intent === 'pet'));
  });
});

describe('LOK Chat proactive messages', () => {
  const NOW = 10 * 24 * 3600 * 1000;
  const cand = (id: string, extra = {}) => ({ id, affinity: 0, lastProactiveAt: 0, lastActivityAt: 0, ...extra });

  it('reacts to a fresh run once, from the closest people first, and respects the gap', () => {
    const picks = chooseProactive({ now: NOW, hour: 14, freshRun: { cleared: true }, candidates: [cand('a', { affinity: 5 }), cand('b', { affinity: 30 }), cand('c', { affinity: 9 })] });
    assert.deepEqual(picks.map((p) => p.id), ['b', 'c']);
    assert.ok(picks.every((p) => p.kind === 'afterRunCleared'));
    const spent = chooseProactive({ now: NOW, hour: 14, freshRun: { cleared: false }, candidates: [cand('a', { lastProactiveAt: NOW - PROACTIVE_GAP_MS + 1000 })] });
    assert.equal(spent.length, 0);
  });

  it('welcomes you back after a long absence, and says good morning only to friends', () => {
    const away = chooseProactive({ now: NOW, hour: 14, candidates: [cand('a', { lastActivityAt: NOW - WELCOME_BACK_MS - 1 })] });
    assert.deepEqual(away, [{ id: 'a', kind: 'welcomeBack' }]);
    assert.equal(chooseProactive({ now: NOW, hour: 8, candidates: [cand('a', { affinity: 0 })] }).length, 0);
    assert.deepEqual(chooseProactive({ now: NOW, hour: 8, candidates: [cand('a', { affinity: 20 })] }), [{ id: 'a', kind: 'morning' }]);
    assert.equal(chooseProactive({ now: NOW, hour: 14, candidates: [cand('a', { affinity: 20 })] }).length, 0, 'nothing to say at two in the afternoon');
  });

  it('every kind renders clean text', () => {
    for (const kind of Object.keys(PROACTIVE_LINES) as Array<keyof typeof PROACTIVE_LINES>) {
      for (const ally of ALLIES) for (let seed = 0; seed < 10; seed += 1) {
        const text = proactiveLine(kind, ctxFor(ally.id), createRng(seed));
        assert.ok(text.length > 5 && !/[<>{}|]/.test(text) && !BANNED.test(text), `${kind}/${ally.id}: ${text}`);
      }
    }
  });
});

describe('LOK Chat store', () => {
  beforeEach(() => resetLokChatForTests());

  it('appends, trims, counts unread and marks read', () => {
    let s = emptyState();
    for (let i = 0; i < MESSAGES_PER_THREAD + 20; i += 1) s = appendMessage(s, 'vee', { id: String(i), from: i % 2 ? ME : 'vee', text: `m${i}`, at: i }, { unread: true });
    assert.equal(threadOf(s, 'vee').messages.length, MESSAGES_PER_THREAD);
    assert.ok(totalUnread(s) > 0);
    assert.equal(totalUnread(markRead(s, 'vee')), 0);
    assert.ok(threadOf(s, 'vee').recent.length <= 12, 'only their last lines are remembered');
  });

  it('reports the tier you just reached, once', () => {
    let s = emptyState();
    const a = addAffinity(s, 'vee', AFFINITY_THRESHOLDS.friend - 1);
    assert.equal(a.tierUp, undefined);
    const b = addAffinity(a.state, 'vee', 1);
    assert.equal(b.tierUp, 'friend');
    assert.equal(addAffinity(b.state, 'vee', 1).tierUp, undefined);
    s = b.state;
    assert.equal(threadOf(s, 'vee').affinity, AFFINITY_THRESHOLDS.friend);
  });

  it('keeps the channel short and drops immediate duplicates', () => {
    let s = emptyState();
    for (let i = 0; i < CHANNEL_ENTRIES + 10; i += 1) s = logChannel(s, { id: String(i), from: 'vee', text: `line ${i}`, at: i });
    assert.equal(s.channel.length, CHANNEL_ENTRIES);
    const again = logChannel(s, { id: 'x', from: 'vee', text: s.channel[s.channel.length - 1]!.text, at: 1 });
    assert.equal(again, s);
  });

  it('survives garbage in storage without throwing, keeping only what it can trust', () => {
    for (const junk of [null, 5, 'x', [], { threads: 5 }, { threads: { vee: { messages: 'no' } } }, { channel: [{ text: 5 }] }]) assert.doesNotThrow(() => normalizeLokChat(junk));
    const ok = normalizeLokChat({ threads: { vee: { messages: [{ from: 'me', text: 'hi', at: 1 }, { from: 5, text: 'bad' }], affinity: 9999, unread: 99 } }, channel: [{ from: 'vee', text: 'yo', at: 2 }] });
    const t = threadOf(ok, 'vee');
    assert.equal(t.messages.length, 1);
    assert.equal(t.affinity, 100, 'clamped');
    assert.equal(t.unread, 1, 'cannot exceed the messages that exist');
    assert.equal(ok.channel.length, 1);
  });
});

describe('LOK Chat actions', () => {
  beforeEach(() => resetLokChatForTests());
  const build = (id: string, affinity: number) => ctxFor(id, { affinity });

  it('sends a message, scores it, and delivers the reply as unread when that chat is closed', async () => {
    setOpenThread(null);
    const sent = sendToAlly({ allyId: 'vee', text: 'how are you?', buildContext: build, now: 1000, rng: createRng(4), instant: true });
    assert.equal(sent.reply.intent, 'howAreYou');
    let t = threadOf(getLokChat(), 'vee');
    assert.equal(t.messages.length, 1);
    assert.equal(t.messages[0]!.from, ME);
    assert.ok(t.affinity > 0, 'a new topic earns affinity');
    await new Promise((resolve) => setTimeout(resolve, 400));
    t = threadOf(getLokChat(), 'vee');
    assert.equal(t.messages.length, 2);
    assert.equal(t.messages[1]!.from, 'vee');
    assert.equal(t.unread, 1);
    assert.ok(t.recent.includes(t.messages[1]!.text));
  });

  it('does not mark replies unread when you are looking at that chat', async () => {
    setOpenThread('deacon');
    sendToAlly({ allyId: 'deacon', text: 'hello', buildContext: build, now: 5, rng: createRng(1), instant: true });
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(threadOf(getLokChat(), 'deacon').unread, 0);
    setOpenThread(null);
  });

  it('crew react to a run once, and the channel logs what they say', () => {
    const RUN_NOW = 400 * 3600 * 1000;
    const run = { key: 'monroe|120|90', cleared: true };
    const first = startProactive({ allyIds: ['vee', 'deacon', 'nyx'], buildContext: build, now: RUN_NOW, hour: 15, rng: createRng(2), run });
    assert.ok(first > 0 && first <= 2);
    const second = startProactive({ allyIds: ['vee', 'deacon', 'nyx'], buildContext: build, now: RUN_NOW + 1, hour: 15, rng: createRng(3), run });
    assert.equal(second, 0, 'they have already reacted');
    deliver('vee', 'A direct line.', 60_000);
    logCrewLine('nyx', 'Mind the wet paint.', 'The Roof', 61_000);
    assert.equal(getLokChat().channel.at(-1)?.roomName, 'The Roof');
  });
});
