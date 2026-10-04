/**
 * Pure rules for LokPet growth: XP, levels, bond ranks and the five name slots.
 * No React, no storage, no clock (callers pass `now`), so every rule is testable.
 *
 * Design notes (see docs/lokpet-rpg-and-digi-tower-plan.md):
 * - Level thresholds are unchanged. Instead the XP *sources* are scaled by
 *   `PET_EXP_SCALE`, so nobody's existing level moves and nothing is retroactive.
 * - Bond never decreases and has a daily cap, so it rewards regular play.
 * - A pet already carrying a name keeps it and can edit it, even if the slot
 *   would not otherwise be unlocked yet.
 */

import { applyPetExp, scalePetExp } from '@/game/engine/petExpCurve';
import type { PetGrowthEntry, SavedLokPet } from '@/game/types';

/* ------------------------------ XP and levels ------------------------------ */

export { PET_EXP_SCALE, applyPetExp, getExpForLevel, petMaxLevel, scalePetExp } from '@/game/engine/petExpCurve';
export type { PetExpResult } from '@/game/engine/petExpCurve';

/** Base (unscaled) run XP: a floor for showing up, then kills, time and a clear. */
export function runPetExpBase(input: { survivedSec: number; kills: number; cleared: boolean }): number {
  return 40
    + Math.floor(Math.max(0, input.kills) / 25)
    + Math.floor(Math.max(0, input.survivedSec) / 60) * 2
    + (input.cleared ? 60 : 0);
}

/** The starter partner takes the full share of run XP; other pets that were out take 60%. */
export function runPetExp(pet: Pick<SavedLokPet, 'starter'>, base: number): number {
  return scalePetExp(base * (pet.starter === true ? 1 : 0.6));
}

/** Base XP for winning a travel encounter. Travel rewards stay win-only by design. */
export const TRAVEL_WIN_EXP_BASE = 30;

/** Base XP for a treat (it was 75 before scaling). */
export const TREAT_EXP_BASE = 75;

/* ---------------------------------- Bond ----------------------------------- */

export type BondRankId = 'stranger' | 'familiar' | 'friend' | 'partner' | 'soulbound';

export interface BondRank {
  id: BondRankId;
  label: string;
  /** Bond points needed. */
  min: number;
  order: number;
}

export const BOND_RANKS: BondRank[] = [
  { id: 'stranger', label: 'Stranger', min: 0, order: 0 },
  { id: 'familiar', label: 'Familiar', min: 15, order: 1 },
  { id: 'friend', label: 'Friend', min: 50, order: 2 },
  { id: 'partner', label: 'Partner', min: 120, order: 3 },
  { id: 'soulbound', label: 'Soulbound', min: 250, order: 4 },
];

export const BOND_RANK_BY_ID: Record<BondRankId, BondRank> = Object.fromEntries(BOND_RANKS.map((r) => [r.id, r])) as Record<BondRankId, BondRank>;

/** Bond a pet can earn per local day, so it cannot be ground out in an hour. */
export const BOND_DAILY_CAP = 12;

export type BondSource = 'run' | 'travel' | 'treat' | 'battle' | 'care' | 'event';

export const BOND_GAIN: Record<BondSource, number> = { run: 3, travel: 1, treat: 2, battle: 2, care: 2, event: 1 };

export function bondRankFor(bond: number | undefined): BondRank {
  const value = Math.max(0, bond ?? 0);
  let found = BOND_RANKS[0]!;
  for (const rank of BOND_RANKS) if (value >= rank.min) found = rank;
  return found;
}

export function nextBondRank(bond: number | undefined): BondRank | null {
  const current = bondRankFor(bond);
  return BOND_RANKS.find((r) => r.order === current.order + 1) ?? null;
}

/** Local calendar day, so the cap resets when the player's day does. */
export function bondDayKey(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface BondResult {
  bond: number;
  bondDay: string;
  bondToday: number;
  gained: number;
}

export function applyBond(pet: Pick<SavedLokPet, 'bond' | 'bondDay' | 'bondToday'>, source: BondSource, now: number): BondResult {
  const day = bondDayKey(now);
  const usedToday = pet.bondDay === day ? Math.max(0, pet.bondToday ?? 0) : 0;
  const gained = Math.max(0, Math.min(BOND_GAIN[source], BOND_DAILY_CAP - usedToday));
  return { bond: Math.max(0, pet.bond ?? 0) + gained, bondDay: day, bondToday: usedToday + gained, gained };
}

/* ---------------------------------- Names ---------------------------------- */

export type PetNameSlot = 'call' | 'battle' | 'callsYou' | 'epithet' | 'trueName';

export interface PetNameSlotDef {
  id: PetNameSlot;
  label: string;
  unlockRank: BondRankId;
  where: string;
}

export const PET_NAME_SLOTS: PetNameSlotDef[] = [
  { id: 'call', label: 'Call name', unlockRank: 'familiar', where: 'Hub, kennel, run screens and summaries' },
  { id: 'battle', label: 'Battle name', unlockRank: 'friend', where: 'Arena callouts and the battle log' },
  { id: 'callsYou', label: 'What it calls you', unlockRank: 'friend', where: 'Hideout lines and event text' },
  { id: 'epithet', label: 'Epithet', unlockRank: 'partner', where: 'Nameplate: "Maple, the Unbothered"' },
  { id: 'trueName', label: 'True name', unlockRank: 'soulbound', where: 'Its card, once Soulbound' },
];

export const PET_NAME_SLOT_BY_ID: Record<PetNameSlot, PetNameSlotDef> = Object.fromEntries(PET_NAME_SLOTS.map((s) => [s.id, s])) as Record<PetNameSlot, PetNameSlotDef>;

/** Epithets to pick from; the player can also type their own once the slot is open. */
export const PET_EPITHETS: string[] = [
  'the Unbothered', 'the Quick', 'the Loyal', 'the Loud', 'the Sleepy', 'the Brave',
  'the Curious', 'the Dramatic', 'the Steady', 'the Snack Thief', 'the Night Owl', 'the Lucky',
];

export const PET_NAME_MAX = 24;

/** Names are the player's own: strip control characters, collapse spaces, bound the length. */
export function sanitizePetName(raw: string | undefined | null, max = PET_NAME_MAX): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function getPetNameValue(pet: Pick<SavedLokPet, 'name' | 'names'>, slot: PetNameSlot): string | undefined {
  return slot === 'call' ? pet.name : pet.names?.[slot];
}

/** True when the slot is open: by bond rank, free for the starter's call name, or already holding a name. */
export function isNameSlotUnlocked(pet: Pick<SavedLokPet, 'name' | 'names' | 'bond' | 'starter'>, slot: PetNameSlot): boolean {
  if (getPetNameValue(pet, slot)) return true;
  if (slot === 'call' && pet.starter === true) return true;
  return bondRankFor(pet.bond).order >= BOND_RANK_BY_ID[PET_NAME_SLOT_BY_ID[slot].unlockRank].order;
}

/** Returns the pet with the slot set (empty clears it). A locked slot returns the pet untouched. */
export function setPetName(pet: SavedLokPet, slot: PetNameSlot, value: string): SavedLokPet {
  if (!isNameSlotUnlocked(pet, slot)) return pet;
  const clean = sanitizePetName(value);
  if (slot === 'call') return { ...pet, name: clean || undefined };
  const names = { ...(pet.names ?? {}) };
  if (clean) names[slot] = clean;
  else delete names[slot];
  return { ...pet, names: Object.keys(names).length > 0 ? names : undefined };
}

export const petCallName = (pet: Pick<SavedLokPet, 'name' | 'roll'>): string => pet.name || pet.roll.name;
export const petBattleName = (pet: Pick<SavedLokPet, 'name' | 'names' | 'roll'>): string => pet.names?.battle || petCallName(pet);
/** "Maple, the Unbothered" when an epithet is set, otherwise just the call name. */
export const petNameplate = (pet: Pick<SavedLokPet, 'name' | 'names' | 'roll'>): string =>
  pet.names?.epithet ? `${petCallName(pet)}, ${pet.names.epithet}` : petCallName(pet);

/* --------------------------------- Growing --------------------------------- */

export interface GrowInput {
  exp?: number;
  bondSource?: BondSource;
  now: number;
}

/** Applies XP and bond to a pet and returns the updated pet plus a recap line (null if nothing changed). */
export function growPet(pet: SavedLokPet, input: GrowInput): { pet: SavedLokPet; entry: PetGrowthEntry | null } {
  const xp = applyPetExp(pet, input.exp ?? 0);
  const bondResult = input.bondSource ? applyBond(pet, input.bondSource, input.now) : null;
  const expGained = Math.max(0, Math.floor(input.exp ?? 0));
  const bondGained = bondResult?.gained ?? 0;
  if (expGained <= 0 && bondGained <= 0) return { pet, entry: null };
  const next: SavedLokPet = {
    ...pet,
    level: xp.level,
    exp: xp.exp,
    ...(bondResult ? { bond: bondResult.bond, bondDay: bondResult.bondDay, bondToday: bondResult.bondToday } : {}),
  };
  const oldRank = bondRankFor(pet.bond);
  const newRank = bondRankFor(next.bond);
  const entry: PetGrowthEntry = {
    petId: pet.id,
    name: petCallName(pet),
    expGained,
    oldLevel: Math.max(1, pet.level ?? 1),
    newLevel: xp.level,
    bondGained,
    oldBondRank: oldRank.id,
    newBondRank: newRank.id,
  };
  return { pet: next, entry };
}

/**
 * Grows every pet that was out: the starter partner is always with you, plus any pet in
 * the loadout. Returns the updated roster and one recap entry per pet that changed.
 */
export function growPartyPets(
  pets: SavedLokPet[],
  loadoutIds: Iterable<string>,
  baseExp: number,
  bondSource: BondSource,
  now: number,
): { pets: SavedLokPet[]; entries: PetGrowthEntry[] } {
  const out = new Set(loadoutIds);
  const entries: PetGrowthEntry[] = [];
  const next = pets.map((pet) => {
    if (!pet.starter && !out.has(pet.id)) return pet;
    const grown = growPet(pet, { exp: runPetExp(pet, baseExp), bondSource, now });
    if (grown.entry) entries.push(grown.entry);
    return grown.pet;
  });
  return { pets: next, entries };
}

/** One short line per notable change: a level-up or a new bond rank. Empty when nothing crossed a line. */
export function growthHeadlines(entries: PetGrowthEntry[]): string[] {
  const lines: string[] = [];
  for (const e of entries) {
    if (e.newLevel > e.oldLevel) lines.push(`${e.name} reached level ${e.newLevel}`);
    if (e.newBondRank !== e.oldBondRank) lines.push(`${e.name} is now ${BOND_RANK_BY_ID[e.newBondRank].label}`);
  }
  return lines;
}
