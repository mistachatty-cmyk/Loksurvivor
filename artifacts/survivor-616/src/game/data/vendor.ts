import type { ChallengeContractDef, MetaState, VendorItemDef } from '@/game/types';

/**
 * Permanent hideout purchases. Costs are intentionally fixed: the player can
 * compare the whole catalog and plan a build instead of waiting for rotations.
 */
export const VENDOR_CATALOG: VendorItemDef[] = [
  {
    id: 'reinforced-hoodie',
    name: 'Reinforced Hoodie',
    description: '+18 max HP per stack. The vendor caps the lining before it gets cumbersome.',
    category: 'stat',
    cost: 90,
    maxStacks: 5,
    effects: [{ kind: 'stat', stat: 'maxHp', add: 18, cap: 300 }],
  },
  {
    id: 'running-shoes',
    name: 'Running Shoes',
    description: '+3 move speed per stack. Good soles, bad decisions.',
    category: 'stat',
    cost: 110,
    maxStacks: 5,
    effects: [{ kind: 'stat', stat: 'speed', add: 3, cap: 140 }],
  },
  {
    id: 'hot-rounds',
    name: 'Hot Rounds',
    description: '+4% global damage per stack, up to a safe permanent limit.',
    category: 'stat',
    cost: 140,
    maxStacks: 5,
    effects: [{ kind: 'stat', stat: 'power', add: 0.04, cap: 1.7 }],
  },
  {
    id: 'plated-vest',
    name: 'Plated Vest',
    description: '+3% contact resistance per stack. Armor cannot exceed the game-wide 60% cap.',
    category: 'stat',
    cost: 160,
    maxStacks: 4,
    effects: [{ kind: 'stat', stat: 'armor', add: 0.03, cap: 0.6 }],
  },
  {
    id: 'long-pocket',
    name: 'Long Pocket',
    description: '+20 pickup range per stack so the street pays out from farther away.',
    category: 'stat',
    cost: 100,
    maxStacks: 4,
    effects: [{ kind: 'stat', stat: 'magnet', add: 20, cap: 240 }],
  },
  {
    id: 'starting-edge',
    name: 'Starting Edge',
    description: 'Begin every run with one extra signature weapon level per stack.',
    category: 'utility',
    cost: 240,
    maxStacks: 2,
    effects: [{ kind: 'utility', utility: 'starting-weapon-level', amount: 1 }],
  },
  {
    id: 'scavenger-cut',
    name: "Scavenger's Cut",
    description: '+10% cred from the final run payout per stack, including challenge bonuses.',
    category: 'utility',
    cost: 260,
    maxStacks: 3,
    effects: [{ kind: 'utility', utility: 'reward-cred-mult', amount: 0.1 }],
  },
  {
    id: 'contract-redline',
    name: 'Contract: Redline',
    description: 'Crowded streets: enemy flow rises sharply. Contract rewards are better.',
    category: 'challenge',
    cost: 180,
    maxStacks: 1,
    challengeId: 'redline',
  },
  {
    id: 'contract-hardcase',
    name: 'Contract: Hardcase',
    description: 'Hard targets: enemies take more punishment. Contract rewards are better.',
    category: 'challenge',
    cost: 210,
    maxStacks: 1,
    challengeId: 'hardcase',
  },
  {
    id: 'contract-no-shelter',
    name: 'Contract: No Shelter',
    description: 'No safe contact: enemy hits hurt more. Contract rewards are better.',
    category: 'challenge',
    cost: 230,
    maxStacks: 1,
    challengeId: 'no-shelter',
  },
];

export const VENDOR_CATALOG_BY_ID: Record<string, VendorItemDef> = Object.fromEntries(
  VENDOR_CATALOG.map((item) => [item.id, item]),
);

export const CHALLENGE_CONTRACTS: ChallengeContractDef[] = [
  {
    id: 'redline',
    name: 'Redline',
    description: 'Enemy flow +30%.',
    rewardMultiplier: 1.3,
    enemySpawnMultiplier: 1.3,
    enemyHealthMultiplier: 1,
    enemyDamageMultiplier: 1,
  },
  {
    id: 'hardcase',
    name: 'Hardcase',
    description: 'Enemy health +35%.',
    rewardMultiplier: 1.35,
    enemySpawnMultiplier: 1,
    enemyHealthMultiplier: 1.35,
    enemyDamageMultiplier: 1,
  },
  {
    id: 'no-shelter',
    name: 'No Shelter',
    description: 'Enemy contact damage +40%.',
    rewardMultiplier: 1.4,
    enemySpawnMultiplier: 1,
    enemyHealthMultiplier: 1,
    enemyDamageMultiplier: 1.4,
  },
];

export const CHALLENGE_CONTRACTS_BY_ID: Record<string, ChallengeContractDef> = Object.fromEntries(
  CHALLENGE_CONTRACTS.map((contract) => [contract.id, contract]),
);

export function vendorPurchaseCount(meta: MetaState, itemId: string): number {
  return Math.max(0, Math.floor(meta.vendorPurchases[itemId] ?? 0));
}

export function availableChallengeContracts(meta: MetaState): ChallengeContractDef[] {
  return CHALLENGE_CONTRACTS.filter((contract) => {
    const item = VENDOR_CATALOG.find((candidate) => candidate.challengeId === contract.id);
    return item ? vendorPurchaseCount(meta, item.id) > 0 : false;
  });
}