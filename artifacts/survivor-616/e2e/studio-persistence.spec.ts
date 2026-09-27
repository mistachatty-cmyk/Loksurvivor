import { expect, test } from '@playwright/test';

const STUDIO_STORAGE_KEY = 'survivor616.studio.v1';

function silentWav(durationSeconds = 0.25, sampleRate = 44_100): Buffer {
  const frames = Math.round(durationSeconds * sampleRate);
  const dataBytes = frames * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('survivor616.meta.v1', JSON.stringify({ onboarded: true }));
  });
});

test('migrates the legacy project document into IndexedDB', async ({ page }) => {
  await page.addInitScript((storageKey) => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        name: 'Legacy basement beat',
        bpm: 132,
        beatsPerBar: 4,
        tracks: [
          {
            id: 'legacy-track',
            name: 'Drums',
            gain: 0.8,
            pan: 0,
            muted: false,
            soloed: false,
            clips: [],
            effects: [],
            notes: [],
          },
        ],
      }),
    );
  }, STUDIO_STORAGE_KEY);

  await page.goto('/?screen=studio');
  await expect(page.getByTestId('input-studio-name')).toHaveValue('Legacy basement beat');
  await expect(page.getByTestId('text-studio-persistence')).toContainText('saved on this device');

  await page.evaluate((storageKey) => localStorage.removeItem(storageKey), STUDIO_STORAGE_KEY);
  await page.reload();
  await expect(page.getByTestId('input-studio-name')).toHaveValue('Legacy basement beat');
  await expect(page.getByTestId('text-studio-persistence')).toContainText('saved on this device');
});

test('restores an imported owned source and its arrangement after reload', async ({ page }) => {
  await page.goto('/?screen=studio');
  await expect(page.getByTestId('text-studio-persistence')).toContainText('saved on this device');

  await page.getByTestId('input-studio-audio').setInputFiles({
    name: 'restore-me.wav',
    mimeType: 'audio/wav',
    buffer: silentWav(),
  });
  await expect(page.getByTestId('list-studio-clips')).toContainText('restore me');
  await page.getByLabel('Add restore me to first track').click();
  await page.waitForTimeout(450);
  await expect(page.getByTestId('text-studio-persistence')).toContainText('saved on this device');

  const stores = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('survivor616-soundtrack', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const names = [...database.objectStoreNames];
    database.close();
    return names;
  });
  expect(stores).toEqual(expect.arrayContaining(['tracks', 'media-assets', 'studio-projects']));

  await page.reload();
  await expect(page.getByTestId('list-studio-clips')).toContainText('restore me');
  await expect(page.getByTestId('text-studio-persistence')).toContainText('1 sources restored');
});
