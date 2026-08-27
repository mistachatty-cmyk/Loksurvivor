import { expect, test } from '@playwright/test';

const initialMeta = {
  version: 8,
  onboarded: true,
  levelUpPausesEnabled: true,
  minimapVisible: true,
  minimapExpanded: true,
  minimapPosition: { x: 0.82, y: 0.18 },
};

test.describe('hideout custom map builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((meta) => {
      if (localStorage.getItem('survivor616.meta.v1')) return;
      localStorage.setItem('survivor616.meta.v1', JSON.stringify(meta));
    }, initialMeta);
  });

  test('opens from the main-floor computer and persists a route draft', async ({ page }) => {
    await page.goto('/?screen=hub');
    await page.getByTestId('button-hideout-computer').click();
    await page.getByTestId('button-create-custom-map').last().click();
    await expect(page.getByTestId('custom-map-canvas')).toBeVisible();

    await page.getByTestId('input-custom-map-name').fill('Midnight grid');
    await page.getByTestId('button-place-enemy:nightcrawler').click();
    await page.getByTestId('button-save-custom-map').click();
    await page.reload();
    await page.getByTestId('button-hideout-computer').click();

    await expect(page.getByTestId('input-custom-map-name')).toHaveValue('Midnight grid');
    await expect(page.getByTestId('custom-map-placement')).toHaveCount(1);
  });

  test('does not expose the computer from another hideout room', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'survivor616.meta.v1',
        JSON.stringify({
          ...JSON.parse(localStorage.getItem('survivor616.meta.v1') ?? '{}'),
          discoveryIds: ['alley-hatch'],
        }),
      );
    });
    await page.goto('/?screen=hub');
    await page.getByTestId('button-room-rooftop-perch').click();
    await expect(page.getByTestId('button-hideout-computer')).toHaveCount(0);
  });

  test('shows a saved route in area selection and blocks empty-route launch', async ({ page }) => {
    await page.addInitScript((meta) => {
      localStorage.setItem(
        'survivor616.meta.v1',
        JSON.stringify({
          ...meta,
          customMaps: [{
            id: 'custom-empty-route',
            name: 'Empty route',
            bounds: { w: 480, h: 360 },
            groundAssetId: 'ground:monroe-strip',
            landmarkAssetId: null,
            placements: [],
            durationSec: 120,
            threat: 'rising',
            backdrop: 'art/street.jpeg',
            updatedAt: Date.now(),
          }],
        }),
      );
    }, initialMeta);
    await page.goto('/?screen=areas');

    const card = page.getByTestId('button-custom-map-custom-empty-route');
    await expect(card).toBeVisible();
    await expect(card).toContainText('needs enemy');
    await expect(card).toBeDisabled();
  });

  test('launches a valid custom route through the normal run screen', async ({ page }) => {
    await page.addInitScript((meta) => {
      localStorage.setItem(
        'survivor616.meta.v1',
        JSON.stringify({
          ...meta,
          customMaps: [{
            id: 'custom-playable-route',
            name: 'Playable route',
            bounds: { w: 480, h: 360 },
            groundAssetId: 'ground:monroe-strip',
            landmarkAssetId: null,
            placements: [{
              id: 'first-threat',
              assetId: 'enemy:nightcrawler',
              category: 'enemy',
              x: 0,
              y: 0,
              w: 40,
              h: 40,
            }],
            durationSec: 120,
            threat: 'rising',
            backdrop: 'art/street.jpeg',
            updatedAt: Date.now(),
          }],
        }),
      );
    }, initialMeta);
    await page.goto('/?screen=areas');
    await page.getByTestId('button-custom-map-custom-playable-route').click();
    await expect(page.getByTestId('screen-run')).toBeVisible();
  });
});


test.describe('mobile hideout regression', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'survivor616.meta.v1',
        JSON.stringify({
          ...JSON.parse(localStorage.getItem('survivor616.meta.v1') ?? '{}'),
          version: 8,
          onboarded: true,
          discoveryIds: ['alley-hatch', 'lantern-shard'],
        }),
      );
    });
  });

  test('loads, switches rooms, and keeps computer access on the main floor', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });

    await page.goto('/?screen=hub');
    await expect(page.getByTestId('hideout-scene')).toBeVisible();
    await expect(page.getByTestId('button-hideout-computer')).toBeVisible();

    await page.getByTestId('button-room-rooftop-perch').click();
    await expect(page.getByTestId('hideout-scene')).toContainText('River fog');
    await expect(page.getByTestId('button-hideout-computer')).toHaveCount(0);

    await page.getByTestId('button-room-the-cellar').click();
    await expect(page.getByTestId('hideout-scene')).toContainText('Glass heat');
    await expect(page.getByTestId('button-hideout-computer')).toHaveCount(0);

    await page.getByTestId('button-room-main-floor').click();
    await expect(page.getByTestId('button-hideout-computer')).toBeVisible();
    await page.getByTestId('button-hideout-computer').click();
    await expect(page.getByText('616 / map builder')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });
});