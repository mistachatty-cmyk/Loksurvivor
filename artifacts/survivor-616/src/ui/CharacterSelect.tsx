/**
 * Roster / character picker. Owned by the design pass -- keep the export
 * name and props stable.
 */
import { describeUnlock, effectiveStats, useMeta } from '@/game/state/metaStore';
import { ScreenLayout } from './ScreenLayout';
import { RigPortrait } from './RigPortrait';
import { motion } from 'framer-motion';
import { Shield, Zap, Swords } from 'lucide-react';
import { CharacterAbilityVisualizer } from './CharacterAbilityVisualizer';
import { LokPetVariantSheet } from './LokPetVariantSheet';

export interface CharacterSelectProps {
  onBack: () => void;
  /** Called after the player commits to a character. */
  onConfirm: () => void;
}

export function CharacterSelect({ onBack, onConfirm }: CharacterSelectProps) {
  const { unlockedCharacters, lockedCharacters, selectedCharacter, selectCharacter, meta } = useMeta();

  return (
    <ScreenLayout 
      title="Roster" 
      subtitle="Assemble the crew"
      onBack={onBack}
      action={
        <button 
          type="button" 
          onClick={onConfirm} 
          className="px-6 py-4 bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm hover:bg-white transition-colors" 
          data-testid="button-confirm-character"
        >
          Take {selectedCharacter.name} out
        </button>
      }
    >
      <CharacterAbilityVisualizer character={selectedCharacter} />
      <LokPetVariantSheet />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {unlockedCharacters.map((character, i) => {
          const stats = effectiveStats(character, meta);
          const isSelected = character.id === selectedCharacter.id;
          
          return (
            <motion.button
              key={character.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              type="button"
              onClick={() => selectCharacter(character.id)}
              className={`group relative w-full text-left border flex flex-col overflow-hidden transition-all duration-300 ${
                isSelected 
                  ? 'border-primary ring-1 ring-primary bg-card/80' 
                  : 'border-border bg-card hover:border-primary/50'
              }`}
              data-selected={isSelected}
              data-testid={`button-character-${character.id}`}
            >
              {/* Image Header */}
              <div className="relative h-40 bg-black overflow-hidden border-b border-border">
                {character.referenceArt && (
                  <>
                    <div className="absolute inset-0 bg-primary/20 mix-blend-overlay z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <img
                      src={`${import.meta.env.BASE_URL}${character.referenceArt}`}
                      alt=""
                      aria-hidden="true"
                      className="absolute -top-1/4 -left-1/4 w-[150%] h-auto max-w-none mix-blend-lighten filter grayscale contrast-125 blur-md opacity-30 scale-110"
                    />
                  </>
                )}
                <div
                  className={`absolute inset-0 z-10 flex items-end justify-center transition-transform duration-500 ${
                    isSelected ? 'scale-110' : 'group-hover:scale-110'
                  }`}
                >
                  <RigPortrait rig={character.rig} palette={character.palette} anim="idle" size={128} />
                </div>
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-2 py-1 text-[10px] font-bold uppercase tracking-widest z-20">
                    Selected
                  </div>
                )}
                <div className="absolute bottom-3 left-3 z-20">
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight drop-shadow-md">{character.name}</h2>
                  <p className="text-xs text-primary font-bold uppercase tracking-wider">{character.handle}</p>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex-1 flex flex-col">
                <p className="text-xs text-muted-foreground italic mb-4">"{character.tagline}"</p>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 text-xs">
                  <div className="flex items-center justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground uppercase tracking-wider">Health</span>
                    <span className="font-bold text-white">{Math.round(stats.maxHp)}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground uppercase tracking-wider">Speed</span>
                    <span className="font-bold text-white">{Math.round(stats.speed)}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground uppercase tracking-wider">Power</span>
                    <span className="font-bold text-white">x{stats.power.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground uppercase tracking-wider">Armor</span>
                    <span className="font-bold text-white">{(stats.armor * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Swords className="w-3 h-3 text-primary" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white">{character.weapon.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{character.weapon.description}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-3 h-3 text-primary" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-white">{character.ultimate.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{character.ultimate.description}</p>
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}

        {lockedCharacters.map((character, i) => (
          <motion.div 
            key={character.id} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (unlockedCharacters.length + i) * 0.05 }}
            className="w-full border border-border bg-card/30 p-6 flex flex-col justify-center items-center text-center opacity-60 grayscale"
          >
            <Shield className="w-8 h-8 text-muted-foreground mb-4" />
            <h2 className="text-xl font-black text-muted-foreground uppercase tracking-tight mb-2">???</h2>
            <p className="text-xs text-primary font-bold uppercase tracking-wider max-w-[200px]">
              {describeUnlock(character.unlock)}
            </p>
          </motion.div>
        ))}
      </div>
    </ScreenLayout>
  );
}

export default CharacterSelect;
