import { expect, test } from '@playwright/test';

test('map-pack props expire without ghost details at every motion and graphics setting', async ({ page }) => {
  await page.goto('/');
  const checked = await page.evaluate(async () => {
    const modulePath = '/src/game/render/mapPackArt.ts';
    const { drawMapPackProp } = await import(/* @vite-ignore */ modulePath);
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    const ids = ['transit-shelter', 'bus-wreck', 'ticket-kiosk', 'rail-sign', 'lamp-cluster', 'power-cabinet', 'barricade', 'cache-cart', 'root-arch', 'pulse-sapling', 'holographic-tree', 'spore-vent', 'resin-pod', 'living-cable', 'crystal-stump', 'node-pylon'];
    let count = 0;
    for (const id of ids) for (const motionEnabled of [true, false]) for (const fragmentLimit of [4, 6, 9]) {
      ctx.clearRect(0, 0, 200, 200);
      drawMapPackProp(ctx, id, 100, 100, 80, 80, 1000, 1, { brokenAt: 0, motionEnabled, fragmentLimit });
      if (ctx.getImageData(0, 0, 200, 200).data.some(value => value !== 0)) throw new Error(`Ghost prop: ${id}`);
      if (ctx.globalAlpha !== 1) throw new Error(`Canvas state leak: ${id}`);
      count += 1;
    }
    return count;
  });
  expect(checked).toBe(96);
});

test('reduced motion freezes ambient prop animation while destruction still fades', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/game/render/mapPackArt.ts';
    const { drawMapPackProp } = await import(/* @vite-ignore */ modulePath);
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    const pixels = (now: number, brokenAt?: number) => {
      ctx.clearRect(0, 0, 200, 200);
      drawMapPackProp(ctx, 'spore-vent', 100, 100, 80, 80, now, 0, { motionEnabled: false, brokenAt });
      return Array.from(ctx.getImageData(0, 0, 200, 200).data);
    };
    return { first: pixels(10), later: pixels(500), expired: pixels(1000, 0) };
  });
  expect(result.first).toEqual(result.later);
  expect(result.first.some(value => value !== 0)).toBe(true);
  expect(result.expired.every(value => value === 0)).toBe(true);
});
