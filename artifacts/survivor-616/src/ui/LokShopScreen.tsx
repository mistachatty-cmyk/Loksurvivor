/**
 * The LokShop: LokServer, a holographic owl host, sells LokToken unlocks and passes, runs a
 * daily feather game and keeps a Feather Charm collection. Rapport (visits + the game) opens
 * the back room. Payouts here are collectibles and rapport only, never currency, so nothing
 * needs a `hideoutRewards` cap. LokToken prices are the live shared catalog's (`priceOf`).
 */
import { ArrowLeft, Check, Lock, Palette, Stamp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  LOKSERVER_REACTIONS,
  LOKSERVER_TOPICS,
  LOKSERVER_BACKROOM_NOTES,
  LOKSHOP_STOCK,
  lokServerGreeting,
  type LokServerMood,
} from '@/game/data/lokServer';
import { LOK_SHOP_UNLOCKS, type LokShopUnlockDef } from '@/game/data/lokShopUnlocks';
import {
  FEATHER_CHARMS,
  LOK_SHOP_PERKS,
  backRoomOpen,
  haggleAttemptsPerDay,
  perkEffects,
  rapportTier,
  resolveHaggle,
  type LokShopPerkDef,
} from '@/game/data/lokShopPerks';
import { bondDayKey } from '@/game/engine/petGrowth';
import { lokServerSay } from '@/game/engine/lokServerSpeak';
import { useMeta } from '@/game/state/metaStore';
import { useT } from '@/lib/i18n';
import { LOKTOKEN_PRICE_BY_TIER, catalogSku } from '@/lib/lokStoreCatalog';
import { useLokEconomy } from '@/state/lokEconomyStore';
import { HoloOwl } from './HoloOwl';
import { SupporterBar } from './SupporterBar';
import { LokWalletStrip } from './LokWalletStrip';

const RECENT_LINES = 8;
/** Where Pass / Passport / Lifetime are managed (the Stripe checkout lives on the hub, not in the game). */
const SUPPORT_URL = 'https://gsix.online';
type Tab = 'unlocks' | 'perks' | 'charms' | 'backroom';
const pickOf = (list: readonly string[], rng: () => number) => list[Math.floor(rng() * list.length)]!;

function Feather({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 48" className="h-14 w-7" aria-hidden="true">
      <path d="M12 2 Q22 18 12 46 Q2 18 12 2 Z" fill={color} fillOpacity=".25" stroke={color} strokeWidth="1.5" />
      <path d="M12 6 L12 46" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

export function LokShopScreen({ onBack, onOpenCosmetics, onSignIn }: { onBack: () => void; onOpenCosmetics?: () => void; onSignIn?: () => void }) {
  const t = useT();
  const { meta, grantLokPetFieldGuide, grantLokPetCollectorAccess, grantLokPackVisualizer, grantTrainingWeaponRack, grantLokShopPerk, lokShopVisit, lokShopHaggle } = useMeta();
  const { signedIn, balance, ownedSkus, priceOf, spend, activeSupporterTier, supporter, setSupporterVisible } = useLokEconomy();
  const recent = useRef<string[]>([]);
  const today = bondDayKey(Date.now());
  const fx = perkEffects(activeSupporterTier);
  const tier = rapportTier(meta.lokShopRapport);

  const [tab, setTab] = useState<Tab>('unlocks');
  const [notice, setNotice] = useState<string | null>(null);
  const [mood, setMood] = useState<LokServerMood>('greet');
  const [golden, setGolden] = useState(() => Math.floor(Math.random() * 3));
  const [revealed, setRevealed] = useState<{ pick: number; win: boolean } | null>(null);
  const [line, setLine] = useState('');
  const greeted = useRef(false);

  const say = (text: string, nextMood: LokServerMood) => {
    recent.current = [...recent.current, text].slice(-RECENT_LINES);
    setLine(text);
    setMood(nextMood);
  };

  // Greet once per visit (reads the state from before today's visit is counted), then log it.
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    const g = lokServerGreeting({
      rapportTier: tier.id,
      firstVisit: meta.lokShopLastVisit === '' && meta.lokShopRapport === 0,
      stamps: meta.lokShopStamps,
      charms: meta.lokShopCharms.length,
      charmTotal: FEATHER_CHARMS.length,
      hasPassport: fx.passport,
      ownedPerks: meta.lokShopPerks.length,
    }, Math.random);
    say(g.line, g.mood);
    lokShopVisit(today, fx.passport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A purchase made on another device follows the account.
  useEffect(() => {
    for (const perk of LOK_SHOP_PERKS) if (ownedSkus.has(catalogSku(perk.kind, perk.id)) && !meta.lokShopPerks.includes(perk.id)) grantLokShopPerk(perk.id);
    if (ownedSkus.has(catalogSku('fieldGuideUnlock', 'field-guide')) && !meta.lokPetFieldGuideUnlocked) grantLokPetFieldGuide();
    if (ownedSkus.has(catalogSku('collectorAccess', 'collector-access')) && !meta.lokPetCollectorAccessUnlocked) grantLokPetCollectorAccess();
    if (ownedSkus.has(catalogSku('packVisualizerUnlock', 'lokpack-visualizer')) && !meta.lokPackVisualizerUnlocked) grantLokPackVisualizer();
    if (ownedSkus.has(catalogSku('weaponRackUnlock', 'weapon-rack')) && !meta.trainingWeaponRackOwned) grantTrainingWeaponRack();
  }, [ownedSkus, meta, grantLokShopPerk, grantLokPetFieldGuide, grantLokPetCollectorAccess, grantLokPackVisualizer, grantTrainingWeaponRack]);

  const unlockOwned = (u: LokShopUnlockDef) =>
    u.id === 'field-guide' ? meta.lokPetFieldGuideUnlocked : u.id === 'lokpack-visualizer' ? meta.lokPackVisualizerUnlocked : u.id === 'weapon-rack' ? meta.trainingWeaponRackOwned : meta.lokPetCollectorAccessUnlocked;
  const grantUnlock = (u: LokShopUnlockDef) =>
    u.id === 'field-guide' ? grantLokPetFieldGuide() : u.id === 'lokpack-visualizer' ? grantLokPackVisualizer() : u.id === 'weapon-rack' ? grantTrainingWeaponRack() : grantLokPetCollectorAccess();

  const purchase = (sku: string, name: string, fallbackPrice: number, grant: () => void) => {
    if (!signedIn) {
      setNotice(t('lokshop.signInNotice'));
      return;
    }
    void spend(sku).then((result) => {
      if (result.ok || result.error === 'already_owned') {
        grant();
        say(pickOf(LOKSERVER_REACTIONS.bought, Math.random), 'pleased');
        setNotice(t('lokshop.bought', { name }));
      } else if (result.error === 'insufficient') {
        setNotice(t('lokshop.insufficient', { n: result.need ?? fallbackPrice }));
      } else if (result.error === 'unknown_item') {
        setNotice(t('lokshop.unknownItem', { name }));
      } else {
        setNotice(t('lokshop.failed'));
      }
    });
  };

  const triesLeft = Math.max(0, haggleAttemptsPerDay(activeSupporterTier) - (meta.lokShopHaggleDay === today ? meta.lokShopHaggleCount : 0));
  const playFeather = (pick: number) => {
    if (triesLeft <= 0 || revealed) return;
    const outcome = resolveHaggle(pick, golden, meta.lokShopCharms, activeSupporterTier, Math.random);
    setRevealed({ pick, win: outcome.win });
    lokShopHaggle(today, outcome.rapport, outcome.charmId);
    if (outcome.charmId) say(pickOf(LOKSERVER_REACTIONS.charm, Math.random), 'pleased');
    else say(pickOf(outcome.win ? LOKSERVER_REACTIONS.win : LOKSERVER_REACTIONS.lose, Math.random), outcome.win ? 'pleased' : 'sly');
  };
  const nextRound = () => {
    setRevealed(null);
    setGolden(Math.floor(Math.random() * 3));
  };

  const backOpen = backRoomOpen(meta.lokShopRapport, activeSupporterTier);
  const tabs: Array<{ id: Tab; label: string }> = useMemo(() => [
    { id: 'unlocks', label: t('lokshop.tab.unlocks') },
    { id: 'perks', label: t('lokshop.tab.perks') },
    { id: 'charms', label: t('lokshop.tab.charms') },
    { id: 'backroom', label: t('lokshop.tab.backroom') },
  ], [t]);

  const priceBadge = (sku: string, tierName: 'rare' | 'legendary') => priceOf(sku) ?? LOKTOKEN_PRICE_BY_TIER[tierName]!;
  const buyLabel = (price: number) => (!signedIn ? t('lokshop.signIn', { n: price }) : (balance ?? 0) >= price ? t('lokshop.buy', { n: price }) : t('lokshop.need', { n: price }));

  const itemCard = (id: string, name: string, description: string, tierName: 'rare' | 'legendary', have: boolean, sku: string, grant: () => void) => {
    const price = priceBadge(sku, tierName);
    const cannot = signedIn && (balance ?? 0) < price;
    return (
      <li key={id} className="lokshop-card p-3" data-tier={tierName} data-testid={`lokshop-item-${id}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-black uppercase tracking-wide">{name}</p>
          <span className={`border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest ${tierName === 'legendary' ? 'border-amber-300/60 text-amber-300' : 'border-violet-300/60 text-violet-300'}`}>{tierName}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        {have ? (
          <p className="mt-2 flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300"><Check className="h-3 w-3" />{t('lokshop.owned')}</p>
        ) : (
          <button type="button" onClick={() => purchase(sku, name, price, grant)} disabled={cannot} className="mt-2 w-full border border-cyan-300/70 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-200 hover:bg-cyan-300 hover:text-black disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground/50 disabled:hover:bg-transparent" data-testid={`button-lokshop-buy-${id}`}>
            {buyLabel(price)}
          </button>
        )}
      </li>
    );
  };

  const perkOwned = (p: LokShopPerkDef) => meta.lokShopPerks.includes(p.id);

  return (
    <main className="lokshop-room min-h-screen px-4 py-6" data-testid="screen-lok-shop">
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={onBack} className="mb-4 flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground" data-testid="button-lok-shop-back">
          <ArrowLeft className="h-3 w-3" />{t('lokshop.back')}
        </button>
        <SupporterBar variant="inline" />
        <LokWalletStrip onSignIn={onSignIn} />
        <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-violet-200 [text-shadow:0_0_14px_rgba(192,132,252,.8)]">{t('lokshop.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('lokshop.subtitle')}</p>

        <section className="lokshop-holo mt-5 flex items-center gap-3 p-4" aria-live="polite">
          <HoloOwl mood={mood} />
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">LokServer · {t('lokshop.rapport', { tier: t(`lokshop.tier.${tier.id}` as never) })}{fx.passport ? ` · ${t('lokshop.stamps', { n: meta.lokShopStamps })}` : ''}</p>
            <p className="mt-1 text-sm" data-testid="lokserver-line">{line}</p>
          </div>
        </section>

        <div className="mt-3 flex flex-wrap gap-2">
          {LOKSERVER_TOPICS.map((topic) => (
            <button key={topic.id} type="button" onClick={() => say(lokServerSay(topic.id, Math.random, recent.current), 'greet')} className="border border-violet-300/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide hover:bg-violet-300/15" data-testid={`button-lokserver-topic-${topic.id}`}>
              {t(topic.labelKey as never)}
            </button>
          ))}
        </div>

        {notice ? <p className="mt-4 border border-cyan-300/50 bg-cyan-300/10 p-2 text-xs" role="status" data-testid="lokshop-notice">{notice}</p> : null}

        <div className="mt-5 flex border-b border-violet-300/30" role="tablist">
          {tabs.map((entry) => (
            <button key={entry.id} type="button" role="tab" aria-selected={tab === entry.id} onClick={() => setTab(entry.id)} className={`flex-1 px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-widest ${tab === entry.id ? 'border-b-2 border-cyan-300 text-cyan-200' : 'text-muted-foreground hover:text-foreground'}`} data-testid={`tab-lokshop-${entry.id}`}>
              {entry.id === 'backroom' && !backOpen ? <Lock className="mr-1 inline h-3 w-3" /> : null}{entry.label}
            </button>
          ))}
        </div>

        {tab === 'unlocks' ? (
          <ul className="mt-3 grid gap-2">
            {LOK_SHOP_UNLOCKS.map((u) => itemCard(u.id, u.id === 'weapon-rack' ? t('training.shop.name') : u.name, u.id === 'weapon-rack' ? t('training.shop.description') : u.description, u.tier, unlockOwned(u), catalogSku(u.kind, u.id), () => grantUnlock(u)))}
            {onOpenCosmetics ? (
              <li>
                <button type="button" onClick={onOpenCosmetics} className="lokshop-card flex w-full items-center gap-3 p-3 text-left" data-testid="button-lokshop-cosmetics">
                  <Palette className="h-5 w-5 shrink-0 text-cyan-300" />
                  <span><span className="block text-sm font-black">{t('lokshop.cosmetics')}</span><span className="block text-xs text-muted-foreground">{t('lokshop.cosmeticsBlurb')}</span></span>
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}

        {tab === 'perks' ? (
          <div className="mt-3 grid gap-2">
          <section className="lokshop-holo p-4" data-testid="lokshop-supporter-panel">
            <h2 className="text-sm font-black uppercase tracking-wide">{t('lokshop.support.title')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('lokshop.support.blurb')}</p>
            <p className={`mt-2 font-mono text-[11px] font-bold uppercase tracking-widest ${supporter?.tier === 'lifetime' ? 'text-amber-300' : 'text-teal-300'}`} data-testid="lokshop-supporter-status">
              {supporter
                ? `${t(`lokshop.support.tier.${supporter.tier}` as never)}${supporter.founder ? ` · ${t('lokshop.support.founder')}` : ''}${activeSupporterTier ? '' : ` · ${t('lokshop.support.lapsed')}`}`
                : t('lokshop.support.none')}
            </p>
            {supporter ? (
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={supporter.showPublic} onChange={(e) => void setSupporterVisible(e.target.checked)} data-testid="toggle-supporter-public" />
                {t('lokshop.support.showMe')}
              </label>
            ) : null}
            <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="mt-3 block border border-teal-300/70 px-3 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-teal-200 hover:bg-teal-300 hover:text-black" data-testid="link-lokshop-support">
              {t('lokshop.support.manage')}
            </a>
          </section>
          <ul className="grid gap-2">
            {LOK_SHOP_PERKS.map((p) => itemCard(p.id, p.name, p.description, p.tier, perkOwned(p), catalogSku(p.kind, p.id), () => grantLokShopPerk(p.id)))}
          </ul>
          </div>
        ) : null}

        {tab === 'charms' ? (
          <div className="mt-3 grid gap-3">
            <section className="lokshop-holo p-4">
              <h2 className="text-sm font-black uppercase tracking-wide">{t('lokshop.game.title')}</h2>
              <p className="text-xs text-muted-foreground">{t('lokshop.game.blurb')}</p>
              <div className="mt-3 flex justify-center gap-6">
                {[0, 1, 2].map((slot) => (
                  <button key={slot} type="button" onClick={() => playFeather(slot)} disabled={triesLeft <= 0 || revealed !== null} className="lokshop-feather flex flex-col items-center gap-1 disabled:opacity-60" data-testid={`button-lokshop-feather-${slot}`} aria-label={`${t('lokshop.game.title')} ${slot + 1}`}>
                    <Feather color={revealed && slot === golden ? '#fde047' : revealed && slot === revealed.pick ? '#94a3b8' : '#c084fc'} />
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-cyan-300">
                <span>{triesLeft > 0 ? t('lokshop.game.tries', { n: triesLeft }) : t('lokshop.game.none')}</span>
                {revealed && triesLeft > 0 ? <button type="button" onClick={nextRound} className="border border-cyan-300/60 px-2 py-1" data-testid="button-lokshop-next-round">Again</button> : null}
              </div>
            </section>
            <section>
              <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground"><Stamp className="h-3 w-3" />{t('lokshop.charms.title')} · {t('lokshop.charms.count', { n: meta.lokShopCharms.length, total: FEATHER_CHARMS.length })}</h2>
              <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {FEATHER_CHARMS.map((c) => {
                  const have = meta.lokShopCharms.includes(c.id);
                  return (
                    <li key={c.id} className="lokshop-card flex flex-col items-center p-3 text-center" data-testid={`lokshop-charm-${c.id}`}>
                      <div className={have ? '' : 'opacity-25 grayscale'}><Feather color={c.color} /></div>
                      <p className="mt-1 text-xs font-black">{have ? c.name : '???'}</p>
                      <p className="text-[10px] text-muted-foreground">{have ? c.blurb : t('lokshop.charms.missing')}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        ) : null}

        {tab === 'backroom' ? (
          backOpen ? (
            <section className="lokshop-holo mt-3 p-4">
              <p className="text-xs text-muted-foreground">{t('lokshop.back.body')}</p>
              <ul className="mt-3 grid gap-2">
                {LOKSERVER_BACKROOM_NOTES.filter((note) => note.tier <= tier.index || fx.pass).map((note) => (
                  <li key={note.text} className="lokshop-card p-3 text-xs italic" data-testid="lokshop-backroom-note">“{note.text}”</li>
                ))}
              </ul>
              {LOKSHOP_STOCK.length > 0 ? (
                <ul className="mt-3 grid gap-2">
                  {LOKSHOP_STOCK.map((item) => (
                    <li key={item.id} className="lokshop-card flex items-start justify-between gap-3 p-3" data-testid={`lokshop-item-soon-${item.id}`}>
                      <div>
                        <p className="text-sm font-black">{t(item.nameKey as never)}</p>
                        <p className="text-xs text-muted-foreground">{t(item.blurbKey as never)}</p>
                      </div>
                      <p className="shrink-0 text-[10px] uppercase tracking-wide text-amber-300">{t(`lokshop.status.${item.status}` as never)}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : (
            <p className="lokshop-holo mt-3 p-4 text-sm text-muted-foreground" data-testid="lokshop-backroom-locked">{t('lokshop.back.locked')}</p>
          )
        ) : null}
      </div>
    </main>
  );
}
