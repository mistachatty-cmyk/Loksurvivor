import { useMemo, useState } from 'react';
import { Award, CheckCircle2, ChevronRight, Dumbbell, Lock, RadioTower, RotateCcw, Shield, Sparkles, Swords } from 'lucide-react';

import { allDigiTowerFloors, getDigiTowerFloor, isDigiTowerSectorUnlocked, type DigiTowerFloorDef } from '@/game/data/digiTower';
import { endgameReached, mapsCleared } from '@/game/data/endgameUnlocks';
import { lokPetTrainingAllowance, lokPetUnspentTrainingPoints, LOKPET_TRAINING_STATS, TRAINING_DATA_RESPEC_COST } from '@/game/engine/petTraining';
import { useMeta } from '@/game/state/metaStore';
import type { LokPetTrainingStat } from '@/game/types';

interface DigiTowerPanelProps {
  onLaunchFloor: (floor: DigiTowerFloorDef, practice?: boolean) => void;
}

const KIND_LABEL: Record<DigiTowerFloorDef['kind'], string> = {
  random: 'Signal encounter', planned: 'Story trial', faction: 'Faction floor', rest: 'Rest / vault', mirror: 'Mirror match', master: 'Digi-Master',
};

export function DigiTowerPanel({ onLaunchFloor }: DigiTowerPanelProps) {
  const { meta, claimDigiTowerRest, trainLokPetAtTower, respecLokPetAtTower, buyDigiTowerSupply } = useMeta();
  const [selectedTrainingPetId, setSelectedTrainingPetId] = useState('');
  const progress = meta.digiTower;
  const floors = useMemo(() => allDigiTowerFloors(), []);
  const unlocked = meta.savedLokPets.length > 0 && (meta.lokPetBattleWins > 0 || meta.devModeAllUnlocks);
  const towerEndgame = endgameReached(meta);
  const current = progress.nextFloor <= 100 ? getDigiTowerFloor(progress.nextFloor) : null;
  const currentSectorOpen = current ? isDigiTowerSectorUnlocked(current.sector, progress.defeatedMasterIds, towerEndgame) : false;
  const unlockedMasterCount = progress.defeatedMasterIds.length;
  const currentSectorFloor = current?.sectorFloor ?? 10;
  const trainingPet = meta.savedLokPets.find((pet) => pet.id === selectedTrainingPetId) ?? meta.savedLokPets[0];
  const restUnclaimed = current?.kind === 'rest' && !progress.claimedRestFloorIds.includes(`tower-floor-${current.floor}`);

  return (
    <div className="space-y-5" data-testid="panel-digi-tower">
      <section className="relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,.14),transparent_50%),linear-gradient(135deg,#071521,#101127_70%)] p-5 sm:p-7">
        <div className="absolute -right-8 -top-12 opacity-[.07]"><RadioTower className="h-48 w-48" /></div>
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,.8fr)]">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[.35em] text-cyan-200/70">10 sectors · 100 floors · one climb</p>
            <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white">The DIGI-Tower</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-cyan-50/75">
              A turn-based expedition for your saved LokPets. Faction teams, planned trials and mirror fights lead to a different Digi-Master on every tenth floor. Carry your team’s condition between wins; a full party wipe sends you back to the last five-floor checkpoint.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="border border-cyan-200/20 bg-black/20 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-cyan-100"><Swords className="mr-1 inline h-3 w-3" />Roguelite pet battles</span>
              <span className="border border-cyan-200/20 bg-black/20 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-cyan-100"><Shield className="mr-1 inline h-3 w-3" />Checkpoint recovery</span>
              <span className="border border-cyan-200/20 bg-black/20 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-cyan-100"><Award className="mr-1 inline h-3 w-3" />Master seals & Tower Tokens</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 self-start">
            <Stat label="Highest floor" value={`${progress.highestFloor} / 100`} />
            <Stat label="Masters defeated" value={`${unlockedMasterCount} / 10`} />
            <Stat label="Tower Tokens" value={`${progress.tokens}`} />
            <Stat label="Training Data" value={`${progress.trainingData}`} />
            <Stat label="Checkpoint" value={progress.checkpointFloor ? `Floor ${progress.checkpointFloor}` : 'Entry'} />
          </div>
        </div>
        {!unlocked ? (
          <div className="relative mt-5 border border-amber-200/25 bg-amber-950/25 p-3 font-mono text-[10px] leading-relaxed text-amber-100/80" data-testid="tower-unlock-hint">
            <Lock className="mr-1 inline h-3 w-3" /> Bond with a LokPet and win your first pet battle to open the Boot Sector.
          </div>
        ) : current ? (
          <div className="relative mt-5 flex flex-col gap-3 border border-cyan-200/20 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="tower-current-floor">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[.25em] text-cyan-200/60">Next objective · Floor {current.floor} · {KIND_LABEL[current.kind]}</p>
              <h3 className="mt-1 text-lg font-black uppercase text-white">{current.name}</h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/60">{current.briefing}</p>
            </div>
            {current.kind === 'rest' ? (
              <div className="flex shrink-0 flex-col gap-2 sm:min-w-52">
                <button type="button" onClick={() => claimDigiTowerRest(current.floor, 'treats')} className="border border-emerald-200/40 bg-emerald-300/10 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-100 hover:bg-emerald-300/20" data-testid="button-tower-rest-treats">
                  <Sparkles className="mr-1 inline h-3 w-3" /> Full restore + 2 treats + {current.firstClearTokens} tokens
                </button>
                <button type="button" onClick={() => claimDigiTowerRest(current.floor, 'tokens')} className="border border-amber-200/40 bg-amber-300/10 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-100 hover:bg-amber-300/20" data-testid="button-tower-rest-tokens">
                  Full restore + {current.firstClearTokens + 15} tokens
                </button>
              </div>
            ) : currentSectorOpen ? (
              <button type="button" disabled={!unlocked} onClick={() => onLaunchFloor(current)} className="flex shrink-0 items-center justify-center gap-2 border border-cyan-200/45 bg-cyan-300/10 px-4 py-3 font-mono text-[10px] font-black uppercase tracking-[.16em] text-cyan-50 hover:bg-cyan-300/20 disabled:opacity-40" data-testid="button-tower-deploy">
                Deploy <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="max-w-56 border border-amber-200/20 bg-amber-950/20 px-3 py-2 font-mono text-[9px] leading-relaxed text-amber-100/70" role="status">
                {current.sector.number === 10 ? 'The Apex Terminal opens when the endgame is reached.' : `Seal ${current.sector.masterName} to open this sector.`}
              </div>
            )}
          </div>
        ) : (
          <div className="relative mt-5 border border-amber-200/30 bg-amber-950/25 p-4" data-testid="tower-campaign-clear">
            <p className="font-mono text-[10px] font-black uppercase tracking-[.25em] text-amber-100"><CheckCircle2 className="mr-1 inline h-4 w-4" /> Apex Terminal cleared</p>
            <p className="mt-1 text-sm text-white/70">Grandmaster Apex’s seal is yours. Endless Spire and Duo floors are the next expansion of the Tower.</p>
          </div>
        )}
        {restUnclaimed && current && (
          <section className="relative mt-4 border border-violet-200/25 bg-violet-950/15 p-4 sm:p-5" data-testid="tower-training-bay">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] font-black uppercase tracking-[.25em] text-violet-200/70"><Dumbbell className="mr-1 inline h-3 w-3" />Free rest-floor visit</p>
                <h3 className="mt-1 text-lg font-black uppercase text-white">Training Bay</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/60">Assign level-earned points before you continue. Each evolution also grants a bonus point. A rank improves real battle stats; the starter’s training cap is doubled.</p>
              </div>
              <div className="flex items-center gap-2 border border-violet-100/15 bg-black/25 px-3 py-2 font-mono text-[9px] uppercase text-violet-100/75">
                <span>{progress.trainingData} Training Data</span>
                <span className="text-white/35">·</span>
                <span>Respec {TRAINING_DATA_RESPEC_COST}</span>
              </div>
            </div>
            {trainingPet ? (
              <>
                <label className="mt-4 block max-w-sm font-mono text-[8px] font-bold uppercase tracking-[.18em] text-white/45">
                  Select LokPet
                  <select value={trainingPet.id} onChange={(event) => setSelectedTrainingPetId(event.target.value)} className="mt-1 block w-full border border-white/15 bg-slate-950 px-3 py-2 text-xs font-bold normal-case tracking-normal text-white">
                    {meta.savedLokPets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name || pet.roll.name} · Lv {pet.level ?? 1}{pet.starter ? ' · Partner' : ''}</option>)}
                  </select>
                </label>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {LOKPET_TRAINING_STATS.map((stat) => {
                    const training = trainingPet.training ?? { vigor: 0, fury: 0, guard: 0, pace: 0, spirit: 0 };
                    const cap = trainingPet.starter ? 20 : 10;
                    const rank = training[stat.id];
                    const canAdd = restUnclaimed && lokPetUnspentTrainingPoints(trainingPet) > 0 && rank < cap;
                    return (
                      <article key={stat.id} className="border border-white/10 bg-black/25 p-3" data-testid={`tower-training-${stat.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[9px] font-black uppercase tracking-wider text-white">{stat.label}</span>
                          <span className="font-mono text-[9px] text-violet-100/70">{rank}/{cap}</span>
                        </div>
                        <p className="mt-1 min-h-8 text-[9px] leading-relaxed text-white/45">{stat.description}</p>
                        <button type="button" disabled={!canAdd} onClick={() => trainLokPetAtTower(current.floor, trainingPet.id, stat.id as LokPetTrainingStat)} className="mt-2 w-full border border-violet-200/25 bg-violet-200/[.07] px-2 py-1.5 font-mono text-[8px] font-black uppercase tracking-wider text-violet-50 hover:bg-violet-200/[.14] disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Train ${stat.label}`}>
                          + Train · 1 point
                        </button>
                      </article>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-white/50">Unspent: <strong className="text-violet-100">{lokPetUnspentTrainingPoints(trainingPet)}</strong> / {lokPetTrainingAllowance(trainingPet.level, trainingPet.starter)} level-earned points</p>
                  <button type="button" disabled={!restUnclaimed || progress.trainingData < TRAINING_DATA_RESPEC_COST || !trainingPet.training || Object.values(trainingPet.training).every((rank) => rank === 0)} onClick={() => respecLokPetAtTower(current.floor, trainingPet.id)} className="border border-rose-200/20 bg-rose-300/[.05] px-3 py-2 font-mono text-[8px] font-bold uppercase tracking-wider text-rose-100/75 hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-30" data-testid="button-tower-training-respec">
                    <RotateCcw className="mr-1 inline h-3 w-3" /> Respec · {TRAINING_DATA_RESPEC_COST} Data
                  </button>
                </div>
              </>
            ) : <p className="mt-3 text-xs text-white/50">Save a LokPet to open the Training Bay.</p>}
          </section>
        )}
        {progress.defeatedMasterIds.includes('nib') && (
          <div className="relative mt-4 flex flex-col gap-3 border border-amber-200/20 bg-amber-950/15 p-3 sm:flex-row sm:items-center sm:justify-between" data-testid="tower-supply-exchange">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[.22em] text-amber-100/70">Boot-Sector Supply Exchange</p>
              <p className="mt-1 text-xs text-white/65">Trade 50 Tower Tokens for 3 LokPet treats. Owned treats: {meta.lokPetTreats}</p>
            </div>
            <button type="button" onClick={buyDigiTowerSupply} disabled={progress.tokens < 50} className="border border-amber-200/35 bg-amber-200/10 px-4 py-2 font-mono text-[9px] font-black uppercase tracking-wider text-amber-50 hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-35" data-testid="button-tower-buy-treats">
              Buy field supply · 50 tokens
            </button>
          </div>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="tower-sector-grid">
        {floors.filter((floor) => floor.sectorFloor === 1).map((entry) => {
          const sector = entry.sector;
          const floorStart = (sector.number - 1) * 10 + 1;
          const floorEnd = sector.number * 10;
          const sectorFloors = floors.filter((floor) => floor.sector.number === sector.number);
          const cleared = sectorFloors.filter((floor) => progress.clearedFloorIds.includes(floor.id)).length;
          const isOpen = unlocked && isDigiTowerSectorUnlocked(sector, progress.defeatedMasterIds, towerEndgame);
          const isCurrent = current?.sector.id === sector.id;
          const masterCleared = progress.defeatedMasterIds.includes(sector.masterId);
          return (
            <article key={sector.id} className={`overflow-hidden border bg-slate-950/70 ${isCurrent ? 'border-cyan-200/60 shadow-[0_0_24px_rgba(34,211,238,.09)]' : isOpen ? 'border-slate-700/70' : 'border-slate-800/50 opacity-65'}`} data-testid={`card-tower-sector-${sector.number}`}>
              <div className="h-1" style={{ background: sector.color }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[9px] font-black uppercase tracking-[.2em]" style={{ color: sector.color }}>Sector {String(sector.number).padStart(2, '0')} · Floors {floorStart}–{floorEnd}</p>
                    <h3 className="mt-1 text-lg font-black uppercase text-white">{sector.name}</h3>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-white/45">{sector.district} · {sector.motif}</p>
                  </div>
                  {masterCleared ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> : !isOpen ? <Lock className="h-4 w-4 shrink-0 text-white/35" /> : <span className="font-mono text-[9px] text-white/60">{cleared}/10</span>}
                </div>
                <p className="mt-3 min-h-10 text-xs leading-relaxed text-white/65">{sector.story}</p>
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="font-mono text-[8px] uppercase tracking-[.18em] text-white/40">Floor rule · {sector.rule.title}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/55">{sector.rule.description}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                  <div><p className="font-mono text-[8px] uppercase tracking-[.17em] text-white/40">Sector Master</p><p className="mt-0.5 text-xs font-bold text-white">{sector.masterName}</p><p className="text-[9px] text-white/45">{sector.masterTitle}</p></div>
                  <span className="max-w-28 text-right text-[9px] leading-relaxed text-white/45">{isOpen ? 'Master trial at floor 10' : sector.unlock}</span>
                </div>
                <div className="mt-3 grid grid-cols-10 gap-1" aria-label={`Sector ${sector.number} floor progress`}>
                  {sectorFloors.map((floor) => {
                    const done = progress.clearedFloorIds.includes(floor.id);
                    const active = floor.floor === progress.nextFloor && isOpen;
                    return <span key={floor.id} title={`Floor ${floor.floor}: ${KIND_LABEL[floor.kind]}`} className={`h-1.5 ${done ? 'bg-emerald-300' : active ? 'animate-pulse bg-cyan-200' : 'bg-white/10'}`} />;
                  })}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {progress.clearedFloorIds.length > 0 && (
        <section className="border border-white/10 bg-black/20 p-4" data-testid="tower-practice-list">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-mono text-[9px] font-black uppercase tracking-[.25em] text-cyan-200/65">No-risk practice</p>
              <h3 className="mt-1 text-lg font-black uppercase text-white">Replay a cleared floor</h3>
            </div>
            <p className="font-mono text-[9px] text-white/45">Fresh condition · 25% pet XP · no Tower progress or tokens</p>
          </div>
          <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {[...progress.clearedFloorIds].sort((a, b) => Number(b.replace('tower-floor-', '')) - Number(a.replace('tower-floor-', ''))).map((floorId) => {
              const floorNumber = Number(floorId.replace('tower-floor-', ''));
              const floor = getDigiTowerFloor(floorNumber);
              return (
                <button key={floorId} type="button" onClick={() => onLaunchFloor(floor, true)} className="flex items-center justify-between gap-3 border border-white/10 bg-white/[.03] px-3 py-2 text-left hover:border-cyan-200/35 hover:bg-cyan-200/[.06]" data-testid={`button-tower-practice-${floorNumber}`}>
                  <span className="min-w-0"><span className="block font-mono text-[8px] uppercase tracking-wider text-cyan-100/55">Floor {floorNumber} · {KIND_LABEL[floor.kind]}</span><span className="block truncate text-xs font-bold text-white/85">{floor.name}</span></span>
                  <span className="shrink-0 font-mono text-[8px] uppercase text-white/40">Practice</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {towerEndgame ? null : (
        <p className="border border-white/10 bg-black/20 p-3 font-mono text-[9px] leading-relaxed text-white/40">
          Apex Terminal opens after the endgame. The first nine sectors advance one Master seal at a time; all progress and checkpoint recovery are saved locally.
        </p>
      )}
      <p className="text-center font-mono text-[8px] uppercase tracking-[.2em] text-white/25">{mapsCleared(meta).have} districts cleared · no LokPet stamina is spent in Tower battles</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border border-cyan-100/10 bg-black/25 p-3"><p className="font-mono text-[8px] uppercase tracking-[.18em] text-white/40">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>;
}
