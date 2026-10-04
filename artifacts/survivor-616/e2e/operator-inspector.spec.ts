import { expect, test } from '@playwright/test';

test.describe('operator inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('survivor616.forge.v1')) {
        localStorage.setItem('survivor616.forge.v1', JSON.stringify({ unlocked: false, operators: [], earned: ['inspector'], toggles: { inspector: true } }));
      }
      if (!localStorage.getItem('survivor616.meta.v1')) {
        localStorage.setItem('survivor616.meta.v1', JSON.stringify({ version: 5, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false }));
      }
    });
  });

  test('opens from a tile, browses, zooms and closes', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?screen=roster');

    const inspectButtons = page.locator('[data-testid^="button-inspect-"]');
    expect(await inspectButtons.count()).toBeGreaterThan(10);
    await inspectButtons.nth(2).click();

    const panel = page.getByTestId('panel-operator-inspector');
    await expect(panel).toBeVisible();
    const first = await page.getByTestId('text-inspector-name').textContent() ?? '';
    const canvas = panel.locator('canvas[data-character-portrait]');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box!.height).toBeGreaterThan(300);

    // Zoom is in whole steps and the slider changes the canvas.
    const zoomBefore = await page.getByTestId('text-inspector-zoom').innerText();
    await page.getByTestId('range-inspector-zoom').fill('3');
    await expect(page.getByTestId('text-inspector-zoom')).toHaveText('12x');
    expect(zoomBefore).not.toBe('12x');
    const smaller = await canvas.boundingBox();
    expect(smaller!.height).toBeLessThan(box!.height);

    // Animations and backdrops respond.
    await page.getByTestId('button-inspector-anim-attack').click();
    await expect(page.getByTestId('button-inspector-anim-attack')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('button-inspector-backdrop-day').click();
    await expect(page.getByTestId('button-inspector-backdrop-day')).toHaveAttribute('aria-pressed', 'true');

    // Browse with the button and the keyboard.
    await page.getByTestId('button-inspector-next').click();
    const second = await page.getByTestId('text-inspector-name').textContent() ?? '';
    expect(second).not.toBe(first);
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('text-inspector-name')).toHaveText(first!);

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('can select an operator from the inspector', async ({ page }) => {
    await page.goto('/?screen=roster');
    await page.locator('[data-testid^="button-inspect-"]').nth(3).click();
    const panel = page.getByTestId('panel-operator-inspector');
    await expect(panel).toBeVisible();
    const name = await page.getByTestId('text-inspector-name').textContent() ?? '';
    const select = page.getByTestId('button-inspector-select');
    if (await select.isEnabled()) {
      await select.click();
      await expect(panel).toHaveCount(0);
      await expect(page.getByTestId('button-confirm-character')).toContainText(name, { ignoreCase: true });
    }
  });

  test('fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?screen=roster');
    await page.locator('[data-testid^="button-inspect-"]').first().click();
    const panel = page.getByTestId('panel-operator-inspector');
    await expect(panel).toBeVisible();
    const canvas = panel.locator('canvas[data-character-portrait]');
    const box = await canvas.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(390);
    await expect(page.getByTestId('button-inspector-close')).toBeInViewport();
    await page.screenshot({ path: '/tmp/claude-0/shots/inspector-phone.png' });
  });
});

test('the zoom viewer is off until it is earned and switched on', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('survivor616.meta.v1')) {
      localStorage.setItem('survivor616.meta.v1', JSON.stringify({ version: 5, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false }));
    }
  });
  await page.goto('/?screen=roster');
  await expect(page.locator('[data-testid^="button-character-"]').first()).toBeVisible();
  await expect(page.locator('[data-testid^="button-inspect-"]')).toHaveCount(0);
});
