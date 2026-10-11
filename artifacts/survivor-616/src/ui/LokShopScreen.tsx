/**
 * The LokShop: LokServer, an owl-flavored digital host, talks about the world and shows
 * the shelf (`LOKSHOP_STOCK`). Nothing is for sale yet; the shelf previews what is coming.
 */
import { ArrowLeft, Check, Palette } from 'lucide-react';
import { useRef, useState } from 'react';

import { LOKSERVER_TOPICS, LOKSHOP_STOCK } from '@/game/data/lokServer';
import { LOK_SHOP_UNLOCKS, type LokShopUnlockDef } from '@/game/data/lokShopUnlocks';
import { lokServerSay } from '@/game/engine/lokServerSpeak';
import { useMeta } from '@/game/state/metaStore';
import { useT } from '@/lib/i18n';
import { LOKTOKEN_PRICE_BY_TIER, catalogSku } from '@/lib/lokStoreCatalog';
import { useLokEconomy } from '@/state/lokEconomyStore';

const RECENT_LINES = 8;

function OwlFace() {
  return (
    <svg viewBox="0 0 64 64" className="h-20 w-20 shrink-0" aria-hidden="true" data-testid="lokserver-face">
      <path d="M10 20 L18 8 L26 18 L38 18 L46 8 L54 20 L54 46 Q54 58 32 58 Q10 58 10 46 Z" fill="#1e1b4b" stroke="#c084fc" strokeWidth="2" />
      <circle cx="23" cy="32" r="9" fill="#0f172a" stroke="#c084fc" strokeWidth="2" />
      <circle cx="41" cy="32" r="9" fill="#0f172a" stroke="#c084fc" strokeWidth="2" />
      <circle cx="23" cy="32" r="4" fill="#fde047" />
      <circle cx="41" cy="32" r="4" fill="#fde047" />
      <path d="M32 36 L28 44 L36 44 Z" fill="#fb923c" />
    </svg>
  );
}

export function LokShopScreen({ onBack, onOpenCosmetics }: { onBack: () => void; onOpenCosmetics?: () => void }) {
  const t = useT();
  const { meta, grantLokPetFieldGuide, grantLokPetCollectorAccess, grantLokPackVisualizer } = useMeta();
  const { signedIn, balance, priceOf, spend } = useLokEconomy();
  const [notice, setNotice] = useState<string | null>(null);
  const owned = (u: LokShopUnlockDef) =>
    u.id === 'field-guide' ? meta.lokPetFieldGuideUnlocked : u.id === 'lokpack-visualizer' ? meta.lokPackVisualizerUnlocked : meta.lokPetCollectorAccessUnlocked;
  const priceFor = (u: LokShopUnlockDef) => priceOf(catalogSku(u.kind, u.id)) ?? LOKTOKEN_PRICE_BY_TIER[u.tier]!;
  const grant = (u: LokShopUnlockDef) =>
    u.id === 'field-guide' ? grantLokPetFieldGuide() : u.id === 'lokpack-visualizer' ? grantLokPackVisualizer() : grantLokPetCollectorAccess();
  const buy = (u: LokShopUnlockDef) => {
    if (owned(u)) return;
    if (!signedIn) {
      setNotice(t('lokshop.signInNotice'));
      return;
    }
    const price = priceFor(u);
    void spend(catalogSku(u.kind, u.id)).then((result) => {
      if (result.ok || result.error === 'already_owned') {
        grant(u);
        setNotice(t('lokshop.bought', { name: u.name }));
      } else if (result.error === 'insufficient') {
        setNotice(t('lokshop.insufficient', { n: result.need ?? price }));
      } else {
        setNotice(t('lokshop.failed'));
      }
    });
  };
  const recent = useRef<string[]>([]);
  const speak = (topicId: string) => {
    const line = lokServerSay(topicId, Math.random, recent.current);
    recent.current = [...recent.current, line].slice(-RECENT_LINES);
    return line;
  };
  const [line, setLine] = useState(() => speak('shop'));

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-6" data-testid="screen-lok-shop">
      <button type="button" onClick={onBack} className="mb-4 flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground" data-testid="button-lok-shop-back">
        <ArrowLeft className="h-3 w-3" />{t('lokshop.back')}
      </button>
      <h1 className="text-2xl font-black uppercase tracking-wide">{t('lokshop.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('lokshop.subtitle')}</p>

      <section className="mt-5 flex items-start gap-3 border border-border bg-black/30 p-4" aria-live="polite">
        <OwlFace />
        <p className="text-sm" data-testid="lokserver-line">{line}</p>
      </section>

      <p className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground">{t('lokshop.ask')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {LOKSERVER_TOPICS.map((topic) => (
          <button key={topic.id} type="button" onClick={() => setLine(speak(topic.id))} className="border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-white/10" data-testid={`button-lokserver-topic-${topic.id}`}>
            {t(topic.labelKey as never)}
          </button>
        ))}
      </div>

      {notice ? <p className="mt-4 border border-primary/50 bg-primary/10 p-2 text-xs" role="status" data-testid="lokshop-notice">{notice}</p> : null}

      <h2 className="mt-6 text-[11px] uppercase tracking-wide text-muted-foreground">{t('lokshop.forSale')}</h2>
      <ul className="mt-2 grid gap-2">
        {LOK_SHOP_UNLOCKS.map((u) => {
          const have = owned(u);
          const price = priceFor(u);
          const affordable = signedIn && (balance ?? 0) >= price;
          return (
            <li key={u.id} className="border border-border bg-black/20 p-3" data-testid={`lokshop-unlock-${u.id}`}>
              <p className="text-sm font-black">{u.name}</p>
              <p className="text-xs text-muted-foreground">{u.description}</p>
              {have ? (
                <p className="mt-2 flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-widest text-primary"><Check className="h-3 w-3" />{t('lokshop.owned')}</p>
              ) : (
                <button type="button" onClick={() => buy(u)} disabled={signedIn && !affordable} className="mt-2 w-full border border-primary px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground/50 disabled:hover:bg-transparent" data-testid={`button-lokshop-buy-${u.id}`}>
                  {!signedIn ? t('lokshop.signIn', { n: price }) : affordable ? t('lokshop.buy', { n: price }) : t('lokshop.need', { n: price })}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {onOpenCosmetics ? (
        <button type="button" onClick={onOpenCosmetics} className="mt-3 flex w-full items-center gap-3 border border-border bg-black/20 p-3 text-left hover:border-primary" data-testid="button-lokshop-cosmetics">
          <Palette className="h-5 w-5 shrink-0 text-primary" />
          <span><span className="block text-sm font-black">{t('lokshop.cosmetics')}</span><span className="block text-xs text-muted-foreground">{t('lokshop.cosmeticsBlurb')}</span></span>
        </button>
      ) : null}

      <h2 className="mt-6 text-[11px] uppercase tracking-wide text-muted-foreground">{t('lokshop.shelf')}</h2>
      <ul className="mt-2 grid gap-2">
        {LOKSHOP_STOCK.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 border border-border bg-black/20 p-3" data-testid={`lokshop-item-${item.id}`}>
            <div>
              <p className="text-sm font-black">{t(item.nameKey as never)}</p>
              <p className="text-xs text-muted-foreground">{t(item.blurbKey as never)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-xs text-violet-300">{t('lokshop.price', { n: item.price })}</p>
              <p className="text-[10px] uppercase tracking-wide text-amber-300">{t(`lokshop.status.${item.status}` as never)}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
