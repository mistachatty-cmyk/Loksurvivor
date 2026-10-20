import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('survivor616.meta.v1', JSON.stringify({ onboarded: true })));
});

test('builds a drum beat, exports audible WAV, and restores a portable backup', async ({ page }) => {
  await page.goto('/?screen=studio', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('text-studio-persistence')).toContainText('saved on this device', { timeout: 60_000 });
  await page.getByTestId('input-studio-name').fill('Browser Beat');
  const sequencer = page.getByTestId('studio-drum-sequencer');
  await expect(sequencer).toBeVisible();
  await sequencer.getByRole('button', { name: 'Kick step 1', exact: true }).click();
  await sequencer.getByRole('button', { name: 'Closed Hat step 5', exact: true }).click();
  await page.getByRole('button', { name: 'Undo edit' }).click();
  await expect(sequencer.getByRole('button', { name: 'Closed Hat step 5', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Redo edit' }).click();
  await expect(sequencer.getByRole('button', { name: 'Closed Hat step 5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await sequencer.getByRole('button', { name: 'Add to song' }).click();
  await expect(page.getByTestId('canvas-arrange')).toBeVisible();

  const wavDownload = page.waitForEvent('download');
  await page.getByTestId('button-studio-export-wav').click();
  const wav = await wavDownload;
  const wavBytes = await readFile(await wav.path());
  expect(wavBytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(wavBytes.length).toBeGreaterThan(44);
  expect(wavBytes.subarray(44).some((byte) => byte !== 0)).toBe(true);

  const backupDownload = page.waitForEvent('download');
  await page.getByTestId('button-studio-export-project').click();
  const backup = await backupDownload;
  expect(backup.suggestedFilename()).toMatch(/\.616project$/);
  await page.getByTestId('input-studio-project').setInputFiles({ name: backup.suggestedFilename(), mimeType: 'application/zip', buffer: await readFile(await backup.path()) });
  await expect(page.getByTestId('input-studio-name')).toHaveValue('Browser Beat');
  await expect(page.getByTestId('text-studio-persistence')).toContainText('saved on this device');

  await page.getByTestId('button-studio-to-soundtrack').click();
  await expect.poll(async () => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('survivor616-soundtrack', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('tracks', 'readonly');
    const rows = await new Promise<Array<{ authoredBpm?: number; downbeatSeconds?: number }>>((resolve, reject) => {
      const request = transaction.objectStore('tracks').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return rows.some((row) => row.authoredBpm === 120 && row.downbeatSeconds === 0);
  }), { timeout: 20_000 }).toBe(true);

  await page.goto('/?screen=run&area=endless-streets', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('screen-run')).toBeVisible();
  await page.waitForTimeout(1800);
  await page.getByTestId('button-pause').click();
  await page.getByTestId('button-pause-soundtrack').click();
  await expect(page.getByTestId('overlay-pause-soundtrack')).toBeVisible();
  const gameTrack = page.getByRole('button', { name: /browser beat/i }).first();
  await expect(gameTrack).toBeVisible({ timeout: 15_000 });
  await gameTrack.click();
  await expect.poll(async () => Number(await page.getByTestId('input-seek').inputValue()), { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(page.getByTestId('text-music-error')).toHaveCount(0);
});

test('mobile can place and export a beat', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?screen=studio', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('studio-drum-sequencer')).toBeVisible();
  await page.getByRole('button', { name: 'Kick step 1', exact: true }).click();
  await page.getByRole('button', { name: 'Add to song' }).click();
  const backupDownload = page.waitForEvent('download');
  await page.getByTestId('button-studio-export-project').click();
  expect((await backupDownload).suggestedFilename()).toMatch(/\.616project$/);
});
