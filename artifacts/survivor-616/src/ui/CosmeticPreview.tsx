import { useEffect, useState, type CSSProperties } from 'react';
import { GameIcon } from './GameIcon';

import type { AnimName, CelebrationStyle, HatStyle, PaletteEffectKind, RunAuraStyle, SpritePalette, SpriteRig } from '@/game/types';
import { RigPortrait } from './RigPortrait';

const HAT_MARK: Record<HatStyle, string> = {
  none: '', 'top-hat': 'hatTop', halo: 'halo', crown: 'crown', satellite: 'satellite', 'rain-cloud': 'rainCloud', cone: 'cone', 'orbital-eye': 'orbitalEye', 'moth-cap': 'mothCap', antenna: 'antenna', 'vinyl-disc': 'vinyl', 'paper-visor': 'visor', 'steam-kettle': 'vial', 'paper-lantern': 'light',
};
const CELEBRATION_MARKS: Record<CelebrationStyle, string[]> = {
  'paper-stars': ['spark', 'sparkHollow', 'star', 'spark', 'sparkHollow'],
  'coin-burst': ['dot', 'dotCore', 'dot', 'spark', 'dotCore'],
  'signal-hearts': ['heart', 'heartHollow', 'heart', 'sparkHollow', 'heartHollow'],
  'confetti-rain': ['bar', 'diamond', 'rankUpSmall', 'dot', 'spark'],
  'moth-swarm': ['diamondHollow', 'diamondCore', 'sparkHollow', 'diamondHollow', 'diamondCore'],
  'spark-shower': ['slashA', 'slashB', 'spark', 'slashA', 'slashB'],
  'firefly-drift': ['dotCore', 'dot', 'sparkHollow', 'dotCore', 'dot'],
};

export function CosmeticPreview({ rig, palette, aura, hat, celebration, celebrationKey = 0, anim = 'idle', paletteEffect, compact = false }: {
  rig: SpriteRig; palette: SpritePalette; aura: RunAuraStyle; hat: HatStyle; celebration: CelebrationStyle; celebrationKey?: number; anim?: AnimName; paletteEffect?: PaletteEffectKind; compact?: boolean;
}) {
  const [showCelebration, setShowCelebration] = useState(false);
  useEffect(() => {
    if (!celebrationKey) return;
    setShowCelebration(true);
    const timer = window.setTimeout(() => setShowCelebration(false), 1250);
    return () => window.clearTimeout(timer);
  }, [celebrationKey]);
  const auraClass = `cosmetic-aura cosmetic-aura-${aura}`;
  return (
    <div className={`relative grid place-items-center overflow-hidden border border-primary/25 bg-black/25 ${compact ? 'h-24 w-20' : 'h-56 w-48'}`} aria-label="Live cosmetic preview">
      <div className={`${auraClass} absolute inset-4`} style={{ '--aura': palette.glow, '--accent': palette.accentBright } as CSSProperties} />
      <RigPortrait rig={rig} palette={palette} anim={anim} size={compact ? 72 : 158} className={`absolute bottom-1 z-10 ${paletteEffect ? `palette-preview-${paletteEffect}` : ''}`} />
      {HAT_MARK[hat] ? <span className={`pointer-events-none absolute z-20 text-primary drop-shadow-[0_0_10px_currentColor] ${compact ? 'text-xl' : 'text-4xl'} cosmetic-hat-${hat}`} aria-hidden="true"><GameIcon name={HAT_MARK[hat]} /></span> : null}
      {showCelebration ? CELEBRATION_MARKS[celebration].map((mark, index) => (
        <span key={`${celebrationKey}-${index}`} className="pointer-events-none absolute z-30 font-black text-2xl cosmetic-celebration" style={{ left: `${18 + index * 15}%`, color: index % 2 ? palette.accentBright : palette.glow, animationDelay: `${index * 70}ms` }} aria-hidden="true"><GameIcon name={mark} /></span>
      )) : null}
    </div>
  );
}
