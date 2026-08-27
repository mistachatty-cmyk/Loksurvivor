import { ALLIES_BY_ID } from '@/game/data/progression';
import type { CrewActivityDef, CrewActivityId, MetaState } from '@/game/types';

export const CREW_ACTIVITIES: CrewActivityDef[] = [
  {
    id: 'field-rations',
    roomId: 'main-floor',
    name: 'Pack field rations',
    description: 'A warm meal and something wrapped for later. Nobody heads out hungry.',
    benefitLabel: '+18 max HP',
    icon: 'utensils',
    effects: [{ stat: 'maxHp', add: 18 }],
  },
  {
    id: 'fortify-doors',
    roomId: 'main-floor',
    name: 'Fortify the doors',
    description: 'The crew adds another latch, another warning bell, and one more reason to keep moving.',
    benefitLabel: '+2.5% armor',
    icon: 'shield',
    effects: [{ stat: 'armor', add: 0.025 }],
  },
  {
    id: 'sort-supplies',
    roomId: 'main-floor',
    name: 'Sort the supplies',
    description: 'Every useful thing gets a place where a hand can find it in the dark.',
    benefitLabel: '+10 pickup range',
    icon: 'package',
    effects: [{ stat: 'magnet', add: 10 }],
  },
  {
    id: 'scout-routes',
    roomId: 'rooftop-perch',
    name: 'Scout the routes',
    description: 'A long look across the rooftops turns tomorrow’s escape into muscle memory.',
    benefitLabel: '+7 move speed',
    icon: 'compass',
    effects: [{ stat: 'speed', add: 7 }],
  },
  {
    id: 'mark-approach-lanes',
    roomId: 'rooftop-perch',
    name: 'Mark approach lanes',
    description: 'Fresh paint makes the safest lines through the city impossible to miss.',
    benefitLabel: '+10% area',
    icon: 'map',
    effects: [{ stat: 'area', mult: 1.1 }],
  },
  {
    id: 'tune-the-rig',
    roomId: 'the-cellar',
    name: 'Tune the rig',
    description: 'Sable finds the frequency where every weapon answers a little faster.',
    benefitLabel: '6% faster cooldowns',
    icon: 'radio',
    effects: [{ stat: 'haste', mult: 0.94 }],
  },
  {
    id: 'study-anomalies',
    roomId: 'the-cellar',
    name: 'Study the anomalies',
    description: 'Lantern light, strange records, and a theory about why the city keeps changing shape.',
    benefitLabel: '+8% damage',
    icon: 'sparkles',
    effects: [{ stat: 'power', mult: 1.08 }],
  },
];

export const CREW_ACTIVITIES_BY_ID: Record<CrewActivityId, CrewActivityDef> =
  Object.fromEntries(CREW_ACTIVITIES.map((activity) => [activity.id, activity])) as Record<
    CrewActivityId,
    CrewActivityDef
  >;

export function preferredActivitiesForAlly(allyId: string): CrewActivityDef[] {
  const ally = ALLIES_BY_ID[allyId];
  if (!ally) return [];
  return ally.preferredActivityIds
    .map((activityId) => CREW_ACTIVITIES_BY_ID[activityId])
    .filter((activity): activity is CrewActivityDef => Boolean(activity && activity.roomId === ally.room));
}

export function isValidCrewActivity(allyId: string, activityId: unknown): activityId is CrewActivityId {
  return typeof activityId === 'string' &&
    preferredActivitiesForAlly(allyId).some((activity) => activity.id === activityId);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Crew choices are random-looking but seeded so a save reload never changes
 * anyone's choice. The seed advances only when the player returns to the hub.
 */
export function rollCrewActivities(allyIds: string[], seed: number): Record<string, CrewActivityId> {
  const assignments: Record<string, CrewActivityId> = {};
  allyIds.forEach((allyId, index) => {
    const options = preferredActivitiesForAlly(allyId);
    if (options.length === 0) return;
    assignments[allyId] = options[stableHash(`${seed}:${allyId}:${index}`) % options.length].id;
  });
  return assignments;
}

export function normalizeCrewActivities(
  value: unknown,
  rescuedAllyIds: string[],
  seed: number,
): Record<string, CrewActivityId> {
  const parsed = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rolled = rollCrewActivities(rescuedAllyIds, seed);
  const assignments: Record<string, CrewActivityId> = {};
  for (const allyId of rescuedAllyIds) {
    assignments[allyId] = isValidCrewActivity(allyId, parsed[allyId])
      ? parsed[allyId]
      : rolled[allyId];
  }
  return assignments;
}

export function crewActivityEffects(meta: MetaState) {
  const effects = [];
  for (const allyId of meta.rescuedAllyIds) {
    const activityId = meta.crewActivityByAlly[allyId];
    if (!isValidCrewActivity(allyId, activityId)) continue;
    const activity = CREW_ACTIVITIES_BY_ID[activityId];
    effects.push(...activity.effects);
  }
  return effects;
}