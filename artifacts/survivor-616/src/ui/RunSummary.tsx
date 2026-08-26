/**
 * Post-run debrief. Owned by the design pass -- keep the export name and
 * props stable.
 */
import { getArea } from '@/game/data/areas';
import { getCharacter } from '@/game/data/characters';
import { ENEMIES_BY_ID } from '@/game/data/enemies';
import { ALLIES_BY_ID, DISCOVERIES_BY_ID } from '@/game/data/progression';
import type { RunResult } from '@/game/types';
import { ScreenLayout } from './ScreenLayout';
import { RigPortrait } from './RigPortrait';
import { motion } from 'framer-motion';
import { Skull, Coins, Zap, Trophy, Heart, Unlock, MapPin, TrendingDown, Package, CheckCircle, BatteryLow } from 'lucide-react';

export interface RunSummaryProps {
  result: RunResult;
  onReturnToHub: () => void;
  onRetry: () => void;
}

export function RunSummary({ result, onReturnToHub, onRetry }: RunSummaryProps) {
  const area = getArea(result.areaId);
  const character = getCharacter(result.characterId);
  const ally = result.rescuedAllyId ? ALLIES_BY_ID[result.rescuedAllyId] : undefined;
  const discovery = result.cleared && result.discoveryId ? DISCOVERIES_BY_ID[result.discoveryId] : undefined;
  const lokPets = result.lokPets ?? [];

  return (
    <ScreenLayout 
      title={result.cleared ? 'Block cleared' : 'You went down'}
      subtitle={area.name}
      backdrop={area.backdrop}
      className={result.cleared ? 'border-t-8 border-primary' : 'border-t-8 border-destructive'}
    >
      <div className="max-w-4xl mx-auto w-full space-y-8 mt-4">
        
        {/* Core Stats */}
        <div className="bg-card border border-border p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-black border border-border overflow-hidden shrink-0 flex items-end justify-center">
              <RigPortrait rig={character.rig} palette={character.palette} anim="idle" size={64} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Operative</p>
              <p className="text-2xl font-black text-white">{character.name}</p>
            </div>
          </div>
          
          <div className="h-px w-full md:h-12 md:w-px bg-border hidden md:block" />

          <div className="flex flex-wrap gap-8 w-full md:w-auto">
            {result.endless ? (
              <>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3 text-primary" /> Blocks walked</p>
                  <p className="text-2xl font-mono font-bold text-white">{result.endless.blocksWalked}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5"><TrendingDown className="w-3 h-3 text-primary" /> Depth</p>
                  <p className="text-2xl font-mono font-bold text-white">{result.endless.dungeonDepth}</p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5"><Trophy className="w-3 h-3 text-primary" /> Time</p>
                <p className="text-2xl font-mono font-bold text-white">{Math.floor(result.survivedSec)}s</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5"><Skull className="w-3 h-3 text-primary" /> Defeated</p>
              <p className="text-2xl font-mono font-bold text-white" data-testid="text-run-kills">{result.kills}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5"><Zap className="w-3 h-3 text-primary" /> Level</p>
              <p className="text-2xl font-mono font-bold text-white">{result.level}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5"><Coins className="w-3 h-3 text-primary" /> Cred</p>
              <p className="text-2xl font-mono font-bold text-white" data-testid="text-run-cred">{result.cred}</p>
            </div>
          </div>
        </div>

        {/* Endless stats title */}
        {result.endless && (
          <div className="bg-card border border-border p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Survived {Math.floor(result.survivedSec)}s on the endless block
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2" data-testid="section-loadout">
          <div className="border border-border bg-card p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Final weapons</p>
            <div className="flex flex-wrap gap-2">
              {result.loadout.weapons.map((weapon) => (
                <span key={weapon.id} className="border border-primary/40 bg-primary/5 px-3 py-1.5 text-sm font-bold uppercase text-white">
                  {weapon.name} <span className="font-mono text-primary">Lv {weapon.level}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="border border-border bg-card p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Passives</p>
            <div className="flex flex-wrap gap-2">
              {result.loadout.passives.length > 0 ? result.loadout.passives.map((passive) => (
                <span key={passive.id} className="border border-border bg-black px-3 py-1.5 text-sm font-bold uppercase text-white">
                  {passive.name} <span className="font-mono text-primary">x{passive.stacks}</span>
                </span>
              )) : <span className="font-mono text-sm text-muted-foreground">None equipped</span>}
            </div>
          </div>
        </div>

        {typeof result.fatigueAfterPct === 'number' && (
          <div className="border border-amber-500/30 bg-amber-500/5 p-5" data-testid="section-fatigue">
            <div className="flex items-center gap-2 text-amber-300">
              <BatteryLow className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Post-run fatigue</span>
            </div>
            <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {character.name} needs rooftop recovery before their stats return to full strength.
              </p>
              <p className="font-mono text-xl font-bold text-amber-300">
                {result.fatigueAfterPct.toFixed(1)}% penalty
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden bg-black">
              <div className="h-full bg-amber-400" style={{ width: `${result.fatigueAfterPct * 20}%` }} />
            </div>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Open the rooftop recovery deck from the Hideout to restore {result.fatigueAddedPct?.toFixed(1) ?? '0.5'}% over time.
            </p>
          </div>
        )}

        {/* Unlocks & Discoveries */}
        {(ally || discovery || result.newlyUnlockedCharacterIds.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {ally && (
              <div className="border border-border bg-card p-5" data-testid="text-rescued-ally">
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <Heart className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Crew Rescued</span>
                </div>
                <p className="text-lg font-black text-white">{ally.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{ally.boostLabel}</p>
              </div>
            )}
            
            {discovery && (
              <div className="border border-border bg-card p-5" data-testid="text-discovery">
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <Unlock className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Secret Found</span>
                </div>
                <p className="text-lg font-black text-white">{discovery.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{discovery.blurb}</p>
              </div>
            )}

            {result.newlyUnlockedCharacterIds.length > 0 && (
              <div className="border border-border bg-card p-5 sm:col-span-2" data-testid="text-new-characters">
                <div className="flex items-center gap-2 mb-2 text-primary">
                  <Unlock className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Now Playable</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {result.newlyUnlockedCharacterIds.map((id) => (
                    <span key={id} className="bg-black text-white font-bold px-3 py-1 text-sm border border-border uppercase tracking-wide">
                      {getCharacter(id).name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Enemy Breakdown */}
        {Object.keys(result.killsByEnemy).length > 0 && (
          <div className="border border-border bg-card p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Threat Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Object.entries(result.killsByEnemy).map(([enemyId, count], i) => (
                <motion.div 
                  key={enemyId}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col"
                >
                  <span className="text-xs font-bold text-white uppercase tracking-wide truncate mb-1">
                    {ENEMIES_BY_ID[enemyId]?.name ?? enemyId}
                  </span>
                  <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
                    <Skull className="w-3 h-3" />
                    {count}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Loot & Objectives */}
        {(result.lootBoxesOpened > 0 || lokPets.length > 0 || result.completedObjectives.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {result.lootBoxesOpened > 0 && (
              <div className="border border-border bg-card p-5" data-testid="section-loot">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Loot Boxes — {result.lootBoxesOpened} opened
                  </span>
                  {result.lootTokensGained > 0 && (
                    <span className="ml-auto font-mono text-xs text-amber-400 font-bold">
                      +{result.lootTokensGained} tokens
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.openedPrizes.map((label, i) => (
                    <span key={i} className="border border-blue-800/60 bg-blue-950/40 px-2 py-0.5 font-mono text-[11px] text-blue-200">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {lokPets.length > 0 && (
              <div className="border border-pink-400/30 bg-card p-5" data-testid="section-lokpets">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg text-pink-300">✦</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    LokPets — {lokPets.length} generated
                  </span>
                </div>
                <div className="space-y-2">
                  {lokPets.map((pet, i) => (
                    <div key={`${pet.name}-${i}`} className="flex items-center justify-between gap-3 border border-white/10 bg-black/25 px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-black uppercase tracking-wide text-white">{pet.name}</p>
                        <p className="truncate font-mono text-[9px] uppercase tracking-wider text-pink-300">
                          {pet.rarity} {pet.family} · {pet.attackKind} · {pet.element}
                        </p>
                      </div>
                      <span className={`shrink-0 font-mono text-[9px] uppercase tracking-widest ${pet.ghosted ? 'text-white/50' : 'text-emerald-300'}`}>
                        {pet.ghosted ? 'ghosted' : 'active'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.completedObjectives.length > 0 && (
              <div className="border border-border bg-card p-5" data-testid="section-objectives">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Objectives — {result.completedObjectives.length} done
                  </span>
                </div>
                <div className="space-y-2">
                  {result.completedObjectives.map((obj) => (
                    <div key={obj.id} className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-white/80">{obj.label}</span>
                      <span className="font-mono text-[11px] text-amber-400">
                        +{obj.rewardCred} cred{obj.rewardTokens > 0 ? ` +${obj.rewardTokens}t` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button 
            type="button" 
            onClick={onRetry} 
            className="flex-1 bg-primary text-primary-foreground py-4 font-black uppercase tracking-widest text-sm hover:bg-white transition-colors" 
            data-testid="button-run-again"
          >
            Run it back
          </button>
          <button 
            type="button" 
            onClick={onReturnToHub} 
            className="flex-1 border border-border bg-card text-white py-4 font-black uppercase tracking-widest text-sm hover:border-primary transition-colors" 
            data-testid="button-return-hub"
          >
            Back to Hideout
          </button>
        </div>

      </div>
    </ScreenLayout>
  );
}

export default RunSummary;
