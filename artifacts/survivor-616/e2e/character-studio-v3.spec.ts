import { expect, test, type Page } from '@playwright/test';

const META_KEY = 'survivor616.meta.v1';
const FORGE_KEY = 'survivor616.forge.v1';
const ALL_EARNED = ['forge', 'inspector', 'factionRaces', 'foil', 'aura', 'slot-circuit', 'slot-crowd', 'slot-roll-call', 'slot-field-notes', 'slot-beast-master'];

async function openStudio(page: Page) {
  await page.addInitScript(([metaKey, forgeKey, earned]) => {
    localStorage.setItem(metaKey!, JSON.stringify({ version: 26, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false }));
    localStorage.setItem(forgeKey!, JSON.stringify({ unlocked: false, operators: [], earned, toggles: { forge: true } }));
  }, [META_KEY, FORGE_KEY, ALL_EARNED] as [string, string, string[]]);
  await page.goto('/?screen=settings');
  await page.getByTestId('tab-settings-endgame').click();
  await page.getByTestId('button-open-forge').click();
  await expect(page.getByTestId('panel-operator-forge')).toBeVisible();
  await page.getByTestId('forge-tab-studio').click();
  await expect(page.getByTestId('studio-v3')).toBeVisible();
}

test('V3 pixel map places palette pixels with XY and adjustable brush size', async ({ page }) => {
  test.setTimeout(90_000);
  await openStudio(page);
  await page.getByRole('button', { name: 'Generate editable project' }).click();
  const canvas = page.locator('canvas[aria-label^="48 by 48 pixel art map"]');
  await expect(canvas).toBeVisible();
  await page.getByLabel('Pixel X').fill('0');
  await page.getByLabel('Pixel Y').fill('0');
  await page.getByLabel('Brush size').fill('4');
  await page.getByRole('button', { name: 'Color 1', exact: true }).click();
  await page.getByRole('button', { name: 'Place at XY' }).click();

  const painted = await canvas.evaluate((element) => {
    const ctx = (element as HTMLCanvasElement).getContext('2d')!;
    return Array.from(ctx.getImageData(15, 15, 1, 1).data);
  });
  expect(painted).toEqual([0, 0, 0, 255]);
  await page.getByLabel('Brush size').fill('8');
  const bounds = await canvas.boundingBox();
  await canvas.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
  const brushPaint = await canvas.evaluate((element) => {
    const ctx = (element as HTMLCanvasElement).getContext('2d')!;
    return Array.from(ctx.getImageData(235, 235, 1, 1).data);
  });
  expect(brushPaint).toEqual([0, 0, 0, 255]);
  const undo = page.getByTestId('studio-v3-editor').getByRole('button', { name: 'Undo' });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(page.getByTestId('studio-v3-editor')).toBeVisible();
  await expect(canvas).toBeVisible();
});

test('copying an animation clip clears other direction reviews and is undoable', async ({ page }) => {
  test.setTimeout(90_000);
  await openStudio(page);
  await page.getByRole('button', { name: 'Generate editable project' }).click();
  const editor = page.getByTestId('studio-v3-editor');
  await editor.getByRole('button', { name: 'Approve this frame' }).click();
  await editor.getByRole('button', { name: '2', exact: true }).click();
  await editor.getByRole('button', { name: 'Approve this frame' }).click();
  for (let index = 0; index < 6; index++) await editor.getByRole('button', { name: 'Next direction' }).click();
  await editor.getByRole('button', { name: 'Approve this frame' }).click();
  await expect(editor.getByText('3/192 frames approved.', { exact: false })).toBeVisible();
  for (let index = 0; index < 6; index++) await editor.getByRole('button', { name: 'Previous direction' }).click();

  await editor.getByRole('button', { name: 'Copy idle to all directions' }).click();
  await expect(editor.getByText('2/192 frames approved.', { exact: false })).toBeVisible();
  await editor.getByRole('button', { name: 'Undo' }).click();
  await expect(editor.getByText('3/192 frames approved.', { exact: false })).toBeVisible();

  await editor.getByRole('button', { name: 'Copy frame to idle' }).click();
  await expect(editor.getByText('2/192 frames approved.', { exact: false })).toBeVisible();
  await editor.getByRole('button', { name: 'Undo' }).click();
  await expect(editor.getByText('3/192 frames approved.', { exact: false })).toBeVisible();
});

test('blank canvas connects a fast mouse stroke across every logical pixel', async ({ page }) => {
  test.setTimeout(90_000);
  await openStudio(page);
  await page.getByRole('button', { name: 'Start with blank canvas' }).click();
  const editor = page.getByTestId('studio-v3-editor');
  const canvas = editor.locator('canvas[aria-label^="48 by 48 pixel art map"]');
  await editor.getByRole('button', { name: 'Color 1', exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const scale = bounds!.width / 48;
  const x = (pixel: number) => bounds!.x + (pixel + 0.5) * scale;
  const y = bounds!.y + (15 + 0.5) * scale;
  await page.mouse.move(x(4), y);
  await page.mouse.down();
  await page.mouse.move(x(20), y, { steps: 2 });
  await page.mouse.up();
  const pixels = await canvas.evaluate((element) => {
    const ctx = (element as HTMLCanvasElement).getContext('2d')!;
    return Array.from({ length: 17 }, (_, index) => Array.from(ctx.getImageData((index + 4) * 10 + 5, 155, 1, 1).data));
  });
  expect(pixels.every((rgba) => rgba.join(',') === '0,0,0,255')).toBe(true);
  await editor.getByRole('button', { name: 'Undo' }).click();
  const reverted = await canvas.evaluate((element) => Array.from((element as HTMLCanvasElement).getContext('2d')!.getImageData(125, 155, 1, 1).data));
  expect(reverted[3]).toBe(0);
});

test('first character guide seeds blank frames and automatically restores the device draft', async ({ page }) => {
  test.setTimeout(90_000);
  await openStudio(page);
  await page.getByRole('button', { name: 'Start with blank canvas' }).click();
  const editor = page.getByTestId('studio-v3-editor');
  const guide = editor.getByRole('region', { name: 'First character guide' });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Seed empty frames from first pose' })).toBeDisabled();
  await editor.getByLabel('Creation name').fill('My first 616 character');
  await editor.getByRole('button', { name: 'Color 1', exact: true }).click();
  await editor.getByLabel('Pixel X').fill('7');
  await editor.getByLabel('Pixel Y').fill('9');
  await editor.getByRole('button', { name: 'Place at XY' }).click();
  await guide.getByRole('button', { name: 'Seed empty frames from first pose' }).click();
  await expect(guide.getByText('Every frame has art.', { exact: false })).toBeVisible();
  await expect(editor.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await openStudio(page);
  await expect(page.getByText('Continue your last character')).toBeVisible();
  await page.getByRole('button', { name: 'Continue editing' }).click();
  await expect(editor.getByLabel('Creation name')).toHaveValue('My first 616 character');
  await editor.getByRole('button', { name: 'Approve this frame' }).click();
  await guide.getByRole('button', { name: 'Next unreviewed frame' }).click();
  await expect(editor.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await guide.getByRole('button', { name: 'Hide guide' }).click();
  await expect(guide).toBeHidden();
  await editor.getByRole('button', { name: 'Show first character guide' }).click();
  await expect(guide).toBeVisible();
});

test('switching away immediately keeps the latest unsaved edit on this device', async ({ page }) => {
  test.setTimeout(90_000);
  await openStudio(page);
  await page.getByRole('button', { name: 'Generate editable project' }).click();
  await page.getByTestId('studio-v3-editor').getByLabel('Creation name').fill('Quick switch draft');
  await page.getByTestId('forge-tab-operators').click();
  await page.getByTestId('forge-tab-studio').click();
  await expect(page.getByText('Continue your last character')).toBeVisible();
  await page.getByRole('button', { name: 'Continue editing' }).click();
  await expect(page.getByTestId('studio-v3-editor').getByLabel('Creation name')).toHaveValue('Quick switch draft');
});
