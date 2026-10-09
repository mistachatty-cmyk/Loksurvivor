import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MORALE_RULES, moraleMultiplier, nextMorale, nextStreak, normalizeMorale, normalizeStreak } from '@/game/data/morale';

describe('crew morale', () => {
  it('climbs on wins and digs deeper on losses while negative', () => {
    assert.equal(nextMorale(0, true), 1);
    assert.equal(nextMorale(0, false), -1);
    assert.equal(nextMorale(-2, false), -3);
    assert.equal(nextMorale(-2, true), -1);
    assert.equal(nextMorale(MORALE_RULES.floor, false), MORALE_RULES.floor);
  });

  it('resets a positive streak on a loss', () => {
    assert.equal(nextMorale(7, false), 0);
  });

  it('shrinks boosts when negative, never below the minimum', () => {
    assert.equal(moraleMultiplier(-2, false), 0.8);
    assert.equal(moraleMultiplier(-99, false), MORALE_RULES.minMultiplier);
  });

  it('stacks +0.25 per point only after the end game, with no cap', () => {
    assert.equal(moraleMultiplier(4, false), 1);
    assert.equal(moraleMultiplier(4, true), 2);
    assert.equal(moraleMultiplier(400, true), 101);
  });

  it('counts wins in a row and resets on any loss', () => {
    assert.equal(nextStreak(0, true), 1);
    assert.equal(nextStreak(4, true), 5);
    assert.equal(nextStreak(4, false), 0);
    assert.equal(normalizeStreak(-3), 0);
    assert.equal(normalizeStreak(2.7), 2);
  });

  it('cleans saved values', () => {
    assert.equal(normalizeMorale('x'), 0);
    assert.equal(normalizeMorale(2.9), 2);
    assert.equal(normalizeMorale(-50), MORALE_RULES.floor);
  });
});
