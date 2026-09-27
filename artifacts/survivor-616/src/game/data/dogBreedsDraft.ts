import type { LokPetVariantDef } from '@/game/types';

/**
 * DRAFT dog-breed pool -- for review only. NOT wired into `LOKPET_VARIANTS`
 * (`data/lokPets.ts`) and not imported anywhere. Nothing here is rollable
 * from a chest or purchasable from Rapid Guard's K9 counter yet.
 *
 * Follows up on the GRPD Station K9 counter (`k9-greyhound`/`k9-shepherd`/
 * `wolf` in `data/lokPets.ts` -- see .agents/memory/grpd-station.md), which
 * only covered "police dog." This sketches a broader common -> noble tier
 * ladder of ordinary dog builds, so there's more variety to eventually
 * splice into the live pool.
 *
 * To merge later: append this array's entries into `LOKPET_VARIANTS` in
 * `data/lokPets.ts` and make sure `LOKPET_RIGS`/`LOKPET_SILHOUETTE_LABELS`
 * already cover every `silhouette` used below (today: `k9-hound`, `wolf`
 * -- both already real, per the K9 counter work).
 *
 * `weight` here is the *breed* pool weight (`pickWeightedVariant` in
 * `lokPets.ts` -- how often this specific breed gets picked at all, same
 * default of 8 every other ordinary variant uses when unset). It is
 * **separate from and orthogonal to** the common/charged/rare/mythic
 * *stat* rarity (`LOKPET_STAT_SHEETS`), which still rolls independently
 * per-pet regardless of breed. A "common" breed below can still roll a
 * mythic-tier stat sheet; the tiering here is about how often you *see*
 * the breed at all, and its flavor/palette, not its combat power.
 *
 * The noble tier reuses the existing `wolf`/`k9-hound` silhouettes for
 * now to keep this a pure data draft with zero engine surface area. If
 * this gets merged in for real, the noble tier would likely earn its own
 * silhouette/rig (a leaner build, a ceremonial collar accent part) for
 * real visual distinction from the common tier -- flagged here, not
 * solved.
 */
export const DOG_BREEDS_DRAFT: LokPetVariantDef[] = [
  // --- Common (weight 10-12): scrappy, plain, everywhere. ---
  {
    id: 'junkyard-cur',
    name: 'Junkyard Cur',
    family: 'animal',
    silhouette: 'k9-hound',
    palette: { body: '#78716c', bodyDark: '#292524', accent: '#a3a3a3', glow: '#d6d3d1', eye: '#1c1917' },
    description: 'Grew up between two chain-link fences and a dumpster. Barks first, asks never.',
    weight: 12,
  },
  {
    id: 'alley-mutt',
    name: 'Alley Mutt',
    family: 'animal',
    silhouette: 'k9-hound',
    palette: { body: '#92764f', bodyDark: '#3f2f1c', accent: '#d9c9a3', glow: '#f5deb3', eye: '#2b1d0e' },
    description: "No two people agree what breeds went into this one. It doesn't care either.",
    weight: 11,
  },
  {
    id: 'corner-stray',
    name: 'Corner Stray',
    family: 'animal',
    silhouette: 'wolf',
    palette: { body: '#57534e', bodyDark: '#1c1917', accent: '#a8a29e', glow: '#78716c', eye: '#fef3c7' },
    description: 'Owns exactly one street corner and has never lost an argument about it.',
    weight: 10,
  },

  // --- Standard (weight 6-8): working/companion breeds, a step up. ---
  {
    id: 'rust-belt-terrier',
    name: 'Rust Belt Terrier',
    family: 'animal',
    silhouette: 'k9-hound',
    palette: { body: '#8a5a3c', bodyDark: '#3d2717', accent: '#e8b04b', glow: '#f4c78a', eye: '#1a1208' },
    description: 'Small, wiry, and personally offended by every rat in a four-block radius.',
    weight: 7,
  },
  {
    id: 'frostline-husky',
    name: 'Frostline Husky',
    family: 'animal',
    silhouette: 'k9-hound',
    palette: { body: '#cbd5e1', bodyDark: '#475569', accent: '#38bdf8', glow: '#bae6fd', eye: '#0c4a6e' },
    description: 'Built for a colder city than this one. Makes do, loudly, at 3am.',
    weight: 6,
  },

  // --- Uncommon / noble-leaning (weight 2-3): sleeker, more striking. ---
  {
    id: 'onyx-doberman',
    name: 'Onyx Doberman',
    family: 'animal',
    silhouette: 'wolf',
    palette: { body: '#18181b', bodyDark: '#09090b', accent: '#b91c1c', glow: '#f87171', eye: '#fafafa' },
    description: 'Moves like it already knows how this ends. Usually does.',
    weight: 3,
  },
  {
    id: 'ridge-runner',
    name: 'Ridge Runner',
    family: 'animal',
    silhouette: 'wolf',
    palette: { body: '#c2703d', bodyDark: '#5c2f16', accent: '#78350f', glow: '#fdba74', eye: '#292524' },
    description: 'A stripe of stiff hair down its spine that stands up before it does. Bred for something bigger than this city has left.',
    weight: 2,
  },

  // --- Noble (weight ~1): show-breed / palace flavor, rarest to see. ---
  {
    id: 'palace-borzoi',
    name: 'Palace Borzoi',
    family: 'animal',
    silhouette: 'wolf',
    palette: { body: '#f5f5f4', bodyDark: '#a8a29e', accent: '#d4af37', glow: '#fef3c7', eye: '#44403c' },
    description: 'Ran with royalty once, or its owner says so. Carries itself like the claim is true.',
    weight: 1,
  },
  {
    id: 'imperial-akita',
    name: 'Imperial Akita',
    family: 'animal',
    silhouette: 'k9-hound',
    palette: { body: '#ea9c3d', bodyDark: '#78430f', accent: '#fef3c7', glow: '#fde68a', eye: '#1c1917' },
    description: 'Composed, watchful, and unmistakably certain that it, personally, is the reason nothing bad has happened yet.',
    weight: 1,
  },
  {
    id: 'velvet-saluki',
    name: 'Velvet Saluki',
    family: 'animal',
    silhouette: 'wolf',
    palette: { body: '#3f3245', bodyDark: '#1a1423', accent: '#c084fc', glow: '#e9d5ff', eye: '#faf5ff' },
    description: 'Feathered, silent, and faster than anything this build implies. A hunting line with nothing left to hunt but time.',
    weight: 1,
  },
];
