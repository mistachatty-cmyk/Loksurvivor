import type { DistrictIncursionDef } from '@/game/types';

/**
 * Optional landmark setpieces for the four most authored districts. A run
 * rolls whether one fires, so replaying a district keeps its ordinary loop
 * intact instead of making the same interruption mandatory every time.
 */
export const DISTRICT_INCURSIONS: DistrictIncursionDef[] = [
  {
    id: 'floodwall-surge',
    areaId: 'riverfront',
    kind: 'flood-surge',
    title: 'Floodwall Surge',
    landmark: 'The Floodgate',
    warningText: 'THE RIVER IS RISING — find the lit lane',
    activeText: 'SURGE INBOUND — lanes are shifting',
    objectiveLabel: 'Hold the safe lane',
    completeText: 'Floodwall held — the gate gives up a cache',
    failureText: 'The surge passed — the floodwall cache washed out',
    triggerAtSec: 42,
    warningLeadSec: 4,
    durationSec: 22,
    target: 15,
    rewardCred: 55,
    rewardTokens: 1,
    accent: '#35d0bb',
  },
  {
    id: 'market-bell',
    areaId: 'old-market',
    kind: 'market-bell',
    title: 'Bell of the Aisle',
    landmark: 'Market Bell',
    warningText: 'THE MARKET BELL IS TIGHTENING THE CROWD',
    activeText: 'RING THE CROWD DOWN — break the aisle rush',
    objectiveLabel: 'Break the hostile crowd',
    completeText: 'Market quiet — the bell drops a token',
    failureText: 'The aisles swallowed the bell’s signal',
    triggerAtSec: 58,
    warningLeadSec: 4,
    durationSec: 24,
    target: 10,
    rewardCred: 65,
    rewardTokens: 1,
    accent: '#f4b942',
  },
  {
    id: 'freight-arrival',
    areaId: 'northline-yard',
    kind: 'freight-arrival',
    title: 'Midnight Freight',
    landmark: 'Northline Switch',
    warningText: 'SIGNAL CHANGE — freight is coming through',
    activeText: 'FREIGHT ARRIVAL — use the cars as moving cover',
    objectiveLabel: 'Stay with moving cover',
    completeText: 'Freight cleared — the switch box opens',
    failureText: 'The freight rolled through before the switch was secured',
    triggerAtSec: 66,
    warningLeadSec: 4,
    durationSec: 26,
    target: 14,
    rewardCred: 70,
    rewardTokens: 1,
    accent: '#f26b5e',
  },
  {
    id: 'fountain-ritual',
    areaId: 'civic-plaza',
    kind: 'fountain-ritual',
    title: 'Fountain Ritual',
    landmark: 'Civic Fountain',
    warningText: 'THE DRY FOUNTAIN IS REARRANGING THE PLAZA',
    activeText: 'RITUAL ACTIVE — follow the lit quarter',
    objectiveLabel: 'Hold the safe quarter',
    completeText: 'Civic water runs clear — the plaza pays out',
    failureText: 'The fountain sealed before the pattern was completed',
    triggerAtSec: 74,
    warningLeadSec: 4,
    durationSec: 25,
    target: 17,
    rewardCred: 80,
    rewardTokens: 2,
    accent: '#b58cff',
  },
];

export const DISTRICT_INCURSIONS_BY_ID: Record<string, DistrictIncursionDef> = Object.fromEntries(
  DISTRICT_INCURSIONS.map((incursion) => [incursion.id, incursion]),
);

const INCURSIONS_BY_AREA: Record<string, DistrictIncursionDef[]> = DISTRICT_INCURSIONS.reduce<
  Record<string, DistrictIncursionDef[]>
>((groups, incursion) => {
  (groups[incursion.areaId] ??= []).push(incursion);
  return groups;
}, {});

/** Resolve a forced test/dev choice or roll an optional district encounter. */
export function chooseDistrictIncursion(
  areaId: string,
  rng: () => number,
  forcedId?: string,
): DistrictIncursionDef | undefined {
  const candidates = INCURSIONS_BY_AREA[areaId] ?? [];
  if (forcedId) {
    return candidates.find((incursion) => incursion.id === forcedId);
  }
  if (candidates.length === 0 || rng() >= 0.68) return undefined;
  return candidates[Math.floor(rng() * candidates.length)];
}