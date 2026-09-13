import assert from 'node:assert/strict';
import test from 'node:test';

import { DIRECTORS } from './directors';
import { FACTIONS_BY_ID } from './factions';
import { ENEMIES } from './enemies';

test('every DirectorDef references a registered faction and a boss inside its roster', () => {
  const enemyIds = new Set(ENEMIES.map((e) => e.id));
  for (const director of DIRECTORS) {
    const faction = FACTIONS_BY_ID[director.factionId];
    assert.ok(faction, `${director.id} references unknown faction "${director.factionId}"`);
    assert.ok(enemyIds.has(director.bossEnemyId), `${director.id} bossEnemyId "${director.bossEnemyId}" is not a real enemy`);
    assert.ok(
      faction!.roster.includes(director.bossEnemyId),
      `${director.id} bossEnemyId "${director.bossEnemyId}" is not in its own faction's roster`,
    );
    assert.ok(director.chance > 0 && director.chance <= 1, `${director.id} chance must be in (0, 1]`);
  }
});
