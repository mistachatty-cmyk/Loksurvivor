import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateManifest } from '../src/index.js';

test('a good manifest has no problems', () => {
  assert.deepEqual(
    validateManifest([
      { id: 'a', title: 'A', pattern: 'rings', palette: ['#000', '#ffffff', '#c8a24a'] },
      { id: 'b', title: 'B', links: [{ label: 'Page', href: 'https://example.org/b' }] },
    ]),
    [],
  );
});

test('problems are reported in plain words', () => {
  const problems = validateManifest([
    { id: 'a', title: 'A' },
    { id: 'a', title: '' },
    { id: 'c', title: 'C', pattern: 'plaid' },
    { id: 'd', title: 'D', palette: ['red', 'green'] },
    { id: 'e', title: 'E', links: [{ label: 'x', href: 'http://insecure.example' }] },
  ]);
  assert.equal(problems.length, 5);
  assert.match(problems.join('\n'), /duplicate id a/);
  assert.match(problems.join('\n'), /unknown pattern plaid/);
  assert.match(problems.join('\n'), /three hex colors/);
  assert.match(problems.join('\n'), /https/);
});

test('a non-array is rejected', () => {
  assert.deepEqual(validateManifest({}), ['manifest is not an array']);
});
