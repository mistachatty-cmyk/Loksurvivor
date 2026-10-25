import { useEffect, useMemo, useRef } from 'react';
import { Boxes, Coins, Hammer, KeyRound, PackageOpen, Sparkles } from 'lucide-react';

import { useSfxPlayer } from '@/game/audio/useSfxPlayer';
import { CRAFTING_MATERIALS } from '@/game/data/relics';
import { CARD_SHOP_PACKS_BY_ID } from '@/game/data/passiveCards';
import { CITY_RELICS_BY_ID } from '@/game/data/relics';
import { getActiveSoundPackStyle } from '@/game/data/soundPacks';
import { useMeta } from '@/game/state/metaStore';
import type { CardPackId } from '@/game/types';
import { readSeen, writeSeen, newSince, type InventoryCounts } from '@/lib/inventorySeen';
import { useT } from '@/lib/i18n';
import { PackArt } from './CardCosmetics';
import { PackOpeningReveal } from './PackOpeningReveal';
import { KEY_ITEM_DEFS, keyItemOwned } from './keyItems';
import { ScreenLayout } from './ScreenLayout';

/** Everything that is counted for the "new since last visit" chips, keyed by a stable id. */
export function inventoryCounts(meta: ReturnType<typeof useMeta>['meta']): InventoryCounts {
  const counts: InventoryCounts = {
    cred: meta.cred,
    lootTokens: meta.lootTokens,
    cardCredits: meta.cardCredits,
    skeletonKeys: meta.skeletonKeys,
    lokPetTreats: meta.lokPetTreats,
    petElixirs: meta.petElixirs,
  };
  for (const [id, qty] of Object.entries(meta.unopenedCardPacks)) counts[`pack:${id}`] = qty ?? 0;
  for (const [id, qty] of Object.entries(meta.relicMaterials ?? {})) counts[`mat:${id}`] = qty;
  for (const id of meta.ownedKeyItemIds ?? []) counts[`gear:${id}`] = 1;
  for (const id of meta.craftedRelicIds ?? []) counts[`relic:${id}`] = 1;
  return counts;
}

function NewChip({ n }: { n: number | undefined }) {
  const t = useT();
  if (!n) return null;
  return (
    <span className="rounded bg-emerald-400/20 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-emerald-200" data-testid="inventory-new-chip">
      {t('inv.new', { n: String(n) })}
    </span>
  );
}

function SectionTitle({ icon: Icon, children, aside }: { icon: typeof Boxes; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-[0.22em] text-white/85">
        <Icon className="h-4 w-4 text-fuchsia-200" aria-hidden="true" />
        {children}
      </h3>
      {aside}
    </div>
  );
}

export function InventoryPanel({ onBack, onOpenCardShop }: { onBack: () => void; onOpenCardShop?: () => void }) {
  const t = useT();
  const { meta, openStoredCardPack, openAllStoredCardPacks, setAutoOpenPacksEnabled, lastCardPackReveal, clearCardPackReveal } = useMeta();
  const sfx = useSfxPlayer(getActiveSoundPackStyle(meta.activeSoundPackId), meta.sfxEnabled);

  const counts = useMemo(() => inventoryCounts(meta), [meta]);
  // The snapshot from the last visit, read once when the screen opens so the chips stay put while you look.
  const gained = useMemo(() => newSince(counts, readSeen()), []); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = useRef(counts);
  latest.current = counts;
  useEffect(() => () => writeSeen(latest.current), []);
  // First visit sets the baseline straight away so a crash still leaves one.
  useEffect(() => { if (!readSeen()) writeSeen(counts); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stored = (Object.entries(meta.unopenedCardPacks) as [CardPackId, number][])
    .filter(([id, qty]) => (qty ?? 0) > 0 && CARD_SHOP_PACKS_BY_ID[id])
    .sort((a, b) => CARD_SHOP_PACKS_BY_ID[b[0]].cost - CARD_SHOP_PACKS_BY_ID[a[0]].cost);
  const storedTotal = stored.reduce((sum, [, qty]) => sum + qty, 0);
  const ownedGear = KEY_ITEM_DEFS.filter((item) => keyItemOwned(item.id, new Set(meta.ownedKeyItemIds ?? []), new Set(meta.craftedRelicIds ?? [])));
  const forged = (meta.craftedRelicIds ?? []).map((id) => CITY_RELICS_BY_ID[id]).filter(Boolean);
  const materials = CRAFTING_MATERIALS.filter((mat) => (meta.relicMaterials?.[mat.id] ?? 0) > 0);

  const wallet: { id: string; label: string; value: number }[] = [
    { id: 'cred', label: t('inv.cred'), value: meta.cred },
    { id: 'lootTokens', label: t('inv.lootTokens'), value: meta.lootTokens },
    { id: 'cardCredits', label: t('inv.cardCredits'), value: meta.cardCredits },
    { id: 'skeletonKeys', label: t('inv.skeletonKeys'), value: meta.skeletonKeys },
    { id: 'lokPetTreats', label: t('inv.treats'), value: meta.lokPetTreats },
    { id: 'petElixirs', label: t('inv.elixirs'), value: meta.petElixirs },
  ];

  const revealPack = lastCardPackReveal ? CARD_SHOP_PACKS_BY_ID[lastCardPackReveal.packId] : null;
  const moreOfRevealed = lastCardPackReveal ? (meta.unopenedCardPacks[lastCardPackReveal.packId] ?? 0) : 0;

  return (
    <ScreenLayout title={t('inv.title')} subtitle={t('inv.subtitle')} onBack={onBack}>
      <div className="space-y-8" data-testid="section-inventory">
        {/* Sealed packs: stacked by kind, opened right here. */}
        <section data-testid="section-inventory-packs">
          <SectionTitle
            icon={PackageOpen}
            aside={
              storedTotal > 1 ? (
                <button
                  type="button"
                  onClick={() => { openAllStoredCardPacks(); sfx.play('cardPack'); }}
                  className="border border-fuchsia-200/60 bg-fuchsia-300/10 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-widest text-fuchsia-100 active:scale-[0.97]"
                  data-testid="button-inventory-open-all"
                >
                  {t('inv.openAll', { n: String(Math.min(storedTotal, 10)) })}
                </button>
              ) : null
            }
          >
            {t('inv.packs')} {storedTotal > 0 ? `· ${storedTotal}` : ''}
          </SectionTitle>
          {stored.length === 0 ? (
            <div className="border border-dashed border-white/20 p-5 text-sm text-white/55">
              <p>{t('inv.packsEmpty')}</p>
              {onOpenCardShop ? (
                <button type="button" onClick={onOpenCardShop} className="mt-3 border border-white/25 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-widest text-white/80 hover:text-white" data-testid="button-inventory-to-shop">
                  {t('inv.toShop')}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {stored.map(([packId, qty]) => {
                const pack = CARD_SHOP_PACKS_BY_ID[packId];
                return (
                  <article key={packId} className="relative flex flex-col gap-2 border border-fuchsia-200/30 bg-fuchsia-300/[.04] p-3" data-testid={`inventory-pack-${packId}`}>
                    {meta.selectedPackSkin !== 'pack-classic' ? (
                      <div className="pointer-events-none"><PackArt pack={pack} skin={meta.selectedPackSkin} motion={meta.cardMotion} maxWidth={120} /></div>
                    ) : (
                      <div className="grid h-24 place-items-center border border-fuchsia-200/30 bg-[linear-gradient(135deg,rgba(217,70,239,.22),rgba(56,189,248,.14)_55%,rgba(250,204,21,.16))]" aria-hidden="true">
                        <div className="text-center">
                          <Sparkles className="mx-auto h-5 w-5 text-fuchsia-100" />
                          <p className="mt-1 font-mono text-[10px] font-black uppercase tracking-widest text-white/80">{pack.cards === 1 ? t('inv.cardInPack') : t('inv.cardsInPack', { n: String(pack.cards) })}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-display text-xs font-black uppercase text-white">{pack.name}</p>
                      <span className="shrink-0 rounded-full border border-fuchsia-200/50 px-2 py-0.5 font-mono text-[11px] font-black text-fuchsia-100" data-testid={`inventory-pack-count-${packId}`}>×{qty}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <NewChip n={gained[`pack:${packId}`]} />
                      <button
                        type="button"
                        onClick={() => { openStoredCardPack(packId); sfx.play('cardPack'); }}
                        className="ml-auto border border-sky-300/50 bg-sky-300/10 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-widest text-sky-100 active:scale-[0.97]"
                        data-testid={`button-inventory-open-${packId}`}
                      >
                        {t('inv.open')}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <label className="mt-3 flex items-start gap-3 text-xs text-white/60">
            <input
              type="checkbox"
              checked={meta.autoOpenPacksEnabled}
              onChange={(event) => setAutoOpenPacksEnabled(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-fuchsia-300"
              data-testid="checkbox-inventory-auto-open"
            />
            <span><span className="block font-bold text-white/80">{t('inv.autoOpen')}</span>{t('inv.autoOpenBody')}</span>
          </label>
        </section>

        {/* Wallet */}
        <section data-testid="section-inventory-stash">
          <SectionTitle icon={Coins}>{t('inv.stash')}</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {wallet.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2 border border-white/12 bg-white/[.03] px-3 py-2.5">
                <span className="truncate font-mono text-[10px] font-bold uppercase tracking-wider text-white/60">{row.label}</span>
                <span className="flex items-center gap-1.5 font-mono text-sm font-black text-white">
                  <NewChip n={gained[row.id]} />
                  {row.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Materials */}
        <section data-testid="section-inventory-materials">
          <SectionTitle icon={Boxes}>{t('inv.materials')}</SectionTitle>
          {materials.length === 0 ? (
            <p className="text-sm text-white/50">{t('inv.materialsEmpty')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {materials.map((mat) => (
                <div key={mat.id} className="flex items-center gap-2.5 border border-white/12 bg-white/[.03] p-2.5" style={{ borderLeft: `3px solid ${mat.color}` }}>
                  <span className="text-xl" role="img" aria-label={mat.name}>{mat.icon}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-black uppercase text-white">{mat.name}</p>
                    <p className="flex items-center gap-1.5 font-mono text-xs font-bold" style={{ color: mat.color }}>
                      ×{meta.relicMaterials?.[mat.id] ?? 0}
                      <NewChip n={gained[`mat:${mat.id}`]} />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Key equipment */}
        <section data-testid="section-inventory-gear">
          <SectionTitle icon={KeyRound}>{t('inv.gear')}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {ownedGear.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.id} className="flex items-start gap-3 border border-white/12 bg-white/[.03] p-3" data-testid={`inventory-gear-${item.id}`}>
                  <div className="grid h-10 w-10 shrink-0 place-items-center border" style={{ borderColor: item.color, backgroundColor: `${item.color}18` }}>
                    <Icon className="h-5 w-5" style={{ color: item.color }} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="flex flex-wrap items-center gap-2 text-sm font-black uppercase text-white">{item.name}<NewChip n={gained[`gear:${item.id}`]} /></h4>
                    <p className="mt-1 text-xs leading-relaxed text-sky-100/80">{item.effectLabel}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Forged relics */}
        <section data-testid="section-inventory-relics">
          <SectionTitle icon={Hammer}>{t('inv.relics')}</SectionTitle>
          {forged.length === 0 ? (
            <p className="text-sm text-white/50">{t('inv.relicsEmpty')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {forged.map((relic) => (
                <span key={relic.id} className="inline-flex items-center gap-2 border border-orange-300/40 bg-orange-300/[.06] px-3 py-1.5 text-xs font-black uppercase text-orange-100">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{relic.name}
                  <NewChip n={gained[`relic:${relic.id}`]} />
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      {lastCardPackReveal && revealPack ? (
        <PackOpeningReveal
          reveal={lastCardPackReveal}
          cardCredits={moreOfRevealed > 0 ? revealPack.cost : 0}
          backId={meta.selectedCardBack}
          cardMotion={meta.cardMotion}
          sfx={sfx}
          onOpenAnother={() => openStoredCardPack(lastCardPackReveal.packId)}
          onClose={clearCardPackReveal}
        />
      ) : null}
    </ScreenLayout>
  );
}

export default InventoryPanel;

