import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createBudget, DEFAULT_NET, getNetConfig, loadNetConfig, parseNetConfig } from './netConfig';

test('the dial falls back to gentle defaults and clamps what it is given', () => {
  assert.deepEqual(parseNetConfig(null), DEFAULT_NET);
  assert.deepEqual(parseNetConfig('nope'), DEFAULT_NET);
  const parsed = parseNetConfig({ chat: false, crewRuns: 'yes', chatPerMinute: 9999, runTickHz: 0, presence: false });
  assert.equal(parsed.chat, false);
  assert.equal(parsed.presence, false);
  assert.equal(parsed.crewRuns, true, 'a wrong type keeps the default');
  assert.equal(parsed.chatPerMinute, 60);
  assert.equal(parsed.runTickHz, 1);
});

test('the token bucket allows a burst, then only what refills', () => {
  const budget = createBudget(2, 3);
  assert.ok(budget.take(1000) && budget.take(1000) && budget.take(1000));
  assert.ok(!budget.take(1000));
  assert.ok(!budget.take(1200), 'not enough has refilled yet');
  assert.ok(budget.take(1600), 'a second token has come back');
  assert.ok(!budget.take(1600));
});

test('the dial file is read once and a bad file changes nothing', async () => {
  const good = (async () => ({ ok: true, json: async () => ({ chat: false, runTickHz: 2 }) })) as unknown as typeof fetch;
  await loadNetConfig(good, '/lok-net.json');
  assert.equal(getNetConfig().chat, false);
  assert.equal(getNetConfig().runTickHz, 2);
  const bad = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  await loadNetConfig(bad, '/other.json');
  assert.equal(getNetConfig().chat, false, 'already loaded this session; a second load is ignored');
});
