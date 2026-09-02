import assert from 'node:assert/strict';
import test from 'node:test';

import { ALL_WEAPON_DEFS, WEAPON_PIXEL_MODELS, createWeaponPixelModel } from './weaponPixelModels';

test('every weapon and evolved result has a non-empty pixel model', () => {
  assert.ok(ALL_WEAPON_DEFS.length > 40);
  for (const weapon of ALL_WEAPON_DEFS) {
    const model = WEAPON_PIXEL_MODELS[weapon.id];
    assert.ok(model, `${weapon.id} is missing a pixel model`);
    assert.equal(model.kind, weapon.kind);
    assert.ok(model.pixels.length >= 12, `${weapon.id} model is too sparse`);
  }
});

test('unknown future weapons receive stable, distinct fallback models', () => {
  const first = createWeaponPixelModel('future-one', 'projectile');
  const repeated = createWeaponPixelModel('future-one', 'projectile');
  const second = createWeaponPixelModel('future-two', 'projectile');
  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first.pixels, second.pixels);
});
