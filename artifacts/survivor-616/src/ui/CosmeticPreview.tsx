import { useEffect, useState, type CSSProperties } from 'react';

import type { AnimName, CelebrationStyle, HatStyle, PaletteEffectKind, RunAuraStyle, SpritePalette, SpriteRig } from '@/game/types';
import { RigPortrait } from './RigPortrait';

const HAT_MARK: Record<HatStyle, string> = {
  none: '', 'top-hat': '▰', halo: '◌', crown: '♛', satellite: '◉', 'rain-cloud': '☁', cone: '▲', 'orbital-eye': '◉', 'moth-cap': '⌁',
};
const CELEBRATION_MARKS: Record<CelebrationStyle, string[]> = {
  'paper-stars': ['✦', '✧', '★', '✦', '✧'],
  'coin-burst': ['●', '◉', '●', '✦', '◉'],
  'signal-hearts': ['♥', '♡', '♥', '✧', '♡'],
  'confetti-rain': ['▰', '◆', '▴', '●', '✦'],
  'moth-swarm': ['◇', '◈', '✧', '◇', '◈'],
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
      {HAT_MARK[hat] ? <span className={`pointer-events-none absolute z-20 text-primary drop-shadow-[0_0_10px_currentColor] ${compact ? 'text-xl' : 'text-4xl'} cosmetic-hat-${hat}`} aria-hidden="true">{HAT_MARK[hat]}</span> : null}
      {showCelebration ? CELEBRATION_MARKS[celebration].map((mark, index) => (
        <span key={`${celebrationKey}-${index}`} className="pointer-events-none absolute z-30 font-black text-2xl cosmetic-celebration" style={{ left: `${18 + index * 15}%`, color: index % 2 ? palette.accentBright : palette.glow, animationDelay: `${index * 70}ms` }} aria-hidden="true">{mark}</span>
      )) : null}
    </div>
  );
}
