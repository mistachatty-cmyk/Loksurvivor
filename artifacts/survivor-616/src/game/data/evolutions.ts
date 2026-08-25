import type { EvolutionDef } from '@/game/types';
import { WEAPONS_BY_ID } from './weapons';

const evolved = (id: string, name: string, description: string, baseWeaponId: string, requiredPassiveId: string, damage: number, range: number, cooldownMs: number): EvolutionDef => ({
  id, name, description, baseWeaponId, requiredPassiveId,
  result: { ...WEAPONS_BY_ID[baseWeaponId]!, id, name, description, damage, range, cooldownMs, levelDamageScale: 0.3, color: '#fff4b0' },
});

export const EVOLUTIONS: EvolutionDef[] = [
  evolved('gold-mic', 'Gold Mic', 'A plated shockwave that hits hard and reaches further.', 'freestyle-mic', 'gold-chain', 34, 102, 660),
  evolved('block-party', 'Block Party', 'The whole block becomes a bass-heavy danger zone.', 'boombox', 'subwoofer', 17, 140, 720),
  evolved('double-deck', 'Double Deck', 'Twin vinyl blades spin twice as fast.', 'turntable', 'vinyl-record', 24, 72, 0),
  evolved('full-ledger', 'Full Ledger', 'Every name in the book pulses at once.', 'ledger-page', 'torn-page', 26, 130, 1100),
  evolved('skeleton-key', 'Skeleton Key', 'Opens onto a field that nothing gets past.', 'house-key', 'master-key', 12, 110, 340),
];
export const EVOLUTIONS_BY_ID: Record<string, EvolutionDef> = Object.fromEntries(EVOLUTIONS.map((evolution) => [evolution.id, evolution]));