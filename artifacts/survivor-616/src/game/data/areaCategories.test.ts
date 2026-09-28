import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from './areas';
import { areaCategory, areasInCategory } from './areaCategories';

test('authored odd routes appear in Bonus Maps instead of disappearing', () => {
  assert.equal(areaCategory(AREAS.find((area) => area.id === 'mirror-mile')!), 'bonus');
  assert.equal(areaCategory(AREAS.find((area) => area.id === 'clockmouth-roundabout')!), 'bonus');
  assert.ok(areasInCategory(AREAS, 'bonus').length >= 4);
});

test('standard, 2x, endless, and bonus categories are mutually exclusive', () => {
  const categorized = new Set(AREAS.map((area) => `${area.id}:${areaCategory(area)}`));
  assert.equal(categorized.size, AREAS.length);
  assert.equal(areaCategory(AREAS.find((area) => area.id === 'monroe-strip')!), 'standard');
  assert.equal(areaCategory(AREAS.find((area) => area.id === 'monroe-strip-2x')!), '2x');
  assert.equal(areaCategory(AREAS.find((area) => area.endless)!), 'endless');
});
