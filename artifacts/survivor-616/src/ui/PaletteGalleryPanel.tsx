import { useRef, useState } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';

import { THEMED_PALETTES } from '@/game/data/themedPalettes';
import { useMeta } from '@/game/state/metaStore';
import { humanoidRig } from '@/game/sprites/rigs';
import type { AnimName, SpritePalette } from '@/game/types';
import { RigPortrait } from './RigPortrait';
import { ScreenLayout } from './ScreenLayout';

/**
 * Artisian Valur's own look -- deliberately not one of the purchasable
 * palettes, so buying a new colorway never changes the vendor standing
 * in front of the racks.
 */
const VENDOR_RIG = humanoidRig({ height: 20, width: 10, hood: true });
const VENDOR_PALETTE: SpritePalette = {
  ink: '#1a1410',
  body: '#3d2b1f',
  bodyDark: '#241a12',
  accent: '#d4a373',
  accentBright: '#f4c78a',
  skin: '#c9986b',
  glow: '#e8b04b',
};

const VENDOR_QUIPS = [
  "Mm. A worthy commission.",
  "Every stroke of this is mine, you know.",
  "You have taste. Rare, on this block.",
  "I mixed that shade myself. Twice.",
  "Wear it well. It deserves that much.",
  "Another masterpiece leaves the gallery.",
  "The pigment alone took me a week.",
];

interface Props {
  onBack: () => void;
}

/**
 * Standalone shop for cosmetic character/world color palettes, spent in
 * loot tokens. Pulled out of Settings so Artisian Valur has an actual room
 * to stand in and react to a sale, mirroring how the Quartermaster gets
 * their own full screen.
 */
export function PaletteGalleryPanel({ onBack }: Props) {
  const { meta, buyPalette, equipPalette } = useMeta();
  const [reactAnim, setReactAnim] = useState<AnimName>('idle');
  const [line, setLine] = useState(VENDOR_QUIPS[0]);
  const resetTimer = useRef<number | undefined>(undefined);

  const triggerReaction = () => {
    const clip = VENDOR_RIG.anims.attack;
    const duration = clip.frames.length * clip.frameMs;
    setReactAnim('attack');
    setLine(VENDOR_QUIPS[Math.floor(Math.random() * VENDOR_QUIPS.length)]!);
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setReactAnim('idle'), duration);
  };

  const handleBuy = (paletteId: string) => {
    buyPalette(paletteId);
    triggerReaction();
  };

  return (
    <ScreenLayout title="Paint Gallery" subtitle="Artisian Valur — Studio Row" onBack={onBack}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex shrink-0 flex-col items-center gap-3 border border-border bg-card px-6 py-5 lg:w-64">
          <RigPortrait rig={VENDOR_RIG} palette={VENDOR_PALETTE} anim={reactAnim} size={160} />
          <p className="text-sm font-black uppercase tracking-wide text-white">Artisian Valur</p>
          <p className="min-h-[2.5rem] text-center text-xs italic leading-relaxed text-muted-foreground">
            &ldquo;{line}&rdquo;
          </p>
        </div>

        <section className="flex-1 border border-border bg-card p-5 sm:p-6" data-testid="section-palette-store">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Spend loot tokens earned in runs and commission custom character and world colorways through
                Artisian Valur's exquisite palette collection. Purely cosmetic &mdash; gameplay never changes.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {THEMED_PALETTES.map((theme) => {
                  const owned = meta.ownedPaletteIds.includes(theme.id);
                  const equipped = meta.activePaletteId === theme.id;
                  const affordable = meta.lootTokens >= theme.cost;
                  return (
                    <div
                      key={theme.id}
                      className={`border p-4 ${equipped ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                      data-testid={`card-palette-${theme.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-black uppercase tracking-wide text-white">{theme.name}</h3>
                        {equipped ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                      </div>
                      <div className="mt-2 flex gap-1">
                        {[theme.palette.body, theme.palette.accent, theme.palette.accentBright, theme.palette.glow].map(
                          (color, i) => (
                            <span
                              key={i}
                              className="h-5 flex-1 border border-white/10"
                              style={{ backgroundColor: color }}
                            />
                          ),
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{theme.description}</p>

                      {owned ? (
                        <button
                          type="button"
                          onClick={() => equipPalette(theme.id)}
                          disabled={equipped}
                          className={`mt-3 w-full border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            equipped
                              ? 'cursor-default border-primary/40 text-primary/70'
                              : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                          }`}
                          data-testid={`button-equip-palette-${theme.id}`}
                        >
                          {equipped ? 'Equipped' : 'Equip'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBuy(theme.id)}
                          disabled={!affordable}
                          className={`mt-3 flex w-full items-center justify-center gap-2 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            affordable
                              ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                              : 'cursor-not-allowed border-border text-muted-foreground/50'
                          }`}
                          data-testid={`button-buy-palette-${theme.id}`}
                        >
                          {!affordable ? <Lock className="h-3 w-3" /> : null}
                          {affordable
                            ? `Buy for ${theme.cost} token${theme.cost === 1 ? '' : 's'}`
                            : `Need ${theme.cost} token${theme.cost === 1 ? '' : 's'}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </ScreenLayout>
  );
}

export default PaletteGalleryPanel;
