/**
 * Real-browser render benchmark: `node scripts/bench-render.mjs [mode] [frames] [dpr]`
 * (mode: normal | unleashed | million). Runs the engine plus renderWorld in
 * headless Chromium and reports per-frame sim, draw (JS) and raster-flush ms.
 * Headless Chromium rasterises in software, so treat flush time as relative.
 */
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const [mode = 'unleashed', frames = '600', dpr = '1'] = process.argv.slice(2);
const server = await createServer({ configFile: new URL('../vite.config.ts', import.meta.url).pathname, server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.goto(`${base}scripts/bench-render.html?mode=${mode}&frames=${frames}&dpr=${dpr}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__result, null, { timeout: 280000 });
  console.log(JSON.stringify(await page.evaluate(() => window.__result)));
  if (process.env.SHOT) await page.locator('#c').screenshot({ path: process.env.SHOT });
} finally {
  await browser.close();
  await server.close();
}
