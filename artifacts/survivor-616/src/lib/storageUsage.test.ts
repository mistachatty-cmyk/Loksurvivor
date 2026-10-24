import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatBytes, saveBytes } from './storageUsage';

test('byte sizes read in plain units', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBytes(250 * 1024 * 1024), '250 MB');
  assert.equal(formatBytes(NaN), '0 B');
});

test('only this game\'s keys count toward the save size', () => {
  const data: Record<string, string> = { 'survivor616.meta.v1': 'abcd', 'other.app': 'zzzzzzzz', 'survivor616.x': 'q' };
  const keys = Object.keys(data);
  const fake = { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => data[k] ?? null };
  assert.equal(saveBytes(fake), ('survivor616.meta.v1'.length + 4 + 'survivor616.x'.length + 1) * 2);
});
