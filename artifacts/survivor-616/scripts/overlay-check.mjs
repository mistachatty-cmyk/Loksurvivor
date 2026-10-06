/**
 * Browser acceptance check for the Demo Day overlay (there is no automated visual suite, so this is run by hand).
 *   pnpm exec vite build -c vite.overlay.config.ts && node scripts/overlay-check.mjs [dark|light] [dpr]
 * Loads a fixture page, starts the overlay, plays for ~12 s, then asserts the M1 contract: the page is never
 * mutated, the reveal paints something clearly different from the page, clicks and wheel never reach the page,
 * the driven scroll sits on the cell grid, and removing the overlay leaves the page identical.
 * Set CHROMIUM_PATH to override the browser binary (default /opt/pw-browsers/chromium).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const bundle = fs.readFileSync(new URL('../dist/overlay/demoday.js', import.meta.url), 'utf8');
const dark = process.argv[2] !== 'light';
const dpr = Number(process.argv[3] ?? 1);
const CELL = 3;

const para = (i) => `<p>Paragraph ${i}: the quick brown fox jumps over the lazy dog while the river keeps moving past the old market and every ordinary word waits to be knocked loose.</p>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Fixture</title><style>
html{scroll-behavior:smooth}body{margin:0;background:${dark ? '#0b0d10' : '#fff'};color:${dark ? '#e8ecf1' : '#14171c'};font:16px/1.5 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 24px}a{color:#35d0bb}button{font:inherit;padding:8px 14px}
</style></head><body><main><h1>Fixture</h1>
<p><a id="lnk" href="#clicked">A link</a> <button id="btn" onclick="window.__clicked=(window.__clicked||0)+1">Button</button></p>
${Array.from({ length: 40 }, (_, i) => para(i)).join('')}</main></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dpr })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.setContent(html);
const snapshot = () => page.evaluate(() => ({ body: document.body.outerHTML, styles: [...document.querySelectorAll('main *')].map((e) => getComputedStyle(e).cssText.length).join(',') }));
const before = await snapshot();

await page.addScriptTag({ content: bundle });
assert.deepEqual(await page.evaluate(() => window.Survivor616DemoDay.start()), { ok: true });

// Clicks and the wheel must not reach the page while playing.
const spots = await page.evaluate(() => ['lnk', 'btn'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
for (const s of spots) await page.mouse.click(s.x, s.y);
await page.mouse.wheel(0, 600);
await page.waitForTimeout(150);
const early = await page.evaluate(() => ({ hash: location.hash, clicked: window.__clicked ?? 0, scrollY }));
assert.equal(early.hash, '', 'a link was followed through the shield');
assert.equal(early.clicked, 0, 'a button was clicked through the shield');
assert.equal(early.scrollY, 0, 'the wheel scrolled the page');

for (const k of ['d', 's', 'a', 's', 'd', 's']) {
  await page.keyboard.down(k);
  await page.waitForTimeout(2000);
  await page.keyboard.up(k);
}
await page.keyboard.press('Space');
await page.waitForTimeout(600);

const canvas = await page.evaluate(() => {
  const c = document.querySelector('[data-demoday]')?.shadowRoot?.querySelector('canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let opaque = 0, luma = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { opaque += 1; luma += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; }
  return { opaque, luma: opaque ? luma / opaque : 0, sx: scrollX, sy: scrollY };
});
assert.ok(canvas.opaque > 2000, `the reveal painted only ${canvas.opaque} opaque pixels`);
const pageLuma = dark ? 8 : 255;
assert.ok(Math.abs(canvas.luma - pageLuma) > 40, `reveal luma ${canvas.luma.toFixed(0)} is too close to the page (${pageLuma})`);
const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
assert.ok(canvas.sy % CELL === 0 || canvas.sy === maxY, `scrollY ${canvas.sy} is off the ${CELL}px cell grid`);

await page.evaluate(() => window.Survivor616DemoDay.stop(true));
await page.evaluate(() => document.querySelectorAll('[data-demoday]').forEach((h) => h.remove()));
const after = await snapshot();
assert.equal(after.body, before.body, 'the page body changed');
assert.equal(after.styles, before.styles, 'computed styles changed');
assert.deepEqual(errors, []);
console.log(`ok (${dark ? 'dark' : 'light'} page, dpr ${dpr}): ${canvas.opaque} reveal pixels, avg luma ${canvas.luma.toFixed(0)}`);
await browser.close();
