import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, CreditCard, Lock, PackageOpen, Search, Sparkles, X } from 'lucide-react';

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

const RARITY_STYLE: Record<string, { ink: string; edge: string; glow: string }> = {
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

function CardArtwork({ card, size = 150, animated = true }: { card: LokAssetManifest; size?: number; animated?: boolean }) {
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
      className={`lok-card-pack group relative min-h-44 overflow-hidden border p-4 text-left transition-all ${selected ? 'border-white/60 -translate-y-1' : 'border-white/15 hover:border-white/35 hover:-translate-y-0.5'}`}
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

function CollectionCard({ card, owned, onOpen }: { card: LokAssetManifest; owned: boolean; onOpen: () => void }) {
  const rarity = RARITY_STYLE[card.rarity] ?? RARITY_STYLE.common;
  const info = metadata(card);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`lok-collection-card group relative aspect-[5/7] w-full overflow-hidden rounded-[14px] border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${owned ? '' : 'is-locked'}`}
      style={{ '--card-edge': rarity.edge, '--card-glow': rarity.glow } as React.CSSProperties}
      data-testid={`card-lok-${card.slug}`}
      aria-label={`${owned ? card.name : 'Locked card'}, ${card.rarity}`}
    >
      <div className="lok-card-foil absolute inset-0" />
      <div className="absolute inset-[5px] rounded-[10px] border border-white/15 bg-[#09090d]" />
      <div className="absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-[13px] font-black uppercase leading-none tracking-tight text-white">{owned ? card.name : 'Unknown Signal'}</p>
          <p className="mt-1 font-mono text-[7px] uppercase tracking-[.18em] text-white/45">{info?.cardNumber ?? card.slug}</p>
        </div>
        <span className={`font-mono text-[7px] font-black uppercase tracking-wider ${rarity.ink}`}>{card.rarity}</span>
      </div>
      <div className={`absolute inset-x-3 bottom-[4.3rem] top-12 grid place-items-center overflow-hidden rounded-md border border-white/10 bg-[radial-gradient(circle_at_50%_35%,var(--card-glow),transparent_68%)] ${owned ? '' : 'grayscale'}`}>
        {/* Binder grids stay static so a full collection does not create one
            requestAnimationFrame loop per card; the focused detail view moves. */}
        <CardArtwork card={card} size={142} animated={false} />
        {!owned && <Lock className="absolute h-6 w-6 text-white/55" />}
      </div>
      <div className="absolute inset-x-3 bottom-3 z-10">
        <p className="line-clamp-2 min-h-7 text-[8px] leading-relaxed text-white/55">
          {owned ? card.description : 'Complete its discovery condition to break the seal.'}
        </p>
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1.5 font-mono text-[7px] uppercase tracking-widest text-white/40">
          <span>{cardPackFor(card).name}</span>
          {owned ? <Check className="h-3 w-3 text-emerald-300" /> : <Lock className="h-3 w-3" />}
        </div>
      </div>
    </button>
  );
}

function CardDetail({ card, owned, onClose }: { card: LokAssetManifest; owned: boolean; onClose: () => void }) {
  const rarity = RARITY_STYLE[card.rarity] ?? RARITY_STYLE.common;
  const info = metadata(card);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Card details" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="relative grid w-full max-w-2xl overflow-hidden border border-white/20 bg-[#0a0a0f] shadow-2xl sm:grid-cols-[240px_1fr]">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center border border-white/20 bg-black/70 text-white hover:border-white/50" aria-label="Close card details"><X className="h-4 w-4" /></button>
        <div className="grid min-h-72 place-items-center border-b border-white/10 bg-[radial-gradient(circle_at_center,var(--card-glow),transparent_68%)] p-6 sm:border-b-0 sm:border-r" style={{ '--card-glow': rarity.glow } as React.CSSProperties}>
          <div className={owned ? '' : 'opacity-35 grayscale'}><CardArtwork card={card} size={210} /></div>
        </div>
        <div className="flex flex-col p-6">
          <span className={`font-mono text-[10px] font-black uppercase tracking-[.24em] ${rarity.ink}`}>{card.rarity} · {cardPackFor(card).name}</span>
          <h3 className="mt-3 font-display text-3xl font-black uppercase leading-none text-white">{owned ? card.name : 'Unknown Signal'}</h3>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-white/40">{info?.cardNumber} · definition v{card.version}</p>
          <p className="mt-6 text-sm leading-relaxed text-white/65">{owned ? card.description : 'This slot is sealed. Progress in Survivor 616 to catalog the subject and reveal the card.'}</p>
          <div className="mt-auto grid grid-cols-2 gap-3 pt-8 text-[9px] uppercase tracking-widest">
            <div className="border border-white/10 p-3"><span className="block text-white/35">Source</span><span className="mt-1 block text-white">Survivor 616</span></div>
            <div className="border border-white/10 p-3"><span className="block text-white/35">Status</span><span className="mt-1 block text-white">{owned ? 'Collected' : 'Locked'}</span></div>
            <div className="col-span-2 border border-white/10 p-3"><span className="block text-white/35">Unified asset ID</span><span className="mt-1 block break-all font-mono normal-case text-white/70">{card.id}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LockDeckCollection({ meta, listView = false }: { meta: MetaState; listView?: boolean }) {
  const [selectedPackId, setSelectedPackId] = useState<LokDeckSetId>('operatives');
  const [query, setQuery] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [detailCard, setDetailCard] = useState<LokAssetManifest | null>(null);
  const ownedIds = useMemo(() => new Set(CARD_MANIFESTS.filter((card) => isCardOwned(card, meta)).map((card) => card.id)), [meta]);
  const selectedPack = CARD_PACKS.find((pack) => pack.id === selectedPackId) ?? CARD_PACKS[0];
  const visibleCards = selectedPack.cardIds
    .map((id) => CARD_MANIFESTS_BY_ID[id])
    .filter((card): card is LokAssetManifest => Boolean(card))
    .filter((card) => !ownedOnly || ownedIds.has(card.id))
    .filter((card) => !query.trim() || `${card.name} ${card.description ?? ''} ${card.id}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      <div className="mb-5 overflow-x-auto pb-3">
        <div className="grid min-w-[760px] grid-cols-5 gap-3">
          {CARD_PACKS.map((pack) => <PackTile key={pack.id} pack={pack} selected={pack.id === selectedPackId} owned={pack.cardIds.filter((id) => ownedIds.has(id)).length} onSelect={() => setSelectedPackId(pack.id)} />)}
        </div>
      </div>
      <div className="mb-5 flex flex-col gap-3 border-y border-white/10 py-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-display text-xl font-black uppercase text-white"><PackageOpen className="h-5 w-5" />{selectedPack.name}</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/45">{selectedPack.description}</p>
        </div>
        <label className="flex h-10 min-w-48 items-center gap-2 border border-white/15 bg-black/30 px-3 focus-within:border-white/40">
          <Search className="h-4 w-4 text-white/35" />
          <input aria-label="Search this card pack" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this pack" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/30" />
        </label>
        <button type="button" onClick={() => setOwnedOnly((value) => !value)} className={`h-10 border px-3 text-[9px] font-black uppercase tracking-widest ${ownedOnly ? 'border-emerald-300 bg-emerald-300/10 text-emerald-200' : 'border-white/15 text-white/50 hover:border-white/35'}`} aria-pressed={ownedOnly}>
          <Sparkles className="mr-2 inline h-3.5 w-3.5" />Collected only
        </button>
      </div>
      {visibleCards.length ? (
        <div className={`grid gap-3 ${listView ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
          {visibleCards.map((card) => <CollectionCard key={card.id} card={card} owned={ownedIds.has(card.id)} onOpen={() => setDetailCard(card)} />)}
        </div>
      ) : (
        <div className="grid min-h-48 place-items-center border border-dashed border-white/15 text-center text-xs uppercase tracking-widest text-white/35">No cards match this view.</div>
      )}
      <p className="mt-5 flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/35"><CreditCard className="h-3.5 w-3.5" />Unlocks fill these packs automatically. Lock Decks will use the same stable card IDs.</p>
      {detailCard && <CardDetail card={detailCard} owned={ownedIds.has(detailCard.id)} onClose={() => setDetailCard(null)} />}
    </div>
  );
}
