import { useEffect, useMemo, useState } from 'react';
import { Bath, ChevronUp, Clock3, HeartPulse, Music, Users, Waves } from 'lucide-react';
import { motion } from 'framer-motion';

import { RECOVERY_FACILITIES, RECOVERY_FACILITIES_BY_ID, RECOVERY_HUTS } from '@/game/data/recovery';
import { currentFatiguePct, recoveryRemainingMs, useMeta } from '@/game/state/metaStore';
import { getCharacter } from '@/game/data/characters';
import { ScreenLayout } from './ScreenLayout';

export interface RecoveryPanelProps {
  onBack: () => void;
}

const SOCIAL_LINES = [
  'Someone puts on a record and nobody talks over the first song.',
  'The crew compares bruises like they are trading cards.',
  'A friend leaves a mug on the edge of the tub without saying a word.',
  'The skyline is quiet enough to remember what you were fighting for.',
];

function formatRecovery(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function RecoveryPanel({ onBack }: RecoveryPanelProps) {
  const {
    meta,
    unlockedCharacters,
    rescuedAllies,
    startRecovery,
    stopRecovery,
    tickRecovery,
    upgradeFacility,
  } = useMeta();
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(tickRecovery, 1000);
    return () => window.clearInterval(timer);
  }, [tickRecovery]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setLineIndex((current) => (current + 1) % SOCIAL_LINES.length),
      7000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const activeCharacter = meta.recovery.characterId
    ? getCharacter(meta.recovery.characterId)
    : null;
  const currentIndex = RECOVERY_FACILITIES.findIndex((facility) => facility.id === meta.facilityTier);
  const nextFacility = RECOVERY_FACILITIES[currentIndex + 1];
  const currentFacility = RECOVERY_FACILITIES_BY_ID[meta.facilityTier];
  const remaining = recoveryRemainingMs(meta);
  const hutIds = new Set(meta.discoveredHutIds);
  const availableHuts = RECOVERY_HUTS.filter((hut) => hutIds.has(hut.id));

  const crewNames = useMemo(
    () => rescuedAllies.slice(0, currentFacility.socialCapacity).map((ally) => ally.name),
    [rescuedAllies, currentFacility.socialCapacity],
  );

  return (
    <ScreenLayout title="Recovery deck" subtitle="Rooftop above the Sanctum" onBack={onBack}>
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="border border-primary/40 bg-card p-5 md:p-7" data-testid="section-recovery-session">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Waves className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-[0.25em]">Rooftop room</span>
              </div>
              <h2 className="text-3xl font-black text-white">
                {activeCharacter ? `${activeCharacter.name} is decompressing` : 'Let somebody breathe'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Fatigue fades in real time while the session is active. The tab can close;
                your hideout keeps the clock running.
              </p>
            </div>
            <div className="border border-border bg-black/50 p-4 text-right">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Current facility</p>
              <p className="mt-1 font-bold uppercase text-primary">{currentFacility.name}</p>
              <p className="font-mono text-xs text-white/70">{currentFacility.recoveryPctPerMinute}% fatigue / minute</p>
            </div>
          </div>

          {activeCharacter ? (
            <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold uppercase tracking-wide text-white">{activeCharacter.name}</span>
                  <span className="font-mono text-lg font-bold text-primary">{currentFatiguePct(meta, activeCharacter.id).toFixed(1)}% tired</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden bg-black">
                  <div
                    className="h-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.min(100, currentFatiguePct(meta, activeCharacter.id) * 20)}%` }}
                  />
                </div>
                <p className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <Clock3 className="h-3 w-3" /> {remaining > 0 ? `${formatRecovery(remaining)} until fully recovered` : 'Fully recovered'}
                </p>
              </div>
              <button
                type="button"
                onClick={stopRecovery}
                className="border border-border px-5 py-3 font-bold uppercase tracking-widest text-white hover:border-primary"
                data-testid="button-stop-recovery"
              >
                End session
              </button>
            </div>
          ) : (
            <div className="mt-6 border border-dashed border-border p-4 text-sm text-muted-foreground">
              Choose a tired operative below to start a recovery session.
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Music className="h-3.5 w-3.5 text-primary" /> Local soundtrack sets the mood</span>
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> {crewNames.length ? `${crewNames.join(', ')} nearby` : 'Rescue friends to fill the room'}</span>
            <span className="italic text-white/70">{SOCIAL_LINES[lineIndex]}</span>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Choose someone</p>
              <h2 className="text-2xl font-black uppercase text-white">Crew recovery</h2>
            </div>
            <span className="font-mono text-xs text-muted-foreground">0–5% penalty cap</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unlockedCharacters.map((character) => {
              const fatigue = currentFatiguePct(meta, character.id);
              const isActive = activeCharacter?.id === character.id;
              return (
                <motion.div key={character.id} layout className={`border p-4 ${isActive ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black uppercase text-white">{character.name}</p>
                      <p className="text-xs text-muted-foreground">{character.handle}</p>
                    </div>
                    <HeartPulse className={`h-4 w-4 ${fatigue > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
                  </div>
                  <p className="mt-4 font-mono text-sm text-amber-300">{fatigue.toFixed(1)}% stat penalty</p>
                  <button
                    type="button"
                    disabled={fatigue <= 0 || !!activeCharacter}
                    onClick={() => startRecovery(character.id)}
                    className="mt-4 w-full border border-primary/50 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-35 hover:bg-primary hover:text-primary-foreground"
                    data-testid={`button-recover-${character.id}`}
                  >
                    {fatigue <= 0 ? 'Ready for action' : isActive ? 'Recovering' : 'Start recovery'}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="border border-border bg-card p-5" data-testid="section-facilities">
            <div className="mb-4 flex items-center gap-2">
              <Bath className="h-5 w-5 text-primary" />
              <h2 className="font-black uppercase tracking-wide text-white">Facility ladder</h2>
            </div>
            <div className="space-y-2">
              {RECOVERY_FACILITIES.map((facility, index) => {
                const owned = index <= currentIndex;
                return (
                  <div key={facility.id} className={`flex items-center justify-between border p-3 ${owned ? 'border-primary/40 bg-primary/5' : 'border-border/60 opacity-55'}`}>
                    <div>
                      <p className="text-sm font-bold uppercase text-white">{facility.name}</p>
                      <p className="text-xs text-muted-foreground">{facility.recoveryPctPerMinute}% / min · {facility.socialCapacity} social slot{facility.socialCapacity === 1 ? '' : 's'}</p>
                    </div>
                    <span className="font-mono text-xs text-primary">{owned ? 'ONLINE' : `${facility.cost} cred`}</span>
                  </div>
                );
              })}
            </div>
            {nextFacility ? (
              <button
                type="button"
                onClick={upgradeFacility}
                disabled={meta.cred < nextFacility.cost}
                className="mt-4 flex w-full items-center justify-center gap-2 bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40 hover:bg-white"
                data-testid="button-upgrade-facility"
              >
                <ChevronUp className="h-4 w-4" /> Upgrade to {nextFacility.name} · {nextFacility.cost} cred
              </button>
            ) : (
              <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-primary">Ultimate facility installed</p>
            )}
          </div>

          <div className="border border-border bg-card p-5" data-testid="section-field-huts">
            <div className="mb-4 flex items-center gap-2">
              <Waves className="h-5 w-5 text-primary" />
              <h2 className="font-black uppercase tracking-wide text-white">Field huts</h2>
            </div>
            {availableHuts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Clear an area to discover a small safe house where the crew can catch their breath.</p>
            ) : (
              <div className="space-y-3">
                {availableHuts.map((hut) => {
                  const facility = RECOVERY_FACILITIES_BY_ID[hut.facility];
                  return (
                    <div key={hut.id} className="border border-border/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold uppercase text-white">{hut.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{hut.description}</p>
                        </div>
                        <span className="whitespace-nowrap font-mono text-[10px] text-primary">{facility.name}</span>
                      </div>
                      <button
                        type="button"
                        disabled={!activeCharacter}
                        onClick={() => activeCharacter && startRecovery(activeCharacter.id, hut.id)}
                        className="mt-3 w-full border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-35 hover:border-primary"
                      >
                        Rest here
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </ScreenLayout>
  );
}

export default RecoveryPanel;