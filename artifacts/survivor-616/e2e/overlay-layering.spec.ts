import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const previews = path.resolve(import.meta.dirname, '../../../docs/previews/scenery-ui');
async function seed(page: Page, layout: string, theme = 'midnight-reliquary') {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.addInitScript(({ layout, theme }) => {
    localStorage.setItem('survivor616.ui.chrome-layout.v2', layout);
    localStorage.setItem('survivor616.ui-opacity.v1', JSON.stringify({ all: 75, menus: 70, popups: 85, hud: 80 }));
    localStorage.setItem('survivor616.meta.v1', JSON.stringify({ version: 12, onboarded: true, totalRuns: 3,
      starterLokPetOnboardingComplete: true, hideoutArrivalEnabled: false, hideoutEvents: 'off',
      rescuedAllyIds: ['vee', 'deacon', 'mamajo'], uiTheme: theme, lastSeenChangelogVersion: '0.42.59',
      liveModeEnabled: false, levelUpPresentation: 'pause-focus', levelUpPausesEnabled: true,
      mirrorModeEnabled: true, paletteInvertEnabled: true, worldInvertEnabled: true }));
  }, { layout, theme });
}
async function reachable(page: Page, testId: string) {
  const button = page.getByTestId(testId);
  await expect(button).toBeVisible();
  expect(await button.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}

for (const layout of ['classic', 'new']) {
  test(`${layout}: phone chat and crew launch from dock; dialogs stay above navigation`, async ({ page }) => {
    await seed(page, layout, layout === 'classic' ? 'mirror-carnival' : 'midnight-reliquary');
    await page.goto('/?screen=hub');
    await expect(page.getByTestId('menu-dock')).toBeVisible();
    await expect(page.getByTestId('button-lok-chat')).toHaveCount(0);
    expect(await page.getByTestId('button-global-crew').evaluate(el => !!el.closest('[data-testid="menu-dock"]'))).toBe(true);
    const dock = await page.getByTestId('dock-chat').boundingBox();
    expect(dock!.y).toBeGreaterThan(500);
    await page.screenshot({ path: path.join(previews, `dock-${layout}-phone.png`) });
    await page.getByTestId('dock-chat').click();
    expect(await page.getByTestId('lok-chat').evaluate(el => !!el.closest('#viewport-overlays'))).toBe(true);
    await reachable(page, 'button-lok-chat-close');
    await expect(page.getByTestId('notification-toast-stack')).toHaveCount(0);
    await page.screenshot({ path: path.join(previews, `chat-${layout}-phone.png`) });
    await page.getByTestId('button-lok-chat-close').click();
    await expect(page.getByTestId('lok-chat')).toHaveCount(0);
    await page.getByTestId('dock-search').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el => !!el.closest('#viewport-overlays'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test(`${layout}: run settings stay upright and typing cannot resume or reopen stale panels`, async ({ page }) => {
    await seed(page, layout);
    await page.goto('/?screen=run&area=endless-streets');
    await expect(page.getByTestId('screen-run')).toBeVisible();
    await expect(page.getByTestId('button-pause')).toHaveText('Pause', { timeout: 10000 });
    await page.getByTestId('button-pause').click();
    await expect(page.getByTestId('overlay-paused')).toBeVisible();
    await page.getByTestId('button-pause-settings').click();
    const settings = page.getByTestId('overlay-run-settings');
    await expect(settings).toBeVisible();
    expect(await settings.evaluate(el => !!el.closest('#viewport-overlays'))).toBe(true);
    const search = page.locator('#settings-section-search');
    await search.pressSequentially('pause', { delay: 30 });
    await expect(settings).toBeVisible();
    await expect(search).toHaveValue('pause');
    await search.fill('');
    await page.getByTestId(`button-ui-layout-${layout === 'classic' ? 'new' : 'classic'}`).click();
    await expect(settings).toBeVisible();
    await page.getByTestId(`button-ui-layout-${layout}`).click();
    await expect(settings).toBeVisible();
    await reachable(page, 'button-back');
    await page.screenshot({ path: path.join(previews, `settings-${layout}-phone.png`) });
    await page.getByTestId('button-back').click();
    await expect(page.getByTestId('overlay-paused')).toBeVisible();
    await page.getByTestId('button-resume').click();
    await expect(page.getByTestId('overlay-paused')).toHaveCount(0);
    await expect(settings).toHaveCount(0);
    await page.getByTestId('button-pause').click();
    await expect(page.getByTestId('overlay-paused')).toBeVisible();
    await expect(settings).toHaveCount(0);
    await page.keyboard.down('p');
    await page.keyboard.down('p');
    await page.keyboard.up('p');
    await expect(page.getByTestId('overlay-paused')).toHaveCount(0);
  });
}
