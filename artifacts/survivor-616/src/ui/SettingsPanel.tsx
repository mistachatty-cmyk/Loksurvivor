import { MousePointer2, Settings2, Smartphone } from 'lucide-react';

import { useMeta } from '@/game/state/metaStore';
import { ScreenLayout } from './ScreenLayout';

export interface SettingsPanelProps {
  onBack: () => void;
}

export function SettingsPanel({ onBack }: SettingsPanelProps) {
  const { meta, setPhysicsObjectClicks } = useMeta();

  return (
    <ScreenLayout title="Settings" subtitle="Controls & accessibility" onBack={onBack}>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-physics-settings">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <MousePointer2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Physics interaction</p>
                  <h2 className="mt-1 text-xl font-black uppercase text-white">Clickable prop launches</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Tap or click a movable object to prime it. Your next hit launches it at 4× its normal impact velocity,
                    in the opposite direction from its last hit, and lets it plow through enemies.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPhysicsObjectClicks(!meta.physicsObjectClicksEnabled)}
                  aria-pressed={meta.physicsObjectClicksEnabled}
                  className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.physicsObjectClicksEnabled
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-white'
                  }`}
                  data-testid="button-toggle-physics-object-clicks"
                >
                  {meta.physicsObjectClicksEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              <div className="mt-5 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center gap-2 border border-border/70 bg-background/50 p-3">
                  <Settings2 className="h-4 w-4 text-primary" />
                  <span>Click once, then hit the object to arm the launch.</span>
                </div>
                <div className="flex items-center gap-2 border border-border/70 bg-background/50 p-3">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span>Tap targets on mobile; drag elsewhere to steer.</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ScreenLayout>
  );
}