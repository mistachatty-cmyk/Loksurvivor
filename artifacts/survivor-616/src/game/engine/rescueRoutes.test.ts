import assert from 'node:assert/strict';
import test from 'node:test';

import { getArea } from '@/game/data/areas';
import { getCharacter } from '@/game/data/characters';
import { createWorld, hudSnapshot } from './world';

test('the world honors the progression-selected rescue ally', () => {
  const character = getCharacter('shade');
  const world = createWorld(getArea('rooftops'), character, character.stats, 42, [], 1, true, null, {
    rescueAllyId: 'morrow',
  });
  assert.equal(hudSnapshot(world).rescueAllyName, 'Morrow');
});

test('an explicit missing rescue leaves a completed route without a duplicate cage', () => {
  const character = getCharacter('shade');
  const world = createWorld(getArea('monroe-strip'), character, character.stats, 42, [], 1, true, null, {
    rescueAllyId: undefined,
  });
  assert.equal(hudSnapshot(world).rescueAllyName, undefined);
  assert.equal(hudSnapshot(world).rescueAvailable, false);
});
