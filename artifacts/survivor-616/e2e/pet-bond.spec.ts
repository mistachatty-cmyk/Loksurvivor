import { expect, test } from '@playwright/test';

const roll = {
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
};

const savedLokPets = [
  { id: 'starter-1', roll, stamina: 3, level: 6, exp: 10, starter: true, bond: 60 },
  { id: 'stranger-1', roll: { ...roll, name: 'Moss Two' }, stamina: 3, level: 2, exp: 0 },
];

test.describe('pet bond and names', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((pets) => {
      if (!localStorage.getItem('survivor616.meta.v1')) {
        localStorage.setItem('survivor616.meta.v1', JSON.stringify({ version: 5, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false, starterLokPetOnboardingComplete: true, savedLokPets: pets }));
      }
    }, savedLokPets);
  });

  test('earned name slots open by bond and the starter call name is free', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?screen=run-setup');

    // The starter (Friend, 60 bond): call and battle names are open, epithet and true name are locked.
    await page.getByTestId('button-rename-pet-starter-1').click();
    const panel = page.getByTestId('pet-names-panel-starter-1');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('pet-bond-starter-1').first()).toContainText('Friend');
    const callName = page.getByTestId('input-rename-pet-starter-1');
    await callName.fill('Biscuit');
    await callName.press('Enter');
    await expect(page.getByTestId('run-setup-pet-name-starter-1')).toHaveText('Biscuit');
    await expect(page.getByTestId('input-pet-name-battle-starter-1')).toBeVisible();
    await expect(page.getByTestId('input-pet-name-epithet-starter-1')).toHaveCount(0);
    await expect(page.getByTestId('pet-name-slot-trueName-starter-1')).toContainText('Soulbound');

    // Clicking in the panel does not change which pet is selected; a Stranger has no open slots.
    await page.getByTestId('button-rename-pet-stranger-1').click();
    await expect(page.getByTestId('input-rename-pet-stranger-1')).toHaveCount(0);
    await expect(page.getByTestId('pet-name-slot-call-stranger-1')).toContainText('Familiar');

    // The name survives a reload.
    await page.reload();
    await expect(page.getByTestId('run-setup-pet-name-starter-1')).toHaveText('Biscuit');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('shows the Growth Recap on the run summary', async ({ page }) => {
    await page.goto('/?screen=summary&fixture=lokpet-archive');
    const recap = page.getByTestId('section-growth-recap');
    await expect(recap).toBeVisible();
    await expect(page.getByTestId('growth-recap-fixture-starter')).toContainText('Lv 4 → 5');
    await expect(page.getByTestId('growth-recap-fixture-starter')).toContainText('+1,240 XP');
  });

  test('filters achievements by category', async ({ page }) => {
    await page.goto('/?screen=archive');
    await page.getByRole('button', { name: /Achievements/ }).first().click();
    const all = await page.locator('[data-testid^="card-achievement-"]').count();
    await page.getByTestId('button-achievement-filter-lokpet').click();
    const filtered = await page.locator('[data-testid^="card-achievement-"]').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(all);
    await expect(page.getByTestId('card-achievement-soulbound')).toBeVisible();
  });
});
