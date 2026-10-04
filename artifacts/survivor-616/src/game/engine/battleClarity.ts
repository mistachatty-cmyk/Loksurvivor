/**
 * Small helpers that make a fight readable at a glance: how well a move
 * matches up against the current opponent, what a status effect does and how
 * long it has left, and what kind of move the opponent is about to use.
 * Shared by the arena screen and the quick fight so both say the same thing.
 */
import { getElementalMultiplier } from '@/game/data/lokPetBattles';
import type { BattlePet, BattleStatusEffectType, LokPetBattleMove } from '@/game/engine/lokPetBattleTypes';
import type { LokPetElement } from '@/game/types';

export type MoveMatchup = 'strong' | 'normal' | 'weak' | 'support';

export const MATCHUP_LABEL: Record<MoveMatchup, string> = {
  strong: 'Strong',
  normal: 'Normal',
  weak: 'Weak',
  support: 'Support',
};

/** Guard and heal moves do not hit anyone, so the element chart does not apply to them. */
export function isSupportMove(move: LokPetBattleMove): boolean {
  return move.kind === 'guard' || move.id === 'starlight-remedy';
}

/** Strong is better than 1.2x damage, weak is worse than 0.9x, everything else is normal. */
export function moveMatchup(move: LokPetBattleMove, defenderElement: LokPetElement): MoveMatchup {
  if (isSupportMove(move)) return 'support';
  const multiplier = getElementalMultiplier(move.element, defenderElement).multiplier;
  if (multiplier > 1.2) return 'strong';
  if (multiplier < 0.9) return 'weak';
  return 'normal';
}

export interface StatusInfo {
  code: string;
  label: string;
  tone: 'bad' | 'good';
  hint: string;
}

export const STATUS_INFO: Record<BattleStatusEffectType, StatusInfo> = {
  burn: { code: 'BRN', label: 'Burn', tone: 'bad', hint: 'Loses a little HP every round.' },
  freeze: { code: 'FRZ', label: 'Freeze', tone: 'bad', hint: 'Chilled and sluggish.' },
  slow: { code: 'SLO', label: 'Slow', tone: 'bad', hint: 'Lagging behind.' },
  stun: { code: 'STN', label: 'Stun', tone: 'bad', hint: 'Rattled.' },
  shock: { code: 'SHK', label: 'Shock', tone: 'bad', hint: 'Loses HP and 10 SP every round.' },
  corrupt: { code: 'GLT', label: 'Glitch', tone: 'bad', hint: 'Loses HP to corrupted data every round.' },
  empower: { code: 'PWR', label: 'Empower', tone: 'good', hint: 'Hits 30% harder.' },
  shield: { code: 'SHD', label: 'Shield', tone: 'good', hint: 'Takes half damage.' },
  leech: { code: 'LCH', label: 'Leech', tone: 'good', hint: 'Drains HP from the target.' },
};

export interface StatusChip extends StatusInfo {
  type: BattleStatusEffectType;
  turns: number;
}

/** One chip per status on the pet, merged by type so stacked copies show their longest timer. */
export function statusChips(pet: Pick<BattlePet, 'statusEffects'>): StatusChip[] {
  const byType = new Map<BattleStatusEffectType, StatusChip>();
  for (const effect of pet.statusEffects) {
    const info = STATUS_INFO[effect.type];
    if (!info) continue;
    const existing = byType.get(effect.type);
    if (!existing || effect.duration > existing.turns) {
      byType.set(effect.type, { ...info, type: effect.type, turns: effect.duration });
    }
  }
  return [...byType.values()];
}

export type MoveIntent = 'attack' | 'guard' | 'heal';

export function moveIntent(move: LokPetBattleMove): MoveIntent {
  if (move.id === 'starlight-remedy') return 'heal';
  if (move.kind === 'guard') return 'guard';
  return 'attack';
}

/** Plain-language line for the "what is the opponent about to do" banner. */
export function describeIntent(move: LokPetBattleMove, defenderElement: LokPetElement): string {
  const intent = moveIntent(move);
  if (intent === 'guard') return `${move.name}: bracing for impact`;
  if (intent === 'heal') return `${move.name}: patching itself up`;
  const matchup = moveMatchup(move, defenderElement);
  const size = move.kind === 'ultimate' ? 'finisher' : move.kind === 'skill' ? 'heavy hit' : 'quick hit';
  const note = matchup === 'strong' ? ', strong against you' : matchup === 'weak' ? ', weak against you' : '';
  return `${move.name}: ${size}${note}`;
}
