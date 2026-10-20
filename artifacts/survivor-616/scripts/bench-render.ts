import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { createWorld, stepWorld } from '@/game/engine/world';
import { renderWorld } from '@/game/render/draw';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') ?? 'unleashed';
const frames = Number(params.get('frames') ?? 600);
const dpr = Number(params.get('dpr') ?? 1);
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = 1280 * dpr;
canvas.height = 720 * dpr;
const ctx = canvas.getContext('2d', { alpha: false })!;
const wave = { fromSec: 0, toSec: 99999, enemyId: 'nightcrawler', ratePerSec: 40, burst: 2 };
const area = { ...AREAS[0]!, durationSec: 99999, waves: [wave], musicEvents: undefined, rescueAllyId: undefined };
const c = CHARACTERS[0]!;
const modifiers = mode === 'million' ? { millionHordeMode: true, unleashedMode: true } : mode === 'unleashed' ? { unleashedMode: true } : {};
const w = createWorld(area, c, c.stats, 7, [], 1, true, null, { graphicsQuality: 'high', runtimePerformanceTier: 'desktop', modifiers });
w.player.invulnUntil = Infinity;
w.player.hp = w.player.maxHp = 1e9;

const simTimes: number[] = [];
const drawTimes: number[] = [];
const flushTimes: number[] = [];
for (let i = 0; i < frames; i += 1) {
  const t = i / 60;
  let t0 = performance.now();
  stepWorld(w, 1 / 60, { moveX: Math.cos(t * 0.7), moveY: Math.sin(t * 0.5), ultimate: false });
  simTimes.push(performance.now() - t0);
  t0 = performance.now();
  renderWorld(ctx, w, { width: 1280, height: 720, dpr });
  const t1 = performance.now();
  ctx.getImageData(0, 0, 1, 1); // force the raster queue to drain
  drawTimes.push(t1 - t0);
  flushTimes.push(performance.now() - t1);
}
const stat = (a: number[]) => {
  const s = a.slice(Math.floor(a.length * 0.2)).sort((x, y) => x - y);
  const q = (p: number) => +s[Math.min(s.length - 1, Math.floor(s.length * p))]!.toFixed(2);
  return { avg: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2), p50: q(0.5), p99: q(0.99), max: +s[s.length - 1]!.toFixed(2) };
};
(window as unknown as { __result: unknown }).__result = {
  mode, actors: w.enemies.length, sim: stat(simTimes), drawJs: stat(drawTimes), rasterFlush: stat(flushTimes),
};
