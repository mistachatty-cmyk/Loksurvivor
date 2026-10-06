import { expect, test, type Page } from '@playwright/test';

const META_KEY = 'survivor616.meta.v1';
const FORGE_KEY = 'survivor616.forge.v1';

const ALL_EARNED = ['forge', 'inspector', 'factionRaces', 'foil', 'aura', 'slot-circuit', 'slot-crowd', 'slot-roll-call', 'slot-field-notes', 'slot-beast-master'];

/** Seeds an end-game save: everything earned and switched on (the real earning path is covered in endgame.spec.ts). */
async function seed(page: Page, earned = true) {
  if (earned) {
    await page.addInitScript(([forgeKey, ids]) => {
      if (!localStorage.getItem(forgeKey!)) {
        localStorage.setItem(forgeKey!, JSON.stringify({
          unlocked: false, operators: [], earned: ids,
          toggles: { forge: true, inspector: true, factionRaces: true, foil: true, aura: true },
        }));
      }
    }, [FORGE_KEY, ALL_EARNED] as [string, string[]]);
  }
  await page.addInitScript(([metaKey]) => {
    // Only seed once so a reload keeps whatever the test saved.
    if (!localStorage.getItem(metaKey!)) {
      localStorage.setItem(
        metaKey!,
        JSON.stringify({ version: 5, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false }),
      );
    }
  }, [META_KEY]);
}

async function openEndgame(page: Page) {
  await page.goto('/?screen=settings');
  await page.getByTestId('tab-settings-endgame').click();
  await expect(page.getByTestId('endgame-section')).toBeVisible();
}

test.describe('operator forge', () => {
  test('Dev Mode exposes the Forge and five temporary slots without map clears', async ({ page }) => {
    await page.addInitScript((key) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify({
          version: 22, onboarded: true, totalRuns: 3, hideoutArrivalEnabled: false,
          devModeAccessUnlocked: true, devModeAllUnlocks: true, clearedAreaIds: [],
        }));
      }
    }, META_KEY);
    await page.goto('/?screen=settings');
    await page.getByTestId('tab-settings-endgame').click();
    await expect(page.getByTestId('switch-endgame-forge')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('slot-endgame-slot-beast-master')).toContainText('earned');
    await page.getByTestId('button-open-forge').click();
    await expect(page.getByTestId('panel-operator-forge')).toBeVisible();
    await expect(page.getByText('Custom slots (0/5 used, 5 total)')).toBeVisible();
    await expect(page.locator('[data-testid^="slot-locked-"]')).toHaveCount(0);
  });

  test('is behind the end game until earned, then designs, saves and plays a new operator', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Blocked outside resources (fonts, CDNs) in a sandboxed browser are noise; real script errors are not.
    const network = /net::ERR_|without an exception object/;
    page.on('console', (msg) => { if (msg.type() === 'error' && !network.test(msg.text())) errors.push(msg.text()); });

    // Nothing about the end game is on screen before it is earned.
    await seed(page, false);
    await page.goto('/?screen=settings');
    await expect(page.getByTestId('settings-tabs')).toHaveCount(0);
    await expect(page.getByTestId('endgame-section')).toHaveCount(0);
    await expect(page.getByTestId('button-open-forge')).toHaveCount(0);
    await page.evaluate(([forgeKey, ids]) => {
      localStorage.setItem(forgeKey!, JSON.stringify({ unlocked: false, operators: [], earned: ids, toggles: { forge: true } }));
    }, [FORGE_KEY, ALL_EARNED] as [string, string[]]);

    await openEndgame(page);
    await page.reload();
    await page.getByTestId('tab-settings-endgame').click();

    await page.getByTestId('button-open-forge').click();
    await expect(page.getByTestId('panel-operator-forge')).toBeVisible();

    // Design by hand.
    await page.getByTestId('button-forge-build-tall').click();
    await page.getByTestId('select-forge-hair').selectOption('afro');
    await page.getByTestId('select-forge-headwear').selectOption('crown');
    await page.getByTestId('select-forge-top').selectOption('hoodie');
    await page.getByTestId('button-forge-skin-moss').click();
    await page.getByTestId('select-forge-scheme').selectOption('neon');
    await page.getByTestId('input-forge-name').fill('Test Forged');
    await page.getByTestId('input-forge-handle').fill('Anvil616');
    await page.getByTestId('button-forge-save').click();
    await expect(page.getByTestId('text-forge-message')).toContainText('Test Forged saved');

    const forged = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FORGE_KEY) as {
      operators: Array<{ id: string; name: string; design: { body: { build: string }; look: { hair: string; headwear: string } } }>;
    };
    expect(forged.operators).toHaveLength(1);
    const [op] = forged.operators;
    expect(op!.name).toBe('Test Forged');
    expect(op!.design.body.build).toBe('tall');
    expect(op!.design.look.hair).toBe('afro');
    expect(op!.design.look.headwear).toBe('crown');
    await expect(page.getByTestId(`item-forge-${op!.id}`)).toBeVisible();

    // Make it the selected operator and reload so the roster picks it up.
    await page.evaluate(([metaKey, id]) => {
      const meta = JSON.parse(localStorage.getItem(metaKey!)!);
      meta.selectedCharacterId = id;
      localStorage.setItem(metaKey!, JSON.stringify(meta));
    }, [META_KEY, op!.id]);
    await page.reload();

    await page.goto('/?screen=roster');
    await expect(page.getByTestId(`button-character-${op!.id}`)).toBeVisible();
    // The authored roster is still all there.
    await expect(page.locator('[data-testid^="button-character-"]').first()).toBeVisible();
    expect(await page.locator('[data-testid^="button-character-"]').count()).toBeGreaterThan(20);

    // And it can be taken into a run.
    await page.goto('/?screen=run&area=back-alley');
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.waitForTimeout(2500);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('generation, rolling and share codes work', async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await seed(page);
    await openEndgame(page);
    await page.getByTestId('button-open-forge').click();

    // The same seed always gives the same operator.
    await page.getByTestId('input-forge-seed').fill('grand-rapids-616');
    await page.getByTestId('button-forge-from-seed').click();
    const first = await page.getByTestId('input-forge-name').inputValue();
    const firstHair = await page.getByTestId('select-forge-hair').inputValue();
    await page.getByTestId('button-forge-surprise').click();
    await page.getByTestId('input-forge-seed').fill('grand-rapids-616');
    await page.getByTestId('button-forge-from-seed').click();
    expect(await page.getByTestId('input-forge-name').inputValue()).toBe(first);
    expect(await page.getByTestId('select-forge-hair').inputValue()).toBe(firstHair);

    // A species filter is respected.
    await page.getByTestId('select-forge-species').selectOption('dragonkin');
    await page.getByTestId('button-forge-surprise').click();
    await expect(page.getByTestId('text-forge-species')).toContainText('Dragonkin');

    // Rolling one category changes only that category.
    const before = await page.getByTestId('select-forge-top').inputValue();
    for (let i = 0; i < 6; i += 1) {
      await page.getByTestId('button-forge-roll-hair').click();
    }
    expect(await page.getByTestId('select-forge-top').inputValue()).toBe(before);

    // Batch forge, then export and re-import a share code.
    await page.getByTestId('button-forge-batch').click();
    await expect(page.getByTestId('list-forge-saved').locator('li')).toHaveCount(5);
    await expect(page.getByTestId('button-forge-batch')).toContainText('No free slots');
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FORGE_KEY) as {
      operators: Array<{ id: string }>;
    };
    expect(stored.operators).toHaveLength(5);

    await page.getByTestId('input-forge-code').fill('not a code');
    await page.getByTestId('button-forge-import').click();
    await expect(page.getByTestId('text-forge-message')).toContainText('does not look like');
  });
});
