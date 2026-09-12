import assert from 'node:assert/strict';
import test from 'node:test';

import { createRunHighlightRecorder, type RunHighlightObservable } from './runHighlights';

function baseWorld(overrides: Partial<RunHighlightObservable> = {}): RunHighlightObservable {
  return {
    now: 0,
    level: 1,
    outcome: 'running',
    killsByEnemy: {},
    ultActiveUntil: 0,
    rescue: { status: 'pending' },
    player: { hp: 100, maxHp: 100 },
    ...overrides,
  };
}

test('captures a level-up exactly once when level increases', () => {
  const recorder = createRunHighlightRecorder();
  recorder.observe(baseWorld({ now: 1000, level: 1 }));
  recorder.observe(baseWorld({ now: 2000, level: 2 }));
  recorder.observe(baseWorld({ now: 2100, level: 2 }));
  const levelUps = recorder.getHighlights().filter((h) => h.kind === 'level-up');
  assert.equal(levelUps.length, 1);
  assert.equal(levelUps[0]?.atMs, 2000);
});

test('boss kill is only recorded when a Boss-family enemy count rises', () => {
  const recorder = createRunHighlightRecorder();
  // 'grunt' is not a real roster id -- a rising non-boss kill count must
  // not produce a boss-defeated highlight.
  recorder.observe(baseWorld({ now: 500, killsByEnemy: { grunt: 3 } }));
  recorder.observe(baseWorld({ now: 1000, killsByEnemy: { grunt: 4 } }));
  assert.equal(recorder.getHighlights().some((h) => h.kind === 'boss-defeated'), false);
});

test('boss kill is recorded when a real Boss-family enemy id rises', () => {
  const recorder = createRunHighlightRecorder();
  recorder.observe(baseWorld({ now: 500, killsByEnemy: { 'the-sire': 0 } }));
  recorder.observe(baseWorld({ now: 1000, killsByEnemy: { 'the-sire': 1 } }));
  assert.equal(recorder.getHighlights().some((h) => h.kind === 'boss-defeated'), true);
});

test('ultimate activation is recorded once per activation, not once per frame', () => {
  const recorder = createRunHighlightRecorder();
  recorder.observe(baseWorld({ now: 1000, ultActiveUntil: 5000 }));
  recorder.observe(baseWorld({ now: 1500, ultActiveUntil: 5000 }));
  recorder.observe(baseWorld({ now: 2000, ultActiveUntil: 5000 }));
  const ults = recorder.getHighlights().filter((h) => h.kind === 'ultimate');
  assert.equal(ults.length, 1);
});

test('rescue is recorded once on the transition into freed', () => {
  const recorder = createRunHighlightRecorder();
  recorder.observe(baseWorld({ now: 1000, rescue: { status: 'freeing', allyId: 'x' } }));
  recorder.observe(baseWorld({ now: 1500, rescue: { status: 'freed', allyId: 'x' } }));
  recorder.observe(baseWorld({ now: 1600, rescue: { status: 'freed', allyId: 'x' } }));
  const rescues = recorder.getHighlights().filter((h) => h.kind === 'ally-rescued');
  assert.equal(rescues.length, 1);
});

test('close call requires a cooldown between repeated low-hp frames', () => {
  const recorder = createRunHighlightRecorder();
  recorder.observe(baseWorld({ now: 1000, player: { hp: 5, maxHp: 100 } }));
  recorder.observe(baseWorld({ now: 1050, player: { hp: 4, maxHp: 100 } }));
  recorder.observe(baseWorld({ now: 1100, player: { hp: 3, maxHp: 100 } }));
  const closeCalls = recorder.getHighlights().filter((h) => h.kind === 'close-call');
  assert.equal(closeCalls.length, 1);
});

test('a zero-hp frame (death) does not double-count as a close call', () => {
  const recorder = createRunHighlightRecorder();
  recorder.observe(baseWorld({ now: 1000, player: { hp: 0, maxHp: 100 }, outcome: 'dead' }));
  const closeCalls = recorder.getHighlights().filter((h) => h.kind === 'close-call');
  assert.equal(closeCalls.length, 0);
});

test('run end is recorded exactly once even if observe is called again after outcome changes', () => {
  const recorder = createRunHighlightRecorder();
  recorder.observe(baseWorld({ now: 1000, outcome: 'cleared' }));
  recorder.observe(baseWorld({ now: 1100, outcome: 'cleared' }));
  const ends = recorder.getHighlights().filter((h) => h.kind === 'run-cleared');
  assert.equal(ends.length, 1);
});

test('highlight list stays capped and keeps the boss kill over repeated level-ups', () => {
  const recorder = createRunHighlightRecorder();
  let now = 0;
  for (let level = 2; level <= 9; level += 1) {
    now += 500;
    recorder.observe(baseWorld({ now, level }));
  }
  now += 500;
  recorder.observe(baseWorld({ now, level: 9, killsByEnemy: { 'the-sire': 1 } }));
  const highlights = recorder.getHighlights();
  assert.ok(highlights.length <= 6);
  assert.ok(highlights.some((h) => h.kind === 'boss-defeated'));
});

test('getHighlights returns highlights sorted by time', () => {
  const recorder = createRunHighlightRecorder();
  recorder.observe(baseWorld({ now: 3000, level: 2 }));
  recorder.observe(baseWorld({ now: 6000, rescue: { status: 'freed', allyId: 'x' } }));
  const highlights = recorder.getHighlights();
  for (let i = 1; i < highlights.length; i += 1) {
    assert.ok(highlights[i]!.atMs >= highlights[i - 1]!.atMs);
  }
});
