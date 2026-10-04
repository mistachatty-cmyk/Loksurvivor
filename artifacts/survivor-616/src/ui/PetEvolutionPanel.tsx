import { Check, ChevronDown, Lock, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '@/anim/motion';
import { EVOLUTION_OVERLAY_LABELS, type EvolutionBranchDef } from '@/game/data/lokPetEvolutions';
import { lokPetSpritePalette } from '@/game/data/lokPets';
import {
  branchStatuses,
  evolutionLevelFor,
  evolutionStageOf,
  evolvedLook,
  evolvedRig,
  hasBranchToChoose,
  petEvolvedLook,
  undoTimeLeftMs,
  type EvolvedLook,
} from '@/game/engine/petEvolution';
import { petCallName } from '@/game/engine/petGrowth';
import { useMeta } from '@/game/state/metaStore';
import type { SavedLokPet } from '@/game/types';
import { RigPortrait } from '@/ui/RigPortrait';

function LookPortrait({ pet, look, size }: { pet: Pick<SavedLokPet, 'roll'>; look: EvolvedLook; size: number }) {
  return (
    <RigPortrait
      rig={evolvedRig(pet.roll.silhouette, look.overlays)}
      palette={lokPetSpritePalette(look.palette)}
      size={size}
    />
  );
}

/** What a branch's stage 2 and stage 3 forms look like for this pet, for the picker's previews. */
function previewLook(pet: SavedLokPet, branch: EvolutionBranchDef, stage: 2 | 3): EvolvedLook {
  return evolvedLook({
    variantId: pet.roll.variantId,
    family: pet.roll.family,
    name: pet.roll.name,
    palette: pet.roll.palette,
    level: evolutionLevelFor(stage, pet.starter),
    starter: pet.starter,
    branchId: branch.id,
  });
}

function formatLeft(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

type CinematicPhase = 'charge' | 'flash' | 'reveal';

/**
 * The moment a branch is chosen: a short charge-up and flash, then the new form with what
 * changed. With reduced motion it skips straight to the reveal. Always dismissible.
 */
function EvolutionCinematic({ pet, before, after, onClose }: { pet: SavedLokPet; before: EvolvedLook; after: EvolvedLook; onClose: () => void }) {
  const reduced = prefersReducedMotion();
  const [phase, setPhase] = useState<CinematicPhase>(reduced ? 'reveal' : 'charge');
  const [ring, setRing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (reduced) return undefined;
    const ringTimer = window.setTimeout(() => setRing(true), 40);
    const flashTimer = window.setTimeout(() => setPhase('flash'), 1100);
    const revealTimer = window.setTimeout(() => setPhase('reveal'), 1500);
    return () => {
      window.clearTimeout(ringTimer);
      window.clearTimeout(flashTimer);
      window.clearTimeout(revealTimer);
    };
  }, [reduced]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (phase === 'reveal') closeRef.current?.focus();
  }, [phase]);

  const name = petCallName(pet);
  const showAfter = phase === 'reveal';
  const changes: string[] = [
    ...after.overlays.map((id) => EVOLUTION_OVERLAY_LABELS[id]),
    ...(after.scale > 1 ? ['A little bigger'] : []),
    ...(after.palette.accent !== before.palette.accent || after.palette.glow !== before.palette.glow ? ['New colors'] : []),
  ];

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${name} is evolving`}
      data-testid="evolution-cinematic"
      data-phase={phase}
    >
      <div className="relative w-full max-w-sm text-center">
        <div className="relative mx-auto grid h-56 w-56 place-items-center">
          {!reduced ? (
            <>
              <span
                className="absolute inset-0 rounded-full border-2 transition-all duration-[1100ms] ease-out"
                style={{ borderColor: after.palette.glow, transform: ring ? 'scale(1.6)' : 'scale(0.4)', opacity: ring ? 0 : 0.9 }}
              />
              <span
                className="absolute inset-4 rounded-full border transition-all duration-[1100ms] delay-150 ease-out"
                style={{ borderColor: after.palette.accent, transform: ring ? 'scale(1.9)' : 'scale(0.3)', opacity: ring ? 0 : 0.8 }}
              />
            </>
          ) : null}
          <div className={`relative ${phase === 'charge' ? 'animate-pulse' : ''}`}>
            <LookPortrait pet={pet} look={showAfter ? after : before} size={192} />
          </div>
          {phase === 'flash' ? <span className="absolute -inset-8 bg-white" style={{ opacity: 0.95 }} /> : null}
        </div>

        {showAfter ? (
          <div className="mt-2" aria-live="polite">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-pink-200">{name} evolved</p>
            <h2 className="mt-1 text-2xl font-black uppercase text-white" data-testid="evolution-cinematic-title">{after.title}</h2>
            <p className="mt-1 text-xs text-white/55">{before.title} → {after.title}</p>
            {changes.length > 0 ? (
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                {changes.map((change) => (
                  <li key={change} className="border border-white/20 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-white/75">{change}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-[11px] text-white/45">You can undo this for free for 24 hours.</p>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="mt-4 min-h-11 bg-cyan-100 px-8 py-2 font-mono text-xs font-black uppercase tracking-widest text-slate-950 hover:bg-white"
              data-testid="button-evolution-close"
            >
              Nice
            </button>
          </div>
        ) : (
          <p className="mt-2 font-mono text-[10px] font-black uppercase tracking-[0.3em] text-white/60" aria-live="polite">{name} is evolving...</p>
        )}
      </div>
    </div>
  );
}

/**
 * The Evolution section of a pet's profile. Collapsed by default so the profile stays clean;
 * a small dot on the header says a path is ready to choose. Picking is always optional: no
 * pick means the natural form, exactly as before.
 */
export function PetEvolutionPanel({ pet }: { pet: SavedLokPet }) {
  const { chooseLokPetBranch, undoLokPetBranch } = useMeta();
  const [open, setOpen] = useState(false);
  const [cinematic, setCinematic] = useState<{ pet: SavedLokPet; before: EvolvedLook; after: EvolvedLook } | null>(null);
  const [notice, setNotice] = useState('');

  const stage = evolutionStageOf(pet);
  const look = petEvolvedLook(pet);
  const statuses = branchStatuses(pet);
  const nudge = hasBranchToChoose(pet);
  const undoLeft = undoTimeLeftMs(pet, Date.now());
  const chosenId = pet.evolutionPath?.branchId;

  const pick = (branch: EvolutionBranchDef) => {
    const chosenAt = Date.now();
    const before = petEvolvedLook(pet);
    const next: SavedLokPet = { ...pet, evolutionPath: { branchId: branch.id, chosenAt } };
    const after = petEvolvedLook(next);
    chooseLokPetBranch(pet.id, branch.id);
    setNotice('');
    setCinematic({ pet: next, before, after });
  };

  const undo = () => {
    undoLokPetBranch(pet.id);
    setNotice('Back to its natural form. You can choose again.');
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3" data-testid={`pet-evolution-panel-${pet.id}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        data-testid={`button-evolution-toggle-${pet.id}`}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-white">
          <Sparkles className="h-4 w-4 shrink-0 text-cyan-300" />
          <span className="truncate">Evolution · {look.title}</span>
          {nudge ? <span className="h-2 w-2 shrink-0 rounded-full bg-pink-400" title="A path is ready to choose" data-testid={`evolution-ready-dot-${pet.id}`} /> : null}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Form {stage} of 3{look.branch ? ` · ${look.branch.label}` : ' · Natural form'}
          </p>

          {stage < 2 ? (
            <p className="text-[11px] leading-relaxed text-slate-400">
              Paths open at level {evolutionLevelFor(2, pet.starter)}. Until then it keeps growing in its natural form.
            </p>
          ) : (
            <>
              <p className="text-[11px] leading-relaxed text-slate-400">
                {chosenId
                  ? 'This path shapes its later forms. Skipping a path is always fine: the natural form never goes away.'
                  : 'Pick a path to give its later forms a new name and look, or skip it and keep the natural form.'}
              </p>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
                {statuses.map(({ branch, lines, ready }) => {
                  const chosen = chosenId === branch.id;
                  return (
                    <div
                      key={branch.id}
                      className={`min-w-0 border p-2 ${chosen ? 'border-cyan-300/60 bg-cyan-300/10' : 'border-slate-800 bg-slate-900/70'}`}
                      data-testid={`evolution-branch-${branch.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex shrink-0 gap-1">
                          <div className="grid h-12 w-12 place-items-center border border-slate-800 bg-slate-950">
                            <LookPortrait pet={pet} look={previewLook(pet, branch, 2)} size={44} />
                          </div>
                          <div className="grid h-12 w-12 place-items-center border border-slate-800 bg-slate-950">
                            <LookPortrait pet={pet} look={previewLook(pet, branch, 3)} size={44} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black uppercase text-white">{branch.label}</p>
                          <p className="truncate text-[10px] text-slate-400">
                            {previewLook(pet, branch, 2).title} → {previewLook(pet, branch, 3).title}
                          </p>
                        </div>
                        {chosen ? <span className="font-mono text-[9px] font-black uppercase tracking-widest text-cyan-200">Chosen</span> : null}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">{branch.blurb}</p>
                      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {lines.map((line) => (
                          <li key={line.label} className={`inline-flex items-center gap-1 font-mono text-[10px] ${line.met ? 'text-emerald-300' : 'text-amber-200/80'}`}>
                            {line.met ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />} {line.label}
                          </li>
                        ))}
                      </ul>
                      {!chosenId ? (
                        <button
                          type="button"
                          disabled={!ready}
                          onClick={() => pick(branch)}
                          className="mt-2 min-h-9 w-full bg-cyan-100 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                          data-testid={`button-evolve-${branch.id}`}
                        >
                          {ready ? 'Take this path' : 'Not ready yet'}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {chosenId && undoLeft > 0 ? (
                <button
                  type="button"
                  onClick={undo}
                  className="min-h-9 w-full border border-slate-600 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-200 hover:border-slate-400"
                  data-testid={`button-evolution-undo-${pet.id}`}
                >
                  Undo this path · free for {formatLeft(undoLeft)}
                </button>
              ) : null}
              {chosenId && undoLeft === 0 ? (
                <p className="text-[11px] text-slate-500">The free undo window has passed. Re-picking with an Evolution Core arrives with the Tower.</p>
              ) : null}
            </>
          )}
          <p className="min-h-[1em] text-[11px] text-cyan-200" role="status" data-testid={`evolution-notice-${pet.id}`}>{notice}</p>
        </div>
      ) : null}

      {cinematic ? <EvolutionCinematic pet={cinematic.pet} before={cinematic.before} after={cinematic.after} onClose={() => setCinematic(null)} /> : null}
    </div>
  );
}
