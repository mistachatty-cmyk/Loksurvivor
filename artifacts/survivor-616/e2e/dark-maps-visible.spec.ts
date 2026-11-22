import { expect, test } from '@playwright/test';

// Regression guard: dark-map fog once erased the whole world, leaving indoor and fog maps black.
// Uses the dev-only `?screen=run&area=` link. Each map must show a clearly non-black frame.
const MAPS = ['crystal-cellar', 'neon-arcade', 'northline-yard', 'abyssal-subway-4x', 'endless-catacombs', 'null-sector'];

for (const areaId of MAPS) {
  test(`${areaId} is not a black screen`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('survivor616.meta.v1', JSON.stringify({ version: 8, onboarded: true, hideoutArrivalEnabled: false }));
    });
    await page.goto(`/?screen=run&area=${areaId}`);
    await page.waitForTimeout(4000);
    const mean = await page.evaluate(() => {
      const canvas = [...document.querySelectorAll('canvas')].find((c) => c.width >= 200);
      if (!canvas) return -1;
      const probe = document.createElement('canvas');
      probe.width = 64;
      probe.height = 40;
      const ctx = probe.getContext('2d')!;
      ctx.drawImage(canvas, 0, 0, 64, 40);
      const d = ctx.getImageData(0, 0, 64, 40).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return sum / (d.length / 4);
    });
    expect(mean, 'game canvas found').toBeGreaterThan(-1);
    expect(mean, 'average brightness of the frame').toBeGreaterThan(8);
  });
}
