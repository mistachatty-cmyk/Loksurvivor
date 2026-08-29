import { Fragment, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  Box,
  Check,
  Crosshair,
  EyeOff,
  FlipVertical2,
  Footprints,
  Gauge,
  Gem,
  Ghost,
  HardHat,
  Hand,
  KeyRound,
  Lock,
  LockKeyhole,
  Maximize2,
  PackageCheck,
  Palette,
  Radar,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

import { VENDOR_CATALOG, VENDOR_CATALOG_BY_ID } from '@/game/data/vendor';
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
  {
    key: 'relic',
    eyebrow: 'Rare finds / 04',
    title: "Locksmith's corner",
    description: 'Paid for in skeleton keys — notably rare, found by breaking things out in the world.',
    icon: KeyRound,
  },
  {
    key: 'ability',
    eyebrow: 'Permanent issue / 05',
    title: 'Field ops',
    description: 'Gear that changes how a run plays, not just its numbers. Some of it chains — buy the first rung to unlock the next.',
    icon: Radar,
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
  'kit-strap': PackageCheck,
  'salvager-instinct': BadgeDollarSign,
  'loosened-padlock': KeyRound,
  'masters-cut': Gauge,
  'minimap-street-ears': Radar,
  'minimap-loot-sense': Gem,
  'minimap-hazard-sense': AlertTriangle,
  'grabby-hands': Hand,
  'colossus-frame': Maximize2,
  'ghost-cloak': Ghost,
  'ghost-cloak-duration': Timer,
  'ghost-cloak-rate': Gauge,
  'ghost-cloak-full': EyeOff,
  'invert-world': FlipVertical2,
  'invert-palette': Palette,
};

/** Short, hand-written labels for "ability" items whose real effect can't be summarized by a single stat/utility delta. */
const ABILITY_EFFECT_LABELS: Record<string, string> = {
  'minimap-street-ears': 'Minimap tier 1 — enemy blips',
  'minimap-loot-sense': 'Minimap tier 2 — loot blips',
  'minimap-hazard-sense': 'Minimap tier 3 — hazard radii',
  'grabby-hands': '+18 grab/tap reach per stack',
  'colossus-frame': '2x size · +25% damage',
  'ghost-cloak': 'Auto-cloak every 14s for 2.5s',
  'ghost-cloak-duration': '+1.2s cloak uptime per stack',
  'ghost-cloak-rate': '-3s cloak cooldown per stack',
  'ghost-cloak-full': 'Full invisibility · +5% stealth dmg',
  'invert-world': 'Unlocks a Settings toggle',
  'invert-palette': 'Unlocks a Settings toggle',
};

function ownedStacks(item: VendorItemDef, purchases: Record<string, number>): number {
  return Math.min(item.maxStacks, Math.max(0, Math.floor(purchases[item.id] ?? 0)));
}

/** True when a chained "ability" item's prerequisite hasn't been bought yet. */
function isLocked(item: VendorItemDef, purchases: Record<string, number>): boolean {
  if (!item.requires) return false;
  const required = VENDOR_CATALOG_BY_ID[item.requires];
  return Boolean(required) && ownedStacks(required, purchases) <= 0;
}

function currencyInfo(item: VendorItemDef, meta: { cred: number; skeletonKeys: number }): { balance: number; label: string } {
  return item.currency === 'skeletonKeys' ? { balance: meta.skeletonKeys, label: 'keys' } : { balance: meta.cred, label: 'cred' };
}

function effectLabel(item: VendorItemDef): string {
  if (ABILITY_EFFECT_LABELS[item.id]) return ABILITY_EFFECT_LABELS[item.id]!;
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

function ItemIcon({ item, size = 'md' }: { item: VendorItemDef; size?: 'md' | 'lg' }) {
  const Icon = ITEM_ICONS[item.id] ?? Box;
  const tone = item.category === 'challenge' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-primary/40 bg-primary/10 text-primary';
  const dims = size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  return (
    <div className={`terminal-frame grid ${dims} shrink-0 place-items-center border ${tone}`}>
      <Icon className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} strokeWidth={1.7} />
    </div>
  );
}

function PipMeter({ owned, cap, category }: { owned: number; cap: number; category: VendorItemCategory }) {
  const fill = category === 'challenge' ? 'bg-destructive' : 'bg-primary';
  return (
    <div className="flex items-center gap-2" aria-label={`${owned} of ${cap} stacks owned`}>
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {Array.from({ length: cap }).map((_, index) => (
          <span key={index} className={`h-1.5 flex-1 ${index < owned ? fill : 'bg-white/10'}`} />
        ))}
      </div>
      <span className="shrink-0 font-mono text-[10px] font-bold tracking-wider text-muted-foreground">
        {owned}/{cap}
      </span>
    </div>
  );
}

function ItemTile({
  item,
  purchases,
  meta,
  selected,
  onSelect,
}: {
  item: VendorItemDef;
  purchases: Record<string, number>;
  meta: { cred: number; skeletonKeys: number };
  selected: boolean;
  onSelect: () => void;
}) {
  const owned = ownedStacks(item, purchases);
  const maxed = owned >= item.maxStacks;
  const locked = isLocked(item, purchases);
  const { label: currencyLabel } = currencyInfo(item, meta);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`terminal-frame flex flex-col gap-2 border p-3 text-left transition-colors ${
        selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
      } ${locked ? 'opacity-50' : ''}`}
      data-testid={`button-vendor-tile-${item.id}`}
    >
      <ItemIcon item={item} />
      <span className="flex items-center gap-1 text-[11px] font-black uppercase leading-tight tracking-wide text-white">
        {locked ? <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
        {item.name}
      </span>
      <PipMeter owned={owned} cap={item.maxStacks} category={item.category} />
      <span className={`font-mono text-[10px] font-bold ${maxed ? 'text-emerald-300' : 'text-muted-foreground'}`}>
        {maxed ? 'Maxed' : locked ? 'Locked' : `${item.cost} ${currencyLabel}`}
      </span>
    </button>
  );
}

function ItemDetail({
  item,
  meta,
  purchases,
  onBuy,
  onRefund,
  inline = false,
}: {
  item: VendorItemDef;
  meta: { cred: number; skeletonKeys: number };
  purchases: Record<string, number>;
  onBuy: (id: string) => void;
  onRefund: (id: string) => void;
  inline?: boolean;
}) {
  const owned = ownedStacks(item, purchases);
  const maxed = owned >= item.maxStacks;
  const locked = isLocked(item, purchases);
  const { balance, label: currencyLabel } = currencyInfo(item, meta);
  const short = balance < item.cost;
  const requiredName = item.requires ? VENDOR_CATALOG_BY_ID[item.requires]?.name : undefined;
  const buyDisabled = maxed || short || locked;

  return (
    <div
      className={`terminal-frame border border-border bg-card p-4 ${inline ? 'flex flex-wrap items-center gap-4' : 'flex flex-col gap-3'}`}
      data-testid={`section-vendor-detail-${item.id}`}
    >
      <ItemIcon item={item} size="lg" />
      <div className={inline ? 'min-w-[12rem] flex-1' : ''}>
        <h3 className="terminal-glow flex items-center gap-2 text-base font-black uppercase text-white">
          {locked ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          {item.name}
        </h3>
        <p
          className={`mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${
            item.category === 'challenge' ? 'text-destructive' : 'text-primary'
          }`}
        >
          {effectLabel(item)}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
        {locked && requiredName ? (
          <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-300">
            Requires {requiredName} first
          </p>
        ) : null}
        <div className="mt-3 max-w-xs">
          <PipMeter owned={owned} cap={item.maxStacks} category={item.category} />
        </div>
      </div>
      <div className={`flex gap-2 ${inline ? 'shrink-0' : 'flex-col'}`}>
        <button
          type="button"
          disabled={buyDisabled}
          onClick={() => onBuy(item.id)}
          className={`flex items-center justify-between gap-2 whitespace-nowrap border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
            buyDisabled
              ? 'cursor-not-allowed border-border text-muted-foreground/50'
              : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
          }`}
          data-testid={`button-buy-vendor-item-${item.id}`}
        >
          {maxed ? <Check className="h-4 w-4 shrink-0" /> : locked ? <Lock className="h-4 w-4 shrink-0" /> : <ArrowUpRight className="h-4 w-4 shrink-0" />}
          <span>
            {maxed
              ? 'Capacity reached'
              : locked
                ? `Requires ${requiredName ?? 'prior tier'}`
                : short
                  ? `Need ${item.cost - balance} more ${currencyLabel}`
                  : `Buy for ${item.cost} ${currencyLabel}`}
          </span>
          {!buyDisabled && <kbd className="border border-current px-1 text-[9px]">E</kbd>}
        </button>
        <button
          type="button"
          disabled={owned <= 0}
          onClick={() => onRefund(item.id)}
          className={`flex items-center justify-center gap-2 whitespace-nowrap border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
            owned <= 0
              ? 'cursor-not-allowed border-border text-muted-foreground/50'
              : 'border-border text-muted-foreground hover:border-destructive hover:text-destructive'
          }`}
          data-testid={`button-refund-vendor-item-${item.id}`}
        >
          <RotateCcw className="h-4 w-4 shrink-0" />
          <span>Refund</span>
          <kbd className="border border-current px-1 text-[9px]">R</kbd>
        </button>
      </div>
    </div>
  );
}

export function VendorPanel({ onBack }: VendorPanelProps) {
  const { meta, buyVendorItem, refundVendorItem, refundAllVendorItems } = useMeta();
  const [activeCategory, setActiveCategory] = useState<VendorItemCategory>('stat');
  const [selectedId, setSelectedId] = useState<string>(
    VENDOR_CATALOG.find((item) => item.category === 'stat')?.id ?? VENDOR_CATALOG[0].id,
  );

  const itemsInCategory = VENDOR_CATALOG.filter((item) => item.category === activeCategory);
  const selectedItem = itemsInCategory.find((item) => item.id === selectedId) ?? itemsInCategory[0];

  const totalOwned = VENDOR_CATALOG.reduce((total, item) => total + ownedStacks(item, meta.vendorPurchases), 0);
  const maxStacks = VENDOR_CATALOG.reduce((total, item) => total + item.maxStacks, 0);
  const maxedCount = VENDOR_CATALOG.filter((item) => ownedStacks(item, meta.vendorPurchases) >= item.maxStacks).length;

  const layout = meta.uiPanelLayout;

  function selectCategory(category: VendorItemCategory) {
    setActiveCategory(category);
    const firstItem = VENDOR_CATALOG.find((item) => item.category === category);
    if (firstItem) setSelectedId(firstItem.id);
  }

  return (
    <ScreenLayout
      title="Quartermaster"
      subtitle="The back room / Grand Rapids"
      onBack={onBack}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refundAllVendorItems}
            disabled={totalOwned === 0}
            className={`border px-3 py-3 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
              totalOwned === 0
                ? 'cursor-not-allowed border-border text-muted-foreground/40'
                : 'border-border text-muted-foreground hover:border-destructive hover:text-destructive'
            }`}
            data-testid="button-refund-all-vendor-items"
          >
            Refund all
          </button>
          <div className="terminal-frame flex items-center gap-3 border border-primary/50 bg-primary/10 px-4 py-3" data-testid="vendor-cred-balance">
            <BadgeDollarSign className="h-5 w-5 text-primary" />
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-primary/70">On hand</p>
              <p className="terminal-glow font-mono text-xl font-bold leading-none text-primary">
                {meta.cred.toLocaleString()} <span className="text-xs text-primary/60">cred</span>
              </p>
            </div>
          </div>
          <div className="terminal-frame flex items-center gap-3 border border-sky-500/50 bg-sky-500/10 px-4 py-3" data-testid="vendor-skeleton-keys-balance">
            <KeyRound className="h-5 w-5 text-sky-300" />
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-sky-200/70">Keys</p>
              <p className="font-mono text-xl font-bold leading-none text-sky-200">{meta.skeletonKeys.toLocaleString()}</p>
            </div>
          </div>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="terminal-frame terminal-scanlines relative overflow-hidden border border-border bg-card p-5 sm:p-6" data-testid="section-vendor-ledger">
          <div className="pointer-events-none absolute -right-8 -top-14 font-display text-[11rem] font-black leading-none text-primary/[0.05]" aria-hidden="true">
            616
          </div>
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em]">No middleman. No markup story.</span>
              </div>
              <h2 className="max-w-xl text-3xl font-black leading-[0.95] text-white sm:text-4xl">Gear that remembers who paid for it.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Pick a category, pick an upgrade, and watch the pips fill in. Refund a stack any time the build changes.
              </p>
            </div>
            <div className="grid grid-cols-3 border-t border-border pt-4 sm:min-w-[22rem] sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
              <div className="pr-3">
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Stacks in kit</p>
                <p className="mt-1 font-mono text-xl font-bold text-white">
                  {totalOwned}
                  <span className="text-sm text-muted-foreground">/{maxStacks}</span>
                </p>
              </div>
              <div className="border-l border-border px-3">
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Catalog</p>
                <p className="mt-1 font-mono text-xl font-bold text-white">
                  {VENDOR_CATALOG.length}
                  <span className="text-sm text-muted-foreground"> lines</span>
                </p>
              </div>
              <div className="border-l border-border pl-3">
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Capped out</p>
                <p className="mt-1 font-mono text-xl font-bold text-emerald-300">
                  {maxedCount}
                  <span className="text-sm text-muted-foreground">/{VENDOR_CATALOG.length}</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2" data-testid="section-vendor-categories">
          {CATEGORY_CONFIG.map((category) => {
            const CategoryIcon = category.icon;
            const active = category.key === activeCategory;
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => selectCategory(category.key)}
                aria-pressed={active}
                className={`flex items-center gap-2 border px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-white'
                }`}
                data-testid={`button-vendor-category-${category.key}`}
              >
                <CategoryIcon className="h-4 w-4" strokeWidth={1.7} />
                {category.title}
              </button>
            );
          })}
        </div>

        <section data-testid={`section-vendor-${activeCategory}`}>
          {selectedItem &&
            (layout === 'rail' ? (
              <div className="grid gap-4 lg:grid-cols-[16rem_1fr]" data-testid="section-vendor-grid">
                <ItemDetail item={selectedItem} meta={meta} purchases={meta.vendorPurchases} onBuy={buyVendorItem} onRefund={refundVendorItem} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {itemsInCategory.map((item) => (
                    <ItemTile
                      key={item.id}
                      item={item}
                      purchases={meta.vendorPurchases}
                      meta={meta}
                      selected={item.id === selectedItem.id}
                      onSelect={() => setSelectedId(item.id)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [grid-auto-flow:dense]" data-testid="section-vendor-grid">
                {itemsInCategory.map((item) => (
                  <Fragment key={item.id}>
                    <ItemTile
                      item={item}
                      purchases={meta.vendorPurchases}
                      meta={meta}
                      selected={item.id === selectedItem.id}
                      onSelect={() => setSelectedId(item.id)}
                    />
                    {item.id === selectedItem.id && (
                      <div className="col-span-full">
                        <ItemDetail
                          item={selectedItem}
                          meta={meta}
                          purchases={meta.vendorPurchases}
                          onBuy={buyVendorItem}
                          onRefund={refundVendorItem}
                          inline
                        />
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            ))}
        </section>

        <div className="flex items-start gap-3 border-l-2 border-primary/45 bg-primary/[0.05] px-4 py-3 text-xs leading-5 text-muted-foreground">
          <Box className="mt-0.5 h-4 w-4 shrink-0 text-primary/75" />
          <p>
            <span className="font-bold uppercase tracking-widest text-primary/80">Quartermaster note:</span> Contracts stay active once
            bought &mdash; refund the base kit any time your build changes.
          </p>
        </div>
      </div>
    </ScreenLayout>
  );
}

export default VendorPanel;
