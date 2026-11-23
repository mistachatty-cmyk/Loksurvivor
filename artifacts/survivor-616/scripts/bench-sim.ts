/**
 * Headless simulation benchmark: `pnpm exec tsx scripts/bench-sim.ts [seconds] [mode]`.
 * Reports per-step stepWorld cost (avg / p99 / max) so engine changes can be
 * judged by numbers. Modes: normal | unleashed | million.
 */
import { performance } from 'node:perf_hooks';
import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { createWorld, stepWorld } from '@/game/engine/world';
import type { WaveDef } from '@/game/types';

const seconds = Number(process.argv[2] ?? 60);
const mode = process.argv[3] ?? 'million';
// Optional: `[areaId]` picks the map (default: the first), and `--max-avg <ms>` / `--max-p99 <ms>` make the
// script exit 1 when a limit is exceeded, so CI can fail on a slowdown.
const argv = process.argv.slice(4);
const flag = (name: string): number | undefined => {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : Number(argv[at + 1]);
};
const areaArg = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const baseArea = areaArg ? AREAS.find((a) => a.id === areaArg) : AREAS[0];
if (!baseArea) throw new Error(`Unknown area "${areaArg}"`);
const wave: WaveDef = { fromSec: 0, toSec: 99999, enemyId: 'nightcrawler', ratePerSec: 40, burst: 2 };
const area = { ...baseArea, durationSec: 99999, waves: [wave], musicEvents: undefined, rescueAllyId: undefined };
const character = CHARACTERS[0]!;
const modifiers =
  mode === 'million' ? { millionHordeMode: true, unleashedMode: true }
  : mode === 'unleashed' ? { unleashedMode: true }
  : {};
const world = createWorld(area, character, character.stats, 7, [], 1, true, null, {
  graphicsQuality: 'high',
  runtimePerformanceTier: 'desktop',
  modifiers,
});
world.player.invulnUntil = Number.POSITIVE_INFINITY;
world.player.hp = world.player.maxHp = 1e9;

const STEP = 1 / 60;
const times: number[] = [];
const total = Math.round(seconds / STEP);
for (let i = 0; i < total; i += 1) {
  const t = i * STEP;
  const t0 = performance.now();
  stepWorld(world, STEP, { moveX: Math.cos(t * 0.7), moveY: Math.sin(t * 0.5), ultimate: false });
  times.push(performance.now() - t0);
}
times.sort((a, b) => a - b);
const avg = times.reduce((s, v) => s + v, 0) / times.length;
const q = (p: number) => times[Math.min(times.length - 1, Math.floor(times.length * p))]!.toFixed(3);
const horde = world.millionHorde;
const result = {
  mode, areaId: baseArea.id, simSeconds: seconds, actors: world.enemies.length, kills: world.kills,
  population: world.hordeField ? world.hordeField.count + world.enemies.length : undefined,
  projectiles: world.projectiles.length, particles: world.particles.length,
  avgMs: +avg.toFixed(3), p50: q(0.5), p99: q(0.99), p999: q(0.999), maxMs: times[times.length - 1]!.toFixed(3),
};
console.log(JSON.stringify(result));
const maxAvg = flag('--max-avg');
const maxP99 = flag('--max-p99');
if ((maxAvg !== undefined && avg > maxAvg) || (maxP99 !== undefined && Number(q(0.99)) > maxP99)) {
  console.error(`bench-sim: over budget (avg ${avg.toFixed(3)} ms, p99 ${q(0.99)} ms; limits avg ${maxAvg ?? '-'}, p99 ${maxP99 ?? '-'})`);
  process.exit(1);
}
