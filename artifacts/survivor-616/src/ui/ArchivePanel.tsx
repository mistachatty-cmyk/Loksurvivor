/**
 * Archive: rescued crew, discovered locations, and everything still locked.
 * Owned by the design pass -- keep the export name and props stable.
 */
import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { ALLIES, DISCOVERIES } from '@/game/data/progression';
import { STATUS_EFFECTS } from '@/game/data/statusEffects';
import { describeUnlock, useMeta } from '@/game/state/metaStore';
import { ScreenLayout } from './ScreenLayout';
import { motion } from 'framer-motion';
import { Trash2, Users, MapPin, User, Search, Sparkles } from 'lucide-react';

export interface ArchivePanelProps {
  onBack: () => void;
}

export function ArchivePanel({ onBack }: ArchivePanelProps) {
  const { meta, resetProgress } = useMeta();

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
