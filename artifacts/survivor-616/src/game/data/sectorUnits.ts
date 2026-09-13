import type { SectorUnitDef } from '@/game/types';

/**
 * Sector Command's Tier-1 "stolen" economy: you do not build units, you take
 * them. Every entry here is an existing `EnemyDef` that can change sides once
 * it is weakened past `captureHpFraction`, and the multipliers are what it
 * becomes when it does.
 *
 * Deliberately a short, curated list rather than "every enemy": a captured
 * unit has to read clearly at a glance on a phone, and swarm trash makes for
 * an illegible squad. Bosses are never capturable (the engine also refuses
 * them independently, the same way `castFreezeCone` does).
 *
 * Balance intent: capturing costs you the kill (no XP, no drops), so the
 * trade is always "army now vs. progression now". Tanky units cost more of
 * the squad cap than fast ones, so a full squad is a real composition choice.
 */
export const SECTOR_UNITS: SectorUnitDef[] = [
  {
    enemyId: 'nightcrawler',
    name: 'Turned Nightcrawler',
    squadCost: 1,
    hpMult: 1.4,
    damageMult: 1,
    speedMult: 1,
    captureHpFraction: 0.5,
    role: 'line',
    blurb: 'Cheap, forgettable, and endlessly available. The backbone of any stolen squad.',
  },
  {
    enemyId: 'corner-cutter',
    name: 'Turned Corner Cutter',
    squadCost: 1,
    hpMult: 1.3,
    damageMult: 1.1,
    speedMult: 1.15,
    captureHpFraction: 0.5,
    role: 'skirmisher',
    blurb: 'Still refuses to take the direct route. Useful for cutting off a lane.',
  },
  {
    enemyId: 'crypt-spitter',
    name: 'Turned Crypt Spitter',
    squadCost: 2,
    hpMult: 1.2,
    damageMult: 1.2,
    speedMult: 0.9,
    captureHpFraction: 0.45,
    role: 'support',
    blurb: 'Keeps its range and its aim. The only stolen unit that reliably hits from behind cover.',
  },
  {
    enemyId: 'bloodhound',
    name: 'Turned Bloodhound',
    squadCost: 2,
    hpMult: 1.35,
    damageMult: 1.15,
    speedMult: 1.2,
    captureHpFraction: 0.45,
    role: 'skirmisher',
    blurb: 'Runs down anything that tries to disengage. Point it at whatever is fleeing.',
  },
  {
    enemyId: 'firewall-brute',
    name: 'Turned Firewall Brute',
    squadCost: 3,
    hpMult: 1.5,
    damageMult: 1.25,
    speedMult: 0.85,
    captureHpFraction: 0.35,
    role: 'siege',
    blurb: 'Hard to take and harder to move, but it holds a doorway on its own.',
  },
  {
    enemyId: 'token-golem',
    name: 'Turned Token Golem',
    squadCost: 3,
    hpMult: 1.6,
    damageMult: 1.2,
    speedMult: 0.8,
    captureHpFraction: 0.35,
    role: 'siege',
    blurb: 'Decades of dropped quarters, now yours. Slow, and worth the wait.',
  },
];

export const SECTOR_UNITS_BY_ENEMY_ID: Record<string, SectorUnitDef> = Object.fromEntries(
  SECTOR_UNITS.map((unit) => [unit.enemyId, unit]),
);

/** True when this enemy id has a capture profile at all. */
export function isCapturable(enemyId: string): boolean {
  return enemyId in SECTOR_UNITS_BY_ENEMY_ID;
}
