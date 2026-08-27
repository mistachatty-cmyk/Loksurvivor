import { expect, test } from '@playwright/test';

test.describe('crew rumor presentation', () => {
  test('shows the active hideout rumor and its source ally', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'survivor616.meta.v1',
        JSON.stringify({
          version: 5,
          onboarded: true,
          rescuedAllyIds: ['vee'],
          crewActivityByAlly: { vee: 'fortify-doors' },
          crewActivitySeed: 4,
          activeCrewRumor: { rumorId: 'bell-shock', allyId: 'vee', generatedAtSeed: 4 },
        }),
      );
    });
    await page.goto('/?screen=hub');

    await expect(page.getByTestId('section-crew-rumor')).toBeVisible();
    await expect(page.getByTestId('section-crew-rumor')).toContainText('Bell Shock');
    await expect(page.getByTestId('section-crew-rumor')).toContainText('Brought by Vee');
    await expect(page.getByTestId('section-crew-rumor')).toContainText('Active next run');
  });

  test('shows the spent rumor outcome in the run summary', async ({ page }) => {
    await page.goto('/?screen=summary&fixture=lokpet-archive');

    await expect(page.getByTestId('section-crew-rumor-result')).toBeVisible();
    await expect(page.getByTestId('section-crew-rumor-result')).toContainText('Bell Shock');
    await expect(page.getByTestId('section-crew-rumor-result')).toContainText('triggered');
    await expect(page.getByTestId('section-crew-rumor-result')).toContainText('first contact');
  });
});