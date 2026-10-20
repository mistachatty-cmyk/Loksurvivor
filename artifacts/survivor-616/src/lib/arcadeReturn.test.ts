import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arcadePathFromSearch, arcadeReturnUrl, isArcadeReturnFresh } from './arcadeReturn';

test('the arcade path is read from the embed address', () => {
  assert.equal(arcadePathFromSearch('?arcade=/games/survivor616'), '/games/survivor616');
  assert.equal(arcadePathFromSearch('?arcade=%2Fgames%2Fsurvivor616'), '/games/survivor616');
  assert.equal(arcadePathFromSearch(''), null);
});

test('only plain same-site paths are accepted as a return address', () => {
  for (const bad of ['//evil.example', 'https://evil.example', '/a?b=1', '/a#b', 'games/x', '/a b', '/\\evil']) {
    assert.equal(arcadePathFromSearch(`?arcade=${encodeURIComponent(bad)}`), null, bad);
  }
});

test('the return address is on the arcade origin and flags the sign-in', () => {
  assert.equal(arcadeReturnUrl('/games/survivor616'), 'https://gsix.online/games/survivor616?signedin=survivor616');
});

test('a saved return expires', () => {
  assert.equal(isArcadeReturnFresh(1000, 1000 + 60_000), true);
  assert.equal(isArcadeReturnFresh(1000, 1000 + 11 * 60_000), false);
  assert.equal(isArcadeReturnFresh(5000, 1000), false);
});
