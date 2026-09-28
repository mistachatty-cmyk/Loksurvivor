import assert from 'node:assert/strict';
import test from 'node:test';

import { ACHIEVEMENTS_BY_ID } from './achievements';
import { AREAS_BY_ID } from './areas';
import { CHARACTERS_BY_ID } from './characters';
import { ENEMIES_BY_ID } from './enemies';
import { FACTIONS_BY_ID } from './factions';
import { WEAPONS_BY_ID } from './weapons';

test('Vector Lev has a complete playable loadout tied to the Lev district', () => {
  const vector = CHARACTERS_BY_ID['vector-lev'];
  assert.ok(vector);
  assert.deepEqual(vector.unlock, { kind: 'clearArea', areaId: 'lev-syndicate-spire' });
  assert.equal(vector.weapon.id, 'lev-expansion');
  assert.equal(vector.weapon.kind, 'nova');
  assert.equal(vector.ultimate.id, 'singularity-collapse');
  assert.deepEqual(WEAPONS_BY_ID['lev-expansion'], vector.weapon);
});

test('Lev Overlord Prime is registered as the district finale', () => {
  const boss = ENEMIES_BY_ID['lev-overlord-prime'];
  const district = AREAS_BY_ID['lev-syndicate-spire'];
  const faction = FACTIONS_BY_ID['lev-syndicate'];
  assert.ok(boss);
  assert.equal(boss.behavior, 'vortex-crusher');
  assert.equal(boss.sizeClass, 'giant');
  assert.ok(faction.roster.includes(boss.id));
  assert.ok(district.waves.some((wave) => wave.enemyId === boss.id && wave.toSec === district.durationSec));
});

test('the defector achievement names a playable character', () => {
  const achievement = ACHIEVEMENTS_BY_ID['singularity-defector'];
  assert.ok(achievement);
  assert.match(achievement.description, /Vector Lev/);
});
