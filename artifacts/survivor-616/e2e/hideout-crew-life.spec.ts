import { expect, test } from '@playwright/test';

const meta = (extra: Record<string, unknown> = {}) => JSON.stringify({
  version: 5, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false, starterLokPetOnboardingComplete: true,
  rescuedAllyIds: ['vee', 'deacon', 'mamajo', 'pippa', 'denny'],
  ...extra,
});

test.describe('hideout crew life', () => {
  test('using a prop answers with a bubble beside it instead of a box over the strip', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((m) => { if (!localStorage.getItem('survivor616.meta.v1')) localStorage.setItem('survivor616.meta.v1', m); }, meta({ hideoutEvents: 'off' }));
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/?screen=hub');
    const canvas = page.getByTestId('hideout-preview-canvas');
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    const spoken = page.getByTestId('hideout-spoken');

    // The relay crate stands at 86% of the walking range, which is the middle 60% of the strip.
    await page.mouse.click(box.x + box.width * (0.2 + 0.86 * 0.6), box.y + box.height * 0.72);
    await expect(spoken).toContainText(/Relay Crate/i, { timeout: 8000 });
    // No text box sits over the bottom of the strip where everyone's feet are.
    await expect(page.getByTestId('hideout-pet-event')).toHaveCount(0);

    // The bell on the left end answers too.
    await page.mouse.click(box.x + box.width * (0.2 + 0.1 * 0.6), box.y + box.height * 0.72);
    await expect(spoken).not.toHaveText(/Relay Crate/i, { timeout: 8000 });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('the strip keeps animating with crew in the room and does not throw', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((m) => { if (!localStorage.getItem('survivor616.meta.v1')) localStorage.setItem('survivor616.meta.v1', m); }, meta());
    await page.goto('/?screen=hub');
    const canvas = page.getByTestId('hideout-preview-canvas');
    await expect(canvas).toBeVisible();
    const frame = () => canvas.screenshot();
    const first = await frame();
    await page.waitForTimeout(4000);
    const second = await frame();
    expect(Buffer.compare(first, second), 'the strip changed: people moved or talked').not.toBe(0);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('double-clicking the ground sends the operator dashing there', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((m) => { if (!localStorage.getItem('survivor616.meta.v1')) localStorage.setItem('survivor616.meta.v1', m); }, meta({ hideoutEvents: 'off', rescuedAllyIds: [] }));
    await page.goto('/?screen=hub');
    const canvas = page.getByTestId('hideout-preview-canvas');
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    const before = await canvas.screenshot();
    await page.mouse.dblclick(box.x + box.width * 0.2, box.y + box.height * 0.8);
    await page.waitForTimeout(150);
    const mid = await canvas.screenshot();
    expect(Buffer.compare(before, mid), 'the operator started moving at once').not.toBe(0);
    await page.waitForTimeout(1200);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
