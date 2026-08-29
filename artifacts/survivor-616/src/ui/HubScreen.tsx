/**
 * The hideout. Room navigation plus entry points into every other surface.
 * Owned by the design pass -- keep the export name and props stable.
 */
import { useMeta, describeUnlock } from '@/game/state/metaStore';
import { CREW_ACTIVITIES_BY_ID, preferredActivitiesForAlly } from '@/game/data/crewActivities';
import { getCrewRumor } from '@/game/data/crewRumors';
import { getHideoutScene, weatherClass } from '@/game/data/hideout';
import { humanoidRig } from '@/game/sprites/rigs';
import { RigPortrait } from './RigPortrait';
import { HideoutVignette } from './HideoutVignette';
import { FirstNightBoard } from './FirstNightBoard';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Skull, Users, Music, Unlock, Lock, ArrowRight, Package, Settings2, Waves, SprayCan, Utensils, CloudRain, Snowflake, Sun, CloudFog, Building2, RadioTower, Trees, Compass, Map as MapIcon, Radio, ShieldCheck, Sparkles, PackageCheck, Bell, Magnet, Hammer, MonitorDot, Lamp, BookOpen, PartyPopper } from 'lucide-react';
import type { AllyDef, CrewActivityIcon } from '@/game/types';

/** Small rig built on the fly for a rescued ally -- matches the crew-card portrait's params. */
function allyRig(ally: AllyDef) {
  return humanoidRig({ height: 18 + (ally.id.length % 4), width: 9 + (ally.id.length % 3), seated: ally.id === 'sable' });
}

export type HubPanel = 'runs' | 'roster' | 'bestiary' | 'music' | 'studio' | 'unlocks' | 'recovery' | 'vendor' | 'workshop' | 'settings';

export interface HubScreenProps {
  /** Currently displayed hideout room id. */
  roomId: string;
  onChangeRoom: (roomId: string) => void;
  onOpen: (panel: HubPanel) => void;
  onOpenMapEditor: () => void;
}

const PANEL_CONFIG: Record<HubPanel, { label: string; icon: any; testId: string; description: string }> = {
  runs: { label: 'Head out', icon: ArrowRight, testId: 'button-open-runs', description: 'Hit the streets' },
  roster: { label: 'Roster', icon: Users, testId: 'button-open-roster', description: 'Choose your fighter' },
  bestiary: { label: 'Bestiary', icon: Skull, testId: 'button-open-bestiary', description: 'Known threats' },
  unlocks: { label: 'Archive', icon: Unlock, testId: 'button-open-unlocks', description: 'Progress & secrets' },
  music: { label: 'Soundtrack', icon: Music, testId: 'button-open-music', description: 'Set the mood' },
  studio: { label: 'Studio', icon: RadioTower, testId: 'button-open-studio', description: 'Remix & record' },
  recovery: { label: 'Recovery', icon: Waves, testId: 'button-open-recovery', description: 'Let the crew breathe' },
  vendor: { label: 'Quartermaster', icon: Package, testId: 'button-open-vendor', description: 'Permanent kit & contracts' },
  workshop: { label: 'Relic Workshop', icon: Hammer, testId: 'button-open-workshop', description: 'City recipes & run edges' },
  settings: { label: 'Settings', icon: Settings2, testId: 'button-open-settings', description: 'Controls & accessibility' },
};

const WEATHER_ICONS = { rain: CloudRain, fog: CloudFog, snow: Snowflake, heat: Sun, clear: Sun } as const;
const ACTIVITY_ICONS = {
  utensils: Utensils,
  shield: ShieldCheck,
  package: PackageCheck,
  compass: Compass,
  map: MapIcon,
  radio: Radio,
  sparkles: Sparkles,
} satisfies Record<CrewActivityIcon, typeof Utensils>;
const RUMOR_ICONS: Record<string, typeof Bell> = {
  bell: Bell,
  'spray-can': SprayCan,
  utensils: Utensils,
  radio: Radio,
  magnet: Magnet,
};

export function HubScreen({ roomId, onChangeRoom, onOpen, onOpenMapEditor }: HubScreenProps) {
  const { unlockedRooms, lockedRooms, rescuedAllies, selectedCharacter, meta, lastRun } = useMeta();

  const activeRoom = unlockedRooms.find(r => r.id === roomId) || unlockedRooms[0];
  const roomAllies = rescuedAllies.filter(ally => ally.room === activeRoom?.id);
  const newlyRescuedAlly = lastRun?.rescuedAllyId
    ? roomAllies.find((ally) => ally.id === lastRun.rescuedAllyId)
    : undefined;
  const activeRumor = meta.activeCrewRumor ? getCrewRumor(meta.activeCrewRumor.rumorId) : undefined;
  const rumorAlly = meta.activeCrewRumor
    ? rescuedAllies.find((ally) => ally.id === meta.activeCrewRumor?.allyId)
    : undefined;
  const RumorIcon = activeRumor ? (RUMOR_ICONS[activeRumor.icon] ?? Radio) : Radio;
  const scene = getHideoutScene(activeRoom?.id ?? roomId);
  const [isPageVisible, setIsPageVisible] = useState(true);

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(document.visibilityState === 'visible');
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  const weatherIcon = WEATHER_ICONS[scene.weather];
  const crewMoment = useMemo(
    () => scene.flavorLines[(roomAllies.length + (selectedCharacter.id.length % scene.flavorLines.length)) % scene.flavorLines.length],
    [roomAllies.length, scene.flavorLines, selectedCharacter.id],
  );

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
           <div
             className={`hideout-ambient absolute inset-0 z-20 ${weatherClass(scene.weather)}`}
             style={{ '--scene-accent': scene.homeAccent, '--scene-sky': scene.skyAccent, animationPlayState: isPageVisible ? 'running' : 'paused' } as React.CSSProperties}
             aria-hidden="true"
           >
             <div className="hideout-sky-glow" />
             <div className="hideout-cloud hideout-cloud-one" />
             <div className="hideout-cloud hideout-cloud-two" />
             <div className={`hideout-fliers hideout-fliers-${scene.motionKind}`}>
               <span className="hideout-flier flier-one">{scene.motionKind === 'motes' ? '✦' : scene.motionKind === 'drones' ? '◆' : '⌁'}</span>
               <span className="hideout-flier flier-two">{scene.motionKind === 'motes' ? '·' : scene.motionKind === 'drones' ? '◇' : '⌁'}</span>
               <span className="hideout-flier flier-three">{scene.motionKind === 'motes' ? '✦' : scene.motionKind === 'drones' ? '◆' : '⌁'}</span>
             </div>
             <div className="hideout-weather-particles" />
             <div className="hideout-home-art">
               {scene.biome === 'sanctum' && <div className="hideout-window-grid"><span /><span /><span /></div>}
               {scene.biome === 'rooftop' && <RadioTower className="h-20 w-20 opacity-40" />}
               {scene.biome === 'cellar' && <Trees className="h-20 w-20 opacity-35" />}
               {scene.biome === 'alley' && <Lamp className="h-20 w-20 opacity-40" />}
               {scene.biome === 'archive' && <BookOpen className="h-20 w-20 opacity-35" />}
             </div>
           </div>
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

          {lockedRooms.length > 0 && (
            <div
              className="mb-6 flex flex-wrap gap-2"
              data-testid="hideout-locked-rooms"
            >
              {lockedRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center gap-2 border border-dashed border-border px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground/70"
                  title={describeUnlock(room.unlock)}
                  data-testid={`locked-room-${room.id}`}
                >
                  <Lock className="h-3 w-3" />
                  <span>{room.name}</span>
                  <span className="hidden font-normal normal-case tracking-normal text-muted-foreground/60 sm:inline">
                    — {describeUnlock(room.unlock)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 bg-card border border-border">
            <h2 className="text-xl font-bold text-white mb-1">{activeRoom.subtitle}</h2>
            <p className="text-sm text-muted-foreground">{activeRoom.description}</p>
          </div>
            <div className="mt-3 grid gap-3 border border-primary/30 bg-black/35 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center" data-testid="hideout-scene">
             <div className="flex items-center gap-3">
               <span className="grid h-10 w-10 place-items-center border border-primary/40 bg-primary/10 text-primary">
                 {(() => { const Icon = weatherIcon; return <Icon className="h-5 w-5" />; })()}
               </span>
               <div>
                 <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{scene.weatherLabel}</p>
                 <p className="text-xs text-muted-foreground">{scene.weatherDescription}</p>
               </div>
             </div>
             <div className="hidden h-px bg-border sm:block" />
              <div className="flex flex-col gap-3 text-right sm:items-end">
                <div className="flex items-center gap-2">
                  <Building2 className="hidden h-4 w-4 text-primary sm:block" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">{scene.homeName}</p>
                    <p className="text-[11px] text-muted-foreground">{scene.homeDescription}</p>
                  </div>
                </div>
                {activeRoom.id === 'main-floor' && (
                  <button
                    type="button"
                    onClick={onOpenMapEditor}
                    data-testid="button-hideout-computer"
                    className="group flex items-center gap-3 border border-cyan-200/35 bg-cyan-950/30 px-3 py-2 text-left transition hover:border-cyan-200/80 hover:bg-cyan-950/60"
                  >
                    <MonitorDot className="h-5 w-5 text-cyan-200 transition group-hover:text-white" />
                    <span>
                      <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-100">Sanctum computer</span>
                      <span className="block text-[10px] text-cyan-100/60">Open map builder</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-cyan-200/70" />
                  </button>
                )}
              </div>
           </div>
        </header>

        <section className="mb-8 border border-[#fbbf24]/45 bg-black/45 p-4 sm:p-5" data-testid="section-crew-rumor">
          {activeRumor && meta.activeCrewRumor && rumorAlly ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div
                className="grid h-20 w-20 shrink-0 place-items-center border-2 bg-black/60"
                style={{ borderColor: activeRumor.accent, color: activeRumor.accent, boxShadow: `0 0 24px ${activeRumor.accent}33` }}
              >
                <RumorIcon className="h-10 w-10" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: activeRumor.accent }}>Rumor for the road</p>
                  <span className="border border-[#fbbf24]/40 bg-[#fbbf24]/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#fbbf24]">Active next run</span>
                </div>
                <h2 className="mt-1 text-2xl font-black uppercase text-white">{activeRumor.name}</h2>
                <p className="mt-1 font-mono text-xs uppercase tracking-widest text-white/60">Brought by {rumorAlly.name}</p>
                <p className="mt-3 max-w-2xl text-sm italic leading-relaxed text-muted-foreground">“{activeRumor.story}”</p>
                <div className="mt-3 border-l-2 pl-3" style={{ borderColor: activeRumor.accent }}>
                  <p className="text-xs font-bold uppercase tracking-widest text-white">{activeRumor.effectLabel}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{activeRumor.effectDescription}</p>
                </div>
              </div>
            </div>
          ) : rescuedAllies.length === 0 ? (
            <div className="flex items-center gap-3" data-testid="text-rumor-no-crew">
              <Radio className="h-7 w-7 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">Rumor board quiet</p>
                <p className="mt-1 text-sm text-muted-foreground">Rescue someone from the streets before the hideout can send a rumor ahead.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3" data-testid="text-rumor-quiet">
              <Radio className="h-7 w-7 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">No rumor active</p>
                <p className="mt-1 text-sm text-muted-foreground">The crew has nothing strange to report yet. The next return may change that.</p>
              </div>
            </div>
          )}
        </section>

        <section className="mb-8">
          <FirstNightBoard compact />
        </section>

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

         {newlyRescuedAlly && (
           <section className="mb-8 border border-emerald-300/40 bg-emerald-950/20 p-4 sm:p-5" data-testid="section-welcome-home">
             <div className="mb-3 flex items-center gap-2">
               <PartyPopper className="h-5 w-5 text-emerald-300" />
               <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Welcome home</p>
             </div>
             <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
               <HideoutVignette
                 left={{ name: selectedCharacter.name, rig: selectedCharacter.rig, palette: selectedCharacter.palette }}
                 right={{ name: newlyRescuedAlly.name, rig: allyRig(newlyRescuedAlly), palette: newlyRescuedAlly.palette }}
                 size={110}
               />
               <p className="text-sm text-white/80">
                 <span className="font-black uppercase text-white">{newlyRescuedAlly.name}</span> made it back with {selectedCharacter.name}.
                 {' '}{newlyRescuedAlly.boostLabel}
               </p>
             </div>
           </section>
         )}

         {activeRoom.features.includes('allies') && (
          <section className="mt-auto">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Crew in room ({roomAllies.length})
            </h2>
            {roomAllies.length === 0 ? (
               <div className="border border-dashed border-border bg-card/30 p-4">
                 <p className="text-sm italic text-muted-foreground">Nobody is here right now.</p>
                 <p className="mt-1 text-xs uppercase tracking-widest text-primary/80">The room is waiting for a friend</p>
               </div>
            ) : (
               <>
               <p className="mb-3 border-l-2 border-primary/60 pl-3 text-xs italic text-muted-foreground" data-testid="crew-moment">{crewMoment}</p>
              <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {roomAllies.map((ally) => {
                  const activity = CREW_ACTIVITIES_BY_ID[meta.crewActivityByAlly[ally.id]];
                  const preferences = preferredActivitiesForAlly(ally.id);
                  const ActivityIcon = activity ? ACTIVITY_ICONS[activity.icon] : Users;
                  return (
                    <li key={ally.id} className="flex gap-3 border border-border bg-card/60 p-3" data-testid={`crew-activity-${ally.id}`}>
                      <div className="grid h-20 w-20 shrink-0 place-items-center border border-primary/40 bg-primary/10">
                        <RigPortrait
                          rig={allyRig(ally)}
                          palette={ally.palette}
                          anim="idle"
                          size={72}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-black uppercase tracking-wide text-white text-sm">{ally.name}</span>
                          <ActivityIcon className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                        </div>
                        {activity ? (
                          <>
                            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-primary">{activity.name}</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{activity.description}</p>
                            <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">{activity.benefitLabel}</p>
                          </>
                        ) : (
                          <p className="mt-1 text-xs italic text-muted-foreground">Still deciding what sounds good tonight.</p>
                        )}
                        <span className="mt-2 block border-t border-border/50 pt-2 text-[10px] text-muted-foreground">{ally.boostLabel}</span>
                        {preferences.length > 1 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {preferences.map((preference) => {
                              const PreferenceIcon = ACTIVITY_ICONS[preference.icon];
                              const isPicked = preference.id === activity?.id;
                              return (
                                <div
                                  key={preference.id}
                                  className={`flex items-center gap-1 border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                    isPicked ? 'border-primary/70 bg-primary/15 text-white' : 'border-border text-muted-foreground'
                                  }`}
                                  data-picked={isPicked}
                                >
                                  <PreferenceIcon className="h-2.5 w-2.5" aria-hidden="true" />
                                  {preference.name}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
               </>
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
