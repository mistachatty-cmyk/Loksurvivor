import {
  Check,
  FlaskConical,
  LayoutDashboard,
  LayoutList,
  Lock,
  Map,
  Maximize2,
  MousePointer2,
  Palette,
  PanelRight,
  PauseCircle,
  Settings2,
  Smartphone,
} from 'lucide-react';

import { activeUiThemeSwatchId, useMeta } from '@/game/state/metaStore';
import { UI_THEMES } from '@/game/data/uiThemes';
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
    setUiDensity,
    setUiPanelLayout,
    buyUiTheme,
    equipUiTheme,
    selectUiThemeSwatch,
    setDevModeAllUnlocks,
  } = useMeta();
  const activeSwatchId = activeUiThemeSwatchId(meta);

  return (
    <ScreenLayout title="Settings" subtitle="Controls & accessibility" onBack={onBack}>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
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

        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-ui-density-settings">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-emerald-300/40 bg-emerald-300/10 text-emerald-200">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-200">Hub panel layout</p>
                  <h2 className="mt-1 text-xl font-black uppercase text-white">Card grid or legacy list</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    The Relic Workshop, Archive, and Bestiary show multi-column card grids by default so you can see
                    most of what's there without scrolling. Switch back to the original single-column list any time.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setUiDensity('grid')}
                  aria-pressed={meta.uiDensity === 'grid'}
                  className={`flex items-center gap-2 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.uiDensity === 'grid'
                      ? 'border-emerald-300/60 bg-emerald-300/15 text-emerald-100'
                      : 'border-border bg-background text-muted-foreground hover:border-emerald-300/60 hover:text-white'
                  }`}
                  data-testid="button-ui-density-grid"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Card grid
                </button>
                <button
                  type="button"
                  onClick={() => setUiDensity('list')}
                  aria-pressed={meta.uiDensity === 'list'}
                  className={`flex items-center gap-2 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.uiDensity === 'list'
                      ? 'border-emerald-300/60 bg-emerald-300/15 text-emerald-100'
                      : 'border-border bg-background text-muted-foreground hover:border-emerald-300/60 hover:text-white'
                  }`}
                  data-testid="button-ui-density-list"
                >
                  <LayoutList className="h-4 w-4" />
                  Legacy list
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-panel-layout-settings">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <PanelRight className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Quartermaster & Roster</p>
                <h2 className="mt-1 text-xl font-black uppercase text-white">Detail panel layout</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Choose whether the buy/stats panel sits in a fixed rail beside the grid, or slides open under
                  whichever item or character you select.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setUiPanelLayout('rail')}
                  aria-pressed={meta.uiPanelLayout === 'rail'}
                  className={`flex items-center gap-2 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.uiPanelLayout === 'rail'
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-white'
                  }`}
                  data-testid="button-panel-layout-rail"
                >
                  <PanelRight className="h-4 w-4" />
                  Side rail
                </button>
                <button
                  type="button"
                  onClick={() => setUiPanelLayout('slideout')}
                  aria-pressed={meta.uiPanelLayout === 'slideout'}
                  className={`flex items-center gap-2 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.uiPanelLayout === 'slideout'
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-white'
                  }`}
                  data-testid="button-panel-layout-slideout"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Slide-out
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-5 sm:p-6 lg:col-span-2" data-testid="section-ui-theme-settings">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Hideout customization</p>
              <h2 className="mt-1 text-xl font-black uppercase text-white">UI theme</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Spend cred on a new look for every menu screen. Arcade Cabinet is the first theme with its own
                accent swatches &mdash; more themes and swatches are on the way.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {UI_THEMES.map((theme) => {
                  const owned = meta.ownedUiThemeIds.includes(theme.id);
                  const equipped = meta.uiTheme === theme.id;
                  const affordable = meta.cred >= theme.cost;
                  return (
                    <div key={theme.id} className={`border p-4 ${equipped ? 'border-primary bg-primary/5' : 'border-border bg-background'}`} data-testid={`card-ui-theme-${theme.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-black uppercase tracking-wide text-white">{theme.name}</h3>
                        {equipped ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{theme.description}</p>

                      {owned ? (
                        <button
                          type="button"
                          onClick={() => equipUiTheme(theme.id)}
                          disabled={equipped}
                          className={`mt-3 w-full border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            equipped
                              ? 'cursor-default border-primary/40 text-primary/70'
                              : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                          }`}
                          data-testid={`button-equip-ui-theme-${theme.id}`}
                        >
                          {equipped ? 'Equipped' : 'Equip'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => buyUiTheme(theme.id)}
                          disabled={!affordable}
                          className={`mt-3 flex w-full items-center justify-center gap-2 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            affordable
                              ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                              : 'cursor-not-allowed border-border text-muted-foreground/50'
                          }`}
                          data-testid={`button-buy-ui-theme-${theme.id}`}
                        >
                          {!affordable ? <Lock className="h-3 w-3" /> : null}
                          {affordable ? `Buy for ${theme.cost} cred` : `Need ${theme.cost} cred`}
                        </button>
                      )}

                      {owned && equipped && theme.swatches ? (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                          {theme.swatches.map((swatch) => (
                            <button
                              key={swatch.id}
                              type="button"
                              onClick={() => selectUiThemeSwatch(theme.id, swatch.id)}
                              aria-pressed={activeSwatchId === swatch.id}
                              title={swatch.name}
                              className={`h-7 w-7 border-2 transition-transform ${
                                activeSwatchId === swatch.id ? 'scale-110 border-white' : 'border-white/20 hover:scale-105'
                              }`}
                              style={{ backgroundColor: `hsl(${swatch.primaryHsl})` }}
                              data-testid={`button-ui-theme-swatch-${theme.id}-${swatch.id}`}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {import.meta.env.DEV && (
          <section className="border border-dashed border-primary/60 bg-primary/5 p-5 sm:p-6 lg:col-span-2" data-testid="dev-mode-panel">
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