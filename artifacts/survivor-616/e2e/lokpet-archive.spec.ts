import { expect, test } from '@playwright/test';

const catalogEntries = [
  {
    variantId: 'moss-pouncer',
    rarities: ['common'],
    traits: [{ attackKind: 'shot', element: 'none', label: 'single shot' }],
    sightings: 1,
  },
  {
    variantId: 'cinder-pouncer',
    rarities: ['common'],
    traits: [{ attackKind: 'shot', element: 'none', label: 'single shot' }],
    sightings: 3,
  },
  {
    variantId: 'chalk-grin',
    rarities: ['common'],
    traits: [{ attackKind: 'pulse', element: 'freeze', label: 'pulsating field · freeze' }],
    sightings: 5,
  },
];

test.describe('LokPet archive progression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((catalog) => {
      localStorage.setItem(
        'survivor616.meta.v1',
        JSON.stringify({ onboarded: true, lokPetCatalog: catalog }),
      );
    }, catalogEntries);
    await page.goto('/?screen=summary&fixture=lokpet-archive');
  });

  test('renders new, expanded, and repeat progress without duplicate cards', async ({ page }) => {
    await expect(page.getByTestId('section-lokpet-discoveries')).toBeVisible();
    await expect(page.getByTestId('lokpet-progress-moss-pouncer')).toContainText('New variant');
    await expect(page.getByTestId('lokpet-progress-cinder-pouncer')).toContainText('New catalog data');
    await expect(page.getByTestId('lokpet-progress-cinder-pouncer')).toContainText('New rarity: rare');
    await expect(page.getByTestId('lokpet-progress-cinder-pouncer')).toContainText(
      'New trait: rapid fire · fire',
    );
    await expect(page.getByTestId('lokpet-progress-chalk-grin')).toContainText('Repeat sighting');
    await expect(page.getByTestId('lokpet-progress-chalk-grin')).toContainText(
      'Progress logged, no duplicate discovery',
    );
    await expect(page.getByTestId('lokpet-progress-chalk-grin')).toHaveCount(1);

    await page.getByTestId('button-open-lokpet-chalk-grin').click();
    await expect(page.getByTestId('section-lokpet-catalog')).toBeVisible();
    await expect(page.getByTestId('card-lokpet-chalk-grin')).toHaveCount(1);
    await expect(page.getByTestId('card-lokpet-chalk-grin')).toHaveClass(/ring-2/);
  });

  test('opens each progress action on its exact catalog variant', async ({ page }) => {
    await page.getByTestId('button-open-lokpet-archive').click();
    await expect(page.getByTestId('card-lokpet-moss-pouncer')).toHaveClass(/ring-2/);
    await page.getByTestId('button-back').click();

    for (const variantId of ['moss-pouncer', 'cinder-pouncer', 'chalk-grin']) {
      await page.goto('/?screen=summary&fixture=lokpet-archive');
      await page.getByTestId(`button-open-lokpet-${variantId}`).click();
      await expect(page.getByTestId(`card-lokpet-${variantId}`)).toHaveClass(/ring-2/);
      await page.getByTestId('button-back').click();
    }
  });
});