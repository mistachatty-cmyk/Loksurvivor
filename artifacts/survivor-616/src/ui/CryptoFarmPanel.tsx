/**
 * The crypto farm: a passive Digital Essence generator, its essence-pack
 * shop, and the collectible cast-card binder it feeds.
 *
 * `CryptoFarmHubWidget` sits in the hideout sidebar so the meter is visible
 * without opening a menu -- "watch it grow" is the point. `CryptoFarmPanel`
 * is the full screen with upgrades, the pack shop and the binder.
 *
 * Card art is always the character's real `RigPortrait`, never a raw
 * reference image -- see .agents/memory/survivor-616-art-assets.md.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Gem, Package, Recycle, Sparkles, Zap } from 'lucide-react';

import {
  cryptoFarmCapacityTier,
  cryptoFarmLiveState,
  cryptoFarmRateTier,
  CRYPTO_FARM_MAXED_LEVEL,
  useMeta,
} from '@/game/state/metaStore';
import {
  CRYPTO_FARM_CAPACITY_TIERS,
  CRYPTO_FARM_RATE_TIERS,
  CRYPTO_FARM_UNLOCK_COST,
  ESSENCE_PACKS,
  RARITY_LABEL,
  VARIANT_LABEL,
} from '@/game/data/cryptoFarm';
import { getCharacter } from '@/game/data/characters';
import type { CollectibleCardRarity, OwnedCollectibleCard } from '@/game/types';
import { RigPortrait } from './RigPortrait';
import { ScreenLayout } from './ScreenLayout';

const FLYOUT_MS = 650;

/** Smoothly chases `target`, exactly like the run HUD's live cred counter -- so a jump reads as a roll-up, not a snap. */
function useCountUp(target: number) {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const gap = targetRef.current - displayRef.current;
      displayRef.current = Math.abs(gap) < 0.05 ? targetRef.current : displayRef.current + gap * Math.min(1, dt * 6);
      setDisplay(displayRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return Math.round(display);
}

const RARITY_COLOR: Record<CollectibleCardRarity, string> = {
  standard: '#9ca3af',
  uncommon: '#34d399',
  rare: '#60a5fa',
  legendary: '#fbbf24',
};

function CardThumb({ card, size = 64 }: { card: OwnedCollectibleCard; size?: number }) {
  const character = getCharacter(card.characterId);
  return (
    <div
      className="relative grid shrink-0 place-items-center border-2 bg-black/50"
      style={{ width: size, height: size, borderColor: RARITY_COLOR[card.rarity] }}
      title={`${character.name} · ${card.rarityLabel} ${VARIANT_LABEL[card.variant]}`}
    >
      <RigPortrait rig={character.rig} palette={character.palette} anim="idle" size={size - 8} animated={false} />
      {card.variant !== 'standard' && (
        <span className="absolute -bottom-1 -right-1 border border-black/60 bg-black/80 px-1 py-0.5 font-mono text-[7px] font-bold uppercase tracking-wider" style={{ color: RARITY_COLOR[card.rarity] }}>
          {VARIANT_LABEL[card.variant]}
        </span>
      )}
    </div>
  );
}

/** Reads live progress by polling `Date.now()` on a short interval; the actual math is a pure function of the persisted timestamp, so no per-frame dispatch is needed for a smooth bar. */
function useCryptoFarmLive() {
  const { meta } = useMeta();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  return cryptoFarmLiveState(meta, now);
}

function FarmMeter({ compact = false }: { compact?: boolean }) {
  const live = useCryptoFarmLive();
  const pipSize = compact ? 10 : 16;
  return (
    <div className="space-y-2">
      <div className="h-2.5 overflow-hidden border border-cyan-500/30 bg-black/60">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-[width] duration-300"
          style={{ width: `${Math.min(100, live.charge * 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {Array.from({ length: live.maxBankedCharges }).map((_, i) => (
            <span
              key={i}
              className={`border ${i < live.bankedCharges ? 'border-cyan-300 bg-cyan-400/70 shadow-[0_0_8px_rgba(34,211,238,0.6)]' : 'border-white/15 bg-white/5'}`}
              style={{ width: pipSize, height: pipSize }}
            />
          ))}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-200/70">
          +{live.chargePerSec.toFixed(2)}/s{live.isFull ? ' · full' : ''}
        </span>
      </div>
    </div>
  );
}

interface RevealState {
  essence: number;
  cards: OwnedCollectibleCard[];
}

/** Diffs meta before/after a dispatch to show a brief reward reveal -- shared by collect and pack purchases so both get the same flourish. */
function useRewardReveal(essence: number, cardCount: number) {
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const prevEssence = useRef(essence);
  const prevCardCount = useRef(cardCount);
  const { meta } = useMeta();

  useEffect(() => {
    const essenceGained = essence - prevEssence.current;
    const newCards = meta.collectibleCards.slice(prevCardCount.current);
    prevEssence.current = essence;
    prevCardCount.current = cardCount;
    if (essenceGained > 0 || newCards.length > 0) {
      setReveal({ essence: Math.max(0, essenceGained), cards: newCards });
      const timer = window.setTimeout(() => setReveal(null), 3400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essence, cardCount]);

  return reveal;
}

function RewardBanner({ reveal }: { reveal: RevealState | null }) {
  return (
    <AnimatePresence>
      {reveal && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex flex-wrap items-center gap-3 border border-emerald-400/40 bg-emerald-950/30 px-4 py-3"
          data-testid="banner-crypto-farm-reveal"
        >
          {reveal.essence > 0 && (
            <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-emerald-300">
              <Gem className="h-4 w-4" /> +{reveal.essence} Digital Essence
            </span>
          )}
          {reveal.cards.map((card) => {
            const character = getCharacter(card.characterId);
            return (
              <span key={card.instanceId} className="flex items-center gap-2 border border-amber-400/40 bg-amber-950/30 px-2 py-1">
                <CardThumb card={card} size={32} />
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: RARITY_COLOR[card.rarity] }}>
                  {character.name} · {card.rarityLabel}
                </span>
              </span>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface CryptoFarmHubWidgetProps {
  onOpen: () => void;
}

/** Compact, always-visible sidebar card. Owns its own Collect button and flyout so the meter is watchable without leaving the hub. */
export function CryptoFarmHubWidget({ onOpen }: CryptoFarmHubWidgetProps) {
  const { meta, collectCryptoFarm } = useMeta();
  const live = useCryptoFarmLive();
  const [flying, setFlying] = useState(false);
  const displayEssence = useCountUp(meta.digitalEssence);
  const reveal = useRewardReveal(meta.digitalEssence, meta.collectibleCards.length);

  if (!meta.cryptoFarmUnlocked) return null;

  const handleCollect = () => {
    if (live.bankedCharges <= 0) return;
    setFlying(true);
    collectCryptoFarm();
    window.setTimeout(() => setFlying(false), FLYOUT_MS);
  };

  return (
    <div className="mt-3 w-full border border-cyan-900/40 bg-cyan-950/20 p-4" data-testid="section-crypto-farm-widget">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-cyan-300">
          <Cpu className="h-4 w-4" /> Crypto Farm
        </span>
        <button type="button" onClick={onOpen} className="font-mono text-[10px] uppercase tracking-widest text-cyan-200/60 hover:text-cyan-200" data-testid="button-crypto-farm-manage">
          Manage →
        </button>
      </div>
      <div className="relative">
        <FarmMeter compact />
        <AnimatePresence>
          {flying && (
            <motion.div
              initial={{ left: '4%', top: '0%', opacity: 1, scale: 1 }}
              animate={{ left: '92%', top: '-60%', opacity: 0, scale: 0.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: FLYOUT_MS / 1000, ease: 'easeIn' }}
              className="pointer-events-none absolute h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_12px_4px_rgba(34,211,238,0.7)]"
            />
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-emerald-300" data-testid="text-digital-essence-balance">
          <Gem className="h-3.5 w-3.5" /> {displayEssence.toLocaleString()}
        </span>
        <button
          type="button"
          onClick={handleCollect}
          disabled={live.bankedCharges <= 0}
          className="border border-cyan-400/60 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-cyan-400 hover:text-black"
          data-testid="button-collect-crypto-farm"
        >
          Collect
        </button>
      </div>
      <div className="mt-2">
        <RewardBanner reveal={reveal} />
      </div>
    </div>
  );
}

export interface CryptoFarmPanelProps {
  onBack: () => void;
}

export function CryptoFarmPanel({ onBack }: CryptoFarmPanelProps) {
  const { meta, unlockCryptoFarm, collectCryptoFarm, buyCryptoFarmCapacity, buyCryptoFarmRate, buyEssencePack, recycleCard } = useMeta();
  const live = useCryptoFarmLive();
  const [flying, setFlying] = useState(false);
  const displayEssence = useCountUp(meta.digitalEssence);
  const reveal = useRewardReveal(meta.digitalEssence, meta.collectibleCards.length);
  const [binderFilter, setBinderFilter] = useState<'all' | CollectibleCardRarity>('all');

  const nextCapacity = CRYPTO_FARM_CAPACITY_TIERS.find((tier) => tier.level === meta.cryptoFarmCapacityLevel + 1);
  const nextRate = CRYPTO_FARM_RATE_TIERS.find((tier) => tier.level === meta.cryptoFarmRateLevel + 1);
  const currentCapacity = cryptoFarmCapacityTier(meta.cryptoFarmCapacityLevel);
  const currentRate = cryptoFarmRateTier(meta.cryptoFarmRateLevel);

  const handleCollect = () => {
    if (live.bankedCharges <= 0) return;
    setFlying(true);
    collectCryptoFarm();
    window.setTimeout(() => setFlying(false), FLYOUT_MS);
  };

  const visibleCards = binderFilter === 'all' ? meta.collectibleCards : meta.collectibleCards.filter((c) => c.rarity === binderFilter);
  const characterCountOwned = new Set(meta.collectibleCards.map((c) => c.characterId)).size;

  return (
    <ScreenLayout title="Crypto Farm" subtitle="Sanctum basement rig" onBack={onBack}>
      <div className="mx-auto max-w-5xl space-y-8">
        {!meta.cryptoFarmUnlocked ? (
          <section className="border border-cyan-500/30 bg-card p-6 text-center" data-testid="section-crypto-farm-unlock">
            <Cpu className="mx-auto h-10 w-10 text-cyan-300" />
            <h2 className="mt-3 text-2xl font-black uppercase text-white">Install the rig</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              A scavenged mining tower that slow-drips Digital Essence, a crafting currency, whether or not you're
              online. It fills, banks a charge, and waits for you to collect.
            </p>
            <button
              type="button"
              onClick={unlockCryptoFarm}
              disabled={meta.cred < CRYPTO_FARM_UNLOCK_COST}
              className="mt-5 border border-cyan-400/60 bg-cyan-400/10 px-6 py-3 font-black uppercase tracking-widest text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-cyan-400 hover:text-black"
              data-testid="button-unlock-crypto-farm"
            >
              Install · {CRYPTO_FARM_UNLOCK_COST} cred
            </button>
          </section>
        ) : (
          <>
            <section className="border border-cyan-500/30 bg-card p-5 md:p-7" data-testid="section-crypto-farm-meter">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
                    <Cpu className="h-4 w-4" /> Mining rig
                  </p>
                  <h2 className="mt-1 text-2xl font-black uppercase text-white">
                    {live.isFull ? 'Tank is full — collect to keep it running' : 'Charging'}
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 font-mono text-lg font-bold text-emerald-300" data-testid="text-digital-essence-balance">
                    <Gem className="h-4 w-4" /> {displayEssence.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={handleCollect}
                    disabled={live.bankedCharges <= 0}
                    className="border border-cyan-400/60 bg-cyan-400/10 px-5 py-3 font-black uppercase tracking-widest text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-cyan-400 hover:text-black"
                    data-testid="button-collect-crypto-farm"
                  >
                    Collect {live.bankedCharges > 0 ? `(${live.bankedCharges})` : ''}
                  </button>
                </div>
              </div>
              <div className="relative mt-5">
                <FarmMeter />
                <AnimatePresence>
                  {flying && (
                    <motion.div
                      initial={{ left: '4%', top: '0%', opacity: 1, scale: 1.4 }}
                      animate={{ left: '95%', top: '-140%', opacity: 0, scale: 0.4 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: FLYOUT_MS / 1000, ease: 'easeIn' }}
                      className="pointer-events-none absolute h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_16px_6px_rgba(34,211,238,0.7)]"
                    />
                  )}
                </AnimatePresence>
              </div>
              <div className="mt-4">
                <RewardBanner reveal={reveal} />
              </div>
              {live.isMaxCapacity && (
                <p className="mt-4 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-300">
                  <Sparkles className="h-3 w-3" /> Maxed rig: collected charges have a chance to also drop a free essence pack.
                </p>
              )}
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="border border-border bg-card p-5" data-testid="section-capacity-upgrades">
                <div className="mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-cyan-300" />
                  <h3 className="font-black uppercase tracking-wide text-white">Tank capacity</h3>
                </div>
                <p className="text-xs text-muted-foreground">Currently banks up to {currentCapacity.maxBankedCharges} charge{currentCapacity.maxBankedCharges === 1 ? '' : 's'} before it has to be emptied.</p>
                {nextCapacity ? (
                  <button
                    type="button"
                    onClick={buyCryptoFarmCapacity}
                    disabled={meta.cred < nextCapacity.cost}
                    className="mt-4 flex w-full items-center justify-between border border-border px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-35 hover:border-cyan-400"
                    data-testid="button-buy-crypto-farm-capacity"
                  >
                    <span>Tier {nextCapacity.level} · holds {nextCapacity.maxBankedCharges}</span>
                    <span className="text-cyan-300">{nextCapacity.cost} cred</span>
                  </button>
                ) : (
                  <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-amber-300">Maxed</p>
                )}
              </div>

              <div className="border border-border bg-card p-5" data-testid="section-rate-upgrades">
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-300" />
                  <h3 className="font-black uppercase tracking-wide text-white">Overclock rate</h3>
                </div>
                <p className="text-xs text-muted-foreground">Currently fills at {currentRate.chargePerSec.toFixed(2)}/sec — keeps running while you're away.</p>
                {nextRate ? (
                  <button
                    type="button"
                    onClick={buyCryptoFarmRate}
                    disabled={meta.cred < nextRate.cost}
                    className="mt-4 flex w-full items-center justify-between border border-border px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-35 hover:border-cyan-400"
                    data-testid="button-buy-crypto-farm-rate"
                  >
                    <span>Tier {nextRate.level} · {nextRate.chargePerSec.toFixed(2)}/sec</span>
                    <span className="text-cyan-300">{nextRate.cost} cred</span>
                  </button>
                ) : (
                  <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-amber-300">Maxed</p>
                )}
              </div>
            </section>

            <section data-testid="section-essence-packs">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                <h3 className="font-black uppercase tracking-wide text-white">Essence packs</h3>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{meta.essencePacksOpened} opened</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ESSENCE_PACKS.map((pack) => (
                  <div key={pack.id} className="border border-border bg-card p-4" data-testid={`card-essence-pack-${pack.id}`}>
                    <p className="font-black uppercase text-white">{pack.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{pack.description}</p>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-emerald-300">{pack.essenceMin}–{pack.essenceMax} essence</p>
                    {pack.guaranteeMinRarity && (
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: RARITY_COLOR[pack.guaranteeMinRarity] }}>
                        Guaranteed {RARITY_LABEL[pack.guaranteeMinRarity]}+
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => buyEssencePack(pack.id)}
                      disabled={meta.cred < pack.cost}
                      className="mt-3 w-full border border-cyan-400/50 px-3 py-2 text-xs font-bold uppercase tracking-widest text-cyan-200 disabled:cursor-not-allowed disabled:opacity-35 hover:bg-cyan-400 hover:text-black"
                      data-testid={`button-buy-essence-pack-${pack.id}`}
                    >
                      Buy · {pack.cost} cred
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section data-testid="section-card-binder">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Gem className="h-4 w-4 text-cyan-300" />
                  <h3 className="font-black uppercase tracking-wide text-white">Cast card binder</h3>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{meta.collectibleCards.length} cards · {characterCountOwned} cast members discovered</span>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(['all', 'standard', 'uncommon', 'rare', 'legendary'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setBinderFilter(filter)}
                    aria-pressed={binderFilter === filter}
                    className={`border px-3 py-1.5 font-mono text-[9px] uppercase ${binderFilter === filter ? 'border-cyan-300 bg-cyan-300/10 text-cyan-200' : 'border-border text-muted-foreground'}`}
                  >
                    {filter === 'all' ? 'All' : RARITY_LABEL[filter]}
                  </button>
                ))}
              </div>
              {visibleCards.length === 0 ? (
                <p className="border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No cards yet. Collect from the rig or crack an essence pack.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {visibleCards.map((card) => {
                    const character = getCharacter(card.characterId);
                    const dupeCount = meta.collectibleCards.filter((c) => c.characterId === card.characterId).length;
                    return (
                      <div key={card.instanceId} className="flex flex-col items-center gap-1.5 border border-border/70 bg-black/20 p-2 text-center" data-testid={`card-collectible-${card.instanceId}`}>
                        <CardThumb card={card} size={72} />
                        <p className="text-[10px] font-bold uppercase text-white">{character.name}</p>
                        <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: RARITY_COLOR[card.rarity] }}>{card.rarityLabel}</p>
                        <p className="font-mono text-[9px] text-emerald-300">{card.value} essence</p>
                        <button
                          type="button"
                          onClick={() => recycleCard(card.instanceId)}
                          disabled={dupeCount <= 1}
                          title={dupeCount <= 1 ? "Your last copy — protected from recycling" : 'Recycle for Digital Essence'}
                          className="mt-1 flex items-center gap-1 border border-border px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-muted-foreground disabled:cursor-not-allowed disabled:opacity-30 hover:border-cyan-400 hover:text-cyan-200"
                        >
                          <Recycle className="h-2.5 w-2.5" /> Recycle
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </ScreenLayout>
  );
}

export default CryptoFarmPanel;
