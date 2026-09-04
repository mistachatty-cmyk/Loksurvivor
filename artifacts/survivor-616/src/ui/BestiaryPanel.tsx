/**
 * Bestiary. Entries reveal themselves as the player defeats each enemy.
 * Owned by the design pass -- keep the export name and props stable.
 */
import { ENEMIES } from '@/game/data/enemies';
import { CHARACTERS } from '@/game/data/characters';
import { describeUnlock, useMeta } from '@/game/state/metaStore';
import { ScreenLayout } from './ScreenLayout';
import { RigPortrait } from './RigPortrait';
import { WeaponIcon } from './WeaponIcon';
import { motion } from 'framer-motion';
import { Skull, Ghost, LockKeyhole, Sparkles, Users } from 'lucide-react';
import { resolveCharacterCosmeticPalette } from '@/game/data/characterSkins';
import { DEFAULT_PALETTE_ID, getActivePalette } from '@/game/data/themedPalettes';

export interface BestiaryPanelProps {
  onBack: () => void;
}

function EnemyPreview({ enemy }: { enemy: (typeof ENEMIES)[number] }) {
  const activeAnim = enemy.behavior === 'shockwave' || enemy.behavior === 'spitter' || enemy.behavior === 'charger' ? 'attack' : 'walk';
  return (
    <div className="relative grid h-28 w-24 shrink-0 place-items-center overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.08),transparent_62%)]" role="img" aria-label={`Animated pixel model of ${enemy.name}`}>
      <RigPortrait rig={enemy.rig} palette={enemy.palette} anim={activeAnim} size={94} />
      <span className="absolute inset-x-1 bottom-1 text-center font-mono text-[8px] uppercase tracking-widest text-white/35">live specimen</span>
    </div>
  );
}

export function BestiaryPanel({ onBack }: BestiaryPanelProps) {
  const { meta, unlockedCharacters } = useMeta();
  const isListView = meta.uiDensity === 'list';
  // Enemies excluded from the ratio (e.g. Choir Wraith's HP is intentionally
  // beyond a run's reach) so 100% stays a reachable goal.
  const catalogueEnemies = ENEMIES.filter((e) => !e.excludeFromBestiary);
  const discovered = catalogueEnemies.filter((e) => (meta.bestiary[e.id] ?? 0) > 0).length;
  const unlockedIds = new Set(unlockedCharacters.map((character) => character.id));

  return (
    <ScreenLayout 
      title="Bestiary" 
      subtitle="Known Threats"
      onBack={onBack}
      action={
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Catalogued</p>
          <p className="text-2xl font-black text-white">{discovered} <span className="text-muted-foreground text-sm">/ {catalogueEnemies.length}</span></p>
        </div>
      }
    >
      <section className="mb-10" data-testid="section-character-visualizers">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary font-bold">The living archive</p>
            <h2 className="text-2xl font-black text-white">Character visualizers</h2>
          </div>
          <p className="text-xs text-muted-foreground font-mono">{unlockedCharacters.length} / {CHARACTERS.length} available</p>
        </div>
        <div className={`grid gap-4 ${isListView ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
          {CHARACTERS.map((character, i) => {
            const unlocked = unlockedIds.has(character.id);
            const characterPalette = resolveCharacterCosmeticPalette(
              character,
              meta.characterSkinByCharacterId[character.id],
              meta.activePaletteId === DEFAULT_PALETTE_ID ? undefined : getActivePalette(meta.activePaletteId),
              meta.worldPaletteBlendEnabled,
            );
            return (
              <motion.article
                key={character.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`relative overflow-hidden border ${unlocked ? 'border-primary/40 bg-card' : 'border-border/50 bg-card/30'}`}
                data-testid={`card-character-visualizer-${character.id}`}
              >
                <div className={`relative h-44 flex items-end justify-center border-b border-border ${unlocked ? 'bg-gradient-to-b from-primary/15 to-black' : 'bg-black/50'}`}>
                  {unlocked ? (
                    <RigPortrait rig={character.rig} palette={characterPalette} anim="idle" size={164} />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/50">
                      <LockKeyhole className="h-8 w-8" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Visualizer locked</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-10">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h3 className={`text-xl font-black uppercase tracking-tight ${unlocked ? 'text-white' : 'text-muted-foreground'}`}>
                          {unlocked ? character.name : '???'}
                        </h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          {unlocked ? character.handle : describeUnlock(character.unlock)}
                        </p>
                      </div>
                      {unlocked && <span className="border border-primary/50 bg-primary/15 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-primary">Active</span>}
                    </div>
                  </div>
                </div>
                {unlocked ? (
                  <div className="space-y-4 p-4">
                    <p className="text-xs italic leading-relaxed text-muted-foreground">"{character.bio}"</p>
                    <div className="grid gap-3 border-t border-border/60 pt-3">
                      <div className="flex gap-3">
                        <WeaponIcon weaponId={character.weapon.id} kind={character.weapon.kind} color={character.weapon.color ?? characterPalette.accent} size={32} label={character.weapon.name} className="shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white">{character.weapon.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{character.weapon.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white">{character.ultimate.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{character.ultimate.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-xs italic text-muted-foreground/60">
                    Rescue or clear the required district to bring this survivor into focus.
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      </section>

      <div className="mb-4 flex items-center gap-3">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="text-xl font-black uppercase tracking-tight text-white">Known threats</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className={`grid gap-4 ${isListView ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
        {ENEMIES.map((enemy, i) => {
          const kills = meta.bestiary[enemy.id] ?? 0;
          const known = kills > 0;
          
          return (
            <motion.div 
              key={enemy.id} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`relative border flex flex-col overflow-hidden ${
                known ? 'border-border bg-card' : 'border-border/50 bg-card/30'
              }`}
              data-testid={`card-enemy-${enemy.id}`}
            >
              <div className="p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className={`text-xl font-black uppercase tracking-tight ${known ? 'text-white' : 'text-muted-foreground'}`}>
                      {known ? enemy.name : 'Unidentified'}
                    </h3>
                    <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${known ? 'text-primary' : 'text-muted-foreground/50'}`}>
                      {known ? enemy.family : 'No confirmed sighting'}
                    </p>
                  </div>
                  {known ? (
                    <div className="flex items-center gap-1.5 bg-black border border-border px-2 py-1">
                      <Skull className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-mono text-white font-bold">{kills}x</span>
                    </div>
                  ) : (
                    <Ghost className="w-6 h-6 text-muted-foreground/30" />
                  )}
                </div>

                {known ? (
                  <>
                    <div className="mb-6 flex flex-1 items-start gap-4">
                      <EnemyPreview enemy={enemy} />
                      <p className="pt-1 text-sm leading-relaxed text-muted-foreground">{enemy.lore}</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-4 border-t border-border/50">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">HP</span>
                        <span className="text-sm text-white font-mono">{enemy.hp}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">DMG</span>
                        <span className="text-sm text-white font-mono">{enemy.damage}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">SPD</span>
                        <span className="text-sm text-white font-mono">{enemy.speed}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">XP</span>
                        <span className="text-sm text-primary font-mono">{enemy.xp}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center min-h-[100px]">
                    <div className="h-px bg-border/50 w-full relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </ScreenLayout>
  );
}

export default BestiaryPanel;
