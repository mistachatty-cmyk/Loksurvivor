import { expect, test } from '@playwright/test';

test.describe('interactive run controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('survivor616.meta.v1')) return;
      localStorage.setItem(
        'survivor616.meta.v1',
        JSON.stringify({
          version: 10,
          onboarded: true,
          levelUpPausesEnabled: true,
          minimapVisible: true,
          minimapExpanded: true,
          minimapPosition: { x: 0.82, y: 0.18 },
        }),
      );
    });
  });

  test('persists level-up and minimap preferences from settings', async ({ page }) => {
    await page.goto('/?screen=settings');

    await expect(page.getByTestId('section-level-up-settings')).toBeVisible();
    await expect(page.getByTestId('section-minimap-settings')).toBeVisible();
    await page.getByTestId('button-toggle-continuous-levelups').click();
    await page.getByTestId('button-toggle-minimap').click();
    await page.getByTestId('button-minimap-compact').click();
    await expect(page.getByTestId('button-toggle-continuous-levelups')).toContainText('Keep moving');
    await page.waitForTimeout(100);

    await page.reload();
    await expect(page.getByTestId('button-toggle-continuous-levelups')).toContainText('Keep moving');
    await expect(page.getByTestId('button-toggle-minimap')).toContainText('Hidden');
    await expect(page.getByTestId('button-minimap-compact')).toHaveAttribute('aria-pressed', 'true');
  });

  test('shows and persists the hideout palette selection', async ({ page }) => {
    await page.goto('/?screen=settings');

    await expect(page.getByTestId('card-ui-theme-house')).toBeVisible();
    await expect(page.getByTestId('card-ui-theme-night-drive')).toBeVisible();
    await expect(page.getByTestId('button-ui-theme-swatch-house-amber-standard')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByTestId('button-ui-theme-swatch-house-lake-blue').click();
    await expect(page.getByTestId('button-ui-theme-swatch-house-lake-blue')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('[data-ui-theme="house"]')).toHaveAttribute('data-ui-swatch', 'lake-blue');

    await page.reload();
    await expect(page.locator('[data-ui-theme="house"]')).toHaveAttribute('data-ui-swatch', 'lake-blue');
  });

  test('saves and persists a complete Lookbook combination', async ({ page }) => {
    await page.goto('/?screen=lookbook');

    await expect(page.getByTestId('section-lookbook-capture')).toBeVisible();
    await page.getByTestId('input-look-name').fill('House Signal');
    await page.getByTestId('button-save-look').click();
    await expect(page.getByText('House Signal', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText('House Signal', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Equipped' })).toBeDisabled();
  });

  test('returns to the paused run after viewing settings', async ({ page }) => {
    await page.goto('/?screen=run&area=endless-streets');
    await expect(page.getByTestId('screen-run')).toBeVisible();
    await page.waitForTimeout(1800);
    await page.getByTestId('button-pause').click();
    await expect(page.getByTestId('overlay-paused')).toBeVisible();
    await page.getByTestId('button-pause-settings').click();
    await expect(page.getByTestId('overlay-run-settings')).toBeVisible();
    await expect(page.getByTestId('section-minimap-settings')).toBeVisible();
    await page.getByTestId('button-back').click();
    await expect(page.getByTestId('overlay-paused')).toBeVisible();
  });

  test('can minimize and drag the live minimap without steering the run', async ({ page }) => {
    await page.goto('/?screen=run&area=endless-streets');
    const minimap = page.getByTestId('minimap');
    await expect(minimap).toBeVisible();
    await page.getByTestId('button-toggle-minimap-size').click();
    await expect(minimap).toContainText('Map minimized');

    const handle = page.getByTestId('minimap-drag-handle');
    const before = await minimap.boundingBox();
    const handleBox = await handle.boundingBox();
    expect(before).not.toBeNull();
    expect(handleBox).not.toBeNull();
    await page.mouse.move(handleBox!.x + 20, handleBox!.y + 10);
    await page.mouse.down();
    await page.mouse.move(90, 300);
    await page.mouse.up();
    const after = await minimap.boundingBox();
    expect(after).not.toBeNull();
    expect(after!.x).toBeLessThan(before!.x);
    expect(after!.y).toBeGreaterThan(before!.y);
  });
});
