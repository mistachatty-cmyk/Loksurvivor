/**
 * "Sleeve Counter": The Neon Sleeve's cosmetics tab. Sells pack wrappers, card
 * backs and card frames for Card Credits (CC). Purely visual; nothing here changes
 * pack odds, prices or card stats.
 */
import { Check } from 'lucide-react';

import {
  CARD_MOTION_OPTIONS,
  cardCosmeticsOfKind,
  isCardCosmeticOwned,
  selectedCardCosmeticId,
  type CardCosmeticDef,
  type CardCosmeticKind,
} from '@/game/data/cardCosmetics';
import { CARD_MANIFESTS_BY_ID, CARD_PACKS } from '@/game/data/cards';
import { CARD_SHOP_PACKS_BY_ID } from '@/game/data/passiveCards';
import { useMeta } from '@/game/state/metaStore';
import { useT } from '@/lib/i18n';
import { PackArt, ScaledCardBack } from './CardCosmetics';
import { LokDeckCardView } from './LokDeckCardView';

const KINDS: CardCosmeticKind[] = ['packSkin', 'cardBack', 'cardFrame'];

const TIER_STYLE: Record<CardCosmeticDef['tier'], string> = {
  standard: 'text-slate-200 border-slate-300/40',
  uncommon: 'text-emerald-200 border-emerald-300/40',
  rare: 'text-sky-200 border-sky-300/40',
  legendary: 'text-amber-200 border-amber-300/50',
  animated: 'text-fuchsia-200 border-fuchsia-300/60 bg-fuchsia-300/10',
};

/** A card to show the frames on: the first card of the first pack set. */
const SAMPLE_CARD = CARD_MANIFESTS_BY_ID[CARD_PACKS[0]?.cardIds[0] ?? ''];

function Preview({ item, motion }: { item: CardCosmeticDef; motion: 'full' | 'subtle' | 'off' }) {
  if (item.kind === 'cardBack') return <ScaledCardBack backId={item.id} motion={motion} maxWidth={150} />;
  if (item.kind === 'packSkin') {
    const pack = CARD_SHOP_PACKS_BY_ID.operative;
    if (item.id === 'pack-classic') {
      return (
        <div className="mx-auto flex h-40 w-[130px] flex-col border border-white/15 bg-black/30 p-3" aria-hidden="true">
          <span className="font-mono text-[8px] uppercase tracking-widest text-fuchsia-200">{pack.cards} cards</span>
          <span className="mt-3 font-display text-sm font-black uppercase text-white">{pack.name}</span>
          <span className="mt-auto border border-fuchsia-200/50 bg-fuchsia-300/10 px-2 py-1 text-center font-mono text-[8px] font-black uppercase text-fuchsia-100">Open · {pack.cost} CC</span>
        </div>
      );
    }
    return <PackArt pack={pack} skin={item.id} motion={motion} maxWidth={140} />;
  }
  if (!SAMPLE_CARD) return null;
  return (
    <div className="mx-auto w-full max-w-[150px]">
      <LokDeckCardView card={SAMPLE_CARD} owned variant="holo" size="compact" customFrame={item.id} motion={motion} />
    </div>
  );
}

export function SleeveCounter({ onPlay }: { onPlay?: (sound: 'purchase' | 'uiClick') => void }) {
  const t = useT();
  const { meta, buyCardCosmetic, equipCardCosmetic, setCardMotion } = useMeta();

  return (
    <div data-testid="section-sleeve-counter">
      <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-black uppercase text-white">{t('sleeve.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/60">{t('sleeve.intro')}</p>
        </div>
        <div role="group" aria-label={t('sleeve.motion.label')} className="flex items-center gap-2" data-testid="sleeve-motion">
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/45">{t('sleeve.motion.label')}</span>
          {CARD_MOTION_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={meta.cardMotion === option}
              onClick={() => {
                setCardMotion(option);
                onPlay?.('uiClick');
              }}
              className={`border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                meta.cardMotion === option ? 'border-fuchsia-300 bg-fuchsia-300/15 text-fuchsia-100' : 'border-white/15 text-white/50 hover:border-white/40 hover:text-white'
              }`}
              data-testid={`button-card-motion-${option}`}
            >
              {t(`sleeve.motion.${option}` as const)}
            </button>
          ))}
        </div>
      </div>

      {KINDS.map((kind) => (
        <section key={kind} className="mb-9" data-testid={`sleeve-section-${kind}`}>
          <h3 className="font-display text-lg font-black uppercase text-white">{t(`sleeve.kind.${kind}` as const)}</h3>
          <p className="mb-4 mt-1 text-xs text-white/50">{t(`sleeve.kind.${kind}.hint` as const)}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {cardCosmeticsOfKind(kind).map((item) => {
              const owned = isCardCosmeticOwned(meta, item);
              const equipped = selectedCardCosmeticId(meta, kind) === item.id;
              const affordable = meta.cardCredits >= item.cost;
              const locked = item.requiresUnlock === 'lokPackVisualizer' && !meta.lokPackVisualizerUnlocked;
              return (
                <article
                  key={item.id}
                  className={`flex flex-col border bg-black/30 p-3 ${equipped ? 'border-fuchsia-300/70' : 'border-white/15'}`}
                  data-testid={`sleeve-item-${item.id}`}
                >
                  <div className="grid min-h-44 place-items-center pb-3 pt-1">
                    <Preview item={item} motion={meta.cardMotion} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-display text-sm font-black uppercase leading-tight text-white">{item.name}</h4>
                    <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[8px] uppercase ${TIER_STYLE[item.tier]}`}>{item.tier}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-white/55">{item.description}</p>
                  <div className="mt-auto pt-3">
                    {equipped ? (
                      <span className="flex items-center justify-center gap-1.5 border border-fuchsia-300/50 bg-fuchsia-300/10 px-3 py-2 font-mono text-[10px] font-black uppercase text-fuchsia-100" data-testid={`sleeve-equipped-${item.id}`}>
                        <Check className="h-3.5 w-3.5" /> {t('sleeve.equipped')}
                      </span>
                    ) : owned ? (
                      <button
                        type="button"
                        onClick={() => {
                          equipCardCosmetic(item.id);
                          onPlay?.('uiClick');
                        }}
                        className="w-full border border-white/30 px-3 py-2 font-mono text-[10px] font-black uppercase text-white transition-all hover:border-white/60 active:scale-[0.97]"
                        data-testid={`button-equip-${item.id}`}
                      >
                        {t('sleeve.equip')}
                      </button>
                    ) : locked ? (
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-not-allowed border border-white/20 px-3 py-2 font-mono text-[10px] font-black uppercase text-white/50"
                        data-testid={`button-locked-${item.id}`}
                      >
                        {t('sleeve.locked.visualizer')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => {
                          buyCardCosmetic(item.id);
                          onPlay?.('purchase');
                        }}
                        className="w-full border border-fuchsia-200/50 bg-fuchsia-300/10 px-3 py-2 font-mono text-[10px] font-black uppercase text-fuchsia-100 transition-all hover:bg-fuchsia-300/20 active:scale-[0.97] disabled:opacity-35 disabled:active:scale-100"
                        data-testid={`button-buy-${item.id}`}
                      >
                        {t('sleeve.buy', { cost: item.cost })}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
