import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { drawPropDamage, propCrackPaths, propDamageStage, propMaterial } from './breakableFx';
import { drawPropSurface } from './propSurface';

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

// Exercise the renderer contract without depending on browser rasterization.
function recordingCanvas() {
  const operations: unknown[][] = [];
  const state: Record<string, unknown> = { globalAlpha: 1 };
  const stack: Record<string, unknown>[] = [];
  const ctx = new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        operations.push([key, ...args]);
        if (key === 'save') stack.push({ ...target });
        if (key === 'restore') Object.assign(target, stack.pop());
      };
    },
    set(target, key: string, value) { target[key] = value; operations.push([key, value]); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, operations, stack };
}

it('renders deterministic material surfaces with bounded quality and restores canvas state', () => {
  for (const material of ['wood', 'metal', 'stone', 'glass', 'organic'] as const) {
    const first = recordingCanvas(), second = recordingCanvas(), low = recordingCanvas();
    drawPropSurface(first.ctx, material, 0, 0, 80, 60, 616);
    drawPropSurface(second.ctx, material, 0, 0, 80, 60, 616);
    drawPropSurface(low.ctx, material, 0, 0, 80, 60, 616, 'performance');
    assert.deepEqual(first.operations, second.operations);
    assert.ok(low.operations.length < first.operations.length);
    assert.equal(first.ctx.globalAlpha, 1);
    assert.equal(first.stack.length, 0);
  }
});

it('uses static debris for reduced motion, respects the fragment cap and expires completely', () => {
  const visual = { x: 0, y: 0, w: 80, h: 60, seed: 616, material: 'wood' as const,
    damageRatio: 1, brokenAt: 100, now: 300, motionEnabled: false, fragmentLimit: 4 };
  const first = recordingCanvas(), later = recordingCanvas(), expired = recordingCanvas();
  drawPropDamage(first.ctx, visual);
  drawPropDamage(later.ctx, { ...visual, now: 600 });
  // Neither lift nor rotation advances for a motion-disabled player.
  const transforms = (ops: unknown[][]) => ops.filter(([op]) => op === 'translate' || op === 'rotate');
  assert.deepEqual(transforms(first.operations), transforms(later.operations));
  assert.equal(first.operations.filter(([op]) => op === 'rotate').length, 4);
  assert.ok(first.operations.filter(([op]) => op === 'translate').length > 1);
  assert.equal(first.ctx.globalAlpha, 1);
  assert.equal(first.stack.length, 0);
  drawPropDamage(expired.ctx, { ...visual, now: 860 });
  assert.equal(expired.operations.length, 0);
});

it('keeps fractures within the surface and assigns concrete and metal scenery correctly', () => {
  const { ctx, operations, stack } = recordingCanvas();
  drawPropDamage(ctx, { x: 0, y: 0, w: 80, h: 60, seed: 616, material: 'stone', damageRatio: 0.8, now: 100 });
  assert.ok(operations.some(([op]) => op === 'clip'));
  assert.equal(stack.length, 0);
  assert.equal(propMaterial('barrier'), 'stone');
  assert.equal(propMaterial('mailbox'), 'metal');
  assert.equal(propMaterial('map-prop', 'crystal-stump'), 'stone');
});
