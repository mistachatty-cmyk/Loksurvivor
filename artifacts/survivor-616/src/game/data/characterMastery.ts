/**
 * Character mastery: a per-character prestige level built entirely from
 * `MetaState.killsByCharacter`, the same "pure function over lifetime
 * counters" pattern `data/achievements.ts` uses -- there is no stored
 * level, so a corrected kill count retroactively re-levels instead of
 * drifting out of sync.
 *
 * The three milestone levels each unlock a permanent prestige skin (see
 * `data/characterSkins.ts`) for that character specifically.
 */
import type { CharacterDef, MetaState } from '@/game/types';
import { AREAS } from './areas';
import { CHARACTER_EPISODE_BY_CHARACTER_ID } from './episodes';

/** Kills required per mastery level. A flat divisor, not a curve -- levels 100/500/1000 are the only thresholds anything reads. */
export const KILLS_PER_MASTERY_LEVEL = 25;

/** The milestone levels that each unlock a prestige skin tier. */
export const MASTERY_SKIN_LEVELS = [100, 500, 1000] as const;
export type MasterySkinLevel = (typeof MASTERY_SKIN_LEVELS)[number];

type MasteryContext = Pick<MetaState, 'killsByCharacter'>;
type ChecklistContext = Pick<
  MetaState,
  'killsByCharacter' | 'clearedAreaIdsByCharacter' | 'completedEpisodeIds'
>;

export function characterMasteryKills(characterId: string, meta: MasteryContext): number {
  return meta.killsByCharacter[characterId] ?? 0;
}

/** A character's persistent mastery level, derived from their lifetime kills. */
export function characterMasteryLevel(characterId: string, meta: MasteryContext): number {
  return Math.floor(characterMasteryKills(characterId, meta) / KILLS_PER_MASTERY_LEVEL);
}

export function killsForMasteryLevel(level: number): number {
  return level * KILLS_PER_MASTERY_LEVEL;
}

export function areaIdsClearedAs(characterId: string, meta: Pick<MetaState, 'clearedAreaIdsByCharacter'>): string[] {
  return meta.clearedAreaIdsByCharacter[characterId] ?? [];
}

export function hasClearedEveryAreaAs(characterId: string, meta: Pick<MetaState, 'clearedAreaIdsByCharacter'>): boolean {
  const cleared = areaIdsClearedAs(characterId, meta);
  return AREAS.every((area) => cleared.includes(area.id));
}

const ratio = (value: number, total: number) => (total <= 0 ? 0 : Math.min(1, value / total));

export interface CharacterChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  /** 0..1, 1 whenever `complete` is true. */
  progress: number;
}

export interface CharacterChecklist {
  characterId: string;
  items: CharacterChecklistItem[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
}

/**
 * Per-character completionist checklist: their episode (when they have
 * one), each mastery milestone, and clearing every district with them.
 * Whether a character is unlocked at all is deliberately not an item here
 * -- a locked character has no checklist to show in the first place.
 */
export function characterChecklist(character: CharacterDef, meta: ChecklistContext): CharacterChecklist {
  const items: CharacterChecklistItem[] = [];

  const episode = CHARACTER_EPISODE_BY_CHARACTER_ID[character.id];
  if (episode) {
    const complete = meta.completedEpisodeIds.includes(episode.id);
    items.push({ id: 'episode', label: `Complete "${episode.title}"`, complete, progress: complete ? 1 : 0 });
  }

  const kills = characterMasteryKills(character.id, meta);
  const level = characterMasteryLevel(character.id, meta);
  for (const tier of MASTERY_SKIN_LEVELS) {
    const complete = level >= tier;
    items.push({
      id: `mastery-${tier}`,
      label: `Reach Mastery Level ${tier}`,
      complete,
      progress: complete ? 1 : ratio(kills, killsForMasteryLevel(tier)),
    });
  }

  const clearedCount = areaIdsClearedAs(character.id, meta).length;
  items.push({
    id: 'every-district',
    label: `Clear Every District as ${character.name}`,
    complete: hasClearedEveryAreaAs(character.id, meta),
    progress: ratio(clearedCount, AREAS.length),
  });

  const completedCount = items.filter((item) => item.complete).length;
  return { characterId: character.id, items, completedCount, totalCount: items.length, allComplete: completedCount === items.length };
}
