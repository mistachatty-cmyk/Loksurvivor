import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAbortError, isCrossOriginUrl, nextFailureAction } from './playbackRecovery';

test('an interrupted play() is recognised so it is not shown as a broken song', () => {
  assert.equal(isAbortError({ name: 'AbortError' }), true);
  assert.equal(isAbortError({ name: 'NotAllowedError' }), false);
  assert.equal(isAbortError(null), false);
  assert.equal(isAbortError('AbortError'), false);
});

test('only files on another origin need a CORS request', () => {
  const page = 'https://survivor.gsix.online';
  assert.equal(isCrossOriginUrl('/music/a.m4a', page), false);
  assert.equal(isCrossOriginUrl('https://survivor.gsix.online/music/a.m4a', page), false);
  assert.equal(isCrossOriginUrl('blob:https://survivor.gsix.online/abc', page), false);
  assert.equal(isCrossOriginUrl('https://haicuu.gsix.online/music/rbm.mp3', page), true);
  assert.equal(isCrossOriginUrl('http://survivor.gsix.online/music/a.m4a', page), true);
  assert.equal(isCrossOriginUrl('', page), false);
});

test('a failed song is retried once, then skipped, and the queue never loops forever', () => {
  assert.equal(nextFailureAction({ alreadyRetried: false, consecutiveFailures: 0, queueLength: 5 }), 'retry');
  assert.equal(nextFailureAction({ alreadyRetried: true, consecutiveFailures: 1, queueLength: 5 }), 'skip');
  assert.equal(nextFailureAction({ alreadyRetried: true, consecutiveFailures: 5, queueLength: 5 }), 'stop');
  assert.equal(nextFailureAction({ alreadyRetried: true, consecutiveFailures: 1, queueLength: 1 }), 'stop');
});
