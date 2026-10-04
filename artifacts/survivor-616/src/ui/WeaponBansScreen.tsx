/**
 * Studio 28's weapon-bans console -- a dedicated, additive screen for
 * marking weapons active/banned for future runs. First pass of Studio 28's
 * in-game function (more features later); scoped to weapons only.
 *
 * Data/state usage is modeled directly on ThreatMatrixScreen.tsx's weapons
 * section (meta.disabledWeaponIds, WEAPONS, toggleWeaponDisabled, and the
 * "at least one weapon must remain active" guard) -- do not relax that
 * invariant. ThreatMatrixScreen.tsx itself is untouched; this is a separate
 * screen, not a replacement.
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, Search, XCircle } from 'lucide-react';
import { WEAPONS } from '@/game/data/weapons';
import { useMeta } from '@/game/state/metaStore';
import { ScreenLayout } from './ScreenLayout';
import { WeaponIcon } from './WeaponIcon';

export interface WeaponBansScreenProps {
  onBack: () => void;
}

export function WeaponBansScreen({ onBack }: WeaponBansScreenProps) {
  const { meta, toggleWeaponDisabled } = useMeta();

  const disabledWeaponIds = useMemo(() => new Set(meta.disabledWeaponIds ?? []), [meta.disabledWeaponIds]);
  const activeWeaponsCount = WEAPONS.length - disabledWeaponIds.size;

  // Same invariant as ThreatMatrixScreen: never let the last active weapon
  // be banned, or a run would have nothing to spawn with.
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [query, setQuery] = useState('');

  // One chip per weapon kind that actually exists, so a new kind added to the
  // data shows up here without touching this screen.
  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const weapon of WEAPONS) counts.set(weapon.kind, (counts.get(weapon.kind) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  const visibleWeapons = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return WEAPONS.filter((weapon) => {
      if (kindFilter !== 'all' && weapon.kind !== kindFilter) return false;
      const banned = disabledWeaponIds.has(weapon.id);
      if (statusFilter === 'active' && banned) return false;
      if (statusFilter === 'banned' && !banned) return false;
      if (needle && !`${weapon.name} ${weapon.kind} ${weapon.description}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [kindFilter, statusFilter, query, disabledWeaponIds]);

  const filtersActive = kindFilter !== 'all' || statusFilter !== 'all' || query.trim() !== '';

  const enableAllShown = () => {
    for (const weapon of visibleWeapons) if (disabledWeaponIds.has(weapon.id)) toggleWeaponDisabled(weapon.id);
  };

  // Banning in bulk still keeps at least one weapon lit.
  const banAllShown = () => {
    let remaining = activeWeaponsCount;
    for (const weapon of visibleWeapons) {
      if (remaining <= 1) break;
      if (!disabledWeaponIds.has(weapon.id)) {
        toggleWeaponDisabled(weapon.id);
        remaining -= 1;
      }
    }
  };

  const handleToggleWeapon = (weaponId: string) => {
    if (!disabledWeaponIds.has(weaponId) && activeWeaponsCount <= 1) {
      return;
    }
    toggleWeaponDisabled(weaponId);
  };

  return (
    <ScreenLayout
      title="Studio 28"
      subtitle="Tonight's Show"
      backdrop="art/street.jpeg"
      onBack={onBack}
      action={
        <div className="rounded border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 text-right font-mono">
          <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">On the Bill</span>
          <span className="block text-xl font-black text-amber-200">
            {activeWeaponsCount} / {WEAPONS.length}
          </span>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 shadow-lg">
          <p className="text-sm text-white/70 leading-relaxed">
            The booth never went dark, not even the night everyone on this block still calls
            the eclipse. It still runs its own show, and the projectionist still decides what
            makes tonight's reel. Flip a weapon off here and it stays out of the lobby until
            you flip it back — every run you start after this pulls from whatever's still lit
            below.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-black/40 p-3.5" data-testid="weapon-ban-filters">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 min-w-48 flex-1 items-center gap-2 border border-white/15 bg-black/30 px-3 focus-within:border-amber-400/60">
              <Search className="h-4 w-4 text-white/40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search weapons"
                aria-label="Search weapons"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                data-testid="input-weapon-ban-search"
              />
            </label>
            <div className="flex items-center rounded border border-white/20 bg-black/40 p-0.5 font-mono text-[10px] uppercase" role="group" aria-label="Status filter">
              {(['all', 'active', 'banned'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  aria-pressed={statusFilter === status}
                  className={`rounded px-2.5 py-1 font-bold transition-colors ${statusFilter === status ? 'bg-amber-400 text-black' : 'text-white/60 hover:text-white'}`}
                  data-testid={`filter-weapon-status-${status}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Weapon type filter">
            {[['all', WEAPONS.length] as [string, number], ...kindCounts].map(([kind, count]) => (
              <button
                key={kind}
                type="button"
                onClick={() => setKindFilter(kind)}
                aria-pressed={kindFilter === kind}
                className={`shrink-0 snap-start whitespace-nowrap border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  kindFilter === kind ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white'
                }`}
                data-testid={`filter-weapon-kind-${kind}`}
              >
                {kind} ({count})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
            <span className="text-white/50" data-testid="weapon-ban-shown-count">
              Showing {visibleWeapons.length} of {WEAPONS.length}
            </span>
            <button type="button" onClick={enableAllShown} className="border border-emerald-400/40 px-2 py-1 font-bold text-emerald-300 hover:bg-emerald-400/10" data-testid="button-weapon-ban-enable-shown">
              Activate shown
            </button>
            <button type="button" onClick={banAllShown} className="border border-rose-400/40 px-2 py-1 font-bold text-rose-300 hover:bg-rose-400/10" data-testid="button-weapon-ban-ban-shown">
              Ban shown
            </button>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setKindFilter('all');
                  setStatusFilter('all');
                  setQuery('');
                }}
                className="ml-auto border border-white/20 px-2 py-1 font-bold text-white/70 hover:text-white"
                data-testid="button-weapon-ban-clear-filters"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {visibleWeapons.length === 0 && (
          <div className="grid min-h-32 place-items-center border border-dashed border-white/15 text-center text-xs uppercase tracking-widest text-white/35">
            No weapons match these filters.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleWeapons.map((weapon) => {
            const isBanned = disabledWeaponIds.has(weapon.id);
            const isLastActive = !isBanned && activeWeaponsCount <= 1;

            return (
              <div
                key={weapon.id}
                className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                  isBanned
                    ? 'border-rose-500/30 bg-rose-950/15 opacity-75'
                    : 'border-white/10 bg-black/40 hover:border-amber-500/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <WeaponIcon weaponId={weapon.id} kind={weapon.kind} color={weapon.color} size={40} />
                  <div className="min-w-0">
                    <h5 className={`font-bold text-sm ${isBanned ? 'text-rose-200 line-through' : 'text-white'}`}>
                      {weapon.name}
                    </h5>
                    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-300">
                      {weapon.kind}
                    </span>
                    <p className="mt-1.5 text-xs text-white/60 leading-relaxed">{weapon.description}</p>
                  </div>
                </div>

                <div className="mt-3 border-t border-white/5 pt-2.5 flex items-center justify-between">
                  <span
                    className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                      isBanned ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {isBanned ? 'Banned' : 'Active'}
                  </span>

                  <button
                    type="button"
                    disabled={isLastActive}
                    onClick={() => handleToggleWeapon(weapon.id)}
                    title={isLastActive ? 'At least one weapon must remain active' : isBanned ? 'Activate' : 'Ban'}
                    aria-pressed={!isBanned}
                    aria-label={isBanned ? `Activate ${weapon.name}` : `Ban ${weapon.name}`}
                    data-testid={`toggle-weapon-ban-${weapon.id}`}
                    className={`transition-opacity ${isLastActive ? 'cursor-not-allowed opacity-30' : 'hover:opacity-80'}`}
                  >
                    {isBanned ? (
                      <XCircle className="h-7 w-7 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScreenLayout>
  );
}

export default WeaponBansScreen;
