/**
 * Area / mission picker. Owned by the design pass -- keep the export name
 * and props stable.
 */
import { describeUnlock, useMeta } from '@/game/state/metaStore';
import { customMapToArea, customMapValidationIssues } from '@/game/data/customMaps';
import { availableChallengeContracts } from '@/game/data/vendor';
import { getFirstNightChapter } from '@/game/data/firstNight';
import { ScreenLayout } from './ScreenLayout';
import { FirstNightBoard } from './FirstNightBoard';
import { motion } from 'framer-motion';
import { MapPin, Lock, Clock, AlertTriangle, CheckCircle2, Infinity, Skull, PencilRuler, Copy, Maximize2, Compass, Layers } from 'lucide-react';
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

const THEME_LABELS: Record<string, { label: string; color: string }> = {
  streets: { label: 'Downtown Grid', color: 'text-amber-400 border-amber-400/40 bg-amber-400/10' },
  rooftops: { label: 'Skyline Heights', color: 'text-purple-400 border-purple-400/40 bg-purple-400/10' },
  catacombs: { label: 'Crystal Caverns', color: 'text-cyan-400 border-cyan-400/40 bg-cyan-400/10' },
  alleys: { label: 'Fulton Labyrinth', color: 'text-sky-400 border-sky-400/40 bg-sky-400/10' },
  'null-sector': { label: 'Glitch Grid', color: 'text-fuchsia-400 border-fuchsia-400/40 bg-fuchsia-400/10' },
  docks: { label: 'Waterfront Canals', color: 'text-teal-400 border-teal-400/40 bg-teal-400/10' },
  wasteland: { label: 'Perimeter Highway', color: 'text-orange-400 border-orange-400/40 bg-orange-400/10' },
};

export function AreaSelect({ onBack, onLaunch }: AreaSelectProps) {
  const { unlockedAreas, lockedAreas, meta, selectedCharacter } = useMeta();
  const customMaps = meta.customMaps;
  const challenges = availableChallengeContracts(meta);
  const [selectedChallengeIds, setSelectedChallengeIds] = useState<string[]>([]);
  type MapFilter = 'standard' | 'bonus' | '2x' | 'endless';
  const [filter, setFilter] = useState<MapFilter>('standard');

  const inFilter = (area: (typeof unlockedAreas)[number], nextFilter: MapFilter) => {
    if (nextFilter === 'endless') return Boolean(area.endless);
    if (nextFilter === '2x') return area.id.endsWith('-2x');
    if (nextFilter === 'bonus') return false;
    return !area.endless && !area.id.endsWith('-2x');
  };

  const toggleChallenge = (id: string) => {
    setSelectedChallengeIds((current) => {
      if (current.includes(id)) return current.filter((challengeId) => challengeId !== id);
      return current.length < 2 ? [...current, id] : current;
    });
  };

  const filteredUnlocked = unlockedAreas.filter((a) => {
    return inFilter(a, filter);
  });

  const filteredLocked = lockedAreas.filter((a) => {
    return inFilter(a, filter);
  });

  const endlessCount = unlockedAreas.filter((a) => a.endless).length + lockedAreas.filter((a) => a.endless).length;
  const standardCount = unlockedAreas.filter((a) => !a.endless).length + lockedAreas.filter((a) => !a.endless).length;
  const twoXCount = [...unlockedAreas, ...lockedAreas].filter((a) => a.id.endsWith('-2x')).length;
  const bonusCount = customMaps.length;

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

      {/* Mode Filters */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('endless')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
              filter === 'endless'
                ? 'border-cyan-400 bg-cyan-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                : 'border-border bg-card text-muted-foreground hover:border-cyan-400/60 hover:text-cyan-300'
            }`}
          >
            <Infinity className="h-3.5 w-3.5" />
            Infinite Worlds ({endlessCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('standard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors border ${
              filter === 'standard'
                ? 'border-white bg-white text-black'
                : 'border-border bg-card text-muted-foreground hover:border-white/60 hover:text-white'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Standard ({Math.max(0, standardCount - twoXCount)})
          </button>
          <button type="button" onClick={() => setFilter('bonus')} className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${filter === 'bonus' ? 'border-violet-300 bg-violet-300 text-black' : 'border-border bg-card text-muted-foreground hover:border-violet-300/60 hover:text-violet-200'}`}>
            <Layers className="h-3.5 w-3.5" /> Bonus Maps ({bonusCount})
          </button>
          <button type="button" onClick={() => setFilter('2x')} className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${filter === '2x' ? 'border-orange-300 bg-orange-300 text-black' : 'border-border bg-card text-muted-foreground hover:border-orange-300/60 hover:text-orange-200'}`}>
            <Maximize2 className="h-3.5 w-3.5" /> 2× Maps ({twoXCount})
          </button>
        </div>

        {filter === 'endless' && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-200/90">
            <Compass className="h-3.5 w-3.5 text-cyan-400" />
            <span>Unbounded 640px procedural grid · Subterranean vaults & rooftop networks</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filter === 'bonus' && customMaps.map((map, i) => {
          const area = customMapToArea(map);
          const mapIssues = customMapValidationIssues(map);
          const launchable = mapIssues.length === 0;
          return (
            <motion.button
              key={map.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              type="button"
              onClick={() => launchable && onLaunch(map.id, selectedChallengeIds)}
              disabled={!launchable}
              className="group relative flex h-64 w-full flex-col overflow-hidden border border-cyan-200/30 bg-card text-left transition-colors hover:border-cyan-200"
              data-testid={`button-custom-map-${map.id}`}
            >
              <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 z-10 bg-[#071116]/80 transition-colors group-hover:bg-[#071116]/60" />
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-background via-background/90 to-background/20" />
                <img src={`${import.meta.env.BASE_URL}${area.backdrop}`} alt="" className="h-full w-full object-cover opacity-45 grayscale mix-blend-luminosity transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="relative z-20 flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-200"><PencilRuler className="h-3 w-3" /> Custom route</p>
                    <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">{map.name}</h2>
                  </div>
                  <Copy className="h-4 w-4 text-cyan-200/70" />
                </div>
                <p className="mt-auto line-clamp-2 text-xs text-muted-foreground">{area.description}</p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="border border-cyan-200/30 bg-cyan-200/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-100">{map.placements.length} objects</span>
                  <span className="border border-border bg-black/50 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-white">{map.durationSec}s</span>
                  <span className={`ml-auto font-mono text-[10px] font-bold uppercase tracking-widest ${launchable ? 'text-cyan-100' : 'text-amber-200'}`}>{launchable ? map.threat : 'needs enemy'}</span>
                </div>
              </div>
            </motion.button>
          );
        })}
        {filteredUnlocked.map((area, i) => {
          const isCleared = meta.clearedAreaIds.includes(area.id);
          const threatColor = THREAT_COLORS[area.threat];
          const themeInfo = area.endlessTheme ? THEME_LABELS[area.endlessTheme] : null;

          return (
            <motion.button
              key={area.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              type="button"
              onClick={() => onLaunch(area.id, selectedChallengeIds)}
              className={`group relative w-full text-left border bg-card overflow-hidden flex flex-col transition-all h-64 ${
                area.endless
                  ? 'border-cyan-500/30 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                  : 'border-border hover:border-primary'
              }`}
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

                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`flex items-center gap-1.5 px-2 py-1 border ${threatColor}`}>
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{area.threat} Threat</span>
                  </div>
                  {area.endless ? (
                    <>
                      <div className="flex items-center gap-1.5 px-2 py-1 border border-cyan-400/40 bg-cyan-400/10 text-cyan-300">
                        <Infinity className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Infinite</span>
                      </div>
                      {themeInfo && (
                        <div className={`px-2 py-1 border text-[10px] font-bold uppercase tracking-widest ${themeInfo.color}`}>
                          {themeInfo.label}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 border border-border bg-black/50 text-white">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{Math.round(area.durationSec)}s Survive</span>
                    </div>
                  )}
                  {Math.max(area.bounds.w, area.bounds.h) >= 1800 && !area.endless ? (
                    <div className="flex items-center gap-1.5 border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-cyan-100">
                      <Maximize2 className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">XL Route</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.button>
          );
        })}

        {filteredLocked.map((area, i) => (
          <motion.div
            key={area.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: (filteredUnlocked.length + i) * 0.05 }}
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
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{area.district}</p>
                {area.endless && (
                  <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-cyan-400">
                    <Infinity className="w-2.5 h-2.5" /> Infinite
                  </span>
                )}
              </div>
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
