import { useCallback, useState } from 'react';
import { Activity, AlertTriangle, Compass, LayoutDashboard, Map, Maximize2, MousePointer2, PauseCircle, Plug, Settings2, Smartphone, FlaskConical } from 'lucide-react';

import { gyroNeedsPermission, gyroSupported, requestGyroPermission } from '@/game/input/gyro';
import { useMeta } from '@/game/state/metaStore';
import { ScreenLayout } from './ScreenLayout';

export interface SettingsPanelProps {
  onBack: () => void;
}

export function SettingsPanel({ onBack }: SettingsPanelProps) {
  const {
    meta,
    setPhysicsObjectClicks,
    setLevelUpPauses,
    setMinimapVisible,
    setMinimapExpanded,
    setDevModeAllUnlocks,
    setMusicReactive,
    setGyroEnabled,
    setGyroSensitivity,
    setGyroInvertY,
    setStudioPlugins,
  } = useMeta();

  const [gyroDenied, setGyroDenied] = useState(false);
  const tiltAvailable = gyroSupported();

  /**
   * iOS only hands out orientation from inside a user gesture, so the request
   * has to live in this click handler rather than in an effect.
   */
  const toggleGyro = useCallback(async () => {
    if (meta.gyroEnabled) {
      setGyroEnabled(false);
      return;
    }
    if (gyroNeedsPermission()) {
      const granted = await requestGyroPermission();
      setGyroDenied(!granted);
      if (!granted) return;
    }
    setGyroDenied(false);
    setGyroEnabled(true);
  }, [meta.gyroEnabled, setGyroEnabled]);

  return (
    <ScreenLayout title="Settings" subtitle="Controls & accessibility" onBack={onBack}>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-level-up-settings">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <PauseCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Level-up flow</p>
                  <h2 className="mt-1 text-xl font-black uppercase text-white">Keep the run moving</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Choose whether leveling up pauses the action. Continuous mode keeps your character moving while the
                    upgrade cards wait in the lower-left corner.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLevelUpPauses(!meta.levelUpPausesEnabled)}
                  aria-pressed={!meta.levelUpPausesEnabled}
                  className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.levelUpPausesEnabled
                      ? 'border-border bg-background text-muted-foreground hover:border-primary hover:text-white'
                      : 'border-primary bg-primary text-primary-foreground'
                  }`}
                  data-testid="button-toggle-continuous-levelups"
                >
                  {meta.levelUpPausesEnabled ? 'Pause on level-up' : 'Keep moving'}
                </button>
              </div>
              <div className="mt-5 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center gap-2 border border-border/70 bg-background/50 p-3">
                  <PauseCircle className="h-4 w-4 text-primary" />
                  <span>Pause mode gives you a quiet moment to compare each card.</span>
                </div>
                <div className="flex items-center gap-2 border border-border/70 bg-background/50 p-3">
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                  <span>Continuous mode keeps enemies, hazards, and movement active.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Studio plugins -- off unless deliberately enabled, because this is
            the one feature that runs code from off the device. */}
        <section className="border border-border bg-card/60 p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-amber-300/40 bg-amber-400/10 text-amber-200">
              <Plug className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200">Studio</p>
                  <h2 className="mt-1 text-xl font-black uppercase text-white">Third-party plugins</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Lets the studio load Web Audio Modules -- the browser's answer to VST effects -- from an
                    address you provide. Leave this off unless you want it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStudioPlugins(!meta.studioPluginsEnabled)}
                  aria-pressed={meta.studioPluginsEnabled}
                  className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.studioPluginsEnabled
                      ? 'border-amber-300/60 bg-amber-400/15 text-amber-100'
                      : 'border-border bg-background text-muted-foreground hover:border-amber-300/60 hover:text-white'
                  }`}
                  data-testid="button-toggle-studio-plugins"
                >
                  {meta.studioPluginsEnabled ? 'On' : 'Off'}
                </button>
              </div>
              <div className="mt-5 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center gap-2 border border-amber-300/30 bg-amber-400/5 p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" />
                  <span>
                    A plugin runs code fetched from its address. Nothing else in 616 leaves your device.
                  </span>
                </div>
                <div className="flex items-center gap-2 border border-border/70 bg-background/50 p-3">
                  <Settings2 className="h-4 w-4 text-amber-200" />
                  <span>Nothing is bundled and no plugin loads until you paste one in.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-music-reactive-settings">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-fuchsia-300/40 bg-fuchsia-400/10 text-fuchsia-200">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-200">Soundtrack</p>
                  <h2 className="mt-1 text-xl font-black uppercase text-white">React to the music</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    The game listens to whatever track is playing and locks onto its tempo. Enemies move on the beat,
                    the streetlight pool breathes with the low end, and hits landed on the beat do extra damage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMusicReactive(!meta.musicReactiveEnabled)}
                  aria-pressed={meta.musicReactiveEnabled}
                  className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.musicReactiveEnabled
                      ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                      : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                  }`}
                  data-testid="button-toggle-music-reactive"
                >
                  {meta.musicReactiveEnabled ? 'On' : 'Off'}
                </button>
              </div>
              <div className="mt-5 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center gap-2 border border-border/70 bg-background/50 p-3">
                  <Activity className="h-4 w-4 text-fuchsia-200" />
                  <span>Tempo is detected in your browser -- your audio files never leave the device.</span>
                </div>
                <div className="flex items-center gap-2 border border-border/70 bg-background/50 p-3">
                  <Settings2 className="h-4 w-4 text-fuchsia-200" />
                  <span>Turn this off and the run plays exactly as it does in silence.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-gyro-settings">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-emerald-300/40 bg-emerald-400/10 text-emerald-200">
              <Compass className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-200">Motion controls</p>
                  <h2 className="mt-1 text-xl font-black uppercase text-white">Steer by tilt</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {tiltAvailable
                      ? 'Tilt your device to move. The on-screen stick still overrides tilt whenever you touch it, so you can take back manual control at any time.'
                      : 'This device does not report orientation, so tilt steering is unavailable here. Try it on a phone or tablet.'}
                  </p>
                  {gyroDenied ? (
                    <p className="mt-2 text-sm text-amber-300" data-testid="text-gyro-denied">
                      Motion access was declined. Allow it in your browser settings, then try again.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void toggleGyro()}
                  disabled={!tiltAvailable}
                  aria-pressed={meta.gyroEnabled}
                  className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    meta.gyroEnabled
                      ? 'border-emerald-300/60 bg-emerald-400/15 text-emerald-100'
                      : 'border-border bg-background text-muted-foreground hover:border-emerald-300/60 hover:text-white'
                  }`}
                  data-testid="button-toggle-gyro"
                >
                  {meta.gyroEnabled ? 'On' : 'Off'}
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Sensitivity
                </span>
                {([['Gentle', 0.7], ['Normal', 1], ['Twitchy', 1.5]] as const).map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setGyroSensitivity(value)}
                    disabled={!meta.gyroEnabled}
                    aria-pressed={meta.gyroSensitivity === value}
                    className={`border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      meta.gyroSensitivity === value
                        ? 'border-emerald-300/60 bg-emerald-400/15 text-emerald-100'
                        : 'border-border bg-background text-muted-foreground hover:border-emerald-300/60 hover:text-white'
                    }`}
                    data-testid={`button-gyro-sensitivity-${label.toLowerCase()}`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setGyroInvertY(!meta.gyroInvertY)}
                  disabled={!meta.gyroEnabled}
                  aria-pressed={meta.gyroInvertY}
                  className={`border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    meta.gyroInvertY
                      ? 'border-emerald-300/60 bg-emerald-400/15 text-emerald-100'
                      : 'border-border bg-background text-muted-foreground hover:border-emerald-300/60 hover:text-white'
                  }`}
                  data-testid="button-toggle-gyro-invert"
                >
                  {meta.gyroInvertY ? 'Inverted Y' : 'Normal Y'}
                </button>
              </div>
              <p className="mt-4 flex items-center gap-2 border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">
                <Smartphone className="h-4 w-4 text-emerald-200" />
                <span>However you are holding the device when a run starts becomes the neutral position.</span>
              </p>
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-minimap-settings">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-cyan-200/40 bg-cyan-300/10 text-cyan-200">
              <Map className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">Navigation display</p>
                  <h2 className="mt-1 text-xl font-black uppercase text-white">Endless minimap</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Show or hide the map, and choose a compact view or the expanded city detail view. You can drag it
                    anywhere during a run.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMinimapVisible(!meta.minimapVisible)}
                  aria-pressed={meta.minimapVisible}
                  className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.minimapVisible
                      ? 'border-cyan-200/60 bg-cyan-300/15 text-cyan-100'
                      : 'border-border bg-background text-muted-foreground hover:border-cyan-200/60 hover:text-white'
                  }`}
                  data-testid="button-toggle-minimap"
                >
                  {meta.minimapVisible ? 'Visible' : 'Hidden'}
                </button>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMinimapExpanded(false)}
                  aria-pressed={!meta.minimapExpanded}
                  className={`flex items-center gap-2 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    !meta.minimapExpanded
                      ? 'border-cyan-200/60 bg-cyan-300/15 text-cyan-100'
                      : 'border-border bg-background text-muted-foreground hover:border-cyan-200/60 hover:text-white'
                  }`}
                  data-testid="button-minimap-compact"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setMinimapExpanded(true)}
                  aria-pressed={meta.minimapExpanded}
                  className={`flex items-center gap-2 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.minimapExpanded
                      ? 'border-cyan-200/60 bg-cyan-300/15 text-cyan-100'
                      : 'border-border bg-background text-muted-foreground hover:border-cyan-200/60 hover:text-white'
                  }`}
                  data-testid="button-minimap-expanded"
                >
                  <Maximize2 className="h-4 w-4" />
                  Expanded
                </button>
              </div>
            </div>
          </div>
        </section>

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

        {import.meta.env.DEV && (
          <section className="border border-dashed border-primary/60 bg-primary/5 p-5 sm:p-6" data-testid="dev-mode-panel">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Developer mode</p>
                    <h2 className="mt-1 text-xl font-black uppercase text-white">All unlocks</h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      Expose every unlockable character, area, and hideout room, regardless of progress. Dev builds only.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDevModeAllUnlocks(!meta.devModeAllUnlocks)}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.devModeAllUnlocks
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-white'
                    }`}
                    aria-pressed={meta.devModeAllUnlocks}
                    data-testid="button-toggle-dev-unlocks"
                  >
                    All unlocks: {meta.devModeAllUnlocks ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </ScreenLayout>
  );
}