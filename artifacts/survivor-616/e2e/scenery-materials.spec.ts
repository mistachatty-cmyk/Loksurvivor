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
      drawMapPackProp(ctx, id, 100, 100, 80, 80, 2300, 1, { brokenAt: 0, motionEnabled, fragmentLimit });
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
    return { first: pixels(10), later: pixels(500), expired: pixels(2300, 0) };
  });
  expect(result.first).toEqual(result.later);
  expect(result.first.some(value => value !== 0)).toBe(true);
  expect(result.expired.every(value => value === 0)).toBe(true);
});

test('fractures carry the original artwork, animate its pieces, and remain static under reduced motion', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/game/render/propFracture.ts';
    const { drawFracturedProp } = await import(/* @vite-ignore */ modulePath);
    const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    const paint = (target: CanvasRenderingContext2D) => {
      target.fillStyle = '#ff0000'; target.fillRect(110, 120, 40, 60);
      target.fillStyle = '#0000ff'; target.fillRect(150, 120, 40, 60);
    };
    const draw = (now: number, motionEnabled: boolean) => {
      ctx.clearRect(0, 0, 300, 300);
      drawFracturedProp(ctx, { x: 150, y: 150, w: 80, h: 60, damageRatio: 1, material: 'wood',
        seed: 99, now, brokenAt: 0, motionEnabled, cacheKey: 'artwork-proof', quality: 'high' }, paint);
      const pixels = Array.from(ctx.getImageData(0, 0, 300, 300).data);
      const red = pixels.filter((value, i) => i % 4 === 0 && value > 200 && pixels[i + 2]! < 10).length;
      const blue = pixels.filter((value, i) => i % 4 === 2 && value > 200 && pixels[i - 2]! < 10).length;
      const ink = pixels.filter((value, i) => i % 4 === 0 && pixels[i + 1]! > value + 3 && pixels[i + 2]! > pixels[i + 1]! + 5 && pixels[i + 3]! > 200).length;
      return { pixels, red, blue, ink, alpha: ctx.globalAlpha };
    };
    return { early: draw(120, true), late: draw(800, true), stillA: draw(120, false), stillB: draw(800, false), expired: draw(2200, true) };
  });
  expect(result.early.red).toBeGreaterThan(500);
  expect(result.early.blue).toBeGreaterThan(500);
  expect(result.early.ink).toBeGreaterThan(10);
  expect(result.early.pixels).not.toEqual(result.late.pixels);
  expect(result.stillA.pixels).toEqual(result.stillB.pixels);
  expect(result.expired.pixels.every(value => value === 0)).toBe(true);
  expect(result.late.alpha).toBe(1);
});
