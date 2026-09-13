import { CreditCard, Gift, PackageOpen, Sparkles } from 'lucide-react';

import { CARD_MANIFESTS, isCardOwned } from '@/game/data/cards';
import {
  BASE_CARD_CREDITS_PER_LOOT_BOX,
  LOKPET_CARD_PACK_COST,
  useMeta,
} from '@/game/state/metaStore';
import { LockDeckCollection } from './LockDeckCollection';
import { ScreenLayout } from './ScreenLayout';

/**
 * The playable storefront for Survivor 616's card economy. The Archive keeps
 * the historical binder; this is the place a player deliberately visits to
 * spend Card Credits and browse their Lock Deck packs.
 */
export function CardShopPanel({ onBack }: { onBack: () => void }) {
  const { meta, buyLokPetCardPack } = useMeta();
  const ownedCardCount = CARD_MANIFESTS.filter((card) => isCardOwned(card, meta)).length;
  const packFull = meta.savedLokPets.length >= 48;
  const canOpen = meta.cardCredits >= LOKPET_CARD_PACK_COST && !packFull;

  return (
    <ScreenLayout title="LokPet Card Shop" subtitle="The Neon Sleeve" onBack={onBack}>
      <section className="relative mb-7 overflow-hidden border border-fuchsia-300/40 bg-[radial-gradient(circle_at_80%_15%,rgba(232,121,249,.22),transparent_38%),linear-gradient(135deg,rgba(8,47,73,.75),rgba(24,24,39,.94))] p-5 sm:p-7" data-testid="section-card-shop">
        <div className="pointer-events-none absolute -right-8 -top-10 text-[10rem] font-black leading-none text-fuchsia-200/[.06]" aria-hidden="true">LP</div>
        <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.28em] text-fuchsia-200"><Sparkles className="h-4 w-4" /> Street-level collection house</p>
            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white">Blue Sleeve Cipher Pack</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">Open a pack to bring home one combat-ready LokPet and seal its permanent imprint in your Survivor 616 binder. Every card uses the same stable IDs that Lock Decks will recognize across G6.</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-sky-200">Blue loot boxes pay {BASE_CARD_CREDITS_PER_LOOT_BOX} CC · Collector ranks increase the payout</p>
          </div>
          <div className="min-w-56 border border-sky-300/35 bg-black/30 p-4 text-center backdrop-blur-sm">
            <span className="flex items-center justify-center gap-2 font-mono text-3xl font-black text-sky-200"><CreditCard className="h-6 w-6" />{meta.cardCredits} CC</span>
            <button
              type="button"
              onClick={buyLokPetCardPack}
              disabled={!canOpen}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 border border-fuchsia-200/60 bg-fuchsia-300/15 px-4 py-3 font-mono text-[11px] font-black uppercase tracking-widest text-fuchsia-50 transition hover:bg-fuchsia-300/25 disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="button-card-shop-open-pack"
            >
              <Gift className="h-4 w-4" /> Open · {LOKPET_CARD_PACK_COST} CC
            </button>
            <p className="mt-2 text-[10px] text-white/45">{packFull ? 'Kennel full — make room before opening another pack.' : canOpen ? 'A new companion is waiting in the sleeve.' : `${LOKPET_CARD_PACK_COST - meta.cardCredits} CC until your next pack.`}</p>
          </div>
        </div>
      </section>

      <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2"><PackageOpen className="h-5 w-5 text-fuchsia-200" /><h2 className="font-black uppercase tracking-wide text-white">Lock Deck Binder</h2></div>
        <span className="font-mono text-xs font-bold text-white/55">{ownedCardCount} / {CARD_MANIFESTS.length} filed</span>
      </div>
      <LockDeckCollection meta={meta} listView={meta.uiDensity === 'list'} />
    </ScreenLayout>
  );
}

export default CardShopPanel;
