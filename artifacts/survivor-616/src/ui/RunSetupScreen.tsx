import { ArrowLeft, Check, Circle, Cpu, Grid3X3, Monitor, PawPrint, Sparkles } from 'lucide-react';
import { Fragment, useState } from 'react';

import { lokPetTeamCapacity, useMeta } from '@/game/state/metaStore';
import type { MetaState } from '@/game/types';
import { LokPetIcon } from '@/ui/LokPetVariantSheet';
import { RigPortrait } from '@/ui/RigPortrait';
import { THEMED_PALETTES_BY_ID } from '@/game/data/themedPalettes';

type SetupStep = 'companion' | 'look';

export interface RunSetupScreenProps {
  /** Launch continues into a run; manage returns to the hideout after saving. */
  intent: 'launch' | 'manage';
  onBack: () => void;
  onComplete: () => void;
}

const ART_STYLES: Array<{
  id: MetaState['lokPetArtStyle'];
  label: string;
  description: string;
}> = [
  { id: 'pixel-core', label: 'Pixel Core', description: 'The classic pixel rig.' },
  { id: 'neon-signal', label: 'Neon Flight', description: 'Glow-forward companion scan.' },
  { id: 'holo-card', label: 'Holo Card', description: 'A collectible-card finish.' },
];

const GRAPHICS: Array<{ id: MetaState['graphicsQuality']; label: string; description: string }> = [
  { id: 'performance', label: 'Potato', description: 'Lowest visual load.' },
  { id: 'balanced', label: 'Mid', description: 'Balanced for most phones.' },
  { id: 'high', label: 'High', description: 'Full visual detail.' },
];

const BORDERS: Array<{ id: MetaState['uiBorderStyle']; label: string; icon: typeof Grid3X3 }> = [
  { id: 'square', label: 'Square', icon: Grid3X3 },
  { id: 'soft', label: 'Soft', icon: Sparkles },
  { id: 'round', label: 'Round', icon: Circle },
];

function selectClass(selected: boolean) {
  return selected
    ? 'border-primary bg-primary/15 text-white shadow-[0_0_26px_rgba(34,211,238,.12)]'
    : 'border-white/15 bg-black/25 text-white/65 hover:border-white/45 hover:text-white';
}

export function RunSetupScreen({ intent, onBack, onComplete }: RunSetupScreenProps) {
  const {
    meta,
    selectedCharacter,
    setLokPetLoadout,
    setLokPetArtStyle,
    setUiBorderStyle,
    setLokPetBorderStyle,
    setCharacterBorderStyle,
    setGraphicsQuality,
    setUiPanelLayout,
    setMinimapVisible,
    equipPalette,
  } = useMeta();
  const [step, setStep] = useState<SetupStep>('companion');
  const [selectedPetId, setSelectedPetId] = useState<string | null>(meta.selectedLokPetIds[0] ?? null);
  const [artStyle, setArtStyle] = useState(meta.lokPetArtStyle);
  const [graphicsQuality, setGraphicsQualityChoice] = useState(meta.graphicsQuality);
  const [borderStyle, setBorderStyle] = useState(meta.uiBorderStyle);
  const [lokPetBorderStyle, setLokPetBorderStyleChoice] = useState(meta.lokPetBorderStyle);
  const [characterBorderStyle, setCharacterBorderStyleChoice] = useState(meta.characterBorderStyle);
  const [panelLayout, setPanelLayout] = useState(meta.uiPanelLayout);
  const [minimapVisible, setMinimapVisibleChoice] = useState(meta.minimapVisible);
  const readyPets = meta.savedLokPets.filter((pet) => pet.stamina > 0);
  const regularReadyPets = readyPets.filter((pet) => !pet.roll.legendary);
  const legendaryReadyPets = readyPets.filter((pet) => pet.roll.legendary);
  const capacity = lokPetTeamCapacity(selectedCharacter);
  const isLaunch = intent === 'launch';
  const ownedPalettes = meta.ownedPaletteIds.map((id) => THEMED_PALETTES_BY_ID[id]).filter(Boolean);
  const paletteIndex = Math.max(0, ownedPalettes.findIndex((palette) => palette.id === meta.activePaletteId));

  const continueWithCompanion = () => {
    setLokPetLoadout(selectedPetId ? [selectedPetId] : []);
    setStep('look');
  };

  const saveLookAndFinish = () => {
    setLokPetArtStyle(artStyle);
    setGraphicsQuality(graphicsQuality);
    setUiBorderStyle(borderStyle);
    setLokPetBorderStyle(lokPetBorderStyle);
    setCharacterBorderStyle(characterBorderStyle);
    setUiPanelLayout(panelLayout);
    setMinimapVisible(minimapVisible);
    onComplete();
  };

  return (
    <main className="min-h-[100dvh] bg-[#05060b] px-3 py-4 text-white sm:px-6 sm:py-7" data-testid="screen-run-setup">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/15 pb-4">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="mb-3 inline-flex min-h-10 items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[.17em] text-white/55 hover:text-white"
              data-testid="button-run-setup-back"
            >
              <ArrowLeft className="h-4 w-4" /> Hideout
            </button>
            <p className="font-mono text-[10px] font-black uppercase tracking-[.28em] text-cyan-200">Before the block</p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-tight sm:text-5xl">{isLaunch ? 'Run setup' : 'LokPet & Look Lab'}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
              {isLaunch ? `Choose ${selectedCharacter.name}'s companion, then make the screen yours.` : 'Change your companion and look anytime. Nothing here changes stats or rewards.'}
            </p>
          </div>
          <div className="hidden min-w-32 border border-cyan-200/25 bg-cyan-300/5 p-3 text-right sm:block">
            <p className="font-mono text-[9px] uppercase tracking-widest text-cyan-100/65">Step {step === 'companion' ? '1' : '2'} / 2</p>
            <p className="mt-1 text-xs font-black uppercase text-white">{step === 'companion' ? 'LokPet' : 'Your look'}</p>
          </div>
        </header>

        {step === 'companion' ? (
          <section className="mt-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[.22em] text-pink-200">1 · Pick a LokPet</p>
                <h2 className="mt-1 text-xl font-black uppercase">Your run companion</h2>
              </div>
              <p className="text-xs text-white/50">Pick one now · {capacity} slots unlock with Collector characters</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                onClick={() => setSelectedPetId(null)}
                className={`min-h-36 border p-4 text-left transition ${selectedPetId === null ? selectClass(true) : selectClass(false)}`}
                data-testid="button-run-setup-no-pet"
              >
                <span className="grid h-14 w-14 place-items-center border border-white/20 bg-black/40 text-white/55"><PawPrint className="h-7 w-7" /></span>
                <p className="mt-3 text-sm font-black uppercase">Go solo</p>
                <p className="mt-1 text-xs leading-relaxed text-white/50">No companion this run.</p>
              </button>
              {[...regularReadyPets, ...legendaryReadyPets].map((pet) => {
                const selected = pet.id === selectedPetId;
                return (
                  <Fragment key={pet.id}>
                  {pet.roll.legendary && pet.id === legendaryReadyPets[0]?.id ? <div className="col-span-full mt-2 border-t border-amber-300/30 pt-3 font-mono text-[10px] font-black uppercase tracking-[.24em] text-amber-200">Legendary companions</div> : null}
                  <button
                    type="button"
                    onClick={() => setSelectedPetId(pet.id)}
                    className={`relative min-h-36 border p-4 text-left transition ${selected ? selectClass(true) : selectClass(false)}`}
                    data-testid={`button-run-setup-pet-${pet.id}`}
                  >
                    {selected ? <Check className="absolute right-3 top-3 h-4 w-4 text-pink-100" /> : null}
                    <div className="flex items-center gap-3">
                      <LokPetIcon silhouette={pet.roll.silhouette} palette={pet.roll.palette} size={72} className="bg-black/60" />
                      <div className="min-w-0">
                        <p className="truncate text-base font-black uppercase">{pet.roll.name}</p>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-pink-200">{pet.roll.rarityLabel} · {pet.stamina}/3 charge</p>
                        <p className="mt-2 text-xs text-white/55">{pet.roll.traitLabel}</p>
                      </div>
                    </div>
                  </button>
                  </Fragment>
                );
              })}
            </div>

            {readyPets.length === 0 ? (
              <p className="mt-4 border border-amber-200/25 bg-amber-300/5 p-3 text-sm text-amber-100/75">
                No ready LokPets yet. You can go solo, then find a companion in LokPacks.
              </p>
            ) : null}

            <button
              type="button"
              onClick={continueWithCompanion}
              className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 bg-cyan-100 px-6 py-4 text-sm font-black uppercase tracking-[.18em] text-slate-950 transition hover:bg-white sm:w-auto"
              data-testid="button-run-setup-next"
            >
              Next · Set your look <ArrowLeft className="h-4 w-4 rotate-180" />
            </button>
          </section>
        ) : (
          <section className="mt-5" data-lokpet-art-style={artStyle} data-ui-border-style={borderStyle} data-lokpet-border-style={lokPetBorderStyle} data-character-border-style={characterBorderStyle}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">2 · Optional · Look Lab</p>
                <h2 className="mt-1 text-xl font-black uppercase">Make it yours</h2>
              </div>
              <button type="button" onClick={() => onComplete()} className="min-h-10 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-white/55 hover:text-white" data-testid="button-run-setup-skip-look">
                Skip look · use saved
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="border border-white/15 bg-white/[.03] p-4 lg:col-span-2" data-testid="looks-palette-slider">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="text-sm font-black uppercase">Theme palette slider</h3><p className="mt-1 text-xs text-white/55">Slide through every palette you own. The interface updates immediately.</p></div>
                  <span className="font-mono text-[10px] font-bold uppercase text-cyan-100">{ownedPalettes[paletteIndex]?.name ?? 'Default'}</span>
                </div>
                <input type="range" min={0} max={Math.max(0, ownedPalettes.length - 1)} value={paletteIndex} onChange={(event) => { const palette = ownedPalettes[Number(event.target.value)]; if (palette) equipPalette(palette.id); }} className="mt-4 w-full accent-cyan-300" aria-label="Theme palette" />
              </section>
              <section className="border border-white/15 bg-white/[.03] p-4">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase"><PawPrint className="h-4 w-4 text-pink-200" /> LokPet art style</h3>
                <p className="mt-1 text-xs text-white/55">A visual-only finish for portraits and cards.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {ART_STYLES.map((option) => (
                    <button key={option.id} type="button" onClick={() => setArtStyle(option.id)} className={`border p-3 text-left transition ${artStyle === option.id ? selectClass(true) : selectClass(false)}`} aria-pressed={artStyle === option.id} data-testid={`button-lokpet-art-${option.id}`}>
                      <div data-lokpet-art-style={option.id} className="mb-3"><LokPetIcon silhouette="jelly" palette={{ body: '#87529a', bodyDark: '#33214c', accent: '#f0abfc', glow: '#c084fc', eye: '#fef3c7' }} size={64} className="bg-black/60" /></div>
                      <p className="text-xs font-black uppercase">{option.label}</p>
                      <p className="mt-1 text-[11px] leading-snug text-white/50">{option.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="border border-white/15 bg-white/[.03] p-4">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase"><Cpu className="h-4 w-4 text-cyan-200" /> Device mode</h3>
                <p className="mt-1 text-xs text-white/55">Only trims decorative effects—never difficulty or rewards.</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {GRAPHICS.map((option) => (
                    <button key={option.id} type="button" onClick={() => setGraphicsQualityChoice(option.id)} className={`border p-3 text-left transition ${graphicsQuality === option.id ? selectClass(true) : selectClass(false)}`} aria-pressed={graphicsQuality === option.id} data-testid={`button-run-graphics-${option.id}`}>
                      <p className="text-xs font-black uppercase">{option.label}</p>
                      <p className="mt-1 text-[10px] leading-snug text-white/50">{option.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="border border-white/15 bg-white/[.03] p-4">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase"><Grid3X3 className="h-4 w-4 text-violet-200" /> Interface border</h3>
                <p className="mt-1 text-xs text-white/55">Menu cards and controls only.</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {BORDERS.map((option) => {
                    const Icon = option.icon;
                    return <button key={option.id} type="button" onClick={() => setBorderStyle(option.id)} className={`border p-3 text-center transition ${borderStyle === option.id ? selectClass(true) : selectClass(false)}`} aria-pressed={borderStyle === option.id} data-testid={`button-ui-border-${option.id}`}><Icon className="mx-auto h-5 w-5" /><p className="mt-2 text-[11px] font-black uppercase">{option.label}</p></button>;
                  })}
                </div>
              </section>

              <section className="border border-white/15 bg-white/[.03] p-4 lg:col-span-2" data-testid="portrait-border-controls">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase"><Sparkles className="h-4 w-4 text-pink-200" /> Portrait borders</h3>
                    <p className="mt-1 text-xs text-white/55">LokPets and characters each keep their own frame choice. More frames can be added without changing this setup.</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
                    <span>Independent</span><span className="h-1 w-1 rounded-full bg-pink-200" /><span>Visual only</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-3">
                      <LokPetIcon silhouette="jelly" palette={{ body: '#87529a', bodyDark: '#33214c', accent: '#f0abfc', glow: '#c084fc', eye: '#fef3c7' }} size={54} className="bg-black/60" />
                      <div><p className="text-xs font-black uppercase">LokPet frame</p><p className="text-[11px] text-white/50">For companion portraits and cards.</p></div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {BORDERS.map((option) => {
                        const Icon = option.icon;
                        return <button key={option.id} type="button" onClick={() => setLokPetBorderStyleChoice(option.id)} className={`border p-2 text-center transition ${lokPetBorderStyle === option.id ? selectClass(true) : selectClass(false)}`} aria-pressed={lokPetBorderStyle === option.id} data-testid={`button-lokpet-border-${option.id}`}><Icon className="mx-auto h-4 w-4" /><p className="mt-1 text-[10px] font-black uppercase">{option.label}</p></button>;
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="grid h-[54px] w-[54px] place-items-center overflow-hidden border border-white/25 bg-black/60"><RigPortrait rig={selectedCharacter.rig} palette={selectedCharacter.palette} anim="idle" size={48} /></span>
                      <div><p className="text-xs font-black uppercase">Character frame</p><p className="text-[11px] text-white/50">For playable character portraits and cards.</p></div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {BORDERS.map((option) => {
                        const Icon = option.icon;
                        return <button key={option.id} type="button" onClick={() => setCharacterBorderStyleChoice(option.id)} className={`border p-2 text-center transition ${characterBorderStyle === option.id ? selectClass(true) : selectClass(false)}`} aria-pressed={characterBorderStyle === option.id} data-testid={`button-character-border-${option.id}`}><Icon className="mx-auto h-4 w-4" /><p className="mt-1 text-[10px] font-black uppercase">{option.label}</p></button>;
                      })}
                    </div>
                  </div>
                </div>
              </section>

              <section className="border border-white/15 bg-white/[.03] p-4">
                <h3 className="flex items-center gap-2 text-sm font-black uppercase"><Monitor className="h-4 w-4 text-amber-200" /> HUD basics</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['slideout', 'rail'] as const).map((layout) => <button key={layout} type="button" onClick={() => setPanelLayout(layout)} className={`border p-3 text-left transition ${panelLayout === layout ? selectClass(true) : selectClass(false)}`} aria-pressed={panelLayout === layout}><p className="text-xs font-black uppercase">{layout === 'slideout' ? 'Compact' : 'Original'}</p><p className="mt-1 text-[10px] text-white/50">{layout === 'slideout' ? 'Tighter panels' : 'Full roster rail'}</p></button>)}
                </div>
                <button type="button" onClick={() => setMinimapVisibleChoice((visible) => !visible)} className={`mt-2 flex w-full items-center justify-between border p-3 text-left transition ${minimapVisible ? selectClass(true) : selectClass(false)}`} aria-pressed={minimapVisible}><span className="text-xs font-black uppercase">Minimap</span><span className="font-mono text-[10px] uppercase">{minimapVisible ? 'On' : 'Off'}</span></button>
              </section>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => setStep('companion')} className="min-h-11 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-white/55 hover:text-white">Back · LokPet</button>
              <button type="button" onClick={saveLookAndFinish} className="flex min-h-14 items-center justify-center gap-2 bg-cyan-100 px-7 py-4 text-sm font-black uppercase tracking-[.18em] text-slate-950 hover:bg-white" data-testid="button-run-setup-finish">
                {isLaunch ? 'Start the run' : 'Save my look'} <ArrowLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-white/40">Change this anytime from the floating Looks & LokPets button.</p>
          </section>
        )}
      </div>
    </main>
  );
}

export default RunSetupScreen;
