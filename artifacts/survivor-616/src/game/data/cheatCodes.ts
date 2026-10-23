/**
 * Cheat codes: phrases typed into LOK Chat or the Cheat bar.
 *
 * Data-driven like the rest of the game: a new code is a new record here, never a change to
 * the matching or the UI. Phrases are stored as hashes only, so the words are not readable in the
 * shipped build (add one with `pnpm exec tsx scripts/hash-phrase.ts "the phrase"`). The master phrase switches Dev Mode access on;
 * dev access is never handed out automatically. The resource and unlock cheats only answer
 * once dev access is on, so they cannot be triggered by accident. Easter eggs are harmless
 * and answer for everyone.
 */

import { hashPhrase } from '@/lib/phraseHash';

export type CheatResource = 'cred' | 'lootTokens' | 'cardCredits' | 'skeletonKeys' | 'lokPetTreats' | 'petElixirs';

export const CHEAT_RESOURCES: readonly CheatResource[] = ['cred', 'lootTokens', 'cardCredits', 'skeletonKeys', 'lokPetTreats', 'petElixirs'];

export type CheatFx = 'confetti' | 'disco' | 'pulse616';

export type CheatEffect =
  | { kind: 'devAccess' }
  | { kind: 'grant'; amounts: Partial<Record<CheatResource, number>> }
  | { kind: 'allUnlocks'; enabled: boolean }
  | { kind: 'fx'; fx: CheatFx };

export type CheatGroup = 'master' | 'resources' | 'unlocks' | 'fun';

export interface CheatCodeDef {
  id: string;
  /** Hashes of the typed phrases that trigger it (see `hashPhrase`). The words themselves never ship. */
  hashes: readonly string[];
  group: CheatGroup;
  /** Needs Dev Mode access to answer. The master phrase and the easter eggs do not. */
  requiresDevAccess: boolean;
  effect: CheatEffect;
}

export const CHEAT_CODES: readonly CheatCodeDef[] = [
  { id: 'master', hashes: ['2zeh61b8ql', '2tex7qarru'], group: 'master', requiresDevAccess: false, effect: { kind: 'devAccess' } },

  // Resources: one per currency, plus a bundle.
  { id: 'cred', hashes: ['1ygdmgppbcw', '1eq01mn5atp'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { cred: 10000 } } },
  { id: 'loot', hashes: ['248bziert0i', '1f6xknsbyo6'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { lootTokens: 50 } } },
  { id: 'cards', hashes: ['1wrna0m5sue', '12wezyitc90'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { cardCredits: 500 } } },
  { id: 'keys', hashes: ['1yygvmh3sd6', '6hffmj9mre'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { skeletonKeys: 10 } } },
  { id: 'treats', hashes: ['21dcx24h4nn', '2a51an4yv4s'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { lokPetTreats: 25 } } },
  { id: 'elixirs', hashes: ['1z4gw1glj74', '25w5l3wzxte'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { petElixirs: 5 } } },
  {
    id: 'bundle',
    hashes: ['1p02z1o1p6e', '6q2x53ts8v'],
    group: 'resources',
    requiresDevAccess: true,
    effect: { kind: 'grant', amounts: { cred: 100000, lootTokens: 200, cardCredits: 2000, skeletonKeys: 25, lokPetTreats: 50, petElixirs: 10 } },
  },

  // Unlocks: the reversible Dev Mode "everything is open" switch.
  { id: 'unlock-all', hashes: ['1f0fzue5iah', '1a9wobywz4c'], group: 'unlocks', requiresDevAccess: true, effect: { kind: 'allUnlocks', enabled: true } },
  { id: 'relock-all', hashes: ['aeoaydrbsx', '110gpdhufyf'], group: 'unlocks', requiresDevAccess: true, effect: { kind: 'allUnlocks', enabled: false } },

  // Easter eggs: harmless, open to everyone.
  { id: 'konami', hashes: ['pzjepnlesi', '1c6usvir18e'], group: 'fun', requiresDevAccess: false, effect: { kind: 'fx', fx: 'confetti' } },
  { id: 'confetti', hashes: ['4t6aq7c352', '13462suterg'], group: 'fun', requiresDevAccess: false, effect: { kind: 'fx', fx: 'confetti' } },
  { id: 'disco', hashes: ['144g11iyipm', '1fzxjno09dt'], group: 'fun', requiresDevAccess: false, effect: { kind: 'fx', fx: 'disco' } },
  { id: 'six-sixteen', hashes: ['1rkjf1owxtq', '219lsrfvu8t'], group: 'fun', requiresDevAccess: false, effect: { kind: 'fx', fx: 'pulse616' } },
];

/** Lower-cases and drops everything that is not a letter or digit, so "I love your Merci!" matches. */
export function normalizeCheatInput(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The cheat a typed message names, or undefined when it is just chat. Ignores access. */
export function findCheat(text: string): CheatCodeDef | undefined {
  const typed = normalizeCheatInput(text);
  if (!typed) return undefined;
  const hash = hashPhrase(typed);
  return CHEAT_CODES.find((code) => code.hashes.includes(hash));
}

export type CheatResolution =
  | { status: 'none' }
  | { status: 'locked'; code: CheatCodeDef }
  | { status: 'ready'; code: CheatCodeDef };

/** Decides what a typed message does given whether Dev Mode access is already on. */
export function resolveCheat(text: string, devAccess: boolean): CheatResolution {
  const code = findCheat(text);
  if (!code) return { status: 'none' };
  if (code.requiresDevAccess && !devAccess) return { status: 'locked', code };
  return { status: 'ready', code };
}

/** Resource caps keep a stack of cheats from overflowing the save's counters. */
export const CHEAT_RESOURCE_CAP = 99_999_999;
