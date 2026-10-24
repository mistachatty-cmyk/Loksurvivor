import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatCountdown, nextSleepStep } from './sleepTimer';

test('the sleep button steps through the lengths and wraps to off', () => {
  assert.deepEqual([0, 15, 30, 60, 90].map(nextSleepStep), [15, 30, 60, 90, 0]);
  assert.equal(nextSleepStep(7), 15);
});

test('the countdown reads minutes and padded seconds and never goes negative', () => {
  assert.equal(formatCountdown(14 * 60_000 + 5_000), '14:05');
  assert.equal(formatCountdown(59_001), '1:00');
  assert.equal(formatCountdown(-5), '0:00');
});
