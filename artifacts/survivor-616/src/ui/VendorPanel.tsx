import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  BadgeDollarSign,
  Box,
  Check,
  Crosshair,
  Footprints,
  Gauge,
  HardHat,
  LockKeyhole,
  PackageCheck,
  Shield,
  Skull,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

import { VENDOR_CATALOG } from '@/game/data/vendor';
import { useMeta } from '@/game/state/metaStore';
import type { VendorItemCategory, VendorItemDef } from '@/game/types';
import { ScreenLayout } from './ScreenLayout';

export interface VendorPanelProps {
  onBack: () => void;
}

type CategoryConfig = {
  key: VendorItemCategory;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    key: 'stat',
    eyebrow: 'Permanent issue / 01',
    title: 'Street kit',
    description: 'Small advantages that stay with the crew when the lights go out.',
    icon: Shield,
  },
  {
    key: 'utility',
    eyebrow: 'Permanent issue / 02',
    title: 'Run leverage',
    description: 'Better starts and better take-home. Quiet investments, loud results.',
    icon: TrendingUp,
  },
  {
    key: 'challenge',
    eyebrow: 'Optional contracts / 03',
    title: 'Hard contracts',
    description: 'Make the streets meaner. The payout gets meaner in your favor.',
    icon: Target,
  },
];

const STAT_LABELS: Record<string, string> = {
  maxHp: 'max HP',
  speed: 'move speed',
  power: 'global damage',
  armor: 'contact resistance',
  magnet: 'pickup range',
};

const ITEM_ICONS: Record<string, LucideIcon> = {
  'reinforced-hoodie': HardHat,
  'running-shoes': Footprints,
  'hot-rounds': Crosshair,
  'plated-vest': Shield,
  'long-pocket': PackageCheck,
  'starting-edge': Gauge,
  'scavenger-cut': BadgeDollarSign,
  'contract-redline': Gauge,
  'contract-hardcase': Skull,
  'contract-no-shelter': LockKeyhole,
};

const categoryTint: Record<VendorItemCategory, string> = {
  stat: 'border-amber-500/30 bg-amber-500/[0.045]',
  utility: 'border-orange-500/30 bg-orange-500/[0.045]',
  challenge: 'border-red-500/30 bg-red-500/[0.045]',
};

const categoryText: Record<VendorItemCategory, string> = {
  stat: 'text-amber-300',
  utility: 'text-orange-300',
  challenge: 'text-red-300',
};

function ownedStacks(item: VendorItemDef, purchases: Record<string, number>): number {
  return Math.min(item.maxStacks, Math.max(0, Math.floor(purchases[item.id] ?? 0)));
}

function effectLabel(item: VendorItemDef): string {
  const effect = item.effects?.[0];
  if (!effect) {
    return item.category === 'challenge' ? 'Contract modifier' : 'Permanent field benefit';
  }

  if (effect.kind === 'stat') {
    const amount = effect.add ?? 0;
    const isPercent = effect.stat === 'power' || effect.stat === 'armor';
    const displayAmount = isPercent ? `${Math.round(amount * 100)}%` : `${amount}`;
    return `+${displayAmount} ${STAT_LABELS[effect.stat] ?? effect.stat} / stack`;
  }

  if (effect.utility === 'starting-weapon-level') {
    return `+${effect.amount} signature level / stack`;
  }

  return `+${Math.round(effect.amount * 100)}% final cred / stack`;
}

function ItemMark({ item }: { item: VendorItemDef }) {
  const Icon = ITEM_ICONS[item.id] ?? Box;
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center border border-amber-500/35 bg-amber-500/10 text-amber-300 shadow-[3px_3px_0_rgba(245,158,11,0.11)]">
      <Icon className="h-5 w-5" strokeWidth={1.7} />
    </div>
  );
}

function StackMeter({ owned, cap, category }: { owned: number; cap: number; category: VendorItemCategory }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${owned} of ${cap} stacks owned`}>
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: cap }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 w-3.5 sm:w-5 ${index < owned ? category === 'challenge' ? 'bg-red-400' : 'bg-amber-400' : 'bg-white/10'}`}
          />
        ))}
      </div>
      <span className="font-mono text-[10px] font-bold tracking-wider text-white/55">{owned}/{cap}</span>
    </div>
  );
}

function PurchaseButton({
  item,
  owned,
  cred,
  onPurchase,
}: {
  item: VendorItemDef;
  owned: number;
  cred: number;
  onPurchase: (id: string) => void;
}) {
  const isMaxed = owned >= item.maxStacks;
  const isShort = cred < item.cost;
  const disabled = isMaxed || isShort;
  const [isConfirming, setIsConfirming] = useState(false);

  const handlePurchase = () => {
    if (disabled) return;
    onPurchase(item.id);
    setIsConfirming(true);
    window.setTimeout(() => setIsConfirming(false), 900);
  };

  const buttonLabel = isMaxed
    ? 'Capacity reached'
    : isShort
      ? `Need ${item.cost - cred} more cred`
      : `Issue for ${item.cost} cred`;

  return (
    <div className="relative mt-5">
      <motion.button
        type="button"
        disabled={disabled}
        onClick={handlePurchase}
        whileTap={disabled ? undefined : { scale: 0.985 }}
        className={`group flex min-h-11 w-full items-center justify-between gap-3 border px-3 py-2.5 text-left transition-colors ${
          isMaxed
            ? 'cursor-not-allowed border-emerald-500/20 bg-emerald-500/[0.035] text-emerald-300/70'
            : isShort
              ? 'cursor-not-allowed border-white/10 bg-black/15 text-white/35'
              : 'border-amber-500/60 bg-amber-500/10 text-amber-100 hover:border-amber-300 hover:bg-amber-400 hover:text-[#17120b]'
        }`}
        data-testid={`button-buy-vendor-item-${item.id}`}
        aria-label={`${item.name}: ${buttonLabel}`}
        title={isMaxed ? `Maxed at ${item.maxStacks} stacks` : isShort ? `Insufficient funds: ${item.cost - cred} more cred needed` : `Purchase ${item.name}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {isMaxed ? <Check className="h-4 w-4 shrink-0" /> : <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
          <span className="truncate text-[10px] font-black uppercase tracking-[0.14em]">{buttonLabel}</span>
        </span>
        {!isMaxed && !isShort && <span className="font-mono text-[10px] font-bold text-amber-300/75">CONFIRM</span>}
      </motion.button>
      <AnimatePresence>
        {isConfirming && (
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="pointer-events-none absolute -top-5 right-0 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300"
          >
            Added to kit
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function VendorCard({
  item,
  cred,
  purchases,
  onPurchase,
  index,
}: {
  item: VendorItemDef;
  cred: number;
  purchases: Record<string, number>;
  onPurchase: (id: string) => void;
  index: number;
}) {
  const owned = ownedStacks(item, purchases);
  const isMaxed = owned >= item.maxStacks;
  const isShort = cred < item.cost;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.035 }}
      className={`group relative flex h-full flex-col border p-4 transition-colors hover:border-amber-500/55 ${categoryTint[item.category]}`}
      data-testid={`vendor-item-${item.id}`}
    >
      <div className="absolute right-0 top-0 h-5 w-5 border-l border-b border-amber-500/25" aria-hidden="true" />
      <div className="flex items-start gap-3">
        <ItemMark item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <h3 className="text-lg font-black leading-none text-white">{item.name}</h3>
            {isMaxed && <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-emerald-300/80">Maxed</span>}
          </div>
          <p className={`mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${categoryText[item.category]}`}>{effectLabel(item)}</p>
        </div>
      </div>

      <p className="mt-4 min-h-[3.5rem] text-sm leading-6 text-white/55">{item.description}</p>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Owned / cap</p>
          <StackMeter owned={owned} cap={item.maxStacks} category={item.category} />
        </div>
        <div className="text-right">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Unit price</p>
          <p className={`font-mono text-sm font-bold ${isShort && !isMaxed ? 'text-red-300' : 'text-amber-300'}`}>{item.cost} cred</p>
        </div>
      </div>

      <PurchaseButton item={item} owned={owned} cred={cred} onPurchase={onPurchase} />
    </motion.article>
  );
}

export function VendorPanel({ onBack }: VendorPanelProps) {
  const { meta, buyVendorItem } = useMeta();
  const totalOwned = VENDOR_CATALOG.reduce((total, item) => total + ownedStacks(item, meta.vendorPurchases), 0);
  const maxStacks = VENDOR_CATALOG.reduce((total, item) => total + item.maxStacks, 0);
  const maxedCount = VENDOR_CATALOG.filter((item) => ownedStacks(item, meta.vendorPurchases) >= item.maxStacks).length;

  return (
    <ScreenLayout
      title="Quartermaster"
      subtitle="The back room / Grand Rapids"
      onBack={onBack}
      className="bg-[#100e0b]"
      action={
        <div className="flex items-center gap-3 border border-amber-500/50 bg-amber-500/10 px-4 py-3 shadow-[4px_4px_0_rgba(245,158,11,0.12)]" data-testid="vendor-cred-balance">
          <BadgeDollarSign className="h-5 w-5 text-amber-300" />
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-amber-200/60">On hand</p>
            <p className="font-mono text-xl font-bold leading-none text-amber-200">{meta.cred.toLocaleString()} <span className="text-xs text-amber-300/60">cred</span></p>
          </div>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-7">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden border border-amber-500/25 bg-[#18130d] p-5 sm:p-6"
          data-testid="section-vendor-ledger"
        >
          <div className="pointer-events-none absolute -right-8 -top-14 font-display text-[11rem] font-black leading-none text-amber-300/[0.035]" aria-hidden="true">616</div>
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-amber-300">
                <Sparkles className="h-4 w-4" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em]">No middleman. No markup story.</span>
              </div>
              <h2 className="max-w-xl text-3xl font-black leading-[0.95] text-white sm:text-4xl">Gear that remembers who paid for it.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
                The quartermaster trades in cred and favors. Every purchase is permanent, every stack is visible, and the house never rotates stock.
              </p>
            </div>
            <div className="grid grid-cols-3 border-t border-amber-500/20 pt-4 sm:min-w-[22rem] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
              <div className="pr-3">
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/35">Stacks in kit</p>
                <p className="mt-1 font-mono text-xl font-bold text-white">{totalOwned}<span className="text-sm text-white/35">/{maxStacks}</span></p>
              </div>
              <div className="border-l border-white/10 px-3">
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/35">Catalog</p>
                <p className="mt-1 font-mono text-xl font-bold text-white">{VENDOR_CATALOG.length}<span className="text-sm text-white/35"> lines</span></p>
              </div>
              <div className="border-l border-white/10 pl-3">
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/35">Capped out</p>
                <p className="mt-1 font-mono text-xl font-bold text-emerald-300">{maxedCount}<span className="text-sm text-white/35">/{VENDOR_CATALOG.length}</span></p>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="space-y-10">
          {CATEGORY_CONFIG.map((category) => {
            const items = VENDOR_CATALOG.filter((item) => item.category === category.key);
            const CategoryIcon = category.icon;
            return (
              <section key={category.key} data-testid={`section-vendor-${category.key}`}>
                <div className="mb-4 flex flex-col gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-start gap-3">
                    <CategoryIcon className={`mt-0.5 h-5 w-5 ${categoryText[category.key]}`} strokeWidth={1.7} />
                    <div>
                      <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.25em] ${categoryText[category.key]}`}>{category.eyebrow}</p>
                      <h2 className="mt-1 text-2xl font-black text-white">{category.title}</h2>
                    </div>
                  </div>
                  <p className="max-w-md text-xs leading-5 text-white/40 sm:text-right">{category.description}</p>
                </div>
                <div className={`grid gap-3 ${category.key === 'stat' ? 'sm:grid-cols-2 xl:grid-cols-3' : category.key === 'utility' ? 'md:grid-cols-2' : 'lg:grid-cols-3'}`}>
                  {items.map((item, index) => (
                    <VendorCard key={item.id} item={item} cred={meta.cred} purchases={meta.vendorPurchases} onPurchase={buyVendorItem} index={index} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="flex items-start gap-3 border-l-2 border-amber-500/45 bg-amber-500/[0.045] px-4 py-3 text-xs leading-5 text-white/45">
          <Box className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/75" />
          <p><span className="font-bold uppercase tracking-widest text-amber-200/80">Quartermaster note:</span> Contracts stay active once bought. Cred comes back from runs, not refunds.</p>
        </div>
      </div>
    </ScreenLayout>
  );
}

export default VendorPanel;