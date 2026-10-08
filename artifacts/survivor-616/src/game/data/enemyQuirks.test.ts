import assert from 'node:assert/strict';
import test from 'node:test';

import { ENEMY_QUIRKS, canHaveQuirk, quirkChance, quirkChart, rollEnemyQuirk } from './enemyQuirks';

test('every quirk is charted and the chart odds add up', () => {
  const rows = quirkChart();
  assert.equal(rows.length, ENEMY_QUIRKS.length);
  assert.equal(new Set(ENEMY_QUIRKS.map((quirk) => quirk.id)).size, ENEMY_QUIRKS.length);
  assert.ok(Math.abs(rows.reduce((sum, row) => sum + row.sharePct, 0) - 100) < 1e-9);
  for (const quirk of ENEMY_QUIRKS) {
    assert.ok(quirk.weight > 0 && quirk.name && quirk.description && quirk.reward);
    assert.match(quirk.color, /^#[0-9a-f]{6}$/i);
  }
});

test('quirk chance ramps over a run and bosses never roll one', () => {
  assert.ok(quirkChance(0) < quirkChance(300_000));
  assert.equal(quirkChance(10_000_000), quirkChance(600_000));
  assert.equal(canHaveQuirk({ family: 'Boss' }), false);
  assert.equal(canHaveQuirk({ family: 'Street', sizeClass: 'giant' }), false);
  for (let uid = 0; uid < 200; uid += 1) assert.equal(rollEnemyQuirk({ family: 'Boss' }, 600_000, 7, uid), undefined);
});

test('the roll is deterministic and its observed odds roughly match the chart', () => {
  const counts: Record<string, number> = {};
  let quirked = 0;
  for (let uid = 1; uid <= 40_000; uid += 1) {
    const roll = rollEnemyQuirk({ family: 'Street' }, 600_000, 616, uid);
    assert.equal(roll, rollEnemyQuirk({ family: 'Street' }, 600_000, 616, uid));
    if (roll) { quirked += 1; counts[roll] = (counts[roll] ?? 0) + 1; }
  }
  assert.ok(Math.abs(quirked / 40_000 - quirkChance(600_000)) < 0.01);
  for (const row of quirkChart()) {
    const seen = ((counts[row.quirk.id] ?? 0) / quirked) * 100;
    assert.ok(Math.abs(seen - row.sharePct) < 3, `${row.quirk.id} observed ${seen.toFixed(1)}% vs ${row.sharePct.toFixed(1)}%`);
  }
});

import { QUIRK_SURGE_CHANCE, QUIRK_SURGE_UNLOCK_MAPS, quirkSurgeMode, quirkSurgeScheduled } from './enemyQuirks';
import { QUIRK_SURGE_LORE } from './quirkSurgeLore';

test('the Surge unlocks at 14 maps as a chance, and becomes every run in the end game', () => {
  assert.equal(QUIRK_SURGE_UNLOCK_MAPS, 14);
  assert.equal(quirkSurgeMode(13, false, true), 'off');
  assert.equal(quirkSurgeMode(14, false, true), 'chance');
  assert.equal(quirkSurgeMode(40, true, true), 'always');
  assert.equal(quirkSurgeMode(40, true, false), 'chance');
  assert.equal(quirkSurgeMode(5, true, true), 'always');
  assert.equal(quirkSurgeScheduled('off', 1), false);
  assert.equal(quirkSurgeScheduled('always', 1), true);
  let hits = 0;
  for (let seed = 0; seed < 20_000; seed += 1) if (quirkSurgeScheduled('chance', seed)) hits += 1;
  assert.ok(Math.abs(hits / 20_000 - QUIRK_SURGE_CHANCE) < 0.02);
  assert.ok(hits > 0 && hits < 20_000, 'not guaranteed');
});

test('the Surge lore stays vague and never names a cause', () => {
  const text = [QUIRK_SURGE_LORE.title, ...QUIRK_SURGE_LORE.paragraphs, QUIRK_SURGE_LORE.glyphs].join(' ');
  assert.match(text, /Howls of the Eclipse/i);
  assert.match(QUIRK_SURGE_LORE.glyphs, /WE$/);
  assert.match(text, /do not know/i);
  assert.doesNotMatch(text, /signal/i);
});
