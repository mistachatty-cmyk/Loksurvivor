import { expect, test } from '@playwright/test';

const baseMeta = { version: 8, onboarded: true, starterLokPetOnboardingComplete: true, hideoutArrivalEnabled: false, levelUpPausesEnabled: true };

test.beforeEach(async ({ page }) => {
  await page.addInitScript((meta) => { if (!localStorage.getItem('survivor616.meta.v1')) localStorage.setItem('survivor616.meta.v1', JSON.stringify(meta)); }, baseMeta);
});

test('Floodline template saves and reloads with interactables and prefab edits', async ({ page }) => {
  await page.goto('/?screen=hub', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter the hideout' }).click();
  await page.getByTestId('button-hideout-computer').click();
  await page.getByTestId('button-create-custom-map').last().click();
  await page.getByLabel('Map template').selectOption('floodline-breach');
  await expect(page.getByTestId('custom-map-placement').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/floodline-builder.png' });
  await page.getByRole('button', { name: /platform corner/i }).click();
  await page.getByRole('button', { name: 'Rotate 90°' }).click();
  await page.getByTestId('button-save-custom-map').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('survivor616.meta.v1') ?? '{}').customMaps?.length ?? 0)).toBe(1);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('survivor616.meta.v1') ?? '{}').customMaps[0]);
  expect(saved.version).toBe(2);
  expect(saved.name).toBe('Floodline Breach draft');
  expect(saved.placements.some((piece: { assetId: string }) => piece.assetId === 'interactable:relay')).toBeTruthy();
  expect(saved.placements.some((piece: { groupId?: string }) => piece.groupId)).toBeTruthy();
});

test.describe('mobile editor', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('places scenery and saves on touch viewport', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/?screen=hub', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Enter the hideout' }).click();
    await page.getByTestId('button-hideout-computer').click();
    await page.getByTestId('button-create-custom-map').last().click();
    await page.getByTestId('button-place-map-prop:root-arch').click();
    await expect(page.getByTestId('custom-map-placement')).toHaveCount(1);
    await page.getByTestId('button-save-custom-map').click();
    const count = await page.evaluate(() => JSON.parse(localStorage.getItem('survivor616.meta.v1') ?? '{}').customMaps[0].placements.length);
    expect(count).toBe(1);
  });
});

for (const area of ['floodline-breach', 'glassroot-annex'] as const) {
  for (const mobile of [false, true]) {
    test(`${area} renders on ${mobile ? 'phone viewport with reduced effects' : 'desktop'}`, async ({ page }) => {
      test.setTimeout(90_000);
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(({ meta, mobile }) => {
        localStorage.setItem('survivor616.meta.v1', JSON.stringify({
          ...meta,
          devModeAccessUnlocked: true,
          devModeAllUnlocks: true,
          graphicsQuality: mobile ? 'performance' : 'high',
        }));
      }, { meta: baseMeta, mobile });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`/?screen=run&area=${area}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('screen-run')).toBeVisible();
      await page.waitForTimeout(1500);
      expect(errors).toEqual([]);
    });
  }
}
