import { expect, test } from '@playwright/test';

test.describe('Lock Deck card packs', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('survivor616.meta.v1', JSON.stringify({ onboarded: true }));
    });
    await page.goto('/?screen=archive');
    await page.getByTestId('button-archive-tab-cards').click();
  });

  test('renders pack slots, real operative cards, and card details', async ({ page }) => {
    await expect(page.getByTestId('section-cards')).toBeVisible();
    await expect(page.locator('[data-testid^="button-card-pack-"]')).toHaveCount(5);
    await expect(page.getByTestId('card-lok-character-shade')).toBeVisible();
    await page.getByTestId('card-lok-character-shade').click();
    await expect(page.getByRole('dialog', { name: 'Card details' })).toContainText('Shade');
    await expect(page.getByRole('dialog', { name: 'Card details' })).toContainText('g6.616-survivor:character-shade');
  });

  test('keeps the binder usable at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('button-card-pack-operatives')).toBeVisible();
    await expect(page.getByTestId('card-lok-character-shade')).toBeVisible();
    const bodyOverflows = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
    expect(bodyOverflows).toBe(false);
  });
});
