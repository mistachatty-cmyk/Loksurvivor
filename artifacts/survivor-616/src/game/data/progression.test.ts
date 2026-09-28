import assert from 'node:assert/strict';
import test from 'node:test';

import { HUB_ROOMS, nextRescueAllyId } from './progression';

test('rescue routes make every new crew member available through normal play', () => {
  assert.equal(nextRescueAllyId('monroe-strip', [], 'vee'), 'vee');
  assert.equal(nextRescueAllyId('monroe-strip', ['vee'], 'vee'), 'pippa');
  assert.equal(nextRescueAllyId('monroe-strip', ['vee', 'pippa'], 'vee'), 'theo');
  assert.equal(nextRescueAllyId('rooftops', ['nyx'], 'nyx'), 'morrow');
  assert.equal(nextRescueAllyId('crystal-cellar', ['sable'], 'sable'), 'cinder');
  assert.equal(nextRescueAllyId('rapid-pressure-rooms', [], 'patch-mercer'), 'patch-mercer');
  assert.equal(nextRescueAllyId('rapid-pressure-rooms', ['patch-mercer'], 'patch-mercer'), 'mara-vance');
  assert.equal(nextRescueAllyId('rapid-pressure-rooms', ['patch-mercer', 'mara-vance'], 'patch-mercer'), 'latch-brooks');
});

test('finished rescue routes do not repeatedly offer an already rescued ally', () => {
  assert.equal(nextRescueAllyId('monroe-strip', ['vee', 'pippa', 'theo'], 'vee'), undefined);
  assert.equal(nextRescueAllyId('back-alley', ['deacon'], 'deacon'), undefined);
});

test('The Neon Sleeve is a default hideout destination with a live shop entry point', () => {
  const shop = HUB_ROOMS.find((room) => room.id === 'the-storefront');
  assert.ok(shop);
  assert.equal(shop.name, 'The Neon Sleeve');
  assert.equal(shop.unlock.kind, 'default');
  assert.ok(shop.features.includes('card-shop'));
});

test('the Rapid shelter remains locked behind the pressure-room rescue', () => {
  const shelter = HUB_ROOMS.find((room) => room.id === 'rapid-shelter');
  assert.ok(shelter);
  assert.deepEqual(shelter.unlock, { kind: 'discovery', discoveryId: 'rapid-pressure-rooms-cleared' });
  assert.ok(shelter.features.includes('allies'));
});

test('GRPD Station exposes the kennel as a first-class destination', () => {
  const station = HUB_ROOMS.find((room) => room.id === 'grpd-station');
  assert.ok(station);
  assert.ok(station.features.includes('kennel'));
  assert.ok(station.features.includes('vendor'));
});

test('GRPD Vault opens when the Site Crew recovery zone is cleared', () => {
  const vault = HUB_ROOMS.find((room) => room.id === 'grpd-vault');
  assert.ok(vault);
  assert.deepEqual(vault.unlock, { kind: 'clearArea', areaId: 'site-crew-active-zone' });
});
