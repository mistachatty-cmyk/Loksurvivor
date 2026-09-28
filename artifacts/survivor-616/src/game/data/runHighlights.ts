/**
 * Bounded run-highlight capture -- the video-free first half of the "Run
 * recap" phase in docs/studio-remotion-architecture.md.
 *
 * This deliberately does not hook into combat/level-up internals inside
 * `engine/world.ts`. Instead it observes plain, already-public `World`
 * fields once per rendered frame from the outside (see `RunScreen`'s call
 * to `observe`) and diffs them against the previous frame. That keeps it
 * strictly additive: dropping this file changes nothing about the
 * simulation, and it can't desync from balance/combat changes because it
 * never duplicates their logic, only reads their results.
 *
 * Output is a small, capped list -- never a frame-by-frame recording --
 * matching the `highlights` shape sketched in `RunPresentationRecord` in
 * the architecture doc, so a future Remotion recap can consume this
 * unchanged. Surfaced directly in `RunSummary` as a plain timeline, and (once
 * `RunScreen` assigns `clipAssetId`s via `game/media/clipRecorder.ts`) as the
 * real gameplay clips cycled through in the `@lok/recap` highlight reel.
 */
import { ENEMIES_BY_ID } from './enemies';

export type RunHighlightKind =
  | 'level-up'
  | 'boss-defeated'
  | 'close-call'
  | 'ultimate'
  | 'ally-rescued'
  | 'kill-streak'
  | 'music-surge'
  | 'run-cleared'
  | 'run-ended';

export interface RunHighlight {
  kind: RunHighlightKind;
  /** Milliseconds since the run started (`World.now`). */
  atMs: number;
  label: string;
  detail?: string;
  /**
   * Local media-store id (see `game/audio/localMediaStore.ts`) for a captured
   * gameplay clip around this moment. Set by `RunScreen` after the run ends,
   * from `game/media/clipRecorder.ts` -- absent when clip capture wasn't
   * supported on this device or didn't cover this moment. This module stays
   * unaware of the recorder itself; it only carries the id once assigned.
   */
  clipAssetId?: string;
}

/** Minimal read surface this needs from `World` -- kept narrow on purpose so this file never needs `engine/world`'s full type surface. */
export interface RunHighlightObservable {
  now: number;
  level: number;
  outcome: 'running' | 'cleared' | 'dead';
  killsByEnemy: Record<string, number>;
  ultActiveUntil: number;
  rescue: { status: 'pending' | 'available' | 'freeing' | 'freed'; allyId?: string };
  player: { hp: number; maxHp: number };
  /**
   * Narrowed from `World.audio` (`AudioFrame`, see `audio/beatBus.ts`) --
   * only the two fields this needs, so this file still never imports the
   * beat-bus module itself. `source: 'none'` (nothing playing, or analysis
   * hasn't locked on yet) never produces a highlight regardless of `energy`.
   */
  audio: { energy: number; source: 'none' | 'detected' | 'studio' };
}

const MAX_HIGHLIGHTS = 6;
const CLOSE_CALL_HP_RATIO = 0.12;
const CLOSE_CALL_COOLDOWN_MS = 9000;
const KILL_STREAK_WINDOW_MS = 3000;
const KILL_STREAK_THRESHOLD = 8;
const KILL_STREAK_COOLDOWN_MS = 12000;
const MUSIC_SURGE_ENERGY_THRESHOLD = 0.85;
const MUSIC_SURGE_COOLDOWN_MS = 15000;

interface RecorderState {
  highlights: RunHighlight[];
  lastLevel: number;
  lastKillsByEnemy: Record<string, number>;
  lastTotalKills: number;
  /** Rolling window of recent per-frame kill counts, for the kill-streak highlight. */
  recentKills: { atMs: number; count: number }[];
  lastKillStreakAt: number;
  lastAudioEnergy: number;
  lastMusicSurgeAt: number;
  lastRescueStatus: string | undefined;
  lastUltActiveUntil: number;
  lastCloseCallAt: number;
  finished: boolean;
}

function pushBounded(state: RecorderState, highlight: RunHighlight) {
  state.highlights.push(highlight);
  // Cap by dropping the least distinctive kind so far (repeats of the same
  // kind first) rather than always trimming the oldest -- a run with five
  // level-ups and one boss kill should keep the boss kill.
  if (state.highlights.length <= MAX_HIGHLIGHTS) return;
  const counts = new Map<RunHighlightKind, number>();
  for (const h of state.highlights) counts.set(h.kind, (counts.get(h.kind) ?? 0) + 1);
  let dropIndex = 0;
  let dropCount = -1;
  state.highlights.forEach((h, i) => {
    const count = counts.get(h.kind) ?? 0;
    if (count > dropCount) {
      dropCount = count;
      dropIndex = i;
    }
  });
  state.highlights.splice(dropIndex, 1);
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Create a fresh recorder for one run. Call `observe(world)` once per
 * rendered frame (not per fixed substep -- this only needs to notice state
 * transitions, not simulate anything) and read `getHighlights()` when the
 * run ends.
 */
export function createRunHighlightRecorder() {
  const state: RecorderState = {
    highlights: [],
    lastLevel: 1,
    lastKillsByEnemy: {},
    lastTotalKills: 0,
    recentKills: [],
    lastKillStreakAt: -Infinity,
    lastAudioEnergy: 0,
    lastMusicSurgeAt: -Infinity,
    lastRescueStatus: undefined,
    lastUltActiveUntil: 0,
    lastCloseCallAt: -Infinity,
    finished: false,
  };

  function observe(world: RunHighlightObservable) {
    if (state.finished) return;

    if (world.level > state.lastLevel) {
      pushBounded(state, {
        kind: 'level-up',
        atMs: world.now,
        label: `Reached level ${world.level}`,
      });
      state.lastLevel = world.level;
    }

    for (const [defId, count] of Object.entries(world.killsByEnemy)) {
      const prior = state.lastKillsByEnemy[defId] ?? 0;
      if (count > prior && ENEMIES_BY_ID[defId]?.family === 'Boss') {
        pushBounded(state, {
          kind: 'boss-defeated',
          atMs: world.now,
          label: `Took down ${ENEMIES_BY_ID[defId]?.name ?? 'a boss'}`,
        });
      }
    }
    state.lastKillsByEnemy = { ...world.killsByEnemy };

    const totalKills = Object.values(world.killsByEnemy).reduce((sum, n) => sum + n, 0);
    if (totalKills > state.lastTotalKills) {
      state.recentKills.push({ atMs: world.now, count: totalKills - state.lastTotalKills });
      state.lastTotalKills = totalKills;
    }
    state.recentKills = state.recentKills.filter((k) => world.now - k.atMs <= KILL_STREAK_WINDOW_MS);
    const killsInWindow = state.recentKills.reduce((sum, k) => sum + k.count, 0);
    if (
      killsInWindow >= KILL_STREAK_THRESHOLD
      && world.now - state.lastKillStreakAt > KILL_STREAK_COOLDOWN_MS
    ) {
      pushBounded(state, {
        kind: 'kill-streak',
        atMs: world.now,
        label: `${killsInWindow} down in ${(KILL_STREAK_WINDOW_MS / 1000).toFixed(0)}s`,
      });
      state.lastKillStreakAt = world.now;
    }

    if (
      world.audio.source !== 'none'
      && world.audio.energy >= MUSIC_SURGE_ENERGY_THRESHOLD
      && state.lastAudioEnergy < MUSIC_SURGE_ENERGY_THRESHOLD
      && world.now - state.lastMusicSurgeAt > MUSIC_SURGE_COOLDOWN_MS
    ) {
      pushBounded(state, { kind: 'music-surge', atMs: world.now, label: 'The track surged' });
      state.lastMusicSurgeAt = world.now;
    }
    state.lastAudioEnergy = world.audio.energy;

    if (world.ultActiveUntil > world.now && world.ultActiveUntil !== state.lastUltActiveUntil) {
      pushBounded(state, { kind: 'ultimate', atMs: world.now, label: 'Ultimate unleashed' });
      state.lastUltActiveUntil = world.ultActiveUntil;
    }

    if (world.rescue.status === 'freed' && state.lastRescueStatus !== 'freed') {
      pushBounded(state, { kind: 'ally-rescued', atMs: world.now, label: 'Rescued a crew ally' });
    }
    state.lastRescueStatus = world.rescue.status;

    const hpRatio = world.player.maxHp > 0 ? world.player.hp / world.player.maxHp : 1;
    if (
      hpRatio > 0
      && hpRatio <= CLOSE_CALL_HP_RATIO
      && world.now - state.lastCloseCallAt > CLOSE_CALL_COOLDOWN_MS
    ) {
      pushBounded(state, { kind: 'close-call', atMs: world.now, label: 'Survived a close call' });
      state.lastCloseCallAt = world.now;
    }

    if (world.outcome !== 'running' && !state.finished) {
      state.finished = true;
      pushBounded(state, world.outcome === 'cleared'
        ? { kind: 'run-cleared', atMs: world.now, label: 'Block cleared' }
        : { kind: 'run-ended', atMs: world.now, label: 'Went down' });
    }
  }

  function getHighlights(): RunHighlight[] {
    return [...state.highlights]
      .sort((a, b) => a.atMs - b.atMs)
      .map((h) => ({ ...h, detail: formatClock(h.atMs) }));
  }

  return { observe, getHighlights };
}
