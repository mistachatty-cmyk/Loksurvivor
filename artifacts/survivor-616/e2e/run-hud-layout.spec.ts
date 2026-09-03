import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('survivor616.meta.v1', JSON.stringify({
      version: 12,
      onboarded: true,
      selectedCharacterId: 'shade',
      unlockedCharacterIds: ['shade', 'queenbee'],
      minimapVisible: false,
      liveModeEnabled: true,
      lootPresentation: 'queue',
      levelUpPresentation: 'compact-live',
      levelUpPausesEnabled: false,
      devModeAccessUnlocked: true,
      devModeAllUnlocks: true,
    }));
  });
});
test('Dev Mode stress preview exposes every reserved zone without mutating the run', async ({ page }) => {
  await page.goto('/?screen=run&area=back-alley');
  await page.getByTestId('button-run-intel').click();
  await page.getByTestId('button-dev-tool-run-hud-stress').click();

  await expect(page.getByTestId('overlay-hud-stress')).toBeVisible();
  await expect(page.getByTestId('panel-loot-tray')).toBeVisible();
  await expect(page.getByTestId('run-hud-primary-signal')).toContainText('HUD stress preview');

  for (const zone of ['top-bar', 'primary-signal', 'intel-drawer', 'bottom-left', 'bottom-center', 'bottom-right']) {
    const marker = page.getByTestId(`hud-stress-zone-${zone}`);
    await expect(marker).toBeVisible();
    const box = await marker.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }
});

test('phone HUD keeps the permanent top layer under 64 pixels', async ({ page }) => {
  await page.goto('/?screen=run&area=back-alley');
  await expect(page.getByTestId('screen-run')).toBeVisible();
  const safeZone = page.getByTestId('run-hud-safe-zone');
  await expect(safeZone).toBeVisible();
  await expect(page.getByTestId('run-intel-drawer')).toHaveCount(0);

  const essentialBar = await safeZone.locator(':scope > div').first().boundingBox();
  expect(essentialBar).not.toBeNull();
  expect(essentialBar!.height).toBeLessThanOrEqual(32);

  const signal = page.getByTestId('run-hud-primary-signal');
  if (await signal.count()) {
    const signalBox = await signal.boundingBox();
    expect(signalBox!.height).toBeLessThanOrEqual(24);
    expect(signalBox!.y + signalBox!.height).toBeLessThanOrEqual(64);
  }

  await page.getByTestId('button-run-intel').click();
  const drawer = page.getByTestId('run-intel-drawer');
  await expect(drawer).toBeVisible();
  const drawerBox = await drawer.boundingBox();
  expect(drawerBox!.height).toBeLessThanOrEqual(430);
  await page.screenshot({ path: 'test-results/run-hud-phone.png' });
});
