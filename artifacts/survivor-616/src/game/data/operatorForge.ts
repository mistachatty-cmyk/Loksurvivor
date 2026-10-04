/**
 * The Operator Forge: how brand-new operators are designed and generated.
 *
 * Everything here is additive. The 69 hand-authored operators are never read,
 * changed or re-skinned by this module. The Forge only produces *new* operators
 * from three ingredients:
 *
 *   - a body (build, height, width) fed to the existing `humanoidRig` factory,
 *   - a palette (a color scheme, a hue and a skin tone, turned into the usual
 *     seven-color `SpritePalette`), and
 *   - a look (one feature per category from the bank in `sprites/operatorDetail`,
 *     each with its own palette color).
 *
 * A species preset (human, cyborg, alien, ...) biases all three at once, and a
 * flavor (street, tech, mystic, ...) biases the wardrobe. Everything is
 * deterministic for a given seed, so a seed text is also a shareable operator.
 *
 * To widen the Forge: add a feature to a table in `sprites/operatorDetail`, add a
 * body build, species, flavor or skin tone here, or add words to the identity
 * pools. The unit tests check that every list only names things that exist.
 */
import type { SpritePalette, SpriteRig } from '@/game/types';
import { humanoidRig } from '@/game/sprites/rigs';
import {
  ACCESSORIES, BACKS, BELTS, BOOTS, BROWS, EYES, HAIR, HEADWEAR, HELD, LEGWEAR, MARKS, MOUTHS, SHOULDERS, SLEEVES, TOPS,
  applyOperatorLook, type OperatorLook,
} from '@/game/sprites/operatorDetail';

type Col = keyof SpritePalette;

/* ------------------------------------------------------------------ */
/* Small deterministic helpers                                         */
/* ------------------------------------------------------------------ */

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length) % list.length]!;
}

function luma(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0.5;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const wrapHue = (h: number) => ((h % 360) + 360) % 360;

export function featureLabel(id: string): string {
  if (!id) return '';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export type FeatureField =
  | 'hair' | 'headwear' | 'eyes' | 'brows' | 'mouth' | 'mark' | 'top' | 'shoulders' | 'sleeves' | 'belt' | 'legwear'
  | 'boots' | 'accessory' | 'back' | 'held';

export type ColorField =
  | 'hairColor' | 'headwearColor' | 'eyeColor' | 'browColor' | 'mouthColor' | 'markColor' | 'topColor' | 'shoulderColor'
  | 'sleeveColor' | 'beltColor' | 'legwearColor' | 'bootsColor' | 'accessoryColor' | 'backColor' | 'heldColor';

export type CategoryGroup = 'Head' | 'Face' | 'Torso' | 'Legs' | 'Extras';

export interface ForgeCategory {
  field: FeatureField;
  colorField: ColorField;
  label: string;
  group: CategoryGroup;
  ids: string[];
  /** The "nothing" option for optional categories. */
  none?: string;
  /** Palette colors tried, in order of contrast, when the generator colors this category. */
  pool: Col[];
}

const keys = (table: Record<string, unknown>) => Object.keys(table);
const FABRIC: Col[] = ['accent', 'accentBright', 'bodyDark', 'ink', 'glow', 'body'];
const DARK_LINE: Col[] = ['ink', 'bodyDark', 'accent'];

export const FORGE_CATEGORIES: ForgeCategory[] = [
  { field: 'hair', colorField: 'hairColor', label: 'Hair', group: 'Head', ids: keys(HAIR), pool: ['ink', 'bodyDark', 'accent', 'accentBright', 'glow'] },
  { field: 'headwear', colorField: 'headwearColor', label: 'Headwear', group: 'Head', ids: keys(HEADWEAR), none: 'none', pool: FABRIC },
  { field: 'eyes', colorField: 'eyeColor', label: 'Eyes', group: 'Face', ids: keys(EYES), pool: ['ink', 'accentBright', 'glow', 'accent'] },
  { field: 'brows', colorField: 'browColor', label: 'Brows', group: 'Face', ids: keys(BROWS), none: 'none', pool: DARK_LINE },
  { field: 'mouth', colorField: 'mouthColor', label: 'Mouth and beard', group: 'Face', ids: keys(MOUTHS), none: 'none', pool: DARK_LINE },
  { field: 'mark', colorField: 'markColor', label: 'Face marks', group: 'Face', ids: keys(MARKS), none: 'none', pool: ['accent', 'glow', 'ink', 'bodyDark'] },
  { field: 'top', colorField: 'topColor', label: 'Top', group: 'Torso', ids: keys(TOPS), none: 'plain', pool: FABRIC },
  { field: 'shoulders', colorField: 'shoulderColor', label: 'Shoulders', group: 'Torso', ids: keys(SHOULDERS), none: 'none', pool: FABRIC },
  { field: 'sleeves', colorField: 'sleeveColor', label: 'Sleeves and gloves', group: 'Torso', ids: keys(SLEEVES), none: 'none', pool: FABRIC },
  { field: 'belt', colorField: 'beltColor', label: 'Belt', group: 'Torso', ids: keys(BELTS), none: 'none', pool: FABRIC },
  { field: 'legwear', colorField: 'legwearColor', label: 'Legwear', group: 'Legs', ids: keys(LEGWEAR), none: 'plain', pool: FABRIC },
  { field: 'boots', colorField: 'bootsColor', label: 'Footwear', group: 'Legs', ids: keys(BOOTS), none: 'none', pool: FABRIC },
  { field: 'accessory', colorField: 'accessoryColor', label: 'Accessory', group: 'Extras', ids: keys(ACCESSORIES), none: 'none', pool: ['accentBright', 'glow', 'accent', 'ink'] },
  { field: 'back', colorField: 'backColor', label: 'Back item', group: 'Extras', ids: keys(BACKS), none: 'none', pool: FABRIC },
  { field: 'held', colorField: 'heldColor', label: 'Held item', group: 'Extras', ids: keys(HELD), none: 'none', pool: ['accent', 'accentBright', 'glow'] },
];

export const FORGE_GROUPS: CategoryGroup[] = ['Head', 'Face', 'Torso', 'Legs', 'Extras'];
export const FEATURE_FIELDS: FeatureField[] = FORGE_CATEGORIES.map((c) => c.field);
export const PALETTE_KEYS: Col[] = ['ink', 'body', 'bodyDark', 'accent', 'accentBright', 'skin', 'glow'];

export function categoryOf(field: FeatureField): ForgeCategory {
  return FORGE_CATEGORIES.find((c) => c.field === field)!;
}

/* ------------------------------------------------------------------ */
/* Bodies                                                              */
/* ------------------------------------------------------------------ */

export interface BodyBuildDef {
  id: string;
  label: string;
  height: number;
  width: number;
  bulk?: boolean;
  hunched?: boolean;
  flarePants?: boolean;
}

export const BODY_BUILDS: BodyBuildDef[] = [
  { id: 'average', label: 'Average', height: 20, width: 10 },
  { id: 'lean', label: 'Lean', height: 22, width: 8 },
  { id: 'stocky', label: 'Stocky', height: 18, width: 12 },
  { id: 'broad', label: 'Broad', height: 20, width: 10, bulk: true },
  { id: 'tall', label: 'Tall', height: 26, width: 10 },
  { id: 'small', label: 'Small', height: 15, width: 8 },
  { id: 'hunched', label: 'Hunched', height: 18, width: 10, hunched: true },
  { id: 'flared', label: 'Flared', height: 21, width: 10, flarePants: true },
  { id: 'giant', label: 'Giant', height: 28, width: 12, bulk: true },
];

export const HEIGHT_RANGE = { min: 14, max: 28 } as const;
export const WIDTH_RANGE = { min: 7, max: 14 } as const;

export interface OperatorBody {
  build: string;
  height: number;
  width: number;
}

/** Narrow hunched frames collapse the head below what the detail layer can sit on, so they need a little more width. */
export function minWidthFor(buildId: string): number {
  return BODY_BUILDS.find((b) => b.id === buildId)?.hunched ? 9 : WIDTH_RANGE.min;
}

export function bodyFromBuild(buildId: string): OperatorBody {
  const def = BODY_BUILDS.find((b) => b.id === buildId) ?? BODY_BUILDS[0]!;
  return { build: def.id, height: def.height, width: def.width };
}

/* ------------------------------------------------------------------ */
/* Palettes, skin tones and species                                    */
/* ------------------------------------------------------------------ */

export interface SkinTone {
  id: string;
  label: string;
  hex: string;
  fantasy?: boolean;
}

export const SKIN_TONES: SkinTone[] = [
  { id: 'porcelain', label: 'Porcelain', hex: '#f6dcc8' },
  { id: 'fair', label: 'Fair', hex: '#f0c9a4' },
  { id: 'sand', label: 'Sand', hex: '#e2b387' },
  { id: 'honey', label: 'Honey', hex: '#cf9a69' },
  { id: 'olive', label: 'Olive', hex: '#b98a5a' },
  { id: 'tan', label: 'Tan', hex: '#a8764a' },
  { id: 'bronze', label: 'Bronze', hex: '#8d5a36' },
  { id: 'umber', label: 'Umber', hex: '#6e4126' },
  { id: 'espresso', label: 'Espresso', hex: '#4d2c1a' },
  { id: 'ebony', label: 'Ebony', hex: '#35200f' },
  { id: 'ash', label: 'Ash', hex: '#a9a9b4', fantasy: true },
  { id: 'moss', label: 'Moss', hex: '#7fa86a', fantasy: true },
  { id: 'lichen', label: 'Lichen', hex: '#a9c27a', fantasy: true },
  { id: 'lavender', label: 'Lavender', hex: '#b9a2dc', fantasy: true },
  { id: 'ember', label: 'Ember', hex: '#d9634a', fantasy: true },
  { id: 'frost', label: 'Frost', hex: '#a9d6e8', fantasy: true },
  { id: 'gilt', label: 'Gilt', hex: '#e0c25a', fantasy: true },
  { id: 'void', label: 'Void', hex: '#4a3a78', fantasy: true },
  { id: 'bone', label: 'Bone', hex: '#e6e0cc', fantasy: true },
  { id: 'rose', label: 'Rose quartz', hex: '#e7a1b6', fantasy: true },
  { id: 'teal', label: 'Teal', hex: '#4fb3a8', fantasy: true },
  { id: 'chrome', label: 'Chrome', hex: '#c4ccd6', fantasy: true },
];

const NATURAL_SKIN = SKIN_TONES.filter((s) => !s.fantasy).map((s) => s.hex);
const FANTASY_SKIN = SKIN_TONES.filter((s) => s.fantasy).map((s) => s.hex);

export const PALETTE_SCHEMES = [
  'analogous', 'complementary', 'triadic', 'split', 'mono', 'neon', 'earth', 'pastel', 'noir',
] as const;
export type PaletteScheme = (typeof PALETTE_SCHEMES)[number];

export interface PaletteSpec {
  scheme: PaletteScheme;
  /** 0-359. */
  hue: number;
  /** 0 (darkest) to 1 (lightest) shading of the main body color. */
  shade: number;
  skin: string;
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = wrapHue(h) / 360;
  const ss = clamp(s, 0, 1);
  const ll = clamp(l, 0, 1);
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (ss === 0) {
    r = ll; g = ll; b = ll;
  } else {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    r = hue2rgb(p, q, hh + 1 / 3);
    g = hue2rgb(p, q, hh);
    b = hue2rgb(p, q, hh - 1 / 3);
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Turns a scheme, hue, shade and skin tone into the full seven-color palette. Pure and deterministic. */
export function generatePalette(spec: PaletteSpec): SpritePalette {
  const { scheme, hue, skin } = spec;
  const shade = clamp(spec.shade, 0, 1);
  const lift = (shade - 0.5) * 0.22;
  let bodyH = hue;
  let bodyS = 0.55;
  let bodyL = 0.42;
  let accH = hue + 35;
  let accS = 0.72;
  let accL = 0.55;
  let inkS = 0.25;
  let inkL = 0.08;
  switch (scheme) {
    case 'analogous': accH = hue + 35; break;
    case 'complementary': accH = hue + 180; break;
    case 'triadic': accH = hue + 120; break;
    case 'split': accH = hue + 150; break;
    case 'mono': accH = hue; bodyS = 0.35; bodyL = 0.38; accS = 0.6; accL = 0.62; break;
    case 'neon': bodyS = 0.9; bodyL = 0.3; accH = hue + 160; accS = 1; accL = 0.58; inkS = 0.4; break;
    case 'earth': bodyH = 20 + (hue % 40); bodyS = 0.35; bodyL = 0.33; accH = bodyH + 25; accS = 0.5; accL = 0.5; break;
    case 'pastel': bodyS = 0.55; bodyL = 0.72; accH = hue + 40; accS = 0.6; accL = 0.8; inkS = 0.22; inkL = 0.2; break;
    case 'noir': bodyS = 0.08; bodyL = 0.2; accH = hue; accS = 0.85; accL = 0.5; break;
  }
  const body = hslToHex(bodyH, bodyS, clamp(bodyL + lift, 0.1, 0.9));
  const bodyDark = hslToHex(bodyH, bodyS, clamp(bodyL + lift - 0.15, 0.05, 0.8));
  const accent = hslToHex(accH, accS, accL);
  const accentBright = hslToHex(accH, clamp(accS + 0.1, 0, 1), clamp(accL + 0.16, 0.3, 0.9));
  const glow = hslToHex(accH, 1, clamp(accL + 0.1, 0.4, 0.8));
  const ink = hslToHex(bodyH, inkS, inkL);
  return { ink, body, bodyDark, accent, accentBright, skin: HEX.test(skin) ? skin : '#e2b387', glow };
}

export interface SpeciesDef {
  id: string;
  label: string;
  blurb: string;
  skins: string[];
  /** Palette schemes this species tends to use. */
  schemes: PaletteScheme[];
  /** Features this species leans toward, on top of the flavor's own lean. */
  lean: Partial<Record<FeatureField, string[]>>;
  /** Body builds it tends to have. */
  builds: string[];
  /** For faction races: the `FactionDef.id` (data/factions.ts) this race is drawn from. */
  faction?: string;
  /** One line of in-world lore, shown under the race picker. */
  lore?: string;
}

export const CORE_SPECIES: SpeciesDef[] = [
  {
    id: 'human', label: 'Human', blurb: 'A regular 616 resident.', skins: NATURAL_SKIN,
    schemes: ['analogous', 'complementary', 'earth', 'mono', 'noir', 'split'], lean: {},
    builds: ['average', 'lean', 'stocky', 'broad', 'tall', 'small', 'flared'],
  },
  {
    id: 'cyborg', label: 'Cyborg', blurb: 'More circuit board than neighbor.', skins: [...NATURAL_SKIN, '#c4ccd6', '#a9a9b4'],
    schemes: ['neon', 'noir', 'complementary', 'mono'],
    lean: { eyes: ['visor', 'glow', 'cyclops'], mark: ['circuit', 'glitchline', 'neckband'], sleeves: ['cyber'], top: ['circuitry', 'core'], headwear: ['antenna', 'headphones'], boots: ['hover'] },
    builds: ['lean', 'broad', 'tall', 'average'],
  },
  {
    id: 'beastkin', label: 'Beastkin', blurb: 'Ears, tails and a temper.', skins: [...NATURAL_SKIN, '#d9634a', '#e0c25a'],
    schemes: ['earth', 'analogous', 'split'],
    lean: { headwear: ['catears', 'horns'], back: ['tail'], mouth: ['fangs'], hair: ['shaggy', 'spikes', 'mohawk'], eyes: ['narrow', 'mismatch'], mark: ['scar', 'warpaint'] },
    builds: ['stocky', 'hunched', 'broad', 'lean'],
  },
  {
    id: 'spirit', label: 'Spirit', blurb: 'Drifts a little off the ground.', skins: ['#e6e0cc', '#a9d6e8', '#b9a2dc', '#e7a1b6'],
    schemes: ['pastel', 'mono', 'triadic'],
    lean: { eyes: ['hollow', 'glow', 'spiral'], headwear: ['crown', 'tiara', 'flowers', 'headwrap'], back: ['wings', 'tattered', 'cape'], hair: ['longhair', 'widows', 'twists'], mark: ['tearline', 'blush'], boots: ['hover', 'none'] },
    builds: ['lean', 'tall', 'small', 'flared'],
  },
  {
    id: 'alien', label: 'Alien', blurb: 'Not from around here. Not from around anywhere.', skins: ['#7fa86a', '#a9c27a', '#4fb3a8', '#b9a2dc', '#d9634a'],
    schemes: ['neon', 'triadic', 'split', 'complementary'],
    lean: { eyes: ['cyclops', 'big', 'wide', 'tall', 'mismatch'], headwear: ['antenna', 'horns'], hair: ['bald', 'spikes'], mark: ['stripe', 'glitchline', 'circuit'], mouth: ['none', 'flat'], back: ['wings', 'tail'] },
    builds: ['lean', 'tall', 'small', 'giant'],
  },
  {
    id: 'undead', label: 'Undead', blurb: 'Dead, but the commute never stopped.', skins: ['#e6e0cc', '#a9a9b4', '#7fa86a', '#4a3a78'],
    schemes: ['noir', 'earth', 'mono'],
    lean: { eyes: ['hollow', 'sleepy', 'glow'], mark: ['scar', 'bandage', 'stripe'], top: ['trench', 'poncho', 'kimono'], back: ['tattered', 'cape'], hair: ['widows', 'bald', 'shaggy'], mouth: ['fangs', 'beard'] },
    builds: ['hunched', 'lean', 'tall', 'average'],
  },
  {
    id: 'construct', label: 'Construct', blurb: 'Built, bolted and proud.', skins: ['#c4ccd6', '#a9a9b4', '#8f9aa8', '#e0c25a'],
    schemes: ['mono', 'noir', 'neon', 'earth'],
    lean: { eyes: ['visor', 'cyclops', 'dots', 'glow'], headwear: ['helmet', 'hardhat', 'antenna', 'goggles'], top: ['armor', 'hazard', 'core', 'circuitry'], shoulders: ['pads', 'spikes'], sleeves: ['cyber', 'bracers'], boots: ['heavy', 'greaves'], mouth: ['none', 'mask'], hair: ['bald'] },
    builds: ['broad', 'giant', 'stocky', 'tall'],
  },
  {
    id: 'dragonkin', label: 'Dragonkin', blurb: 'Scales, horns, and an ancestral grudge.', skins: ['#d9634a', '#7fa86a', '#e0c25a', '#4a3a78', '#4fb3a8'],
    schemes: ['complementary', 'analogous', 'neon', 'earth'],
    lean: { headwear: ['horns', 'crown'], back: ['wings', 'tail'], eyes: ['narrow', 'glow', 'mismatch'], mouth: ['fangs', 'goldteeth'], shoulders: ['spikes', 'mantle'], mark: ['scar', 'warpaint', 'stripe'], hair: ['bald', 'spikes', 'mohawk'] },
    builds: ['broad', 'tall', 'giant', 'stocky'],
  },
  {
    id: 'fae', label: 'Fae', blurb: 'Charming, ancient, and fully capable of a prank.', skins: ['#b9a2dc', '#e7a1b6', '#a9c27a', '#a9d6e8', '#f6dcc8'],
    schemes: ['pastel', 'analogous', 'triadic', 'split'],
    lean: { headwear: ['flowers', 'tiara', 'crown', 'catears'], back: ['wings', 'cape'], eyes: ['big', 'lashes', 'wide', 'glow'], hair: ['longhair', 'twists', 'bun', 'ponytail'], mark: ['freckles', 'blush', 'tearline'], accessory: ['bell', 'pin', 'medal'] },
    builds: ['small', 'lean', 'flared', 'tall'],
  },
  {
    id: 'mutant', label: 'Mutant', blurb: 'The neighborhood changed. So did they.', skins: [...FANTASY_SKIN],
    schemes: ['neon', 'triadic', 'split', 'complementary', 'earth'],
    lean: { eyes: ['mismatch', 'cyclops', 'spiral', 'tall', 'wide'], mark: ['stripe', 'glitchline', 'scar', 'stripe'], hair: ['spikes', 'mohawk', 'shaggy'], mouth: ['fangs', 'goatee', 'goldteeth'], headwear: ['horns', 'antenna', 'monocle'], boots: ['hover', 'heavy'], back: ['tail', 'jetpack'] },
    builds: ['hunched', 'giant', 'small', 'stocky', 'lean'],
  },
];

const tone = (...ids: string[]) => ids.map((id) => SKIN_TONES.find((t) => t.id === id)!.hex);

/**
 * Races drawn from the game's factions and districts. Each one points at a real
 * faction id (checked against `data/factions.ts` by the tests) and leans toward
 * the look of that crew, so a forged operator can be "from" the Null Sector or
 * the River Antler Court. Like the core species these only bias generation; they
 * never change stats. Add another by adding a row here.
 */
export const FACTION_SPECIES: SpeciesDef[] = [
  {
    id: 'watchborn', label: 'Watchborn', faction: 'the-watch', blurb: 'Raised under the floodlights.',
    lore: 'Sentries who learned to read a street by what moves in it. Nothing gets past, and nothing gets forgotten.',
    skins: tone('chrome', 'bone', 'ash', 'fair'), schemes: ['noir', 'mono', 'complementary'],
    lean: { eyes: ['cyclops', 'visor', 'lens'], headwear: ['spotlight', 'helmet', 'hardhat'], top: ['armor', 'hazard'], mark: ['barcode', 'neckband'], held: ['torch', 'lantern'], shoulders: ['pads'] },
    builds: ['tall', 'broad', 'average'],
  },
  {
    id: 'lockjaw', label: 'Lockjaw', faction: 'lockstep', blurb: 'Stares until you flinch.',
    lore: 'Descendants of the cones that lock on and narrow to a line. Patient, unblinking, and very hard to shake.',
    skins: tone('ember', 'ash', 'umber', 'bronze'), schemes: ['complementary', 'neon', 'noir'],
    lean: { eyes: ['narrow', 'glow', 'visor'], headwear: ['cone', 'helmet'], mouth: ['fangs', 'frown'], brows: ['angry'], mark: ['glitchline', 'warpaint'] },
    builds: ['stocky', 'broad', 'average'],
  },
  {
    id: 'relaykin', label: 'Relaykin', faction: 'relay-corps', blurb: 'Never closes the distance. Never has to.',
    lore: 'Commanders who run the block from a safe corner, with a dish on the roof and a headset that never comes off.',
    skins: tone('chrome', 'frost', 'fair', 'sand'), schemes: ['mono', 'neon', 'complementary'],
    lean: { headwear: ['dish', 'antenna', 'headphones'], accessory: ['headset', 'lanyard', 'watch'], back: ['antennaarray'], top: ['labcoat', 'harness'], eyes: ['visor', 'shades'] },
    builds: ['lean', 'tall', 'average'],
  },
  {
    id: 'prismfolk', label: 'Prismfolk', faction: 'prism-choir', blurb: 'Every color at once, mostly on purpose.',
    lore: 'Beacon-singers whose light pulls, slows or burns depending on the hue. Their moods have a color code.',
    skins: tone('frost', 'lavender', 'rose', 'bone'), schemes: ['triadic', 'split', 'neon', 'pastel'],
    lean: { eyes: ['lens', 'glow', 'wide'], headwear: ['crown', 'tiara', 'spotlight'], mark: ['stripe', 'static'], hair: ['sweep', 'twists'] },
    builds: ['lean', 'small', 'flared'],
  },
  {
    id: 'afterimage', label: 'Afterimage', faction: 'afterimage-choir', blurb: 'Seen from the corner of the eye.',
    lore: 'Shadow-born flankers that never approach in a straight line. You remember them a second after they have gone.',
    skins: tone('ash', 'void', 'bone'), schemes: ['noir', 'mono'],
    lean: { eyes: ['hollow', 'glow', 'sleepy'], hair: ['widows', 'longhair'], back: ['tattered', 'cape'], mark: ['static', 'glitchline', 'tearline'], top: ['poncho', 'trench'], boots: ['hover'] },
    builds: ['lean', 'tall', 'hunched'],
  },
  {
    id: 'cinderfolk', label: 'Cinderfolk', faction: 'cinder-procession', blurb: 'Built from a fire that never went out.',
    lore: 'Armored chargers from the east side, still warm to the touch. They walk in procession and do not stop for traffic.',
    skins: tone('ember', 'bronze', 'umber', 'ash'), schemes: ['complementary', 'earth', 'analogous'],
    lean: { headwear: ['horns', 'helmet'], top: ['armor'], shoulders: ['spikes', 'pads'], boots: ['heavy', 'greaves'], mark: ['scar', 'warpaint'], held: ['torch'] },
    builds: ['broad', 'stocky', 'giant'],
  },
  {
    id: 'antlerkin', label: 'Antlerkin', faction: 'river-antler-court', blurb: 'The floodwall court, antlers and all.',
    lore: 'Wildlife that learned the street grid sideways. They keep court by the river and bow to nobody on the bank.',
    skins: tone('moss', 'lichen', 'olive', 'tan'), schemes: ['earth', 'analogous'],
    lean: { headwear: ['antlers', 'leafcrown'], back: ['tail', 'cape'], top: ['poncho'], eyes: ['narrow', 'big'], hair: ['shaggy', 'longhair'] },
    builds: ['lean', 'tall', 'hunched'],
  },
  {
    id: 'bubblenaught', label: 'Bubblenaut', faction: 'bubblenaught-tide', blurb: 'Deep blue and well pressurized.',
    lore: 'Natives of Haven of the Bubs, generations deep. Dense fluid shields, calm manners, and a helmet for every occasion.',
    skins: tone('frost', 'teal', 'chrome'), schemes: ['mono', 'analogous', 'pastel'],
    lean: { headwear: ['bubblehelm'], back: ['bubbles'], eyes: ['big', 'wide'], mouth: ['smile'], sleeves: ['gloves'], shoulders: ['mantle', 'pads'] },
    builds: ['broad', 'stocky', 'average'],
  },
  {
    id: 'bubbleteer', label: 'Bubbleteer', faction: 'bubbleteer-parade', blurb: 'Pink foam with a parade permit.',
    lore: 'Pressurized foam entities that pop into split swarms. Cheerful until startled, and then there are several of them.',
    skins: tone('rose', 'lavender', 'frost'), schemes: ['pastel', 'analogous', 'split'],
    lean: { headwear: ['bubblehelm', 'flowers', 'tiara'], back: ['bubbles'], eyes: ['big', 'lashes'], mark: ['blush', 'freckles'], mouth: ['smile'], hair: ['pigtails', 'bun'] },
    builds: ['small', 'flared', 'lean'],
  },
  {
    id: 'cabinetkin', label: 'Cabinetkin', faction: 'cabinet-rot', blurb: 'Glitching back to life, nothing plugged in.',
    lore: 'Neon Arcade cabinets that woke up with a head full of attract-mode. They insist the high score is theirs.',
    skins: tone('chrome', 'teal', 'ash', 'lavender'), schemes: ['neon', 'triadic', 'split'],
    lean: { headwear: ['crt', 'antenna'], eyes: ['lens', 'spiral', 'dots'], mark: ['glitchline', 'static'], top: ['core', 'circuitry'], held: ['boombox', 'phone'] },
    builds: ['average', 'stocky', 'tall'],
  },
  {
    id: 'highrollers', label: 'High Roller', faction: 'high-roller-syndicate', blurb: 'One name, spelled out in bulbs.',
    lore: 'The Neon Overflow stock room, dressed for the occasion. Gold teeth, marquee hats and a pocket watch that is always right.',
    skins: tone('gilt', 'honey', 'bone', 'sand', 'ebony'), schemes: ['complementary', 'noir', 'triadic'],
    lean: { headwear: ['marquee', 'fedora', 'crown'], top: ['tux', 'jacket'], accessory: ['chain', 'medal', 'pocketwatch'], mouth: ['goldteeth', 'mustache'], eyes: ['shades'], back: ['cape'] },
    builds: ['average', 'tall', 'broad'],
  },
  {
    id: 'nullborn', label: 'Nullborn', faction: 'null-sector', blurb: 'Nothing plugged in, everything running.',
    lore: 'Born in a decommissioned data-center basement under a rogue broadcast. Rack-mount chests, cable hair, no idle state.',
    skins: tone('void', 'ash', 'chrome', 'bone'), schemes: ['noir', 'neon', 'mono'],
    lean: { top: ['rackmount', 'circuitry'], back: ['cables'], eyes: ['hollow', 'cyclops', 'lens'], mark: ['barcode', 'glitchline', 'static'], headwear: ['antenna', 'dish'] },
    builds: ['tall', 'broad', 'lean'],
  },
  {
    id: 'reelfolk', label: 'Reelfolk', faction: 'reel-syndicate', blurb: 'Always one take away from a wrap.',
    lore: "The Director's crew, the cutting room runners and the continuity desk: people who think in shots and notice when something doesn't match.",
    skins: tone('fair', 'sand', 'honey', 'bone', 'ash'), schemes: ['noir', 'complementary', 'mono'],
    lean: { headwear: ['filmreel', 'fedora', 'headphones'], held: ['clapper', 'baton', 'mic'], back: ['reel'], top: ['jacket', 'trench'], accessory: ['lanyard', 'watch'] },
    builds: ['average', 'lean', 'tall'],
  },
  {
    id: 'glitchlings', label: 'Glitchling', faction: 'glitch-breach', blurb: 'A rendering bug with opinions.',
    lore: 'Memory leaks that broke free of the engine. They tear through coordinates and keep rules only as a suggestion.',
    skins: tone('teal', 'lavender', 'ember', 'moss', 'rose', 'chrome'), schemes: ['neon', 'triadic', 'split'],
    lean: { eyes: ['mismatch', 'triple', 'spiral'], mark: ['glitchline', 'static', 'stripe'], hair: ['spikes', 'mohawk'], back: ['tattered', 'wings'], boots: ['hover'] },
    builds: ['hunched', 'small', 'giant', 'lean'],
  },
  {
    id: 'digitized', label: 'Digitized', faction: 'digitized-damned', blurb: 'A person, mostly. Plus addresses.',
    lore: 'Survivors the Director harvested, their souls fragmented into data. Some remember their names; all remember the way home.',
    skins: tone('bone', 'frost', 'ash', 'fair'), schemes: ['mono', 'neon', 'pastel'],
    lean: { eyes: ['hollow', 'sleepy', 'glow'], mark: ['barcode', 'static', 'tearline'], top: ['circuitry', 'hoodie'], back: ['cables', 'tattered'], hair: ['shaggy', 'longhair'] },
    builds: ['lean', 'average', 'small'],
  },
  {
    id: 'arborkin', label: 'Arborkin', faction: 'arbor-collective', blurb: 'Canopy flora with a firewall.',
    lore: 'Bio-digital canopy growth that crept down the decommissioned corridors. Soft to look at, razor in the brambles.',
    skins: tone('moss', 'lichen', 'teal', 'olive'), schemes: ['analogous', 'earth', 'triadic'],
    lean: { hair: ['longhair', 'shaggy', 'twists'], headwear: ['leafcrown', 'flowers'], top: ['foliage', 'poncho'], back: ['vines'], mark: ['circuit', 'stripe'] },
    builds: ['tall', 'lean', 'flared'],
  },
  {
    id: 'levkin', label: 'Levkin', faction: 'lev-syndicate', blurb: 'High altitude, higher prices.',
    lore: 'The skyway cartel: gravity engineers, phase-shifting operatives and field technicians who rarely touch the ground.',
    skins: tone('chrome', 'frost', 'void', 'ash'), schemes: ['complementary', 'neon', 'mono'],
    lean: { eyes: ['visor', 'glow', 'cyclops'], sleeves: ['cyber'], back: ['jetpack'], boots: ['hover'], top: ['armor', 'circuitry'], accessory: ['drone'] },
    builds: ['tall', 'lean', 'broad'],
  },
  {
    id: 'gobkin', label: 'Gobkin', faction: 'data-goblins', blurb: 'Chews what is already broken.',
    lore: 'Data-Gobs roam 616 looking for raw data breakage to chew. They would rather snack than fight, but you are made of data too.',
    skins: tone('moss', 'lichen', 'teal'), schemes: ['neon', 'earth', 'analogous'],
    lean: { headwear: ['catears', 'hardhat'], eyes: ['wide', 'big', 'mismatch'], mouth: ['fangs', 'goldteeth'], hair: ['spikes', 'shaggy'], accessory: ['satchel', 'bandolier', 'tag'], back: ['backpack'], mark: ['scar', 'bandage'] },
    builds: ['small', 'hunched'],
  },
  {
    id: 'ironheads', label: 'Ironhead', faction: 'supabuilda', blurb: 'Membership, spotting and raw momentum.',
    lore: 'A gym faction that turned iron plates and grapples into a street-combat doctrine. Everything is a rep if you commit.',
    skins: tone('sand', 'honey', 'tan', 'bronze', 'umber', 'espresso'), schemes: ['complementary', 'noir', 'earth'],
    lean: { top: ['tank', 'hivis'], shoulders: ['plates', 'pads'], sleeves: ['gloves', 'bracers'], belt: ['chainbelt', 'belt'], held: ['dumbbell', 'sign'], headwear: ['bandana', 'visorcap'], mouth: ['beard', 'stubble'] },
    builds: ['broad', 'giant', 'stocky'],
  },
  {
    id: 'crewhands', label: 'Crewhand', faction: 'the-site-crew', blurb: 'Hard hat, harder schedule.',
    lore: 'Actual builders who run the street as a work zone. Barriers, nailers and crane hooks are just how they say hello.',
    skins: tone('fair', 'sand', 'honey', 'olive', 'umber'), schemes: ['complementary', 'earth', 'analogous'],
    lean: { headwear: ['hardhat', 'cone'], top: ['hivis', 'overalls', 'hazard'], belt: ['utility', 'belt'], held: ['wrench', 'sign', 'flag'], boots: ['heavy', 'boots'], legwear: ['cargo', 'kneepads'] },
    builds: ['average', 'stocky', 'broad'],
  },
  {
    id: 'gloamfolk', label: 'Gloamfolk', faction: 'firefly-wranglers', blurb: 'Light in a jar, pick in hand.',
    lore: 'Underground prospectors who wrangle incandescent fireflies with pickaxes and resonant staves. They know every shortcut in the dark.',
    skins: tone('ash', 'bone', 'honey', 'olive'), schemes: ['earth', 'noir', 'analogous'],
    lean: { headwear: ['minerlamp', 'hardhat'], held: ['jar', 'pickaxe', 'lantern'], back: ['fireflies', 'backpack'], top: ['overalls', 'harness'], boots: ['heavy', 'boots'], eyes: ['glow', 'big'] },
    builds: ['stocky', 'small', 'average'],
  },
];

/** Every race the Forge offers: the core species first, then the faction races. */
export const SPECIES: SpeciesDef[] = [...CORE_SPECIES, ...FACTION_SPECIES];


export function speciesById(id: string): SpeciesDef {
  return SPECIES.find((s) => s.id === id) ?? SPECIES[0]!;
}

/* ------------------------------------------------------------------ */
/* Flavors (wardrobe styles)                                           */
/* ------------------------------------------------------------------ */

export type OperatorFlavor = 'street' | 'tech' | 'mystic' | 'brawler' | 'performer' | 'scout' | 'wild';
export const OPERATOR_FLAVORS_LIST: OperatorFlavor[] = ['street', 'tech', 'mystic', 'brawler', 'performer', 'scout', 'wild'];

/** Feature ids each flavor leans toward. */
export const OPERATOR_LEAN: Record<OperatorFlavor, Partial<Record<FeatureField, string[]>>> = {
  street: {
    hair: ['fade', 'locs', 'afro', 'sidepart', 'pigtails', 'twists', 'flattop'], headwear: ['snapback', 'beanie', 'bucket', 'bandana', 'visorcap'],
    top: ['hoodie', 'jersey', 'tracksuit', 'stripes', 'bomber'], boots: ['sneakers', 'heavy'], accessory: ['chain', 'earring', 'headset', 'tag'],
    back: ['backpack', 'none'], held: ['can', 'phone', 'mic', 'boombox'], mouth: ['goldteeth', 'smile', 'stubble'],
  },
  tech: {
    hair: ['crop', 'sweep', 'bald', 'undercut'], headwear: ['goggles', 'headphones', 'antenna', 'helmet'],
    eyes: ['visor', 'glow', 'cyclops', 'shades'], top: ['labcoat', 'core', 'harness', 'hazard', 'circuitry'],
    sleeves: ['cyber', 'gloves', 'bracers'], accessory: ['drone', 'lanyard', 'watch', 'headset'], back: ['jetpack', 'backpack'],
    mark: ['circuit', 'neckband', 'glitchline'], held: ['wrench', 'phone'], boots: ['hover', 'heavy'],
  },
  mystic: {
    hair: ['longhair', 'bun', 'widows', 'ponytail', 'topknot'], headwear: ['headwrap', 'crown', 'horns', 'hoodup', 'tiara', 'none'],
    eyes: ['glow', 'sleepy', 'mismatch', 'big', 'spiral'], top: ['sash', 'trench', 'scarf', 'armor', 'kimono', 'poncho'],
    shoulders: ['mantle', 'fur'], back: ['cape', 'banner', 'wings'], held: ['lantern', 'baton', 'torch'], mark: ['tearline', 'warpaint', 'circuit'],
    accessory: ['medal', 'pin', 'chain', 'pocketwatch'],
  },
  brawler: {
    hair: ['mohawk', 'spikes', 'bald', 'crop', 'flattop'], headwear: ['helmet', 'bandana', 'horns', 'none'],
    brows: ['angry', 'thick'], mouth: ['beard', 'fangs', 'frown', 'stubble'], top: ['tank', 'armor', 'harness', 'jacket', 'overalls'],
    shoulders: ['pads', 'spikes', 'epaulets'], sleeves: ['gloves', 'bracers', 'rolled'], belt: ['chainbelt', 'holster', 'belt'],
    boots: ['heavy', 'greaves', 'boots'], mark: ['scar', 'warpaint', 'bandage'], held: ['baton', 'wrench', 'sign'],
  },
  performer: {
    hair: ['afro', 'sweep', 'pigtails', 'mohawk', 'longhair', 'undercut'], headwear: ['crown', 'headphones', 'catears', 'fedora', 'none'],
    eyes: ['big', 'shades', 'wide', 'lashes'], mouth: ['smile', 'goldteeth', 'mustache'], top: ['jacket', 'sash', 'jersey', 'tracksuit', 'bomber'],
    shoulders: ['epaulets', 'mantle', 'fur'], sleeves: ['gloves', 'cuffs'], accessory: ['chain', 'earring', 'medal', 'bell'],
    back: ['guitar', 'cape'], held: ['mic', 'baton', 'boombox'], boots: ['sneakers', 'boots'],
  },
  scout: {
    hair: ['ponytail', 'crop', 'sidepart', 'bun'], headwear: ['bucket', 'goggles', 'bandana', 'beanie', 'hardhat', 'visorcap'],
    top: ['harness', 'trench', 'jacket', 'plain', 'overalls'], belt: ['utility', 'holster', 'belt'], legwear: ['cargo', 'kneepads', 'cuffed', 'patched'],
    back: ['backpack', 'banner', 'quiver'], accessory: ['satchel', 'watch', 'headset', 'bandolier'], boots: ['boots', 'greaves', 'socks'],
    held: ['lantern', 'phone', 'baton', 'umbrella'],
  },
  wild: {
    hair: ['spikes', 'locs', 'mohawk', 'afro', 'shaggy'], headwear: ['horns', 'catears', 'antenna', 'crown', 'flowers'],
    eyes: ['cyclops', 'mismatch', 'glow', 'patch', 'spiral'], mouth: ['fangs', 'goldteeth', 'mask'], mark: ['circuit', 'scar', 'warpaint', 'tearline', 'stripe'],
    top: ['hazard', 'core', 'scarf', 'stripes', 'poncho'], shoulders: ['spikes', 'fur'], back: ['tail', 'cape', 'jetpack', 'tattered'],
    sleeves: ['cyber', 'rolled'], boots: ['hover', 'heavy'],
  },
};

/* ------------------------------------------------------------------ */
/* Design model                                                        */
/* ------------------------------------------------------------------ */

export interface OperatorDesign {
  species: string;
  flavor: OperatorFlavor;
  body: OperatorBody;
  palette: SpritePalette;
  /** The recipe the palette was generated from; edits to single colors leave it as a starting point. */
  paletteSpec: PaletteSpec;
  look: OperatorLook;
}

export function lookDifference(a: OperatorLook, b: OperatorLook): number {
  return FEATURE_FIELDS.filter((field) => a[field] !== b[field]).length;
}

/** Builds the rig for a design: a fresh humanoid body with the look's features stacked on it. */
export function buildOperatorRig(design: OperatorDesign): SpriteRig {
  const def = BODY_BUILDS.find((b) => b.id === design.body.build) ?? BODY_BUILDS[0]!;
  const base = humanoidRig({
    height: clamp(Math.round(design.body.height), HEIGHT_RANGE.min, HEIGHT_RANGE.max),
    width: clamp(Math.round(design.body.width), minWidthFor(def.id), WIDTH_RANGE.max),
    bulk: def.bulk,
    hunched: def.hunched,
    flarePants: def.flarePants,
  });
  return applyOperatorLook(base, design.look);
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

function pickWeighted(rand: () => number, all: string[], lean: string[] | undefined, boost: string[] | undefined): string {
  const weights = all.map((id) => (lean?.includes(id) ? 5 : 1) + (boost?.includes(id) ? 14 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < all.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) return all[i]!;
  }
  return all[all.length - 1]!;
}

/** Palette colors that stand out from `against`, best contrast first. */
function contrastKeys(palette: SpritePalette, against: string[], pool: Col[]): Col[] {
  const refs = against.map(luma);
  return pool
    .map((key) => ({ key, score: Math.min(...refs.map((ref) => Math.abs(luma(palette[key]) - ref))) }))
    .filter((entry) => entry.score >= 0.16)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.key);
}

function colorAgainst(rand: () => number, palette: SpritePalette, cat: ForgeCategory): Col {
  const skin = palette.skin;
  const torso = palette.body;
  const against: Record<ColorField, string[]> = {
    hairColor: [skin], headwearColor: [skin, torso], eyeColor: [skin], browColor: [skin], mouthColor: [skin], markColor: [skin],
    topColor: [torso], shoulderColor: [torso], sleeveColor: [palette.bodyDark], beltColor: [torso], legwearColor: [palette.bodyDark],
    bootsColor: [palette.bodyDark], accessoryColor: [torso], backColor: [torso], heldColor: [palette.bodyDark],
  };
  if (cat.field === 'eyes') return luma(skin) < 0.3 ? 'accentBright' : 'ink';
  const ranked = contrastKeys(palette, against[cat.colorField], cat.pool);
  if (ranked.length === 0) return cat.pool[0]!;
  return rand() < 0.65 ? ranked[0]! : ranked[Math.min(1, ranked.length - 1)]!;
}

const OPTIONAL_CHANCE = 0.55;

function pickFeature(rand: () => number, cat: ForgeCategory, flavor: OperatorFlavor, species: SpeciesDef): string {
  // A race that has opinions about a slot fills it far more often than a plain one.
  const chance = species.lean[cat.field] ? 0.85 : OPTIONAL_CHANCE;
  if (cat.none && rand() > chance) return cat.none;
  const candidates = cat.none ? cat.ids.filter((id) => id !== cat.none) : cat.ids;
  return pickWeighted(rand, candidates, OPERATOR_LEAN[flavor][cat.field], species.lean[cat.field]);
}

/** Picks every feature and color for a palette; the heart of "generate a look". */
export function generateLook(rand: () => number, palette: SpritePalette, flavor: OperatorFlavor, species: SpeciesDef): OperatorLook {
  const look: Record<string, string> = {};
  for (const cat of FORGE_CATEGORIES) {
    look[cat.field] = pickFeature(rand, cat, flavor, species);
    look[cat.colorField] = colorAgainst(rand, palette, cat);
  }
  return look as unknown as OperatorLook;
}

export function generatePaletteSpec(rand: () => number, species: SpeciesDef): PaletteSpec {
  return {
    scheme: pickOne(rand, species.schemes),
    hue: Math.floor(rand() * 360),
    shade: Math.round(rand() * 100) / 100,
    skin: pickOne(rand, species.skins),
  };
}

export interface GenerateOptions {
  species?: string;
  flavor?: OperatorFlavor;
  build?: string;
  /** When no species is given, draw from the core races only (the faction races stay out of the pool). */
  coreOnly?: boolean;
}

/** A complete random design. The same seed and options always give the same design. */
export function generateOperatorDesign(seed: string, options: GenerateOptions = {}): OperatorDesign {
  const rand = mulberry32(hashString(`forge:${seed}`));
  const species = options.species ? speciesById(options.species) : pickOne(rand, options.coreOnly ? CORE_SPECIES : SPECIES);
  const flavor = options.flavor ?? pickOne(rand, OPERATOR_FLAVORS_LIST);
  const build = options.build ?? pickOne(rand, species.builds);
  const body = bodyFromBuild(build);
  // A little height and width variety on top of the build, so two "Lean" operators are not twins.
  body.height = clamp(body.height + Math.floor(rand() * 3) - 1, HEIGHT_RANGE.min, HEIGHT_RANGE.max);
  const paletteSpec = generatePaletteSpec(rand, species);
  const palette = generatePalette(paletteSpec);
  return { species: species.id, flavor, body, palette, paletteSpec, look: generateLook(rand, palette, flavor, species) };
}

export type RerollTarget = 'all' | 'body' | 'palette' | 'colors' | FeatureField;

/** Rerolls one slice of a design (or all of it), leaving the rest alone. */
export function rerollDesign(design: OperatorDesign, target: RerollTarget, seed: string): OperatorDesign {
  const rand = mulberry32(hashString(`reroll:${target}:${seed}`));
  const species = speciesById(design.species);
  if (target === 'all') return generateOperatorDesign(seed, { species: design.species, flavor: design.flavor });
  if (target === 'body') {
    const body = bodyFromBuild(pickOne(rand, species.builds));
    body.height = clamp(body.height + Math.floor(rand() * 3) - 1, HEIGHT_RANGE.min, HEIGHT_RANGE.max);
    return { ...design, body };
  }
  if (target === 'palette') {
    const paletteSpec = generatePaletteSpec(rand, species);
    const palette = generatePalette(paletteSpec);
    return { ...design, paletteSpec, palette, look: recolorLook(rand, design.look, palette) };
  }
  if (target === 'colors') {
    return { ...design, look: recolorLook(rand, design.look, design.palette) };
  }
  const cat = categoryOf(target);
  return {
    ...design,
    look: {
      ...design.look,
      [cat.field]: pickFeature(rand, cat, design.flavor, species),
      [cat.colorField]: colorAgainst(rand, design.palette, cat),
    },
  };
}

function recolorLook(rand: () => number, look: OperatorLook, palette: SpritePalette): OperatorLook {
  const next = { ...look } as unknown as Record<string, string>;
  for (const cat of FORGE_CATEGORIES) next[cat.colorField] = colorAgainst(rand, palette, cat);
  return next as unknown as OperatorLook;
}

/* ------------------------------------------------------------------ */
/* Validation (saved data and share codes come from outside the code)  */
/* ------------------------------------------------------------------ */

const PALETTE_KEY_SET = new Set<string>(PALETTE_KEYS);

/**
 * Coerces untrusted data into a valid design. Unknown feature ids (a feature
 * removed in a later version, a hand-edited share code) fall back to a safe
 * default instead of crashing the rig builder.
 */
export function normalizeDesign(raw: unknown): OperatorDesign {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fallback = generateOperatorDesign('fallback');
  const species = SPECIES.some((s) => s.id === src.species) ? (src.species as string) : 'human';
  const flavor = OPERATOR_FLAVORS_LIST.includes(src.flavor as OperatorFlavor) ? (src.flavor as OperatorFlavor) : 'street';

  const bodySrc = (src.body && typeof src.body === 'object' ? src.body : {}) as Record<string, unknown>;
  const build = BODY_BUILDS.some((b) => b.id === bodySrc.build) ? (bodySrc.build as string) : 'average';
  const base = bodyFromBuild(build);
  const num = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), lo, hi) : dflt);
  const body: OperatorBody = {
    build,
    height: num(bodySrc.height, HEIGHT_RANGE.min, HEIGHT_RANGE.max, base.height),
    width: num(bodySrc.width, minWidthFor(build), WIDTH_RANGE.max, base.width),
  };

  const palSrc = (src.palette && typeof src.palette === 'object' ? src.palette : {}) as Record<string, unknown>;
  const palette = { ...fallback.palette } as SpritePalette;
  for (const key of PALETTE_KEYS) {
    const value = palSrc[key];
    if (typeof value === 'string' && HEX.test(value)) palette[key] = value;
  }

  const specSrc = (src.paletteSpec && typeof src.paletteSpec === 'object' ? src.paletteSpec : {}) as Record<string, unknown>;
  const paletteSpec: PaletteSpec = {
    scheme: PALETTE_SCHEMES.includes(specSrc.scheme as PaletteScheme) ? (specSrc.scheme as PaletteScheme) : 'analogous',
    hue: num(specSrc.hue, 0, 359, 200),
    shade: typeof specSrc.shade === 'number' ? clamp(specSrc.shade, 0, 1) : 0.5,
    skin: typeof specSrc.skin === 'string' && HEX.test(specSrc.skin) ? specSrc.skin : palette.skin,
  };

  const lookSrc = (src.look && typeof src.look === 'object' ? src.look : {}) as Record<string, unknown>;
  const look: Record<string, string> = {};
  for (const cat of FORGE_CATEGORIES) {
    const value = lookSrc[cat.field];
    look[cat.field] = typeof value === 'string' && cat.ids.includes(value) ? value : (cat.none ?? cat.ids[0]!);
    const color = lookSrc[cat.colorField];
    look[cat.colorField] = typeof color === 'string' && PALETTE_KEY_SET.has(color) ? color : cat.pool[0]!;
  }
  return { species, flavor, body, palette, paletteSpec, look: look as unknown as OperatorLook };
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

const FIRST_NAMES = [
  'Marcus', 'Dee', 'Tavo', 'Renata', 'Jules', 'Kofi', 'Mina', 'Dario', 'Lena', 'Hollis', 'Sade', 'Ozzie', 'Priya', 'Bram', 'Noor',
  'Cass', 'Teo', 'Imani', 'Rhett', 'Vika', 'Amos', 'Lux', 'Odalys', 'Finn', 'Zora', 'Jett', 'Maren', 'Deshawn', 'Ines', 'Cal',
  'Rosalind', 'Tobias', 'Nia', 'Soren', 'Wren', 'Atlas', 'Beatriz', 'Elio', 'Farah', 'Gideon',
];
const LAST_NAMES = [
  'Vandermeer', 'Okafor', 'Brandt', 'Delgado', 'Whitlock', 'Ng', 'Kowalski', 'Reyes', 'Abernathy', 'Sato', 'Lindqvist', 'Boyd',
  'Marchetti', 'Haddad', 'Pruitt', 'Villanueva', 'Stroud', 'Tran', 'Hale', 'Duvall', 'Oyelaran', 'Brzezinski', 'Castellano', 'Fenwick',
];
const NEIGHBORHOODS = [
  'Heritage Hill', 'Eastown', 'Creston', 'Belknap', 'Alger Heights', 'Burton Heights', 'Monroe North', 'Roosevelt Park', 'Wealthy Street',
  'Division Avenue', 'the West Side', 'Standale', 'Plainfield Avenue', 'John Ball Park', 'the Kentwood line', 'Grandville Avenue',
];
const HANDLE_WORDS = [
  'Chrome', 'Lowtide', 'Ghost', 'Voltage', 'Midnight', 'Halo', 'Rust', 'Echo', 'Pulse', 'Bandit', 'Ember', 'Static', 'Relay', 'Neon',
  'Cinder', 'Driftwood', 'Marrow', 'Gravel', 'Velvet', 'Quartz', 'Hex', 'Moth', 'Tangent', 'Overpass',
];
const HANDLE_NOUNS = ['Kid', 'Saint', 'Prophet', 'Ghost', 'Baron', 'Wolf', 'Mayor', 'Captain', 'Doc', 'Fox'];

const TAGLINES: Record<OperatorFlavor, string[]> = {
  street: ['Knows every shortcut and every shortcut knows them.', 'Loud sneakers, louder plans.', 'Block party first, problems second.'],
  tech: ['Fixes it, breaks it, fixes it again.', 'Every gadget is a love language.', 'Reads the manual for fun and ignores it for glory.'],
  mystic: ['Hears things the radio never plays.', 'Walks softly and carries a lantern.', 'The night shift had better manners.'],
  brawler: ['Solves problems at arm\'s length.', 'Politely asked once already.', 'Quiet until the second round.'],
  performer: ['Soundcheck is a lifestyle.', 'The crowd is the instrument.', 'Always on, even when the lights are off.'],
  scout: ['Packs light, plans heavy.', 'Has a map and a backup map.', 'First one in, last one out.'],
  wild: ['Rules are more of a suggestion.', 'Raised by the alley and the aurora.', 'Unpredictable on purpose.'],
};

export interface Identity {
  name: string;
  handle: string;
  tagline: string;
  bio: string;
}

/** Name, handle, tagline and a short bio for a design. Deterministic for a seed. */
export function generateOperatorIdentity(seed: string, design: OperatorDesign): Identity {
  const rand = mulberry32(hashString(`identity:${seed}`));
  const name = `${pickOne(rand, FIRST_NAMES)} ${pickOne(rand, LAST_NAMES)}`;
  const word = pickOne(rand, HANDLE_WORDS);
  const patterns = [
    `DJ ${word}`, `Lil ${word}`, `${word}616`, `Big ${word}`, `${word} the ${pickOne(rand, HANDLE_NOUNS)}`,
    `${word} ${Math.floor(rand() * 90) + 10}`, `Young ${word}`, `${word}Hands`,
  ];
  const handle = pickOne(rand, patterns);
  const tagline = pickOne(rand, TAGLINES[design.flavor]);
  const species = speciesById(design.species);
  const look = design.look;
  const signature = look.headwear !== 'none' ? `${look.headwear} headwear` : `${look.hair} hair`;
  const carry = look.held !== 'none' ? ` Never without the ${look.held}.` : '';
  const kind = species.id === 'human' ? '' : `${species.label}. `;
  const bio = `${kind}Came up around ${pickOne(rand, NEIGHBORHOODS)}. Known for the ${signature} and a ${look.top === 'plain' ? 'clean' : look.top} fit.${carry}`;
  return { name, handle, tagline, bio };
}

/* ------------------------------------------------------------------ */
/* Saved operators and share codes                                     */
/* ------------------------------------------------------------------ */

export interface ForgedOperator {
  /** Always starts with `forge-`. */
  id: string;
  name: string;
  handle: string;
  tagline: string;
  bio: string;
  /** The id of the authored operator whose stats, weapon and ultimate this one uses. */
  kitId: string;
  design: OperatorDesign;
  createdAt: number;
}

export const FORGE_ID_PREFIX = 'forge-';
export const MAX_FORGED_OPERATORS = 60;
export const FORGE_SHARE_PREFIX = 'FORGE1:';

const clean = (value: unknown, max: number, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, max);
  return trimmed || fallback;
};

/** Coerces saved data (or an imported code) into a safe ForgedOperator, or null if it cannot be one. */
export function normalizeForgedOperator(raw: unknown): ForgedOperator | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  if (typeof src.id !== 'string' || !src.id.startsWith(FORGE_ID_PREFIX) || src.id.length > 64) return null;
  if (typeof src.kitId !== 'string') return null;
  return {
    id: src.id,
    name: clean(src.name, 40, 'Unnamed Operator'),
    handle: clean(src.handle, 32, 'Forged'),
    tagline: clean(src.tagline, 120, 'Made in the Forge.'),
    bio: clean(src.bio, 400, 'A one-of-a-kind operator.'),
    kitId: src.kitId,
    design: normalizeDesign(src.design),
    createdAt: typeof src.createdAt === 'number' && Number.isFinite(src.createdAt) ? src.createdAt : 0,
  };
}

export function newForgedId(seed: string, existing: ReadonlySet<string>): string {
  let n = hashString(seed);
  let id = `${FORGE_ID_PREFIX}${n.toString(36)}`;
  while (existing.has(id)) {
    n = hashString(`${id}:${n}`);
    id = `${FORGE_ID_PREFIX}${n.toString(36)}`;
  }
  return id;
}

/** A compact, copy-pasteable text for one operator. */
export function exportForgedOperator(op: ForgedOperator): string {
  const json = JSON.stringify({ ...op, id: undefined });
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `${FORGE_SHARE_PREFIX}${btoa(binary)}`;
}

/** Reads a share code. Returns null for anything that is not a valid code. The imported operator gets a fresh id. */
export function importForgedOperator(code: string, existing: ReadonlySet<string>, now: number): ForgedOperator | null {
  const text = code.trim();
  if (!text.startsWith(FORGE_SHARE_PREFIX)) return null;
  try {
    const binary = atob(text.slice(FORGE_SHARE_PREFIX.length));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const id = newForgedId(`${text}:${now}`, existing);
    return normalizeForgedOperator({ ...parsed, id, createdAt: now });
  } catch {
    return null;
  }
}

/** A finished, named operator from a seed and a kit; what "Generate" produces. */
export function generateForgedOperator(
  seed: string,
  kitId: string,
  existing: ReadonlySet<string>,
  now: number,
  options: GenerateOptions = {},
): ForgedOperator {
  const design = generateOperatorDesign(seed, options);
  const identity = generateOperatorIdentity(seed, design);
  return { id: newForgedId(`${seed}:${now}`, existing), ...identity, kitId, design, createdAt: now };
}
