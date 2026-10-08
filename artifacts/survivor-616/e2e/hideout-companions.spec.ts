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
  test('hub controls clear each other at phone and browser widths', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript((m) => { if (!localStorage.getItem('survivor616.meta.v1')) localStorage.setItem('survivor616.meta.v1', m); }, meta({ selectedLokPetIds: ['starter-1'] }));
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/?screen=hub');
      const dock = page.getByTestId('hub-control-dock');
      const walk = page.getByTestId('hideout-preview-canvas');
      await expect(dock).toBeVisible();
      await expect(walk).toBeVisible();
      const dockBox = await dock.boundingBox();
      const walkBox = await walk.boundingBox();
      expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(walkBox!.y);
      const controls = [
        page.getByTestId('button-hub-mission-briefing'),
        page.getByTestId('button-open-run-setup'),
        page.locator('[data-testid="music-now-playing-global"], [data-testid="button-global-random-music"]').first(),
        page.getByTestId('hideout-lokpet-companion'),
      ];
      for (const control of controls) await expect(control).toBeVisible();
      const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
          expect(overlaps, `controls ${i} and ${j} overlap at ${width}px`).toBe(false);
        }
      }
      await page.screenshot({ path: test.info().outputPath(`hub-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (await page.getByTestId('button-global-random-music').count()) await page.getByTestId('button-global-random-music').click();
    await page.getByTestId('music-now-playing-global').click();
    await expect(page.getByTestId('button-global-music-collapse')).toBeVisible();
    const expandedMusic = await page.getByTestId('music-now-playing-global').boundingBox();
    const mission = await page.getByTestId('button-hub-mission-briefing').boundingBox();
    expect(expandedMusic!.y >= mission!.y + mission!.height || expandedMusic!.x >= mission!.x + mission!.width).toBe(true);
    await page.getByTestId('button-toggle-hub-layout').click();
    await expect(page.getByTestId('hub-control-dock')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('button-toggle-hub-layout')).toContainText('New control dock');
  });

  test('Looks & LokPets opens from another menu and equips a game theme', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript((m) => { if (!localStorage.getItem('survivor616.meta.v1')) localStorage.setItem('survivor616.meta.v1', m); }, meta());
    await page.goto('/?screen=settings');
    await expect(page.getByTestId('button-back')).toBeVisible();
    expect((await page.getByTestId('button-back').boundingBox())!.y).toBeLessThan(20);
    await page.getByTestId('button-global-looks-lokpets').click();
    await expect(page.getByTestId('screen-run-setup')).toBeVisible();
    await page.getByTestId('button-run-setup-next').click();
    await expect(page.getByTestId('looks-game-theme')).toBeVisible();
    await page.getByTestId('button-looks-ui-theme-tape-garden').click();
    await expect(page.locator('[data-ui-theme="tape-garden"]').first()).toBeVisible();
    await page.getByTestId('button-run-setup-back').click();
    await expect(page.getByTestId('settings-ui-layout')).toBeVisible();
  });

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
