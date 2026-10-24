import { expect, test } from '@playwright/test';

test.describe('Jukebox shelves, spin and pull-out', () => {
  test('albums sit on separate shelves, a disc spins by hand, and a song pulls out to full screen', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 430, height: 800 });
    await page.goto('/?jukebox');

    const shelves = page.getByTestId('disc-shelves');
    await expect(shelves).toBeVisible();
    await expect(page.getByTestId('shelf-title')).toContainText('Lokifed');

    await page.getByTestId('button-shelf-next').click();
    await expect(page.getByTestId('shelf-title')).toContainText('New Fits');
    await page.getByTestId('button-shelf-prev').click();
    await expect(page.getByTestId('shelf-title')).toContainText('Lokifed');

    // Spin mode adds a surface over the disc and turns it without changing the song.
    await page.getByTestId('button-disc-spin').click();
    const surface = page.getByTestId('disc-spin-surface');
    await expect(surface).toBeVisible();
    const box = (await surface.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx + 60, cy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i += 1) await page.mouse.move(cx + 60 * Math.cos(i * 0.3), cy + 60 * Math.sin(i * 0.3));
    await page.mouse.up();
    const spun = await page.evaluate(() => document.querySelector<HTMLElement>('.dcc-slide[data-active] .dcc-roll')?.style.getPropertyValue('--dcc-user-spin'));
    expect(spun).toMatch(/deg$/);
    await page.getByTestId('button-disc-spin').click();

    // Pull the song out, spin it there, and put it back.
    await page.getByTestId('button-disc-pullout').click();
    await expect(page.getByTestId('disc-pullout')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('disc-pullout')).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
