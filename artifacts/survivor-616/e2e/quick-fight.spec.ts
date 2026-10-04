import { expect, test, type Page } from '@playwright/test';

async function seed(page: Page, quickFights: boolean) {
  await page.addInitScript((quick) => {
    localStorage.setItem(
      'survivor616.meta.v1',
      JSON.stringify({ version: 5, onboarded: true, totalRuns: 3, travelEncountersEnabled: true, hideoutArrivalEnabled: false }),
    );
    localStorage.setItem('survivor616.quickfight', quick ? 'on' : 'off');
  }, quickFights);
  await page.goto('/?screen=hub');
}

/** Forces the 25% ambush roll to succeed for exactly one room change, then puts Math.random back. */
async function walkIntoStorefront(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __realRandom: () => number }).__realRandom = Math.random;
    Math.random = () => 0;
  });
  await page.getByTestId('button-room-the-storefront').click();
}

async function restoreRandom(page: Page) {
  await page.evaluate(() => {
    const real = (window as unknown as { __realRandom?: () => number }).__realRandom;
    if (real) Math.random = real;
  });
}

test.describe('Quick fights', () => {
  test('travel encounter plays as a quick fight with matchup labels and a telegraphed move', async ({ page }) => {
    await seed(page, true);
    await walkIntoStorefront(page);
    await expect(page.getByTestId('overlay-quick-fight')).toBeVisible();
    await restoreRandom(page);

    await expect(page.getByTestId('text-quickfight-intent')).toContainText('Next:');
    const moves = page.locator('[data-testid^="button-quickfight-move-"]');
    expect(await moves.count()).toBeGreaterThan(0);
    expect(await moves.count()).toBeLessThanOrEqual(3);
    const labels = page.locator('[data-testid^="label-quickfight-matchup-"]');
    await expect(labels.first()).toHaveText(/Strong|Normal|Weak|Support/);

    // Free strike (the first move) every round until the fight settles.
    for (let round = 0; round < 12; round += 1) {
      if (await page.getByTestId('text-quickfight-outcome').isVisible()) break;
      const first = moves.first();
      await expect(first).toBeEnabled({ timeout: 5000 });
      await first.click();
      await page.waitForTimeout(1100);
    }
    await expect(page.getByTestId('text-quickfight-outcome')).toBeVisible();
    await page.getByTestId('button-continue-quick-fight').click();
    await expect(page.getByTestId('overlay-quick-fight')).toHaveCount(0);
  });

  test('flee ends the fight with no reward', async ({ page }) => {
    await seed(page, true);
    await walkIntoStorefront(page);
    await expect(page.getByTestId('overlay-quick-fight')).toBeVisible();
    await restoreRandom(page);
    await page.getByTestId('button-quickfight-flee').click();
    await expect(page.getByTestId('text-quickfight-outcome')).toHaveText(/Slipped away/);
  });

  test('with the setting off the classic popup is used', async ({ page }) => {
    await seed(page, false);
    await walkIntoStorefront(page);
    await expect(page.getByTestId('overlay-travel-encounter')).toBeVisible();
    await restoreRandom(page);
    await expect(page.getByTestId('overlay-quick-fight')).toHaveCount(0);
  });

  test('the Settings switch is wired to the device setting', async ({ page }) => {
    await seed(page, false);
    await page.goto('/?screen=settings');
    const toggle = page.getByTestId('button-toggle-quick-fights');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('survivor616.quickfight'))).toBe('on');
  });
});
