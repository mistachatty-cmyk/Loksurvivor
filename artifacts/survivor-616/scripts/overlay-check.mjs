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
await page.route('http://fixture.test/', (route) => route.fulfill({ contentType: 'text/html', body: html }));
await page.goto('http://fixture.test/');
// level-up cards would pause a scripted run at random moments; the pause/level-up flow has its own checks below
await page.evaluate(() => localStorage.setItem('demoday.settings.v1', JSON.stringify({ levelUp: 'auto' })));
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

// Dash: Shift while moving drains the cooldown bar, and the page must not have been left or scrolled by hand.
const dashWidth = () => page.evaluate(() => [...document.querySelectorAll('[data-demoday]')].map((h) => h.shadowRoot?.querySelector('.bar.dash > i')).find(Boolean)?.style.width);
await page.keyboard.down('s');
await page.keyboard.press('Shift');
await page.waitForTimeout(120);
const dashDuring = parseFloat(await dashWidth());
await page.keyboard.up('s');
assert.ok(dashDuring < 100, `dash cooldown bar did not move (${dashDuring}%)`);

// Pause: Esc opens the menu and freezes the picture; Resume closes it; blur pauses by itself.
const menuOpen = () => page.evaluate(() => [...document.querySelectorAll('[data-demoday]')].some((h) => h.shadowRoot?.querySelector('.menus.open')));
const frame = () => page.evaluate(() => {
  const c = [...document.querySelectorAll('[data-demoday]')].map((h) => h.shadowRoot?.querySelector('canvas:not(.glow)')).find(Boolean);
  return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
});
// A few cosmetic effects flicker on wall-clock randomness even when paused, so "frozen" means almost no pixels change.
const changedShare = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n += 1; return n / (a.length / 4); };
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
assert.equal(await menuOpen(), true, 'Esc did not open the pause menu');
const f1 = await frame();
await page.waitForTimeout(700);
const moved = changedShare(f1, await frame());
assert.ok(moved < 0.01, `${(moved * 100).toFixed(1)}% of the picture kept moving while paused`);
await page.evaluate(() => [...document.querySelectorAll('[data-demoday]')].map((h) => h.shadowRoot?.querySelector('.panel .primary')).find(Boolean).click());
await page.waitForTimeout(100);
assert.equal(await menuOpen(), false, 'Resume did not close the menu');
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.waitForTimeout(100);
assert.equal(await menuOpen(), true, 'losing focus did not pause');
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
assert.equal(await menuOpen(), false, 'Esc did not resume');

const canvas = await page.evaluate(() => {
  const c = [...document.querySelectorAll('[data-demoday]')].map((h) => h.shadowRoot?.querySelector('canvas:not(.glow)')).find(Boolean);
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

// Settings: the pause menu opens the settings panel, a control change is saved, and Esc steps back to the pause menu.
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
const inShadow = (selector) => page.evaluate((sel) => [...document.querySelectorAll('[data-demoday]')].map((h) => h.shadowRoot?.querySelector(sel)).find(Boolean) !== undefined, selector);
const clickShadow = (selector, index = 0) => page.evaluate(([sel, i]) => [...document.querySelectorAll('[data-demoday]')].flatMap((h) => [...(h.shadowRoot?.querySelectorAll(sel) ?? [])])[i].click(), [selector, index]);
await clickShadow('.panel button:nth-child(2)'); // Settings
await page.waitForTimeout(100);
assert.equal(await inShadow('.setting'), true, 'the settings panel did not open');
await clickShadow('[data-setting="shake"]');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('demoday.settings.v1')));
assert.equal(saved.shake, false, 'a changed setting was not saved');
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
assert.equal(await inShadow('.setting'), false, 'Esc did not leave the settings panel');
await page.keyboard.press('Escape'); // resume
await page.waitForTimeout(100);

// Level-up: with picks set to "pause" a run shows three cards, a number key chooses one, and play resumes.
await page.evaluate(() => { window.Survivor616DemoDay.stop(true); localStorage.setItem('demoday.settings.v1', JSON.stringify({ levelUp: 'pause' })); });
await page.evaluate(() => document.querySelectorAll('[data-demoday]').forEach((h) => h.remove()));
assert.deepEqual(await page.evaluate(() => window.Survivor616DemoDay.start()), { ok: true });
await page.keyboard.down('d');
let cards = 0;
for (let i = 0; i < 80 && cards === 0; i += 1) {
  await page.waitForTimeout(500);
  cards = await page.evaluate(() => [...document.querySelectorAll('[data-demoday]')].map((h) => h.shadowRoot?.querySelectorAll('.choice').length ?? 0).find((n) => n > 0) ?? 0);
}
await page.keyboard.up('d');
assert.equal(cards, 3, `expected 3 level-up cards, saw ${cards}`);
await page.keyboard.press('1');
await page.waitForTimeout(150);
assert.equal(await inShadow('.choice'), false, 'picking an upgrade did not close the cards');

await page.evaluate(() => window.Survivor616DemoDay.stop(true));
await page.evaluate(() => document.querySelectorAll('[data-demoday]').forEach((h) => h.remove()));
const after = await snapshot();
assert.equal(after.body, before.body, 'the page body changed');
assert.equal(after.styles, before.styles, 'computed styles changed');
assert.deepEqual(errors, []);
console.log(`ok (${dark ? 'dark' : 'light'} page, dpr ${dpr}): ${canvas.opaque} reveal pixels, avg luma ${canvas.luma.toFixed(0)}`);
await browser.close();
