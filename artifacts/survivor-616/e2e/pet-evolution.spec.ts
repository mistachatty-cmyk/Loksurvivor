import { expect, test } from '@playwright/test';

const llamaRoll = {
  name: 'Lil Llamà',
  variantId: 'lil-llama',
  family: 'animal',
  silhouette: 'pouncer',
  palette: { body: '#f4ead8', bodyDark: '#493d49', accent: '#ff7ab8', glow: '#67e8f9', eye: '#1f2937' },
  rarity: 'mythic',
  rarityLabel: 'Mythic',
  attackKind: 'shot',
  element: 'none',
  elementLabel: 'kinetic',
  description: 'A tiny, fearless llama.',
  stats: { health: 96, moveSpeed: 158, damage: 23, cooldownMs: 560, range: 325, projectileSpeed: 390, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 108000 },
  traitLabel: 'single shot',
  sizeScale: 0.78,
  legendary: true,
  specialAbility: 'cutify-getaway',
};

// A starter at its second stage (level 33) with Friend bond but no battle wins:
// the Heart path is ready, the Street path is not.
const savedLokPets = [{ id: 'starter-1', roll: llamaRoll, stamina: 3, level: 33, exp: 0, starter: true, bond: 60, battlesWon: 0, battlesFought: 0 }];

test.describe('pet evolution', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((pets) => {
      if (!localStorage.getItem('survivor616.meta.v1')) {
        localStorage.setItem('survivor616.meta.v1', JSON.stringify({ version: 5, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false, starterLokPetOnboardingComplete: true, savedLokPets: pets }));
      }
    }, savedLokPets);
  });

  test('nudges in Run Setup when a path is ready', async ({ page }) => {
    await page.goto('/?screen=run-setup');
    await expect(page.getByTestId('run-setup-path-ready-starter-1')).toContainText('Evolution path ready');
  });

  test('picks a path, shows the cinematic, persists, and undoes for free', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?screen=lokpet-battle');
    await page.getByRole('button', { name: /Companion Kennel/ }).click();

    await expect(page.getByTestId('evolution-ready-dot-starter-1')).toBeVisible();
    await page.getByTestId('button-evolution-toggle-starter-1').click();
    await expect(page.getByTestId('button-evolve-llama-heart')).toBeEnabled();
    await expect(page.getByTestId('button-evolve-llama-street')).toBeDisabled();
    await expect(page.getByTestId('evolution-branch-llama-street')).toContainText('Win 3 battles');

    await page.getByTestId('button-evolve-llama-heart').click();
    const cinematic = page.getByTestId('evolution-cinematic');
    await expect(cinematic).toBeVisible();
    await expect(page.getByTestId('evolution-cinematic-title')).toHaveText('Charm Llama');
    await page.getByTestId('button-evolution-close').click();
    await expect(cinematic).toHaveCount(0);

    // The panel now shows the chosen path and the free undo.
    await expect(page.getByTestId('evolution-branch-llama-heart')).toContainText('Chosen');
    await expect(page.getByTestId('button-evolve-llama-street')).toHaveCount(0);
    await expect(page.getByTestId('button-evolution-undo-starter-1')).toContainText('free for');
    await expect(page.getByTestId('evolution-ready-dot-starter-1')).toHaveCount(0);

    // It is saved.
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('survivor616.meta.v1') ?? '{}').savedLokPets[0].evolutionPath);
    expect(saved.branchId).toBe('llama-heart');

    await page.getByTestId('button-evolution-undo-starter-1').click();
    await expect(page.getByTestId('evolution-notice-starter-1')).toContainText('natural form');
    await expect(page.getByTestId('button-evolve-llama-heart')).toBeEnabled();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('survivor616.meta.v1') ?? '{}').savedLokPets[0].evolutionPath);
    expect(after ?? null).toBeNull();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('plays the charge-up and flash before the reveal with full motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?screen=lokpet-battle');
    await page.getByRole('button', { name: /Companion Kennel/ }).click();
    await page.getByTestId('button-evolution-toggle-starter-1').click();
    await page.getByTestId('button-evolve-llama-heart').click();
    const cinematic = page.getByTestId('evolution-cinematic');
    await expect(cinematic).toBeVisible();
    await expect(cinematic).toHaveAttribute('data-phase', 'reveal', { timeout: 5000 });
    await expect(page.getByTestId('evolution-cinematic-title')).toHaveText('Charm Llama');
    await page.keyboard.press('Escape');
    await expect(cinematic).toHaveCount(0);
  });
});
