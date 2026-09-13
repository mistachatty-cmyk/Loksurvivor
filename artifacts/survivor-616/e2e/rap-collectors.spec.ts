import { expect, test } from '@playwright/test';

test.describe('Sixth Ward Cypher and LokPet Collectors', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('survivor616.meta.v1', JSON.stringify({
        version: 16,
        onboarded: true,
        cardCredits: 12,
      }));
    });
  });

  test('shows Collectors separately and expands Sleeve’s real pet loadout', async ({ page }) => {
    await page.goto('/?screen=roster');
    await expect(page.getByTestId('section-lokpet-collectors')).toBeVisible();
    await page.getByTestId('button-character-sleeve').click();
    await expect(page.getByTestId('collector-rank-sleeve')).toContainText('LokPet Collector');
    await expect(page.getByTestId('collector-rank-sleeve')).toContainText('+1 team slots');
  });

  test('opens a Card Credit Cipher Pack in the Archive shop', async ({ page }) => {
    await page.goto('/?screen=archive');
    await page.getByTestId('button-archive-tab-cards').click();
    await expect(page.getByTestId('section-lokpet-card-shop')).toContainText('12 CC');
    await page.getByTestId('button-buy-lokpet-card-pack').click();
    await expect(page.getByTestId('section-lokpet-card-shop')).toContainText('0 CC');
  });
});
