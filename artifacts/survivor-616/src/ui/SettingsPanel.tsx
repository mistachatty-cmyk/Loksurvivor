import { useCallback, useState, type ChangeEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  Bird,
  Check,
  Compass,
  Dices,
  Download,
  FlaskConical,
  FlipVertical2,
  Languages,
  LayoutDashboard,
  LayoutList,
  Lock,
  Map,
  Maximize2,
  MousePointer2,
  Palette,
  PanelRight,
  PauseCircle,
  Plug,
  Save,
  Settings2,
  Smartphone,
  Upload,
} from 'lucide-react';

import { toast } from '@/hooks/use-toast';
import { gyroNeedsPermission, gyroSupported, requestGyroPermission } from '@/game/input/gyro';
import { activeUiThemeSwatchId, parseMetaFile, serializeMeta, useMeta } from '@/game/state/metaStore';
import { UI_THEMES, uiLooksForOwnedThemeIds } from '@/game/data/uiThemes';
import {
  DEV_ACCESS_TAPS_REQUIRED,
  DEV_RUN_TOOL_REGISTRY,
  advanceDevAccessTap,
  effectiveCatalogIds,
  hasCatalogItem,
} from '@/game/data/devUnlockRegistry';
import { vendorPurchaseCount } from '@/game/data/vendor';
import { TiltReadout } from './TiltReadout';
import { ScreenLayout } from './ScreenLayout';
import { UiTransparencyControls } from './UiTransparencyControls';
import { MotionSetting } from './MotionToggle';
import { EndgameSettings } from './EndgameSettings';
import { SettingsPager } from './SettingsPager';
import { FIGHT_STYLES, getFightStyle, setFightStyle, type FightStyle } from '@/game/state/fightStyleSetting';
import {
  AUTO_LANGUAGE,
  AVAILABLE_LOCALES,
  detectDeviceLanguage,
  getLanguagePreference,
  languageName,
  setLanguagePreference,
  useT,
} from '@/lib/i18n';

export interface SettingsPanelProps {
  onBack: () => void;
  onOpenLooksAndLokPets?: () => void;
}
/**
 * Language picker. Hidden until at least one translated file exists, so it
 * adds nothing to the screen before the Auto-translate action has run.
 */
function LanguageSetting() {
  const t = useT();
  const [preference, setPreference] = useState(getLanguagePreference);
  if (AVAILABLE_LOCALES.length < 2) return null;
  const choose = (next: string) => {
    setPreference(next);
    void setLanguagePreference(next);
  };
  return (
    <section className="border border-border bg-card p-5 sm:p-6 lg:col-span-2" data-testid="section-language-settings">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
          <Languages className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black uppercase text-white">{t('settings.language.title')}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('settings.language.description')}</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('settings.language.title')}>
            {[AUTO_LANGUAGE, ...AVAILABLE_LOCALES].map((code) => (
              <button
                key={code}
                type="button"
                lang={code === AUTO_LANGUAGE ? undefined : code}
                onClick={() => choose(code)}
                aria-pressed={preference === code}
                className={`border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                  preference === code
                    ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                    : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                }`}
                data-testid={`button-language-${code}`}
              >
                {code === AUTO_LANGUAGE ? `${t('settings.language.auto')} (${languageName(detectDeviceLanguage())})` : languageName(code)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FightStyleSetting() {
  const t = useT();
  const [style, setStyle] = useState<FightStyle>(getFightStyle);
  return (
    <div className="mt-3 border border-border/70 bg-background/50 p-4">
      <h3 className="text-sm font-black uppercase tracking-wide text-white">{t('settings.fightStyle.title')}</h3>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('settings.fightStyle.description')}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FIGHT_STYLES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => { setFightStyle(entry.id); setStyle(entry.id); }}
            aria-pressed={style === entry.id}
            className={`border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
              style === entry.id
                ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
            }`}
            data-testid={`button-fightstyle-${entry.id}`}
          >
            {t(`settings.fightStyle.${entry.id}.label`)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground" data-testid="text-fightstyle-blurb">{t(`settings.fightStyle.${style}.blurb`)}</p>
    </div>
  );
}

export function SettingsPanel({ onBack, onOpenLooksAndLokPets }: SettingsPanelProps) {
  const t = useT();
  const {
    meta,
    setPhysicsObjectClicks,
    setLiveMode,
    setLootPresentation,
    setLevelUpPresentation,
    setPauseMapVisible,
    setGraphicsQuality,
    setCompanionRevealStyle,
    setFrameRateMode,
    setFogAmbianceMode,
    setGlowingEyesIntensity,
    setCrowdAutoZoomEnabled,
    setWildlifeSheltersInRain,
    setMinimapVisible,
    setMinimapExpanded,
    setUiDensity,
    setUiPanelLayout,
    buyUiTheme,
    equipUiTheme,
    selectUiThemeSwatch,
    cycleUiLook,
    unlockThemeCycleMastery,
    setThemeCycleCollection,
    unlockDevModeAccess,
    setDevModeAllUnlocks,
    setMusicReactive,
    setSfxEnabled,
    setHideoutAmbience,
    setHideoutArrival,
    setAttractMode,
    setHideoutWeather,
    setHideoutSectionsCollapsedByDefault,
    setHideoutPreview,
    setHideoutStickyHeadOut,
    setSplashTextEnabled,
    setOneLineTitleEnabled,
    setIntroTitlePhysicsEnabled,
    setIntroTitleReturnDelay,
    setTravelEncountersEnabled,
    setGyroEnabled,
    setGyroSensitivity,
    setGyroInvertY,
    setStudioPlugins,
    setWorldInvertEnabled,
    setPaletteInvertEnabled,
    setMirrorModeEnabled,
    setPaletteAnimations,
    setWorldPaletteBlend,
    importMeta,
    setWorldColorFullRecolor,
  } = useMeta();
  const activeSwatchId = activeUiThemeSwatchId(meta);
  const effectiveUiThemeIds = effectiveCatalogIds(meta, 'uiThemes', meta.ownedUiThemeIds);
  const ownedLookCount = uiLooksForOwnedThemeIds(effectiveUiThemeIds).length;

  const [gyroDenied, setGyroDenied] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);
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

  const handleDevAccessTap = useCallback(() => {
    setDevTapCount((current) => {
      const next = advanceDevAccessTap(current);
      if (next.unlocked) unlockDevModeAccess();
      return next.taps;
    });
  }, [unlockDevModeAccess]);

  const handleExportSave = useCallback(() => {
    const blob = new Blob([serializeMeta(meta)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `616-survivor-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Save exported', description: 'Saved to your downloads.' });
  }, [meta]);

  const handleImportSave = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      void file.text().then((text) => {
        const parsed = parseMetaFile(text);
        if (!parsed) {
          toast({
            title: "Couldn't import save",
            description: "That file doesn't look like a 616 Survivor save.",
            variant: 'destructive',
          });
          return;
        }
        if (!window.confirm('Importing will replace your current progress with this save file. Continue?')) return;
        importMeta(parsed);
        toast({ title: 'Save imported', description: 'Your progress has been replaced with the imported save.' });
      });
    },
    [importMeta],
  );

  return (
    <ScreenLayout title={t('settings.title')} subtitle={t('settings.subtitle')} onBack={onBack} action={onOpenLooksAndLokPets ? <button type="button" onClick={onOpenLooksAndLokPets} className="border border-pink-200/40 bg-pink-300/10 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-pink-100" data-testid="button-settings-looks-lokpets">{t('common.looksLokpets')}</button> : undefined}>
    <SettingsPager endgame={<EndgameSettings />} standard={
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
        <LanguageSetting />
        <UiTransparencyControls />
        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-level-up-settings">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <PauseCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Run presentation</p>
                  <h2 className="mt-1 text-xl font-black uppercase text-white">Live Mode</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Keep combat live while reward choices and chest reveals stay in the screen edges. Tactics stays live; opening the full Settings screen pauses safely.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLiveMode(!meta.liveModeEnabled)}
                  aria-pressed={meta.liveModeEnabled}
                  className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.liveModeEnabled ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-white'
                  }`}
                  data-testid="button-toggle-live-mode"
                >
                  {meta.liveModeEnabled ? 'Live on' : 'Live off'}
                </button>
              </div>
              <div className="mt-5 space-y-3 text-xs text-muted-foreground">
                <div><p className="mb-2 font-mono uppercase tracking-widest text-white/70">Level ups</p><div className="grid grid-cols-3 gap-1">{(['pause-focus','compact-live','random-live'] as const).map((value) => <button key={value} type="button" onClick={() => setLevelUpPresentation(value)} disabled={meta.liveModeEnabled && value === 'pause-focus'} aria-pressed={meta.levelUpPresentation === value} className={`border p-2 uppercase disabled:opacity-35 ${meta.levelUpPresentation === value ? 'border-primary bg-primary/15 text-primary' : 'border-border'}`}>{value === 'pause-focus' ? 'Focus' : value === 'compact-live' ? 'Compact' : 'Random reel'}</button>)}</div></div>
                <div><p className="mb-2 font-mono uppercase tracking-widest text-white/70">Loot boxes</p><div className="grid grid-cols-2 gap-1">{(['auto-pause','queue'] as const).map((value) => <button key={value} type="button" onClick={() => setLootPresentation(value)} disabled={meta.liveModeEnabled && value === 'auto-pause'} aria-pressed={meta.lootPresentation === value} className={`border p-2 uppercase disabled:opacity-35 ${meta.lootPresentation === value ? 'border-primary bg-primary/15 text-primary' : 'border-border'}`}>{value === 'queue' ? 'HUD tray' : 'Auto reveal'}</button>)}</div></div>
                <button type="button" onClick={() => setPauseMapVisible(!meta.pauseMapVisible)} aria-pressed={meta.pauseMapVisible} className="flex w-full items-center justify-between border border-border p-3"><span>Tactical map shown on pause</span><span className="text-primary">{meta.pauseMapVisible ? 'On' : 'Off'}</span></button>
                <div>
                  <p className="mb-2 font-mono uppercase tracking-widest text-white/70">Graphics quality</p>
                  <div className="grid grid-cols-3 gap-1">
                    {(['high', 'balanced', 'performance'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setGraphicsQuality(value)}
                        aria-pressed={meta.graphicsQuality === value}
                        className={`border p-2 uppercase ${meta.graphicsQuality === value ? 'border-primary bg-primary/15 text-primary' : 'border-border'}`}
                        data-testid={`button-graphics-quality-${value}`}
                      >
                        {value === 'high' ? 'High' : value === 'balanced' ? 'Balanced' : 'Performance'}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    High matches how the game has always looked. Balanced and Performance
                    trim decorative density (particles, damage numbers, enemy outlines/
                    shadows) starting at a lower enemy count -- useful on a slower device
                    or a very dense swarm run. Never affects difficulty or rewards.
                  </p>
                </div>
                <div>
                  <p className="mb-2 font-mono uppercase tracking-widest text-white/70">Companion reveal</p>
                  <div className="grid grid-cols-2 gap-1">
                    {(['ambush', 'classic'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCompanionRevealStyle(value)}
                        aria-pressed={meta.companionRevealStyle === value}
                        className={`border p-2 uppercase ${meta.companionRevealStyle === value ? 'border-primary bg-primary/15 text-primary' : 'border-border'}`}
                        data-testid={`button-companion-reveal-${value}`}
                      >
                        {value === 'ambush' ? 'Ambush' : 'Classic'}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    How your first LokPet reveals itself in the opening encounter.
                    Ambush has it leap in and strike alongside you. Classic keeps the
                    original tap-the-bush reveal. Purely cosmetic.
                  </p>
                </div>
                <div>
                  <p className="mb-2 font-mono uppercase tracking-widest text-white/70">Frame pacing</p>
                  <div className="grid grid-cols-2 gap-1">
                    {([60, 120] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFrameRateMode(value)}
                        aria-pressed={meta.frameRateMode === value}
                        className={`border p-2 uppercase ${meta.frameRateMode === value ? 'border-primary bg-primary/15 text-primary' : 'border-border'}`}
                        data-testid={`button-frame-rate-${value}`}
                      >
                        {value} FPS
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    60 FPS saves battery and holds the simulation steady. 120 FPS uses a compatible high-refresh display;
                    visual resolution and nonessential effects scale back automatically during a heavy swarm.
                  </p>
                </div>

                {/* Fog Ambiance Mode */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-mono uppercase tracking-widest text-white/70">Atmospheric Fog</p>
                    <span className="font-mono text-[10px] text-cyan-400">
                      {meta.fogAmbianceMode === 'auto' ? 'Auto (Dark & Underground)' : meta.fogAmbianceMode === 'always' ? 'Always Active' : meta.fogAmbianceMode === 'dark-maps' ? 'Dark Maps Only' : 'Disabled'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                    {(
                      [
                        { id: 'auto', label: 'Auto (Dark/4X)' },
                        { id: 'dark-maps', label: 'Dark Maps' },
                        { id: 'always', label: 'Full Fog' },
                        { id: 'off', label: 'Off' },
                      ] as const
                    ).map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setFogAmbianceMode(id)}
                        aria-pressed={meta.fogAmbianceMode === id}
                        className={`border p-2 text-[11px] uppercase transition-colors ${
                          meta.fogAmbianceMode === id
                            ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                            : 'border-border text-muted-foreground hover:border-white/40'
                        }`}
                        data-testid={`button-fog-ambiance-${id}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    Volumetric perimeter fog rolls across dark night maps, subterranean catacombs, and 4X colosseums with circular player vision cutout.
                  </p>
                </div>

                {/* Distant Glowing Eyes in Fog */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-mono uppercase tracking-widest text-white/70">Fog Glowing Eyes</p>
                    <span className="font-mono text-[10px] text-amber-400">
                      {meta.glowingEyesIntensity === 'off' ? 'Off' : meta.glowingEyesIntensity === 'lil' ? 'A Lil' : meta.glowingEyesIntensity === 'mid' ? 'Mid (Standard)' : 'A Lot (Dense)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        { id: 'off', label: 'Off' },
                        { id: 'lil', label: 'A Lil' },
                        { id: 'mid', label: 'Mid' },
                        { id: 'lot', label: 'A Lot' },
                      ] as const
                    ).map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setGlowingEyesIntensity(id)}
                        aria-pressed={meta.glowingEyesIntensity === id}
                        className={`border p-2 text-[11px] uppercase transition-colors ${
                          meta.glowingEyesIntensity === id
                            ? 'border-amber-400 bg-amber-400/15 text-amber-200'
                            : 'border-border text-muted-foreground hover:border-white/40'
                        }`}
                        data-testid={`button-glowing-eyes-${id}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    Eyes of distant threats glow and pulse through the fog darkness beyond vision range. Choose density: A Lil (faint scouts), Mid (balanced radar), or A Lot (nightmarish swarm).
                  </p>
                </div>

                {/* Swarm Dynamic Crowd Zoom */}
                <div>
                  <button
                    type="button"
                    onClick={() => setCrowdAutoZoomEnabled(!meta.crowdAutoZoomEnabled)}
                    aria-pressed={meta.crowdAutoZoomEnabled}
                    className="flex w-full items-center justify-between border border-border p-3 transition-colors hover:border-white/40"
                    data-testid="button-crowd-auto-zoom"
                  >
                    <span className="font-medium text-white">Dynamic swarm zoom-out</span>
                    <span className={meta.crowdAutoZoomEnabled ? 'font-mono text-cyan-300' : 'font-mono text-muted-foreground'}>
                      {meta.crowdAutoZoomEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </button>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    Automatically pulls back camera perspective when more than 25 enemies are on screen. Manual zoom can also be cycled anytime during run with the Z key, mouse wheel scroll, or HUD Zoom button.
                  </p>
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
              <div className="mt-5 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Gameplay SFX</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      Hits, pickups, level-ups, dashes and menu sounds -- all synthesized in your browser, styled by
                      whichever pack you have equipped from the Sound Booth. Turn this off for a silent run; your
                      soundtrack keeps playing either way.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSfxEnabled(!meta.sfxEnabled)}
                    aria-pressed={meta.sfxEnabled}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.sfxEnabled
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-sfx-enabled"
                  >
                    {meta.sfxEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <div className="mt-3 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Hideout ambience</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      Optional room sound in the hideout, synthesized in your browser -- rain on the awning upstairs,
                      river fog on the perch, and the cellar's pipe hum and slow drips. It sits well under whatever
                      you have playing, and stops when you leave the tab.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHideoutAmbience(!meta.hideoutAmbienceEnabled)}
                    aria-pressed={meta.hideoutAmbienceEnabled}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.hideoutAmbienceEnabled
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-hideout-ambience"
                  >
                    {meta.hideoutAmbienceEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <div className="mt-3 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Hideout arrival scene</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      Once per session, land outside the hideout in the rain before stepping in -- the rain runs loud
                      out there and settles down once you go inside. Turn it off to skip straight to the menu every time.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHideoutArrival(!meta.hideoutArrivalEnabled)}
                    aria-pressed={meta.hideoutArrivalEnabled}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.hideoutArrivalEnabled
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-hideout-arrival"
                  >
                    {meta.hideoutArrivalEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <MotionSetting />
              <div className="mt-3 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Background gameplay on title screen</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      A bot-piloted run of the real game plays behind the title screen while you're deciding what to
                      do -- random character, random area, occasionally a little non-combat show. Turn it off for a
                      plain, still title screen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttractMode(!meta.attractModeEnabled)}
                    aria-pressed={meta.attractModeEnabled}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.attractModeEnabled
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-attract-mode"
                  >
                    {meta.attractModeEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <div className="mt-3 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Hideout weather</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      Drifting clouds, room-specific weather (rain, fog, heat haze, embers), and the small
                      birds/drones/motes over each room's backdrop. Purely visual, silent CSS decoration --
                      turn it off for a calmer or faster hideout screen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHideoutWeather(!meta.hideoutWeatherEnabled)}
                    aria-pressed={meta.hideoutWeatherEnabled}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.hideoutWeatherEnabled
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-hideout-weather"
                  >
                    {meta.hideoutWeatherEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <div className="mt-3 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Collapse hideout sections</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      Start the Hideout's generators, rumor board, and First Night/Contract boards minimized so
                      less scrolling stands between you and Head Out. You can still expand any section with a tap
                      -- this only sets the starting state.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHideoutSectionsCollapsedByDefault(!meta.hideoutSectionsCollapsedByDefault)}
                    aria-pressed={meta.hideoutSectionsCollapsedByDefault}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.hideoutSectionsCollapsedByDefault
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-hideout-sections-collapsed"
                  >
                    {meta.hideoutSectionsCollapsedByDefault ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <div className="mt-3 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Hideout preview</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      The animated character strip at the top of the Hideout screen. Turn it off for the classic
                      static layout -- no canvas animation, one less thing rendering while you browse menus.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHideoutPreview(!meta.hideoutPreviewEnabled)}
                    aria-pressed={meta.hideoutPreviewEnabled}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.hideoutPreviewEnabled
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-hideout-preview"
                  >
                    {meta.hideoutPreviewEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <div className="mt-3 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Sticky Head Out button</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      Keeps a Head Out button pinned to the bottom of the screen on phones, so it's reachable
                      without scrolling. Turn it off to go back to the classic layout with only the button in
                      the main grid.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHideoutStickyHeadOut(!meta.hideoutStickyHeadOutEnabled)}
                    aria-pressed={meta.hideoutStickyHeadOutEnabled}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.hideoutStickyHeadOutEnabled
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-hideout-sticky-head-out"
                  >
                    {meta.hideoutStickyHeadOutEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <div className="mt-3 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Splash text</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      The rotating one-liner next to the title on the opening screen -- a fresh one shows up each
                      time you load the game. Purely cosmetic; turn it off if you'd rather see a clean title screen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSplashTextEnabled(!meta.splashTextEnabled)}
                    aria-pressed={meta.splashTextEnabled}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.splashTextEnabled
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-splash-text"
                  >
                    {meta.splashTextEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <div className="mt-3 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Alternate title layout</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      Keeps the official Survivor616 name on one line. Leave this off for the original 616-over-Survivor lockup.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOneLineTitleEnabled(!meta.oneLineTitleEnabled)}
                    aria-pressed={meta.oneLineTitleEnabled}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.oneLineTitleEnabled
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-one-line-title"
                  >
                    {meta.oneLineTitleEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <div className="mt-3 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Intro physics</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      Touch, grow, pull, and throw the nonessential intro copy. Pieces bounce off the screen and each other before returning home.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIntroTitlePhysicsEnabled(!meta.introTitlePhysicsEnabled)}
                    aria-pressed={meta.introTitlePhysicsEnabled}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.introTitlePhysicsEnabled
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-intro-title-physics"
                  >
                    {meta.introTitlePhysicsEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                {meta.introTitlePhysicsEnabled ? (
                  <label className="mt-4 block border-t border-border/60 pt-4" htmlFor="intro-return-delay">
                    <span className="flex items-center justify-between gap-4 font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      Magnetic return delay
                      <output className="text-primary">{meta.introTitleReturnDelaySec}s</output>
                    </span>
                    <input
                      id="intro-return-delay"
                      type="range"
                      min="1"
                      max="12"
                      step="1"
                      value={meta.introTitleReturnDelaySec}
                      onChange={(event) => setIntroTitleReturnDelay(Number(event.currentTarget.value))}
                      className="mt-3 w-full accent-primary"
                      data-testid="input-intro-return-delay"
                    />
                  </label>
                ) : null}
              </div>
              <div className="mt-3 border border-border/70 bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">Travel encounters</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      A short pop-up scrap can trigger when you enter DigiScope or head out on a run --
                      throw a card from your Battle Deck (or a bare-knuckle punch) for a small reward. Turn this
                      off to skip it entirely.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTravelEncountersEnabled(!meta.travelEncountersEnabled)}
                    aria-pressed={meta.travelEncountersEnabled}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      meta.travelEncountersEnabled
                        ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100'
                        : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'
                    }`}
                    data-testid="button-toggle-travel-encounters"
                  >
                    {meta.travelEncountersEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
              <FightStyleSetting />
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

              {/* Tilt cannot be verified from a desk, so the numbers go on
                  screen and the player checks it on their own device. */}
              <TiltReadout
                enabled={meta.gyroEnabled}
                sensitivity={meta.gyroSensitivity}
                invertY={meta.gyroInvertY}
              />
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

        {vendorPurchaseCount(meta, 'invert-world') > 0 || vendorPurchaseCount(meta, 'invert-palette') > 0 || vendorPurchaseCount(meta, 'mirror-mode') > 0 ? (
          <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-cheat-settings">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center border border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300">
                <FlipVertical2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300">Quartermaster cheats</p>
                  <h2 className="mt-1 text-xl font-black uppercase text-white">Chaos toggles</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Unlocked in the Field ops shop. Purely cosmetic, purely for chaos — flip any of these back off any time.
                  </p>
                </div>
                {vendorPurchaseCount(meta, 'invert-world') > 0 ? (
                  <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wide text-white">Flip the Script</p>
                      <p className="mt-1 text-xs text-muted-foreground">Rotate the whole run 180°.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWorldInvertEnabled(!meta.worldInvertEnabled)}
                      aria-pressed={meta.worldInvertEnabled}
                      className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                        meta.worldInvertEnabled
                          ? 'border-fuchsia-400 bg-fuchsia-400 text-black'
                          : 'border-border bg-background text-muted-foreground hover:border-fuchsia-400 hover:text-white'
                      }`}
                      data-testid="button-toggle-world-invert"
                    >
                      {meta.worldInvertEnabled ? 'Flipped' : 'Off'}
                    </button>
                  </div>
                ) : null}
                {vendorPurchaseCount(meta, 'invert-palette') > 0 ? (
                  <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wide text-white">Negative Exposure</p>
                      <p className="mt-1 text-xs text-muted-foreground">Invert every color on screen.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaletteInvertEnabled(!meta.paletteInvertEnabled)}
                      aria-pressed={meta.paletteInvertEnabled}
                      className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                        meta.paletteInvertEnabled
                          ? 'border-fuchsia-400 bg-fuchsia-400 text-black'
                          : 'border-border bg-background text-muted-foreground hover:border-fuchsia-400 hover:text-white'
                      }`}
                      data-testid="button-toggle-palette-invert"
                    >
                      {meta.paletteInvertEnabled ? 'Inverted' : 'Off'}
                    </button>
                  </div>
                ) : null}
                {vendorPurchaseCount(meta, 'mirror-mode') > 0 ? (
                  <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wide text-white">Wrong Side of the Street</p>
                      <p className="mt-1 text-xs text-muted-foreground">Mirror the whole run left-to-right.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMirrorModeEnabled(!meta.mirrorModeEnabled)}
                      aria-pressed={meta.mirrorModeEnabled}
                      className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                        meta.mirrorModeEnabled
                          ? 'border-fuchsia-400 bg-fuchsia-400 text-black'
                          : 'border-border bg-background text-muted-foreground hover:border-fuchsia-400 hover:text-white'
                      }`}
                      data-testid="button-toggle-mirror-mode"
                    >
                      {meta.mirrorModeEnabled ? 'Mirrored' : 'Off'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-wildlife-settings">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-amber-300/40 bg-amber-300/10 text-amber-200">
              <Bird className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200">Street ambiance</p>
                  <h2 className="mt-1 text-xl font-black uppercase text-white">Birds &amp; fireflies in bad weather</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    By default, birds and the road fireflies duck out of sight during rain and fog. Turn this off to
                    keep them visible through any weather.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWildlifeSheltersInRain(!meta.wildlifeSheltersInRain)}
                  aria-pressed={meta.wildlifeSheltersInRain}
                  className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    meta.wildlifeSheltersInRain
                      ? 'border-amber-300/60 bg-amber-300/15 text-amber-100'
                      : 'border-border bg-background text-muted-foreground hover:border-amber-300/60 hover:text-white'
                  }`}
                  data-testid="button-toggle-wildlife-shelters"
                >
                  {meta.wildlifeSheltersInRain ? 'Shelters in rain' : 'Stays visible'}
                </button>
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
              <h2 className="mt-1 text-xl font-black uppercase text-white">Theme &amp; palette</h2>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Set the hideout&rsquo;s mood without changing the action. Themes change the menu chrome; palettes
                  change its accent color and are remembered independently for every theme.
                </p>
                <button
                  type="button"
                  onClick={cycleUiLook}
                  disabled={ownedLookCount <= 1}
                  className="flex shrink-0 items-center justify-center gap-2 border border-primary px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground"
                  data-testid="button-cycle-ui-look"
                >
                  <Dices className="h-4 w-4" />
                  Roll the look
                </button>
              </div>
              <div className="mt-4 border border-primary/30 bg-primary/5 p-3" data-testid="section-core-master-theme-cycle">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">Core Master · theme cycle</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {meta.themeCycleMastered
                        ? 'Choose whether Roll the Look rotates the five starter looks or every theme you have unlocked.'
                        : 'Upgrade to add your unlocked theme collection to the quick cycle. The starter carousel stays free.'}
                    </p>
                  </div>
                  {!meta.themeCycleMastered ? (
                    <button type="button" onClick={unlockThemeCycleMastery} disabled={meta.cred < 2400} className="shrink-0 border border-primary px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-primary disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground" data-testid="button-unlock-core-master-theme-cycle">
                      Unlock · 2400 cred
                    </button>
                  ) : null}
                </div>
                {meta.themeCycleMastered ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(['starter', 'owned'] as const).map((collection) => (
                      <button key={collection} type="button" onClick={() => setThemeCycleCollection(collection)} aria-pressed={meta.themeCycleCollection === collection} className={`border px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-widest ${meta.themeCycleCollection === collection ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary hover:text-white'}`} data-testid={`button-theme-cycle-${collection}`}>
                        {collection === 'starter' ? 'Starter themes' : 'Unlocked themes'}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Theme combinations: {ownedLookCount} owned
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="character-palette-behavior-settings">
                <button
                  type="button"
                  onClick={() => setWorldPaletteBlend(!meta.worldPaletteBlendEnabled)}
                  aria-pressed={meta.worldPaletteBlendEnabled}
                  className={`border px-3 py-3 text-left transition-colors ${meta.worldPaletteBlendEnabled ? 'border-primary bg-primary/10 text-white' : 'border-border bg-background text-muted-foreground'}`}
                >
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-widest">World + personal skin</span>
                  <span className="mt-1 block text-xs">{meta.worldPaletteBlendEnabled ? 'Blended together' : 'Personal skin only'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteAnimations(!meta.paletteAnimationsEnabled)}
                  aria-pressed={meta.paletteAnimationsEnabled}
                  className={`border px-3 py-3 text-left transition-colors ${meta.paletteAnimationsEnabled ? 'border-primary bg-primary/10 text-white' : 'border-border bg-background text-muted-foreground'}`}
                >
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-widest">Animated palette motion</span>
                  <span className="mt-1 block text-xs">{meta.paletteAnimationsEnabled ? 'Effects moving' : 'Colors remain, motion off'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorldColorFullRecolor(!meta.worldColorFullRecolorEnabled)}
                  aria-pressed={meta.worldColorFullRecolorEnabled}
                  className={`border px-3 py-3 text-left transition-colors ${meta.worldColorFullRecolorEnabled ? 'border-primary bg-primary/10 text-white' : 'border-border bg-background text-muted-foreground'}`}
                  data-testid="button-toggle-world-color-full-recolor"
                >
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-widest">Full world recolor</span>
                  <span className="mt-1 block text-xs">{meta.worldColorFullRecolorEnabled ? 'Enemies + environment recolored too' : 'Your fighter only (original look)'}</span>
                </button>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {UI_THEMES.filter((theme) => !theme.hidden || hasCatalogItem(meta, 'uiThemes', theme.id, meta.ownedUiThemeIds)).map((theme) => {
                  const owned = hasCatalogItem(meta, 'uiThemes', theme.id, meta.ownedUiThemeIds);
                  const equipped = meta.uiTheme === theme.id;
                  const affordable = meta.cred >= theme.cost;
                  return (
                    <div key={theme.id} className={`border p-4 ${equipped ? 'border-primary bg-primary/5' : 'border-border bg-background'}`} data-testid={`card-ui-theme-${theme.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-black uppercase tracking-wide text-white">{theme.name}</h3>
                        {equipped ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                      </div>
                      {theme.tier ? <span className="mt-2 inline-block border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-primary">{theme.tier}</span> : null}
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{theme.description}</p>
                      {theme.swatches ? (
                        <div
                          className="mt-3 flex h-2 overflow-hidden border border-border/70"
                          aria-label={`${theme.name} palette preview`}
                        >
                          {theme.swatches.map((swatch) => (
                            <span
                              key={swatch.id}
                              className="min-w-0 flex-1"
                              style={{ backgroundColor: `hsl(${swatch.primaryHsl})` }}
                            />
                          ))}
                        </div>
                      ) : null}

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
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Active palette
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {theme.swatches.map((swatch) => (
                            <button
                              key={swatch.id}
                              type="button"
                              onClick={() => selectUiThemeSwatch(theme.id, swatch.id)}
                              aria-pressed={activeSwatchId === swatch.id}
                              aria-label={`Use ${swatch.name} palette`}
                              title={swatch.name}
                              className={`flex items-center gap-2 border px-2 py-2 text-left transition-colors ${
                                activeSwatchId === swatch.id
                                  ? 'border-white bg-white/10 text-white'
                                  : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-white'
                              }`}
                              data-testid={`button-ui-theme-swatch-${theme.id}-${swatch.id}`}
                            >
                              <span
                                className="h-4 w-4 shrink-0 border border-white/30"
                                style={{ backgroundColor: `hsl(${swatch.primaryHsl})` }}
                              />
                              <span className="truncate font-mono text-[10px] font-bold uppercase tracking-wider">
                                {swatch.name}
                              </span>
                              {activeSwatchId === swatch.id ? <Check className="ml-auto h-3 w-3 shrink-0" /> : null}
                            </button>
                          ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-5 sm:p-6 lg:col-span-2" data-testid="save-data-panel">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <Save className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-bold uppercase tracking-[0.25em] text-primary"
                data-testid="text-save-data-label"
              >
                Save data
              </p>
              <h2 className="mt-1 text-xl font-black uppercase text-white">Back up or transfer your progress</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Export a save file to keep as a backup or move to another browser or device. Signing in
                under Account keeps your progress synced automatically instead.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportSave}
                  className="flex items-center gap-2 border border-border bg-background px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white hover:border-primary"
                  data-testid="button-export-save"
                >
                  <Download className="h-4 w-4" /> Export save
                </button>
                <label
                  className="flex cursor-pointer items-center gap-2 border border-border bg-background px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white hover:border-primary"
                  data-testid="button-import-save"
                >
                  <Upload className="h-4 w-4" /> Import save
                  <input type="file" accept="application/json" className="hidden" onChange={handleImportSave} />
                </label>
              </div>
            </div>
          </div>
        </section>

        {meta.devModeAccessUnlocked ? (
          <section className="border border-dashed border-primary/60 bg-primary/5 p-5 sm:p-6 lg:col-span-2" data-testid="dev-mode-panel">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Developer access unlocked</p>
                    <h2 className="mt-1 text-xl font-black uppercase text-white">Catalog registry</h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      Temporarily expose every registered character, area, room, theme, palette, and aura. Turning
                      this off restores your real progression and never grants permanent ownership.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDevModeAllUnlocks(!meta.devModeAllUnlocks)}
                    className={`shrink-0 border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${meta.devModeAllUnlocks ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-white'}`}
                    aria-pressed={meta.devModeAllUnlocks}
                    data-testid="button-toggle-dev-unlocks"
                  >
                    Dev Mode: {meta.devModeAllUnlocks ? 'On' : 'Off'}
                  </button>
                </div>
                <div className="mt-4 border-t border-primary/20 pt-3" data-testid="dev-run-tool-registry">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary">Registered run diagnostics</p>
                  <p className="mt-1 text-xs text-muted-foreground">Enable Dev Mode, start a run, then open Intel to use these without changing progression.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DEV_RUN_TOOL_REGISTRY.map((tool) => (
                      <span key={tool.id} className="border border-primary/25 bg-background/70 px-2 py-1 font-mono text-[9px] uppercase text-white/65" title={tool.description}>{tool.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="border border-dashed border-border bg-card/60 p-5 sm:p-6 lg:col-span-2" data-testid="dev-mode-gate">
            <button
              type="button"
              onClick={handleDevAccessTap}
              className="flex w-full items-center gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Tap four times to unlock developer mode"
              data-testid="button-unlock-dev-mode"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center border border-border bg-background text-muted-foreground">
                <FlaskConical className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">Build channel</span>
                <span className="mt-1 block text-lg font-black uppercase text-white">Developer Mode</span>
                <span className="mt-1 block text-xs text-muted-foreground" aria-live="polite">
                  {devTapCount === 0
                    ? 'Tap four times to reveal testing controls.'
                    : `${Math.max(0, DEV_ACCESS_TAPS_REQUIRED - devTapCount)} tap${DEV_ACCESS_TAPS_REQUIRED - devTapCount === 1 ? '' : 's'} remaining.`}
                </span>
              </span>
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </section>
        )}
      </div>
    } />
    </ScreenLayout>
  );
}
