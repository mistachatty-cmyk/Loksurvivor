/**
 * The goal of a page: tear down most of it and beat its boss. Pure rules, so the overlay's flow (when the boss
 * arrives, when the level is complete) is testable without a DOM. Zen mode has no enemies, so no boss.
 */

/** Share of the page's area that must be destroyed. */
export const OBJECTIVE_PCT = 0.7;
/** The boss shows up once this much is gone, or after this long, whichever is first. */
export const BOSS_AT_PCT = 0.4;
export const BOSS_AT_SEC = 240;

export interface LevelState {
  /** Destroyed share of the page, 0..1. */
  destroyed: number;
  elapsedSec: number;
  zen: boolean;
  bossSpawned: boolean;
  bossKilled: boolean;
}

export function shouldSpawnBoss(s: LevelState): boolean {
  return !s.zen && !s.bossSpawned && (s.destroyed >= BOSS_AT_PCT || s.elapsedSec >= BOSS_AT_SEC);
}

export function levelComplete(s: LevelState): boolean {
  return s.destroyed >= OBJECTIVE_PCT && (s.zen || s.bossKilled);
}

export type LevelStage = 'smash' | 'boss' | 'done';

/** What the HUD should be pointing at: keep smashing, kill the boss, or done. */
export function levelStage(s: LevelState): LevelStage {
  if (levelComplete(s)) return 'done';
  if (s.destroyed >= OBJECTIVE_PCT && !s.zen) return 'boss';
  return 'smash';
}
