import type { SectorMissionDef } from '@/game/types';
import { ALLIES_BY_ID } from './progression';
import { FACTIONS_BY_ID } from './factions';
import { SECTOR_MAPS_BY_ID } from './sectorMaps';

/**
 * The Sector Command campaign.
 *
 * Two rules make this a campaign for *this* game rather than a generic RTS
 * bolted on:
 *
 * 1. Every mission is fought against a registered `FactionDef`, so campaign
 *    content and survivor content describe the same world.
 * 2. Every mission is led by an ally you actually rescued
 *    (`commanderAllyId`). The campaign consumes base-game progression -- you
 *    cannot command a crew you never pulled off the street.
 *
 * The `mission()` factory throws at module load on an unknown faction, ally,
 * or map, and on an objective pointing at a marker the map doesn't contain --
 * the same authoring guardrail `episodes.ts` uses, which is the reason bad
 * content fails at boot instead of mid-run.
 */
const mission = (def: SectorMissionDef): SectorMissionDef => {
  if (!FACTIONS_BY_ID[def.factionId]) {
    throw new Error(`Mission ${def.id} references unknown faction: ${def.factionId}`);
  }
  if (!ALLIES_BY_ID[def.commanderAllyId]) {
    throw new Error(`Mission ${def.id} references unknown ally: ${def.commanderAllyId}`);
  }
  const map = SECTOR_MAPS_BY_ID[def.mapId];
  if (!map) {
    throw new Error(`Mission ${def.id} references unknown map: ${def.mapId}`);
  }
  for (const objective of def.objectives) {
    if (!objective.markerAssetId) continue;
    const hasMarker = map.placements.some(
      (placement) => placement.category === 'objective-marker' && placement.assetId === objective.markerAssetId,
    );
    if (!hasMarker) {
      throw new Error(`Mission ${def.id} objective ${objective.id} wants ${objective.markerAssetId}, which ${def.mapId} does not place`);
    }
  }
  if (def.objectives.every((objective) => objective.optional)) {
    throw new Error(`Mission ${def.id} has no required objective`);
  }
  return def;
};

export const SECTOR_MISSIONS: SectorMissionDef[] = [
  mission({
    id: 'sector-hold-the-dock',
    name: 'Hold the Dock',
    factionId: 'afterimage-choir',
    commanderAllyId: 'vee',
    mapId: 'sector-map-loading-dock',
    economyTier: 'stolen',
    durationSec: 240,
    squadCap: 6,
    briefing:
      'Vee knows which alley connects to which, and every one of them ends at this dock. The Choir has started using it after midnight. Take the bay, keep it, and take a few of theirs while you are at it.',
    debrief:
      'The dock holds. Vee marks the route as ours and starts listing what else moves through it.',
    objectives: [
      { id: 'dock-hold', label: 'Hold the loading bay for 60s', kind: 'hold-marker', targetCount: 60, markerAssetId: 'objective-marker:hold' },
      { id: 'dock-capture', label: 'Turn 3 of theirs', kind: 'capture-units', targetCount: 3 },
      { id: 'dock-clean', label: 'Bonus: down 25 without losing a unit', kind: 'kill-any', targetCount: 25, optional: true },
    ],
    beats: [
      { id: 'dock-open', trigger: { kind: 'at-sec', sec: 4 }, line: 'Vee: "Two lanes in. They will not use both at once — they never do."', speakerAllyId: 'vee' },
      { id: 'dock-first-turn', trigger: { kind: 'objective-complete', objectiveId: 'dock-capture' }, line: 'Vee: "That is three of theirs walking for us. They have noticed."', speakerAllyId: 'vee' },
      { id: 'dock-wipe', trigger: { kind: 'squad-wiped' }, line: 'Vee: "Squad is gone. Take more of theirs — the street is still full of them."', speakerAllyId: 'vee' },
    ],
    unlock: { kind: 'clearArea', areaId: 'old-market' },
  }),
  mission({
    id: 'sector-cut-the-substation',
    name: 'Cut the Substation',
    factionId: 'null-sector',
    commanderAllyId: 'sable',
    mapId: 'sector-map-null-substation',
    economyTier: 'stolen',
    durationSec: 300,
    squadCap: 8,
    briefing:
      'Sable traced the hum. Three racks under the substation are still feeding the signal, and none of them are plugged into anything. Break all three. You will not be able to cover them all at once, so take a squad that can.',
    debrief:
      'The hum stops. Sable does not look relieved about it, which is its own kind of report.',
    objectives: [
      { id: 'substation-racks', label: 'Break all 3 racks', kind: 'destroy-marker', targetCount: 3, markerAssetId: 'objective-marker:destroy' },
      { id: 'substation-survive', label: 'Survive 180s', kind: 'survive-sec', targetCount: 180 },
      { id: 'substation-brute', label: 'Bonus: turn a Firewall Brute', kind: 'capture-units', targetCount: 1, optional: true },
    ],
    beats: [
      { id: 'substation-open', trigger: { kind: 'at-sec', sec: 5 }, line: 'Sable: "Three racks, three directions. Split or lose."', speakerAllyId: 'sable' },
      { id: 'substation-push', trigger: { kind: 'objective-complete', objectiveId: 'substation-racks' }, line: 'Sable: "Signal is dropping. Whatever is left down here knows it was you."', speakerAllyId: 'sable' },
    ],
    unlock: { kind: 'clearArea', areaId: 'null-sector' },
    requiresMissionIds: ['sector-hold-the-dock'],
  }),
  mission({
    id: 'sector-relay-extraction',
    name: 'Relay Extraction',
    factionId: 'cabinet-rot',
    commanderAllyId: 'nyx',
    mapId: 'sector-map-rooftop-relay',
    economyTier: 'stolen',
    durationSec: 270,
    squadCap: 8,
    briefing:
      'Nyx knows every fire escape by feel, and the one at the far end of this roofline is the only way down that Cabinet Rot has not found yet. Walk the relay line, keep your squad alive across it, and get to the far side.',
    debrief:
      'Nyx tags the stairwell on the way out. The route is ours until somebody buffs it.',
    objectives: [
      { id: 'relay-walk', label: 'Reach the extraction', kind: 'reach-marker', targetCount: 1, markerAssetId: 'objective-marker:extract' },
      { id: 'relay-waypoints', label: 'Clear both escort waypoints', kind: 'hold-marker', targetCount: 20, markerAssetId: 'objective-marker:escort' },
      { id: 'relay-toll', label: 'Bonus: reach it with 4+ units alive', kind: 'capture-units', targetCount: 4, optional: true },
    ],
    beats: [
      { id: 'relay-open', trigger: { kind: 'at-sec', sec: 4 }, line: 'Nyx: "Long roof. Nothing to hide behind. Keep them moving."', speakerAllyId: 'nyx' },
      { id: 'relay-halfway', trigger: { kind: 'objective-complete', objectiveId: 'relay-waypoints' }, line: 'Nyx: "Halfway. They are coming up both stairwells now."', speakerAllyId: 'nyx' },
    ],
    unlock: { kind: 'clearArea', areaId: 'neon-arcade' },
    requiresMissionIds: ['sector-cut-the-substation'],
  }),
];

export const SECTOR_MISSIONS_BY_ID: Record<string, SectorMissionDef> = Object.fromEntries(
  SECTOR_MISSIONS.map((entry) => [entry.id, entry]),
);

export function getSectorMission(id: string): SectorMissionDef {
  const found = SECTOR_MISSIONS_BY_ID[id];
  if (!found) throw new Error(`Unknown sector mission id: ${id}`);
  return found;
}
