import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  BOND_RANK_BY_ID,
  PET_EPITHETS,
  PET_NAME_MAX,
  PET_NAME_SLOTS,
  bondRankFor,
  getPetNameValue,
  isNameSlotUnlocked,
  nextBondRank,
  type PetNameSlot,
} from '@/game/engine/petGrowth';
import { useMeta } from '@/game/state/metaStore';
import type { SavedLokPet } from '@/game/types';

/** Compact bond rank chip with a thin progress bar toward the next rank. */
export function PetBondBadge({ pet, className = '' }: { pet: Pick<SavedLokPet, 'id' | 'bond'>; className?: string }) {
  const rank = bondRankFor(pet.bond);
  const next = nextBondRank(pet.bond);
  const bond = Math.max(0, pet.bond ?? 0);
  const pct = next ? Math.min(100, Math.round(((bond - rank.min) / (next.min - rank.min)) * 100)) : 100;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} data-testid={`pet-bond-${pet.id}`} title={next ? `${bond}/${next.min} toward ${next.label}` : 'Fully bonded'}>
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-emerald-200">{rank.label}</span>
      <span className="h-1 w-10 overflow-hidden bg-white/15" aria-hidden="true">
        <span className="block h-full bg-emerald-300" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

function NameField({ pet, slot }: { pet: SavedLokPet; slot: PetNameSlot }) {
  const { setLokPetName } = useMeta();
  const def = PET_NAME_SLOTS.find((s) => s.id === slot)!;
  const saved = getPetNameValue(pet, slot) ?? '';
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const unlocked = isNameSlotUnlocked(pet, slot);
  const commit = () => {
    if (draft !== saved) setLokPetName(pet.id, slot, draft);
  };
  return (
    <div className="border border-white/10 bg-black/30 p-2" data-testid={`pet-name-slot-${slot}-${pet.id}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-white/60" htmlFor={`pet-name-${slot}-${pet.id}`}>{def.label}</label>
        {!unlocked ? (
          <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-amber-200/80">
            <Lock className="h-3 w-3" /> {BOND_RANK_BY_ID[def.unlockRank].label}
          </span>
        ) : null}
      </div>
      {unlocked ? (
        <>
          <input
            id={`pet-name-${slot}-${pet.id}`}
            type="text"
            value={draft}
            maxLength={PET_NAME_MAX}
            placeholder={slot === 'call' ? pet.roll.name : def.where}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') {
                commit();
                (event.target as HTMLInputElement).blur();
              }
            }}
            className="mt-1 w-full border border-pink-300/40 bg-black/60 px-1.5 py-1 text-sm font-bold text-white outline-none placeholder:font-normal placeholder:text-white/30"
            data-testid={slot === 'call' ? `input-rename-pet-${pet.id}` : `input-pet-name-${slot}-${pet.id}`}
          />
          {slot === 'epithet' ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {PET_EPITHETS.map((epithet) => (
                <button
                  key={epithet}
                  type="button"
                  onClick={() => setLokPetName(pet.id, 'epithet', epithet)}
                  className="border border-white/15 px-1.5 py-0.5 text-[10px] text-white/60 hover:border-white/50 hover:text-white"
                >
                  {epithet}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-[11px] text-white/45">Grows with your bond. {def.where}.</p>
      )}
    </div>
  );
}

/**
 * The five name slots for one pet. Collapsed by default wherever it is used, so the
 * pet card stays clean. A slot opens as the pet's bond rank grows (the starter
 * partner's call name is open from the start).
 */
export function PetNamesPanel({ pet }: { pet: SavedLokPet }) {
  return (
    <div className="mt-3 space-y-2 border-t border-white/10 pt-3" data-testid={`pet-names-panel-${pet.id}`} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-black uppercase tracking-widest text-pink-200">Names</p>
        <PetBondBadge pet={pet} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PET_NAME_SLOTS.map((slot) => <NameField key={slot.id} pet={pet} slot={slot.id} />)}
      </div>
    </div>
  );
}
