import type { ChallengeContractDef, GemDef, MetaState, VendorItemDef } from '@/game/types';

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
  {
    id: 'kit-strap',
    name: 'Reinforced Kit Strap',
    description: '+14 pickup range per stack. Found in a coat pocket that used to belong to someone luckier.',
    category: 'relic',
    cost: 6,
    maxStacks: 3,
    currency: 'skeletonKeys',
    effects: [{ kind: 'stat', stat: 'magnet', add: 14, cap: 260 }],
  },
  {
    id: 'salvager-instinct',
    name: "Salvager's Instinct",
    description: '+8% final cred per stack. You know which alleys to check.',
    category: 'relic',
    cost: 10,
    maxStacks: 2,
    currency: 'skeletonKeys',
    effects: [{ kind: 'utility', utility: 'reward-cred-mult', amount: 0.08 }],
  },
  {
    id: 'loosened-padlock',
    name: 'Loosened Padlock',
    description: "+2 move speed per stack. Whatever it used to lock, it isn't locking anymore.",
    category: 'relic',
    cost: 8,
    maxStacks: 2,
    currency: 'skeletonKeys',
    effects: [{ kind: 'stat', stat: 'speed', add: 2, cap: 140 }],
  },
  {
    id: 'masters-cut',
    name: "Master's Cut",
    description: 'Begin every run with one extra signature weapon level. The good key, saved for later.',
    category: 'relic',
    cost: 20,
    maxStacks: 1,
    currency: 'skeletonKeys',
    effects: [{ kind: 'utility', utility: 'starting-weapon-level', amount: 1 }],
  },

  // -- Field ops: permanent unlocks that change how a run plays, not just its numbers. --
  {
    id: 'minimap-street-ears',
    name: 'Street Ears',
    description: 'Every enemy on the block shows up on the minimap as a live blip. First rung of the recon ladder.',
    category: 'ability',
    cost: 150,
    maxStacks: 1,
  },
  {
    id: 'minimap-loot-sense',
    name: 'Loot Sense',
    description: 'Cred, health, and loot boxes on the ground now show up on the minimap too.',
    category: 'ability',
    cost: 220,
    maxStacks: 1,
    requires: 'minimap-street-ears',
  },
  {
    id: 'minimap-hazard-sense',
    name: 'Hazard Sense',
    description: "Wind-up radii for enemy specials — shockwaves, currents, the works — draw on the minimap before they land.",
    category: 'ability',
    cost: 300,
    maxStacks: 1,
    requires: 'minimap-loot-sense',
  },
  {
    id: 'grabby-hands',
    name: 'Grabby Hands',
    description: '+18 world units on how far a tap or click reaches to prime a movable prop, per stack. Everything on the block gets grabbier.',
    category: 'ability',
    cost: 130,
    maxStacks: 3,
  },
  {
    id: 'colossus-frame',
    name: 'Colossus Frame',
    description: 'Double your size, hit 20% harder, and add 5% more damage on top. You are now, functionally, a problem.',
    category: 'ability',
    cost: 420,
    maxStacks: 1,
    effects: [
      { kind: 'stat', stat: 'power', mult: 1.2 },
      { kind: 'stat', stat: 'power', mult: 1.05 },
    ],
  },
  {
    id: 'ghost-cloak',
    name: 'Ghost Cloak',
    description: 'Every 14 seconds you fade to near-transparent for 2.5 seconds. Enemies lose your trail and drift toward where you used to be.',
    category: 'ability',
    cost: 260,
    maxStacks: 1,
  },
  {
    id: 'ghost-cloak-duration',
    name: 'Extended Fade',
    description: '+1.2 seconds of cloak uptime per stack.',
    category: 'ability',
    cost: 180,
    maxStacks: 3,
    requires: 'ghost-cloak',
  },
  {
    id: 'ghost-cloak-rate',
    name: 'Quick Recovery',
    description: '-3 seconds off the cloak cooldown per stack. A higher rate of vanishing.',
    category: 'ability',
    cost: 200,
    maxStacks: 3,
    requires: 'ghost-cloak',
  },
  {
    id: 'ghost-cloak-full',
    name: 'Full Invisibility',
    description: "The capstone: cloak turns you completely invisible and untouchable while it's up, fires more often, and every hit you land while cloaked deals 5% bonus stealth damage.",
    category: 'ability',
    cost: 520,
    maxStacks: 1,
    requires: 'ghost-cloak-rate',
  },
  {
    id: 'invert-world',
    name: 'Flip the Script',
    description: "Unlocks a Settings toggle that turns the whole run upside down. Purely for chaos — flip it back off any time.",
    category: 'ability',
    cost: 90,
    maxStacks: 1,
  },
  {
    id: 'invert-palette',
    name: 'Negative Exposure',
    description: 'Unlocks a Settings toggle that inverts every color on screen. The other classic cheat-code trick.',
    category: 'ability',
    cost: 90,
    maxStacks: 1,
  },

  // -- Low tier: priced for crews who have been doing this a while. --
  {
    id: 'veteran-plating',
    name: 'Veteran Plating',
    description: '+2% contact resistance per stack. Armor cannot exceed the game-wide 60% cap.',
    category: 'stat',
    cost: 2_000,
    maxStacks: 3,
    tierBand: 'low',
    tierRung: 1,
    effects: [{ kind: 'stat', stat: 'armor', add: 0.02, cap: 0.6 }],
  },
  {
    id: 'street-legend',
    name: 'Street Legend',
    description: '+15% final cred. Word travels when you have survived this long.',
    category: 'utility',
    cost: 8_000,
    maxStacks: 1,
    tierBand: 'low',
    tierRung: 2,
    effects: [{ kind: 'utility', utility: 'reward-cred-mult', amount: 0.15 }],
  },
];

export const VENDOR_CATALOG_BY_ID: Record<string, VendorItemDef> = Object.fromEntries(
  VENDOR_CATALOG.map((item) => [item.id, item]),
);

/**
 * Gems attach to an owned `VendorItemDef` node (their `hostId`) as a
 * modifier, not a standalone purchase. Each is a small, fixed pct/host/cost
 * combo -- see `GemDef` in `types.ts`.
 */
export const GEM_CATALOG: GemDef[] = [
  {
    id: 'grabby-hands-reach-15',
    hostId: 'grabby-hands',
    pct: 15,
    cost: 220,
    effect: 'reach',
  },
  {
    id: 'colossus-frame-impact-25',
    hostId: 'colossus-frame',
    pct: 25,
    cost: 480,
    effect: 'impact',
  },
  {
    id: 'ghost-cloak-fade-10',
    hostId: 'ghost-cloak',
    pct: 10,
    cost: 260,
    effect: 'fade',
  },
];

export const GEM_CATALOG_BY_ID: Record<string, GemDef> = Object.fromEntries(
  GEM_CATALOG.map((gem) => [gem.id, gem]),
);

export const GEMS_BY_HOST: Record<string, GemDef[]> = GEM_CATALOG.reduce<Record<string, GemDef[]>>((byHost, gem) => {
  (byHost[gem.hostId] ??= []).push(gem);
  return byHost;
}, {});

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

export function gemOwnedCount(meta: MetaState, gemId: string): number {
  return Math.max(0, Math.floor(meta.gemsOwned[gemId] ?? 0));
}

/** The GemDef currently socketed into a host's node, if any. */
export function attachedGemFor(meta: MetaState, hostId: string): GemDef | undefined {
  const gemId = meta.attachedGems[hostId];
  return gemId ? GEM_CATALOG_BY_ID[gemId] : undefined;
}

export function availableChallengeContracts(meta: MetaState): ChallengeContractDef[] {
  return CHALLENGE_CONTRACTS.filter((contract) => {
    const item = VENDOR_CATALOG.find((candidate) => candidate.challengeId === contract.id);
    return item ? vendorPurchaseCount(meta, item.id) > 0 : false;
  });
}