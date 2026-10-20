import { expect, test } from '@playwright/test';

// Dev server only: the crash hooks are not shipped in production builds.
test.describe('LokErrorReport', () => {
  test('a render crash shows the LokServer pop-up with the exact location', async ({ page }) => {
    await page.goto('/?screen=hub');
    await page.waitForFunction(() => '__lokCrash' in window);
    await page.evaluate(() => (window as unknown as { __lokCrash: { render(): void } }).__lokCrash.render());
    await expect(page.getByTestId('lok-crash-popup')).toBeVisible();
    await expect(page.getByTestId('lok-crash-location')).toContainText('LokCrashProbe.tsx');
    await expect(page.getByTestId('lok-crash-code')).toBeVisible();
  });

  test('a global rejection shows the small chip', async ({ page }) => {
    await page.goto('/?screen=hub');
    await page.waitForFunction(() => '__lokCrash' in window);
    await page.evaluate(() => (window as unknown as { __lokCrash: { rejection(): void } }).__lokCrash.rejection());
    await expect(page.getByTestId('lok-crash-chip')).toBeVisible();
    await page.getByTestId('lok-crash-chip').click();
    await expect(page.getByTestId('lok-crash-popup')).toBeVisible();
  });

  test('with the player setting off nothing is captured', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('survivor616.lokError.enabled', '0'));
    await page.goto('/?screen=hub');
    await page.waitForFunction(() => '__lokCrash' in window);
    await page.evaluate(() => (window as unknown as { __lokCrash: { rejection(): void } }).__lokCrash.rejection());
    await page.waitForTimeout(300);
    await expect(page.getByTestId('lok-crash-chip')).toHaveCount(0);
    await expect(page.getByTestId('lok-crash-popup')).toHaveCount(0);
  });
});
