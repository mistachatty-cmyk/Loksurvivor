/**
 * `node scripts/events-shots.mjs <outDir> [areaId]` saves warning/middle/end frames of every run event at a
 * desktop and a phone size, to look at them by eye. Needs Chrome (set CHROMIUM_PATH if it is not at the default).
 */
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs';

const [outDir = 'event-shots', area = 'monroe-strip'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const events = ['supply-drop', 'rush-hour', 'tremor', 'block-party', 'blackout', 'relay-storm'];
const sizes = { desktop: [1000, 640], phone: [390, 664] };
const server = await createServer({ configFile: new URL('../vite.config.ts', import.meta.url).pathname, server: { port: 5198, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const event of events) {
    for (const [label, [w, h]] of Object.entries(sizes)) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${base}scripts/events-preview.html?event=${event}&w=${w}&h=${h}&area=${area}`, { waitUntil: 'commit' });
      await page.waitForFunction(() => window.__done || window.__error, null, { timeout: 60000 }).catch(() => {});
      const shots = await page.evaluate(() => window.__shots ?? []);
      shots.forEach((url, i) => fs.writeFileSync(`${outDir}/${event}-${label}-${['warning', 'middle', 'end'][i]}.png`, Buffer.from(url.split(',')[1], 'base64')));
      console.log(event, label, shots.length, 'frames', errors.length ? `ERRORS: ${errors[0]}` : '');
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
