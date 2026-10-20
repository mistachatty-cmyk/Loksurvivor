// Playback smoke test for the bundled soundtrack (see docs/soundtrack-song-audit-2026-10-20.md).
// Plays every song on a phone-sized viewport with autoplay blocked, jumps to 10/30/60/70/90%,
// and reports page errors, crash-panel text, pauses, media errors, JS heap and long tasks.
//
// Open-source Chromium cannot decode AAC, so make WAV copies of the songs first:
//   mkdir wav && for f in artifacts/survivor-616/public/music/lokifed-take-1/*.m4a; do
//     ffmpeg -v error -y -i "$f" -ac 1 -ar 44100 -c:a pcm_s16le "wav/$(basename "${f%.m4a}").wav"; done
// Then, with the dev server running, from artifacts/survivor-616/:
//   WAV_DIR=../../wav APP_URL=http://localhost:5173/ node ../../docs/audit-tools/song-playtest.mjs
// Optional: MAXSONGS=1 for a quick pass; PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH for a custom browser.
// Playback smoke test: plays every bundled song on a phone-sized viewport, jumps
// through ~30/60/70% of each, lets it end, and records page errors, crash-screen
// text, long main-thread tasks and JS heap. Songs are served as WAV copies
// (open-source Chromium cannot decode AAC); the repo is untouched.
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/package.json')('@playwright/test');
import fs from 'node:fs';
import path from 'node:path';

const WAV = (process.env.WAV_DIR || './wav').replace(/\/?$/, '/');
const URL = process.env.APP_URL || 'http://localhost:5173/';
const log = [];
const note = (s) => { log.push(s); console.log(s); };

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ['--autoplay-policy=document-user-activation-required', '--no-sandbox', '--enable-precise-memory-info'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

await page.addInitScript(() => {
  const A = window.Audio;
  window.__ev = []; const T0 = Date.now();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) { window.AudioContext = function (...a) { const c = new AC(...a); window.__ctx = c; window.__ctxLog = [['created', c.state, c.sampleRate]]; c.addEventListener('statechange', () => window.__ctxLog.push([Date.now() - T0, c.state])); return c; }; window.AudioContext.prototype = AC.prototype; }
  const MS = AudioContext && MediaElementAudioSourceNode; 
  window.Audio = function (...a) {
    const e = new A(...a); window.__aud = e;
    for (const k of ['play','playing','pause','ended','error','stalled','waiting','seeking','seeked','emptied','abort','loadstart','canplay']) {
      e.addEventListener(k, () => window.__ev.push([Date.now() - T0, k, +e.currentTime.toFixed(1), e.error ? e.error.code + ':' + e.error.message : '']));
    }
    return e;
  };
  window.__errs = [];
  window.addEventListener('error', (e) => window.__errs.push('error: ' + e.message));
  window.addEventListener('unhandledrejection', (e) => window.__errs.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
  window.__long = 0; window.__longMs = 0;
  try {
    new PerformanceObserver((l) => { for (const x of l.getEntries()) { window.__long++; window.__longMs += x.duration; } }).observe({ entryTypes: ['longtask'] });
  } catch {}
  try { localStorage.setItem('survivor616.meta.v1', JSON.stringify({ version: 1, soundtrackObjectiveCompletions: 99 })); } catch {}
});
page.on('pageerror', (e) => note('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') note('console.error ' + m.text().slice(0, 200)); });
page.on('crash', () => note('PAGE CRASHED (renderer process died)'));

await page.route('**/music/lokifed-take-1/*.m4a', async (route) => {
  const name = route.request().url().split('/').pop().replace('.m4a', '.wav');
  const buf = fs.readFileSync(path.join(WAV, name));
  const range = route.request().headers()['range'];
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = Number(m[1]); const end = m[2] ? Number(m[2]) : buf.length - 1;
    await route.fulfill({ status: 206, body: buf.subarray(start, end + 1), headers: { 'content-type': 'audio/wav', 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${buf.length}` } });
  } else {
    await route.fulfill({ status: 200, body: buf, headers: { 'content-type': 'audio/wav', 'accept-ranges': 'bytes' } });
  }
});

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.mouse.click(195, 420); // first gesture -> title track autostart
await page.waitForFunction(() => window.__aud && window.__aud.currentTime > 0.3, null, { timeout: 15000 }).catch(() => note('WARN: first track never started'));
note('started: ' + await page.evaluate(() => window.__aud && decodeURIComponent(window.__aud.src.split('/').pop())));

const state = () => page.evaluate(() => ({
  src: window.__aud ? decodeURIComponent(window.__aud.src.split('/').pop()) : null,
  t: window.__aud ? +window.__aud.currentTime.toFixed(1) : 0,
  d: window.__aud ? +(window.__aud.duration || 0).toFixed(1) : 0,
  paused: window.__aud ? window.__aud.paused : null,
  ctx: window.__ctx ? window.__ctx.state + '@' + window.__ctx.sampleRate : 'none', ctxLog: JSON.stringify(window.__ctxLog || []),
  energy: (() => { const el = document.querySelector('.music-reactive-root'); return el ? el.style.getPropertyValue('--music-energy') : 'noroot'; })(),
  ready: window.__aud ? window.__aud.readyState : null, net: window.__aud ? window.__aud.networkState : null,
  merr: window.__aud && window.__aud.error ? window.__aud.error.code + ':' + window.__aud.error.message : null,
  ev: window.__ev.slice(-8),
  rate: window.__aud ? window.__aud.playbackRate : null,
  heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
  long: window.__long, longMs: Math.round(window.__longMs),
  errs: window.__errs.slice(),
  crashScreen: /something went wrong/i.test(document.body.innerText),
  onIntro: !!document.querySelector('[data-testid="button-start"], [data-testid="intro-screen"]'),
}));

const seen = new Set();
for (const wait of [0, 3000, 3000, 3000]) {
  await page.waitForTimeout(wait);
  const r = await state();
  note(`natural: ctx=${r.ctx} log=${r.ctxLog} t=${r.t}s energy=${r.energy} paused=${r.paused} ready=${r.ready} merr=${r.merr} ev=${JSON.stringify(r.ev.slice(-4))}`);
}
for (let guard = 0; guard < 40 && seen.size < (Number(process.env.MAXSONGS) || 12); guard += 1) {
  let s = await state();
  if (!s.src) break;
  if (seen.has(s.src)) { await page.waitForTimeout(500); continue; }
  seen.add(s.src);
  note(`--- ${s.src} (${s.d}s) heap=${s.heapMB}MB long=${s.long}/${s.longMs}ms`);
  for (const frac of [0.1, 0.3, 0.6, 0.7, 0.9]) {
    await page.evaluate(async (f) => { const a = window.__aud; a.currentTime = a.duration * f; if (a.paused) { window.__resumed = (window.__resumed || 0) + 1; try { await a.play(); } catch (e) { window.__errs.push('play(): ' + e.message); } } }, frac);
    await page.waitForTimeout(4500);
    const r = await state();
    const bad = r.crashScreen || r.errs.length || r.paused || r.src !== s.src;
    note(`  @${Math.round(frac * 100)}% t=${r.t}s paused=${r.paused} rate=${r.rate} heap=${r.heapMB}MB long=${r.long}/${r.longMs}ms energy=${r.energy} crashScreen=${r.crashScreen}${r.errs.length ? ' ERRS=' + JSON.stringify(r.errs) : ''}${bad ? '   <-- CHECK ready=' + r.ready + ' net=' + r.net + ' merr=' + r.merr + ' ev=' + JSON.stringify(r.ev) : ''}`);
    if (r.src !== s.src) break;
  }
  // let it finish and auto-advance
  await page.evaluate(() => { const a = window.__aud; a.currentTime = Math.max(0, a.duration - 2); });
  await page.waitForFunction((cur) => !window.__aud || decodeURIComponent(window.__aud.src.split('/').pop()) !== cur, s.src, { timeout: 15000 }).catch(async () => { const r = await state(); note(`  WARN: did not auto-advance after end: t=${r.t}/${r.d} paused=${r.paused} src=${r.src} merr=${r.merr} ev=${JSON.stringify(r.ev)}`); });
  await page.waitForTimeout(800);
}
const fin = await state();
note(`FINAL: seen=${seen.size}/12 crashScreen=${fin.crashScreen} errs=${JSON.stringify(fin.errs)} heap=${fin.heapMB}MB long=${fin.long}/${fin.longMs}ms`);
await browser.close();
