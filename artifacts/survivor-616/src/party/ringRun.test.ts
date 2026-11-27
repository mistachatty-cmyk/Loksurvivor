import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { RUSH, createRingRun, piecesBetween, rushPerformance, rushResults, stepRingRun, trackChunk, type RushInput } from './ringRun';
import { DEFAULT_PREFS, actionForKey, nextMode, padActions, sanitizePrefs } from '../lib/lokInput/core';

const STEP = 1000 / 60;
const roster = [
  { characterId: 'zero-day', bot: false },
  { characterId: 'shade', bot: true, botSkill: 0.8 },
  { characterId: 'quarry-kid', bot: true, botSkill: 0.5 },
  { characterId: 'golden-hour', bot: true, botSkill: 0.2 },
];

function runAll(seed: number, human: (t: number) => RushInput | null = () => null) {
  const s = createRingRun(seed, roster);
  while (!s.over) stepRingRun(s, [human(s.now), null, null, null], STEP);
  return s;
}

test('the street is a pure function of the seed and leaves the start clear', () => {
  assert.deepEqual(trackChunk(616, 3), trackChunk(616, 3));
  assert.notDeepEqual(trackChunk(616, 3), trackChunk(617, 3));
  const s = createRingRun(1, roster);
  assert.ok(piecesBetween(s, 0, RUSH.startGap - 1).length === 0);
  for (let c = 0; c < 40; c += 1) for (const p of trackChunk(9, c)) assert.ok(p.lane >= 0 && p.lane <= 2);
});

test('a whole match is deterministic: same seed, same results, bots never touch shared rng', () => {
  const a = rushResults(runAll(77));
  const b = rushResults(runAll(77));
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((r) => r.placement).sort(), [1, 2, 3, 4]);
  const orig = Math.random;
  Math.random = () => {
    throw new Error('ringRun must not use Math.random');
  };
  try {
    runAll(5);
  } finally {
    Math.random = orig;
  }
});

test('rings build a chain, rocks break it, and a jump clears a rock', () => {
  const s = createRingRun(3, [roster[0]]);
  const p = s.players[0];
  // Hand-place a clean line of rings in lane 1, then a rock.
  s.chunks.set(0, [
    { id: 1, x: 300, lane: 1, kind: 'ring' },
    { id: 2, x: 340, lane: 1, kind: 'ring' },
    { id: 3, x: 380, lane: 1, kind: 'ring' },
    { id: 4, x: 420, lane: 1, kind: 'ring' },
    { id: 5, x: 520, lane: 1, kind: 'rock' },
  ]);
  for (let i = 0; i < 400 && p.dist < 480; i += 1) stepRingRun(s, [null], STEP);
  assert.equal(p.rings, 4);
  assert.equal(p.mult, 2, 'four rings in a row raise the multiplier');
  assert.ok(p.score >= 10 * 4);
  // Drive into the rock without jumping: stun, chain broken.
  for (let i = 0; i < 200 && p.hits === 0; i += 1) stepRingRun(s, [null], STEP);
  assert.equal(p.hits, 1);
  assert.equal(p.mult, 1);
  assert.ok(s.now < p.stunUntil);
});

test('jumping over a rock avoids the hit', () => {
  const s = createRingRun(4, [roster[0]]);
  const p = s.players[0];
  s.chunks.set(0, [{ id: 1, x: 420, lane: 1, kind: 'rock' }]);
  let jumped = false;
  for (let i = 0; i < 400 && p.dist < 520; i += 1) {
    const jump = !jumped && p.dist > 330;
    if (jump) jumped = true;
    stepRingRun(s, [{ laneDelta: 0, jumpPressed: jump }], STEP);
  }
  assert.equal(p.hits, 0);
  assert.equal(p.jumps, 1);
});

test('performance maps onto the shared meta inputs', () => {
  const s = runAll(21);
  const mine = rushResults(s).find((r) => !r.bot)!;
  const perf = rushPerformance(s, mine);
  assert.equal(perf.players, 4);
  assert.ok(perf.objective >= 0 && perf.skill >= 0 && perf.skill <= 1);
  assert.equal(perf.banked, mine.banked);
});

test('lokInput: keys and pad buttons become the same actions', () => {
  assert.deepEqual(actionForKey('ArrowLeft'), { kind: 'dir', dx: -1, dy: 0 });
  assert.deepEqual(actionForKey('w'), { kind: 'dir', dx: 0, dy: -1 });
  assert.deepEqual(actionForKey(' '), { kind: 'primary' });
  assert.deepEqual(actionForKey('7'), { kind: 'num', n: 7 });
  assert.equal(actionForKey('Escape'), null, 'Esc stays with the browser so it can leave fullscreen');
  const held = new Map<string, boolean>();
  const press = (b: number) => Array.from({ length: 16 }, (_, i) => i === b);
  assert.deepEqual(padActions(press(0), [0, 0], held), [{ kind: 'primary' }]);
  assert.deepEqual(padActions(press(0), [0, 0], held), [], 'held buttons fire once');
  assert.deepEqual(padActions(press(99), [0.9, 0], held), [{ kind: 'dir', dx: 1, dy: 0 }], 'stick edge');
});

test('lokInput: modes cycle and saved prefs are sanitized', () => {
  assert.equal(nextMode('pointer'), 'keyboard');
  assert.equal(nextMode('keyboard'), 'gamepad');
  assert.equal(nextMode('gamepad'), 'pointer');
  assert.deepEqual(sanitizePrefs(null), DEFAULT_PREFS);
  const bad = sanitizePrefs({ mode: 'toaster', x: 9, y: 'no', locked: 'yes' });
  assert.equal(bad.mode, 'pointer');
  assert.ok(bad.x <= 0.97 && bad.y === DEFAULT_PREFS.y && bad.locked === false);
});

test('lokInput stays free of game imports so it can become its own package', () => {
  for (const f of ['core.ts', 'LokInputPad.tsx', 'index.ts']) {
    const src = readFileSync(fileURLToPath(new URL(`../lib/lokInput/${f}`, import.meta.url)), 'utf8');
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    assert.ok(imports.every((p) => p.startsWith('./') || p === 'react'), `${f} imports ${imports.join(', ')}`);
  }
});

import { BOT_LEVELS, DEFAULT_BOT_LEVELS, resolveBotSkills, sanitizeBotLevels } from './botLevels';
import { botSkillsForTier } from './lokDrop';

test('bot levels: auto follows rank, fixed levels are fixed, random is seeded and varies by seat', () => {
  assert.deepEqual(resolveBotSkills(DEFAULT_BOT_LEVELS, 3, 9), botSkillsForTier(3));
  const fixed = resolveBotSkills(['easy', 'hard', 'master'], 0, 1);
  assert.ok(fixed[0] < fixed[1] && fixed[1] < fixed[2]);
  const a = resolveBotSkills(['random', 'random', 'random'], 0, 42);
  assert.deepEqual(a, resolveBotSkills(['random', 'random', 'random'], 0, 42), 'same seed, same pick');
  const seen = new Set<number>();
  for (let seed = 1; seed < 80; seed += 1) for (const v of resolveBotSkills(['random', 'random', 'random'], 0, seed)) seen.add(v);
  assert.equal(seen.size, 4, 'random reaches every fixed level');
  assert.deepEqual(sanitizeBotLevels(['hard', 'bogus']), ['hard', 'auto', 'auto']);
  assert.ok(BOT_LEVELS.includes('random'));
});

import { FrameGovernor, baseDpr, isConsoleBrowser } from '../lib/renderScale';

test('render scale: consoles start at 1x, slow frames step resolution down, calm frames recover', () => {
  assert.equal(isConsoleBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 Edge/44'), true);
  assert.equal(isConsoleBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), false);
  assert.equal(baseDpr(2, true), 1);
  assert.equal(baseDpr(3, false), 2);
  const g = new FrameGovernor(1);
  let changed = 0;
  for (let i = 0; i < 400; i += 1) if (g.tick(33)) changed += 1;
  assert.ok(changed >= 2 && g.scale < 0.8 && g.scale >= 0.55, `scale ${g.scale}`);
  const low = g.scale;
  for (let i = 0; i < 2000; i += 1) g.tick(8);
  assert.ok(g.scale > low, 'recovers when frames are fast');
  const hitch = new FrameGovernor(1);
  for (let i = 0; i < 200; i += 1) hitch.tick(400);
  assert.equal(hitch.scale, 1, 'tab-switch hitches are ignored');
});

import { minigameForRound, validResults } from './cartridge';

test('minigameForRound is deterministic and never repeats back to back', () => {
  const ids = ['rush', 'drop'];
  let prev = '';
  for (let r = 1; r <= 12; r += 1) {
    const a = minigameForRound(ids, 777, r);
    assert.equal(a, minigameForRound(ids, 777, r));
    assert.notEqual(a, prev);
    prev = a;
  }
  assert.equal(minigameForRound(['solo'], 1, 5), 'solo');
});

test('validResults needs four seats with placements 1 to 4', () => {
  const ok = [1, 2, 3, 4].map((p) => ({ characterId: 'c' + p, placement: p, banked: p * 10 }));
  assert.equal(validResults(ok), true);
  assert.equal(validResults(ok.slice(0, 3)), false);
  assert.equal(validResults(ok.map((r) => ({ ...r, placement: 1 }))), false);
});

import { dailySeed } from './cartridge';
test('dailySeed is stable within a day and changes across days', () => {
  assert.equal(dailySeed(new Date(2026, 10, 27, 1)), dailySeed(new Date(2026, 10, 27, 23)));
  assert.notEqual(dailySeed(new Date(2026, 10, 27)), dailySeed(new Date(2026, 10, 28)));
});

test('lib/couch imports nothing from any game', () => {
  const src = readFileSync(fileURLToPath(new URL('../lib/couch/core.ts', import.meta.url)), 'utf8');
  assert.equal(/from\s+['"]/.test(src), false);
});

import { buttonName, consoleDprCap, consoleProfile, detectConsole, padHint, rumble } from '../lib/lokConsole/core';

test('console detection picks the right profile and button names', () => {
  const xs = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 Edge/44';
  const xo = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 Edge/44';
  const ps5 = 'Mozilla/5.0 (PlayStation 5 4.03) AppleWebKit/605.1.15';
  const ps4 = 'Mozilla/5.0 (PlayStation 4 9.00) AppleWebKit/605.1.15';
  assert.equal(detectConsole(xs), 'xbox-series');
  assert.equal(detectConsole(xo), 'xbox-one');
  assert.equal(detectConsole(ps5), 'playstation-5');
  assert.equal(detectConsole(ps4), 'playstation-4');
  assert.equal(detectConsole('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'none');
  assert.equal(buttonName('primary', consoleProfile('xbox-series')), 'A');
  assert.equal(buttonName('primary', consoleProfile('playstation-5')), 'Cross');
  assert.equal(padHint('{primary} jumps, {menu} pauses', consoleProfile('playstation-4')), 'Cross jumps, Options pauses');
  assert.ok(consoleDprCap('xbox-series') > consoleDprCap('xbox-one'));
});

test('rumble reaches a connected pad, clamps its inputs and ignores pads without a motor', () => {
  const calls: Record<string, number>[] = [];
  const pad = { connected: true, vibrationActuator: { playEffect: (_t: string, p: Record<string, number>) => { calls.push(p); return Promise.resolve(); } } };
  assert.equal(rumble(5, 9999, [pad, { connected: true }, null]), true);
  assert.equal(calls[0].duration, 400);
  assert.equal(calls[0].strongMagnitude, 1);
  assert.equal(rumble(1, 50, [{ connected: true }]), false);
});

test('lokConsole core imports nothing from any game', () => {
  const src = readFileSync(fileURLToPath(new URL('../lib/lokConsole/core.ts', import.meta.url)), 'utf8');
  assert.equal(/from\s+['"]/.test(src), false);
});

import { buildProfile, classifyDevice, describeProfile, detectBrowser, detectOs, refineTier } from '../lib/lokCalibrate/core';

const UA = {
  xbox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox Series X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.82 Safari/537.36 Edge/20.02',
  ps4: 'Mozilla/5.0 (PlayStation 4 9.00) AppleWebKit/605.1.15 (KHTML, like Gecko)',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  tv: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36',
};

test('calibrate: classifies devices, browsers and operating systems', () => {
  assert.equal(classifyDevice({ ua: UA.xbox }), 'console');
  assert.equal(classifyDevice({ ua: UA.tv }), 'tv');
  assert.equal(classifyDevice({ ua: UA.iphone, touch: true, coarsePointer: true, screenW: 390, screenH: 844 }), 'phone');
  assert.equal(classifyDevice({ ua: UA.win, cores: 12 }), 'desktop');
  assert.equal(detectBrowser(UA.win), 'edge');
  assert.equal(detectBrowser(UA.iphone), 'safari');
  assert.equal(detectOs(UA.xbox), 'xbox');
  assert.equal(detectOs(UA.iphone), 'ios');
});

test('calibrate: profiles fit the device and a slow frame test only lowers them', () => {
  const x = buildProfile({ ua: UA.xbox, dpr: 2, gamepad: true });
  assert.equal(x.tier, 'high');
  assert.equal(x.settings.inputMode, 'gamepad');
  assert.ok(x.settings.safeInset > 0 && x.settings.dprCap <= 1.25);
  assert.equal(describeProfile(x), 'Xbox Series X|S in Edge');
  const ps4 = buildProfile({ ua: UA.ps4 });
  assert.equal(ps4.tier, 'mid');
  assert.ok(ps4.notes.includes('old-webkit'));
  const tv = buildProfile({ ua: UA.tv });
  assert.equal(tv.settings.fps, 30);
  const big = buildProfile({ ua: UA.win, cores: 16, memoryGb: 8, dpr: 2 });
  assert.equal(big.tier, 'high');
  assert.equal(big.settings.dprCap, 2);
  const slow = buildProfile({ ua: UA.win, cores: 16, memoryGb: 8, dpr: 2 }, 30);
  assert.equal(slow.tier, 'mid');
  assert.ok(slow.notes.includes('measured-slow'));
  assert.equal(refineTier('low', 10), 'low');
  assert.equal(refineTier('mid', 40), 'low');
  const saver = buildProfile({ ua: UA.win, cores: 16, memoryGb: 8, saveData: true });
  assert.equal(saver.tier, 'mid');
  const phone = buildProfile({ ua: UA.iphone, touch: true, coarsePointer: true, screenW: 390, screenH: 844, cores: 6, dpr: 3 });
  assert.ok(phone.notes.includes('ios-no-vibrate') && phone.notes.includes('hi-dpi-capped'));
});

test('lokCalibrate core imports only the sibling console package', () => {
  const src = readFileSync(fileURLToPath(new URL('../lib/lokCalibrate/core.ts', import.meta.url)), 'utf8');
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports, ['../lokConsole/core']);
});
