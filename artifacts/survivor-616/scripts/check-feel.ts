/**
 * On-demand feel check for Lok Party. Run by hand (never scheduled, so it costs no usage):
 *   pnpm check:feel
 * One line per check. Catches the things that make a party game feel bad before a phone does:
 * a mode that steps too slowly, behaves differently for the same seed (breaks online play), produces
 * NaN scores, never ends, or a board game that stalls or never reaches its goal.
 */
import { performance } from 'node:perf_hooks';
import { createGemVacuum, gemResults, stepGemVacuum } from '../src/party/gemVacuum';
import { createStrikePose, poseResults, stepStrikePose } from '../src/party/strikePose';
import { createFaceOff, faceResults, stepFaceOff } from '../src/party/faceOff';
import { createRelay, relayResults, stepRelay } from '../src/party/relay';
import { createRoofRumble, rumbleResults, stepRoofRumble } from '../src/party/roofRumble';
import { MONROE_LOOP } from '../src/party/boards/monroeLoop';
import { boardAct, boardAdvance, boardMinigameResult, botAction, createBoardGame, type BoardGoal } from '../src/party/lokBoard';
import type { MinigameResult, MinigameSeat, StageInput } from '../src/party/minigameKit';

// The rules files only (the art files pull in the UI, which node cannot load). Every rules file shares an `over` flag.
interface Rules {
  create: (seed: number, seats: MinigameSeat[]) => { over: boolean };
  step: (s: never, inputs: (StageInput | null)[], dtMs: number) => void;
  results: (s: never) => MinigameResult[];
}
const CARTRIDGES: Record<string, Rules> = {
  gems: { create: createGemVacuum, step: stepGemVacuum, results: gemResults } as unknown as Rules,
  pose: { create: createStrikePose, step: stepStrikePose, results: poseResults } as unknown as Rules,
  face: { create: createFaceOff, step: stepFaceOff, results: faceResults } as unknown as Rules,
  relay: { create: createRelay, step: stepRelay, results: relayResults } as unknown as Rules,
  rumble: { create: (seed, seats) => createRoofRumble(seed, seats, 'sumo'), step: stepRoofRumble, results: rumbleResults } as unknown as Rules,
  collapse: { create: (seed, seats) => createRoofRumble(seed, seats, 'collapse'), step: stepRoofRumble, results: rumbleResults } as unknown as Rules,
  tilt: { create: (seed, seats) => createRoofRumble(seed, seats, 'tilt'), step: stepRoofRumble, results: rumbleResults } as unknown as Rules,
};

const STEP_MS = 1000 / 60;
const MAX_AVG_MS = 1.5; // one fixed step for four bots: a tiny slice of a 16 ms frame
const MAX_P99_MS = 8;
const seats = ['zero-day', 'shade', 'quarry-kid', 'golden-hour'].map((characterId) => ({ characterId, bot: true, botSkill: 0.6 }));
const idle: StageInput = { keys: { x: 0, y: 0 }, aim: null, holding: false, tap: null, action: false };
let failed = 0;
const line = (ok: boolean, name: string, detail: string) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(28)} ${detail}`);
};

for (const [id, cart] of Object.entries(CARTRIDGES)) {
  const run = (seed: number) => {
    const s = cart.create(seed, seats);
    const times: number[] = [];
    let steps = 0;
    while (!s.over && steps < 60 * 90) {
      const t0 = performance.now();
      (cart.step as (s: unknown, i: unknown, d: number) => void)(s, seats.map(() => idle), STEP_MS);
      times.push(performance.now() - t0);
      steps += 1;
    }
    return { s, times, steps };
  };
  const a = run(5);
  const b = run(5);
  const sorted = [...a.times].sort((x, y) => x - y);
  const avg = a.times.reduce((n, v) => n + v, 0) / Math.max(1, a.times.length);
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
  line(avg <= MAX_AVG_MS && p99 <= MAX_P99_MS, `${id} speed`, `avg ${avg.toFixed(3)} ms, p99 ${p99.toFixed(2)} ms over ${a.steps} steps`);
  line(a.steps < 60 * 90 && a.s.over, `${id} ends`, `${(a.steps / 60).toFixed(1)} s of play`);
  line(JSON.stringify(cart.results(a.s as never)) === JSON.stringify(cart.results(b.s as never)), `${id} same seed, same game`, 'deterministic');
  line(JSON.stringify(cart.results(a.s as never)).indexOf('null') < 0, `${id} results are numbers`, `${cart.results(a.s as never).length} results`);
}

const goals: BoardGoal[] = [{ kind: 'rounds' }, { kind: 'crowns', target: 3 }, { kind: 'relics', target: 5 }];
for (const goal of goals) {
  let finished = 0;
  let longest = 0;
  const t0 = performance.now();
  for (let seed = 1; seed <= 40; seed += 1) {
    const s = createBoardGame(seed, MONROE_LOOP, seats, 10, goal);
    let guard = 0;
    while (s.phase !== 'over' && guard++ < 30000) {
      if (s.phase === 'minigame') {
        const order = [0, 1, 2, 3].sort(() => s.rng() - 0.5);
        boardMinigameResult(s, order.map((_, i) => order.indexOf(i) + 1));
      } else if (s.pending) boardAct(s, botAction(s)!);
      else boardAdvance(s);
    }
    if (s.phase === 'over') finished += 1;
    longest = Math.max(longest, s.round);
  }
  line(finished === 40, `board ${goal.kind} finishes`, `${finished}/40 games, longest ${longest} rounds, ${(performance.now() - t0).toFixed(0)} ms`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall feel checks passed');
process.exit(failed ? 1 : 0);
