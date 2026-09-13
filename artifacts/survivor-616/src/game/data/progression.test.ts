import assert from 'node:assert/strict';
import test from 'node:test';

import { HUB_ROOMS, nextRescueAllyId } from './progression';

test('rescue routes make every new crew member available through normal play', () => {
  assert.equal(nextRescueAllyId('monroe-strip', [], 'vee'), 'vee');
  assert.equal(nextRescueAllyId('monroe-strip', ['vee'], 'vee'), 'pippa');
  assert.equal(nextRescueAllyId('monroe-strip', ['vee', 'pippa'], 'vee'), 'theo');
  assert.equal(nextRescueAllyId('rooftops', ['nyx'], 'nyx'), 'morrow');
  assert.equal(nextRescueAllyId('crystal-cellar', ['sable'], 'sable'), 'cinder');
});

test('finished rescue routes do not repeatedly offer an already rescued ally', () => {
  assert.equal(nextRescueAllyId('monroe-strip', ['vee', 'pippa', 'theo'], 'vee'), undefined);
  assert.equal(nextRescueAllyId('back-alley', ['deacon'], 'deacon'), undefined);
});

test('the LokPet Card Shop is a default hideout destination with a live shop entry point', () => {
  const shop = HUB_ROOMS.find((room) => room.id === 'the-storefront');
  assert.ok(shop);
  assert.equal(shop.name, 'LokPet Card Shop');
  assert.equal(shop.unlock.kind, 'default');
  assert.ok(shop.features.includes('card-shop'));
});
