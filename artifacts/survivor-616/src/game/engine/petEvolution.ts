/**
 * Pure rules for LokPet evolution branches. No React, no storage, no clock (callers pass
 * `now`), so every rule is testable. The branch rows live in `data/lokPetEvolutions.ts`.
 *
 * - The natural form still follows level (`getLokPetEvolutionStage`). A branch is an
 *   optional path stored as `SavedLokPet.evolutionPath`; no path means no change.
 * - A branch opens once the pet reaches its second stage and meets the branch's own
 *   requirements (bond rank, battles). Stage 3 of a branch needs nothing extra, just level.
 * - Choosing can be undone for free for 24 hours, so a misclick never costs a favorite form.
 *   After that the path is kept (re-picking with an Evolution Core arrives with the Tower).
 */

import {
  EVOLUTION_BRANCHES,
  EVOLUTION_BRANCHES_BY_ID,
  EVOLUTION_OVERLAYS,
  type EvolutionBranchDef,
} from '@/game/data/lokPetEvolutions';
import { LOKPET_VARIANTS_BY_ID, getLokPetEvolutionStage, getLokPetEvolutionTitle, lokPetRig } from '@/game/data/lokPets';
import { BOND_RANK_BY_ID, bondRankFor } from '@/game/engine/petGrowth';
import type {
  EvolutionOverlayId,
  LokPetFamily,
  LokPetPalette,
  LokPetSilhouette,
  SavedLokPet,
  SpritePart,
  SpriteRig,
} from '@/game/types';

export const EVOLUTION_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

export type EvolutionStage = 1 | 2 | 3;

type EvolvingPet = Pick<SavedLokPet, 'roll' | 'level' | 'starter' | 'bond' | 'battlesWon' | 'battlesFought' | 'evolutionPath'>;

/* -------------------------------- Branch lookup -------------------------------- */

/** A variant with its own branch rows uses only those; otherwise it gets its family's branch. */
export function branchesForVariant(variantId: string, family: LokPetFamily): EvolutionBranchDef[] {
  const specific = EVOLUTION_BRANCHES.filter((branch) => branch.appliesTo.variantIds?.includes(variantId));
  if (specific.length > 0) return specific;
  return EVOLUTION_BRANCHES.filter((branch) => !branch.appliesTo.variantIds && branch.appliesTo.family === family);
}

export function branchesForPet(pet: Pick<SavedLokPet, 'roll'>): EvolutionBranchDef[] {
  return branchesForVariant(pet.roll.variantId, pet.roll.family);
}

/** The branch a pet has actually chosen, or undefined if none (or the id no longer applies to it). */
export function chosenBranch(pet: Pick<SavedLokPet, 'roll' | 'evolutionPath'>): EvolutionBranchDef | undefined {
  const id = pet.evolutionPath?.branchId;
  if (!id) return undefined;
  return branchesForPet(pet).find((branch) => branch.id === id);
}

/** Level at which a pet reaches the given stage (the natural level rule, unchanged). */
export function evolutionLevelFor(stage: 2 | 3, starter: boolean | undefined): number {
  for (let level = 1; level <= 200; level += 1) {
    if (getLokPetEvolutionStage(level, starter === true) >= stage) return level;
  }
  return 200;
}

export function evolutionStageOf(pet: Pick<SavedLokPet, 'level' | 'starter'>): EvolutionStage {
  return getLokPetEvolutionStage(Math.max(1, pet.level ?? 1), pet.starter === true);
}

/* ------------------------------- Eligibility ------------------------------- */

export interface RequirementLine {
  label: string;
  met: boolean;
}

export interface BranchStatus {
  branch: EvolutionBranchDef;
  lines: RequirementLine[];
  /** Every line is met. */
  ready: boolean;
}

export function branchStatus(pet: EvolvingPet, branch: EvolutionBranchDef): BranchStatus {
  const lines: RequirementLine[] = [];
  const need = evolutionLevelFor(2, pet.starter);
  lines.push({ label: `Level ${need}`, met: evolutionStageOf(pet) >= 2 });
  const req = branch.requires;
  if (req.minBond) {
    lines.push({
      label: `Bond: ${BOND_RANK_BY_ID[req.minBond].label}`,
      met: bondRankFor(pet.bond).order >= BOND_RANK_BY_ID[req.minBond].order,
    });
  }
  if (req.minBattlesWon) {
    lines.push({ label: `Win ${req.minBattlesWon} battles`, met: (pet.battlesWon ?? 0) >= req.minBattlesWon });
  }
  if (req.minBattlesFought) {
    lines.push({ label: `Fight ${req.minBattlesFought} battles`, met: (pet.battlesFought ?? 0) >= req.minBattlesFought });
  }
  return { branch, lines, ready: lines.every((line) => line.met) };
}

/** Status of every branch this pet could take. */
export function branchStatuses(pet: EvolvingPet): BranchStatus[] {
  return branchesForPet(pet).map((branch) => branchStatus(pet, branch));
}

/** True when at least one branch is ready and none is chosen yet: worth a gentle nudge in the UI. */
export function hasBranchToChoose(pet: EvolvingPet): boolean {
  return !pet.evolutionPath && branchStatuses(pet).some((status) => status.ready);
}

/* ----------------------------- Choose and undo ----------------------------- */

export interface EvolutionChange {
  pet: SavedLokPet;
  ok: boolean;
  /** Why nothing changed. */
  reason?: string;
}

export function chooseBranch(pet: SavedLokPet, branchId: string, now: number): EvolutionChange {
  if (pet.evolutionPath) return { pet, ok: false, reason: 'already-chosen' };
  const branch = branchesForPet(pet).find((entry) => entry.id === branchId);
  if (!branch) return { pet, ok: false, reason: 'not-available' };
  if (!branchStatus(pet, branch).ready) return { pet, ok: false, reason: 'requirements' };
  return { pet: { ...pet, evolutionPath: { branchId: branch.id, chosenAt: now } }, ok: true };
}

export function canUndoBranch(pet: Pick<SavedLokPet, 'evolutionPath'>, now: number): boolean {
  const path = pet.evolutionPath;
  if (!path) return false;
  return now >= path.chosenAt && now - path.chosenAt <= EVOLUTION_UNDO_WINDOW_MS;
}

/** Remaining free-undo time in ms, or 0 when it has passed (or there is nothing to undo). */
export function undoTimeLeftMs(pet: Pick<SavedLokPet, 'evolutionPath'>, now: number): number {
  if (!canUndoBranch(pet, now)) return 0;
  return Math.max(0, pet.evolutionPath!.chosenAt + EVOLUTION_UNDO_WINDOW_MS - now);
}

export function undoBranch(pet: SavedLokPet, now: number): EvolutionChange {
  if (!pet.evolutionPath) return { pet, ok: false, reason: 'nothing-to-undo' };
  if (!canUndoBranch(pet, now)) return { pet, ok: false, reason: 'window-passed' };
  const { evolutionPath: _removed, ...rest } = pet;
  return { pet: rest, ok: true };
}

/** Drops a saved path that is malformed or no longer applies, so old or edited saves stay safe. */
export function normalizeEvolutionPath(pet: SavedLokPet): SavedLokPet {
  const path = pet.evolutionPath;
  if (path === undefined) return pet;
  const valid = typeof path === 'object' && path !== null
    && typeof path.branchId === 'string'
    && typeof path.chosenAt === 'number' && Number.isFinite(path.chosenAt)
    && branchesForPet(pet).some((branch) => branch.id === path.branchId);
  if (valid) return pet;
  const { evolutionPath: _removed, ...rest } = pet;
  return rest;
}

/* --------------------------------- The look --------------------------------- */

function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const value = parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Blends `a` toward `b` by `t` (0 to 1). Returns `a` unchanged when either is not a 6-digit hex. */
export function mixHex(a: string, b: string, t: number): string {
  const from = parseHex(a);
  const to = parseHex(b);
  if (!from || !to) return a;
  const k = Math.max(0, Math.min(1, t));
  const channel = (i: number) => Math.round(from[i]! + (to[i]! - from[i]!) * k);
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`;
}

export interface EvolvedLook {
  stage: EvolutionStage;
  /** Branch form title, or the natural title when there is no branch. */
  title: string;
  branch?: EvolutionBranchDef;
  palette: LokPetPalette;
  overlays: EvolutionOverlayId[];
  /** Extra size multiplier from the branch form (1 for natural forms). */
  scale: number;
}

export interface EvolvedLookInput {
  variantId: string;
  family: LokPetFamily;
  /** Fallback species name for `{name}` in branch titles (the variant's own name is used when known). */
  name: string;
  palette: LokPetPalette;
  level?: number;
  starter?: boolean;
  branchId?: string;
}

/** What a pet looks like and is called right now. Stage 1 and unbranched pets keep their natural look. */
export function evolvedLook(input: EvolvedLookInput): EvolvedLook {
  const stage = getLokPetEvolutionStage(Math.max(1, input.level ?? 1), input.starter === true);
  const natural: EvolvedLook = {
    stage,
    title: getLokPetEvolutionTitle(input.variantId, stage),
    palette: input.palette,
    overlays: [],
    scale: 1,
  };
  if (stage < 2 || !input.branchId) return natural;
  const branch = EVOLUTION_BRANCHES_BY_ID[input.branchId];
  if (!branch || !branchesForVariant(input.variantId, input.family).includes(branch)) return natural;
  const form = stage === 3 ? branch.stage3 : branch.stage2;
  let palette = input.palette;
  if (form.visual.mix) {
    const { color, amount } = form.visual.mix;
    palette = { ...palette, accent: mixHex(palette.accent, color, amount), glow: mixHex(palette.glow, color, amount) };
  }
  if (form.visual.palette) palette = { ...palette, ...form.visual.palette };
  return {
    stage,
    title: form.title.replace(/\{name\}/g, LOKPET_VARIANTS_BY_ID[input.variantId]?.name ?? input.name),
    branch,
    palette,
    overlays: form.visual.overlays ?? [],
    scale: form.visual.scale ?? 1,
  };
}

export function petEvolvedLook(pet: Pick<SavedLokPet, 'roll' | 'level' | 'starter' | 'evolutionPath'>): EvolvedLook {
  return evolvedLook({
    variantId: pet.roll.variantId,
    family: pet.roll.family,
    name: pet.roll.name,
    palette: pet.roll.palette,
    level: pet.level,
    starter: pet.starter,
    branchId: pet.evolutionPath?.branchId,
  });
}

const rigCache = new Map<string, SpriteRig>();

/**
 * The pet's rig with its overlay parts added. The result is cached per silhouette and
 * overlay set, so the sprite baker (which caches by rig identity) sees the same object
 * every frame. With no overlays it is the base rig itself.
 */
export function evolvedRig(silhouette: LokPetSilhouette, overlays: readonly EvolutionOverlayId[] | undefined): SpriteRig {
  const base = lokPetRig(silhouette);
  if (!overlays || overlays.length === 0) return base;
  const key = `${silhouette}|${overlays.join(',')}`;
  const cached = rigCache.get(key);
  if (cached) return cached;
  const extra: SpritePart[] = overlays.flatMap((id) => EVOLUTION_OVERLAYS[id]?.(base.pixelHeight) ?? []);
  const rig: SpriteRig = { ...base, parts: [...base.parts, ...extra] };
  rigCache.set(key, rig);
  return rig;
}
