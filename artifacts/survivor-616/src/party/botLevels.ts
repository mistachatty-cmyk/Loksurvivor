/**
 * botLevels.ts -- per-bot difficulty for Lok Party.
 *
 * Each of the three bot seats has its own level: "Match my rank" (the Solo Blitz tier sets it),
 * a fixed Easy / Medium / Hard / Master, or Random (a different level each match). Pure and seeded:
 * Random is a hash of the match seed and seat, never Math.random, so replays and online hosts agree.
 */

import { botSkillsForTier } from './lokDrop';

export type BotLevel = 'auto' | 'easy' | 'medium' | 'hard' | 'master' | 'random';
export const BOT_LEVELS: readonly BotLevel[] = ['auto', 'easy', 'medium', 'hard', 'master', 'random'];
export const FIXED_SKILL: Record<Exclude<BotLevel, 'auto' | 'random'>, number> = { easy: 0.2, medium: 0.45, hard: 0.7, master: 0.92 };
const FIXED = ['easy', 'medium', 'hard', 'master'] as const;

export type BotLevels = [BotLevel, BotLevel, BotLevel];
export const DEFAULT_BOT_LEVELS: BotLevels = ['auto', 'auto', 'auto'];

export function sanitizeBotLevels(raw: unknown): BotLevels {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [0, 1, 2].map((i) => (BOT_LEVELS.includes(arr[i] as BotLevel) ? (arr[i] as BotLevel) : 'auto'));
  return out as BotLevels;
}

function hash(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** The three bot skills (0..1) for a match. */
export function resolveBotSkills(levels: BotLevels, tier: number, seed: number): [number, number, number] {
  const auto = botSkillsForTier(tier);
  return levels.map((lv, i) => {
    if (lv === 'auto') return auto[i];
    if (lv === 'random') return FIXED_SKILL[FIXED[Math.floor(hash(seed, i + 1) * FIXED.length)]];
    return FIXED_SKILL[lv];
  }) as [number, number, number];
}

const KEY = 'lokparty.bots.v1';

export function loadBotLevels(storage: Storage | null): BotLevels {
  try {
    const raw = storage?.getItem(KEY);
    return sanitizeBotLevels(raw ? JSON.parse(raw) : null);
  } catch {
    return [...DEFAULT_BOT_LEVELS] as BotLevels;
  }
}

export function saveBotLevels(storage: Storage | null, levels: BotLevels): void {
  try {
    storage?.setItem(KEY, JSON.stringify(levels));
  } catch {
    /* private mode */
  }
}
