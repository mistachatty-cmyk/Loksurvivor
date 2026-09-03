import { useEffect, useRef, useState } from 'react';
import { Check, CloudRain, Flame, Lock, Palette, Radar, ScanLine, Sparkles } from 'lucide-react';

import { RUN_AURAS } from '@/game/data/runAuras';
import { HATS, getHatStyle } from '@/game/data/hats';
import { CELEBRATIONS, getCelebrationStyle } from '@/game/data/celebrations';
import { hasCatalogItem } from '@/game/data/devUnlockRegistry';
import { THEMED_PALETTES } from '@/game/data/themedPalettes';
import { useMeta } from '@/game/state/metaStore';
import { humanoidRig } from '@/game/sprites/rigs';
import type { AnimName, PaletteEffectKind, RunAuraStyle, SpritePalette } from '@/game/types';
import { CosmeticPreview } from './CosmeticPreview';
import { ScreenLayout } from './ScreenLayout';

const VENDOR_RIG = humanoidRig({ height: 20, width: 10, hood: true });
const VENDOR_PALETTE: SpritePalette = {
  ink: '#1a1410', body: '#3d2b1f', bodyDark: '#241a12', accent: '#d4a373',
  accentBright: '#f4c78a', skin: '#c9986b', glow: '#e8b04b',
};

const VENDOR_QUIPS = [
  'Mm. A worthy commission.', 'Every stroke of this is mine, you know.',
  'You have taste. Rare, on this block.', 'I mixed that shade myself. Twice.',
  'Wear it well. It deserves that much.', 'Another masterpiece leaves the gallery.',
  'The pigment alone took me a week.',
];

const AURA_ICONS = {
  'street-halo': Sparkles,
  'radar-sweep': Radar,
  'ember-orbit': Flame,
  'rain-signal': CloudRain,
  'glitch-echo': ScanLine,
  mothlight: Sparkles,
} satisfies Record<RunAuraStyle, typeof Sparkles>;

const EFFECT_PREVIEW_CLASSES = {
  glow: 'palette-preview-glow',
  pulse: 'palette-preview-pulse',
  prism: 'palette-preview-prism',
  flicker: 'palette-preview-flicker',
  wave: 'palette-preview-wave',
} satisfies Record<PaletteEffectKind, string>;

type ShopCategory = 'palettes' | 'auras' | 'hats' | 'celebrations';

interface Props { onBack: () => void }

function ShopTabs({ active, onChange }: { active: ShopCategory; onChange: (category: ShopCategory) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" aria-label="Customization categories">
      {([
        ['palettes', 'World colors', Palette],
        ['auras', 'Run auras', Sparkles],
        ['hats', 'Floating hats', Sparkles],
        ['celebrations', 'Celebrations', Sparkles],
      ] as const).map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={active === id}
          className={`flex items-center justify-center gap-2 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${active === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary hover:text-white'}`}
          data-testid={`button-shop-${id}`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function PaletteGalleryPanel({ onBack }: Props) {
  const { meta, buyPalette, equipPalette, buyRunAura, equipRunAura, buyHat, equipHat, buyCelebration, equipCelebration } = useMeta();
  const [category, setCategory] = useState<ShopCategory>('palettes');
  const [previewPaletteId, setPreviewPaletteId] = useState(meta.activePaletteId);
  const [previewAuraId, setPreviewAuraId] = useState(meta.activeRunAuraId);
  const [previewHatId, setPreviewHatId] = useState(meta.activeHatId);
  const [previewCelebrationId, setPreviewCelebrationId] = useState(meta.activeCelebrationId);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [reactAnim, setReactAnim] = useState<AnimName>('idle');
  const [line, setLine] = useState(VENDOR_QUIPS[0]);
  const [notice, setNotice] = useState('Choose a commission. Every item is cosmetic-only.');
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const triggerReaction = (message: string) => {
    const clip = VENDOR_RIG.anims.attack;
    setReactAnim('attack');
    setLine(VENDOR_QUIPS[Math.floor(Math.random() * VENDOR_QUIPS.length)]!);
    setNotice(message);
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setReactAnim('idle'), clip.frames.length * clip.frameMs);
  };

  const handleBuyPalette = (paletteId: string) => {
    const palette = THEMED_PALETTES.find((entry) => entry.id === paletteId);
    if (!palette || meta.ownedPaletteIds.includes(palette.id) || meta.lootTokens < palette.cost) return;
    buyPalette(palette.id);
    triggerReaction(`${palette.name} purchased for ${palette.cost} loot token${palette.cost === 1 ? '' : 's'}.`);
  };

  const handleBuyAura = (auraId: string) => {
    const aura = RUN_AURAS.find((entry) => entry.id === auraId);
    if (!aura || meta.ownedRunAuraIds.includes(aura.id) || meta.lootTokens < aura.cost) return;
    buyRunAura(aura.id);
    triggerReaction(`${aura.name} purchased for ${aura.cost} loot token${aura.cost === 1 ? '' : 's'}.`);
  };
  const buyCosmetic = (id: string, kind: 'hat' | 'celebration') => kind === 'hat' ? buyHat(id) : buyCelebration(id);

  const previewPalette = THEMED_PALETTES.find((palette) => palette.id === previewPaletteId)?.palette ?? VENDOR_PALETTE;
  const previewAura = RUN_AURAS.find((aura) => aura.id === previewAuraId)?.style ?? 'street-halo';
  const previewHat = getHatStyle(previewHatId);
  const previewCelebration = getCelebrationStyle(previewCelebrationId);

  return (
    <ScreenLayout title="Customization Shop" subtitle="Artisian Valur — Paint Gallery" onBack={onBack}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="flex shrink-0 flex-col items-center gap-3 border border-border bg-card px-6 py-5 lg:sticky lg:top-4 lg:w-72">
          <CosmeticPreview rig={VENDOR_RIG} palette={previewPalette} aura={previewAura} hat={previewHat} celebration={previewCelebration} celebrationKey={celebrationKey} />
          <p className="text-sm font-black uppercase tracking-wide text-white">Artisian Valur</p>
          <p className="-mt-2 text-center font-mono text-[8px] uppercase tracking-widest text-primary">Tap any cosmetic card to preview it on Valur</p>
          <p className="min-h-[2.5rem] text-center text-xs italic leading-relaxed text-muted-foreground">&ldquo;{line}&rdquo;</p>
          <div className="w-full border border-primary/30 bg-primary/5 px-3 py-2 text-center">
            <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Wallet</p>
            <p className="mt-1 text-lg font-black text-primary" data-testid="text-shop-token-balance">{meta.lootTokens} loot token{meta.lootTokens === 1 ? '' : 's'}</p>
          </div>
          <div className="w-full"><ShopTabs active={category} onChange={setCategory} /></div>
          <p className="min-h-10 text-center text-[11px] leading-relaxed text-muted-foreground" aria-live="polite">{notice}</p>
        </aside>

        <section className="flex-1 border border-border bg-card p-5 sm:p-6" data-testid="section-customization-shop">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              {category === 'palettes' ? <Palette className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">{category === 'palettes' ? 'World & character colors' : category === 'auras' ? 'Procedural run effects' : category === 'hats' ? 'Floating headwear' : 'Reward reveal effects'}</p>
              <h2 className="mt-1 text-xl font-black uppercase text-white">{category === 'palettes' ? 'Palette commissions' : category === 'auras' ? 'Signal auras' : category === 'hats' ? 'Hover hats' : 'Celebrations'}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {category === 'palettes'
                  ? 'Recolor your fighter, weapon effects, and world accents. Premium palettes cost more, but nothing here changes combat power.'
                  : category === 'auras' ? 'Add a lightweight Canvas2D effect around your fighter. Auras use your active palette and never alter hitboxes or stats.' : category === 'hats' ? 'Equip a hovering cosmetic above your fighter. It stays visual-only and never blocks the arena.' : 'Choose the burst that plays when you open a reward. Tap a card to play it on Valur before equipping it.'}
              </p>

              {category === 'palettes' ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="shop-palette-grid">
                  {THEMED_PALETTES.map((palette) => {
                    const owned = hasCatalogItem(meta, 'palettes', palette.id, meta.ownedPaletteIds);
                    const equipped = meta.activePaletteId === palette.id;
                    const affordable = meta.lootTokens >= palette.cost;
                    return (
                      <article key={palette.id} className={`border p-4 ${equipped ? 'border-primary bg-primary/5' : 'border-border bg-background'}`} data-testid={`card-palette-${palette.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-black uppercase tracking-wide text-white">{palette.name}</h3>
                          {equipped ? <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Equipped" /> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="border border-white/15 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-white/65">{palette.tier ?? 'standard'}</span>
                          {palette.effect ? <span className="border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-primary">Animated · {palette.effect.label}</span> : null}
                        </div>
                        <div className="mt-2 flex gap-1" role="img" aria-label={`${palette.name} color preview`}>
                          {[palette.palette.body, palette.palette.accent, palette.palette.accentBright, palette.palette.glow].map((color, colorIndex) => <span key={color} className={`h-5 flex-1 border border-white/10 ${palette.effect ? EFFECT_PREVIEW_CLASSES[palette.effect.kind] : ''}`} style={{ backgroundColor: color, animationDelay: `${colorIndex * 90}ms` }} />)}
                        </div>
                        <p className="mt-2 min-h-12 text-xs leading-relaxed text-muted-foreground">{palette.description}</p>
                        <button type="button" onClick={() => setPreviewPaletteId(palette.id)} aria-pressed={previewPaletteId === palette.id} className={`mt-3 w-full border px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-widest ${previewPaletteId === palette.id ? 'border-white/50 bg-white/10 text-white' : 'border-white/15 text-white/70 hover:border-white/40'}`} data-testid={`button-preview-palette-${palette.id}`}>{previewPaletteId === palette.id ? 'Previewing on Valur' : 'Preview on Valur'}</button>
                        {owned ? (
                          <button type="button" onClick={() => { equipPalette(palette.id); setNotice(`${palette.name} equipped.`); }} disabled={equipped} className={`mt-3 w-full border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${equipped ? 'cursor-default border-primary/40 text-primary/70' : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'}`} data-testid={`button-equip-palette-${palette.id}`}>{equipped ? 'Equipped' : 'Equip'}</button>
                        ) : (
                          <button type="button" onClick={() => handleBuyPalette(palette.id)} disabled={!affordable} className={`mt-3 flex w-full items-center justify-center gap-2 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${affordable ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground' : 'cursor-not-allowed border-border text-muted-foreground/50'}`} data-testid={`button-buy-palette-${palette.id}`}>
                            {!affordable ? <Lock className="h-3 w-3" /> : null}{affordable ? `Buy · ${palette.cost} token${palette.cost === 1 ? '' : 's'}` : `Need ${palette.cost} tokens`}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : category === 'auras' ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="shop-aura-grid">
                  {RUN_AURAS.map((aura) => {
                    const owned = hasCatalogItem(meta, 'runAuras', aura.id, meta.ownedRunAuraIds);
                    const equipped = meta.activeRunAuraId === aura.id;
                    const affordable = meta.lootTokens >= aura.cost;
                    const Icon = AURA_ICONS[aura.style];
                    return (
                      <article key={aura.id} className={`border p-4 ${equipped ? 'border-primary bg-primary/5' : 'border-border bg-background'}`} data-testid={`card-aura-${aura.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-primary/50 bg-primary/10 text-primary shadow-[0_0_18px_hsl(var(--primary)/0.18)]" aria-hidden="true"><Icon className="h-5 w-5" /></div>
                          {equipped ? <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Equipped" /> : null}
                        </div>
                        <h3 className="mt-3 text-sm font-black uppercase tracking-wide text-white">{aura.name}</h3>
                        <span className="mt-2 inline-block border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-primary">{aura.tier}</span>
                        <p className="mt-2 min-h-12 text-xs leading-relaxed text-muted-foreground">{aura.description}</p>
                        <button type="button" onClick={() => setPreviewAuraId(aura.id)} className="mt-3 w-full border border-white/20 px-3 py-1.5 font-mono text-[8px] uppercase tracking-widest text-white/80">Preview on Valur</button>
                        {owned ? (
                          <button type="button" onClick={() => { equipRunAura(aura.id); setNotice(`${aura.name} equipped for your next run.`); }} disabled={equipped} className={`mt-3 w-full border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${equipped ? 'cursor-default border-primary/40 text-primary/70' : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'}`} data-testid={`button-equip-aura-${aura.id}`}>{equipped ? 'Equipped' : 'Equip'}</button>
                        ) : (
                          <button type="button" onClick={() => handleBuyAura(aura.id)} disabled={!affordable} className={`mt-3 flex w-full items-center justify-center gap-2 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${affordable ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground' : 'cursor-not-allowed border-border text-muted-foreground/50'}`} data-testid={`button-buy-aura-${aura.id}`}>
                            {!affordable ? <Lock className="h-3 w-3" /> : null}{affordable ? `Buy · ${aura.cost} token${aura.cost === 1 ? '' : 's'}` : `Need ${aura.cost} tokens`}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid={`shop-${category}-grid`}>
                  {(category === 'hats' ? HATS : CELEBRATIONS).map((item) => {
                    const isHat = category === 'hats';
                    const owned = isHat
                      ? hasCatalogItem(meta, 'hats', item.id, meta.ownedHatIds)
                      : hasCatalogItem(meta, 'celebrations', item.id, meta.ownedCelebrationIds);
                    const equipped = isHat ? meta.activeHatId === item.id : meta.activeCelebrationId === item.id;
                    const preview = () => {
                      if (isHat) setPreviewHatId(item.id);
                      else { setPreviewCelebrationId(item.id); setCelebrationKey((key) => key + 1); }
                    };
                    const equip = () => isHat ? equipHat(item.id) : equipCelebration(item.id);
                    return (
                      <article key={item.id} className={`border p-4 ${equipped ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}>
                        <h3 className="text-sm font-black uppercase tracking-wide text-white">{item.name}</h3>
                        <span className="mt-2 inline-block border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-primary">{item.tier}</span>
                        <p className="mt-2 min-h-12 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                        <button type="button" onClick={preview} className="mt-3 w-full border border-white/20 px-3 py-1.5 font-mono text-[8px] uppercase tracking-widest text-white/80">{isHat ? 'Preview on Valur' : 'Play celebration'}</button>
                        {owned ? <button type="button" onClick={equip} disabled={equipped} className="mt-3 w-full border border-primary px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary disabled:opacity-50">{equipped ? 'Equipped' : 'Equip'}</button> : <button type="button" onClick={() => buyCosmetic(item.id, isHat ? 'hat' : 'celebration')} disabled={meta.lootTokens < item.cost} className="mt-3 w-full border border-primary px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary disabled:opacity-40">Buy · {item.cost} tokens</button>}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </ScreenLayout>
  );
}

export default PaletteGalleryPanel;
