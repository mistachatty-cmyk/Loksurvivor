import { expect, test } from '@playwright/test';

// Regression guard: switching songs quickly used to cancel the previous song's start, and the player
// reported that cancellation as "Could not play ..." while the new song was actually playing.
test('switching songs quickly does not show a false playback error', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('survivor616.meta.v1', JSON.stringify({ version: 8, onboarded: true, hideoutArrivalEnabled: false }));
  });
  // A slow connection keeps each song "loading" long enough for the next click to cancel it.
  await page.route('**/music/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  await page.goto('/?screen=music');
  // The bundled songs are AAC (.m4a); the open-source Chromium that CI downloads cannot decode AAC.
  const canPlayAac = await page.evaluate(() => new Audio().canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '');
  test.skip(!canPlayAac, 'this browser cannot decode AAC');
  const tracks = page.locator('[data-testid^="button-track-forgettable-"]');
  await expect(tracks.first()).toBeVisible();
  const count = Math.min(await tracks.count(), 4);
  expect(count).toBeGreaterThan(1);
  for (let round = 0; round < 3; round += 1) {
    for (let i = 0; i < count; i += 1) {
      await tracks.nth(i).click({ delay: 0, noWaitAfter: true });
      await page.waitForTimeout(40);
    }
  }
  await page.waitForTimeout(1500);
  // Locked songs legitimately say "Finish N objectives"; only a playback failure message is a bug here.
  const messages = await page.getByTestId('text-music-error').allTextContents();
  expect(messages.filter((text) => /could not play|would not play|could not be decoded/i.test(text))).toEqual([]);
});
