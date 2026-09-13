import { expect, test } from '@playwright/test';

const savedLokPets = [
  {
    id: 'packed-pet',
    roll: {
      name: 'Pip · Moss Pouncer',
      variantId: 'moss-pouncer',
      family: 'animal',
      silhouette: 'pouncer',
      palette: { body: '#54734c', bodyDark: '#26392c', accent: '#b8ff5c', glow: '#7dffb2', eye: '#fff1a8' },
      rarity: 'common',
      rarityLabel: 'Common',
      attackKind: 'shot',
      element: 'none',
      elementLabel: 'kinetic',
      description: 'A spring-loaded alley creature with leaf-bright eyes.',
      stats: { health: 34, moveSpeed: 112, damage: 7, cooldownMs: 1100, range: 220, projectileSpeed: 250, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 90000 },
      traitLabel: 'single shot',
    },
    stamina: 1,
  },
];

function foreignCardExport(namespace: string) {
  return JSON.stringify({
    format: 'lok.card-exchange',
    formatVersion: 1,
    manifest: {
      schema: 'lok.asset',
      schemaVersion: 1,
      id: `${namespace}:coin-cat`,
      namespace,
      slug: 'coin-cat',
      kind: 'card',
      version: 1,
      name: 'Coin Cat',
      description: 'Sleeps beside anything round and shiny.',
      rarity: 'uncommon',
      tags: ['coin', 'cat'],
      acquisition: ['lok'],
      ownership: { transferPolicy: 'giftable', uniqueInstance: true, stackable: false, requiresServerAuthorityForTransfer: true, survivesRunReset: true },
      provenance: { sourceGame: namespace, createdAt: Date.now() },
      metadata: { species: 'cat' },
    },
    owned: {
      instanceId: `${namespace}:coin-cat#test-instance`,
      assetId: `${namespace}:coin-cat`,
      assetVersion: 1,
      acquiredAt: Date.now(),
      acquisitionMethod: 'lok',
      ownerId: null,
      sourceGame: namespace,
      quantity: 1,
      provenance: { sourceGame: namespace, createdAt: Date.now() },
      transferCount: 0,
    },
    printVariant: 'standard',
  });
}

test.describe('LOK Universe Exchange', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((pets) => {
      localStorage.setItem('survivor616.meta.v1', JSON.stringify({ version: 1, onboarded: true, savedLokPets: pets }));
    }, savedLokPets);
    await page.goto('/?screen=archive');
    await page.getByTestId('button-archive-tab-universe').click();
    await expect(page.getByTestId('section-universe-exchange')).toBeVisible();
  });

  test('exports a kennel companion as a portable card', async ({ page }) => {
    await page.locator('select').selectOption('packed-pet');
    await page.getByRole('button', { name: 'Generate export' }).click();
    const output = page.locator('textarea[readonly]');
    await expect(output).toBeVisible();
    await expect(output).toHaveValue(/"format": "lok\.card-exchange"/);
    await expect(output).toHaveValue(/"g6\.616-survivor:packed-pet"/);
    await expect(output).not.toHaveValue(/"health": 34/);
  });

  test('imports a foreign card as a visiting card, never into the kennel', async ({ page }) => {
    await page.getByPlaceholder('Paste a LOK card export here…').fill(foreignCardExport('g6.spend-it-all'));
    await page.getByRole('button', { name: 'Import card' }).click();
    await expect(page.getByText('Coin Cat arrived from g6.spend-it-all.')).toBeVisible();
    await expect(page.getByText('from g6.spend-it-all · uncommon')).toBeVisible();
  });

  test('rejects a card whose namespace is this game\'s own', async ({ page }) => {
    await page.getByPlaceholder('Paste a LOK card export here…').fill(foreignCardExport('g6.616-survivor'));
    await page.getByRole('button', { name: 'Import card' }).click();
    await expect(page.getByText(/already belongs to 616 Survivor/)).toBeVisible();
  });
});
