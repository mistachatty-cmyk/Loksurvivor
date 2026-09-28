import { Check, Lock, ScanEye } from 'lucide-react';
import { DIRECTORS } from '@/game/data/directors';
import { useMeta } from '@/game/state/metaStore';
import { ScreenLayout } from './ScreenLayout';

export interface DirectorTerminalPanelProps {
  onBack: () => void;
}

function effectReadout(director: (typeof DIRECTORS)[number]) {
  switch (director.effect.kind) {
    case 'spawnBias':
      return `Run effect: all waves arrive ${Math.round((director.effect.spawnRateMult - 1) * 100)}% faster and enemies gain ${Math.round((director.effect.hpMult - 1) * 100)}% integrity.`;
    case 'factionFavor':
      return `Run effect: ${director.name}'s favored faction appears ${Math.round((director.effect.spawnRateMult - 1) * 100)}% more often in compatible waves.`;
    default:
      return 'Run effect: no global modifier. The original Reel Syndicate encounter remains the balanced baseline.';
  }
}

/**
 * The Digital Archive's terminal into whatever runs the Directors. Each
 * Director is a "personality" file, unlocked permanently the first time its
 * boss is defeated (`MetaState.defeatedDirectorIds`) and selectable here as
 * the one that actually spawns for the Director encounter
 * (`MetaState.activeDirectorPersonalityId`, consulted by `updateDirector` in
 * `engine/world.ts`). No selection falls back to the first registered
 * Director, so a fresh save behaves exactly as it did before this screen
 * existed.
 *
 * Deliberately a distinct component/filename from `ArchivePanel.tsx` (the
 * existing achievements/discoveries screen, hub feature `'unlocks'`, its own
 * `Screen.name === 'archive'`) -- same "Archive" flavor word, unrelated
 * feature. See .agents/memory/grpd-station.md.
 */
export function DirectorTerminalPanel({ onBack }: DirectorTerminalPanelProps) {
  const { meta, equipDirectorPersonality } = useMeta();

  return (
    <ScreenLayout title="Director Terminal" subtitle="The Digital Archive — GRPD Station" onBack={onBack}>
      <div className="mb-6 flex items-start gap-3 border border-primary/30 bg-primary/5 p-4">
        <ScanEye className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Something bigger than any one Director keeps this terminal running -- an unnamed process a few tiers up,
          quietly greenlighting which "personality" gets to run a scene next. It never explains itself, only files.
          Each entry below is a Director it has let out onto the streets, on its own schedule, for its own reasons --
          defeat one to read its file and unlock it here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" data-testid="grid-director-personalities">
        {DIRECTORS.map((director) => {
          const unlocked = meta.defeatedDirectorIds.includes(director.id);
          const isDefaultActive = meta.activeDirectorPersonalityId === null && director.id === DIRECTORS[0]?.id;
          const active = meta.activeDirectorPersonalityId === director.id || isDefaultActive;

          if (!unlocked) {
            return (
              <article
                key={director.id}
                className="flex min-h-[180px] flex-col items-center justify-center gap-2 border border-dashed border-border/60 bg-card/40 p-5 text-center"
                data-testid={`card-director-locked-${director.id}`}
              >
                <Lock className="h-5 w-5 text-muted-foreground/60" aria-hidden="true" />
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Unidentified file</p>
                <p className="text-xs text-muted-foreground/60">Defeat this Director once, in a run, to unlock its personality here.</p>
              </article>
            );
          }

          return (
            <article
              key={director.id}
              className={`flex flex-col gap-3 border p-5 ${active ? 'border-primary bg-primary/5' : 'border-border bg-card/70'}`}
              data-testid={`card-director-${director.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-black uppercase text-white">{director.name}</h3>
                {active ? <Check className="h-5 w-5 shrink-0 text-primary" aria-label="Currently active" /> : null}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{director.codexLore}</p>
              <div className="border border-white/10 bg-black/25 p-2 font-mono text-[10px] leading-relaxed text-primary/85">
                {effectReadout(director)}
              </div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Can cut in after {Math.floor(director.triggerAfterSec / 60)}:{String(director.triggerAfterSec % 60).padStart(2, '0')}
              </p>
              <button
                type="button"
                onClick={() => equipDirectorPersonality(director.id)}
                disabled={active}
                className={`mt-auto w-full border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  active
                    ? 'cursor-default border-primary/40 text-primary/70'
                    : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                }`}
                data-testid={`button-select-director-${director.id}`}
              >
                {active ? 'Active' : 'Set as active'}
              </button>
            </article>
          );
        })}
      </div>
    </ScreenLayout>
  );
}

export default DirectorTerminalPanel;
