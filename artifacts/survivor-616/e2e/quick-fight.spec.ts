import { expect, test, type Page } from '@playwright/test';

type Style = 'classic' | 'quick' | 'duo' | 'arena';

async function seed(page: Page, style: Style | 'legacy-on') {
  await page.addInitScript((value) => {
    localStorage.setItem(
      'survivor616.meta.v1',
      JSON.stringify({ version: 5, onboarded: true, totalRuns: 3, travelEncountersEnabled: true, hideoutArrivalEnabled: false }),
    );
    if (value === 'legacy-on') localStorage.setItem('survivor616.quickfight', 'on');
    else localStorage.setItem('survivor616.fightstyle', value);
  }, style);
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

async function playOutFight(page: Page) {
  const moves = page.locator('[data-testid^="button-quickfight-move-"]');
  for (let round = 0; round < 25; round += 1) {
    if (await page.getByTestId('text-quickfight-outcome').isVisible()) break;
    const first = moves.first();
    await expect(first).toBeEnabled({ timeout: 5000 });
    await first.click();
    await page.waitForTimeout(1300);
  }
  await expect(page.getByTestId('text-quickfight-outcome')).toBeVisible();
  await page.getByTestId('button-continue-quick-fight').click();
  await expect(page.getByTestId('overlay-quick-fight')).toHaveCount(0);
}

test.describe('Travel fight styles', () => {
  test('quick: matchup labels, a telegraphed move, and a fight that ends', async ({ page }) => {
    await seed(page, 'quick');
    await walkIntoStorefront(page);
    await expect(page.getByTestId('overlay-quick-fight')).toHaveAttribute('data-fight-style', 'quick');
    await restoreRandom(page);

    await expect(page.getByTestId('text-quickfight-intent')).toContainText('Next:');
    const moves = page.locator('[data-testid^="button-quickfight-move-"]');
    expect(await moves.count()).toBeGreaterThan(0);
    expect(await moves.count()).toBeLessThanOrEqual(3);
    await expect(page.locator('[data-testid^="label-quickfight-matchup-"]').first()).toHaveText(/Strong|Normal|Weak|Support/);
    await expect(page.getByTestId('row-duo-operator')).toHaveCount(0);
    await playOutFight(page);
  });

  test('duo: the operator assist row is there and a round plays with the default punch', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await seed(page, 'duo');
    await walkIntoStorefront(page);
    await expect(page.getByTestId('overlay-quick-fight')).toHaveAttribute('data-fight-style', 'duo');
    await restoreRandom(page);

    await expect(page.getByTestId('row-duo-operator')).toBeVisible();
    await expect(page.getByTestId('button-duo-assist-punch')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('button-duo-assist-cover')).toBeVisible();
    await page.getByTestId('button-duo-assist-cover').click();
    await expect(page.getByTestId('button-duo-assist-cover')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('button-duo-assist-punch').click();
    await playOutFight(page);
  });

  test('arena: all the options are there on a wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await seed(page, 'arena');
    await walkIntoStorefront(page);
    const overlay = page.getByTestId('overlay-quick-fight');
    await expect(overlay).toHaveAttribute('data-fight-style', 'arena');
    await expect(overlay).toHaveAttribute('data-fight-layout', 'wide');
    await restoreRandom(page);

    await expect(page.getByTestId('panel-fight-log')).toBeVisible();
    await expect(page.getByTestId('button-fight-cheer')).toBeEnabled();
    await page.getByTestId('button-fight-cheer').click();
    await expect(page.getByTestId('button-fight-cheer')).toBeDisabled();
    await expect(overlay).toContainText('of 20');
    await playOutFight(page);
  });

  test('phones get the stacked layout for duo and arena', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, 'arena');
    await walkIntoStorefront(page);
    await expect(page.getByTestId('overlay-quick-fight')).toHaveAttribute('data-fight-layout', 'stacked');
    await restoreRandom(page);
    await expect(page.getByTestId('panel-fight-log')).toHaveCount(0);
    await expect(page.getByTestId('button-fight-cheer')).toBeVisible();
    // The page itself must not scroll sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });

  test('flee ends the fight with no reward', async ({ page }) => {
    await seed(page, 'quick');
    await walkIntoStorefront(page);
    await expect(page.getByTestId('overlay-quick-fight')).toBeVisible();
    await restoreRandom(page);
    await page.getByTestId('button-quickfight-flee').click();
    await expect(page.getByTestId('text-quickfight-outcome')).toHaveText(/Slipped away/);
  });

  test('classic keeps the original popup', async ({ page }) => {
    await seed(page, 'classic');
    await walkIntoStorefront(page);
    await expect(page.getByTestId('overlay-travel-encounter')).toBeVisible();
    await restoreRandom(page);
    await expect(page.getByTestId('overlay-quick-fight')).toHaveCount(0);
  });

  test('the first quick-fight build\'s on/off setting still reads as Quick', async ({ page }) => {
    await seed(page, 'legacy-on');
    await walkIntoStorefront(page);
    await expect(page.getByTestId('overlay-quick-fight')).toHaveAttribute('data-fight-style', 'quick');
    await restoreRandom(page);
  });

  test('Settings picks the style and remembers it', async ({ page }) => {
    await seed(page, 'classic');
    await page.goto('/?screen=settings');
    await expect(page.getByTestId('button-fightstyle-classic')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('button-fightstyle-duo').click();
    await expect(page.getByTestId('button-fightstyle-duo')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('text-fightstyle-blurb')).toContainText('Operator and LokPet');
    expect(await page.evaluate(() => localStorage.getItem('survivor616.fightstyle'))).toBe('duo');
  });
});
