import assert from 'node:assert/strict';
import { test } from 'node:test';

import { positionStateFor, sessionMetaFor, skipTarget } from './mediaSessionMeta';

test('a bundled song is credited to the game, a local file to nobody', () => {
  assert.equal(sessionMetaFor({ title: 'A', source: 'bundled', album: 'Lokifed — Take 1' }, '/').artist, '616 Survivor');
  assert.equal(sessionMetaFor({ title: 'B', source: 'local' }, '/').artist, '');
  assert.equal(sessionMetaFor({ title: 'B', source: 'local' }, '/').album, '');
});

test('artwork follows the app base path', () => {
  const meta = sessionMetaFor({ title: 'A', source: 'bundled' }, '/play/');
  assert.deepEqual(meta.artwork.map((a) => a.src), ['/play/icon-512.png', '/play/icon-192.png']);
});

test('the playhead is clamped and unknown lengths give nothing', () => {
  assert.equal(positionStateFor(NaN, 3), null);
  assert.equal(positionStateFor(0, 0), null);
  assert.equal(positionStateFor(Infinity, 1), null);
  assert.deepEqual(positionStateFor(100, 140), { duration: 100, position: 100, playbackRate: 1 });
  assert.equal(positionStateFor(100, -5)?.position, 0);
  assert.equal(positionStateFor(100, 5, 0)?.playbackRate, 1);
});

test('skipping never goes before the start', () => {
  assert.equal(skipTarget(4, 10, -1), 0);
  assert.equal(skipTarget(30, 10, 1), 40);
  assert.equal(skipTarget(NaN, 10, 1), 10);
});

test('nothing on the lock screen uses the retired word', () => {
  assert.ok(!JSON.stringify(sessionMetaFor({ title: 'x', source: 'bundled' }, '/')).toLowerCase().includes('signal'));
});
