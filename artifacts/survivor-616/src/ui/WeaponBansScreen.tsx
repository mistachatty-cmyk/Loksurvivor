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
import { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {WEAPONS.map((weapon) => {
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
