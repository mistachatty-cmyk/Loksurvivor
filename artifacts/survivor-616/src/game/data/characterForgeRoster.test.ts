import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CHARACTERS } from './characters';
import { forgeDesignForCharacter, getCharacterRoster } from './characterForgeRoster';
import { buildOperatorRig, HEX } from './operatorForge';

test('the roster has one forged entry per hand-authored character', () => {
  const roster = getCharacterRoster();
  assert.equal(roster.length, CHARACTERS.length);
  assert.deepEqual(roster.map((r) => r.id).sort(), CHARACTERS.map((c) => c.id).sort());
});

test('forging a character is deterministic and produces a buildable rig', () => {
  for (const character of CHARACTERS.slice(0, 10)) {
    const a = forgeDesignForCharacter(character);
    const b = forgeDesignForCharacter(character);
    assert.deepEqual(a, b, `${character.id} should forge the same design every time`);
    for (const value of Object.values(a.palette)) assert.match(value, HEX);
    assert.ok(buildOperatorRig(a).parts.length > 0, `${character.id} should build a non-empty rig`);
  }
});

test('two different characters forge different designs', () => {
  const [a, b] = CHARACTERS;
  assert.ok(a && b);
  assert.notDeepEqual(forgeDesignForCharacter(a), forgeDesignForCharacter(b));
});
