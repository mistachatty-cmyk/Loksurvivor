import assert from 'node:assert/strict';
import test from 'node:test';

import { CHANGELOG, CURRENT_VERSION, changelogEntriesSince, compareVersions, isVersionNewer, updateNumber } from './changelog';

test('CHANGELOG is non-empty and every version is unique', () => {
  assert.ok(CHANGELOG.length > 0);
  const versions = CHANGELOG.map((entry) => entry.version);
  assert.equal(new Set(versions).size, versions.length, 'a version number was reused');
});

test('CURRENT_VERSION is the last entry in the array', () => {
  assert.equal(CURRENT_VERSION, CHANGELOG[CHANGELOG.length - 1]!.version);
});

test('compareVersions orders MAJOR.MINOR.PATCH numerically, not lexically', () => {
  assert.ok(compareVersions('0.2.0', '0.10.0') < 0, '0.10.0 must sort after 0.2.0, not before it as a string compare would');
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.ok(compareVersions('1.0.0', '0.9.9') > 0);
  assert.ok(compareVersions('0.9.9', '1.0.0') < 0);
});

test('isVersionNewer is strict (equal versions are not "newer")', () => {
  assert.equal(isVersionNewer('0.5.0', '0.5.0'), false);
  assert.equal(isVersionNewer('0.5.0', '0.4.0'), true);
  assert.equal(isVersionNewer('0.4.0', '0.5.0'), false);
});

test('changelogEntriesSince returns everything for a player who has seen nothing', () => {
  const entries = changelogEntriesSince('0.0.0');
  assert.equal(entries.length, CHANGELOG.length);
});

test('changelogEntriesSince returns nothing once caught up to CURRENT_VERSION', () => {
  assert.equal(changelogEntriesSince(CURRENT_VERSION).length, 0);
});

test('changelogEntriesSince returns only entries strictly newer than the given version', () => {
  const firstVersion = CHANGELOG[0]!.version;
  const entries = changelogEntriesSince(firstVersion);
  assert.equal(entries.length, CHANGELOG.length - 1);
  assert.ok(entries.every((entry) => isVersionNewer(entry.version, firstVersion)));
});

test('updateNumber counts up from 1 in ship order', () => {
  assert.equal(updateNumber(CHANGELOG[0]!), 1);
  assert.equal(updateNumber(CHANGELOG[CHANGELOG.length - 1]!), CHANGELOG.length);
});
