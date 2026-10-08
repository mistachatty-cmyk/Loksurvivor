import assert from 'node:assert/strict';
import test from 'node:test';

import { CASCADE_STACK_PER_ENEMY, DAMAGE_NUMBER_STYLES, DAMAGE_TIERS, cascadeLifeMs, damageTier, isDamageNumberStyle } from './damageNumbers';

test('tier thresholds ascend and sizes never shrink', () => {
  for (let i = 1; i < DAMAGE_TIERS.length; i += 1) {
    assert.ok(DAMAGE_TIERS[i]!.min > DAMAGE_TIERS[i - 1]!.min);
    assert.ok(DAMAGE_TIERS[i]!.size >= DAMAGE_TIERS[i - 1]!.size);
  }
  assert.equal(new Set(DAMAGE_TIERS.map((t) => t.color)).size, DAMAGE_TIERS.length, 'every tier has its own color');
});

test('damageTier picks the highest threshold reached and a crit adds one tier, capped', () => {
  assert.equal(damageTier(1), 0);
  assert.equal(damageTier(8), 1);
  assert.equal(damageTier(19), 1);
  assert.equal(damageTier(20), 2);
  assert.equal(damageTier(19, true), 2);
  assert.equal(damageTier(5000), DAMAGE_TIERS.length - 1);
  assert.equal(damageTier(5000, true), DAMAGE_TIERS.length - 1);
});

test('bigger hits linger longer, and cascade outlasts the 700 ms classic popup', () => {
  assert.ok(cascadeLifeMs(0) > 700);
  assert.ok(cascadeLifeMs(5) > cascadeLifeMs(0));
});

test('style ids are recognised and listed once each', () => {
  assert.ok(isDamageNumberStyle('classic') && isDamageNumberStyle('cascade'));
  assert.ok(!isDamageNumberStyle('flashy') && !isDamageNumberStyle(undefined));
  assert.deepEqual(DAMAGE_NUMBER_STYLES.map((s) => s.id), ['classic', 'cascade']);
  assert.ok(CASCADE_STACK_PER_ENEMY >= 2);
});
