import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronRight,
  CreditCard,
  Filter,
  Flame,
  Layers,
  Lock,
  PackageOpen,
  Search,
  Sparkles,
  Swords,
  X,
  Zap,
} from 'lucide-react';

import type { SfxPlayer } from '@/game/audio/useSfxPlayer';
import {
  CARD_MANIFESTS,
  CARD_MANIFESTS_BY_ID,
  CARD_PACKS,
  cardPackFor,
  isCardOwned,
  type LokDeckCardMetadata,
  type LokDeckSet,
  type LokDeckSetId,
} from '@/game/data/cards';
import { CHARACTERS } from '@/game/data/characters';
import { ENEMIES } from '@/game/data/enemies';
import { LOKPET_VARIANTS_BY_ID } from '@/game/data/lokPets';
import { ALLIES, allyRig } from '@/game/data/progression';
import type { LokAssetManifest } from '@/game/lok/types';
import type { MetaState } from '@/game/types';
import { LokPetIcon } from './LokPetVariantSheet';
import { RigPortrait } from './RigPortrait';
import { LokDeckCardView, type CardViewMode } from './LokDeckCardView';
import { CardMatrixChartModal } from './CardMatrixChartModal';
import {
  getCardVariableProfile,
  ELEMENT_METADATA,
  DATA_TYPE_METADATA,
  FIGHTING_STYLE_METADATA,
  type CardElement,
  type CardDataType,
  type CardFightingStyle,
} from '@/game/data/cardVariables';

export const RARITY_STYLE: Record<string, { ink: string; edge: string; glow: string }> = {
  common: { ink: 'text-slate-200', edge: '#94a3b8', glow: 'rgba(148,163,184,.22)' },
  uncommon: { ink: 'text-emerald-200', edge: '#34d399', glow: 'rgba(52,211,153,.25)' },
  rare: { ink: 'text-sky-200', edge: '#38bdf8', glow: 'rgba(56,189,248,.28)' },
  epic: { ink: 'text-purple-200', edge: '#c084fc', glow: 'rgba(192,132,252,.28)' },
  legendary: { ink: 'text-pink-200', edge: '#f9a8d4', glow: 'rgba(249,168,212,.3)' },
  mythic: { ink: 'text-yellow-100', edge: '#fde68a', glow: 'rgba(253,230,138,.34)' },
  secret: { ink: 'text-red-200', edge: '#f87171', glow: 'rgba(248,113,113,.3)' },
};

const PACK_THEME: Record<LokDeckSetId, { accent: string; glow: string; mark: string }> = {
  operatives: { accent: '#fb923c', glow: 'rgba(251,146,60,.3)', mark: '616' },
  threats: { accent: '#ef4444', glow: 'rgba(239,68,68,.3)', mark: 'X' },
  crew: { accent: '#22d3ee', glow: 'rgba(34,211,238,.28)', mark: 'H' },
  lokpets: { accent: '#f0abfc', glow: 'rgba(240,171,252,.3)', mark: 'LP' },
  endless: { accent: '#a3e635', glow: 'rgba(163,230,53,.27)', mark: '∞' },
};

function metadata(card: LokAssetManifest): LokDeckCardMetadata | undefined {
  return card.metadata as LokDeckCardMetadata | undefined;
}

export function CardArtwork({ card, size = 150, animated = true }: { card: LokAssetManifest; size?: number; animated?: boolean }) {
  const info = metadata(card);
  if (info?.subjectType === 'character') {
    const character = CHARACTERS.find((entry) => entry.id === info.subjectId);
    if (character) return <RigPortrait rig={character.rig} palette={character.palette} anim="idle" size={size} animated={animated} />;
  }
  if (info?.subjectType === 'enemy') {
    const enemy = ENEMIES.find((entry) => entry.id === info.subjectId);
    if (enemy) return <RigPortrait rig={enemy.rig} palette={enemy.palette} anim="walk" size={size} animated={animated} />;
  }
  if (info?.subjectType === 'ally') {
    const ally = ALLIES.find((entry) => entry.id === info.subjectId);
    if (ally) return <RigPortrait rig={allyRig(ally)} palette={ally.palette} anim="idle" size={size} animated={animated} />;
  }
  if (info?.subjectType === 'lokpet') {
    const variant = LOKPET_VARIANTS_BY_ID[info.subjectId];
    if (variant) return <LokPetIcon silhouette={variant.silhouette} palette={variant.palette} size={size} />;
  }
  return (
    <div className="relative grid h-full min-h-32 w-full place-items-center overflow-hidden" aria-hidden="true">
      <div className="absolute h-28 w-28 rotate-45 border border-current opacity-25" />
      <div className="absolute h-20 w-20 rotate-12 border border-current opacity-20" />
      <span className="font-display text-5xl font-black tracking-tighter opacity-80">∞616</span>
    </div>
  );
}

function PackTile({ pack, selected, owned, onSelect }: { pack: LokDeckSet; selected: boolean; owned: number; onSelect: () => void }) {
  const theme = PACK_THEME[pack.id];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`lok-card-pack group relative min-h-44 w-[200px] shrink-0 snap-start overflow-hidden border p-4 text-left transition-all active:scale-[0.97] sm:w-auto sm:shrink ${selected ? 'border-white/60 -translate-y-1' : 'border-white/15 hover:border-white/35 hover:-translate-y-0.5'}`}
      style={{ '--pack-accent': theme.accent, '--pack-glow': theme.glow } as React.CSSProperties}
      aria-pressed={selected}
      data-testid={`button-card-pack-${pack.id}`}
    >
      <div className="absolute -right-2 -top-6 font-display text-8xl font-black text-white/[.055]">{theme.mark}</div>
      <div className="relative flex h-full flex-col">
        <span className="text-[9px] font-black uppercase tracking-[.24em]" style={{ color: theme.accent }}>{pack.kicker}</span>
        <span className="mt-8 max-w-36 font-display text-xl font-black uppercase leading-none text-white">{pack.name}</span>
        <span className="mt-auto flex items-center justify-between pt-4 font-mono text-[10px] uppercase tracking-widest text-white/65">
          {owned}/{pack.cardIds.length} collected
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </button>
  );
}

export function CardDetail({ card, owned, onClose }: { card: LokAssetManifest; owned: boolean; onClose: () => void }) {
  const rarity = RARITY_STYLE[card.rarity] ?? RARITY_STYLE.common;
  const info = metadata(card);
  const profile = getCardVariableProfile(card);
  const elemMeta = ELEMENT_METADATA[profile.element];
  const dataMeta = DATA_TYPE_METADATA[profile.dataType];
  const styleMeta = FIGHTING_STYLE_METADATA[profile.fightingStyle];
  const [previewMode, setPreviewMode] = useState<CardViewMode>('classic');

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const strongAgainst = elemMeta?.strongVs?.map((e) => ELEMENT_METADATA[e]?.label).join(', ') || 'Neutral';
  const weakAgainst = elemMeta?.weakVs?.map((e) => ELEMENT_METADATA[e]?.label).join(', ') || 'Neutral';

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-3 sm:p-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Card details"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="relative grid w-full max-w-2xl overflow-hidden border border-white/20 bg-[#0a0a0f] shadow-2xl md:grid-cols-[230px_1fr] max-h-[90vh]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-30 grid h-8 w-8 place-items-center border border-white/20 bg-black/70 text-white hover:border-white/50"
          aria-label="Close card details"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left: Interactive Card Preview with Mode Switcher */}
        <div
          className="flex flex-col items-center justify-center border-b border-white/10 p-4 md:border-b-0 md:border-r bg-[radial-gradient(circle_at_center,var(--card-glow),transparent_68%)]"
          style={{ '--card-glow': rarity.glow } as React.CSSProperties}
        >
          <LokDeckCardView card={card} owned={owned} size="standard" mode={previewMode} />
          <div className="mt-3 flex items-center rounded border border-white/20 bg-black/60 p-0.5 font-mono text-[7.5px] uppercase">
            <button
              type="button"
              onClick={() => setPreviewMode('classic')}
              className={`rounded px-2 py-0.5 font-bold transition-colors ${
                previewMode === 'classic' ? 'bg-primary text-black font-black' : 'text-white/60 hover:text-white'
              }`}
            >
              Classic
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('dynamic')}
              className={`rounded px-2 py-0.5 font-bold transition-colors ${
                previewMode === 'dynamic' ? 'bg-amber-400 text-black font-black' : 'text-white/60 hover:text-white'
              }`}
            >
              Dynamic 3D
            </button>
          </div>
          <p className="mt-1 text-center font-mono text-[8px] text-white/40 uppercase tracking-widest">
            {previewMode === 'classic' ? 'Retro Streamlined Base' : 'Tilt & Holographic Foil'}
          </p>
        </div>

        {/* Right: Rich Variable Classification & Combat Breakdown */}
        <div className="flex flex-col p-5 max-h-[85vh] overflow-y-auto">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="px-2 py-0.5 font-mono text-[8.5px] font-black uppercase text-black rounded shadow-sm"
              style={{ backgroundColor: profile.elementColor }}
            >
              {profile.elementLabel}
            </span>
            {profile.secondaryElement && (
              <span
                className="px-2 py-0.5 font-mono text-[8.5px] font-black uppercase text-black rounded shadow-sm"
                style={{ backgroundColor: profile.secondaryElementColor }}
              >
                Dual: {profile.secondaryElementLabel}
              </span>
            )}
            <span
              className="px-2 py-0.5 font-mono text-[8.5px] font-black uppercase text-black rounded"
              style={{ backgroundColor: dataMeta.color }}
            >
              {dataMeta.label}
            </span>
            <span className="font-mono text-[8.5px] text-emerald-300 uppercase">
              {styleMeta.icon} {styleMeta.label}
              {profile.secondaryFightingStyleLabel ? ` / ${profile.secondaryFightingStyleLabel}` : ''}
            </span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[8px] uppercase font-bold text-amber-200">
              {profile.evolutionStage}
            </span>
          </div>

          <h3 className="mt-2.5 font-display text-2xl font-black uppercase leading-none text-white">
            {owned ? card.name : 'Unknown Card'}
          </h3>
          <p className="mt-1 font-mono text-[8.5px] uppercase tracking-widest text-white/40">
            {profile.collectorNumber} · {profile.stars} · {profile.bodySilhouette} · {cardPackFor(card).name}
          </p>

          <p className="mt-2.5 text-xs leading-relaxed text-white/65">
            {owned ? card.description : 'This slot is sealed. Find or buy a Lock Pack to reveal a copy.'}
          </p>

          <p className="mt-2 text-[10px] italic text-amber-200/80 border-l-2 border-amber-300/40 pl-2">
            "{profile.flavorText}"
          </p>

          {/* Combat Stats Grid */}
          <div className="mt-4 grid grid-cols-3 gap-1.5 border-y border-white/10 py-3 font-mono text-[8.5px] uppercase">
            <div className="border border-white/10 p-1.5">
              <span className="block text-white/40">HP Capacity</span>
              <span className="mt-0.5 block font-bold text-rose-300 text-xs">{profile.stats.hp}</span>
            </div>
            <div className="border border-white/10 p-1.5">
              <span className="block text-white/40">Attack Power</span>
              <span className="mt-0.5 block font-bold text-amber-300 text-xs">{profile.stats.attack}</span>
            </div>
            <div className="border border-white/10 p-1.5">
              <span className="block text-white/40">Armor Defense</span>
              <span className="mt-0.5 block font-bold text-sky-300 text-xs">{profile.stats.defense}</span>
            </div>
            <div className="border border-white/10 p-1.5">
              <span className="block text-white/40">Speed Haste</span>
              <span className="mt-0.5 block font-bold text-yellow-300 text-xs">{profile.stats.speed}</span>
            </div>
            <div className="border border-white/10 p-1.5">
              <span className="block text-white/40">SP Gauge</span>
              <span className="mt-0.5 block font-bold text-fuchsia-300 text-xs">{profile.stats.spCost}</span>
            </div>
            <div className="border border-white/10 p-1.5">
              <span className="block text-white/40">Throw DMG</span>
              <span className="mt-0.5 block font-bold text-emerald-300 text-xs">{profile.stats.throwPower}</span>
            </div>
          </div>

          {/* Special Powers & Moves Box */}
          <div className="mt-3 rounded border border-white/10 bg-white/[.02] p-2.5 text-[9.5px]">
            {profile.specialPowers.map((pwr, idx) => (
              <div key={idx} className={idx > 0 ? 'mt-2 pt-2 border-t border-white/10' : ''}>
                <span className="font-mono text-[8px] font-black uppercase text-amber-300 flex items-center justify-between">
                  <span>ABILITY · {pwr.name}</span>
                  <span className="rounded bg-white/10 px-1 font-bold text-[6px] text-white/70">
                    {pwr.effectBadge}
                  </span>
                </span>
                <p className="mt-0.5 text-white/70 text-[8.5px]">{pwr.description}</p>
              </div>
            ))}

            <div className="mt-2.5 space-y-1 border-t border-white/10 pt-2 font-mono text-[8.5px]">
              {profile.moves.map((move, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-white/80">{move.name} ({move.energyCost} SP)</span>
                  <span className="font-black text-amber-200">{move.damage} DMG</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[8px] uppercase tracking-wider font-mono">
            <div className="border border-white/10 p-1.5">
              <span className="block text-white/35">Weakness / Resistance</span>
              <span className="mt-0.5 block text-white text-[7.5px]">
                Weak: <strong className="text-rose-300">{profile.weakness}</strong> · Res:{' '}
                <strong className="text-emerald-300">{profile.resistance}</strong>
              </span>
            </div>
            <div className="border border-white/10 p-1.5">
              <span className="block text-white/35">Foil Finish</span>
              <span className="mt-0.5 block capitalize text-amber-200 text-[7.5px]">
                {profile.foilKind} {profile.firstEdition ? '· 1st Edition' : ''}
              </span>
            </div>
          </div>

          {/* Elemental Matchup Strategy */}
          <div className="mt-2 border border-white/10 bg-black/40 p-2 font-mono text-[7.5px] uppercase">
            <div className="flex items-center justify-between text-white/50">
              <span>Dominates: <strong className="text-emerald-300">{strongAgainst}</strong></span>
              <span>Vulnerable: <strong className="text-rose-300">{weakAgainst}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LockDeckCollection({
  meta,
  listView = false,
  sfx,
}: {
  meta: MetaState;
  listView?: boolean;
  sfx?: SfxPlayer;
}) {
  const [selectedPackId, setSelectedPackId] = useState<LokDeckSetId>('operatives');
  const [query, setQuery] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [detailCard, setDetailCard] = useState<LokAssetManifest | null>(null);
  const [showMatrixModal, setShowMatrixModal] = useState(false);

  // Variable filters
  const [elementFilter, setElementFilter] = useState<CardElement | 'all'>('all');
  const [dataTypeFilter, setDataTypeFilter] = useState<CardDataType | 'all'>('all');
  const [styleFilter, setStyleFilter] = useState<CardFightingStyle | 'all'>('all');
  const [dualOnly, setDualOnly] = useState(false);
  const [multiOnly, setMultiOnly] = useState(false);
  const [cardViewMode, setCardViewMode] = useState<CardViewMode>('classic');

  const ownedIds = useMemo(
    () => new Set(CARD_MANIFESTS.filter((card) => isCardOwned(card, meta)).map((card) => card.id)),
    [meta],
  );
  const ownedRecords = useMemo(
    () => new Map(meta.cardCollection.map((record) => [record.cardId, record])),
    [meta.cardCollection],
  );
  const selectedPack = CARD_PACKS.find((pack) => pack.id === selectedPackId) ?? CARD_PACKS[0];

  const visibleCards = selectedPack.cardIds
    .map((id) => CARD_MANIFESTS_BY_ID[id])
    .filter((card): card is LokAssetManifest => Boolean(card))
    .filter((card) => !ownedOnly || ownedIds.has(card.id))
    .filter((card) => {
      const profile = getCardVariableProfile(card);
      if (dualOnly && !profile.hasDualElement) return false;
      if (multiOnly && !(profile.hasDualElement || profile.hasDualStyle || profile.hasDualData || profile.specialPowers.length > 1)) return false;
      if (elementFilter !== 'all' && profile.element !== elementFilter && profile.secondaryElement !== elementFilter) return false;
      if (dataTypeFilter !== 'all' && profile.dataType !== dataTypeFilter && profile.secondaryDataType !== dataTypeFilter) return false;
      if (styleFilter !== 'all' && profile.fightingStyle !== styleFilter && profile.secondaryFightingStyle !== styleFilter) return false;
      return true;
    })
    .filter(
      (card) =>
        !query.trim() ||
        `${card.name} ${card.description ?? ''} ${card.id}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    );

  const activeFiltersCount =
    (elementFilter !== 'all' ? 1 : 0) +
    (dataTypeFilter !== 'all' ? 1 : 0) +
    (styleFilter !== 'all' ? 1 : 0) +
    (dualOnly ? 1 : 0) +
    (multiOnly ? 1 : 0);

  return (
    <div>
      {/* Pack Tabs */}
      <div className="mb-5 flex snap-x gap-3 overflow-x-auto pb-3 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-5">
        {CARD_PACKS.map((pack) => (
          <PackTile
            key={pack.id}
            pack={pack}
            selected={pack.id === selectedPackId}
            owned={pack.cardIds.filter((id) => ownedIds.has(id)).length}
            onSelect={() => {
              setSelectedPackId(pack.id);
              sfx?.play('uiClick');
            }}
          />
        ))}
      </div>

      {/* Action / Search / Matrix Bar */}
      <div className="mb-4 flex flex-col gap-3 border-y border-white/10 py-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-display text-xl font-black uppercase text-white">
            <PackageOpen className="h-5 w-5 text-fuchsia-200" />
            {selectedPack.name}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/45">
            {selectedPack.description}
          </p>
        </div>

        {/* Matrix Chart Modal Trigger */}
        <button
          type="button"
          onClick={() => {
            setShowMatrixModal(true);
            sfx?.play('uiNav');
          }}
          className="flex h-10 items-center gap-2 border border-fuchsia-300/40 bg-fuchsia-300/10 px-3.5 font-mono text-[9px] font-black uppercase tracking-wider text-fuchsia-100 transition-all hover:border-fuchsia-300 hover:bg-fuchsia-300/20 active:scale-[0.98]"
        >
          <BarChart3 className="h-4 w-4 text-fuchsia-200" />
          Variables & Synergy Matrix
        </button>

        <label className="flex h-10 min-w-44 items-center gap-2 border border-white/15 bg-black/30 px-3 focus-within:border-white/40">
          <Search className="h-4 w-4 text-white/35" />
          <input
            aria-label="Search this card pack"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this pack"
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/30"
          />
        </label>

        <button
          type="button"
          onClick={() => setOwnedOnly((value) => !value)}
          className={`h-10 border px-3 text-[9px] font-black uppercase tracking-widest ${
            ownedOnly
              ? 'border-emerald-300 bg-emerald-300/10 text-emerald-200'
              : 'border-white/15 text-white/50 hover:border-white/35'
          }`}
          aria-pressed={ownedOnly}
        >
          <Sparkles className="mr-2 inline h-3.5 w-3.5" />
          Collected only
        </button>
      </div>

      {/* Multidimensional Variable Filters Bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3 font-mono text-[9px]">
        <span className="flex items-center gap-1 uppercase tracking-wider text-white/40">
          <Filter className="h-3.5 w-3.5 text-white/40" />
          Filter:
        </span>

        {/* Element Filter */}
        <select
          value={elementFilter}
          onChange={(e) => setElementFilter(e.target.value as any)}
          className="border border-white/15 bg-black/50 px-2 py-1 uppercase text-white outline-none"
        >
          <option value="all">All Elements</option>
          {Object.entries(ELEMENT_METADATA).map(([key, data]) => (
            <option key={key} value={key}>
              {data.icon} {data.label}
            </option>
          ))}
        </select>

        {/* Data Type Filter */}
        <select
          value={dataTypeFilter}
          onChange={(e) => setDataTypeFilter(e.target.value as any)}
          className="border border-white/15 bg-black/50 px-2 py-1 uppercase text-white outline-none"
        >
          <option value="all">All Data Types</option>
          {Object.entries(DATA_TYPE_METADATA).map(([key, data]) => (
            <option key={key} value={key}>
              {data.badge} - {data.label}
            </option>
          ))}
        </select>

        {/* Fighting Style Filter */}
        <select
          value={styleFilter}
          onChange={(e) => setStyleFilter(e.target.value as any)}
          className="border border-white/15 bg-black/50 px-2 py-1 uppercase text-white outline-none"
        >
          <option value="all">All Fighting Styles</option>
          {Object.entries(FIGHTING_STYLE_METADATA).map(([key, data]) => (
            <option key={key} value={key}>
              {data.icon} {data.label}
            </option>
          ))}
        </select>

        {/* Dual Element Filter Toggle */}
        <button
          type="button"
          onClick={() => setDualOnly(!dualOnly)}
          className={`border px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-wider transition-all ${
            dualOnly
              ? 'border-rose-400 bg-rose-400/20 text-rose-200'
              : 'border-white/15 text-white/50 hover:border-white/35'
          }`}
          aria-pressed={dualOnly}
        >
          Dual Elements
        </button>

        {/* Multi-Variable Filter Toggle */}
        <button
          type="button"
          onClick={() => setMultiOnly(!multiOnly)}
          className={`border px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-wider transition-all ${
            multiOnly
              ? 'border-amber-400 bg-amber-400/20 text-amber-200'
              : 'border-white/15 text-white/50 hover:border-white/35'
          }`}
          aria-pressed={multiOnly}
        >
          Multi-Variable
        </button>

        {/* View Mode Toggle: Classic (Default Base) vs Dynamic 3D */}
        <div className="flex items-center rounded border border-white/20 bg-black/40 p-0.5 font-mono text-[8px] uppercase sm:ml-auto">
          <span className="px-2 text-white/40 hidden sm:inline">Card Style:</span>
          <button
            type="button"
            onClick={() => setCardViewMode('classic')}
            className={`rounded px-2.5 py-1 font-bold transition-colors ${
              cardViewMode === 'classic'
                ? 'bg-primary text-black font-black shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
            data-testid="button-viewmode-classic"
          >
            Classic View (Base)
          </button>
          <button
            type="button"
            onClick={() => setCardViewMode('dynamic')}
            className={`rounded px-2.5 py-1 font-bold transition-colors ${
              cardViewMode === 'dynamic'
                ? 'bg-amber-400 text-black font-black shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
            data-testid="button-viewmode-dynamic"
          >
            Dynamic 3D
          </button>
        </div>

        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setElementFilter('all');
              setDataTypeFilter('all');
              setStyleFilter('all');
              setDualOnly(false);
              setMultiOnly(false);
            }}
            className="border border-rose-400/40 bg-rose-400/10 px-2 py-1 font-black uppercase text-rose-200 hover:bg-rose-400/20"
          >
            Clear Filters ({activeFiltersCount})
          </button>
        )}
      </div>

      {/* Cards Grid: Rendered in tactical Lock Deck style with click-to-inspect */}
      {visibleCards.length ? (
        <div
          className={`grid gap-3 ${
            listView
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
          }`}
        >
          {visibleCards.map((card) => {
            const record = ownedRecords.get(card.id);
            return (
              <LokDeckCardView
                key={card.id}
                card={card}
                owned={ownedIds.has(card.id)}
                copies={record?.copies ?? 0}
                variant={record?.bestVariant}
                mode={cardViewMode}
                size="standard"
                onClick={() => {
                  setDetailCard(card);
                  sfx?.play('uiClick');
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="grid min-h-48 place-items-center border border-dashed border-white/15 text-center text-xs uppercase tracking-widest text-white/35">
          No cards match this filter view.
        </div>
      )}

      <p className="mt-5 flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/35">
        <CreditCard className="h-3.5 w-3.5" />
        Click any card to inspect full tactical intel, combat moves, synergies, and variable affinities. Switch to Dynamic 3D for holographic foil tilt.
      </p>

      {/* Detail Modal with 3D Tilt */}
      {detailCard && (
        <CardDetail
          card={detailCard}
          owned={ownedIds.has(detailCard.id)}
          onClose={() => setDetailCard(null)}
        />
      )}

      {/* Variable Matrix & Synergy Chart Modal */}
      {showMatrixModal && (
        <CardMatrixChartModal
          meta={meta}
          onClose={() => setShowMatrixModal(false)}
          onFilterSelect={(f) => {
            if (f.element) setElementFilter(f.element);
            if (f.dataType) setDataTypeFilter(f.dataType);
            if (f.style) setStyleFilter(f.style);
            if (f.dualElementOnly) setDualOnly(true);
            if (f.multiVariableOnly) setMultiOnly(true);
          }}
        />
      )}
    </div>
  );
}
export default LockDeckCollection;

