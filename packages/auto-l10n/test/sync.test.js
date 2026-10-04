import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { pseudoEngine } from '../src/engines.js';
import { hashText, planSync, syncLocale, translateString } from '../src/sync.js';
import { run } from '../src/cli.js';

const noSleep = async () => {};

/** Engine that tags text with the target language so tests can see what happened. */
function fakeEngine(calls = []) {
  return {
    name: 'fake',
    translate: async (text, { to }) => {
      calls.push(text);
      return `${to}:${text}`;
    },
  };
}

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'l10n-'));
}

test('planSync finds missing and stale keys and adopts hand-made translations', () => {
  const source = { a: 'One', b: 'Two', c: 'Three', d: 'Four' };
  const plan = planSync({
    source,
    target: { a: 'Uno', b: 'Dos', c: 'Tres-old' },
    lock: { a: hashText('One'), c: hashText('Three, earlier wording') },
  });
  assert.deepEqual(plan.missing, ['d']);
  assert.deepEqual(plan.stale, ['c']);
  assert.deepEqual(plan.adopt, ['b']);
  assert.equal(plan.upToDate, 1);
});

test('planSync flags translations whose placeholders no longer match', () => {
  const plan = planSync({ source: { a: 'Hi {{name}}' }, target: { a: 'Hola' }, lock: { a: hashText('Hi {{name}}') } });
  assert.deepEqual(plan.broken, ['a']);
});

test('translateString protects placeholders and glossary terms from the engine', async () => {
  const seen = [];
  const engine = { translate: async (text) => { seen.push(text); return text.replace('Collect', 'Recoge'); } };
  const outcome = await translateString({ engine, text: 'Collect {{n}} LokPets', from: 'en', to: 'es', glossary: ['LokPets'], sleep: noSleep });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.text, 'Recoge {{n}} LokPets');
  assert.ok(!seen[0].includes('{{') && !seen[0].includes('LokPets'));
});

test('translateString rejects a result that lost a placeholder', async () => {
  const engine = { translate: async () => 'sin nada' };
  const outcome = await translateString({ engine, text: 'Hello {{name}}', from: 'en', to: 'es', sleep: noSleep });
  assert.equal(outcome.ok, false);
});

test('translateString copies strings with nothing to translate without calling the engine', async () => {
  const calls = [];
  const outcome = await translateString({ engine: fakeEngine(calls), text: '{{n}}', from: 'en', to: 'es', sleep: noSleep });
  assert.deepEqual(outcome, { ok: true, text: '{{n}}' });
  assert.equal(calls.length, 0);
});

test('translateString retries rate limits with backoff and gives up with rateLimited set', async () => {
  let attempts = 0;
  const waits = [];
  const engine = { translate: async () => { attempts += 1; const e = new Error('Too Many Requests'); e.name = 'TooManyRequestsError'; throw e; } };
  const outcome = await translateString({ engine, text: 'Hello', from: 'en', to: 'es', retries: 2, retryDelayMs: 10, sleep: async (ms) => { waits.push(ms); } });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.rateLimited, true);
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [10, 20]);
});

test('translateString does not retry non-transient errors', async () => {
  let attempts = 0;
  const engine = { translate: async () => { attempts += 1; throw new Error('The language "xx" is not supported'); } };
  const outcome = await translateString({ engine, text: 'Hello', from: 'en', to: 'xx', retries: 3, sleep: noSleep });
  assert.equal(outcome.ok, false);
  assert.equal(attempts, 1);
});

test('syncLocale only translates what changed and never overwrites human edits', async () => {
  const dir = await tempDir();
  const lock = {};
  const calls = [];
  const common = { dir, sourceLocale: 'en', locale: 'es', lock, engine: fakeEngine(calls), delayMs: 0, sleep: noSleep };

  let result = await syncLocale({ ...common, sourceData: { a: 'One', b: 'Two' } });
  assert.equal(result.translated, 2);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'es.json'), 'utf8')), { a: 'es:One', b: 'es:Two' });

  // A translator fixes a string by hand, then the English for "b" changes.
  await fs.writeFile(path.join(dir, 'es.json'), JSON.stringify({ a: 'Uno (editado)', b: 'es:Two' }));
  calls.length = 0;
  result = await syncLocale({ ...common, sourceData: { a: 'One', b: 'Two, reworded', c: 'Three' } });
  assert.equal(result.translated, 2);
  assert.deepEqual(calls.sort(), ['Three', 'Two, reworded']);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'es.json'), 'utf8')), { a: 'Uno (editado)', b: 'es:Two, reworded', c: 'es:Three' });

  // Nothing changed: no work, no writes.
  calls.length = 0;
  result = await syncLocale({ ...common, sourceData: { a: 'One', b: 'Two, reworded', c: 'Three' } });
  assert.equal(result.translated, 0);
  assert.equal(result.wrote, false);
  assert.equal(calls.length, 0);
});

test('syncLocale keeps nested shape, orders keys like the source, and prunes on request', async () => {
  const dir = await tempDir();
  await fs.writeFile(path.join(dir, 'fr.json'), JSON.stringify({ old: { key: 'ancien' } }));
  const options = { dir, sourceLocale: 'en', locale: 'fr', lock: {}, engine: fakeEngine(), delayMs: 0, sleep: noSleep };

  await syncLocale({ ...options, sourceData: { menu: { play: 'Play' }, title: 'Title' } });
  let written = JSON.parse(await fs.readFile(path.join(dir, 'fr.json'), 'utf8'));
  assert.deepEqual(Object.keys(written), ['menu', 'title', 'old']);
  assert.equal(written.menu.play, 'fr:Play');

  await syncLocale({ ...options, sourceData: { menu: { play: 'Play' }, title: 'Title' }, prune: true });
  written = JSON.parse(await fs.readFile(path.join(dir, 'fr.json'), 'utf8'));
  assert.deepEqual(Object.keys(written), ['menu', 'title']);
});

test('syncLocale stops a language on a rate limit but keeps what it finished', async () => {
  const dir = await tempDir();
  let count = 0;
  const engine = {
    name: 'flaky',
    translate: async (text) => {
      count += 1;
      if (count > 1) { const e = new Error('Too Many Requests'); e.name = 'TooManyRequestsError'; throw e; }
      return `x:${text}`;
    },
  };
  const result = await syncLocale({ dir, sourceLocale: 'en', locale: 'de', sourceData: { a: 'A', b: 'B', c: 'C' }, lock: {}, engine, delayMs: 0, retries: 0, sleep: noSleep });
  assert.equal(result.translated, 1);
  assert.equal(result.rateLimited, true);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, 'de.json'), 'utf8')), { a: 'x:A' });
});

test('the pseudo engine keeps placeholders intact end to end', async () => {
  const outcome = await translateString({ engine: pseudoEngine(), text: 'Score: {{score}} for LokPet', from: 'en', to: 'qps', glossary: ['LokPet'], sleep: noSleep });
  assert.equal(outcome.ok, true);
  assert.ok(outcome.text.includes('{{score}}'));
  assert.ok(outcome.text.includes('LokPet'));
  assert.notEqual(outcome.text, 'Score: {{score}} for LokPet');
});

test('cli: sync then check, using the offline engine and a config file', async () => {
  const dir = await tempDir();
  await fs.mkdir(path.join(dir, 'locales'));
  await fs.writeFile(path.join(dir, 'locales', 'en.json'), JSON.stringify({ 'menu.play': 'Play', 'hud.score': 'Score: {{score}}' }));
  await fs.writeFile(path.join(dir, 'l10n.config.json'), JSON.stringify({ targets: ['es', 'pt-BR'], engine: 'pseudo', glossary: ['Score'] }));

  const lines = [];
  const log = (line) => lines.push(line);
  assert.equal(await run(['check'], { cwd: dir, log }), 1);
  assert.equal(await run(['sync'], { cwd: dir, log }), 0);
  assert.equal(await run(['check'], { cwd: dir, log }), 0);

  const es = JSON.parse(await fs.readFile(path.join(dir, 'locales', 'es.json'), 'utf8'));
  assert.ok(es['hud.score'].includes('{{score}}'));
  assert.ok(es['hud.score'].includes('Score'));
  const lock = JSON.parse(await fs.readFile(path.join(dir, 'locales', '.l10n-lock.json'), 'utf8'));
  assert.deepEqual(Object.keys(lock), ['es', 'pt-BR']);

  // Changing the English makes the targets stale again.
  await fs.writeFile(path.join(dir, 'locales', 'en.json'), JSON.stringify({ 'menu.play': 'Start', 'hud.score': 'Score: {{score}}' }));
  assert.equal(await run(['check'], { cwd: dir, log }), 1);
});

test('cli: dry-run writes nothing and init scaffolds a project', async () => {
  const dir = await tempDir();
  const lines = [];
  const log = (line) => lines.push(line);
  assert.equal(await run(['init'], { cwd: dir, log }), 0);
  for (const file of ['l10n.config.json', 'locales/en.json', '.github/workflows/auto-l10n.yml']) await fs.access(path.join(dir, file));

  assert.equal(await run(['sync', '--dry-run', '--engine', 'pseudo'], { cwd: dir, log }), 0);
  await assert.rejects(fs.access(path.join(dir, 'locales', 'es.json')));
});

test('the bin script runs and prints help', () => {
  const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'auto-translate.js');
  const out = spawnSync(process.execPath, [bin, '--help'], { encoding: 'utf8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /auto-l10n/);
});
