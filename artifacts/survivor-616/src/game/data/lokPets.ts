import type {
  LokPetAttackKind,
  LokPetElement,
  LokPetPalette,
  LokPetRoll,
  LokPetRarity,
  LokPetSilhouette,
  LokPetStatSheet,
  LokPetVariantDef,
  SpritePalette,
  SpriteRig,
} from '@/game/types';
import { blobRig } from '@/game/sprites/rigs';

/** Original silhouette and palette sheets for the temporary LokPet family. */
export const LOKPET_VARIANTS: LokPetVariantDef[] = [
  { id: 'moss-pouncer', name: 'Moss Pouncer', family: 'animal', silhouette: 'pouncer', palette: { body: '#54734c', bodyDark: '#26392c', accent: '#b8ff5c', glow: '#7dffb2', eye: '#fff1a8' }, description: 'A spring-loaded alley creature with leaf-bright eyes.' },
  { id: 'cinder-pouncer', name: 'Cinder Pouncer', family: 'animal', silhouette: 'pouncer', palette: { body: '#a94f45', bodyDark: '#42252c', accent: '#ffb86b', glow: '#ff6b35', eye: '#ffe08a' }, description: 'A warm little runner that smells faintly of rain and sparks.' },
  { id: 'chalk-grin', name: 'Chalk Grin', family: 'ghoul', silhouette: 'skull', palette: { body: '#b9c2b0', bodyDark: '#394348', accent: '#d6a8ff', glow: '#a78bfa', eye: '#fef3c7' }, description: 'A tiny graveyard grin with a soft spot for loud noises.' },
  { id: 'violet-husk', name: 'Violet Husk', family: 'ghoul', silhouette: 'skull', palette: { body: '#69547e', bodyDark: '#271f3b', accent: '#ff7ab8', glow: '#e879f9', eye: '#f5d0fe' }, description: 'A hollow-faced helper that leaves a lavender afterimage.' },
  { id: 'ink-wing', name: 'Ink Wing', family: 'bat', silhouette: 'winglet', palette: { body: '#2e365e', bodyDark: '#12152c', accent: '#67e8f9', glow: '#4de1ff', eye: '#fef08a' }, description: 'A pocket night-bat folded from storm-colored shadow.' },
  { id: 'copper-wing', name: 'Copper Wing', family: 'bat', silhouette: 'winglet', palette: { body: '#8a5540', bodyDark: '#38262d', accent: '#ffd166', glow: '#ff9f43', eye: '#fff7ed' }, description: 'A bright-eared flier that zigzags through crowded streets.' },
  { id: 'signal-mote', name: 'Signal Mote', family: 'mote', silhouette: 'spark', palette: { body: '#75a7b8', bodyDark: '#1d3f50', accent: '#b8ff5c', glow: '#6ee7ff', eye: '#ffffff' }, description: 'A floating street signal that hums when danger gets close.' },
  { id: 'pink-static', name: 'Pink Static', family: 'mote', silhouette: 'spark', palette: { body: '#a64f83', bodyDark: '#3b1d43', accent: '#ff7ab8', glow: '#f0abfc', eye: '#fff1f2' }, description: 'A jittering spark that refuses to occupy the same pixel twice.' },
  { id: 'rain-jelly', name: 'Rain Jelly', family: 'blob', silhouette: 'jelly', palette: { body: '#3d8b87', bodyDark: '#173c42', accent: '#67e8f9', glow: '#35d0bb', eye: '#d9f99d' }, description: 'A cheerful puddle-shape with excellent crowd control instincts.' },
  { id: 'plum-jelly', name: 'Plum Jelly', family: 'blob', silhouette: 'jelly', palette: { body: '#87529a', bodyDark: '#33214c', accent: '#f0abfc', glow: '#c084fc', eye: '#fef3c7' }, description: 'A buoyant little lump that pulses in time with the city lights.' },
  { id: 'tin-cricket', name: 'Tin Cricket', family: 'mechanical', silhouette: 'clockwork', palette: { body: '#788b99', bodyDark: '#273440', accent: '#fbbf24', glow: '#f59e0b', eye: '#fef08a' }, description: 'A clockwork chirper assembled from three harmless loose parts.' },
  { id: 'neon-gear', name: 'Neon Gear', family: 'mechanical', silhouette: 'clockwork', palette: { body: '#43677a', bodyDark: '#142a3a', accent: '#4de1ff', glow: '#22d3ee', eye: '#ffffff' }, description: 'A spinning pocket machine with a very small emergency siren.' },
];

export const LOKPET_STAT_SHEETS: LokPetStatSheet[] = [
  { rarity: 'common', label: 'Common', powerMultiplier: 0.84, health: 34, moveSpeed: 112, damage: 7, cooldownMs: 1100, range: 220, projectileSpeed: 250, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 90000, weight: 46 },
  { rarity: 'charged', label: 'Charged', powerMultiplier: 1.0, health: 48, moveSpeed: 125, damage: 11, cooldownMs: 900, range: 250, projectileSpeed: 285, explosionRadius: 0, pulseRadius: 74, lifetimeMs: 96000, weight: 32 },
  { rarity: 'rare', label: 'Rare', powerMultiplier: 1.2, health: 68, moveSpeed: 140, damage: 16, cooldownMs: 720, range: 285, projectileSpeed: 330, explosionRadius: 52, pulseRadius: 92, lifetimeMs: 102000, weight: 17 },
  { rarity: 'mythic', label: 'Mythic', powerMultiplier: 1.46, health: 96, moveSpeed: 158, damage: 23, cooldownMs: 560, range: 325, projectileSpeed: 390, explosionRadius: 68, pulseRadius: 116, lifetimeMs: 108000, weight: 5 },
];

const ATTACKS: Array<{ kind: LokPetAttackKind; label: string }> = [
  { kind: 'shot', label: 'single shot' },
  { kind: 'rapid-shot', label: 'rapid fire' },
  { kind: 'heavy-shot', label: 'heavy shot' },
  { kind: 'pulse', label: 'pulsating field' },
  { kind: 'explosion', label: 'burst explosion' },
];

const PET_NAMES = [
  'Biscuit', 'Cricket', 'Flicker', 'Glim', 'Hush', 'Kip', 'Lumen', 'Mallow',
  'Nix', 'Pip', 'Rook', 'Soot', 'Tumble', 'Vex', 'Wisp', 'Zig',
];

const ELEMENTS: Array<{ element: LokPetElement; label: string }> = [
  { element: 'none', label: 'kinetic' },
  { element: 'fire', label: 'fire' },
  { element: 'freeze', label: 'freeze' },
  { element: 'slow', label: 'slow' },
];

function pick<T>(rng: () => number, values: T[]): T {
  return values[Math.floor(rng() * values.length)]!;
}

function pickWeightedSheet(rng: () => number): LokPetStatSheet {
  const total = LOKPET_STAT_SHEETS.reduce((sum, sheet) => sum + sheet.weight, 0);
  let roll = rng() * total;
  for (const sheet of LOKPET_STAT_SHEETS) {
    roll -= sheet.weight;
    if (roll <= 0) return sheet;
  }
  return LOKPET_STAT_SHEETS[0]!;
}

function pickElement(rng: () => number, attackKind: LokPetAttackKind): { element: LokPetElement; label: string } {
  // Keep combinations readable: pulses prefer control, while explosions
  // prefer fire. The generator still exposes every elemental behavior.
  const options = attackKind === 'pulse'
    ? ELEMENTS.filter((entry) => entry.element !== 'none')
    : attackKind === 'explosion'
      ? ELEMENTS.filter((entry) => entry.element === 'none' || entry.element === 'fire' || entry.element === 'slow')
      : ELEMENTS;
  return pick(rng, options);
}

/** Generate one deterministic, chest-ready LokPet blueprint. */
export function rollLokPet(rng: () => number): LokPetRoll {
  const variant = pick(rng, LOKPET_VARIANTS);
  const sheet = pickWeightedSheet(rng);
  const attack = pick(rng, ATTACKS);
  const element = pickElement(rng, attack.kind);
  const name = `${pick(rng, PET_NAMES)} · ${variant.name}`;
  const jitter = 0.92 + rng() * 0.16;
  const cooldownJitter = 0.94 + rng() * 0.12;
  const stats = {
    health: Math.max(18, Math.round(sheet.health * jitter)),
    moveSpeed: Math.round(sheet.moveSpeed * jitter),
    damage: Math.max(1, Math.round(sheet.damage * sheet.powerMultiplier * jitter)),
    cooldownMs: Math.round(sheet.cooldownMs * cooldownJitter),
    range: Math.round(sheet.range * (0.94 + rng() * 0.12)),
    projectileSpeed: Math.round(sheet.projectileSpeed * (0.94 + rng() * 0.12)),
    explosionRadius: sheet.explosionRadius ? Math.round(sheet.explosionRadius * jitter) : 0,
    pulseRadius: sheet.pulseRadius ? Math.round(sheet.pulseRadius * jitter) : 0,
    lifetimeMs: sheet.lifetimeMs,
  };
  const attackLabel = ATTACKS.find((entry) => entry.kind === attack.kind)!.label;
  const traitLabel = element.element === 'none' ? attackLabel : `${attackLabel} · ${element.label}`;

  return {
    name,
    variantId: variant.id,
    family: variant.family,
    silhouette: variant.silhouette,
    palette: variant.palette,
    rarity: sheet.rarity,
    rarityLabel: sheet.label,
    attackKind: attack.kind,
    element: element.element,
    elementLabel: element.label,
    description: `${variant.description} Rolls ${traitLabel}.`,
    stats,
    traitLabel,
  };
}

export const LOKPET_VARIANTS_BY_ID: Record<string, LokPetVariantDef> =
  Object.fromEntries(LOKPET_VARIANTS.map((variant) => [variant.id, variant]));

export const LOKPET_RARITY_COLORS: Record<LokPetRarity, string> = {
  common: '#94a3b8',
  charged: '#6ee7ff',
  rare: '#c084fc',
  mythic: '#ffd166',
};

export const LOKPET_ELEMENT_COLORS: Record<LokPetElement, string> = {
  none: '#e2e8f0',
  fire: '#ff6b35',
  freeze: '#8be9ff',
  slow: '#a78bfa',
};

export const LOKPET_SILHOUETTE_LABELS: Record<LokPetSilhouette, string> = {
  pouncer: 'Pouncer',
  skull: 'Ghoul',
  winglet: 'Bat',
  spark: 'Mote',
  jelly: 'Blob',
  clockwork: 'Clockwork',
};

/**
 * Real procedural rigs for each LokPet silhouette, reusing blobRig instead of
 * the one-off ctx.beginPath shapes the renderer and UI used to draw by hand.
 * Each family gets a distinct flag combination so they read apart even
 * before palette is applied: pouncer (legs), skull (spiked ridge), winglet
 * (wings), spark (smallest, plain), jelly (biggest, plain), clockwork
 * (spiked + legged).
 */
const LOKPET_RIGS: Record<LokPetSilhouette, SpriteRig> = {
  pouncer: blobRig({ height: 15, width: 12, tendrils: true }),
  skull: blobRig({ height: 14, width: 11, spikes: true }),
  winglet: blobRig({ height: 13, width: 12, wings: true }),
  spark: blobRig({ height: 10, width: 9 }),
  jelly: blobRig({ height: 17, width: 15 }),
  clockwork: blobRig({ height: 14, width: 12, spikes: true, tendrils: true }),
};

export function lokPetRig(silhouette: LokPetSilhouette): SpriteRig {
  return LOKPET_RIGS[silhouette];
}

/** Adapts a LokPet's compact 5-color palette to the rig renderer's shape. */
export function lokPetSpritePalette(palette: LokPetPalette): SpritePalette {
  return {
    ink: palette.bodyDark,
    body: palette.body,
    bodyDark: palette.bodyDark,
    accent: palette.accent,
    accentBright: palette.glow,
    skin: palette.eye,
    glow: palette.glow,
  };
}