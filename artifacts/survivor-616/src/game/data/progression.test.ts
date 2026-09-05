import assert from 'node:assert/strict';
import test from 'node:test';

import { nextRescueAllyId } from './progression';

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
