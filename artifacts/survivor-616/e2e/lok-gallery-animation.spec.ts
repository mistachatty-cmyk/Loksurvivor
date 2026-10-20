import { expect, test } from '@playwright/test';

test('Lok originals preview every direction, action, and frame before opening a private draft', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.setItem('survivor616.meta.v1', JSON.stringify({ version: 26, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false }));
    localStorage.setItem('survivor616.forge.v1', JSON.stringify({ unlocked: false, operators: [], earned: ['forge', 'inspector', 'factionRaces', 'foil', 'aura', 'slot-circuit', 'slot-crowd', 'slot-roll-call', 'slot-field-notes', 'slot-beast-master'], toggles: { forge: true } }));
  });
  await page.goto('/?screen=settings');
  await page.getByTestId('tab-settings-endgame').click();
  await page.getByTestId('button-open-forge').click();
  await page.getByTestId('forge-tab-studio').click();

  const preview = page.getByRole('region', { name: 'Patchlight animation preview' });
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: 'Pause animation' }).click();
  await preview.getByRole('button', { name: 'Face Back', exact: true }).click();
  await preview.getByRole('button', { name: 'Attack' }).click();
  await expect(preview.getByText('Back · Attack · frame 1/4')).toBeVisible();
  const canvas = preview.getByRole('img', { name: 'Patchlight pixel animation' });
  const first = await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  await preview.getByRole('button', { name: 'Show frame 3' }).click();
  await expect(preview.getByText('Back · Attack · frame 3/4')).toBeVisible();
  const third = await canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  expect(third).not.toBe(first);
  await page.getByRole('button', { name: 'Preview animations' }).last().click();
  await expect(page.getByRole('region', { name: 'Relay Moth animation preview' })).toBeVisible();
  await page.getByRole('button', { name: 'Start from this art' }).last().click();
  await expect(page.getByTestId('studio-v3-editor')).toBeVisible();
  await expect(page.getByText('0/192 frames approved.', { exact: false })).toBeVisible();
});
