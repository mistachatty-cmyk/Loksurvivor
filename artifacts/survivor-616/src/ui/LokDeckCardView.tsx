import { useState, useRef, type MouseEvent } from 'react';
import { Sparkles, Lock, Crown, Info } from 'lucide-react';
import type { LokAssetManifest } from '@/game/lok/types';
import { CardArtwork, RARITY_STYLE } from './LockDeckCollection';
import {
  getCardVariableProfile,
  ELEMENT_METADATA,
  DATA_TYPE_METADATA,
  FIGHTING_STYLE_METADATA,
} from '@/game/data/cardVariables';

export type CardViewMode = 'classic' | 'dynamic';

interface LokDeckCardViewProps {
  card: LokAssetManifest;
  owned: boolean;
  copies?: number;
  variant?: string;
  mode?: CardViewMode;
  size?: 'compact' | 'standard' | 'large';
  customFrame?: string;
  customOverlay?: string;
  companionSeal?: string;
  onClick?: () => void;
}

export function LokDeckCardView({
  card,
  owned,
  copies = 1,
  variant,
  mode = 'classic',
  size = 'standard',
  customFrame,
  customOverlay,
  companionSeal,
  onClick,
}: LokDeckCardViewProps) {
  const profile = getCardVariableProfile(card);
  const rarity = RARITY_STYLE[card.rarity] ?? RARITY_STYLE.common;
  const elemMeta = ELEMENT_METADATA[profile.element];
  const secondaryElemMeta = profile.secondaryElement ? ELEMENT_METADATA[profile.secondaryElement] : null;
  const dataMeta = DATA_TYPE_METADATA[profile.dataType];
  const styleMeta = FIGHTING_STYLE_METADATA[profile.fightingStyle];

  // 3D tilt & glare state for dynamic mode
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const isApex = card.rarity === 'mythic' || card.rarity === 'secret' || card.rarity === 'legendary';
  const isHolo = variant === 'holo' || variant === 'glitch' || isApex;

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (mode !== 'dynamic' || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -9;
    const rotateY = ((x - centerX) / centerX) * 9;

    setTilt({ x: rotateX, y: rotateY });
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.4,
    });
  };

  const handleMouseLeave = () => {
    if (mode !== 'dynamic') return;
    setTilt({ x: 0, y: 0 });
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  // Compact, ergonomic sizes that don't blow out grids
  const cardDimensions =
    size === 'compact'
      ? 'w-full max-w-[170px] min-h-[200px] aspect-[4/5] mx-auto'
      : size === 'large'
      ? 'w-full max-w-[230px] min-h-[270px] aspect-[4/5] mx-auto'
      : 'w-full max-w-[195px] min-h-[235px] aspect-[4/5] mx-auto';

  const artSize = size === 'compact' ? 58 : size === 'large' ? 96 : 72;

  const frameBorderClass =
    customFrame === 'frame-cyber-matrix'
      ? '!border-[#10b981] !shadow-[0_0_15px_rgba(16,185,129,0.4)] ring-1 ring-emerald-400/50'
      : customFrame === 'frame-firefly-amber'
      ? '!border-[#f59e0b] !shadow-[0_0_16px_rgba(245,158,11,0.45)] ring-1 ring-amber-400/60'
      : customFrame === 'frame-abyssal-void'
      ? '!border-[#a855f7] !shadow-[0_0_14px_rgba(168,85,247,0.4)] ring-1 ring-purple-500/50'
      : customFrame === 'frame-prismatic-gold'
      ? '!border-[#fbbf24] !shadow-[0_0_18px_rgba(251,191,36,0.5)] ring-2 ring-yellow-300'
      : customFrame === 'frame-retro-pixel'
      ? '!border-[#ec4899] !shadow-[0_0_12px_rgba(236,72,153,0.35)] ring-1 ring-cyan-400'
      : '';

  const sealIcon =
    companionSeal === 'seal-digi-wolf'
      ? '🐺'
      : companionSeal === 'seal-circuit-frog'
      ? '🐸'
      : companionSeal === 'seal-dust-mite'
      ? '⚙️'
      : companionSeal === 'seal-firefly-hive'
      ? '🐝'
      : null;

  // -------------------------------------------------------------
  // 1. CLASSIC MODE (Beloved original streamlined format)
  // -------------------------------------------------------------
  if (mode === 'classic') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group relative flex flex-col select-none overflow-hidden rounded-lg border bg-[#0b0c13] p-2 text-left transition-all hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] ${cardDimensions} ${frameBorderClass}`}
        style={{
          borderColor: customFrame ? undefined : rarity.edge,
          boxShadow: customFrame ? undefined : (owned ? `0 0 12px ${rarity.glow}` : undefined),
        }}
        data-testid={`card-classic-${card.id}`}
        aria-label={`${owned ? card.name : 'Unknown Card'} (${card.rarity}) - click for details`}
      >
        {/* Custom Overlay Effects (Glitter, Firefly, Matrix) */}
        {customOverlay === 'overlay-glitter-star' && (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-60">
            <div className="absolute top-2 left-4 text-xs animate-ping text-yellow-200">✦</div>
            <div className="absolute top-10 right-6 text-sm animate-pulse text-amber-100">✧</div>
            <div className="absolute bottom-6 left-6 text-xs animate-pulse text-yellow-300">✦</div>
          </div>
        )}
        {customOverlay === 'overlay-firefly-swarm' && (
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-75">
            <div className="absolute top-4 right-3 h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_6px_#f59e0b] animate-bounce" />
            <div className="absolute bottom-8 right-8 h-1 w-1 rounded-full bg-yellow-200 shadow-[0_0_5px_#facc15] animate-ping" />
            <div className="absolute top-12 left-3 h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b] animate-pulse" />
          </div>
        )}
        {customOverlay === 'overlay-matrix-rain' && (
          <div className="pointer-events-none absolute inset-0 z-20 font-mono text-[7px] text-emerald-400/40 select-none overflow-hidden leading-none p-1">
            010110 101001 001101
          </div>
        )}

        {/* Companion Seal */}
        {sealIcon && (
          <span className="absolute top-1 right-8 z-20 rounded-full bg-black/80 px-1 py-0.2 text-[8px] border border-white/20" title={`Companion Seal: ${companionSeal}`}>
            {sealIcon}
          </span>
        )}
        {/* Subtle radial inner glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background: `radial-gradient(circle at 50% 25%, ${rarity.glow}, transparent 75%)`,
          }}
          aria-hidden="true"
        />

        {/* Top Header: Data Protocol Badge + Element Gems */}
        <div className="relative z-10 flex items-center justify-between gap-1 border-b border-white/10 pb-1 text-[8px] font-mono uppercase tracking-wider">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className="rounded px-1 py-0.2 font-black text-black text-[7px]"
              style={{ backgroundColor: dataMeta.color }}
              title={`Data Type: ${dataMeta.label}`}
            >
              {dataMeta.badge}
            </span>
            <span className="truncate text-white/50 text-[7.5px]">{card.rarity}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span
              className="grid h-4 w-4 place-items-center rounded-full text-[8px] font-bold"
              style={{ backgroundColor: profile.elementColor, color: '#000' }}
              title={`Element: ${profile.elementLabel}`}
            >
              {elemMeta.icon}
            </span>
            {secondaryElemMeta && (
              <span
                className="grid h-3.5 w-3.5 place-items-center rounded-full text-[7px] font-bold"
                style={{ backgroundColor: secondaryElemMeta.color, color: '#000' }}
                title={`Dual Element: ${secondaryElemMeta.label}`}
              >
                {secondaryElemMeta.icon}
              </span>
            )}
          </div>
        </div>

        {/* Center Artwork Canvas */}
        <div className="relative my-1.5 grid flex-1 place-items-center overflow-hidden rounded border border-white/5 bg-black/45">
          <div className={owned ? 'transition-transform group-hover:scale-105' : 'grayscale opacity-30'}>
            <CardArtwork card={card} size={artSize} animated={false} />
          </div>

          {!owned && (
            <div className="absolute inset-0 grid place-items-center bg-black/60">
              <Lock className="h-5 w-5 text-white/40" />
            </div>
          )}

          {/* 1st Edition Stamp */}
          {profile.firstEdition && (
            <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded border border-amber-300/40 bg-amber-400/90 px-1 py-0.2 font-mono text-[6px] font-black uppercase text-black">
              <Crown className="h-2 w-2" /> 1st
            </span>
          )}

          {/* Variant badge */}
          {variant && variant !== 'standard' && (
            <span className="absolute bottom-1 right-1 rounded border border-white/30 bg-black/85 px-1 py-0.2 font-mono text-[6.5px] font-black uppercase tracking-wider text-amber-200">
              {variant}
            </span>
          )}

          {/* Copies count */}
          {copies > 1 && (
            <span className="absolute bottom-1 left-1 rounded bg-black/85 px-1 py-0.2 font-mono text-[7px] font-bold text-white/80">
              x{copies}
            </span>
          )}

          {/* Click to inspect overlay indicator */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <span className="flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider text-white border border-white/20">
              <Info className="h-2.5 w-2.5 text-primary" /> Inspect
            </span>
          </div>
        </div>

        {/* Bottom Panel: Name, Rarity & Tactical Role */}
        <div className="relative z-10 border-t border-white/10 pt-1">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate font-display text-[11px] font-black uppercase text-white leading-tight">
              {owned ? card.name : 'Unknown Card'}
            </p>
            <span className="shrink-0 font-mono text-[8px] font-bold text-rose-300">
              {profile.stats.hp} <span className="text-[6px] text-white/40">HP</span>
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between text-[7.5px] font-mono uppercase tracking-wider">
            <span className={`font-bold ${rarity.ink}`}>
              {profile.stars}
            </span>
            <span className="text-white/45 truncate">{profile.fightingStyleLabel}</span>
          </div>
        </div>
      </button>
    );
  }

  // -------------------------------------------------------------
  // 2. DYNAMIC 3D HOLOGRAPHIC MODE (Interactive cyber foil)
  // -------------------------------------------------------------
  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform: `perspective(850px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${tilt.x !== 0 ? 1.02 : 1}, ${tilt.x !== 0 ? 1.02 : 1}, 1)`,
        transition: tilt.x === 0 ? 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
      }}
      className={`group relative select-none rounded-[10px] p-[2.5px] text-left transition-shadow ${cardDimensions} ${
        onClick ? 'cursor-pointer active:scale-[0.98]' : ''
      } ${
        isApex
          ? 'bg-gradient-to-br from-amber-300 via-purple-600 to-cyan-400 shadow-[0_0_14px_rgba(251,191,36,0.35)]'
          : card.rarity === 'epic'
          ? 'bg-gradient-to-br from-fuchsia-400 via-indigo-600 to-sky-400 shadow-[0_0_10px_rgba(192,132,252,0.3)]'
          : card.rarity === 'rare'
          ? 'bg-gradient-to-br from-sky-400 via-blue-700 to-slate-900 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
          : 'bg-gradient-to-br from-slate-600 via-slate-800 to-stone-900'
      }`}
      aria-label={`${owned ? card.name : 'Unknown Card'} (${card.rarity}) - click for details`}
    >
      {/* Specular glare overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-30 rounded-[10px] mix-blend-color-dodge transition-opacity duration-150"
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.12) 30%, transparent 68%)`,
          opacity: glare.opacity,
        }}
        aria-hidden="true"
      />

      {/* Holographic foil sweep */}
      {isHolo && (
        <div
          className="pointer-events-none absolute inset-0 z-20 rounded-[10px] opacity-35 mix-blend-overlay"
          style={{
            background:
              'linear-gradient(115deg, transparent 15%, rgba(255, 0, 150, 0.45) 32%, rgba(0, 220, 255, 0.45) 48%, rgba(255, 230, 0, 0.45) 64%, transparent 82%)',
            backgroundSize: '220% 220%',
          }}
          aria-hidden="true"
        />
      )}

      {/* Inner Body */}
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[8px] bg-[#0c0d14] p-2 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 20%, ${profile.elementColor}, transparent 75%)`,
          }}
          aria-hidden="true"
        />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between gap-1 border-b border-white/10 pb-1">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className="rounded px-1 py-0.2 font-mono text-[6.5px] font-black uppercase text-black"
              style={{ backgroundColor: dataMeta.color }}
            >
              {dataMeta.badge}
            </span>
            <p className="truncate font-display text-[10.5px] font-black uppercase leading-tight text-white">
              {owned ? card.name : 'Unknown Card'}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="font-mono text-[8px] font-black text-rose-300">
              {profile.stats.hp} <span className="text-[6px] text-white/50">HP</span>
            </span>
            <span
              className="grid h-3.5 w-3.5 place-items-center rounded-full text-[7px] font-bold"
              style={{ backgroundColor: profile.elementColor, color: '#000' }}
            >
              {elemMeta.icon}
            </span>
            {secondaryElemMeta && (
              <span
                className="grid h-3 w-3 place-items-center rounded-full text-[6.5px] font-bold"
                style={{ backgroundColor: secondaryElemMeta.color, color: '#000' }}
              >
                {secondaryElemMeta.icon}
              </span>
            )}
          </div>
        </div>

        {/* Artwork Canvas */}
        <div className="relative my-1.5 grid flex-1 place-items-center overflow-hidden rounded border border-white/10 bg-gradient-to-b from-[#141524] to-[#07070d]">
          <div className={owned ? '' : 'grayscale opacity-30'}>
            <CardArtwork card={card} size={artSize} animated={false} />
          </div>

          {!owned && (
            <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-[1px]">
              <Lock className="h-5 w-5 text-white/40" />
            </div>
          )}

          {profile.firstEdition && (
            <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded border border-amber-300/40 bg-amber-400/90 px-1 py-0.2 font-mono text-[5.5px] font-black uppercase text-black">
              <Crown className="h-2 w-2" /> 1st
            </span>
          )}

          {variant && variant !== 'standard' && (
            <span className="absolute bottom-1 right-1 rounded border border-white/30 bg-black/80 px-1 py-0.2 font-mono text-[6px] font-black uppercase tracking-wider text-amber-200">
              {variant}
            </span>
          )}

          {/* Hover inspect hint */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <span className="flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider text-white border border-white/20">
              <Info className="h-2.5 w-2.5 text-primary" /> Inspect
            </span>
          </div>
        </div>

        {/* Combat Stats Ticker */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-1 font-mono text-[7px] uppercase text-white/60">
          <span>ATK: <strong className="text-amber-200">{profile.stats.attack}</strong></span>
          <span>DEF: <strong className="text-sky-200">{profile.stats.defense}</strong></span>
          <span className="truncate max-w-[65px]">{styleMeta.label}</span>
          <span className={`font-bold ${rarity.ink}`}>{profile.stars}</span>
        </div>
      </div>
    </div>
  );
}
export default LokDeckCardView;
