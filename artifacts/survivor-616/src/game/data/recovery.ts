import type { RecoveryFacilityDef, RecoveryHutDef } from '@/game/types';

export const RECOVERY_FACILITIES: RecoveryFacilityDef[] = [
  {
    id: 'tub',
    name: 'Utility Tub',
    description: 'A dented tub in the back of the Sanctum. Better than sleeping in your boots.',
    recoveryPctPerMinute: 0.35,
    socialCapacity: 1,
    cost: 0,
    unlockText: 'Available from the start',
  },
  {
    id: 'shower',
    name: 'Hot Shower',
    description: 'Steam, clean clothes, and five uninterrupted minutes of quiet.',
    recoveryPctPerMinute: 0.7,
    socialCapacity: 1,
    cost: 80,
    unlockText: 'Upgrade from the Utility Tub',
  },
  {
    id: 'hot-tub',
    name: 'Hot Tub',
    description: 'Room for a friend and enough heat to loosen the city out of your shoulders.',
    recoveryPctPerMinute: 1.1,
    socialCapacity: 2,
    cost: 180,
    unlockText: 'Upgrade from the Hot Shower',
  },
  {
    id: 'sauna',
    name: 'Sauna Room',
    description: 'A cedar-lined room where the crew can sweat the night out together.',
    recoveryPctPerMinute: 1.6,
    socialCapacity: 3,
    cost: 320,
    unlockText: 'Upgrade from the Hot Tub',
  },
  {
    id: 'rooftop-hot-tub',
    name: 'Rooftop Hot Tub',
    description: 'The whole skyline, warm water, and no one asking you to go back downstairs yet.',
    recoveryPctPerMinute: 2.4,
    socialCapacity: 4,
    cost: 550,
    unlockText: 'Upgrade from the Sauna Room',
  },
  {
    id: 'swat-sauna',
    name: 'SWAT Sauna',
    description:
      'Confiscated department cedar, reassembled in the GRPD basement. The best recovery in the city -- reachable only by clearing the station, never bought.',
    recoveryPctPerMinute: 3.1,
    socialCapacity: 5,
    cost: 0,
    unlockText: 'Clear GRPD Station -- Division St.',
  },
];

export const RECOVERY_FACILITIES_BY_ID: Record<string, RecoveryFacilityDef> =
  Object.fromEntries(RECOVERY_FACILITIES.map((facility) => [facility.id, facility]));

export const RECOVERY_HUTS: RecoveryHutDef[] = [
  {
    id: 'monroe-backroom',
    name: 'Monroe Backroom',
    areaId: 'monroe-strip',
    description: 'A tiny upstairs room above the variety store. The kettle still works.',
    facility: 'tub',
    unlock: { kind: 'clearArea', areaId: 'monroe-strip' },
  },
  {
    id: 'fulton-fireescape',
    name: 'Fulton Fire Escape',
    areaId: 'back-alley',
    description: 'A folded camp cot behind a locked service door, overlooking the alley.',
    facility: 'shower',
    unlock: { kind: 'clearArea', areaId: 'back-alley' },
  },
  {
    id: 'river-watch',
    name: 'River Watch Hut',
    areaId: 'riverfront',
    description: 'A floodwall maintenance hut with a working sink and a view of the water.',
    facility: 'hot-tub',
    unlock: { kind: 'clearArea', areaId: 'riverfront' },
  },
  {
    id: 'market-loft',
    name: 'Market Loft',
    areaId: 'old-market',
    description: 'A shuttered vendor loft above the market hall. The old bell keeps time with the pipes.',
    facility: 'shower',
    unlock: { kind: 'clearArea', areaId: 'old-market' },
  },
  {
    id: 'northline-cabin',
    name: 'Northline Cabin',
    areaId: 'northline-yard',
    description: 'A rail switch cabin with a cot, a hot plate, and a window full of empty tracks.',
    facility: 'hot-tub',
    unlock: { kind: 'clearArea', areaId: 'northline-yard' },
  },
  {
    id: 'grpd-swat-sauna',
    name: 'SWAT Sauna',
    areaId: 'grpd-station-division',
    description: 'The department left the sauna running. Nobody who works here now is going to be the one to shut it off.',
    facility: 'swat-sauna',
    unlock: { kind: 'clearArea', areaId: 'grpd-station-division' },
  },
];

/**
 * Rewards for the SWAT Sauna's "reach through the hole" hub action
 * (`claimSaunaHoleReward` in `state/metaStore.tsx`). Grants the weapon for
 * exactly the player's next run, cleared once that run ends -- see
 * `MetaState.pendingSaunaReward`. Deliberately a small, extensible table:
 * one entry today, more to come later per the user's own framing.
 */
export interface SaunaHoleRewardDef {
  weaponId: string;
}

export const SAUNA_HOLE_REWARDS: SaunaHoleRewardDef[] = [
  { weaponId: 'baton' },
];
