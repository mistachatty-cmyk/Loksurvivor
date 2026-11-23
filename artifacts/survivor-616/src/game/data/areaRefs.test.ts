import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { AREAS, AREAS_BY_ID } from './areas';

test('every map unlock points at a map that exists', () => {
  for (const area of AREAS) {
    const unlock = area.unlock as { kind: string; areaId?: string };
    if (unlock.kind === 'clearArea') {
      assert.ok(AREAS_BY_ID[unlock.areaId!], `${area.id} unlocks after "${unlock.areaId}", which does not exist`);
    }
  }
});

test('every map backdrop image exists in public/', () => {
  for (const area of AREAS) {
    if (!area.backdrop) continue;
    assert.ok(existsSync(new URL(`../../../public/${area.backdrop}`, import.meta.url)), `${area.id} backdrop ${area.backdrop} is missing`);
  }
});

test('every map discovery id has discovery text', async () => {
  const { DISCOVERIES } = await import('./progression');
  const known = new Set((DISCOVERIES as Array<{ id: string }>).map((d) => d.id));
  const missing = AREAS.filter((a) => a.discoveryId && !known.has(a.discoveryId)).map((a) => `${a.id}:${a.discoveryId}`);
  assert.deepEqual(missing, []);
});
