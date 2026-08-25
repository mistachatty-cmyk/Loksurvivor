/**
 * The hideout. Room navigation plus entry points into every other surface.
 * Owned by the design pass -- keep the export name and props stable.
 */
import { useEffect, useState } from 'react';
import { useMeta } from '@/game/state/metaStore';
import { HUB_ROOMS_BY_ID } from '@/game/data/progression';
import { motion, AnimatePresence } from 'framer-motion';
import { Skull, Users, BookOpen, Music, Unlock, ArrowRight, Package } from 'lucide-react';
import { HideoutVignette } from './HideoutVignette';

export type HubPanel = 'runs' | 'roster' | 'bestiary' | 'music' | 'unlocks';

export interface HubScreenProps {
  /** Currently displayed hideout room id. */
  roomId: string;
  onChangeRoom: (roomId: string) => void;
  onOpen: (panel: HubPanel) => void;
}

const PANEL_CONFIG: Record<HubPanel, { label: string; icon: any; testId: string; description: string }> = {
  runs: { label: 'Head out', icon: ArrowRight, testId: 'button-open-runs', description: 'Hit the streets' },
  roster: { label: 'Roster', icon: Users, testId: 'button-open-roster', description: 'Choose your fighter' },
  bestiary: { label: 'Bestiary', icon: Skull, testId: 'button-open-bestiary', description: 'Known threats' },
  unlocks: { label: 'Archive', icon: Unlock, testId: 'button-open-unlocks', description: 'Progress & secrets' },
  music: { label: 'Soundtrack', icon: Music, testId: 'button-open-music', description: 'Set the mood' },
};

export function HubScreen({ roomId, onChangeRoom, onOpen }: HubScreenProps) {
  const { unlockedRooms, rescuedAllies, selectedCharacter, meta } = useMeta();

  const activeRoom = unlockedRooms.find(r => r.id === roomId) || unlockedRooms[0];
  const roomAllies = rescuedAllies.filter(ally => ally.room === activeRoom?.id);

  const [pairIndex, setPairIndex] = useState(0);

  useEffect(() => {
    setPairIndex(0);
    if (roomAllies.length < 2) return;
    const id = setInterval(() => {
      setPairIndex((i) => (i + 1) % roomAllies.length);
    }, 8000 + Math.random() * 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.id, roomAllies.length]);

  if (!activeRoom) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[100dvh] bg-background text-foreground flex flex-col relative overflow-hidden"
    >
      <AnimatePresence mode="wait">
        <motion.div 
          key={activeRoom.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 z-0 pointer-events-none"
        >
          <div className="absolute inset-0 bg-background/90 z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
          <img src={`${import.meta.env.BASE_URL}${activeRoom.backdrop}`} className="w-full h-full object-cover opacity-40 mix-blend-luminosity grayscale" alt="" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-20 flex-1 flex flex-col p-6">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-primary text-xs uppercase tracking-[0.3em] font-bold mb-2">The Sanctum</p>
              <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-md">Hideout</h1>
            </div>
            <div className="text-left sm:text-right border-l-2 sm:border-l-0 sm:border-r-2 border-primary pl-4 sm:pl-0 sm:pr-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Session Stats</p>
              <p className="text-sm font-bold">
                <span className="text-white">{meta.totalRuns}</span> runs <span className="opacity-50">/</span> <span className="text-white">{meta.totalKills}</span> defeated <span className="opacity-50">/</span> <span className="text-white">{meta.cred}</span> cred
              </p>
              {meta.lootTokens > 0 && (
                <p className="text-xs font-mono text-amber-400 mt-1">
                  <Package className="inline w-3 h-3 mr-1" />{meta.lootTokens} loot tokens
                </p>
              )}
            </div>
          </div>

          <nav className="flex flex-wrap gap-2 mb-6">
            {unlockedRooms.map((room) => {
              const isActive = room.id === roomId;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onChangeRoom(room.id)}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all border ${
                    isActive 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-white'
                  }`}
                  data-active={isActive}
                  data-testid={`button-room-${room.id}`}
                >
                  {room.name}
                </button>
              );
            })}
          </nav>
          
          <div className="p-4 bg-card border border-border">
            <h2 className="text-xl font-bold text-white mb-1">{activeRoom.subtitle}</h2>
            <p className="text-sm text-muted-foreground">{activeRoom.description}</p>
          </div>
        </header>

        <section className="mb-10 flex-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px bg-border flex-1" />
            <p className="text-xs uppercase tracking-widest text-primary font-bold">Playing as <span className="text-white">{selectedCharacter.name}</span></p>
            <div className="h-px bg-border flex-1" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {activeRoom.features.map(feature => {
              // 'allies' is rendered separately below, skip it here
              if (feature === 'allies') return null;
              
              const config = PANEL_CONFIG[feature as HubPanel];
              if (!config) return null;
              
              const Icon = config.icon;
              const isPrimary = feature === 'runs';

              return (
                <button 
                  key={feature}
                  type="button" 
                  onClick={() => onOpen(feature as HubPanel)} 
                  className={`group relative p-6 text-left border flex flex-col gap-4 transition-all overflow-hidden ${
                    isPrimary 
                      ? 'bg-primary text-primary-foreground border-primary hover:bg-white' 
                      : 'bg-card border-border hover:border-primary'
                  }`}
                  data-testid={config.testId}
                >
                  {isPrimary && (
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[shimmer_2s_infinite] pointer-events-none" />
                  )}
                  <Icon className={`w-8 h-8 ${isPrimary ? 'text-primary-foreground' : 'text-primary group-hover:text-white transition-colors'}`} />
                  <div className="relative z-10">
                    <h3 className={`text-2xl font-black uppercase tracking-tight ${isPrimary ? 'text-primary-foreground' : 'text-white'}`}>{config.label}</h3>
                    <p className={`text-xs uppercase tracking-wider mt-1 ${isPrimary ? 'text-primary-foreground/80' : 'text-muted-foreground group-hover:text-gray-300'}`}>
                      {config.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {activeRoom.features.includes('allies') && (
          <section className="mt-auto">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Crew in room ({roomAllies.length})
            </h2>
            {roomAllies.length === 0 ? (
              <p className="text-sm opacity-50 italic">Nobody is here right now.</p>
            ) : roomAllies.length === 1 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {roomAllies.map((ally) => (
                  <li key={ally.id} className="flex flex-col p-3 border border-border bg-card/50">
                    <span className="font-bold text-white text-sm uppercase tracking-wide">{ally.name}</span>
                    <span className="text-xs text-primary mt-1">{ally.boostLabel}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <AnimatePresence mode="wait">
                {(() => {
                  const a = roomAllies[pairIndex % roomAllies.length]!;
                  const b = roomAllies[(pairIndex + 1) % roomAllies.length]!;
                  return (
                    <motion.div
                      key={`${activeRoom.id}-${a.id}-${b.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="flex flex-col items-center gap-2 p-4 border border-border bg-card/50 w-fit"
                    >
                      <HideoutVignette
                        left={{ name: a.name, rig: a.rig, palette: a.palette }}
                        right={{ name: b.name, rig: b.rig, palette: b.palette }}
                      />
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">
                        {a.name} &amp; {b.name}
                      </p>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            )}
          </section>
        )}

        {/* Token balance — spending wired in a later task */}
        {meta.lootTokens > 0 && (
          <section className="mt-6 border border-amber-900/40 bg-amber-950/20 px-5 py-3 flex items-center gap-3" data-testid="section-tokens">
            <Package className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-mono text-sm text-amber-300 font-bold">{meta.lootTokens}</span>
              <span className="ml-1.5 font-mono text-xs text-muted-foreground uppercase tracking-widest">loot tokens — token shop coming soon</span>
            </div>
          </section>
        )}
      </div>
    </motion.div>
  );
}

export default HubScreen;
