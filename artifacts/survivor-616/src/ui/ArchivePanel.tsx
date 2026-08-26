/**
 * Archive: rescued crew, discovered locations, and everything still locked.
 * Owned by the design pass -- keep the export name and props stable.
 */
import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import {
  LOKPET_ELEMENT_COLORS,
  LOKPET_RARITY_COLORS,
  LOKPET_SILHOUETTE_LABELS,
  LOKPET_VARIANTS,
} from '@/game/data/lokPets';
import { ALLIES, DISCOVERIES } from '@/game/data/progression';
import { STATUS_EFFECTS } from '@/game/data/statusEffects';
import { describeUnlock, useMeta } from '@/game/state/metaStore';
import { LokPetIcon } from './LokPetVariantSheet';
import { ScreenLayout } from './ScreenLayout';
import { motion } from 'framer-motion';
import { Trash2, Users, MapPin, User, Search, Sparkles } from 'lucide-react';
import { useEffect } from 'react';

export interface ArchivePanelProps {
  onBack: () => void;
  focusVariantId?: string;
}

export function ArchivePanel({ onBack, focusVariantId }: ArchivePanelProps) {
  const { meta, resetProgress } = useMeta();
  const catalogByVariant = new Map(meta.lokPetCatalog.map((entry) => [entry.variantId, entry]));

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
