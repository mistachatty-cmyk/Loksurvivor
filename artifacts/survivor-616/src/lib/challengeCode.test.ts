import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AREAS } from '@/game/data/areas';
import { decodeChallenge, encodeChallenge } from './challengeCode';

const known = AREAS.map((a) => a.id);

test('a code round-trips for every built-in map', () => {
  for (const area of AREAS) {
    const code = encodeChallenge(area.id, 45678);
    assert.ok(code, area.id);
    assert.deepEqual(decodeChallenge(code!, known), { ok: true, areaId: area.id, seed: 45678 });
  }
});

test('typing the code in capitals or with spaces still works', () => {
  const code = encodeChallenge('back-alley', 99)!;
  assert.equal(decodeChallenge(`  ${code.toUpperCase()} `, known).ok, true);
});

test('a typo, a wrong shape or an unknown map is refused with a reason', () => {
  const code = encodeChallenge('back-alley', 1234)!;
  const typo = code.replace('.', '.x').replace('.x', '.');
  assert.equal(decodeChallenge(code.slice(0, -1) + (code.endsWith('a') ? 'b' : 'a'), known).ok, false);
  assert.deepEqual(decodeChallenge('hello', known), { ok: false, reason: 'format' });
  assert.deepEqual(decodeChallenge('616.back-alley.zzzzzz.a', known), { ok: false, reason: 'format' });
  const ghost = encodeChallenge('not-a-map', 5)!;
  assert.deepEqual(decodeChallenge(ghost, known), { ok: false, reason: 'area' });
  assert.ok(typo);
});

test('seeds outside the supported range never encode', () => {
  assert.equal(encodeChallenge('back-alley', -1), null);
  assert.equal(encodeChallenge('back-alley', 1_000_000), null);
  assert.equal(encodeChallenge('Back Alley', 5), null);
  assert.equal(encodeChallenge('bubbleWash', 5)?.includes('bubblewash'), true);
});
