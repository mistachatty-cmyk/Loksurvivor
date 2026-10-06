import { useState } from 'react';
import { BookOpen, LockKeyhole, Search, ShieldCheck, Waves } from 'lucide-react';
import { GRPD_BLUEPRINTS, GRPD_KILLS_PER_SEAL, GRPD_MAX_SPAWN_MULTIPLIER, grpdAvailableSeals, grpdEarnedSeals, grpdNextTierCost, grpdOfferWeight, isGrpdPlayableWeapon } from '@/game/data/grpdArmory';
import { WEAPONS } from '@/game/data/weapons';
import { ALL_WEAPON_DEFS } from '@/game/data/weaponPixelModels';
import { useMeta } from '@/game/state/metaStore';
import { ScreenLayout } from './ScreenLayout';
import { WeaponIcon } from './WeaponIcon';
import { RigPortrait } from './RigPortrait';
import { LorePopup } from './LorePopup';
import { LUVITNOT_KEEPER } from '@/game/data/npcCast';

const FIELD_WEAPONS = WEAPONS.filter((weapon) => !isGrpdPlayableWeapon(weapon.id));
const FIELD_IDS = new Set(WEAPONS.map((weapon) => weapon.id));
const SPECIAL_WEAPONS = ALL_WEAPON_DEFS.filter((weapon) => !FIELD_IDS.has(weapon.id));

export function GrpdArmoryScreen({ onBack }: { onBack: () => void }) {
  const { meta, unlockGrpdWeapon, toggleGrpdWeapon, buyGrpdSpawnTier, setGrpdAutoIncreaseEnabled, setGrpdArmoryAnchor, toggleWeaponDisabled } = useMeta();
  const [tab, setTab] = useState<'archive' | 'field' | 'special'>('archive');
  const [query, setQuery] = useState('');
  const [showKeeperLore, setShowKeeperLore] = useState(false);
  const seals = grpdAvailableSeals(meta.totalKills, meta.grpdSpentSeals);
  const milestones = grpdEarnedSeals(meta.totalKills);
  const nextKillGoal = (milestones + 1) * GRPD_KILLS_PER_SEAL;
  const activeFieldCount = FIELD_WEAPONS.filter((weapon) => !meta.disabledWeaponIds.includes(weapon.id)).length;
  const needle = query.trim().toLowerCase();
  const blueprints = GRPD_BLUEPRINTS.filter((entry) => `${entry.name} ${entry.description} ${entry.source}`.toLowerCase().includes(needle));
  const field = FIELD_WEAPONS.filter((entry) => `${entry.name} ${entry.description} ${entry.kind}`.toLowerCase().includes(needle));
  const special = SPECIAL_WEAPONS.filter((entry) => `${entry.name} ${entry.description} ${entry.kind}`.toLowerCase().includes(needle));

  return (
    <ScreenLayout title="GRPD Armory" subtitle={meta.grpdArmoryAnchor === 'station' ? 'Division St. · Evidence archive' : 'Hideout · Relocated evidence archive'} backdrop="art/street.jpeg" onBack={onBack}
      action={<div className="border border-sky-300/40 bg-sky-950/60 px-4 py-2 text-right font-mono"><span className="block text-[10px] uppercase tracking-widest text-sky-200">Evidence seals</span><strong className="text-2xl text-white" data-testid="grpd-seals">{seals}</strong></div>}>
      <div className="max-w-7xl space-y-5">
        <section className="flex flex-wrap items-center gap-4 border border-amber-200/50 bg-gradient-to-r from-slate-950/95 via-sky-950/90 to-slate-950/95 p-4" data-testid="grpd-luvitnot-keeper">
          <div className="grid h-36 w-36 shrink-0 place-items-center border border-amber-200/50 bg-sky-950/70 shadow-[0_0_28px_rgba(125,211,252,.2)]" data-testid="portrait-luvitnot-keeper">
            <RigPortrait rig={LUVITNOT_KEEPER.rig} palette={LUVITNOT_KEEPER.palette} size={132} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200">Eclipse-born · Keeper of the sealed shelves</p>
            <h2 className="text-2xl font-black text-white">The Luvitnot Keeper</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-sky-100/75">Water, spirit, data, and energy hold a humanlike shape inside a white suit trimmed in gold. Its glass helmet and sealed suit protect visitors from the raw current. The keeper guards the archive and hums with its Luvitnot kin when the whole Armory must move.</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-200" aria-live="polite" data-testid="grpd-armory-anchor">Current anchor: {meta.grpdArmoryAnchor === 'station' ? 'GRPD Station' : 'Hideout main floor'}</p>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => setGrpdArmoryAnchor(meta.grpdArmoryAnchor === 'station' ? 'hideout' : 'station')} className="flex min-h-10 items-center justify-center gap-2 border border-emerald-200/60 bg-emerald-900/30 px-3 font-mono text-xs font-bold uppercase text-emerald-100 hover:bg-emerald-900/50" data-testid="button-shift-grpd-armory"><Waves size={16} /> {meta.grpdArmoryAnchor === 'station' ? 'Hum shift to hideout' : 'Return to station'}</button>
            <button type="button" onClick={() => setShowKeeperLore(true)} className="flex min-h-10 items-center justify-center gap-2 border border-amber-200/40 px-3 font-mono text-xs font-bold uppercase text-amber-100 hover:bg-amber-200/10" data-testid="button-luvitnot-lore"><BookOpen size={16} /> Keeper lore</button>
          </div>
        </section>
        <section className="border border-sky-300/25 bg-slate-950/70 p-4 sm:p-5">
          <p className="text-sm text-slate-200">Recovered designs stay in the evidence archive until fabricated. A fabricated weapon starts <strong>off</strong>; switch it on to let future runs offer it. Your existing field weapons stay available and can be managed here too.</p>
          <div className="mt-3 grid gap-2 font-mono text-xs text-sky-100 sm:grid-cols-3">
            <span>{meta.totalKills.toLocaleString()} lifetime kills · next seal at {nextKillGoal.toLocaleString()}</span>
            <span>Each {GRPD_KILLS_PER_SEAL.toLocaleString()} kills: +0.01 relative offer weight when enabled</span>
            <span>Purchased tier: 1× to {GRPD_MAX_SPAWN_MULTIPLIER}× per weapon</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Evidence seals come only from lifetime kill milestones. Fabricating a ready prototype costs 1 seal. Buying 2×, 3×, 4×, and 5× costs 1, 2, 3, and 4 seals respectively. Modifiers affect offer frequency, not weapon damage.</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-white/15 bg-black/35 p-3">
            <div><h2 className="text-sm font-bold text-white">Automatic kill increase</h2><p className="text-xs text-slate-300">Apply the +0.01 bonus for each 1,000 lifetime kills to active archive weapons. Off removes the kill bonus while keeping purchased tiers. On recalculates it from your current lifetime kills.</p></div>
            <button type="button" role="switch" aria-checked={meta.grpdAutoIncreaseEnabled} onClick={() => setGrpdAutoIncreaseEnabled(!meta.grpdAutoIncreaseEnabled)} className={`min-h-10 min-w-20 border px-3 text-xs font-black uppercase ${meta.grpdAutoIncreaseEnabled ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100' : 'border-white/30 bg-slate-800 text-white/70'}`} data-testid="grpd-auto-increase-toggle">{meta.grpdAutoIncreaseEnabled ? 'On' : 'Off'}</button>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Armory shelves" className="flex border border-white/20 bg-black/50 p-1">
            <button type="button" role="tab" aria-selected={tab === 'archive'} onClick={() => setTab('archive')} className={`px-3 py-2 text-xs font-bold uppercase ${tab === 'archive' ? 'bg-sky-300 text-slate-950' : 'text-white/70'}`} data-testid="grpd-tab-archive">Archive ({GRPD_BLUEPRINTS.length})</button>
            <button type="button" role="tab" aria-selected={tab === 'field'} onClick={() => setTab('field')} className={`px-3 py-2 text-xs font-bold uppercase ${tab === 'field' ? 'bg-sky-300 text-slate-950' : 'text-white/70'}`} data-testid="grpd-tab-field">Field issue ({FIELD_WEAPONS.length})</button>
            <button type="button" role="tab" aria-selected={tab === 'special'} onClick={() => setTab('special')} className={`px-3 py-2 text-xs font-bold uppercase ${tab === 'special' ? 'bg-sky-300 text-slate-950' : 'text-white/70'}`} data-testid="grpd-tab-special">Special issue ({SPECIAL_WEAPONS.length})</button>
          </div>
          <label className="flex min-h-10 min-w-48 flex-1 items-center gap-2 border border-white/20 bg-black/50 px-3 focus-within:border-sky-300">
            <Search size={16} aria-hidden="true" className="text-white/50" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a weapon" aria-label="Find a weapon" className="w-full bg-transparent text-sm text-white outline-none" data-testid="grpd-search" />
          </label>
        </div>

        {tab === 'archive' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="grpd-archive-grid">
          {blueprints.map((entry) => {
            const weaponId = entry.playableWeaponId;
            const unlocked = !!weaponId && meta.grpdUnlockedWeaponIds.includes(weaponId);
            const active = !!weaponId && meta.grpdActiveWeaponIds.includes(weaponId);
            const banned = !!weaponId && meta.disabledWeaponIds.includes(weaponId);
            const tier = weaponId ? meta.grpdSpawnTierByWeaponId[weaponId] ?? 1 : 1;
            const nextCost = grpdNextTierCost(tier);
            const offerBoost = grpdOfferWeight(1, meta.totalKills, tier, meta.grpdAutoIncreaseEnabled);
            return <article key={entry.id} className={`flex flex-col gap-3 border p-4 ${active && !banned ? 'border-emerald-300/50 bg-emerald-950/15' : 'border-white/15 bg-black/45'}`} data-testid={`grpd-blueprint-${entry.id}`}>
              <div className="flex gap-3">
                <div className="shrink-0 border border-white/15 bg-slate-950 p-2"><WeaponIcon weaponId={weaponId ?? entry.id} kind={entry.kind} color={entry.color} size={56} label={entry.name} /></div>
                <div><span className="font-mono text-[10px] uppercase tracking-widest text-sky-200">{entry.source} · {entry.kind}</span><h2 className="text-lg font-black text-white">{entry.name}</h2><p className="mt-1 text-xs leading-relaxed text-white/65">{entry.description}</p></div>
              </div>
              <div className="mt-auto border-t border-white/10 pt-3">
                {!weaponId ? <p className="flex items-center gap-2 text-xs font-bold text-amber-200"><LockKeyhole size={14} /> Sealed blueprint · combat design pending</p>
                  : !unlocked ? <div><p className="mb-2 text-xs text-sky-100">Field prototype: {WEAPONS.find((weapon) => weapon.id === weaponId)?.name}. Fabrication keeps it off until you activate it.</p><button type="button" disabled={seals < 1} onClick={() => unlockGrpdWeapon(weaponId)} className="min-h-9 border border-sky-300/60 px-3 text-xs font-bold text-sky-100 disabled:opacity-40" data-testid={`grpd-unlock-${weaponId}`}>Fabricate · 1 seal</button></div>
                  : <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs"><span className={active && !banned ? 'text-emerald-300' : 'text-white/60'}>{active && !banned ? 'Active in future runs' : banned ? 'Quarantined by Studio 28' : 'Fabricated · switched off'}</span><button type="button" onClick={() => banned ? toggleWeaponDisabled(weaponId) : toggleGrpdWeapon(weaponId)} aria-pressed={active && !banned} className="min-h-9 border border-white/30 px-3 font-bold text-white" data-testid={`grpd-toggle-${weaponId}`}>{banned ? 'Clear ban' : active ? 'Switch off' : 'Switch on'}</button></div>
                    <div className="flex items-center justify-between gap-2 text-xs"><span className="text-white/60">Offer tier {tier}× · {offerBoost.toFixed(2)}× base weight</span><button type="button" disabled={tier >= GRPD_MAX_SPAWN_MULTIPLIER || seals < nextCost} onClick={() => buyGrpdSpawnTier(weaponId)} className="min-h-9 border border-amber-300/50 px-3 font-bold text-amber-100 disabled:opacity-35" data-testid={`grpd-tier-${weaponId}`}>{tier >= GRPD_MAX_SPAWN_MULTIPLIER ? 'Max tier' : `Buy ${tier + 1}× · ${nextCost} seal${nextCost === 1 ? '' : 's'}`}</button></div>
                  </div>}
              </div>
            </article>;
          })}
        </div>}

        {tab === 'field' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="grpd-field-grid">
          {field.map((weapon) => {
            const banned = meta.disabledWeaponIds.includes(weapon.id);
            const lastActive = !banned && activeFieldCount <= 1;
            return <article key={weapon.id} className="flex items-center gap-3 border border-white/15 bg-black/45 p-3">
              <WeaponIcon weaponId={weapon.id} kind={weapon.kind} color={weapon.color} size={44} label={weapon.name} />
              <div className="min-w-0 flex-1"><h2 className="font-bold text-white">{weapon.name}</h2><p className="text-xs text-white/55">{weapon.description}</p></div>
              <button type="button" disabled={lastActive} onClick={() => toggleWeaponDisabled(weapon.id)} aria-pressed={!banned} aria-label={`${banned ? 'Activate' : 'Ban'} ${weapon.name}`} className="min-h-9 min-w-16 border border-white/30 px-2 text-xs font-bold text-white disabled:opacity-30" data-testid={`grpd-field-toggle-${weapon.id}`}>{banned ? <LockKeyhole size={17} className="mx-auto" /> : <ShieldCheck size={17} className="mx-auto text-emerald-300" />}</button>
            </article>;
          })}
        </div>}

        {tab === 'special' && <div className="space-y-3">
          <p className="text-xs text-slate-300">Character, evolution, and relic weapons are indexed here. Their existing unlock rules still control when they enter a run.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="grpd-special-grid">
            {special.map((weapon) => <article key={weapon.id} className="flex items-center gap-3 border border-white/15 bg-black/45 p-3">
              <WeaponIcon weaponId={weapon.id} kind={weapon.kind} color={weapon.color} size={44} label={weapon.name} />
              <div className="min-w-0"><h2 className="font-bold text-white">{weapon.name}</h2><p className="text-xs text-white/55">{weapon.description}</p></div>
            </article>)}
          </div>
        </div>}
      </div>
      {showKeeperLore && <LorePopup onClose={() => setShowKeeperLore(false)} initialChapterId={LUVITNOT_KEEPER.loreId} />}
    </ScreenLayout>
  );
}
