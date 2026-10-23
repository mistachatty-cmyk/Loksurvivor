/**
 * The game ships to browsers, so anything in the build can be read. These checks keep the build
 * as closed as a browser game can be: no source maps, no readable dev phrase, no debug hooks.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../', import.meta.url).pathname;
const read = (file: string) => readFileSync(join(root, file), 'utf8');

test('the Vite config turns source maps off and strips comments', () => {
  for (const file of ['vite.config.ts', 'vite.overlay.config.ts']) {
    const text = read(file);
    assert.ok(!/sourcemap:\s*(true|'inline'|'hidden'|"inline"|"hidden")/.test(text), `${file} must not emit source maps`);
  }
  const main = read('vite.config.ts');
  assert.ok(/sourcemap:\s*false/.test(main));
  assert.ok(main.includes("legalComments: 'none'"));
});

test('no service worker is registered (the game is not cached for offline reading)', () => {
  assert.ok(!existsSync(join(root, 'public/sw.js')));
  assert.ok(!/serviceWorker\.register/.test(read('src/main.tsx')));
});

test('the dev world hook is development-only', () => {
  const run = read('src/game/RunScreen.tsx');
  const line = run.split('\n').find((l) => l.includes('__world ='));
  assert.ok(line && line.includes('import.meta.env.DEV'));
});

test('a finished build holds no source maps and no readable dev phrase', { skip: !existsSync(join(root, 'dist/public/assets')) }, () => {
  const dir = join(root, 'dist/public/assets');
  const files = readdirSync(dir);
  assert.equal(files.filter((f) => f.endsWith('.map')).length, 0);
  for (const file of files.filter((f) => f.endsWith('.js'))) {
    const text = readFileSync(join(dir, file), 'utf8');
    assert.ok(!text.includes('sourceMappingURL'), `${file} points at a source map`);
    assert.ok(!text.includes('iloveyour'), `${file} contains the dev phrase`);
    assert.ok(!text.includes('__world'), `${file} contains the dev world hook`);
  }
});
