import assert from 'node:assert/strict';
import test from 'node:test';

import { createRng } from '@/game/engine/math';
import { LOOT_BOX_BUDGET, credValue, rollDrops, type DropContext } from './drops';
import { emptyTeardown, tallyBlock, teardownPayload } from './teardown';
import type { BlockRole } from './pageModel';

function ctx(role: BlockRole, area: number, depth = 0, lootLeft = LOOT_BOX_BUDGET): DropContext {
  return { role, area, depth, lootLeft: { value: lootLeft } };
}

function tally(role: BlockRole, area: number, rolls = 4000, depth = 0): Record<string, number> {
  const rng = createRng(12345);
  const out: Record<string, number> = {};
  for (let i = 0; i < rolls; i += 1) for (const d of rollDrops(ctx(role, area, depth), rng)) out[d.kind] = (out[d.kind] ?? 0) + 1;
  return out;
}

test('headings always pay big XP, links always pay some, and plain text mostly pays nothing', () => {
  const rng = createRng(1);
  assert.ok(rollDrops(ctx('heading', 3000), rng).some((d) => d.kind === 'xp' && d.value >= 12));
  assert.ok(rollDrops(ctx('link', 3000), rng).some((d) => d.kind === 'xp'));
  const text = tally('text', 3000);
  assert.ok(!text.xp && !text.health && !text.sweep);
  assert.ok((text.cred ?? 0) / 4000 < 0.06 && (text.cred ?? 0) / 4000 > 0.01, `text cred rate ${(text.cred ?? 0) / 4000}`);
});

test('buttons and inputs heal sometimes, inputs more often', () => {
  const button = tally('button', 1500).health ?? 0;
  const input = tally('input', 1500).health ?? 0;
  assert.ok(button / 4000 > 0.12 && button / 4000 < 0.3, `button ${button / 4000}`);
  assert.ok(input > button);
});

test('images pay by size: small ones sometimes cred, big ones always a crate', () => {
  const small = tally('image', 2000);
  assert.ok(!small['loot-box'] && (small.cred ?? 0) > 0);
  const big = rollDrops(ctx('image', 90000), createRng(2));
  assert.deepEqual(big.map((d) => d.kind), ['loot-box']);
});

test('an ad frame sets off a sweep and drops a crate', () => {
  const kinds = rollDrops(ctx('frame', 70000), createRng(3)).map((d) => d.kind).sort();
  assert.deepEqual(kinds, ['loot-box', 'sweep']);
});

test('crates have a per-page budget: once spent, a crate-worthy block pays triple cred instead', () => {
  const c = ctx('image', 90000, 0, 2);
  const rng = createRng(4);
  const first = rollDrops(c, rng);
  const second = rollDrops(c, rng);
  const third = rollDrops(c, rng);
  assert.equal(first[0]!.kind, 'loot-box');
  assert.equal(second[0]!.kind, 'loot-box');
  assert.equal(third[0]!.kind, 'cred');
  assert.equal(third[0]!.value, credValue(90000) * 3);
  assert.equal(c.lootLeft.value, 0);
});

test('depth improves the odds, and cred value scales with block size within its bounds', () => {
  const shallow = tally('heading', 3000, 6000, 0).cred ?? 0;
  const deep = tally('heading', 3000, 6000, 1).cred ?? 0;
  assert.ok(deep > shallow);
  assert.equal(credValue(0), 2);
  assert.equal(credValue(1e9), 15);
  assert.ok(credValue(40000) > credValue(2000));
});

test('teardown tallies roles, words, area and the biggest block, and the payload stays small and clamped', () => {
  const t = emptyTeardown();
  tallyBlock(t, { role: 'text', kind: 'text', w: 120, h: 20 });
  tallyBlock(t, { role: 'text', kind: 'text', w: 96, h: 20 });
  tallyBlock(t, { role: 'image', kind: 'box', w: 300, h: 200 });
  t.combo = 17;
  assert.equal(t.roles.text, 2);
  assert.equal(t.roles.image, 1);
  assert.equal(t.words, Math.round(120 / 48) + Math.round(96 / 48));
  assert.equal(t.biggest, 60000);
  const p = teardownPayload(t);
  assert.deepEqual(p.r, { t: 2, i: 1 });
  assert.equal(p.b, 60);
  assert.equal(p.c, 17);
  assert.ok(JSON.stringify(p).length < 100);
  const absurd = emptyTeardown();
  absurd.px = Number.POSITIVE_INFINITY;
  absurd.words = Number.NaN;
  const q = teardownPayload(absurd);
  assert.ok(Number.isFinite(q.p) && Number.isFinite(q.w));
});
