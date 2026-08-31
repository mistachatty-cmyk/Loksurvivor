import type { LootPrizeDef } from '@/game/types';
import { rollLokPet } from './lokPets';

/** Weighted prize pool for the loot box reel. */
export interface PrizeEntry {
  weight: number;
  prize: LootPrizeDef;
}

export const PRIZE_TABLE: PrizeEntry[] = [
  // Cred bags — most common
  { weight: 22, prize: { kind: 'cred', amount: 60, label: '+60 Cred' } },
  { weight: 16, prize: { kind: 'cred', amount: 100, label: '+100 Cred' } },
  { weight: 8, prize: { kind: 'cred', amount: 180, label: '+180 Cred' } },
  // Tokens
  { weight: 20, prize: { kind: 'token', amount: 1, label: 'Loot Token' } },
  { weight: 6, prize: { kind: 'token', amount: 2, label: '2 Loot Tokens' } },
  // Heals
  { weight: 14, prize: { kind: 'heal', amount: 50, label: '+50 HP' } },
  { weight: 8, prize: { kind: 'heal', amount: 90, label: '+90 HP' } },
  // Stat boons
  { weight: 6, prize: { kind: 'stat', stat: 'power', add: 0.08, label: '+8% Damage' } },
  { weight: 5, prize: { kind: 'stat', stat: 'area', add: 0.12, label: '+12% Area' } },
  { weight: 5, prize: { kind: 'stat', stat: 'haste', add: -0.08, label: '-8% Cooldowns' } },
  { weight: 4, prize: { kind: 'stat', stat: 'speed', add: 12, label: '+12 Speed' } },
  // Temporary companions — the chest generates the complete variant sheet.
  { weight: 9, prize: { kind: 'lokpet', label: 'LokPet signal' } },
  // Elixirs — rare, spent to revive a fallen team LokPet.
  { weight: 3, prize: { kind: 'elixir', amount: 1, label: '+1 Elixir' } },
];

/** Visual face shown on each reel strip panel. */
export const REEL_FACES = [
  { symbol: '$', color: '#ffd166', label: 'Cred'  },
  { symbol: 'T', color: '#f59e0b', label: 'Token' },
  { symbol: '+', color: '#7dffb2', label: 'Heal'  },
  { symbol: '^', color: '#6ee7ff', label: 'Stat'  },
  { symbol: 'W', color: '#a78bfa', label: 'Weapon' },
  { symbol: 'P', color: '#ff7ab8', label: 'LokPet' },
  { symbol: 'E', color: '#c084fc', label: 'Elixir' },
];

export function prizeToFaceIndex(prize: LootPrizeDef): number {
  if (prize.kind === 'cred') return 0;
  if (prize.kind === 'token') return 1;
  if (prize.kind === 'heal') return 2;
  if (prize.kind === 'stat') return 3;
  if (prize.kind === 'weapon') return 4;
  if (prize.kind === 'lokpet') return 5;
  return 6; // Elixir
}

export function rollPrize(rng: () => number): LootPrizeDef {
  const totalWeight = PRIZE_TABLE.reduce((s, e) => s + e.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of PRIZE_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) {
      if (entry.prize.kind === 'lokpet') {
        const lokPet = rollLokPet(rng);
        return { ...entry.prize, label: `LokPet · ${lokPet.name}`, lokPet };
      }
      return entry.prize;
    }
  }
  return PRIZE_TABLE[0]!.prize;
}
