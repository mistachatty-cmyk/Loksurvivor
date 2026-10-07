import { useState } from 'react';
import {
  BarChart3,
  Check,
  CreditCard,
  Layers3,
  LockKeyhole,
  Package,
  PackageOpen,
  Sparkles,
  Swords,
  RefreshCw,
  Flame,
  Info,
  Zap,
  Percent,
  X,
  Boxes,
  Trophy,
  Dices,
  Shield,
  Activity,
} from 'lucide-react';
import { useSfxPlayer } from '@/game/audio/useSfxPlayer';
import { CARD_MANIFESTS, CARD_MANIFESTS_BY_ID, isCardOwned } from '@/game/data/cards';
import {
  CARD_SHOP_PACKS,
  CARD_SHOP_PACKS_BY_ID,
  PASSIVE_CARDS,
  activeCardEffects,
  passiveDeckSlots,
  rollCardPack,
  type CardPull,
} from '@/game/data/passiveCards';
import { getActiveSoundPackStyle } from '@/game/data/soundPacks';
import { BATTLE_DECK_SLOTS, cardThrowOutcome, describeOwnedCard } from '@/game/data/travelEncounters';
import { BASE_CARD_CREDITS_PER_LOOT_BOX, useMeta } from '@/game/state/metaStore';
import type { CardPackId } from '@/game/types';
import type { LokAssetManifest } from '@/game/lok/types';
import { LockDeckCollection, CardDetail } from './LockDeckCollection';
import { PackOpeningReveal } from './PackOpeningReveal';
import { ScreenLayout } from './ScreenLayout';
import { LokDeckCardView, CardStyleToggle, type CardViewMode } from './LokDeckCardView';
import { CardMatrixChartModal } from './CardMatrixChartModal';
import { getCollectorMastery } from '@/game/data/collectorMastery';
import {
  calculateDeckSynergies,
  getCardVariableProfile,
  ELEMENT_METADATA,
  DATA_TYPE_METADATA,
  FIGHTING_STYLE_METADATA,
} from '@/game/data/cardVariables';

const RARITY_COLOR: Record<string, string> = {
  common: 'text-slate-200',
  uncommon: 'text-emerald-200',
  rare: 'text-sky-200',
  epic: 'text-purple-200',
  legendary: 'text-pink-200',
  mythic: 'text-amber-200',
  secret: 'text-rose-200',
};

const RECYCLE_VALUE: Record<string, number> = {
  common: 2,
  uncommon: 3,
  rare: 6,
  epic: 12,
  legendary: 24,
  mythic: 32,
  secret: 40,
};

type ShopTab = 'binder' | 'singles' | 'salvage' | 'passive' | 'battle';
const SHOP_TABS: { id: ShopTab; label: string; icon: typeof PackageOpen }[] = [
  { id: 'binder', label: 'Lock Deck Binder', icon: PackageOpen },
  { id: 'singles', label: 'Singles Showcase', icon: Sparkles },
  { id: 'salvage', label: 'Card Recycle Depot', icon: RefreshCw },
  { id: 'passive', label: 'Passive Lock Deck', icon: Layers3 },
  { id: 'battle', label: 'Battle Deck', icon: Swords },
];

export function CardShopPanel({ onBack }: { onBack: () => void }) {
  const {
    meta,
    buyCardPack,
    buySingleCard,
    recycleCard,
    recycleAllDuplicates,
    openStoredCardPack,
    setAutoOpenPacksEnabled,
    togglePassiveCard,
    toggleBattleDeckCard,
    lastCardPackReveal,
    clearCardPackReveal,
  } = useMeta();
  const sfx = useSfxPlayer(getActiveSoundPackStyle(meta.activeSoundPackId), meta.sfxEnabled);
  const [tab, setTab] = useState<ShopTab>('binder');
  const [showAll, setShowAll] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showOddsModal, setShowOddsModal] = useState(false);
  const [inspectCard, setInspectCard] = useState<LokAssetManifest | null>(null);
  const [singlesViewMode, setSinglesViewMode] = useState<CardViewMode>('classic');
  const [simulatorPackId, setSimulatorPackId] = useState<CardPackId>('quantum-vault');
  const [simulatedPulls, setSimulatedPulls] = useState<CardPull[]>([]);

  const owned = new Map(meta.cardCollection.map((record) => [record.cardId, record]));
  const slots = passiveDeckSlots(meta);
  const effects = activeCardEffects(meta);
  const collectorMastery = getCollectorMastery(meta);
  const battleDeckSynergies = calculateDeckSynergies(meta.battleDeckCardIds);
  const activeSynergies = battleDeckSynergies.filter((s) => s.active);

  // Calculate total duplicates available for recycling
  const duplicateRecords = meta.cardCollection.filter((r) => r.copies > 1);
  const totalDuplicateCopies = duplicateRecords.reduce((sum, r) => sum + (r.copies - 1), 0);
  const totalRecycleValue = duplicateRecords.reduce((sum, r) => {
    const card = CARD_MANIFESTS.find((c) => c.id === r.cardId);
    const val = RECYCLE_VALUE[card?.rarity || 'common'] || 2;
    return sum + (r.copies - 1) * val;
  }, 0);

  // Curated showcase singles available for direct purchase with Card Credits
  const FEATURED_SINGLES = [
    { slug: 'pet-apex-chimera', cost: 45, label: 'Apex Sovereign' },
    { slug: 'pet-cyber-leviathan', cost: 42, label: 'Tidal Drake' },
    { slug: 'pet-solar-seraph', cost: 38, label: 'Dawn Seraph' },
    { slug: 'pet-chrono-valkyrie', cost: 36, label: 'Tachyon Maiden' },
    { slug: 'pet-abyss-behemoth', cost: 40, label: 'Void Titan' },
    { slug: 'pet-quantum-kirin', cost: 35, label: 'Phase Kirin' },
    { slug: 'pet-photon-lynx', cost: 34, label: 'Photon Lynx' },
    { slug: 'pet-glitch-dragon', cost: 44, label: 'Null Dragon' },
  ];

  // Daily Flash Deal of the Day (35% OFF special)
  const FLASH_DEAL = {
    packId: 'quantum-vault' as CardPackId,
    originalCost: 48,
    discountCost: 31,
    name: 'Quantum Singularity Booster (Flash Special)',
    discount: '-35% OFF',
    description: 'High-energy anomaly pack containing 5 cards with elevated mythic & foil odds.',
  };

  const singlesSection = (
    <section className="mb-9 border border-white/15 bg-white/[.025] p-4" data-testid="section-singles-showcase">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-display text-xl font-black uppercase text-white">
            <Sparkles className="h-5 w-5 text-amber-300" />
            Collector's Singles Showcase
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/45">
            Black Market Berth · Acquire guaranteed holographic single cards directly with Card Credits
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CardStyleToggle value={singlesViewMode} onChange={setSinglesViewMode} />

          <div className="flex items-center gap-2 border border-amber-300/30 bg-black/40 px-3 py-1 font-mono text-xs text-amber-200">
            <span>BALANCE:</span>
            <strong className="text-white">{meta.cardCredits} CC</strong>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {FEATURED_SINGLES.map((single) => {
          const card = CARD_MANIFESTS.find((c) => c.slug === single.slug);
          if (!card) return null;
          const record = owned.get(card.id);
          const copiesOwned = record?.copies ?? 0;
          const canAfford = meta.cardCredits >= single.cost;

          return (
            <div key={single.slug} className="flex flex-col border border-white/10 bg-black/40 p-2.5">
              <span className="mb-1 text-center font-mono text-[7px] uppercase tracking-widest text-amber-300">
                {single.label}
              </span>
              <LokDeckCardView
                card={card}
                owned={copiesOwned > 0}
                copies={copiesOwned}
                variant="holo"
                size="compact"
                mode={singlesViewMode}
                onClick={() => {
                  setInspectCard(card);
                  sfx.play('uiNav');
                }}
              />
              <div className="mt-2 flex items-center justify-between text-[8px] font-mono text-white/50">
                <span>Owned: x{copiesOwned}</span>
                <span className="text-amber-200 font-bold">{single.cost} CC</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  buySingleCard(card.id, single.cost, 'holo');
                  sfx.play('purchase');
                }}
                disabled={!canAfford}
                className="mt-2 border border-amber-300/50 bg-amber-400/10 py-1.5 font-mono text-[9px] font-black uppercase text-amber-100 transition-all hover:bg-amber-400/25 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"
              >
                Buy · {single.cost} CC
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );

  const salvageSection = (
    <section className="mb-9 border border-white/15 bg-white/[.025] p-4" data-testid="section-card-salvage">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-display text-xl font-black uppercase text-white">
            <RefreshCw className="h-5 w-5 text-emerald-300" />
            Card Recycle & Disenchant Depot
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/45">
            Recycle duplicate card copies (copies beyond 1) to earn Card Credits for new packs and singles
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-200">
            <span>DUPLICATES: </span>
            <strong className="text-white">{totalDuplicateCopies} copies</strong>
            <span className="ml-2 text-amber-300">(+{totalRecycleValue} CC)</span>
          </div>

          <button
            type="button"
            onClick={() => {
              recycleAllDuplicates();
              sfx.play('purchase');
            }}
            disabled={totalDuplicateCopies === 0}
            className="border border-emerald-300/60 bg-emerald-400/20 px-3 py-1.5 font-mono text-[9px] font-black uppercase text-emerald-100 transition-all hover:bg-emerald-400/35 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"
          >
            Recycle All ({totalDuplicateCopies}) · +{totalRecycleValue} CC
          </button>
        </div>
      </div>

      <div className="mt-4">
        {duplicateRecords.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {duplicateRecords.map((record) => {
              const card = CARD_MANIFESTS.find((c) => c.id === record.cardId);
              if (!card) return null;
              const val = RECYCLE_VALUE[card.rarity] || 2;
              return (
                <div
                  key={record.cardId}
                  className="flex items-center justify-between border border-white/10 bg-black/40 p-2.5 font-mono text-[9px]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display font-black text-white uppercase text-xs">
                      {card.name}
                    </p>
                    <span className={`text-[8px] uppercase ${RARITY_COLOR[card.rarity]}`}>
                      {card.rarity} · x{record.copies} copies (1 kept)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      recycleCard(record.cardId, val);
                      sfx.play('uiClick');
                    }}
                    className="ml-3 shrink-0 border border-emerald-300/40 bg-emerald-400/10 px-2 py-1 font-black uppercase text-emerald-200 hover:bg-emerald-400/20"
                  >
                    Recycle 1 · +{val} CC
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center font-mono text-xs uppercase tracking-widest text-white/40">
            No duplicate card copies in storage. Open packs to collect duplicates for recycling!
          </div>
        )}
      </div>
    </section>
  );

  const passiveSection = (
    <section className="mb-9 border border-white/15 bg-white/[.025] p-4" data-testid="section-passive-lock-deck">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-display text-xl font-black uppercase text-white">
            <Layers3 className="h-5 w-5 text-fuchsia-200" />
            Passive Lock Deck
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/45">
            Equip {slots} cards · slot 4 at 8 Collector runs/6 catches · slot 5 at 25/20 · slot 6 at 40/45 · slot 7 at 60/65
          </p>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className={`grid h-8 w-8 place-items-center border text-xs ${
                i < slots ? 'border-fuchsia-300/50 text-fuchsia-200' : 'border-white/10 text-white/20'
              }`}
            >
              {i < slots ? i + 1 : <LockKeyhole className="h-3 w-3" />}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 font-mono text-[9px] uppercase text-white/50">
        {effects.lokPetDamageMult > 1 && (
          <span>Pet damage +{Math.round((effects.lokPetDamageMult - 1) * 100)}%</span>
        )}
        {effects.packDropBonus > 0 && (
          <span>Pack odds +{(effects.packDropBonus * 100).toFixed(2)}%</span>
        )}
        {effects.allElementLokPets && <span>All-element cycle</span>}
        {!meta.activePassiveCardIds.length && <span>No passive cards equipped yet.</span>}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {PASSIVE_CARDS.map((card) => {
          const record = owned.get(card.id);
          const active = meta.activePassiveCardIds.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                togglePassiveCard(card.id);
                sfx.play('uiClick');
              }}
              disabled={!record || (!active && meta.activePassiveCardIds.length >= slots)}
              className={`border p-3 text-left transition-all active:scale-[0.97] ${
                active ? 'border-fuchsia-300 bg-fuchsia-300/10' : record ? 'border-white/15' : 'border-white/[.07] opacity-45'
              }`}
            >
              <span className={`text-[9px] uppercase ${RARITY_COLOR[card.rarity]}`}>
                {card.type} · {card.rarity}
                {record ? ` · x${record.copies} · ${record.bestVariant}` : ''}
              </span>
              <span className="mt-1 flex justify-between font-display text-sm font-black uppercase text-white">
                {record ? card.name : 'Unknown Card'}
                {active && <Check className="h-4 w-4" />}
              </span>
              <span className="mt-1 block text-[10px] text-white/50">
                {record ? card.description : 'Open matching packs to break the seal.'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const battleSection = (
    <section className="mb-9 border border-white/15 bg-white/[.025] p-4" data-testid="section-battle-deck">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-display text-xl font-black uppercase text-white">
            <Swords className="h-5 w-5 text-fuchsia-200" />
            Battle Deck
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/45">
            Equip {BATTLE_DECK_SLOTS} cards to throw during travel encounters -- damage and effects vary by card
            {meta.handheldDigiScopeOwned
              ? ', and your Handheld DigiScope preserves every thrown card.'
              : ', and the Handheld DigiScope in the LokPet Shop can preserve every throw.'}
          </p>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: BATTLE_DECK_SLOTS }, (_, i) => (
            <span
              key={i}
              className={`grid h-8 w-8 place-items-center border text-xs ${
                i < meta.battleDeckCardIds.length ? 'border-fuchsia-300/50 text-fuchsia-200 font-bold bg-fuchsia-500/10' : 'border-white/10 text-white/20'
              }`}
            >
              {i + 1}
            </span>
          ))}
        </div>
      </div>

      {/* Tactical Deck Synergies Console */}
      <div className="mt-4 rounded border border-fuchsia-300/30 bg-black/45 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-fuchsia-300" />
            <span className="font-mono text-xs font-black uppercase tracking-wider text-white">
              Tactical Deck Synergies ({activeSynergies.length} Active)
            </span>
          </div>
          <span className="font-mono text-[8.5px] uppercase tracking-wider text-white/40">
            Combine complementary elements & roles to trigger combat resonance
          </span>
        </div>

        {activeSynergies.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {activeSynergies.map((syn) => (
              <div
                key={syn.id}
                className="flex items-center gap-1.5 rounded border border-fuchsia-300/40 bg-fuchsia-500/10 px-2.5 py-1"
                title={syn.description}
              >
                <Sparkles className="h-3 w-3 text-fuchsia-300 shrink-0" />
                <span className="font-mono text-[9px] font-black uppercase text-fuchsia-100">
                  {syn.title}
                </span>
                <span className="rounded bg-fuchsia-300/20 px-1 py-0.2 font-mono text-[7px] font-bold text-fuchsia-200">
                  {syn.badge}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[9.5px] italic text-white/40">
            No active synergies yet. Equip 3+ distinct elements, dual-resonance units, or paired fighting styles to activate team perks.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {meta.cardCollection
          .filter((record) => record.copies > 0)
          .map((record) => {
            const info = describeOwnedCard(record.cardId);
            if (!info) return null;
            const active = meta.battleDeckCardIds.includes(record.cardId);
            const outcome = cardThrowOutcome(record, 'enemy');
            const manifest = CARD_MANIFESTS_BY_ID[record.cardId];
            const profile = manifest ? getCardVariableProfile(manifest) : null;
            const elemMeta = profile ? ELEMENT_METADATA[profile.element] : null;
            const dataMeta = profile ? DATA_TYPE_METADATA[profile.dataType] : null;

            return (
              <button
                key={record.cardId}
                type="button"
                onClick={() => {
                  toggleBattleDeckCard(record.cardId);
                  sfx.play('uiClick');
                }}
                disabled={!active && meta.battleDeckCardIds.length >= BATTLE_DECK_SLOTS}
                className={`border p-3 text-left transition-all active:scale-[0.97] ${
                  active ? 'border-fuchsia-300 bg-fuchsia-300/10 shadow-lg shadow-fuchsia-500/10' : 'border-white/15 hover:border-white/35'
                }`}
              >
                <div className="flex items-center justify-between text-[8.5px] font-mono uppercase">
                  <span className={RARITY_COLOR[info.rarity] ?? 'text-slate-200'}>
                    {info.rarity} · x{record.copies} · {record.bestVariant}
                  </span>
                  <div className="flex items-center gap-1">
                    {dataMeta && (
                      <span
                        className="rounded px-1 py-0.2 font-black text-black text-[6.5px]"
                        style={{ backgroundColor: dataMeta.color }}
                      >
                        {dataMeta.badge}
                      </span>
                    )}
                    {elemMeta && (
                      <span
                        className="grid h-3.5 w-3.5 place-items-center rounded-full text-[7px] font-bold"
                        style={{ backgroundColor: elemMeta.color, color: '#000' }}
                        title={elemMeta.label}
                      >
                        {elemMeta.icon}
                      </span>
                    )}
                  </div>
                </div>

                <span className="mt-1 flex items-center justify-between font-display text-sm font-black uppercase text-white">
                  {info.name}
                  {active && <Check className="h-4 w-4 text-fuchsia-300" />}
                </span>

                <span className="mt-1 block text-[9.5px] text-white/50">
                  Throw · <strong className="text-amber-200">{outcome.damage} dmg</strong>
                  {outcome.heal > 0 ? ` · +${outcome.heal} hp` : ''}
                  {info.subjectType === 'lokpet' ? ' · +25% vs LokPets' : ''}
                </span>
              </button>
            );
          })}
        {meta.cardCollection.filter((record) => record.copies > 0).length === 0 && (
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            Open a pack to build your first Battle Deck.
          </p>
        )}
      </div>
    </section>
  );

  const binderSection = (
    <div data-testid="section-lock-deck-binder">
      <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <PackageOpen className="h-5 w-5 text-fuchsia-200" />
          <h2 className="font-black uppercase text-white">Lock Deck Binder</h2>
        </div>
        <span className="font-mono text-xs text-white/55">
          {CARD_MANIFESTS.filter((card) => isCardOwned(card, meta)).length}/{CARD_MANIFESTS.length} subjects ·{' '}
          {meta.cardCollection.reduce((sum, card) => sum + card.copies, 0)} copies
        </span>
      </div>
      <LockDeckCollection meta={meta} listView={meta.uiDensity === 'list'} sfx={sfx} />
    </div>
  );

  return (
    <ScreenLayout title="Lock Pack Counter" subtitle="The Neon Sleeve · Hideout location" onBack={onBack}>
      {/* Hero Banner with Card Credits & Action buttons */}
      <section
        className="relative mb-7 overflow-hidden border border-fuchsia-300/40 bg-[radial-gradient(circle_at_80%_15%,rgba(232,121,249,.22),transparent_38%),linear-gradient(135deg,rgba(8,47,73,.75),rgba(24,24,39,.94))] p-5 sm:p-7"
        data-testid="section-card-shop"
      >
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.28em] text-fuchsia-200">
              <Sparkles className="h-4 w-4" />
              Card shop · Cyber Deck & Collector Arena
            </p>
            <h2 className="mt-3 text-3xl font-black uppercase text-white">Lock Pack Bar</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/65">
              Trading Cards feature authentic 3D holographic foil physics, multi-element & hybrid fighting style affinities, and tactical battle deck compatibility.
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-sky-200">
              Blue boxes pay {BASE_CARD_CREDITS_PER_LOOT_BOX} CC · duplicates can be recycled or saved for variants
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <span className="flex items-center gap-2 border border-sky-300/35 bg-black/30 px-5 py-3 font-mono text-3xl font-black text-sky-200">
              <CreditCard className="h-6 w-6" />
              {meta.cardCredits} CC
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowOddsModal(true)}
                className="flex items-center gap-1 border border-white/20 bg-black/40 px-2.5 py-1 font-mono text-[8px] uppercase tracking-wider text-white/60 hover:text-white hover:border-white/40"
              >
                <Percent className="h-3 w-3 text-amber-300" />
                Pull Rates & Odds
              </button>
              <button
                type="button"
                onClick={() => setShowMatrixModal(true)}
                className="flex items-center gap-1 border border-fuchsia-300/40 bg-fuchsia-300/10 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-wider text-fuchsia-200 hover:bg-fuchsia-300/20"
              >
                <BarChart3 className="h-3 w-3" />
                Variables Matrix
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Collector Mastery Progression Terminal */}
      <section
        className="mb-6 rounded-lg border p-4 bg-gradient-to-r from-black/85 via-white/[.02] to-black/85"
        style={{ borderColor: collectorMastery.currentRank.color }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="grid h-11 w-11 place-items-center rounded-lg border font-mono text-xs font-black shrink-0"
              style={{
                borderColor: collectorMastery.currentRank.color,
                backgroundColor: `${collectorMastery.currentRank.color}15`,
                color: collectorMastery.currentRank.color,
                boxShadow: `0 0 15px ${collectorMastery.currentRank.borderGlow}`,
              }}
            >
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded px-1.5 py-0.2 font-mono text-[8px] font-black uppercase text-black"
                  style={{ backgroundColor: collectorMastery.currentRank.color }}
                >
                  {collectorMastery.currentRank.badge}
                </span>
                <h2 className="font-display text-base font-black uppercase tracking-wide text-white">
                  {collectorMastery.currentRank.title}
                </h2>
              </div>
              <p className="mt-0.5 text-[10px] text-white/60">
                {collectorMastery.currentRank.perkDescription}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end font-mono">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/50">Collection:</span>
              <strong className="text-white">
                {collectorMastery.uniqueCount} / {collectorMastery.totalCatalog} Cards
              </strong>
              <span className="text-[10px] text-amber-300">
                ({collectorMastery.holoCount} Holo/Glitch)
              </span>
            </div>
            {collectorMastery.nextRank && (
              <span className="mt-0.5 text-[8.5px] uppercase tracking-wider text-white/40">
                Next: {collectorMastery.nextRank.title} ({collectorMastery.cardsUntilNext} cards needed)
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {collectorMastery.nextRank && (
          <div className="mt-3">
            <div className="flex justify-between font-mono text-[8px] uppercase tracking-wider text-white/40 mb-1">
              <span>Tier Progress</span>
              <span>{collectorMastery.progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${collectorMastery.progressPercent}%`,
                  backgroundColor: collectorMastery.currentRank.color,
                  boxShadow: `0 0 8px ${collectorMastery.currentRank.borderGlow}`,
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Daily Flash Deal Section */}
      <section className="mb-7 border border-amber-400/40 bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-transparent p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded border border-amber-300/60 bg-amber-400/20 text-amber-200 font-bold">
              <Flame className="h-5 w-5 text-amber-300" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-rose-500 px-1.5 py-0.2 font-mono text-[8px] font-black uppercase text-white">
                  {FLASH_DEAL.discount}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300 font-black">
                  DAILY FLASH SPECIAL
                </span>
              </div>
              <p className="mt-0.5 font-display text-sm font-black uppercase text-white">
                {FLASH_DEAL.name}
              </p>
              <p className="text-[10px] text-white/50">{FLASH_DEAL.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right font-mono">
              <span className="line-through text-white/40 text-[10px] mr-2">
                {FLASH_DEAL.originalCost} CC
              </span>
              <strong className="text-amber-200 text-sm font-black">
                {FLASH_DEAL.discountCost} CC
              </strong>
            </div>
            <button
              type="button"
              onClick={() => {
                buyCardPack(FLASH_DEAL.packId);
                sfx.play('purchase');
              }}
              disabled={meta.cardCredits < FLASH_DEAL.discountCost}
              className="border border-amber-300 bg-amber-400 px-4 py-2 font-mono text-[10px] font-black uppercase text-black transition-all hover:bg-amber-300 active:scale-[0.98] disabled:opacity-40"
            >
              Rip Deal · {FLASH_DEAL.discountCost} CC
            </button>
          </div>
        </div>
      </section>

      {/* Auto-open toggle */}
      <section
        className="mb-6 flex flex-col gap-3 border border-white/15 bg-white/[.025] p-4 sm:flex-row sm:items-center sm:justify-between"
        data-testid="section-pack-auto-open"
      >
        <div>
          <p className="font-display text-sm font-black uppercase text-white">Auto-open packs</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/45">
            {meta.autoOpenPacksEnabled
              ? 'Bought and found packs rip open instantly.'
              : 'Bought and found packs are stored sealed -- open them yourself, whenever you want.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAutoOpenPacksEnabled(!meta.autoOpenPacksEnabled);
            sfx.play('uiClick');
          }}
          aria-pressed={meta.autoOpenPacksEnabled}
          className={`shrink-0 border px-4 py-2 font-mono text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.97] ${
            meta.autoOpenPacksEnabled
              ? 'border-fuchsia-300 bg-fuchsia-300/10 text-fuchsia-100'
              : 'border-white/20 text-white/50 hover:border-white/40'
          }`}
          data-testid="button-toggle-auto-open-packs"
        >
          {meta.autoOpenPacksEnabled ? 'On · open instantly' : 'Off · store sealed'}
        </button>
      </section>

      {/* Sealed Packs in Storage */}
      {Object.entries(meta.unopenedCardPacks).some(([, qty]) => (qty ?? 0) > 0) && (
        <section className="mb-8 border border-sky-300/30 bg-sky-300/[.04] p-4" data-testid="section-pack-storage">
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-sky-200" />
            <p className="font-display text-sm font-black uppercase text-white">Sealed Packs in Storage</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(meta.unopenedCardPacks) as [CardPackId, number][])
              .filter(([, qty]) => (qty ?? 0) > 0)
              .map(([packId, qty]) => {
                const pack = CARD_SHOP_PACKS_BY_ID[packId];
                if (!pack) return null;
                return (
                  <button
                    key={packId}
                    type="button"
                    onClick={() => {
                      openStoredCardPack(packId);
                      sfx.play('cardPack');
                    }}
                    className="flex items-center gap-2 border border-sky-300/40 bg-black/30 px-3 py-2.5 font-mono text-[10px] font-black uppercase text-sky-100 transition-all active:scale-[0.97] hover:border-sky-200"
                    data-testid={`button-open-stored-pack-${packId}`}
                  >
                    <PackageOpen className="h-3.5 w-3.5" />
                    {pack.name} · x{qty}
                  </button>
                );
              })}
          </div>
        </section>
      )}

      {/* Packs Grid */}
      <div className="mb-8 flex snap-x gap-3 overflow-x-auto pb-3 sm:grid sm:snap-none sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-5 sm:overflow-visible sm:pb-0">
        {CARD_SHOP_PACKS.map((pack) => (
          <article
            key={pack.id}
            className="flex min-h-56 w-[220px] shrink-0 snap-start flex-col border border-white/15 bg-black/30 p-4 sm:w-auto hover:border-white/35 transition-all"
          >
            <span className="font-mono text-[9px] uppercase tracking-widest text-fuchsia-200">
              {pack.cards} cards
            </span>
            <h3 className="mt-4 font-display text-lg font-black uppercase text-white">{pack.name}</h3>
            <p className="mt-2 text-[10px] text-white/50 leading-relaxed">{pack.description}</p>
            <button
              type="button"
              onClick={() => {
                buyCardPack(pack.id);
                sfx.play('purchase');
              }}
              disabled={meta.cardCredits < pack.cost}
              className="mt-auto border border-fuchsia-200/50 bg-fuchsia-300/10 px-3 py-2.5 font-mono text-[10px] font-black uppercase text-fuchsia-100 transition-all active:scale-[0.97] hover:bg-fuchsia-300/20 disabled:opacity-35 disabled:active:scale-100"
              data-testid={`button-buy-pack-${pack.id}`}
            >
              Open · {pack.cost} CC
            </button>
          </article>
        ))}
      </div>

      {/* Nav Tabs */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3" data-testid="card-shop-nav">
        <div className="flex flex-wrap items-center gap-2">
          {SHOP_TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab && !showAll;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setShowAll(false);
                  sfx.play('uiNav');
                }}
                className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all active:scale-[0.97] ${
                  active
                    ? 'border-fuchsia-300 bg-fuchsia-300/10 text-fuchsia-100'
                    : 'border-white/15 text-white/50 hover:border-white/35 hover:text-white'
                }`}
                data-testid={`button-shop-tab-${t.id}`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowMatrixModal(true);
              sfx.play('uiNav');
            }}
            className="flex items-center gap-1.5 border border-fuchsia-300/40 bg-fuchsia-300/10 px-3 py-2 font-mono text-[9px] font-black uppercase tracking-wider text-fuchsia-100 transition-all hover:border-fuchsia-300 hover:bg-fuchsia-300/20 active:scale-[0.98]"
          >
            <BarChart3 className="h-3.5 w-3.5 text-fuchsia-200" />
            Variables Matrix
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAll((value) => !value);
              sfx.play('uiClick');
            }}
            className={`font-mono text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.97] ${
              showAll ? 'text-fuchsia-200' : 'text-white/40 hover:text-white/70'
            }`}
            data-testid="button-shop-show-all"
          >
            {showAll ? 'Showing all · scroll to browse' : 'Show all'}
          </button>
        </div>
      </div>

      {showAll ? (
        <>
          {singlesSection}
          {salvageSection}
          {passiveSection}
          {binderSection}
        </>
      ) : tab === 'singles' ? (
        singlesSection
      ) : tab === 'salvage' ? (
        salvageSection
      ) : tab === 'passive' ? (
        passiveSection
      ) : tab === 'battle' ? (
        battleSection
      ) : (
        binderSection
      )}

      {/* Multi-Variable Matrix Chart Modal */}
      {showMatrixModal && (
        <CardMatrixChartModal
          meta={meta}
          onClose={() => setShowMatrixModal(false)}
        />
      )}

      {/* Odds, Pull Rates & Pack Simulator Modal */}
      {showOddsModal && (() => {
        const selectedPackDef = CARD_SHOP_PACKS_BY_ID[simulatorPackId] ?? CARD_SHOP_PACKS[0]!;
        const allExtraIds = CARD_MANIFESTS.map((c) => c.id);

        const handleSimulate = () => {
          const pulls = rollCardPack(simulatorPackId, Math.random, allExtraIds);
          setSimulatedPulls(pulls);
          sfx.play('purchase');
        };

        return (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.target === e.currentTarget && setShowOddsModal(false)}
          >
            <div className="relative w-full max-w-xl max-h-[90dvh] overflow-y-auto border border-white/20 bg-[#0d0d15] p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Dices className="h-5 w-5 text-amber-300" />
                  <h3 className="font-display text-lg font-black uppercase text-white">
                    Pack Rates & Simulator
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowOddsModal(false);
                    setSimulatedPulls([]);
                  }}
                  className="grid h-7 w-7 place-items-center border border-white/20 text-white/70 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Pack Selector & Info */}
              <div className="mt-4 border border-white/10 bg-black/40 p-3">
                <label className="block font-mono text-[8.5px] uppercase tracking-wider text-white/50 mb-1">
                  Inspect Pack Drop Table:
                </label>
                <select
                  value={simulatorPackId}
                  onChange={(e) => {
                    setSimulatorPackId(e.target.value as CardPackId);
                    setSimulatedPulls([]);
                  }}
                  className="w-full border border-white/20 bg-black/70 px-2.5 py-1.5 font-mono text-xs text-amber-200 outline-none"
                >
                  {CARD_SHOP_PACKS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.cost} CC · {p.cards} Cards · {p.pool})
                    </option>
                  ))}
                </select>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[9px] font-mono border-t border-white/10 pt-2 text-white/70">
                  <span>Cards / Pull: <strong className="text-white">{selectedPackDef.cards}</strong></span>
                  <span>Target Pool: <strong className="text-cyan-300 uppercase">{selectedPackDef.pool}</strong></span>
                  <span>Rarity Boost: <strong className="text-amber-300">+{Math.round(selectedPackDef.rarityBoost * 100)}%</strong></span>
                  <span>Standard Cost: <strong className="text-white">{selectedPackDef.cost} CC</strong></span>
                </div>
              </div>

              {/* Probabilities Tables */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 font-mono text-[9px]">
                <div className="border border-white/10 bg-white/[.02] p-3">
                  <p className="font-bold uppercase text-white/50 mb-2">Subject Rarity Odds:</p>
                  <div className="space-y-1">
                    <div className="flex justify-between border-b border-white/5 py-0.5">
                      <span className="text-slate-300">Common ●</span>
                      <span className="font-bold text-white">{Math.max(10, Math.round((0.58 - selectedPackDef.rarityBoost) * 100))}%</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 py-0.5">
                      <span className="text-emerald-300">Uncommon ◆</span>
                      <span className="font-bold text-white">26%</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 py-0.5">
                      <span className="text-sky-300">Rare ★</span>
                      <span className="font-bold text-white">{Math.round((0.105 + selectedPackDef.rarityBoost * 0.4) * 100)}%</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 py-0.5">
                      <span className="text-purple-300">Epic ★★</span>
                      <span className="font-bold text-white">{Math.round((0.042 + selectedPackDef.rarityBoost * 0.3) * 100)}%</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 py-0.5">
                      <span className="text-amber-300">Legendary ★★★</span>
                      <span className="font-bold text-white">{Math.round((0.01 + selectedPackDef.rarityBoost * 0.2) * 100)}%</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-yellow-200">Mythic / Secret ★★★★</span>
                      <span className="font-bold text-amber-300">{Math.round((0.003 + selectedPackDef.rarityBoost * 0.1) * 1000) / 10}%</span>
                    </div>
                  </div>
                </div>

                <div className="border border-white/10 bg-white/[.02] p-3">
                  <p className="font-bold uppercase text-white/50 mb-2">Holographic Variant Rates:</p>
                  <div className="space-y-1">
                    <div className="flex justify-between border-b border-white/5 py-0.5">
                      <span className="text-slate-300">Standard Finish</span>
                      <span className="text-white">66.0%</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 py-0.5">
                      <span className="text-amber-200">Foil (Silver Specular)</span>
                      <span className="text-white">17.0%</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 py-0.5">
                      <span className="text-cyan-300">Neon (Cyber Glow)</span>
                      <span className="text-white">9.5%</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 py-0.5">
                      <span className="text-pink-300">Glitch (CRT Scanlines)</span>
                      <span className="text-white">5.0%</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-yellow-300">Holo (Prismatic Rainbow)</span>
                      <span className="text-amber-300">2.5%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation Sandbox */}
              <div className="mt-4 border border-amber-300/30 bg-amber-500/[.03] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-xs font-black uppercase text-amber-200">
                      Sandbox Test-Pull Simulator
                    </p>
                    <p className="text-[8.5px] font-mono text-white/50">
                      Simulate opening a pack with this profile without consuming real CC
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulate}
                    className="border border-amber-300 bg-amber-400 px-3 py-1 font-mono text-[9px] font-black uppercase text-black hover:bg-amber-300 active:scale-95 transition-all"
                  >
                    Simulate Pull
                  </button>
                </div>

                {simulatedPulls.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-amber-300/20 pt-2.5">
                    {simulatedPulls.map((pull, idx) => {
                      const manifest = CARD_MANIFESTS.find((c) => c.id === pull.cardId);
                      const passive = PASSIVE_CARDS.find((c) => c.id === pull.cardId);
                      const name = manifest?.name ?? passive?.name ?? pull.cardId.split('.').pop();
                      const rarity = manifest?.rarity ?? passive?.rarity ?? 'common';
                      return (
                        <div
                          key={idx}
                          className="border border-white/10 bg-black/60 p-2 text-left font-mono text-[8px]"
                        >
                          <span className={`block uppercase font-bold ${RARITY_COLOR[rarity] ?? 'text-white'}`}>
                            {rarity}
                          </span>
                          <span className="mt-0.5 block truncate font-display text-[10px] font-black uppercase text-white">
                            {name}
                          </span>
                          <span className="mt-1 inline-block rounded bg-white/10 px-1 py-0.2 font-bold uppercase text-amber-200">
                            {pull.variant} finish
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Card Pack Reveal Modal */}
      {lastCardPackReveal && (
        <PackOpeningReveal
          reveal={lastCardPackReveal}
          cardCredits={meta.cardCredits}
          sfx={sfx}
          onOpenAnother={() => buyCardPack(lastCardPackReveal.packId)}
          onClose={clearCardPackReveal}
        />
      )}

      {/* Inspect Single Card Detail Modal */}
      {inspectCard && (
        <CardDetail
          card={inspectCard}
          owned={owned.has(inspectCard.id)}
          onClose={() => setInspectCard(null)}
        />
      )}
    </ScreenLayout>
  );
}
export default CardShopPanel;
