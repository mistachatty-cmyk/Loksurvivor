/**
 * Cheat codes: phrases typed into LOK Chat or the Cheat bar.
 *
 * Data-driven like the rest of the game: a new code is a new record here, never a change to
 * the matching or the UI. The master phrase (`iloveyourmerci`) switches Dev Mode access on;
 * dev access is never handed out automatically. The resource and unlock cheats only answer
 * once dev access is on, so they cannot be triggered by accident. Easter eggs are harmless
 * and answer for everyone.
 */

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
  /** Typed phrases that trigger it, compared after `normalizeCheatInput`. */
  phrases: readonly string[];
  group: CheatGroup;
  /** Needs Dev Mode access to answer. The master phrase and the easter eggs do not. */
  requiresDevAccess: boolean;
  effect: CheatEffect;
}

/** The master phrase. Typing it in LOK Chat is the one way Dev Mode access gets switched on. */
export const MASTER_CHEAT_PHRASE = 'iloveyourmerci';

export const CHEAT_CODES: readonly CheatCodeDef[] = [
  { id: 'master', phrases: [MASTER_CHEAT_PHRASE, 'iloveyoumerci'], group: 'master', requiresDevAccess: false, effect: { kind: 'devAccess' } },

  // Resources: one per currency, plus a bundle.
  { id: 'cred', phrases: ['showmethemoney', 'cred'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { cred: 10000 } } },
  { id: 'loot', phrases: ['lootrain', 'loot'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { lootTokens: 50 } } },
  { id: 'cards', phrases: ['cardshark', 'cardcredits'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { cardCredits: 500 } } },
  { id: 'keys', phrases: ['skeletonkey', 'keys'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { skeletonKeys: 10 } } },
  { id: 'treats', phrases: ['treatyourpet', 'treats'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { lokPetTreats: 25 } } },
  { id: 'elixirs', phrases: ['elixirtime', 'elixirs'], group: 'resources', requiresDevAccess: true, effect: { kind: 'grant', amounts: { petElixirs: 5 } } },
  {
    id: 'bundle',
    phrases: ['bigspender', 'everything'],
    group: 'resources',
    requiresDevAccess: true,
    effect: { kind: 'grant', amounts: { cred: 100000, lootTokens: 200, cardCredits: 2000, skeletonKeys: 25, lokPetTreats: 50, petElixirs: 10 } },
  },

  // Unlocks: the reversible Dev Mode "everything is open" switch.
  { id: 'unlock-all', phrases: ['unlockeverything', 'openseame'], group: 'unlocks', requiresDevAccess: true, effect: { kind: 'allUnlocks', enabled: true } },
  { id: 'relock-all', phrases: ['relockeverything', 'closeseame'], group: 'unlocks', requiresDevAccess: true, effect: { kind: 'allUnlocks', enabled: false } },

  // Easter eggs: harmless, open to everyone.
  { id: 'konami', phrases: ['upupdowndownleftrightleftrightba', 'konami'], group: 'fun', requiresDevAccess: false, effect: { kind: 'fx', fx: 'confetti' } },
  { id: 'confetti', phrases: ['confetti', 'party'], group: 'fun', requiresDevAccess: false, effect: { kind: 'fx', fx: 'confetti' } },
  { id: 'disco', phrases: ['disco', 'discoinferno'], group: 'fun', requiresDevAccess: false, effect: { kind: 'fx', fx: 'disco' } },
  { id: 'six-sixteen', phrases: ['616', 'grandrapids'], group: 'fun', requiresDevAccess: false, effect: { kind: 'fx', fx: 'pulse616' } },
];

/** Lower-cases and drops everything that is not a letter or digit, so "I love your Merci!" matches. */
export function normalizeCheatInput(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The cheat a typed message names, or undefined when it is just chat. Ignores access. */
export function findCheat(text: string): CheatCodeDef | undefined {
  const typed = normalizeCheatInput(text);
  if (!typed) return undefined;
  return CHEAT_CODES.find((code) => code.phrases.includes(typed));
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

/** The first phrase shown for a code in the Cheat bar. */
export function primaryPhrase(code: CheatCodeDef): string {
  return code.phrases[0] ?? code.id;
}

/** Resource caps keep a stack of cheats from overflowing the save's counters. */
export const CHEAT_RESOURCE_CAP = 99_999_999;
