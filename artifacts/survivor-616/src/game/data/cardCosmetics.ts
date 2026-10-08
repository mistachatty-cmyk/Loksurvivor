/**
 * Cosmetic catalog for the Lock Pack Counter (The Neon Sleeve): how LokPacks and
 * LOK cards look. Purely visual: nothing here changes odds, prices or stats.
 *
 * Three kinds, one equipped item per kind:
 * - `packSkin`  how the pack tiles in the shop are drawn
 * - `cardBack`  the face-down side shown while a pack is being opened
 * - `cardFrame` how a collected card is laid out and bordered
 *
 * Ids follow the existing `frame-*` convention. `frame-classic`, `back-default`
 * and `pack-classic` are free starters and are always owned.
 */
import type { CardPackId } from '@/game/types';

export type CardCosmeticKind = 'packSkin' | 'cardBack' | 'cardFrame';
export type CardCosmeticTier = 'standard' | 'uncommon' | 'rare' | 'legendary';

export interface CardCosmeticDef {
  id: string;
  kind: CardCosmeticKind;
  name: string;
  description: string;
  tier: CardCosmeticTier;
  /** Card Credits (CC). 0 means a free starter. */
  cost: number;
}

/** Card Credit price by tier. Shop packs cost 8-64 CC, so a standard sleeve is a few packs. */
export const CARD_COSMETIC_COST: Record<CardCosmeticTier, number> = {
  standard: 30,
  uncommon: 60,
  rare: 120,
  legendary: 240,
};

const def = (
  kind: CardCosmeticKind,
  id: string,
  name: string,
  tier: CardCosmeticTier,
  description: string,
  free = false,
): CardCosmeticDef => ({ id, kind, name, description, tier, cost: free ? 0 : CARD_COSMETIC_COST[tier] });

export const PACK_SKINS: CardCosmeticDef[] = [
  def('packSkin', 'pack-classic', 'Classic Tile', 'standard', 'The plain text tile. Always free.', true),
  def('packSkin', 'pack-foil', 'Foil Wrapper', 'uncommon', 'A crimped foil pouch with its own color, pattern and emblem for every pack.'),
  def('packSkin', 'pack-printed', 'Fighter Print', 'rare', 'A printed booster that features a real fighter or LokPet from the game on the front.'),
  def('packSkin', 'pack-boxed', 'Collector Box', 'legendary', 'A lift-lid collector box with cards standing in the opening.'),
];

export const CARD_BACKS: CardCosmeticDef[] = [
  def('cardBack', 'back-default', 'Standard Back', 'standard', 'The plain 616 back. Always free.', true),
  def('cardBack', 'back-walnut', 'Furniture City Walnut', 'uncommon', 'Carved walnut and a brass hub, straight from the Cabinet Rot workshops.'),
  def('cardBack', 'back-iron', 'Northline Rail Yard', 'uncommon', 'Riveted steel, hazard tape and a gear ring.'),
  def('cardBack', 'back-ice', 'Grand River Floodwall', 'rare', 'Frozen river glass around a cut ice core.'),
  def('cardBack', 'back-neon', 'Neon Arcade', 'rare', 'Black enamel, a hot-pink tube border and a cyan grid.'),
  def('cardBack', 'back-foundry', 'The Soul Foundry', 'rare', 'Cracked cast iron with molten seams.'),
  def('cardBack', 'back-civic', 'Civic Plaza Bronze', 'rare', 'Verdigris copper with a red steel arch.'),
  def('cardBack', 'back-geode', 'Crystal Cellar Geode', 'legendary', 'A split amethyst geode with a faceted core.'),
  def('cardBack', 'back-null', 'Null Sector Rack', 'legendary', 'Server-rack mesh with status lights.'),
];

export const CARD_FRAMES: CardCosmeticDef[] = [
  def('cardFrame', 'frame-classic', 'Classic Frame', 'standard', 'The original binder card. Always free.', true),
  def('cardFrame', 'frame-cyber-matrix', 'Cyber Matrix', 'standard', 'An emerald edge with a soft green glow.'),
  def('cardFrame', 'frame-firefly-amber', 'Firefly Amber', 'standard', 'A warm amber edge.'),
  def('cardFrame', 'frame-abyssal-void', 'Abyssal Void', 'uncommon', 'A deep purple edge.'),
  def('cardFrame', 'frame-retro-pixel', 'Retro Pixel', 'uncommon', 'A pink edge with a cyan ring.'),
  def('cardFrame', 'frame-prismatic-gold', 'Prismatic Gold', 'rare', 'A heavy gold edge.'),
  def('cardFrame', 'frame-printed', 'Printed Stock', 'rare', 'Flat ink on card stock: a halftone art window, a real attack box and a collector number.'),
  def('cardFrame', 'frame-tcg', 'Spellbook Layout', 'legendary', 'A trading-card layout: cost line, art window, type line, rules text, flavor and an attack/HP box.'),
];

export const ALL_CARD_COSMETICS: CardCosmeticDef[] = [...PACK_SKINS, ...CARD_BACKS, ...CARD_FRAMES];

export const CARD_COSMETICS_BY_ID: Record<string, CardCosmeticDef> = Object.fromEntries(
  ALL_CARD_COSMETICS.map((item) => [item.id, item]),
);

export const DEFAULT_PACK_SKIN = 'pack-classic';
export const DEFAULT_CARD_BACK = 'back-default';
export const DEFAULT_CARD_FRAME = 'frame-classic';

export function cardCosmeticsOfKind(kind: CardCosmeticKind): CardCosmeticDef[] {
  return ALL_CARD_COSMETICS.filter((item) => item.kind === kind);
}

/** Free starters are always owned, whatever a saved file says. */
export function isStarterCosmetic(id: string): boolean {
  const item = CARD_COSMETICS_BY_ID[id];
  return Boolean(item && item.cost === 0);
}

/** How a collected card is drawn, derived from the equipped frame id. */
export type CardLayout = 'binder' | 'printed' | 'tcg';
export function cardLayoutForFrame(frameId: string | undefined): CardLayout {
  if (frameId === 'frame-printed') return 'printed';
  if (frameId === 'frame-tcg') return 'tcg';
  return 'binder';
}

/** Foil Wrapper look, one per shop pack. `pattern` names a CSS recipe in cardCosmetics.css. */
export interface FoilPackStyle {
  a: string;
  b: string;
  glow: string;
  pattern: 'tape' | 'stripe' | 'grid' | 'dots' | 'quad' | 'ticket' | 'prism' | 'code' | 'crown' | 'rings' | 'chrome' | 'rays' | 'vault';
  mark: string;
  kicker: string;
}

const FOIL_FALLBACK: FoilPackStyle = { a: '#9aa3b2', b: '#3a3f4d', glow: 'rgba(180,190,210,.35)', pattern: 'tape', mark: '616', kicker: 'LokPack' };

export const FOIL_PACK_STYLES: Partial<Record<CardPackId, FoilPackStyle>> = {
  'penny-sleeve': { ...FOIL_FALLBACK, mark: '1', kicker: 'Penny' },
  street: { a: '#9aa3b2', b: '#3a3f4d', glow: 'rgba(180,190,210,.35)', pattern: 'tape', mark: '1', kicker: 'Single' },
  operative: { a: '#fb923c', b: '#7c2d12', glow: 'rgba(251,146,60,.45)', pattern: 'stripe', mark: '616', kicker: 'Operatives' },
  scenario: { a: '#a3e635', b: '#1a3d0c', glow: 'rgba(163,230,53,.4)', pattern: 'grid', mark: '∞', kicker: 'Scenario' },
  lokpet: { a: '#f0abfc', b: '#581c87', glow: 'rgba(240,171,252,.45)', pattern: 'dots', mark: 'LP', kicker: 'Spirit Beasts' },
  'elemental-pack': { a: '#ffffff', b: '#111111', glow: 'rgba(255,255,255,.3)', pattern: 'quad', mark: '✦', kicker: 'Elements' },
  collector: { a: '#fbbf24', b: '#44290a', glow: 'rgba(251,191,36,.4)', pattern: 'ticket', mark: 'C', kicker: 'Mixed' },
  'prism-lokpack': { a: '#ffffff', b: '#222222', glow: 'rgba(167,139,250,.5)', pattern: 'prism', mark: '◆', kicker: 'Prism' },
  cipher: { a: '#0f172a', b: '#0b0221', glow: 'rgba(0,255,220,.45)', pattern: 'code', mark: '01', kicker: 'Passives' },
  'apex-binder': { a: '#f5c451', b: '#241905', glow: 'rgba(245,196,81,.5)', pattern: 'crown', mark: 'A', kicker: 'Premium' },
  'quantum-vault': { a: '#818cf8', b: '#1b0b46', glow: 'rgba(129,140,248,.55)', pattern: 'rings', mark: 'Q', kicker: 'Singularity' },
  'shinies-cache': { a: '#d9e2ee', b: '#7b869a', glow: 'rgba(255,255,255,.5)', pattern: 'chrome', mark: '★', kicker: 'Guaranteed finish' },
  'apex-dominion': { a: '#ef4444', b: '#3b0505', glow: 'rgba(239,68,68,.55)', pattern: 'rays', mark: '♛', kicker: 'LokPet Apex' },
  'mega-vault': { a: '#27272f', b: '#050507', glow: 'rgba(255,179,71,.5)', pattern: 'vault', mark: '7', kicker: 'Deepest pull' },
};

export function foilStyleFor(packId: CardPackId): FoilPackStyle {
  return FOIL_PACK_STYLES[packId] ?? FOIL_FALLBACK;
}

/**
 * The fighter or LokPet featured on a pack's Fighter Print. `character` ids are
 * `CHARACTERS_BY_ID` keys, `pet` ids are `LOKPET_VARIANTS` ids, so a rename in
 * either catalog is caught by the cardCosmetics test.
 */
export interface FeaturedFigure {
  kind: 'character' | 'pet';
  id: string;
}

export const PACK_FEATURED: Partial<Record<CardPackId, FeaturedFigure>> = {
  street: { kind: 'character', id: 'shade' },
  operative: { kind: 'character', id: 'queenbee' },
  scenario: { kind: 'character', id: 'mile-marker' },
  lokpet: { kind: 'pet', id: 'lil-llama' },
  'elemental-pack': { kind: 'character', id: 'glacierwarden' },
  collector: { kind: 'character', id: 'masky' },
  'prism-lokpack': { kind: 'pet', id: 'prism-moth' },
  cipher: { kind: 'character', id: 'riftwitch' },
  'apex-binder': { kind: 'character', id: 'cinderhalo' },
  'quantum-vault': { kind: 'pet', id: 'void-pup' },
  'shinies-cache': { kind: 'character', id: 'prismrunner' },
  'apex-dominion': { kind: 'pet', id: 'ember-koi' },
  'mega-vault': { kind: 'character', id: 'emberback' },
};

/** The figure shown in the hub of each district card back. */
export const BACK_HUB_FIGURE: Record<string, FeaturedFigure> = {
  'back-walnut': { kind: 'character', id: 'masky' },
  'back-iron': { kind: 'character', id: 'mile-marker' },
  'back-ice': { kind: 'character', id: 'glacierwarden' },
  'back-neon': { kind: 'character', id: 'riftwitch' },
  'back-foundry': { kind: 'character', id: 'cinderhalo' },
  'back-civic': { kind: 'character', id: 'prismrunner' },
  'back-geode': { kind: 'pet', id: 'lil-llama' },
  'back-null': { kind: 'character', id: 'shade' },
};

/** Collector Box shell color per pack, so a shelf of boxes is not one color. */
export type BoxShell = 'walnut' | 'hazard' | 'ice';
export function boxShellFor(packId: CardPackId): BoxShell {
  const style = foilStyleFor(packId);
  if (style.pattern === 'tape' || style.pattern === 'stripe' || style.pattern === 'vault' || style.pattern === 'code') return 'hazard';
  if (style.pattern === 'grid' || style.pattern === 'rings' || style.pattern === 'chrome' || style.pattern === 'quad') return 'ice';
  return 'walnut';
}

/** Short stable "lot" number printed on a pack, so each pack keeps the same one. */
export function packLotNumber(packId: string): string {
  let hash = 0;
  for (let i = 0; i < packId.length; i += 1) hash = (hash * 31 + packId.charCodeAt(i)) >>> 0;
  return `616-${String(100 + (hash % 900))}`;
}

/** Card motion setting for pack and card cosmetics. */
export type CardMotion = 'full' | 'subtle' | 'off';
export const CARD_MOTION_OPTIONS: CardMotion[] = ['full', 'subtle', 'off'];

/** The slice of MetaState the cosmetics read and write. */
export interface CardCosmeticMeta {
  cardFrameSleeves: string[];
  selectedCardFrame: string;
  ownedCardBackIds: string[];
  selectedCardBack: string;
  ownedPackSkinIds: string[];
  selectedPackSkin: string;
}

type OwnedKey = 'cardFrameSleeves' | 'ownedCardBackIds' | 'ownedPackSkinIds';
type SelectedKey = 'selectedCardFrame' | 'selectedCardBack' | 'selectedPackSkin';

const KEYS: Record<CardCosmeticKind, { owned: OwnedKey; selected: SelectedKey; fallback: string }> = {
  cardFrame: { owned: 'cardFrameSleeves', selected: 'selectedCardFrame', fallback: DEFAULT_CARD_FRAME },
  cardBack: { owned: 'ownedCardBackIds', selected: 'selectedCardBack', fallback: DEFAULT_CARD_BACK },
  packSkin: { owned: 'ownedPackSkinIds', selected: 'selectedPackSkin', fallback: DEFAULT_PACK_SKIN },
};

export function isCardCosmeticOwned(meta: CardCosmeticMeta, item: CardCosmeticDef): boolean {
  return item.cost === 0 || meta[KEYS[item.kind].owned].includes(item.id);
}

export function selectedCardCosmeticId(meta: CardCosmeticMeta, kind: CardCosmeticKind): string {
  return meta[KEYS[kind].selected];
}

export function grantCardCosmetic<M extends CardCosmeticMeta>(meta: M, item: CardCosmeticDef): M {
  const key = KEYS[item.kind].owned;
  if (meta[key].includes(item.id)) return meta;
  return { ...meta, [key]: [...meta[key], item.id] };
}

export function equipCardCosmetic<M extends CardCosmeticMeta>(meta: M, item: CardCosmeticDef): M {
  return { ...meta, [KEYS[item.kind].selected]: item.id };
}

function cleanOwned(kind: CardCosmeticKind, raw: unknown): string[] {
  const known = new Set(cardCosmeticsOfKind(kind).map((item) => item.id));
  const ids = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && known.has(id)) : [];
  // Starters are always owned, listed first.
  return [...new Set([KEYS[kind].fallback, ...ids])];
}

/** Validates the saved cosmetics: unknown ids drop out and the equipped item must be owned. */
export function normalizeCardCosmetics(parsed: Record<string, unknown>): CardCosmeticMeta {
  const out = {} as CardCosmeticMeta;
  for (const kind of Object.keys(KEYS) as CardCosmeticKind[]) {
    const { owned, selected, fallback } = KEYS[kind];
    const ownedIds = cleanOwned(kind, parsed[owned]);
    const wanted = parsed[selected];
    out[owned] = ownedIds;
    out[selected] = typeof wanted === 'string' && (ownedIds.includes(wanted) || isStarterCosmetic(wanted)) ? wanted : fallback;
  }
  return out;
}
