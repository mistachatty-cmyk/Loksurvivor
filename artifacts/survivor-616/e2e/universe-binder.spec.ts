import { expect, test } from '@playwright/test';

test.describe('Universe Binder', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('survivor616.meta.v1', JSON.stringify({
        version: 1,
        onboarded: true,
        cardCollection: [{ cardId: 'g6.616-survivor:character-shade', copies: 1, variants: { standard: 1 }, bestVariant: 'standard', totalValue: 1 }],
      }));
    });
    await page.goto('/?screen=archive');
    await page.getByTestId('button-archive-tab-universe').click();
    await expect(page.getByTestId('section-universe-binder')).toBeVisible();
  });

  test('shows every card under All and splits by game', async ({ page }) => {
    await expect(page.getByTestId('binder-tab-all')).toBeVisible();
    await expect(page.getByTestId('binder-tab-survivor616')).toBeVisible();
    await expect(page.getByTestId('binder-grid').locator('button').first()).toBeVisible();
    await page.getByTestId('binder-tab-survivor616').click();
    await expect(page.getByTestId('binder-tab-survivor616')).toHaveAttribute('aria-selected', 'true');
  });

  test('builds a deck from collected cards and keeps it across reloads', async ({ page }) => {
    await page.getByPlaceholder('New deck name').fill('Night Crew');
    await page.getByTestId('button-create-deck').click();
    await expect(page.getByTestId('deck-detail')).toContainText('Night Crew');
    await page.getByLabel('Collected only').check();
    await page.getByTestId('binder-card-g6.616-survivor:character-shade').click();
    await expect(page.getByTestId('deck-detail')).toContainText('1 cards');
    await page.reload();
    await page.getByTestId('button-archive-tab-universe').click();
    await expect(page.getByTestId('binder-decks')).toContainText('Night Crew');
  });
});
