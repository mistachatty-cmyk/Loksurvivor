import { useState } from 'react';
import { Check, CreditCard, Layers3, LockKeyhole, PackageOpen, Sparkles } from 'lucide-react';
import { useSfxPlayer } from '@/game/audio/useSfxPlayer';
import { CARD_MANIFESTS, isCardOwned } from '@/game/data/cards';
import { CARD_SHOP_PACKS, PASSIVE_CARDS, activeCardEffects, passiveDeckSlots } from '@/game/data/passiveCards';
import { getActiveSoundPackStyle } from '@/game/data/soundPacks';
import { BASE_CARD_CREDITS_PER_LOOT_BOX, useMeta } from '@/game/state/metaStore';
import { LockDeckCollection } from './LockDeckCollection';
import { PackOpeningReveal } from './PackOpeningReveal';
import { ScreenLayout } from './ScreenLayout';

const RARITY_COLOR: Record<string, string> = { common: 'text-slate-200', uncommon: 'text-emerald-200', rare: 'text-sky-200', epic: 'text-purple-200', legendary: 'text-pink-200' };

type ShopTab = 'binder' | 'passive';
const SHOP_TABS: { id: ShopTab; label: string; icon: typeof PackageOpen }[] = [
  { id: 'binder', label: 'Lock Deck Binder', icon: PackageOpen },
  { id: 'passive', label: 'Passive Lock Deck', icon: Layers3 },
];

export function CardShopPanel({ onBack }: { onBack: () => void }) {
  const { meta, buyCardPack, togglePassiveCard, lastCardPackReveal, clearCardPackReveal } = useMeta();
  const sfx = useSfxPlayer(getActiveSoundPackStyle(meta.activeSoundPackId), meta.sfxEnabled);
  const [tab, setTab] = useState<ShopTab>('binder');
  const [showAll, setShowAll] = useState(false);
  const owned = new Map(meta.cardCollection.map((record) => [record.cardId, record]));
  const slots = passiveDeckSlots(meta);
  const effects = activeCardEffects(meta);

  const passiveSection = (
    <section className="mb-9 border border-white/15 bg-white/[.025] p-4" data-testid="section-passive-lock-deck">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-display text-xl font-black uppercase text-white"><Layers3 className="h-5 w-5 text-fuchsia-200" />Passive Lock Deck</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/45">Equip {slots} cards · slot 4 at 8 Collector runs/6 catches · slot 5 at 25 runs/20 catches</p>
        </div>
        <div className="flex gap-2">{Array.from({ length: 5 }, (_, i) => <span key={i} className={`grid h-9 w-9 place-items-center border text-xs ${i < slots ? 'border-fuchsia-300/50' : 'border-white/10 text-white/20'}`}>{i < slots ? i + 1 : <LockKeyhole className="h-3.5 w-3.5" />}</span>)}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 font-mono text-[9px] uppercase text-white/50">
        {effects.lokPetDamageMult > 1 && <span>Pet damage +{Math.round((effects.lokPetDamageMult - 1) * 100)}%</span>}
        {effects.packDropBonus > 0 && <span>Pack odds +{(effects.packDropBonus * 100).toFixed(2)}%</span>}
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
              onClick={() => { togglePassiveCard(card.id); sfx.play('uiClick'); }}
              disabled={!record || (!active && meta.activePassiveCardIds.length >= slots)}
              className={`border p-3 text-left transition-all active:scale-[0.97] ${active ? 'border-fuchsia-300 bg-fuchsia-300/10' : record ? 'border-white/15' : 'border-white/[.07] opacity-45'}`}
            >
              <span className={`text-[9px] uppercase ${RARITY_COLOR[card.rarity]}`}>{card.type} · {card.rarity}{record ? ` · x${record.copies} · ${record.bestVariant}` : ''}</span>
              <span className="mt-1 flex justify-between font-display text-sm font-black uppercase text-white">{record ? card.name : 'Unknown Signal'}{active && <Check className="h-4 w-4" />}</span>
              <span className="mt-1 block text-[10px] text-white/50">{record ? card.description : 'Open matching packs to break the seal.'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const binderSection = (
    <div data-testid="section-lock-deck-binder">
      <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2"><PackageOpen className="h-5 w-5 text-fuchsia-200" /><h2 className="font-black uppercase text-white">Lock Deck Binder</h2></div>
        <span className="font-mono text-xs text-white/55">{CARD_MANIFESTS.filter((card) => isCardOwned(card, meta)).length}/{CARD_MANIFESTS.length} subjects · {meta.cardCollection.reduce((sum, card) => sum + card.copies, 0)} copies</span>
      </div>
      <LockDeckCollection meta={meta} listView={meta.uiDensity === 'list'} sfx={sfx} />
    </div>
  );

  return (
    <ScreenLayout title="LokPet Card Shop" subtitle="The Neon Sleeve · Hideout location" onBack={onBack}>
      <section className="relative mb-7 overflow-hidden border border-fuchsia-300/40 bg-[radial-gradient(circle_at_80%_15%,rgba(232,121,249,.22),transparent_38%),linear-gradient(135deg,rgba(8,47,73,.75),rgba(24,24,39,.94))] p-5 sm:p-7" data-testid="section-card-shop">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.28em] text-fuchsia-200"><Sparkles className="h-4 w-4" />Card shop · temporary hideout berth</p>
            <h2 className="mt-3 text-3xl font-black uppercase text-white">Lock Pack Bar</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/65">Cards begin sealed. Find physical Lock Packs from kills and loot chests—or spend Card Credits here. Collector operatives raise both pack-drop and chest odds.</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-sky-200">Blue boxes pay {BASE_CARD_CREDITS_PER_LOOT_BOX} CC · duplicates build copy count, variants, and value</p>
          </div>
          <span className="flex items-center gap-2 border border-sky-300/35 bg-black/30 px-5 py-3 font-mono text-3xl font-black text-sky-200"><CreditCard className="h-6 w-6" />{meta.cardCredits} CC</span>
        </div>
      </section>

      <div className="mb-8 flex snap-x gap-3 overflow-x-auto pb-3 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-6">
        {CARD_SHOP_PACKS.map((pack) => (
          <article key={pack.id} className="flex min-h-56 w-[220px] shrink-0 snap-start flex-col border border-white/15 bg-black/30 p-4 sm:w-auto">
            <span className="font-mono text-[9px] uppercase tracking-widest text-fuchsia-200">{pack.cards} cards</span>
            <h3 className="mt-5 font-display text-xl font-black uppercase text-white">{pack.name}</h3>
            <p className="mt-3 text-[11px] text-white/50">{pack.description}</p>
            <button
              type="button"
              onClick={() => { buyCardPack(pack.id); sfx.play('purchase'); }}
              disabled={meta.cardCredits < pack.cost}
              className="mt-auto border border-fuchsia-200/50 bg-fuchsia-300/10 px-3 py-2.5 font-mono text-[10px] font-black uppercase text-fuchsia-100 transition-all active:scale-[0.97] disabled:opacity-35 disabled:active:scale-100"
              data-testid={`button-buy-pack-${pack.id}`}
            >
              Open · {pack.cost} CC
            </button>
          </article>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3" data-testid="card-shop-nav">
        <div className="flex gap-2">
          {SHOP_TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab && !showAll;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setShowAll(false); sfx.play('uiNav'); }}
                className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all active:scale-[0.97] ${active ? 'border-fuchsia-300 bg-fuchsia-300/10 text-fuchsia-100' : 'border-white/15 text-white/50 hover:border-white/35 hover:text-white'}`}
                data-testid={`button-shop-tab-${t.id}`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => { setShowAll((value) => !value); sfx.play('uiClick'); }}
          className={`font-mono text-[9px] font-black uppercase tracking-widest transition-all active:scale-[0.97] ${showAll ? 'text-fuchsia-200' : 'text-white/40 hover:text-white/70'}`}
          data-testid="button-shop-show-all"
        >
          {showAll ? 'Showing both · scroll to browse' : 'Show both instead'}
        </button>
      </div>

      {showAll ? (
        <>
          {passiveSection}
          {binderSection}
        </>
      ) : tab === 'passive' ? passiveSection : binderSection}

      {lastCardPackReveal && (
        <PackOpeningReveal
          reveal={lastCardPackReveal}
          cardCredits={meta.cardCredits}
          sfx={sfx}
          onOpenAnother={() => buyCardPack(lastCardPackReveal.packId)}
          onClose={clearCardPackReveal}
        />
      )}
    </ScreenLayout>
  );
}
export default CardShopPanel;
