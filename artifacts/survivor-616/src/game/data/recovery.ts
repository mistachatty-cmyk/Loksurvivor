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
    description: 'A rail signal cabin with a cot, a hot plate, and a window full of empty tracks.',
    facility: 'hot-tub',
    unlock: { kind: 'clearArea', areaId: 'northline-yard' },
  },
];