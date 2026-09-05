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

  /**
   * Second wave -- fills in the two rooms (the-alley, the-storefront) that
   * previously had zero activities, so any ally living there has real
   * rotation options, plus a few more per already-populated room for
   * variety. Mixes music/life flavor per the crew feature's brief; every
   * BaseStats field is now touched by at least one activity, including
   * crit/lifesteal, which nothing here used before.
   */
  {
    id: 'spin-the-jukebox',
    roomId: 'main-floor',
    name: 'Spin the jukebox',
    description: 'Somebody always has the next record queued up before the last one ends.',
    benefitLabel: '+3% crit',
    icon: 'music',
    effects: [{ stat: 'crit', add: 0.03 }],
  },
  {
    id: 'polish-the-bar',
    roomId: 'main-floor',
    name: 'Polish the bar top',
    description: 'A clean counter and a level head. Everything downstream moves a little smoother.',
    benefitLabel: '4% faster cooldowns',
    icon: 'droplet',
    effects: [{ stat: 'haste', mult: 0.96 }],
  },
  {
    id: 'count-the-register',
    roomId: 'main-floor',
    name: 'Count the till',
    description: 'Knowing exactly what is worth grabbing out there starts with knowing what is worth in here.',
    benefitLabel: '+14 pickup range',
    icon: 'coffee',
    effects: [{ stat: 'magnet', add: 14 }],
  },
  {
    id: 'trade-war-stories',
    roomId: 'rooftop-perch',
    name: 'Trade war stories',
    description: 'Everyone up here survived something. Comparing notes keeps the next close call a little less close.',
    benefitLabel: '+1.2% lifesteal',
    icon: 'heart',
    effects: [{ stat: 'lifesteal', add: 0.012 }],
  },
  {
    id: 'watch-the-skyline',
    roomId: 'rooftop-perch',
    name: 'Watch the skyline',
    description: 'A long exposure catches the exact instant a fight turns. Worth remembering.',
    benefitLabel: '+2.5% crit',
    icon: 'camera',
    effects: [{ stat: 'crit', add: 0.025 }],
  },
  {
    id: 'stretch-before-dawn',
    roomId: 'rooftop-perch',
    name: 'Stretch before dawn',
    description: 'The cold air off the roof is the best reason anyone has found to actually warm up first.',
    benefitLabel: '+6 move speed',
    icon: 'sunrise',
    effects: [{ stat: 'speed', add: 6 }],
  },
  {
    id: 'press-new-records',
    roomId: 'the-cellar',
    name: 'Press new records',
    description: 'A fresh cut on cheap vinyl, mixed loud enough to rattle the glass growths on the wall.',
    benefitLabel: '+5% damage',
    icon: 'disc',
    effects: [{ stat: 'power', mult: 1.05 }],
  },
  {
    id: 'brew-something-strong',
    roomId: 'the-cellar',
    name: 'Brew something strong',
    description: 'Nobody asks what is in it. Everyone feels better after.',
    benefitLabel: '+1.5% lifesteal',
    icon: 'flame',
    effects: [{ stat: 'lifesteal', add: 0.015 }],
  },
  {
    id: 'catalog-the-vinyl',
    roomId: 'the-cellar',
    name: 'Catalog the vinyl',
    description: 'Every sleeve gets a place on the wall and a note about who pressed it and why.',
    benefitLabel: '+12 pickup range',
    icon: 'book',
    effects: [{ stat: 'magnet', add: 12 }],
  },
  {
    id: 'weld-a-brace',
    roomId: 'the-alley',
    name: 'Weld a brace',
    description: 'A reinforced strut here, a patched panel there. The whole annex is sturdier for it.',
    benefitLabel: '+3% armor',
    icon: 'wrench',
    effects: [{ stat: 'armor', add: 0.03 }],
  },
  {
    id: 'sharpen-the-edges',
    roomId: 'the-alley',
    name: 'Sharpen the edges',
    description: 'A whetstone, a workbench light, and every blade in the crew comes back meaner.',
    benefitLabel: '+6% damage',
    icon: 'zap',
    effects: [{ stat: 'power', mult: 1.06 }],
  },
  {
    id: 'run-the-numbers',
    roomId: 'the-alley',
    name: 'Run the numbers',
    description: 'Every recipe on the workbench gets checked twice before it goes anywhere near a weapon.',
    benefitLabel: '5% faster cooldowns',
    icon: 'calculator',
    effects: [{ stat: 'haste', mult: 0.95 }],
  },
  {
    id: 'paint-a-mural',
    roomId: 'the-alley',
    name: 'Paint a mural',
    description: 'The propped-open service door gets a new coat, and somehow the whole block reads a little bigger.',
    benefitLabel: '+8% area',
    icon: 'paintbrush',
    effects: [{ stat: 'area', mult: 1.08 }],
  },
  {
    id: 'file-the-ledgers',
    roomId: 'the-storefront',
    name: 'File the ledgers',
    description: 'Every name in the neighborhood, cross-referenced against who still needs to be found.',
    benefitLabel: '+10 pickup range',
    icon: 'scroll',
    effects: [{ stat: 'magnet', add: 10 }],
  },
  {
    id: 'walk-the-block',
    roomId: 'the-storefront',
    name: 'Walk the block',
    description: 'Knowing every storefront by its shutter and every shortcut by its smell.',
    benefitLabel: '+8 move speed',
    icon: 'footprints',
    effects: [{ stat: 'speed', add: 8 }],
  },
  {
    id: 'keep-the-lookbook',
    roomId: 'the-storefront',
    name: 'Keep the lookbook',
    description: 'A record of every face that has come through, and exactly what got them out alive.',
    benefitLabel: '+2% crit',
    icon: 'book-open',
    effects: [{ stat: 'crit', add: 0.02 }],
  },
  {
    id: 'mind-the-register',
    roomId: 'the-storefront',
    name: 'Mind the register',
    description: 'The old counter still locks. Nobody has tested whether that matters, and nobody wants to.',
    benefitLabel: '+2% armor',
    icon: 'shopping-bag',
    effects: [{ stat: 'armor', add: 0.02 }],
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