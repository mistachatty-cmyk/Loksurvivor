import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS_BY_ID } from './areas';
import { DISCOVERIES_BY_ID } from './progression';
import { CITY_RELICS, CITY_RELICS_BY_ID, RELIC_RECIPES } from './relics';

test('expanded relic knowledge has unique, reachable district sources', () => {
  assert.ok(CITY_RELICS.length >= 10);
  assert.equal(new Set(CITY_RELICS.map((relic) => relic.id)).size, CITY_RELICS.length);
  assert.equal(new Set(CITY_RELICS.map((relic) => relic.sourceDiscoveryId)).size, CITY_RELICS.length);
  for (const relic of CITY_RELICS) {
    assert.ok(AREAS_BY_ID[relic.sourceAreaId], `${relic.id} references an unknown area`);
    assert.ok(DISCOVERIES_BY_ID[relic.sourceDiscoveryId], `${relic.id} references an unknown discovery`);
  }
});

test('every recovered relic has a usable level-up recipe', () => {
  assert.equal(RELIC_RECIPES.length, CITY_RELICS.length);
  assert.equal(new Set(RELIC_RECIPES.map((recipe) => recipe.id)).size, RELIC_RECIPES.length);
  for (const recipe of RELIC_RECIPES) {
    assert.ok(CITY_RELICS_BY_ID[recipe.relicId], `${recipe.id} references an unknown relic`);
    assert.equal(recipe.trigger, 'level-up');
    assert.ok(recipe.minWeaponLevel > 0);
    assert.ok(recipe.result.damage > 0);
  }
});
