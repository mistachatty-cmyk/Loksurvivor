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
