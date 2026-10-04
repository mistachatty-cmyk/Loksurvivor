import { expect, test } from '@playwright/test';

test.describe('Studio 28 weapon filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('survivor616.meta.v1', JSON.stringify({ onboarded: true }));
    });
    await page.goto('/?screen=weapon-bans');
  });

  test('filters by weapon type, status and search, and bulk-bans without emptying the bill', async ({ page }) => {
    const total = await page.locator('[data-testid^="toggle-weapon-ban-"]').count();
    expect(total).toBeGreaterThan(5);
    const kindChips = page.locator('[data-testid^="filter-weapon-kind-"]:not([data-testid="filter-weapon-kind-all"])');
    expect(await kindChips.count()).toBeGreaterThan(1);

    await kindChips.first().click();
    const shown = await page.locator('[data-testid^="toggle-weapon-ban-"]').count();
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(total);

    await page.getByTestId('button-weapon-ban-clear-filters').click();
    await expect(page.locator('[data-testid^="toggle-weapon-ban-"]')).toHaveCount(total);

    await page.getByTestId('input-weapon-ban-search').fill('zzzz-no-such-weapon');
    await expect(page.locator('[data-testid^="toggle-weapon-ban-"]')).toHaveCount(0);
    await page.getByTestId('button-weapon-ban-clear-filters').click();

    await page.getByTestId('button-weapon-ban-ban-shown').click();
    await page.getByTestId('filter-weapon-status-active').click();
    await expect(page.locator('[data-testid^="toggle-weapon-ban-"]')).toHaveCount(1);
    await page.getByTestId('filter-weapon-status-banned').click();
    await expect(page.locator('[data-testid^="toggle-weapon-ban-"]')).toHaveCount(total - 1);
  });
});
