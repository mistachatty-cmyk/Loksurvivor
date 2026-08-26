/**
 * Archive: rescued crew, discovered locations, and everything still locked.
 * Owned by the design pass -- keep the export name and props stable.
 */
import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { CHARACTER_EPISODES } from '@/game/data/episodes';
import { EVOLUTIONS_BY_ID } from '@/game/data/evolutions';
import {
  LOKPET_ELEMENT_COLORS,
  LOKPET_RARITY_COLORS,
  LOKPET_SILHOUETTE_LABELS,
  LOKPET_VARIANTS_BY_ID,
  LOKPET_VARIANTS,
} from '@/game/data/lokPets';
import { ALLIES, DISCOVERIES } from '@/game/data/progression';
import { STATUS_EFFECTS } from '@/game/data/statusEffects';
import { describeUnlock, episodeProgress, episodeStatus, useMeta } from '@/game/state/metaStore';
import { LokPetIcon } from './LokPetVariantSheet';
import { ScreenLayout } from './ScreenLayout';
import { motion } from 'framer-motion';
import { Trash2, Users, MapPin, User, Search, Sparkles, History, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface ArchivePanelProps {
  onBack: () => void;
  focusVariantId?: string;
}

export function ArchivePanel({ onBack, focusVariantId }: ArchivePanelProps) {
  const { meta, resetProgress } = useMeta();
  const [showHistory, setShowHistory] = useState(false);
  const catalogByVariant = new Map(meta.lokPetCatalog.map((entry) => [entry.variantId, entry]));
  const formatHistoryDate = (timestamp: number) => {
    if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > 8640000000000000) return 'Earlier run';
    return new Date(timestamp).toLocaleDateString();
  };

  useEffect(() => {
    if (!focusVariantId) return;
    document.getElementById(`lokpet-${focusVariantId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [focusVariantId]);

  const sections = [
    {
      title: 'Crew',
      icon: Users,
      count: meta.rescuedAllyIds.length,
      total: ALLIES.length,
      items: ALLIES.map(ally => {
        const found = meta.rescuedAllyIds.includes(ally.id);
        return {
          id: ally.id,
          name: found ? ally.name : 'Still out there',
          desc: found ? `${ally.role} · ${ally.boostLabel}` : 'Rescue them during a run',
          found,
          testId: `card-ally-${ally.id}`
        };
      })
    },
    {
      title: 'Discoveries',
      icon: Search,
      count: meta.discoveryIds.length,
      total: DISCOVERIES.length,
      items: DISCOVERIES.map(disc => {
        const found = meta.discoveryIds.includes(disc.id);
        return {
          id: disc.id,
          name: found ? disc.name : 'Undiscovered',
          desc: found ? disc.blurb : 'Find hidden locations',
          found,
          testId: `card-discovery-${disc.id}`
        };
      })
    },
    {
      title: 'Districts',
      icon: MapPin,
      count: meta.clearedAreaIds.length,
      total: AREAS.length,
      items: AREAS.map(area => {
        const cleared = meta.clearedAreaIds.includes(area.id);
        return {
          id: area.id,
          name: area.name,
          desc: cleared ? 'Cleared' : describeUnlock(area.unlock),
          found: cleared,
          testId: `card-district-${area.id}`
        };
      })
    },
    {
      title: 'Characters',
      icon: User,
      count: meta.unlockedCharacterIds.length,
      total: CHARACTERS.length,
      items: CHARACTERS.map(char => {
        const unlocked = meta.unlockedCharacterIds.includes(char.id);
        return {
          id: char.id,
          name: unlocked ? char.name : 'Locked',
          desc: unlocked ? char.tagline : describeUnlock(char.unlock),
          found: unlocked,
          testId: `card-character-${char.id}`
        };
      })
    },
    {
      title: 'Status Effects',
      icon: Sparkles,
      count: STATUS_EFFECTS.length,
      total: STATUS_EFFECTS.length,
      items: STATUS_EFFECTS.map(effect => ({
        id: effect.id,
        name: effect.name,
        desc: effect.description,
        found: true,
        testId: `card-status-effect-${effect.id}`
      }))
    },
    {
      title: 'Character Episodes',
      icon: BookOpen,
      count: meta.completedEpisodeIds.length,
      total: CHARACTER_EPISODES.length,
      items: CHARACTER_EPISODES.map((episode) => {
        const status = episodeStatus(episode.id, meta);
        const completed = status === 'completed';
        const progress = episodeProgress(episode.id, meta);
        const evolution = EVOLUTIONS_BY_ID[episode.evolutionId];
        return {
          id: episode.id,
          name: completed
            ? `${episode.title} · ${evolution?.name ?? 'Evolution'}`
            : status === 'locked' ? 'Classified episode' : episode.title,
          desc: completed
            ? `${episode.completionText} ${evolution?.description ?? ''}`
            : status === 'locked'
              ? 'Unlock the operative and discover this episode in the city.'
              : `${episode.teaser} · ${progress}/${episode.objective.targetCount}`,
          found: completed,
          testId: `card-episode-${episode.id}`,
        };
      }),
    }
  ];

  return (
    <ScreenLayout 
      title="Archive" 
      subtitle="Records & Secrets"
      onBack={onBack}
      action={
        <button
          type="button"
          onClick={resetProgress}
          className="flex items-center gap-2 px-4 py-2 border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground font-bold uppercase tracking-widest text-xs transition-colors"
          data-testid="button-reset-progress"
        >
          <Trash2 className="w-4 h-4" />
          Wipe Progress
        </button>
      }
    >
      <div className="space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="section-lokpet-catalog"
        >
          <div className="mb-6 flex items-center gap-3 border-b border-border pb-2">
            <Sparkles className="h-5 w-5 text-pink-300" />
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white">LokPet Catalog</h2>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Temporary companions, permanent discoveries</p>
            </div>
            <span className="ml-auto font-mono text-sm font-bold text-muted-foreground">
              {catalogByVariant.size} / {LOKPET_VARIANTS.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {LOKPET_VARIANTS.map((variant) => {
              const entry = catalogByVariant.get(variant.id);
              const found = Boolean(entry);
              return (
                <article
                  key={variant.id}
                  id={`lokpet-${variant.id}`}
                  className={`border border-l-4 p-4 transition-shadow ${found ? 'border-border border-l-pink-300 bg-card' : 'border-border/50 border-l-border/50 bg-card/30'} ${focusVariantId === variant.id ? 'ring-2 ring-pink-200/80 ring-offset-2 ring-offset-background' : ''}`}
                  data-testid={`card-lokpet-${variant.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={found ? '' : 'opacity-25 grayscale'}>
                      <LokPetIcon silhouette={variant.silhouette} palette={variant.palette} className="h-12 w-12" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className={`truncate text-sm font-black uppercase tracking-wide ${found ? 'text-white' : 'text-muted-foreground'}`}>
                            {found ? variant.name : 'Unknown signal'}
                          </h3>
                          <p className={`mt-1 text-[10px] font-bold uppercase tracking-widest ${found ? 'text-pink-300' : 'text-muted-foreground/60'}`}>
                            {found ? `${variant.family} · ${LOKPET_SILHOUETTE_LABELS[variant.silhouette]}` : 'Undiscovered LokPet'}
                          </p>
                        </div>
                        {found && (
                          <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-white/40">
                            {entry?.sightings ?? 0} seen
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {found && entry ? (
                    <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
                      <p className="text-xs leading-relaxed text-muted-foreground">{variant.description}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Rarity</span>
                        {entry.rarities.map((rarity) => (
                          <span
                            key={rarity}
                            className="border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] uppercase"
                            style={{ color: LOKPET_RARITY_COLORS[rarity] }}
                          >
                            {rarity}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Traits</span>
                        {entry.traits.map((trait) => (
                          <span
                            key={`${trait.attackKind}:${trait.element}`}
                            className="border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] uppercase"
                            style={{ color: LOKPET_ELEMENT_COLORS[trait.element] }}
                            title={trait.label}
                          >
                            {trait.label}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5" title="Recorded palette">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Palette</span>
                        {[variant.palette.body, variant.palette.bodyDark, variant.palette.accent, variant.palette.glow].map((color) => (
                          <span key={color} className="h-3 w-3 border border-white/20" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 border-t border-white/10 pt-3 text-xs italic text-muted-foreground/60">
                      Open a blue loot box during a run to catalogue this signal.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="section-lokpet-history"
        >
          <div className="flex flex-col gap-3 border border-pink-300/20 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <History className="mt-0.5 h-5 w-5 shrink-0 text-pink-300" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Discovery history</h2>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {meta.lokPetHistory.length > 0
                    ? `${meta.lokPetHistory.length} run${meta.lokPetHistory.length === 1 ? '' : 's'} logged · first sightings and new intel`
                    : 'Run a blue loot box to start your permanent log'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowHistory((visible) => !visible)}
              className="inline-flex items-center justify-center gap-2 border border-pink-300/40 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-pink-200 transition-colors hover:border-pink-200 hover:bg-pink-300/10 sm:shrink-0"
              aria-expanded={showHistory}
              data-testid="button-toggle-lokpet-history"
            >
              {showHistory ? 'Hide history' : 'View history'}
              {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {showHistory && (
            <div className="mt-3 space-y-3" data-testid="lokpet-history-list">
              {meta.lokPetHistory.length === 0 ? (
                <div className="border border-dashed border-white/15 bg-black/20 p-5 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">No signals logged yet</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">Generated LokPets will appear here after the run ends.</p>
                </div>
              ) : (
                meta.lokPetHistory.map((run) => (
                  <article key={`${run.runNumber}-${run.recordedAt}`} className="border border-white/10 bg-card p-4" data-testid={`lokpet-history-run-${run.runNumber}`}>
                    <div className="flex flex-col gap-1 border-b border-white/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-white">
                          Run {run.runNumber} · {AREAS.find((area) => area.id === run.areaId)?.name ?? 'Unknown district'}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {CHARACTERS.find((character) => character.id === run.characterId)?.name ?? 'Unknown operative'} · {run.cleared ? 'block cleared' : 'run ended'}
                        </p>
                      </div>
                      <time className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground" dateTime={run.recordedAt > 0 && run.recordedAt <= 8640000000000000 ? new Date(run.recordedAt).toISOString() : undefined}>
                        {formatHistoryDate(run.recordedAt)}
                      </time>
                    </div>
                    <div className="mt-3 space-y-2">
                      {run.discoveries.map((discovery) => {
                        const variant = LOKPET_VARIANTS_BY_ID[discovery.variantId];
                        if (!variant) return null;
                        const hasNewData = discovery.newVariant || discovery.newRarities.length > 0 || discovery.newTraits.length > 0;
                        return (
                          <div key={discovery.variantId} className="border border-white/10 bg-black/20 px-3 py-2.5" data-testid={`lokpet-history-${run.runNumber}-${discovery.variantId}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <LokPetIcon silhouette={variant.silhouette} palette={variant.palette} className="h-7 w-7 shrink-0" />
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-black uppercase tracking-wide text-white">{variant.name}</p>
                                  <p className={`mt-0.5 text-[9px] font-bold uppercase tracking-widest ${hasNewData ? 'text-pink-200' : 'text-muted-foreground'}`}>
                                    {discovery.newVariant ? 'First sighting' : hasNewData ? 'New catalog data' : 'Repeat sighting'}
                                  </p>
                                </div>
                              </div>
                              <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                                {discovery.sightings} seen · {discovery.totalSightings} total
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {discovery.newVariant && (
                                <span className="border border-pink-300/40 bg-pink-300/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-pink-100">Variant logged</span>
                              )}
                              {discovery.newRarities.map((rarity) => (
                                <span key={rarity} className="border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ color: LOKPET_RARITY_COLORS[rarity] }}>
                                  New rarity: {rarity}
                                </span>
                              ))}
                              {discovery.newTraits.map((trait) => (
                                <span key={`${trait.attackKind}:${trait.element}`} className="border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ color: LOKPET_ELEMENT_COLORS[trait.element] }}>
                                  New trait: {trait.label}
                                </span>
                              ))}
                              {!hasNewData && <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">No duplicate discovery</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </motion.section>

        {sections.map((section, sIdx) => {
          const Icon = section.icon;
          return (
            <motion.section 
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sIdx * 0.1 }}
            >
              <div className="flex items-center gap-3 mb-6 border-b border-border pb-2">
                <Icon className="w-5 h-5 text-primary" />
                <h2 className="text-2xl font-black uppercase tracking-tight text-white">{section.title}</h2>
                <span className="ml-auto font-mono text-sm text-muted-foreground font-bold">
                  {section.count} / {section.total}
                </span>
              </div>
              
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map(item => (
                  <li 
                    key={item.id} 
                    className={`p-4 border border-l-4 ${
                      item.found 
                        ? 'border-border border-l-primary bg-card text-white' 
                        : 'border-border/50 border-l-border/50 bg-card/30 text-muted-foreground'
                    }`}
                    data-testid={item.testId}
                  >
                    <p className="font-bold uppercase tracking-wide text-sm mb-1">{item.name}</p>
                    <p className={`text-xs ${item.found ? 'text-muted-foreground' : 'opacity-70'}`}>
                      {item.desc}
                    </p>
                  </li>
                ))}
              </ul>
            </motion.section>
          );
        })}
      </div>
    </ScreenLayout>
  );
}

export default ArchivePanel;
