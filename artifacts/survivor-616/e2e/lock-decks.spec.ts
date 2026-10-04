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
    await expect(page.getByRole('dialog', { name: 'Card details' })).toContainText('Unknown Card');
    await expect(page.getByRole('dialog', { name: 'Card details' })).toContainText('sealed');
  });

  test('card style picker offers Classic, New and Dynamic 3D', async ({ page }) => {
    await expect(page.getByTestId('button-viewmode-classic')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.lok-collection-card').first()).toBeVisible();
    await page.getByTestId('button-viewmode-new').click();
    await expect(page.getByTestId('button-viewmode-new')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.lok-collection-card')).toHaveCount(0);
    await expect(page.getByTestId('card-lok-character-shade')).toBeVisible();
    await page.getByTestId('button-viewmode-classic').click();
    await expect(page.locator('.lok-collection-card').first()).toBeVisible();
  });

  test('keeps the binder usable at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('button-card-pack-operatives')).toBeVisible();
    await expect(page.getByTestId('card-lok-character-shade')).toBeVisible();
    const bodyOverflows = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
    expect(bodyOverflows).toBe(false);
  });

  test('has a dedicated card-shop destination outside the Archive', async ({ page }) => {
    await page.goto('/?screen=card-shop');
    await expect(page.getByTestId('section-card-shop')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lock Pack Counter' })).toBeVisible();
    await expect(page.locator('[data-testid^="button-card-pack-"]')).toHaveCount(5);
  });
});
