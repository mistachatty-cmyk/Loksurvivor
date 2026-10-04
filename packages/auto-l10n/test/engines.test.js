import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { argosEngine, buildEngine, chainEngine, toArgosCode } from '../src/engines.js';
import { translateBatch } from '../src/sync.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fakeBridge = () => argosEngine({ command: process.execPath, args: [path.join(here, 'fixtures', 'fake-bridge.mjs')] });

function rateLimitError() {
  const e = new Error('Too Many Requests');
  e.name = 'TooManyRequestsError';
  return e;
}

test('toArgosCode maps file-name tags to Argos codes', () => {
  assert.equal(toArgosCode('es'), 'es');
  assert.equal(toArgosCode('pt-BR'), 'pt');
  assert.equal(toArgosCode('zh-CN'), 'zh');
  assert.equal(toArgosCode('zh-TW'), 'zt');
  assert.equal(toArgosCode('en-GB'), 'en');
});

test('argos engine talks to its bridge process and maps language codes', async () => {
  const engine = fakeBridge();
  try {
    assert.equal(await engine.translate('Hello', { from: 'en', to: 'pt-BR' }), 'en>pt:Hello');
    // Several requests in flight at once are answered to the right caller.
    const replies = await Promise.all(['a', 'b', 'c'].map((text) => engine.translate(text, { from: 'en', to: 'ja' })));
    assert.deepEqual(replies, ['en>ja:a', 'en>ja:b', 'en>ja:c']);
  } finally {
    engine.close();
  }
});

test('argos engine translates batches one piece at a time and keeps the markers', async () => {
  const engine = fakeBridge();
  try {
    const { results, rateLimited } = await translateBatch({ engine, texts: ['One', 'Two', 'Three'], from: 'en', to: 'es' });
    assert.equal(rateLimited, false);
    assert.deepEqual(results.map((r) => r.text), ['en>es:One', 'en>es:Two', 'en>es:Three']);
  } finally {
    engine.close();
  }
});

test('argos engine reports errors from the bridge and a missing Python clearly', async () => {
  const engine = fakeBridge();
  try {
    await assert.rejects(engine.translate('BOOM', { from: 'en', to: 'es' }), /no model/);
    // The process survives an error reply.
    assert.equal(await engine.translate('fine', { from: 'en', to: 'es' }), 'en>es:fine');
  } finally {
    engine.close();
  }
  const missing = argosEngine({ command: 'definitely-not-a-python-binary', args: [] });
  await assert.rejects(missing.translate('Hi', { from: 'en', to: 'es' }), /Install Python 3/);
});

test('chainEngine moves on when the first engine is rate limited and says so once', async () => {
  const calls = [];
  const switches = [];
  const first = { name: 'google', translate: async () => { calls.push('google'); throw rateLimitError(); } };
  const second = { name: 'argos', translate: async (text) => { calls.push('argos'); return `ok:${text}`; } };
  const engine = chainEngine([first, second], { onSwitch: (from, to) => switches.push([from, to]) });
  const replies = await Promise.all(['a', 'b', 'c'].map((text) => engine.translate(text, { from: 'en', to: 'es' })));
  assert.deepEqual(replies, ['ok:a', 'ok:b', 'ok:c']);
  assert.deepEqual(switches, [['google', 'argos']]);
  // Once switched, google is not asked again.
  calls.length = 0;
  await engine.translate('d', { from: 'en', to: 'es' });
  assert.deepEqual(calls, ['argos']);
  assert.equal(engine.name, 'google then argos');
});

test('chainEngine does not hide other errors and rethrows when the last engine is limited', async () => {
  const broken = { name: 'a', translate: async () => { throw new Error('unsupported language'); } };
  const fine = { name: 'b', translate: async () => 'x' };
  await assert.rejects(chainEngine([broken, fine]).translate('t', { from: 'en', to: 'xx' }), /unsupported/);
  const limited = { name: 'a', translate: async () => { throw rateLimitError(); } };
  const alsoLimited = { name: 'b', translate: async () => { throw rateLimitError(); } };
  await assert.rejects(chainEngine([limited, alsoLimited]).translate('t', { from: 'en', to: 'es' }), /Too Many/);
  const solo = { name: 'only', translate: async () => 'x' };
  assert.equal(chainEngine([solo]), solo);
});

test('buildEngine understands lists, the auto alias and module paths', async () => {
  assert.equal((await buildEngine('pseudo', here)).name, 'pseudo');
  assert.equal((await buildEngine('google,argos', here)).name, 'google then argos');
  assert.equal((await buildEngine('auto', here)).name, 'google then argos');
});
