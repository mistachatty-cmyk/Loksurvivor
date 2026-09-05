import assert from 'node:assert/strict';
import test from 'node:test';

import { ENEMIES } from './enemies';
import { FACTIONS } from './factions';
import { squadWave } from './authoring';

test('every EnemyDef.faction string names a registered faction', () => {
  const names = new Set(FACTIONS.map((f) => f.name));
  for (const enemy of ENEMIES) {
    if (enemy.faction) {
      assert.ok(names.has(enemy.faction), `${enemy.id} references unknown faction "${enemy.faction}"`);
    }
  }
});

test('every faction roster id names a real enemy, with no duplicates', () => {
  const enemyIds = new Set(ENEMIES.map((e) => e.id));
  for (const faction of FACTIONS) {
    assert.ok(faction.roster.length > 0, `${faction.id} has an empty roster`);
    assert.equal(new Set(faction.roster).size, faction.roster.length, `${faction.id} lists a roster id twice`);
    for (const enemyId of faction.roster) {
      assert.ok(enemyIds.has(enemyId), `${faction.id} roster references unknown enemy "${enemyId}"`);
    }
  }
});

test('squadWave spawns the whole roster as one lead + group', () => {
  const wave = squadWave({ fromSec: 0, toSec: 10, factionId: 'bubbleteer-parade', ratePerSec: 1 });
  assert.equal(wave.enemyId, 'bubbleteer-cadet');
  assert.deepEqual(wave.group, ['bubbleteer-shocker', 'captain-frothbite']);
  assert.equal(wave.burst, 1);
  assert.equal(wave.faction, 'Bubbleteer Parade');
});

test('squadWave rejects an unknown faction id', () => {
  assert.throws(() => squadWave({ fromSec: 0, toSec: 10, factionId: 'not-a-faction', ratePerSec: 1 }));
});
