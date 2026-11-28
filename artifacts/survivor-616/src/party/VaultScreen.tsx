/**
 * The Party vault, laid out as a shelf: every cosmetic Lok Party can drop sits in its slot on a row for
 * its kind, lit when you own it and a dark silhouette when you do not. Below the shelf are your shards.
 * Tap a shard to forge it into a permanent unlock (costs dust), break it for dust, or pick three to
 * reroll into a guaranteed unlock you do not own yet.
 */

import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { press } from './press';
import {
  COSMETICS_BY_ID,
  DISENCHANT_DUST,
  FORGE_DUST,
  PARTY_COSMETICS,
  REROLL_COST,
  disenchantShard,
  forgeShard,
  rerollShards,
  type CosmeticDef,
  type LokPartyMeta,
  type ShardKind,
  type ShardRarity,
} from './lokPartyMeta';

export const RARITY_COLOR: Record<ShardRarity, string> = { common: '#9fb4c8', rare: '#38f2ff', epic: '#ff3fd2', legendary: '#ffd23f' };
const KIND_ORDER: ShardKind[] = ['palette', 'hat', 'cape', 'dice-skin', 'foil-card', 'emote', 'jukebox-track'];

/** A small drawn glyph per kind; no emoji, no icon pack. */
export function KindGlyph({ kind, color, size = 34 }: { kind: ShardKind; color: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 40 40', fill: 'none', stroke: color, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, 'aria-hidden': true };
  switch (kind) {
    case 'palette':
      return (
        <svg {...common}>
          <circle cx="13" cy="15" r="6" fill={color} />
          <circle cx="27" cy="15" r="6" />
          <circle cx="20" cy="27" r="6" fill={color} fillOpacity=".4" />
        </svg>
      );
    case 'hat':
      return (
        <svg {...common}>
          <path d="M6 30 L9 12 L16 22 L20 8 L24 22 L31 12 L34 30 Z" fill={color} fillOpacity=".25" />
        </svg>
      );
    case 'cape':
      return (
        <svg {...common}>
          <path d="M12 8 Q20 14 28 8 L33 32 Q20 26 7 32 Z" fill={color} fillOpacity=".25" />
        </svg>
      );
    case 'dice-skin':
      return (
        <svg {...common}>
          <rect x="7" y="7" width="26" height="26" rx="6" />
          <circle cx="15" cy="15" r="2.2" fill={color} />
          <circle cx="25" cy="25" r="2.2" fill={color} />
          <circle cx="20" cy="20" r="2.2" fill={color} />
        </svg>
      );
    case 'foil-card':
      return (
        <svg {...common}>
          <rect x="9" y="5" width="22" height="30" rx="4" fill={color} fillOpacity=".2" />
          <path d="M13 28 L27 12" />
        </svg>
      );
    case 'emote':
      return (
        <svg {...common}>
          <path d="M6 9 H34 V26 H20 L12 33 V26 H6 Z" fill={color} fillOpacity=".2" />
          <circle cx="15" cy="17" r="1.8" fill={color} />
          <circle cx="25" cy="17" r="1.8" fill={color} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="13" />
          <circle cx="20" cy="20" r="4" fill={color} />
        </svg>
      );
  }
}

function Slot({ def, owned, name }: { def: CosmeticDef; owned: boolean; name: string }) {
  const c = RARITY_COLOR[def.rarity];
  return (
    <div
      className="flex h-[74px] w-[64px] flex-col items-center justify-center gap-1 rounded-lg border-2 text-center"
      style={{ borderColor: owned ? c : 'rgba(255,255,255,.14)', background: owned ? `${c}22` : 'rgba(0,0,0,.35)', boxShadow: owned ? `0 0 14px ${c}55` : 'none' }}
      aria-label={owned ? name : '?'}
    >
      <KindGlyph kind={def.kind} color={owned ? c : '#4b4466'} size={28} />
      <span className="px-0.5 text-[9px] font-bold leading-tight" style={{ color: owned ? '#fff' : '#6b6288' }}>
        {owned ? name : '???'}
      </span>
    </div>
  );
}

export function VaultScreen({ meta, onChange, onBack }: { meta: LokPartyMeta; onChange: (m: LokPartyMeta) => void; onBack: () => void }) {
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const owned = new Set(meta.vault.owned);
  const name = (id: string) => t(`lokParty.vault.item.${id}` as Parameters<typeof t>[0]);
  const kindName = (k: ShardKind) => t(`lokParty.vault.kind.${k}` as Parameters<typeof t>[0]);
  const ownedCount = PARTY_COSMETICS.filter((c) => owned.has(c.id)).length;
  const shards = meta.vault.shards;
  const one = selected.length === 1 ? shards.find((s) => s.uid === selected[0]) : undefined;
  const oneDef = one ? COSMETICS_BY_ID[one.cosmeticId] : undefined;
  const alreadyOwned = !!oneDef && owned.has(oneDef.id);
  const canForge = !!oneDef && !alreadyOwned && meta.vault.dust >= FORGE_DUST[oneDef.rarity];

  const toggle = (uid: string) => {
    setNote(null);
    setSelected((cur) => (cur.includes(uid) ? cur.filter((u) => u !== uid) : cur.length >= REROLL_COST ? [...cur.slice(1), uid] : [...cur, uid]));
  };
  const apply = (next: LokPartyMeta | null, msg?: string) => {
    if (!next) return;
    onChange(next);
    setSelected([]);
    if (msg) setNote(msg);
  };

  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: 'radial-gradient(ellipse at 50% 0%, #2a1d5c 0%, #07061a 70%)' }}>
      <div className="mx-auto flex min-h-full max-w-xl flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-[.3em] text-cyan-300">{t('lokParty.title')}</div>
            <h1 className="text-3xl font-black tracking-tight">{t('lokParty.vault.title')}</h1>
          </div>
          <div className="text-right text-xs">
            <div className="font-bold text-amber-200">{t('lokParty.vault.dust', { n: meta.vault.dust })}</div>
            <div className="opacity-70">{t('lokParty.vault.owned', { n: ownedCount, total: PARTY_COSMETICS.length })}</div>
          </div>
        </div>

        {/* The shelf: one plank per kind. */}
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-white/10 bg-black/30 p-3">
          {KIND_ORDER.map((kind) => {
            const items = PARTY_COSMETICS.filter((c) => c.kind === kind);
            if (!items.length) return null;
            return (
              <div key={kind}>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-white/60">{kindName(kind)}</div>
                <div className="flex flex-wrap gap-2 border-b-[6px] border-[#4a2f6e] pb-2">
                  {items.map((c) => (
                    <Slot key={c.id} def={c} owned={owned.has(c.id)} name={name(c.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Shards. */}
        <div className="rounded-2xl border-2 border-white/10 bg-black/30 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-sm font-black">{t('lokParty.vault.shards', { n: shards.length })}</div>
            <div className="text-[11px] opacity-70">{t('lokParty.vault.pickHint', { n: REROLL_COST })}</div>
          </div>
          {shards.length === 0 ? (
            <div className="py-3 text-center text-sm opacity-70">{t('lokParty.vault.empty')}</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {shards.map((sh) => {
                const def = COSMETICS_BY_ID[sh.cosmeticId];
                if (!def) return null;
                const on = selected.includes(sh.uid);
                const c = RARITY_COLOR[def.rarity];
                return (
                  <button
                    key={sh.uid}
                    type="button"
                    aria-pressed={on}
                    aria-label={name(def.id)}
                    {...press(() => toggle(sh.uid))}
                    className="flex h-[74px] w-[64px] flex-col items-center justify-center gap-1 rounded-lg border-2 active:scale-95"
                    style={{ borderColor: on ? '#ffffff' : c, background: on ? `${c}55` : `${c}1c`, boxShadow: on ? `0 0 16px ${c}` : 'none' }}
                  >
                    <KindGlyph kind={def.kind} color={c} size={28} />
                    <span className="px-0.5 text-[9px] font-bold leading-tight">{name(def.id)}</span>
                    {owned.has(def.id) ? <span className="text-[8px] font-black text-amber-200">{t('lokParty.vault.dupe')}</span> : null}
                  </button>
                );
              })}
            </div>
          )}

          {selected.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
              {one && oneDef ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canForge}
                    {...press(() => canForge && apply(forgeShard(meta, one.uid), t('lokParty.vault.forged', { name: name(oneDef.id) })))}
                    className="flex-1 rounded-xl border-[3px] px-3 py-3 text-sm font-black disabled:opacity-40"
                    style={{ background: '#ffcf3c', borderColor: '#3b2a20', color: '#3b2a20' }}
                  >
                    {alreadyOwned ? t('lokParty.vault.alreadyOwned') : t('lokParty.vault.forge', { n: FORGE_DUST[oneDef.rarity] })}
                  </button>
                  <button
                    type="button"
                    {...press(() => apply(disenchantShard(meta, one.uid), t('lokParty.vault.broke', { n: DISENCHANT_DUST[oneDef.rarity] })))}
                    className="flex-1 rounded-xl border-[3px] border-white/40 px-3 py-3 text-sm font-black"
                  >
                    {t('lokParty.vault.break', { n: DISENCHANT_DUST[oneDef.rarity] })}
                  </button>
                </div>
              ) : null}
              {selected.length === REROLL_COST ? (
                <button
                  type="button"
                  {...press(() => {
                    const r = rerollShards(meta, selected, (Date.now() ^ meta.vault.nextUid) >>> 0);
                    if (r) apply(r.meta, t('lokParty.vault.rerolled', { name: name(r.unlocked.id) }));
                    else setNote(t('lokParty.vault.rerollFail'));
                  })}
                  className="w-full rounded-xl border-[3px] border-fuchsia-300 px-3 py-3 text-sm font-black"
                  style={{ background: '#3a1450' }}
                >
                  {t('lokParty.vault.reroll', { n: REROLL_COST })}
                </button>
              ) : (
                <div className="text-center text-[11px] opacity-70">{t('lokParty.vault.rerollNeed', { n: REROLL_COST - selected.length })}</div>
              )}
            </div>
          ) : null}
          {note ? (
            <div role="status" className="mt-3 rounded-lg border border-amber-300/50 bg-amber-300/10 p-2 text-center text-sm font-bold text-amber-100">
              {note}
            </div>
          ) : null}
        </div>

        <button type="button" {...press(onBack)} className="mt-1 self-center rounded-lg border border-white/30 px-6 py-2 text-sm font-bold">
          {t('lokParty.drop.back')}
        </button>
      </div>
    </div>
  );
}
