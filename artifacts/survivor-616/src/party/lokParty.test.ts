import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BeatBus,
  Coyote,
  HitStop,
  InputBuffer,
  JUICE,
  SpringCamera,
  Squash,
  hitStopMs,
  nextChime,
  pentatonicHz,
  ringProgress,
} from './juiceEngine';
import {
  GRADES,
  KEY_FRAGMENTS_PER_KEY,
  LOK_PARTY_META_KEY,
  PARTY_COSMETICS,
  applyLp,
  applyMatch,
  createLokPartyMeta,
  emptyLadder,
  exportFlex,
  forgeShard,
  gradeFor,
  levelFromPoints,
  loadLokPartyMeta,
  markGrantPaid,
  openCapsule,
  passBonusShards,
  pendingGrants,
  rerollShards,
  sanitizeLokPartyMeta,
  saveLokPartyMeta,
  startSplit,
  type MatchPerformance,
} from './lokPartyMeta';
import { DROP, createLokDrop, dropPerformance, dropResults, stepLokDrop } from './lokDrop';

// ---------------------------------------------------------------- juice

test('hit-stop stays inside 45-75 ms and a light hit never shortens a heavy one', () => {
  assert.equal(hitStopMs(0), 45);
  assert.equal(hitStopMs(1), 75);
  assert.equal(hitStopMs(9), 75);
  const h = new HitStop();
  h.hit(0, 1);
  h.hit(10, 0);
  assert.equal(h.frozen(74), true);
  assert.equal(h.frozen(76), false);
  assert.equal(h.simDt(20, 16), 0);
});

test('zoom punch peaks between 8 and 14 percent and springs back to rest', () => {
  const cam = new SpringCamera();
  cam.punch(0.5); // clamped to 14 percent
  let peak = 1;
  for (let i = 0; i < 120; i += 1) {
    cam.step(1000 / 60);
    peak = Math.max(peak, cam.zoomValue);
  }
  assert.ok(peak > 1.06 && peak < 1.16, `peak ${peak}`);
  assert.ok(Math.abs(cam.zoomValue - 1) < 0.005, `rest ${cam.zoomValue}`);
});

test('reduced motion removes shake and zoom', () => {
  const cam = new SpringCamera();
  cam.motion = 0;
  cam.punch(0.14);
  cam.addTrauma(1);
  cam.step(16);
  const s = cam.shake();
  assert.equal(Math.abs(s.dx), 0);
  assert.equal(cam.zoomValue, 1);
});

test('squash lands at 1.25 x 0.78 and launches at 0.85 x 1.2, then recovers', () => {
  const sq = new Squash();
  sq.land();
  assert.equal(sq.scaleX, JUICE.squashLand.x);
  assert.equal(sq.scaleY, JUICE.squashLand.y);
  sq.launch();
  assert.equal(sq.scaleX, JUICE.squashLaunch.x);
  for (let i = 0; i < 90; i += 1) sq.step(1000 / 60);
  assert.ok(Math.abs(sq.scaleX - 1) < 0.01);
});

test('input buffer holds a press for 100 ms; coyote grace lasts 80 ms', () => {
  const b = new InputBuffer<'dash'>();
  b.press('dash', 1000);
  assert.equal(b.consume('dash', 1099), true);
  assert.equal(b.consume('dash', 1099), false);
  b.press('dash', 2000);
  assert.equal(b.consume('dash', 2101), false);
  const c = new Coyote();
  c.mark(500);
  assert.equal(c.ok(580), true);
  assert.equal(c.ok(581), false);
});

test('pentatonic ladder climbs in tune and resets after a pause', () => {
  assert.equal(pentatonicHz(0).toFixed(2), '523.25');
  assert.equal(pentatonicHz(5).toFixed(2), (523.25 * 2).toFixed(2));
  let l = { step: 0, lastMs: -Infinity };
  l = nextChime(l, 0);
  l = nextChime(l, 100);
  l = nextChime(l, 200);
  assert.equal(l.step, 2);
  l = nextChime(l, 200 + JUICE.chimeIdleResetMs + 1);
  assert.equal(l.step, 0);
});

test('beat bus quantizes onto the sixteenth grid', () => {
  const bus = new BeatBus(120, 0);
  assert.equal(bus.quantize(0.01, 4), 0.125);
  assert.equal(bus.quantize(0.125, 4), 0.125);
  assert.ok(bus.pulse(0) > 0.99);
});

test('refraction ring lives 180 ms', () => {
  const w = { x: 0, y: 0, bornMs: 0, strength: 1 };
  assert.equal(ringProgress(w, 0), 0);
  assert.equal(ringProgress(w, JUICE.ringMs), 1);
});

// ---------------------------------------------------------------- meta

const perf = (over: Partial<MatchPerformance> = {}): MatchPerformance => ({
  characterId: 'zero-day',
  placement: 1,
  players: 4,
  objective: 1,
  skill: 1,
  clutch: 3,
  risk: 1,
  ...over,
});
const NOW = new Date(2026, 10, 26, 12).getTime();

test('grades span C to S+ in order', () => {
  assert.equal(GRADES[0], 'C');
  assert.equal(GRADES[GRADES.length - 1], 'S+');
  assert.equal(gradeFor(0), 'C');
  assert.equal(gradeFor(100), 'S+');
});

test('a dominant win grades S+, earns a capsule once per split and pays first-win bridge grants once a day', () => {
  let meta = createLokPartyMeta();
  const a = applyMatch(meta, perf(), { nowMs: NOW, seed: 1, ladder: 'solo' });
  assert.equal(a.report.grade, 'S+');
  assert.equal(a.report.capsuleEarned, true);
  assert.equal(a.report.firstWinOfDay, true);
  assert.equal(a.report.bridgeGrants.length, 2);
  assert.ok(a.report.bridgeGrants.every((g) => g.amount <= 15), 'bridge stays inside 616 per-grant cap');
  meta = a.meta;
  const b = applyMatch(meta, perf(), { nowMs: NOW + 60_000, seed: 2, ladder: 'solo' });
  assert.equal(b.report.capsuleEarned, false, 'one capsule per character per split');
  assert.equal(b.report.firstWinOfDay, false);
  assert.equal(b.report.bridgeGrants.length, 0);
  const other = applyMatch(b.meta, perf({ characterId: 'shade' }), { nowMs: NOW + 120_000, seed: 3, ladder: 'solo' });
  assert.equal(other.report.capsuleEarned, true, 'mastering another character earns another');
});

test('bridge grants are one-way and idempotent', () => {
  const { meta } = applyMatch(createLokPartyMeta(), perf(), { nowMs: NOW, seed: 1, ladder: 'solo' });
  const g = pendingGrants(meta, 'survivor616');
  assert.equal(g.length, 1);
  assert.equal(g[0].kind, 'cred');
  const paid = markGrantPaid(meta, g[0].id);
  assert.equal(pendingGrants(paid, 'survivor616').length, 0);
  assert.equal(markGrantPaid(paid, g[0].id), paid);
});

test('mastery is gated by Marks of Mastery at level 5', () => {
  assert.equal(levelFromPoints(0), 1);
  assert.equal(levelFromPoints(11800), 10);
  assert.equal(levelFromPoints(11800 + 2500 * 3), 13);
  let meta = createLokPartyMeta();
  // C grades only: points climb, but no marks, so level stops at 4.
  for (let i = 0; i < 60; i += 1) meta = applyMatch(meta, perf({ placement: 4, objective: 0, skill: 0, clutch: 0, risk: 0 }), { nowMs: NOW + i, seed: i, ladder: 'solo', ranked: false }).meta;
  assert.equal(meta.characters['zero-day'].level, 4);
});

test('ranked LP climbs divisions, protects tier floors and unlocks Victorious at Gold', () => {
  let l = emptyLadder();
  l = applyLp(l, -30, false);
  assert.equal(l.lp, 0, 'Iron IV floor');
  l = applyLp(l, 130, true);
  assert.equal(l.division, 3);
  assert.equal(l.lp, 30);
  // Bronze IV with 0 LP cannot fall back to Iron.
  const bronze = { ...emptyLadder(), tier: 1, division: 4, lp: 0 };
  assert.equal(applyLp(bronze, -20, false).tier, 1);
  let meta = createLokPartyMeta();
  meta = { ...meta, ladders: { ...meta.ladders, solo: { ...emptyLadder(), tier: 2, division: 1, lp: 95 } } };
  const r = applyMatch(meta, perf(), { nowMs: NOW, seed: 1, ladder: 'solo' });
  assert.equal(r.report.lpAfter.tier, 3);
  assert.equal(r.report.victoriousUnlocked, true);
  assert.ok(exportFlex(r.meta).includes('victorious-aura:split-1'));
});

test('two ladders move independently', () => {
  const r = applyMatch(createLokPartyMeta(), perf(), { nowMs: NOW, seed: 1, ladder: 'crew' });
  assert.ok(r.meta.ladders.crew.lp > 0);
  assert.equal(r.meta.ladders.solo.lp, 0);
});

test('split pass: 50 tiers, then a bonus shard every 500 XP forever', () => {
  assert.equal(passBonusShards(50_000), 0);
  assert.equal(passBonusShards(51_499), 2);
  let meta = createLokPartyMeta();
  meta = { ...meta, pass: { ...meta.pass, xp: 50_000 } };
  const r = applyMatch(meta, perf(), { nowMs: NOW, seed: 9, ladder: 'solo' });
  assert.ok(r.report.bonusShards.length >= 1);
  assert.equal(r.meta.vault.shards.length, r.report.bonusShards.length);
});

test('Beacon Key fragments: 3 make a key; capsules need a key to open', () => {
  let meta = createLokPartyMeta();
  meta = { ...meta, vault: { ...meta.vault, keyFragments: KEY_FRAGMENTS_PER_KEY - 1, capsules: 1 } };
  assert.equal(openCapsule(meta, 1), null);
  const r = applyMatch(meta, perf({ placement: 4, objective: 0, skill: 0, clutch: 0, risk: 0 }), { nowMs: NOW, seed: 1, ladder: 'solo' });
  assert.equal(r.meta.vault.keys, 1);
  const opened = openCapsule(r.meta, 5);
  assert.ok(opened);
  assert.equal(opened!.shards.length, 2);
  assert.equal(opened!.meta.vault.capsules, 0);
});

test('3-to-1 reroll always grants something new and permanent', () => {
  let meta = createLokPartyMeta();
  const ids = PARTY_COSMETICS.slice(0, 3).map((c) => c.id);
  meta = { ...meta, vault: { ...meta.vault, shards: ids.map((cosmeticId, i) => ({ uid: `s${i}`, cosmeticId })), owned: [ids[0]] } };
  const r = rerollShards(meta, ['s0', 's1', 's2'], 42);
  assert.ok(r);
  assert.ok(!meta.vault.owned.includes(r!.unlocked.id));
  assert.equal(r!.meta.vault.shards.length, 0);
  assert.equal(rerollShards(meta, ['s0', 's1'], 1), null);
  assert.equal(rerollShards(meta, ['s0', 's0', 's1'], 1), null);
});

test('forging costs dust and never duplicates', () => {
  let meta = createLokPartyMeta();
  meta = { ...meta, vault: { ...meta.vault, dust: 10_000, shards: [{ uid: 'a', cosmeticId: 'hat-relay-cap' }] } };
  const f = forgeShard(meta, 'a');
  assert.ok(f && f.vault.owned.includes('hat-relay-cap'));
  assert.equal(forgeShard({ ...f!, vault: { ...f!.vault, shards: [{ uid: 'b', cosmeticId: 'hat-relay-cap' }] } }, 'b'), null);
});

test('new split resets capsule eligibility and soft-resets ladders', () => {
  let meta = createLokPartyMeta();
  meta = { ...meta, vault: { ...meta.vault, earnedThisSplit: ['zero-day'] }, ladders: { ...meta.ladders, solo: { ...emptyLadder(), tier: 4, division: 2, lp: 50 } } };
  const next = startSplit(meta, 2);
  assert.deepEqual(next.vault.earnedThisSplit, []);
  assert.equal(next.ladders.solo.tier, 3);
  assert.equal(next.pass.xp, 0);
});

test('save round-trips under its own key and a corrupt save never throws', () => {
  const store = new Map<string, string>();
  const kv = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  const { meta } = applyMatch(createLokPartyMeta(), perf(), { nowMs: NOW, seed: 1, ladder: 'solo' });
  saveLokPartyMeta(kv, meta);
  assert.deepEqual([...store.keys()], [LOK_PARTY_META_KEY]);
  assert.equal(loadLokPartyMeta(kv).matches, 1);
  store.set(LOK_PARTY_META_KEY, '{nope');
  assert.equal(loadLokPartyMeta(kv).matches, 0);
  assert.equal(sanitizeLokPartyMeta({ version: 1, ladders: { solo: { tier: 99, lp: -5 } } }).ladders.solo.tier, 8);
});

// ---------------------------------------------------------------- Lok Drop

const ROSTER = [
  { characterId: 'zero-day', bot: true, botSkill: 0.8 },
  { characterId: 'shade', bot: true, botSkill: 0.6 },
  { characterId: 'quarry-kid', bot: true, botSkill: 0.5 },
  { characterId: 'golden-hour', bot: true, botSkill: 0.3 },
];

function runFull(seed: number) {
  const s = createLokDrop(seed, ROSTER);
  const kinds = new Set<string>();
  while (!s.over) {
    stepLokDrop(s, [null, null, null, null], 1000 / 60);
    for (const e of s.events) kinds.add(e.kind);
  }
  return { s, kinds };
}

test('a full 60-second match with four bots ends, banks loot and slams the vault', () => {
  const { s, kinds } = runFull(616);
  assert.equal(s.over, true);
  assert.ok(Math.abs(s.now - DROP.durationMs) < 20);
  assert.ok(s.players.some((p) => p.banked > 0), 'someone banked');
  assert.ok(s.players.every((p) => p.carried === 0), 'slam empties pockets');
  for (const k of ['capsule-crack', 'pickup', 'bank', 'ring-move', 'slam']) assert.ok(kinds.has(k), `missing ${k}`);
  const res = dropResults(s);
  assert.deepEqual(res.map((r) => r.placement), [1, 2, 3, 4]);
  assert.ok(res[0].banked >= res[1].banked);
});

test('Lok Drop is deterministic for a seed', () => {
  const a = runFull(77).s.players.map((p) => p.banked);
  const b = runFull(77).s.players.map((p) => p.banked);
  assert.deepEqual(a, b);
});

test('a dash into a carrying rival spills their loot', () => {
  const s = createLokDrop(1, [
    { characterId: 'zero-day', bot: false },
    { characterId: 'shade', bot: false },
  ]);
  const [a, b] = s.players;
  a.x = 400;
  a.y = 300;
  b.x = 460;
  b.y = 300;
  b.carried = 20;
  s.now = 7000;
  stepLokDrop(s, [{ mx: 1, my: 0, dashPressed: true }, { mx: 0, my: 0, dashPressed: false }], 1000 / 60);
  for (let i = 0; i < 10 && b.carried === 20; i += 1) stepLokDrop(s, [{ mx: 1, my: 0, dashPressed: false }, null], 1000 / 60);
  assert.equal(b.carried, 10);
  assert.equal(a.knockouts, 1);
});

test('the match result maps into the meta engine', () => {
  const { s } = runFull(5);
  const r = dropResults(s)[0];
  const out = applyMatch(createLokPartyMeta(), dropPerformance(s, r), { nowMs: NOW, seed: 1, ladder: 'solo' });
  assert.equal(out.meta.matches, 1);
  assert.ok(GRADES.includes(out.report.grade));
});

// ---------------------------------------------------------------- Slice 2

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PULL, createPull, pullHold, pullStep, pullSwipe, pullTap, seamGlow } from './capsulePull';
import { botSkillsForTier } from './lokDrop';

test('capsule: taps crack it through two stages, then burst and reveal each reward', () => {
  const s = createPull(2);
  const kinds: string[] = [];
  let now = 0;
  for (let i = 0; i < 5; i += 1) kinds.push(...pullTap(s, (now += 100)).map((e) => e.kind));
  assert.deepEqual(kinds, ['stage', 'stage', 'burst']);
  assert.equal(seamGlow(s, now), 1);
  const reveal = pullStep(s, PULL.burstMs, (now += PULL.burstMs));
  assert.deepEqual(reveal, [{ kind: 'reveal', index: 0 }]);
  assert.deepEqual(pullTap(s, now + 10), [], 'a too-quick tap cannot skip a reveal');
  assert.deepEqual(pullTap(s, (now += PULL.revealMinMs)), [{ kind: 'reveal', index: 1 }]);
  assert.deepEqual(pullTap(s, (now += PULL.revealMinMs)), [{ kind: 'done' }]);
});

test('capsule: holding and swiping crack it; letting go leaks crack slowly', () => {
  const s = createPull(1);
  pullHold(s, true, 0);
  for (let t = 16; t <= 1000; t += 16) pullStep(s, 16, t);
  assert.ok(s.crack > 0.5 && s.crack < 0.6, `hold ${s.crack}`);
  pullHold(s, false, 1000);
  pullStep(s, 1000, 2500);
  assert.ok(s.crack < 0.5, 'leaks after the delay');
  const w = createPull(1);
  pullSwipe(w, 400, 0);
  assert.equal(w.phase, 'burst');
});

test('Solo Blitz bots sharpen with rank and stay beatable', () => {
  const iron = botSkillsForTier(0);
  const apex = botSkillsForTier(8);
  assert.ok(iron.every((v, i) => v < apex[i]));
  assert.ok(apex.every((v) => v <= 0.95));
  assert.ok(Math.min(...apex) < Math.max(...apex), 'one softer bot per match');
  assert.deepEqual(botSkillsForTier(NaN), botSkillsForTier(0));
});

test('Lok Party engines stay free of game imports (so the mode can become its own game)', () => {
  for (const f of ['juiceEngine.ts', 'lokPartyMeta.ts', 'lokDrop.ts', 'capsulePull.ts']) {
    const src = readFileSync(fileURLToPath(new URL(`./${f}`, import.meta.url)), 'utf8');
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    assert.ok(imports.every((p) => p.startsWith('./')), `${f} imports ${imports.join(', ')}`);
  }
});

// ---------------------------------------------------------------- Slice 3: board

import { MONROE_LOOP } from './boards/monroeLoop';
import { CROWN_COST, boardAct, boardAdvance, boardMinigameResult, boardStandings, botAction, createBoardGame, hopDistance, nodeMap, type BoardState } from './lokBoard';

const BOARD_ROSTER = ['zero-day', 'shade', 'quarry-kid', 'golden-hour'].map((characterId) => ({ characterId, bot: true }));

function playBoard(seed: number, rounds = 10) {
  const s = createBoardGame(seed, MONROE_LOOP, BOARD_ROSTER, rounds);
  const seen = new Set<string>();
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 20000) {
    if (s.phase === 'minigame') {
      const order = [0, 1, 2, 3].sort(() => s.rng() - 0.5);
      boardMinigameResult(s, order.map((_, i) => order.indexOf(i) + 1));
    } else if (s.pending) boardAct(s, botAction(s)!);
    else boardAdvance(s);
    for (const e of s.events) seen.add(e.kind === 'hop' ? `hop:${e.via}` : e.kind);
  }
  return { s, seen };
}

test('board: every node links forward and the whole loop is reachable from start', () => {
  const map = nodeMap(MONROE_LOOP);
  for (const n of MONROE_LOOP.nodes) {
    assert.ok(n.next.length > 0, `${n.id} is a dead end`);
    for (const t of n.next) assert.ok(map[t], `${n.id} -> missing ${t}`);
    assert.ok(Number.isFinite(hopDistance(MONROE_LOOP, MONROE_LOOP.start, n.id)), `${n.id} unreachable`);
  }
  for (const id of MONROE_LOOP.crownSpots) assert.ok(map[id], `crown spot ${id}`);
});

test('board: a 10-round bot game finishes with crowns, minigames, overtime and two bonus crowns', () => {
  const { s, seen } = playBoard(616);
  assert.equal(s.phase, 'over');
  assert.equal(s.bonus.length, 2);
  for (const k of ['roll', 'land', 'minigame', 'crown-bought', 'overtime', 'vendor-move', 'game-over']) assert.ok(seen.has(k), `missing ${k}`);
  assert.ok(s.players.reduce((n, p) => n + p.crowns, 0) >= 2);
  assert.deepEqual(boardStandings(s).map((r) => r.place), [1, 2, 3, 4]);
});

test('board: elevation traversals all get used across a few games', () => {
  const all = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5, 6]) for (const k of playBoard(seed).seen) all.add(k);
  for (const v of ['hop:walk', 'hop:ladder', 'hop:bridge-over', 'hop:stairs', 'hop:slide']) assert.ok(all.has(v), `never saw ${v}`);
});

test('board: is deterministic for a seed', () => {
  const a = playBoard(42).s.players.map((p) => [p.coins, p.crowns]);
  const b = playBoard(42).s.players.map((p) => [p.coins, p.crowns]);
  assert.deepEqual(a, b);
});

test('board: passing Lok the Owl with 20 coins offers a crown; buying moves the owl', () => {
  const s: BoardState = createBoardGame(3, MONROE_LOOP, BOARD_ROSTER, 10);
  const p = s.players[0];
  p.coins = 25;
  p.node = 'T7';
  s.vendor = 'T8';
  s.pending = { type: 'roll', useSignature: false };
  p.customValue = 3;
  boardAct(s, { type: 'roll', signature: false });
  boardAdvance(s);
  assert.deepEqual(s.pending, { type: 'crown' });
  boardAct(s, { type: 'crown', buy: true });
  assert.equal(p.crowns, 1);
  assert.equal(p.coins, 25 - CROWN_COST);
  assert.notEqual(s.vendor, 'T8');
  assert.equal(s.phase, 'move', 'keeps walking after buying');
});

test('board: the ladder junction offers a real choice', () => {
  const s = createBoardGame(9, MONROE_LOOP, BOARD_ROSTER, 10);
  const p = s.players[0];
  p.node = 'B4';
  p.customValue = 3;
  s.pending = { type: 'roll', useSignature: false };
  boardAct(s, { type: 'roll', signature: false });
  boardAdvance(s);
  boardAdvance(s);
  assert.equal(s.pending?.type, 'junction');
  boardAct(s, { type: 'junction', to: 'G0' });
  assert.equal(p.node, 'G0');
  assert.equal(s.events[0].kind === 'hop' && s.events[0].via, 'ladder');
});

// ---------------------------------------------------------------- Slice 4: online parties

import { assignSeat, createPartyCode, initialSeats, minigamePlacements, normalizePartyCode, openPartyRoom, seatToBot, type BroadcastClient } from './partyNet';
import type { BoardAction } from './lokBoard';

const ROSTER4 = ['zero-day', 'shade', 'quarry-kid', 'golden-hour'];

test('party codes are 5 readable letters and normalize typed input', () => {
  const c = createPartyCode();
  assert.match(c, /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(normalizePartyCode(' ab-c0d1ef '), 'ABCDE');
});

test('guests take bot seats, keep a free character, rejoin their own seat, and the party fills', () => {
  let seats = initialSeats('shade', 'Host', ROSTER4);
  assert.deepEqual(seats.map((s) => s.kind), ['host', 'bot', 'bot', 'bot']);
  const a = assignSeat(seats, { clientId: 'a', characterId: 'golden-hour', name: 'Ann' })!;
  seats = a.seats;
  assert.equal(seats[a.seat].characterId, 'golden-hour');
  assert.equal(new Set(seats.map((s) => s.characterId)).size, 4, 'characters stay unique');
  const b = assignSeat(seats, { clientId: 'b', characterId: 'shade', name: 'Bo' })!;
  assert.notEqual(b.seats[b.seat].characterId, 'shade', 'the host keeps its character');
  seats = b.seats;
  assert.equal(assignSeat(seats, { clientId: 'a', characterId: 'x', name: 'Ann' })!.seat, a.seat);
  seats = assignSeat(seats, { clientId: 'c', characterId: 'zero-day', name: 'Cy' })!.seats;
  assert.equal(assignSeat(seats, { clientId: 'd', characterId: 'zero-day', name: 'Di' }), null);
  seats = seatToBot(seats, a.seat);
  assert.equal(seats[a.seat].kind, 'bot');
  assert.equal(seats[0].kind, 'host', 'the host seat never turns into a bot');
});

test('minigame scores merge into placements with stable ties', () => {
  assert.deepEqual(minigamePlacements([10, 40, 40, 0]), [3, 1, 2, 4]);
  assert.deepEqual(minigamePlacements([NaN, 5, 5, 5]), [4, 1, 2, 3]);
});

test('the relay routes each event to its handler on a fake channel', () => {
  const sent: { event: string; payload: unknown }[] = [];
  const listeners: Record<string, (m: { payload: unknown }) => void> = {};
  const fake: BroadcastClient = {
    channel: () => ({
      on: (_t, f, cb) => {
        listeners[f.event] = cb;
        return null;
      },
      subscribe: (cb) => {
        cb('SUBSCRIBED');
        return null;
      },
      send: (m) => {
        sent.push({ event: m.event, payload: m.payload });
      },
      unsubscribe: () => null,
    }),
  };
  const room = openPartyRoom(fake, 'ABCDE');
  const got: string[] = [];
  room.setHandlers({ onApply: (m) => got.push(`apply ${m.seq}`), onStatus: (st) => got.push(st) });
  listeners.apply({ payload: { seq: 3, action: { type: 'roll', signature: false } } });
  room.send('ping', { seat: 1, host: false });
  assert.deepEqual(got, ['connected', 'apply 3']);
  assert.equal(sent[0].event, 'ping');
});

test('lockstep: a guest replaying the host action log ends in the identical game', () => {
  const roster = ROSTER4.map((characterId, i) => ({ characterId, bot: i !== 0 }));
  const host = createBoardGame(2026, MONROE_LOOP, roster, 5);
  const guest = createBoardGame(2026, MONROE_LOOP, roster, 5);
  const log: BoardAction[] = [];
  const minis: number[][] = [];
  const drive = (s: BoardState, take: () => BoardAction | undefined, mini: () => number[] | undefined) => {
    let guard = 0;
    while (s.phase !== 'over' && guard++ < 20000) {
      if (s.phase === 'minigame') {
        const p = mini();
        if (!p) return;
        boardMinigameResult(s, p);
      } else if (s.pending) {
        const a = take();
        if (!a) return;
        boardAct(s, a);
      } else boardAdvance(s);
    }
  };
  // Host decides every action (bots included) and records the order.
  drive(
    host,
    () => {
      const a = botAction(host)!;
      log.push(a);
      return a;
    },
    () => {
      const p = minigamePlacements([0, 1, 2, 3].map((i) => (i * 7 + host.round * 3) % 11));
      minis.push(p);
      return p;
    },
  );
  let ai = 0;
  let mi = 0;
  drive(
    guest,
    () => log[ai++],
    () => minis[mi++],
  );
  assert.equal(host.phase, 'over');
  assert.equal(guest.phase, 'over');
  assert.deepEqual(
    guest.players.map((p) => [p.node, p.coins, p.crowns, p.items.join()]),
    host.players.map((p) => [p.node, p.coins, p.crowns, p.items.join()]),
  );
  assert.equal(ai, log.length);
});
