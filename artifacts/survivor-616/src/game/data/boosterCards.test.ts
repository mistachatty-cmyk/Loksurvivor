import assert from 'node:assert/strict';
import test from 'node:test';
import { BOOSTER_PRODUCTS, BOOSTER_STATS, applyBoosterToPlayerStats, boosterMultipliers, boosterUnits, rollBoosterCard, rollBoosterUnits } from './boosterCards';
import { activeCardEffects } from './passiveCards';
import { createInitialMeta, reducer } from '@/game/state/metaStore';
import { createRng } from '@/game/engine/math';
import { CHARACTERS } from './characters';
import type { BoosterCardRecord } from '@/game/types';

const card = (stat: BoosterCardRecord['stat'], units: number, group: BoosterCardRecord['group'] = 'character'): BoosterCardRecord => ({ id: `${stat}-${units}`, group, stat, units, characterId: CHARACTERS[0]!.id, productId: 'test', acquiredAt: 0 });

test('every rolled booster is 1+ units, in a group that owns its stat, with a real character', () => {
  const rng = createRng(616);
  for (let i = 0; i < 300; i += 1) {
    const roll = rollBoosterCard(rng, 'bootleg-booster-pack', 1, i);
    assert.ok(roll.units >= 1, 'units must be at least 1');
    assert.ok(BOOSTER_STATS.find((def) => def.stat === roll.stat)!.groups.includes(roll.group), `stat ${roll.stat} must belong to ${roll.group}`);
    assert.ok(CHARACTERS.some((entry) => entry.id === roll.characterId));
  }
  assert.ok([1, 2, 3].includes(rollBoosterUnits(createRng(1))));
});

test('units sum per stat and the player stat boost is additive for HP and multiplicative for rates', () => {
  const totals = boosterUnits([card('maxHp', 2), card('maxHp', 1), card('power', 3)]);
  assert.equal(totals.maxHp, 3);
  assert.equal(totals.power, 3);
  const base = CHARACTERS[0]!.stats;
  const boosted = applyBoosterToPlayerStats(base, totals);
  assert.equal(boosted.maxHp, base.maxHp + 12);
  assert.ok(Math.abs(boosted.power - base.power * 1.03) < 1e-9);
  assert.equal(boosted.speed, base.speed);
});

test('armor is capped and cooldown never drops below the floor', () => {
  const base = { ...CHARACTERS[0]!.stats, armor: 0.59, haste: 0.5 };
  const boosted = applyBoosterToPlayerStats(base, { armor: 100, haste: 1000 });
  assert.equal(boosted.armor, 0.6);
  assert.equal(boosted.haste, 0.2);
});

test('LokPet and enemy boosters become multipliers and flow into the run card effects', () => {
  const units = boosterUnits([card('lokPetDamage', 5, 'lokpets'), card('enemyHp', 10, 'enemies')]);
  const multipliers = boosterMultipliers(units);
  assert.ok(Math.abs(multipliers.lokPetDamageMult - 1.05) < 1e-9);
  assert.ok(Math.abs(multipliers.enemyHpMult - 1.1) < 1e-9);
  const effects = activeCardEffects({ ...createInitialMeta(), boosterCards: [card('lokPetDamage', 5, 'lokpets'), card('enemyHp', 10, 'enemies')] });
  assert.ok(Math.abs(effects.enemyHpMult - 1.1) < 1e-9);
  assert.ok(Math.abs(effects.lokPetDamageMult - 1.05) < 1e-9);
  assert.equal(activeCardEffects(createInitialMeta()).enemyHpMult, 1);
});

test('booster products cost Card Credits and cannot overspend', () => {
  assert.ok(BOOSTER_PRODUCTS.every((product) => product.cost > 0 && product.cards > 0));
  const state = { meta: createInitialMeta(), lastRun: null } as any;
  assert.equal(reducer(state, { type: 'buyBoosterProduct', productId: 'bootleg-booster-pack', now: 1 }), state);
  const rich = { ...state, meta: { ...state.meta, cardCredits: 500 } };
  const after = reducer(rich, { type: 'buyBoosterProduct', productId: 'bootleg-booster-pack', now: 1 }) as any;
  assert.equal(after.meta.boosterCards.length, 3);
  assert.equal(after.meta.cardCredits, 500 - 40);
});
