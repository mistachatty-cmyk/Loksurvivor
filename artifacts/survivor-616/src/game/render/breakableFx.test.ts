import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { propCrackPaths, propDamageStage, propMaterial } from './breakableFx';

describe('breakable visual stages', () => {
  it('uses three stable damage thresholds', () => {
    assert.deepEqual([0, 0.16, 0.43, 0.72, 1].map(propDamageStage), [0, 1, 2, 3, 3]);
  });

  it('preserves earlier crack arms as damage increases', () => {
    const first = propCrackPaths(616, 1);
    const second = propCrackPaths(616, 2);
    const third = propCrackPaths(616, 3);
    assert.equal(first.length, 2);
    assert.deepEqual(second.slice(0, first.length), first);
    assert.deepEqual(third.slice(0, second.length), second);
    assert.deepEqual(propCrackPaths(616, 3), third);
  });

  it('assigns material families from prop identity', () => {
    assert.equal(propMaterial('map-prop', 'transit-shelter'), 'glass');
    assert.equal(propMaterial('crate', undefined), 'wood');
    assert.equal(propMaterial('server-rack', undefined), 'metal');
    assert.equal(propMaterial('barrel', undefined), 'metal');
    assert.equal(propMaterial('flora', undefined), 'organic');
  });
});
