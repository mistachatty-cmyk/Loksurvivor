import { ALLIES_BY_ID } from '@/game/data/progression';
import type {
  ActiveCrewRumor,
  CrewActivityId,
  CrewRumorDef,
  CrewRumorId,
} from '@/game/types';

export const CREW_RUMORS: CrewRumorDef[] = [
  {
    id: 'bell-shock',
    name: 'Bell Shock',
    icon: 'bell',
    accent: '#fbbf24',
    activityAffinities: ['fortify-doors'],
    story: 'Someone heard the old warning bell ring under the floorboards. It only rings when the first thing gets too close.',
    effectLabel: 'First dangerous contact releases a defensive pulse',
    effectDescription: 'The first enemy contact each run shoves nearby threats away without dealing damage.',
  },
  {
    id: 'painted-shortcut',
    name: 'Painted Shortcut',
    icon: 'spray-can',
    accent: '#f472b6',
    activityAffinities: ['scout-routes', 'mark-approach-lanes'],
    story: 'Fresh paint marks a route through the city that was not there yesterday. Follow it before the block changes its mind.',
    effectLabel: 'Start with a short movement-speed burst',
    effectDescription: 'Movement speed is boosted for the opening seconds of the next run.',
  },
  {
    id: 'pantry-surge',
    name: 'Pantry Surge',
    icon: 'utensils',
    accent: '#86efac',
    activityAffinities: ['field-rations', 'sort-supplies'],
    story: 'A tin of emergency sugar turns up behind the flour. It is labeled for the first bad night, not the last.',
    effectLabel: 'First level-up offers an emergency heal',
    effectDescription: 'The first level-up includes a one-time heal alongside the normal upgrade choices.',
  },
  {
    id: 'basement-broadcast',
    name: 'Basement Broadcast',
    icon: 'radio',
    accent: '#67e8f9',
    activityAffinities: ['tune-the-rig', 'study-anomalies'],
    story: 'The basement radio catches a voice from a room that no longer exists. It names the first serious threat before it arrives.',
    effectLabel: 'Announce the first elite arrival early',
    effectDescription: 'The first elite or boss arrival gets a clear warning in the HUD before it reaches the player.',
  },
  {
    id: 'magnet-parade',
    name: 'Magnet Parade',
    icon: 'magnet',
    accent: '#c4b5fd',
    activityAffinities: ['sort-supplies', 'scout-routes'],
    story: 'Loose change walks across the table in a neat little parade. The city is willing to hand over what it owes you.',
    effectLabel: 'Periodic pulses pull nearby pickups',
    effectDescription: 'Every few seconds, a pulse draws nearby experience and cred toward the operative.',
  },
];

export const CREW_RUMORS_BY_ID: Record<CrewRumorId, CrewRumorDef> = Object.fromEntries(
  CREW_RUMORS.map((rumor) => [rumor.id, rumor]),
) as Record<CrewRumorId, CrewRumorDef>;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getCrewRumor(id: string | undefined): CrewRumorDef | undefined {
  return id && id in CREW_RUMORS_BY_ID
    ? CREW_RUMORS_BY_ID[id as CrewRumorId]
    : undefined;
}

export function rollCrewRumor(
  rescuedAllyIds: string[],
  activities: Record<string, CrewActivityId>,
  seed: number,
): ActiveCrewRumor | null {
  for (const allyId of rescuedAllyIds) {
    const ally = ALLIES_BY_ID[allyId];
    if (!ally) continue;
    const activityId = activities[allyId];
    const candidates = CREW_RUMORS.filter((rumor) =>
      activityId ? rumor.activityAffinities.includes(activityId) : false,
    );
    if (candidates.length === 0) continue;
    const rumor = candidates[stableHash(`${seed}:${allyId}:${activityId}`) % candidates.length]!;
    return { rumorId: rumor.id, allyId, generatedAtSeed: seed };
  }
  return null;
}

export function normalizeActiveCrewRumor(
  value: unknown,
  rescuedAllyIds: string[],
  activities: Record<string, CrewActivityId>,
  seed: number,
): ActiveCrewRumor | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ActiveCrewRumor>;
  if (
    typeof candidate.rumorId !== 'string' ||
    !getCrewRumor(candidate.rumorId) ||
    typeof candidate.allyId !== 'string' ||
    !rescuedAllyIds.includes(candidate.allyId) ||
    typeof candidate.generatedAtSeed !== 'number' ||
    !Number.isFinite(candidate.generatedAtSeed)
  ) {
    return null;
  }

  const activityId = activities[candidate.allyId];
  const rumor = getCrewRumor(candidate.rumorId);
  if (!activityId || !rumor?.activityAffinities.includes(activityId)) return null;
  return {
    rumorId: rumor.id,
    allyId: candidate.allyId,
    generatedAtSeed: Math.max(0, Math.floor(candidate.generatedAtSeed)),
  };
}