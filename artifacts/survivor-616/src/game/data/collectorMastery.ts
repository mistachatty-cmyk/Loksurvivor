import type { MetaState } from '@/game/types';
import { CARD_MANIFESTS } from './cards';

export interface CollectorRankTier {
  level: number;
  title: string;
  badge: string;
  minCards: number;
  perkDescription: string;
  color: string;
  borderGlow: string;
}

export const COLLECTOR_RANKS: CollectorRankTier[] = [
  {
    level: 1,
    title: 'Scrap Runner',
    badge: 'TIER I',
    minCards: 0,
    perkDescription: 'Standard access to Lock Deck binder and booster packs.',
    color: '#94a3b8',
    borderGlow: 'rgba(148, 163, 184, 0.3)',
  },
  {
    level: 2,
    title: 'District Sifter',
    badge: 'TIER II',
    minCards: 10,
    perkDescription: '+10% Card Credits yield when disenchanting duplicate cards.',
    color: '#34d399',
    borderGlow: 'rgba(52, 211, 153, 0.35)',
  },
  {
    level: 3,
    title: 'Cyber Curator',
    badge: 'TIER III',
    minCards: 25,
    perkDescription: 'Unlocks Daily Flash Specials discount tier & enhanced single purchases.',
    color: '#38bdf8',
    borderGlow: 'rgba(56, 189, 248, 0.4)',
  },
  {
    level: 4,
    title: 'Apex Archivist',
    badge: 'TIER IV',
    minCards: 50,
    perkDescription: 'Elevated holographic foil and glitch variant drop rates on all packs.',
    color: '#c084fc',
    borderGlow: 'rgba(192, 132, 252, 0.45)',
  },
  {
    level: 5,
    title: 'Grand Master of 616',
    badge: 'TIER V',
    minCards: 75,
    perkDescription: 'Sovereign golden binder insignia & maximum team synergy resonance.',
    color: '#fbbf24',
    borderGlow: 'rgba(251, 191, 36, 0.55)',
  },
];

export interface CollectorMasteryProgress {
  uniqueCount: number;
  totalCatalog: number;
  totalCopies: number;
  holoCount: number;
  totalCollectionValue: number;
  currentRank: CollectorRankTier;
  nextRank: CollectorRankTier | null;
  progressPercent: number;
  cardsUntilNext: number;
}

/**
 * Computes live collector progression, total value, and active tier perks.
 */
export function getCollectorMastery(meta: MetaState): CollectorMasteryProgress {
  const ownedRecords = meta.cardCollection.filter((r) => r.copies > 0);
  const uniqueCount = ownedRecords.length;
  const totalCatalog = CARD_MANIFESTS.length;
  const totalCopies = ownedRecords.reduce((sum, r) => sum + r.copies, 0);
  const holoCount = ownedRecords.filter(
    (r) => r.bestVariant === 'holo' || r.bestVariant === 'glitch' || r.bestVariant === 'neon',
  ).length;
  const totalCollectionValue = ownedRecords.reduce((sum, r) => sum + (r.totalValue || r.copies), 0);

  // Determine current tier
  let currentRank = COLLECTOR_RANKS[0]!;
  for (const rank of COLLECTOR_RANKS) {
    if (uniqueCount >= rank.minCards) {
      currentRank = rank;
    }
  }

  const nextRankIndex = COLLECTOR_RANKS.findIndex((r) => r.level === currentRank.level + 1);
  const nextRank = nextRankIndex !== -1 ? COLLECTOR_RANKS[nextRankIndex]! : null;

  let progressPercent = 100;
  let cardsUntilNext = 0;

  if (nextRank) {
    const range = nextRank.minCards - currentRank.minCards;
    const progressInCurrentTier = uniqueCount - currentRank.minCards;
    progressPercent = Math.min(100, Math.max(0, Math.round((progressInCurrentTier / range) * 100)));
    cardsUntilNext = Math.max(0, nextRank.minCards - uniqueCount);
  }

  return {
    uniqueCount,
    totalCatalog,
    totalCopies,
    holoCount,
    totalCollectionValue,
    currentRank,
    nextRank,
    progressPercent,
    cardsUntilNext,
  };
}
