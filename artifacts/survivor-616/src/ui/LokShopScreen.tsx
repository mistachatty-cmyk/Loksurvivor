/**
 * The LokShop: LokServer, an owl-flavored digital host, talks about the world and shows
 * the shelf (`LOKSHOP_STOCK`). Nothing is for sale yet; the shelf previews what is coming.
 */
import { ArrowLeft } from 'lucide-react';
import { useRef, useState } from 'react';

import { LOKSERVER_TOPICS, LOKSHOP_STOCK } from '@/game/data/lokServer';
import { lokServerSay } from '@/game/engine/lokServerSpeak';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/state/authStore';
import { useMeta } from '@/game/state/metaStore';
import { requestLokPassportPurchase, type LokPassportTier } from '@/lib/lokPassportPurchase';
import { toast } from '@/hooks/use-toast';

const PASSPORT_TIERS: { tier: LokPassportTier; name: string; blurb: string; price: string }[] = [
  { tier: 'lokPassOwned', name: 'LokPass', blurb: 'One-time purchase. Unlocks a second batch of custom Operator Forge save slots.', price: 'one-time' },
  { tier: 'lokPassportActive', name: 'Lok Passport', blurb: 'Subscription. Unlocks a larger batch of custom Operator Forge save slots while active.', price: 'subscription' },
  { tier: 'lokPassportLifetime', name: 'Lifetime Lok Passport', blurb: 'One-time purchase. Unlocks the deepest batch of custom Operator Forge save slots, for good.', price: 'one-time' },
];

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

export function LokShopScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  const { session } = useAuth();
  const { meta, setLokPassportTier } = useMeta();
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

      {session ? (
        <div className="mt-6" data-testid="section-lok-passport">
          <h2 className="text-[11px] uppercase tracking-wide text-muted-foreground">Lok Passport</h2>
          <p className="mt-1 text-xs text-muted-foreground">Unlocks more custom Operator Forge save slots on top of what play earns.</p>
          <ul className="mt-2 grid gap-2">
            {PASSPORT_TIERS.map((item) => {
              const owned = meta[item.tier];
              return (
                <li key={item.tier} className="flex items-start justify-between gap-3 border border-border bg-black/20 p-3" data-testid={`lokshop-passport-${item.tier}`}>
                  <div>
                    <p className="text-sm font-black">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.blurb}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[10px] uppercase text-violet-300">{item.price}</p>
                    <button
                      type="button"
                      disabled={owned}
                      onClick={() => {
                        const result = requestLokPassportPurchase(item.tier, meta.devModeAllUnlocks, setLokPassportTier);
                        toast({ description: result.message });
                      }}
                      className="mt-1 border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wide hover:bg-white/10 disabled:opacity-50"
                      data-testid={`button-lokshop-passport-${item.tier}`}
                    >
                      {owned ? 'Owned' : 'Get'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </main>
  );
}
