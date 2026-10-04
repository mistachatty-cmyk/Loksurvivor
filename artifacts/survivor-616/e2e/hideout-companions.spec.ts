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

const meta = (extra: Record<string, unknown> = {}) => JSON.stringify({
  version: 5, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false, starterLokPetOnboardingComplete: true,
  savedLokPets: [{ id: 'starter-1', roll, stamina: 3, level: 3, exp: 0, starter: true, name: 'Biscuit' }],
  ...extra,
});

test.describe('hideout companions', () => {
  test('a pet event shows a one-line corner prompt and saves its cooldown', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((m) => { if (!localStorage.getItem('survivor616.meta.v1')) localStorage.setItem('survivor616.meta.v1', m); }, meta());
    await page.goto('/?screen=hub&fastPetEvents=1');

    const prompt = page.getByTestId('hideout-pet-event');
    await expect(prompt).toBeVisible({ timeout: 8000 });
    await expect(prompt).toContainText('Biscuit');
    // It is a quiet status note, not a dialog.
    await expect(prompt).toHaveAttribute('role', 'status');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await expect.poll(async () => page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('survivor616.meta.v1') ?? '{}');
      return Object.keys(saved.savedLokPets?.[0]?.hideoutEvents ?? {}).length;
    })).toBeGreaterThan(0);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('tapping the ground calls the pet and tapping the pet pets it for bond', async ({ page }) => {
    await page.addInitScript((m) => { if (!localStorage.getItem('survivor616.meta.v1')) localStorage.setItem('survivor616.meta.v1', m); }, meta({ hideoutEvents: 'off' }));
    await page.goto('/?screen=hub');
    const canvas = page.getByTestId('hideout-preview-canvas');
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height * 0.72;

    // Ground tap: the pet trots toward the tap (it settles a little to one side of it).
    await page.mouse.click(x, y);
    await page.waitForTimeout(2600);
    // Then tap the pet itself, a bit to the right of where we called it.
    for (const dx of [0, 30, 40, -30]) {
      await page.mouse.click(x + dx, y);
      await page.waitForTimeout(150);
    }
    await expect.poll(async () => page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('survivor616.meta.v1') ?? '{}');
      return saved.savedLokPets?.[0]?.careDay ?? null;
    }), { timeout: 8000 }).not.toBeNull();
  });

  test('settings can send pets home or turn events off', async ({ page }) => {
    await page.addInitScript((m) => { if (!localStorage.getItem('survivor616.meta.v1')) localStorage.setItem('survivor616.meta.v1', m); }, meta());
    await page.goto('/?screen=settings');
    await expect(page.getByTestId('settings-hideout-pets')).toBeVisible();
    await page.getByTestId('button-hideout-events-off').click();
    await page.getByTestId('button-hideout-pets-companion').click();
    await expect(page.getByTestId('button-hideout-events-off')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('survivor616.meta.v1') ?? '{}');
      return `${saved.hideoutPets}/${saved.hideoutEvents}`;
    })).toBe('companion/off');
  });
});
