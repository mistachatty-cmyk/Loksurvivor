/**
 * LokPet evolution branches, all as data.
 *
 * A pet's natural form follows its level exactly as it always has
 * (`getLokPetEvolutionStage`). A **branch** is an optional path the player can pick once
 * the pet reaches its second stage: it renames the later forms and dresses them in a
 * palette shift plus a few overlay parts. Picking nothing changes nothing.
 *
 * - Starters (Lil Llamà, Static Null, Lil Buzbèè) have their own two branches each.
 * - Every other pet gets one generic branch for its family, so the whole roster has a
 *   second path without authoring a rig per variant. A specific branch row for a variant
 *   (add `appliesTo.variantIds`) replaces the family row for that variant.
 * - Overlays are small `SpritePart` sets measured from the rig's top edge, so they sit on
 *   any silhouette. No new hand-drawn sprites.
 *
 * Add a branch or an overlay by adding a row; `lokPetEvolutions.test.ts` checks every row.
 * Rules (eligibility, choosing, undo, the evolved look) live in `engine/petEvolution.ts`.
 */

import type { BondRankId } from '@/game/engine/petGrowth';
import type { EvolutionOverlayId, LokPetFamily, LokPetPalette, SpritePart } from '@/game/types';

export interface EvolutionVisual {
  /** Exact palette colors to replace. */
  palette?: Partial<LokPetPalette>;
  /** Blend the pet's own accent and glow toward a color, so each variant keeps its identity. */
  mix?: { color: string; amount: number };
  /** Size multiplier on top of the pet's stage growth. */
  scale?: number;
  overlays?: EvolutionOverlayId[];
}

export interface EvolutionRequirement {
  minBond?: BondRankId;
  minBattlesWon?: number;
  minBattlesFought?: number;
}

export interface EvolutionFormDef {
  /** `{name}` is replaced with the pet's species name. */
  title: string;
  visual: EvolutionVisual;
}

export interface EvolutionBranchDef {
  id: string;
  label: string;
  blurb: string;
  appliesTo: { variantIds?: string[]; family?: LokPetFamily };
  /** On top of reaching the pet's second stage. */
  requires: EvolutionRequirement;
  stage2: EvolutionFormDef;
  stage3: EvolutionFormDef;
}

export const EVOLUTION_BRANCHES: EvolutionBranchDef[] = [
  /* ------------------------------- Starters -------------------------------- */
  {
    id: 'llama-heart', label: 'Heart path', blurb: 'Charm over muscle: a softer glow and a halo of its own.',
    appliesTo: { variantIds: ['lil-llama'] }, requires: { minBond: 'friend' },
    stage2: { title: 'Charm Llama', visual: { palette: { accent: '#ff9ccc', glow: '#ffe1f0' }, overlays: ['halo'] } },
    stage3: { title: 'Heartstring Matriarch', visual: { palette: { accent: '#ff9ccc', glow: '#ffe1f0' }, overlays: ['halo', 'mane'], scale: 1.06 } },
  },
  {
    id: 'llama-street', label: 'Street path', blurb: 'Tough, loud and proud of it. Plated up for the block.',
    appliesTo: { variantIds: ['lil-llama'] }, requires: { minBattlesWon: 3 },
    stage2: { title: 'Brawler Llama', visual: { palette: { bodyDark: '#2b2433', accent: '#ffb347', glow: '#ffd27a' }, overlays: ['plates'] } },
    stage3: { title: 'Alley King Llama', visual: { palette: { bodyDark: '#2b2433', accent: '#ffb347', glow: '#ffd27a' }, overlays: ['plates', 'horns'], scale: 1.08 } },
  },
  {
    id: 'null-hungry', label: 'Hungry path', blurb: 'Eats harder code and glows hotter for it.',
    appliesTo: { variantIds: ['static-null'] }, requires: { minBattlesWon: 3 },
    stage2: { title: 'Gorged Mote', visual: { palette: { accent: '#c026d3', glow: '#f0abfc' }, overlays: ['spikes'] } },
    stage3: { title: 'Null Devourer', visual: { palette: { accent: '#c026d3', glow: '#f0abfc' }, overlays: ['spikes', 'horns'], scale: 1.1 } },
  },
  {
    id: 'null-quiet', label: 'Quiet path', blurb: 'Calm, cool and surprisingly gentle.',
    appliesTo: { variantIds: ['static-null'] }, requires: { minBond: 'friend' },
    stage2: { title: 'Hush Mote', visual: { palette: { accent: '#67e8f9', glow: '#cffafe' }, overlays: ['antennae'] } },
    stage3: { title: 'Lullaby Null', visual: { palette: { accent: '#67e8f9', glow: '#cffafe' }, overlays: ['antennae', 'halo'] } },
  },
  {
    id: 'buzbee-courier', label: 'Courier path', blurb: 'Built for speed: long wings and a sleek visor.',
    appliesTo: { variantIds: ['lil-buzbee'] }, requires: { minBattlesFought: 3 },
    stage2: { title: 'Express Bee', visual: { palette: { accent: '#fffbb0' }, overlays: ['wings'] } },
    stage3: { title: 'Jetstream Buzbèè', visual: { palette: { accent: '#fffbb0' }, overlays: ['wings', 'visor'], scale: 1.05 } },
  },
  {
    id: 'buzbee-guard', label: 'Guard path', blurb: 'Hive royalty: a plated shell and a crown.',
    appliesTo: { variantIds: ['lil-buzbee'] }, requires: { minBond: 'friend' },
    stage2: { title: 'Hive Guard', visual: { overlays: ['plates'] } },
    stage3: { title: 'Crowned Buzbèè', visual: { overlays: ['plates', 'crown'], scale: 1.08 } },
  },

  /* ------------------- One generic branch per family (everyone else) ------------------- */
  {
    id: 'family-animal', label: 'Alpha path', blurb: 'Leads the pack: a thick mane and a sharper glow.',
    appliesTo: { family: 'animal' }, requires: { minBond: 'familiar' },
    stage2: { title: 'Alpha {name}', visual: { mix: { color: '#ffb347', amount: 0.4 }, overlays: ['mane'] } },
    stage3: { title: 'Apex {name}', visual: { mix: { color: '#ffb347', amount: 0.55 }, overlays: ['mane', 'plates'], scale: 1.06 } },
  },
  {
    id: 'family-ghoul', label: 'Haunt path', blurb: 'Hollow and horned, with a pale ring above.',
    appliesTo: { family: 'ghoul' }, requires: { minBond: 'familiar' },
    stage2: { title: 'Haunted {name}', visual: { mix: { color: '#c4b5fd', amount: 0.4 }, overlays: ['horns'] } },
    stage3: { title: 'Revenant {name}', visual: { mix: { color: '#c4b5fd', amount: 0.55 }, overlays: ['horns', 'halo'], scale: 1.06 } },
  },
  {
    id: 'family-bat', label: 'Storm path', blurb: 'Wide wings and a storm-lit visor.',
    appliesTo: { family: 'bat' }, requires: { minBond: 'familiar' },
    stage2: { title: 'Stormborn {name}', visual: { mix: { color: '#7dd3fc', amount: 0.4 }, overlays: ['wings'] } },
    stage3: { title: 'Tempest {name}', visual: { mix: { color: '#7dd3fc', amount: 0.55 }, overlays: ['wings', 'visor'], scale: 1.06 } },
  },
  {
    id: 'family-mote', label: 'Nova path', blurb: 'Brighter, finer and ringed in light.',
    appliesTo: { family: 'mote' }, requires: { minBond: 'familiar' },
    stage2: { title: 'Radiant {name}', visual: { mix: { color: '#fef08a', amount: 0.4 }, overlays: ['antennae'] } },
    stage3: { title: 'Nova {name}', visual: { mix: { color: '#fef08a', amount: 0.55 }, overlays: ['antennae', 'halo'], scale: 1.06 } },
  },
  {
    id: 'family-blob', label: 'Deep path', blurb: 'Spiked and crowned like something from the deep end.',
    appliesTo: { family: 'blob' }, requires: { minBond: 'familiar' },
    stage2: { title: 'Deep {name}', visual: { mix: { color: '#5eead4', amount: 0.4 }, overlays: ['spikes'] } },
    stage3: { title: 'Abyssal {name}', visual: { mix: { color: '#5eead4', amount: 0.55 }, overlays: ['spikes', 'crown'], scale: 1.06 } },
  },
  {
    id: 'family-mechanical', label: 'Overdrive path', blurb: 'Tuned up: a sensor visor and bolted-on plating.',
    appliesTo: { family: 'mechanical' }, requires: { minBond: 'familiar' },
    stage2: { title: 'Tuned {name}', visual: { mix: { color: '#fbbf24', amount: 0.4 }, overlays: ['visor'] } },
    stage3: { title: 'Overdrive {name}', visual: { mix: { color: '#fbbf24', amount: 0.55 }, overlays: ['visor', 'plates'], scale: 1.06 } },
  },
];

export const EVOLUTION_BRANCHES_BY_ID: Record<string, EvolutionBranchDef> =
  Object.fromEntries(EVOLUTION_BRANCHES.map((branch) => [branch.id, branch]));

/**
 * Overlay recipes. Each takes the rig's top edge (its `pixelHeight`) and returns parts in
 * sprite space (origin at the feet, +y up, `y` is a rectangle's bottom edge). They use the
 * existing `crest` and `aura` keys, so any rig animation that moves those keys carries
 * the overlay with it.
 */
export const EVOLUTION_OVERLAYS: Record<EvolutionOverlayId, (top: number) => SpritePart[]> = {
  halo: (top) => [
    { key: 'crest', x: -3, y: top + 2, w: 6, h: 1, color: 'accentBright', z: 12 },
    { key: 'crest', x: -4, y: top + 1, w: 1, h: 1, color: 'glow', z: 12 },
    { key: 'crest', x: 3, y: top + 1, w: 1, h: 1, color: 'glow', z: 12 },
  ],
  horns: (top) => [
    { key: 'crest', x: -4, y: top - 1, w: 1, h: 3, color: 'accent', z: 11 },
    { key: 'crest', x: 3, y: top - 1, w: 1, h: 3, color: 'accent', z: 11 },
    { key: 'crest', x: -5, y: top + 2, w: 1, h: 1, color: 'accentBright', z: 11 },
    { key: 'crest', x: 4, y: top + 2, w: 1, h: 1, color: 'accentBright', z: 11 },
  ],
  wings: (top) => [
    { key: 'aura', x: -9, y: Math.round(top * 0.45), w: 4, h: 5, color: 'glow', z: 0 },
    { key: 'aura', x: 5, y: Math.round(top * 0.45), w: 4, h: 5, color: 'glow', z: 0 },
    { key: 'aura', x: -11, y: Math.round(top * 0.45) + 3, w: 2, h: 3, color: 'accentBright', z: 0 },
    { key: 'aura', x: 9, y: Math.round(top * 0.45) + 3, w: 2, h: 3, color: 'accentBright', z: 0 },
  ],
  plates: (top) => [
    { key: 'crest', x: -5, y: Math.round(top * 0.34), w: 10, h: 1, color: 'accentBright', z: 10 },
    { key: 'crest', x: -4, y: Math.round(top * 0.34) + 3, w: 8, h: 1, color: 'accent', z: 10 },
    { key: 'crest', x: -5, y: Math.round(top * 0.34) + 1, w: 1, h: 2, color: 'ink', z: 10 },
    { key: 'crest', x: 4, y: Math.round(top * 0.34) + 1, w: 1, h: 2, color: 'ink', z: 10 },
  ],
  mane: (top) => [
    { key: 'crest', x: -6, y: top - 5, w: 3, h: 6, color: 'accent', z: 0 },
    { key: 'crest', x: 3, y: top - 5, w: 3, h: 6, color: 'accent', z: 0 },
    { key: 'crest', x: -4, y: top - 1, w: 8, h: 3, color: 'accentBright', z: 0 },
  ],
  crown: (top) => [
    { key: 'crest', x: -3, y: top + 1, w: 6, h: 1, color: 'accentBright', z: 12 },
    { key: 'crest', x: -3, y: top + 2, w: 1, h: 1, color: 'accentBright', z: 12 },
    { key: 'crest', x: 0, y: top + 2, w: 1, h: 2, color: 'accentBright', z: 12 },
    { key: 'crest', x: 2, y: top + 2, w: 1, h: 1, color: 'accentBright', z: 12 },
  ],
  antennae: (top) => [
    { key: 'crest', x: -3, y: top, w: 1, h: 4, color: 'accentBright', z: 11 },
    { key: 'crest', x: 2, y: top, w: 1, h: 4, color: 'accentBright', z: 11 },
    { key: 'crest', x: -4, y: top + 4, w: 2, h: 1, color: 'glow', z: 11 },
    { key: 'crest', x: 2, y: top + 4, w: 2, h: 1, color: 'glow', z: 11 },
  ],
  spikes: (top) => [
    { key: 'aura', x: -7, y: Math.round(top * 0.5), w: 2, h: 3, color: 'accent', z: 0 },
    { key: 'aura', x: 5, y: Math.round(top * 0.5), w: 2, h: 3, color: 'accent', z: 0 },
    { key: 'aura', x: -6, y: Math.round(top * 0.5) + 4, w: 1, h: 2, color: 'accentBright', z: 0 },
    { key: 'aura', x: 5, y: Math.round(top * 0.5) + 4, w: 1, h: 2, color: 'accentBright', z: 0 },
  ],
  visor: (top) => [
    { key: 'crest', x: -3, y: top - 4, w: 6, h: 1, color: 'glow', z: 13 },
    { key: 'crest', x: -3, y: top - 5, w: 6, h: 1, color: 'ink', z: 12 },
  ],
  'tail-flame': (top) => [
    { key: 'aura', x: -9, y: Math.round(top * 0.25), w: 3, h: 4, color: 'glow', z: 0 },
    { key: 'aura', x: -11, y: Math.round(top * 0.25) + 3, w: 2, h: 3, color: 'accentBright', z: 0 },
  ],
};

export const EVOLUTION_OVERLAY_LABELS: Record<EvolutionOverlayId, string> = {
  halo: 'Halo',
  horns: 'Horns',
  wings: 'Wings',
  plates: 'Armor plates',
  mane: 'Mane',
  crown: 'Crown',
  antennae: 'Antennae',
  spikes: 'Spikes',
  visor: 'Visor',
  'tail-flame': 'Tail flame',
};

export const EVOLUTION_OVERLAY_IDS = Object.keys(EVOLUTION_OVERLAYS) as EvolutionOverlayId[];
