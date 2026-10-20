import { expect, test } from '@playwright/test';

import { STANDARD_MAPS } from '../src/game/data/endgameUnlocks';

const META_KEY = 'survivor616.meta.v1';
const FORGE_KEY = 'survivor616.forge.v1';
const standardIds = STANDARD_MAPS.map((a) => a.id);

test.describe('end game settings', () => {
  test('stay out of sight until every standard map is cleared', async ({ page }) => {
    await page.addInitScript(([metaKey, ids]) => {
      if (!localStorage.getItem(metaKey!)) {
        // One short of finished.
        localStorage.setItem(metaKey!, JSON.stringify({
          version: 5, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false, clearedAreaIds: (ids as string[]).slice(1),
        }));
      }
    }, [META_KEY, standardIds] as [string, string[]]);
    await page.goto('/?screen=settings');
    await expect(page.getByText('Controls', { exact: false }).first()).toBeVisible();
    await expect(page.getByTestId('tab-settings-endgame')).toHaveCount(0);
    await expect(page.getByTestId('endgame-section')).toHaveCount(0);
    const stored = await page.evaluate((key) => localStorage.getItem(key), FORGE_KEY);
    expect(stored === null || (JSON.parse(stored) as { earned?: string[] }).earned?.length === 0 || !JSON.parse(stored).earned).toBeTruthy();
  });

  test('unlock after clearing every standard map, slide in, and toggle', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(([metaKey, ids]) => {
      if (!localStorage.getItem(metaKey!)) {
        localStorage.setItem(metaKey!, JSON.stringify({
          version: 5, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false, clearedAreaIds: ids, totalKills: 25000,
        }));
      }
    }, [META_KEY, standardIds] as [string, string[]]);
    await page.goto('/?screen=settings');

    await expect(page.getByTestId('settings-tabs')).toBeVisible();
    await expect(page.getByTestId('page-settings-standard')).toBeVisible();
    await page.getByTestId('tab-settings-endgame').click();
    await expect(page.getByTestId('page-settings-endgame')).toBeVisible();
    await expect(page.getByTestId('page-settings-endgame')).toHaveClass(/settings-slide-from-right/);
    await expect(page.getByTestId('endgame-section')).toBeVisible();

    // Clearing the maps earned slot one, 25,000 kills earned Crowd Control; the rest stay locked.
    await expect(page.getByTestId('slot-endgame-slot-circuit')).toContainText('earned');
    await expect(page.getByTestId('slot-endgame-slot-crowd')).toContainText('earned');
    await expect(page.getByTestId('slot-endgame-slot-roll-call')).toContainText('locked');
    await expect(page.getByTestId('slot-endgame-slot-beast-master')).toContainText('locked');

    // Everything starts off, and each switch works both ways.
    const zoom = page.getByTestId('switch-endgame-inspector');
    await expect(zoom).toHaveAttribute('aria-checked', 'false');
    await zoom.click();
    await expect(zoom).toHaveAttribute('aria-checked', 'true');
    await zoom.click();
    await expect(zoom).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('switch-endgame-inspector').click();
    await page.getByTestId('switch-endgame-foil').click();
    await page.getByTestId('switch-endgame-aura').click();

    // Back to Standard slides the other way.
    await page.getByTestId('tab-settings-standard').click();
    await expect(page.getByTestId('page-settings-standard')).toHaveClass(/settings-slide-from-left/);

    // The switches take effect on the roster.
    await page.goto('/?screen=roster');
    expect(await page.locator('[data-testid^="button-inspect-"]').count()).toBeGreaterThan(10);
    expect(await page.locator('.foil-tile').count()).toBe(1);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
