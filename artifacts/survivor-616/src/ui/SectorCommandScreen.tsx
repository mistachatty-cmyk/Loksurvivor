/**
 * Sector Command — the playable campaign shell.
 *
 * Mission list on the left, briefing + a live render of the mission's authored
 * map on the right. Gating is deliberately double: a mission needs both its
 * prerequisite missions cleared *and* its commander ally actually rescued, so
 * the campaign consumes base-game progression instead of running beside it.
 */

import { ArrowLeft, Check, Lock, Radio } from 'lucide-react';
import { useState } from 'react';

import { FACTIONS_BY_ID } from '@/game/data/factions';
import { ALLIES_BY_ID } from '@/game/data/progression';
import { SECTOR_MAPS_BY_ID } from '@/game/data/sectorMaps';
import { SECTOR_MISSIONS } from '@/game/data/sectorMissions';
import { useMeta } from '@/game/state/metaStore';
import type { SectorMissionDef } from '@/game/types';
import { MapLivePreview } from './MapLivePreview';

interface SectorCommandScreenProps {
  onBack: () => void;
  onLaunch: (missionId: string) => void;
}

/** Why a mission can't be played yet, or null when it can. */
function lockReason(
  mission: SectorMissionDef,
  completedIds: string[],
  rescuedAllyIds: string[],
): string | null {
  for (const requiredId of mission.requiresMissionIds ?? []) {
    if (!completedIds.includes(requiredId)) {
      const required = SECTOR_MISSIONS.find((entry) => entry.id === requiredId);
      return `Clear ${required?.name ?? requiredId} first`;
    }
  }
  if (!rescuedAllyIds.includes(mission.commanderAllyId)) {
    return `Rescue ${ALLIES_BY_ID[mission.commanderAllyId]?.name ?? mission.commanderAllyId} first`;
  }
  return null;
}

export function SectorCommandScreen({ onBack, onLaunch }: SectorCommandScreenProps) {
  const { meta } = useMeta();
  const [selectedId, setSelectedId] = useState(SECTOR_MISSIONS[0]?.id ?? '');
  const selected = SECTOR_MISSIONS.find((mission) => mission.id === selectedId) ?? SECTOR_MISSIONS[0];
  const selectedMap = selected ? SECTOR_MAPS_BY_ID[selected.mapId] : undefined;
  const selectedLock = selected
    ? lockReason(selected, meta.completedSectorMissionIds, meta.rescuedAllyIds)
    : 'No missions authored';

  return (
    <div className="min-h-dvh bg-[#050a12] p-3 text-white" data-testid="screen-sector-command">
      <header className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 items-center gap-1 border border-white/20 bg-black/50 px-2 font-mono text-[10px] uppercase tracking-wider text-white/75"
          data-testid="button-sector-back"
        >
          <ArrowLeft size={12} /> Hideout
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-mono text-sm uppercase tracking-[0.25em] text-amber-300">Sector Command</h1>
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">
            Dev build · stolen-army campaign
          </p>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <ul className="space-y-1.5" data-testid="sector-mission-list">
          {SECTOR_MISSIONS.map((mission) => {
            const locked = lockReason(mission, meta.completedSectorMissionIds, meta.rescuedAllyIds);
            const cleared = meta.completedSectorMissionIds.includes(mission.id);
            return (
              <li key={mission.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(mission.id)}
                  className={`w-full border p-2 text-left font-mono ${
                    mission.id === selectedId
                      ? 'border-amber-300/70 bg-amber-300/10'
                      : 'border-white/15 bg-black/40'
                  }`}
                  data-testid={`button-mission-${mission.id}`}
                >
                  <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    {cleared ? <Check size={11} className="text-emerald-300" /> : locked ? <Lock size={11} className="text-white/40" /> : <Radio size={11} className="text-amber-300" />}
                    <span className="truncate">{mission.name}</span>
                  </span>
                  <span className="mt-0.5 block text-[9px] uppercase tracking-wider text-white/45">
                    {FACTIONS_BY_ID[mission.factionId]?.name ?? mission.factionId} · squad {mission.squadCap}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected ? (
          <section className="border border-white/15 bg-black/40 p-3" data-testid="sector-briefing">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-amber-200">{selected.name}</h2>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-white/45">
              Commander {ALLIES_BY_ID[selected.commanderAllyId]?.name ?? selected.commanderAllyId} ·{' '}
              {Math.round(selected.durationSec / 60)} min · {selected.economyTier} economy
              {selected.fogOfWar ? ' · blackout' : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {selected.economyTier === 'beacon' ? (
                <span className="border border-amber-300/45 px-1 py-px font-mono text-[8px] uppercase tracking-wider text-amber-200">
                  Beacons rebuild your squad
                </span>
              ) : (
                <span className="border border-white/25 px-1 py-px font-mono text-[8px] uppercase tracking-wider text-white/55">
                  Stolen army — no reinforcements
                </span>
              )}
              {selected.fogOfWar ? (
                <span className="border border-cyan-300/45 px-1 py-px font-mono text-[8px] uppercase tracking-wider text-cyan-200">
                  Fog — units scout for you
                </span>
              ) : null}
            </div>

            {selectedMap ? (
              <div className="relative mt-2 h-44 overflow-hidden border border-white/10 sm:h-56">
                <MapLivePreview map={selectedMap} />
              </div>
            ) : null}

            <p className="mt-2 text-[11px] leading-relaxed text-white/75">{selected.briefing}</p>

            <ul className="mt-2 space-y-0.5 font-mono text-[10px] uppercase tracking-wider text-white/70">
              {selected.objectives.map((objective) => (
                <li key={objective.id}>
                  · {objective.label}
                  {objective.optional ? ' (optional)' : ''}
                </li>
              ))}
            </ul>

            <p className="mt-2 font-mono text-[9px] leading-relaxed text-white/40">
              Command mode swaps the pointer: drag to marquee your captured units, tap to order
              them. Capture takes a weakened enemy in reach. Units have no pathfinding — they
              walk straight and slide along walls, so keep orders short.
            </p>

            <button
              type="button"
              disabled={Boolean(selectedLock)}
              onClick={() => onLaunch(selected.id)}
              className="mt-3 h-10 w-full border-2 border-amber-300/60 bg-amber-300/15 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100 disabled:border-white/15 disabled:bg-black/40 disabled:text-white/35"
              data-testid="button-launch-mission"
            >
              {selectedLock ?? 'Deploy'}
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default SectorCommandScreen;
