import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PackageOpen, Sparkles, X } from 'lucide-react';

import type { SfxPlayer } from '@/game/audio/useSfxPlayer';
import { CARD_MANIFESTS_BY_ID } from '@/game/data/cards';
import { CARD_SHOP_PACKS_BY_ID, PASSIVE_CARDS_BY_ID, type CardPull } from '@/game/data/passiveCards';
import type { CardPackReveal } from '@/game/state/metaStore';
import type { CardVariant } from '@/game/types';
import { CardArtwork, RARITY_STYLE } from './LockDeckCollection';

const VARIANT_STYLE: Record<CardVariant, { label: string; ring: string; text: string }> = {
  standard: { label: 'Standard', ring: 'ring-white/10', text: 'text-white/45' },
  foil: { label: 'Foil', ring: 'ring-sky-300/60', text: 'text-sky-200' },
  neon: { label: 'Neon', ring: 'ring-fuchsia-300/70', text: 'text-fuchsia-200' },
  glitch: { label: 'Glitch', ring: 'ring-emerald-300/70', text: 'text-emerald-200' },
  holo: { label: 'Holo', ring: 'ring-yellow-300/80', text: 'text-yellow-200' },
};

const FLIP_DELAY_MS = 260;
const HOLD_MS = 1500;

function pulledCardInfo(pull: CardPull) {
  const manifest = CARD_MANIFESTS_BY_ID[pull.cardId];
  if (manifest) return { name: manifest.name, rarity: manifest.rarity, manifest };
  const passive = PASSIVE_CARDS_BY_ID[pull.cardId];
  if (passive) return { name: passive.name, rarity: passive.rarity, manifest: undefined };
  return { name: 'Unknown Signal', rarity: 'common', manifest: undefined };
}

function PulledCardFace({ pull, size }: { pull: CardPull; size: 'focal' | 'tray' }) {
  const info = pulledCardInfo(pull);
  const rarity = RARITY_STYLE[info.rarity] ?? RARITY_STYLE.common;
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[14px] border bg-[#09090d]" style={{ borderColor: rarity.edge }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 30%, ${rarity.glow}, transparent 70%)` }} aria-hidden="true" />
      <div className="relative grid flex-1 place-items-center p-2">
        {info.manifest ? (
          <CardArtwork card={info.manifest} size={size === 'focal' ? 120 : 44} animated={size === 'focal'} />
        ) : (
          <Sparkles className={size === 'focal' ? 'h-12 w-12' : 'h-5 w-5'} style={{ color: rarity.edge }} />
        )}
      </div>
      {size === 'focal' && (
        <div className="relative border-t border-white/10 bg-black/40 p-3 text-center">
          <p className={`font-mono text-[9px] font-black uppercase tracking-[.2em] ${rarity.ink}`}>{info.rarity}</p>
          <p className="mt-1 font-display text-base font-black uppercase leading-tight text-white">{info.name}</p>
        </div>
      )}
    </div>
  );
}

function PackCardBack() {
  return (
    <div className="grid h-full w-full place-items-center rounded-[14px] border border-white/15 bg-[linear-gradient(135deg,#1a1a24,#0a0a10)] [backface-visibility:hidden]">
      <span className="font-display text-2xl font-black tracking-tighter text-white/15">616</span>
    </div>
  );
}

function FocalCard({ pull, flipped, isNew, onTap }: { pull: CardPull; flipped: boolean; isNew: boolean; onTap: () => void }) {
  const variant = VARIANT_STYLE[pull.variant];
  return (
    <button type="button" onClick={onTap} className="relative h-full w-full [perspective:1000px] transition-transform active:scale-[0.97]" data-testid="button-reveal-card" aria-label={flipped ? 'Reveal next card' : 'Reveal card'}>
      <motion.div className="relative h-full w-full [transform-style:preserve-3d]" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ duration: 0.45, ease: 'easeInOut' }}>
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <PackCardBack />
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <PulledCardFace pull={pull} size="focal" />
        </div>
      </motion.div>
      {isNew && flipped && (
        <motion.span
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -right-2 -top-2 border border-emerald-300/60 bg-emerald-300/15 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-widest text-emerald-200"
        >
          New
        </motion.span>
      )}
      {flipped && (
        <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm border bg-black/80 px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-widest ${variant.ring} ${variant.text}`}>
          {variant.label}
        </span>
      )}
    </button>
  );
}

export function PackOpeningReveal({
  reveal,
  cardCredits,
  sfx,
  onOpenAnother,
  onClose,
}: {
  reveal: CardPackReveal;
  cardCredits: number;
  sfx?: SfxPlayer;
  onOpenAnother: () => void;
  onClose: () => void;
}) {
  const pack = CARD_SHOP_PACKS_BY_ID[reveal.packId];
  const [focusIndex, setFocusIndex] = useState(0);
  const [focalFlipped, setFocalFlipped] = useState(false);
  const advancedRef = useRef(false);
  const done = focusIndex >= reveal.pulls.length;
  const canReopen = cardCredits >= pack.cost;

  const flipUp = () => {
    setFocalFlipped(true);
    sfx?.play('cardPack');
  };

  useEffect(() => {
    setFocusIndex(0);
  }, [reveal]);

  useEffect(() => {
    if (done) return;
    setFocalFlipped(false);
    advancedRef.current = false;
    const flipTimer = setTimeout(flipUp, FLIP_DELAY_MS);
    return () => clearTimeout(flipTimer);
    // flipUp is a stable per-render closure over refs/setState/sfx only; re-running
    // this effect on every render would be harmless but pointless, so it's scoped to
    // the two values that actually change the outcome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIndex, done]);

  const advance = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    sfx?.play('uiClick');
    setFocusIndex((i) => i + 1);
  };

  useEffect(() => {
    if (done || !focalFlipped) return;
    const advanceTimer = setTimeout(advance, HOLD_MS);
    return () => clearTimeout(advanceTimer);
    // advance is a stable per-render closure over refs/setState only; re-running this
    // effect on every render would be harmless but pointless, so it's scoped to the
    // two values that actually change the outcome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focalFlipped, done]);

  const handleFocalTap = () => (focalFlipped ? advance() : flipUp());

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto bg-black/90 p-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Lock Pack opening">
      <button
        type="button"
        onClick={() => { onClose(); sfx?.play('uiNav'); }}
        className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center border border-white/20 bg-black/70 text-white transition-all active:scale-[0.97] hover:border-white/50"
        aria-label="Close pack opening"
        data-testid="button-close-pack-reveal"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex w-full max-w-2xl flex-col items-center">
        <p className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[.28em] text-fuchsia-200">
          <PackageOpen className="h-4 w-4" />
          {pack.name}
        </p>
        {done ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-center">
            <p className="font-display text-2xl font-black uppercase text-white">Pack opened</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-white/45">{reveal.newFlags.filter(Boolean).length} new · {reveal.pulls.length} total</p>
          </motion.div>
        ) : (
          <p className="mt-4 text-[10px] uppercase tracking-widest text-white/35">Tap the card to reveal it</p>
        )}

        <div className="mt-6 flex min-h-44 w-full flex-wrap items-center justify-center gap-2 sm:min-h-56 sm:gap-3">
          {reveal.pulls.map((pull, index) => {
            const state = index < focusIndex || done ? 'settled' : index === focusIndex ? 'focal' : 'queued';
            return (
              <motion.div
                key={index}
                layout
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className={state === 'focal' ? 'h-40 w-32 sm:h-52 sm:w-40' : state === 'settled' ? 'h-16 w-12 sm:h-20 sm:w-16' : 'h-14 w-10 opacity-40 sm:h-16 sm:w-12'}
              >
                {state === 'focal' ? (
                  <FocalCard pull={pull} flipped={focalFlipped} isNew={reveal.newFlags[index] ?? false} onTap={handleFocalTap} />
                ) : state === 'settled' ? (
                  <PulledCardFace pull={pull} size="tray" />
                ) : (
                  <PackCardBack />
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {!done && (
            <button
              type="button"
              onClick={handleFocalTap}
              className="border border-white/20 px-4 py-2.5 font-mono text-[10px] font-black uppercase tracking-widest text-white/60 transition-all active:scale-[0.97] hover:border-white/40"
              data-testid="button-skip-card-reveal"
            >
              Skip
            </button>
          )}
          {done && (
            <>
              <button
                type="button"
                onClick={() => { onOpenAnother(); sfx?.play('purchase'); }}
                disabled={!canReopen}
                className="border border-fuchsia-200/50 bg-fuchsia-300/10 px-5 py-2.5 font-mono text-[10px] font-black uppercase text-fuchsia-100 transition-all active:scale-[0.97] disabled:opacity-35 disabled:active:scale-100"
                data-testid="button-open-another-pack"
              >
                Open Another · {pack.cost} CC
              </button>
              <button
                type="button"
                onClick={() => { onClose(); sfx?.play('uiNav'); }}
                className="border border-white/20 px-5 py-2.5 font-mono text-[10px] font-black uppercase tracking-widest text-white/70 transition-all active:scale-[0.97] hover:border-white/40"
                data-testid="button-done-pack-reveal"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PackOpeningReveal;
