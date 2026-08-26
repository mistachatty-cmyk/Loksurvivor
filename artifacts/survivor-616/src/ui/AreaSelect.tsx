/**
 * Area / mission picker. Owned by the design pass -- keep the export name
 * and props stable.
 */
import { describeUnlock, useMeta } from '@/game/state/metaStore';
import { availableChallengeContracts } from '@/game/data/vendor';
import { getFirstNightChapter } from '@/game/data/firstNight';
import { ScreenLayout } from './ScreenLayout';
import { FirstNightBoard } from './FirstNightBoard';
import { motion } from 'framer-motion';
import { MapPin, Lock, Clock, AlertTriangle, CheckCircle2, Infinity, Skull } from 'lucide-react';
import { useState } from 'react';

export interface AreaSelectProps {
  onBack: () => void;
  onLaunch: (areaId: string, challengeIds: string[]) => void;
}

const THREAT_COLORS = {
  low: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  rising: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  high: 'text-orange-500 border-orange-500/30 bg-orange-500/10',
  severe: 'text-red-500 border-red-500/30 bg-red-500/10'
};

export function AreaSelect({ onBack, onLaunch }: AreaSelectProps) {
  const { unlockedAreas, lockedAreas, meta, selectedCharacter } = useMeta();
  const challenges = availableChallengeContracts(meta);
  const [selectedChallengeIds, setSelectedChallengeIds] = useState<string[]>([]);

  const toggleChallenge = (id: string) => {
    setSelectedChallengeIds((current) => {
      if (current.includes(id)) return current.filter((challengeId) => challengeId !== id);
      return current.length < 2 ? [...current, id] : current;
    });
  };

  return (
    <ScreenLayout 
      title="Where tonight?" 
      subtitle="Pick a block"
      onBack={onBack}
      action={
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Running as</p>
          <p className="text-sm font-bold text-white uppercase">{selectedCharacter.name}</p>
        </div>
      }
    >
      <div className="mb-6">
        <FirstNightBoard />
      </div>

      {challenges.length > 0 && (
        <section className="mb-6 border border-red-500/30 bg-red-950/10 p-4 sm:p-5" data-testid="section-run-contracts">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-red-300">
                <Skull className="h-4 w-4" />
                <p className="text-xs font-bold uppercase tracking-[0.25em]">Optional contracts</p>
              </div>
              <h2 className="mt-1 text-2xl font-black uppercase text-white">Raise the stakes</h2>
              <p className="mt-1 text-xs text-muted-foreground">Owned contracts are selected before launch. Choose up to two for a larger cred payout.</p>
            </div>
            <span className="font-mono text-xs text-red-200/80">{selectedChallengeIds.length}/2 selected</span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {challenges.map((challenge) => {
              const selected = selectedChallengeIds.includes(challenge.id);
              return (
                <button
                  key={challenge.id}
                  type="button"
                  onClick={() => toggleChallenge(challenge.id)}
                  aria-pressed={selected}
                  className={`border p-3 text-left transition-colors ${selected ? 'border-red-400 bg-red-500/15' : 'border-border bg-card hover:border-red-400/60'}`}
                  data-testid={`button-toggle-challenge-${challenge.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold uppercase text-white">{challenge.name}</span>
                    <span className="font-mono text-xs text-red-300">×{challenge.rewardMultiplier.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{challenge.description}</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-red-200">{selected ? 'Selected for next run' : 'Available contract'}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {unlockedAreas.map((area, i) => {
          const isCleared = meta.clearedAreaIds.includes(area.id);
          const threatColor = THREAT_COLORS[area.threat];

          return (
            <motion.button
              key={area.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              type="button"
              onClick={() => onLaunch(area.id, selectedChallengeIds)}
              className="group relative w-full text-left border border-border bg-card overflow-hidden flex flex-col hover:border-primary transition-colors h-64"
              data-testid={`button-area-${area.id}`}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-background/80 group-hover:bg-background/60 transition-colors z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/20 z-10" />
                <img 
                  src={`${import.meta.env.BASE_URL}${area.backdrop}`} 
                  alt="" 
                  className="w-full h-full object-cover grayscale mix-blend-luminosity opacity-50 group-hover:scale-105 transition-transform duration-700" 
                />
              </div>

              {/* Content */}
              <div className="relative z-20 p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-auto">
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">{area.name}</h2>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3 h-3 text-primary" />
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">{area.district}</p>
                    </div>
                  </div>
                  {isCleared && (
                    <div className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-1 border border-primary/20">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="text-[10px] uppercase font-bold tracking-widest">Cleared</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mb-4 group-hover:text-gray-300 transition-colors">
                  {area.description}
                </p>
                {getFirstNightChapter(area.id) && (
                  <div className="mb-3 border border-cyan-300/20 bg-cyan-950/10 p-2.5" data-testid={`first-night-goal-${area.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-100/75">
                        Chapter {getFirstNightChapter(area.id)?.chapter} · {getFirstNightChapter(area.id)?.worldVerb}
                      </span>
                      {isCleared && <span className="font-mono text-[9px] uppercase tracking-widest text-primary">Replay lead</span>}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-white/80">{getFirstNightChapter(area.id)?.goal}</p>
                  </div>
                )}
                {area.landmark && (
                  <p className="mb-3 truncate border-l-2 border-primary/60 pl-2 text-[10px] font-bold uppercase tracking-widest text-primary/80">
                    Landmark: {area.landmark.name}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 px-2 py-1 border ${threatColor}`}>
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{area.threat} Threat</span>
                  </div>
                  {area.endless ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 border border-primary/40 bg-primary/10 text-primary">
                      <Infinity className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Endless</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 border border-border bg-black/50 text-white">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{Math.round(area.durationSec)}s Survive</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}

        {lockedAreas.map((area, i) => (
          <motion.div
            key={area.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: (unlockedAreas.length + i) * 0.05 }}
            className="relative w-full border border-border bg-card/30 p-5 flex flex-col h-64 opacity-50 grayscale"
          >
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 bg-background/90 z-10" />
              <img 
                src={`${import.meta.env.BASE_URL}${area.backdrop}`} 
                alt="" 
                className="w-full h-full object-cover mix-blend-luminosity opacity-20" 
              />
            </div>
            
            <div className="relative z-20 flex flex-col items-center justify-center h-full text-center">
              <Lock className="w-8 h-8 text-muted-foreground mb-3" />
              <h2 className="text-xl font-black text-white uppercase tracking-tight mb-1">{area.name}</h2>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{area.district}</p>
              <p className="text-xs text-primary font-bold uppercase tracking-wider max-w-[200px]">
                {describeUnlock(area.unlock)}
              </p>
              {area.landmark && (
                <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground/80">
                  Landmark: {area.landmark.name}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </ScreenLayout>
  );
}

export default AreaSelect;
