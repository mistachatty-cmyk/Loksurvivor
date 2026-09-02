import { CHARACTERS } from './characters';
import { EVOLUTIONS } from './evolutions';
import { RELIC_RECIPES } from './relics';
import { WEAPONS } from './weapons';
import type { WeaponDef, WeaponKind } from '@/game/types';

export interface WeaponPixelModel {
  id: string;
  kind: WeaponKind;
  pixels: ReadonlyArray<readonly [number, number, tone: 0 | 1 | 2]>;
}

const KIND_PIXELS: Record<WeaponKind, ReadonlyArray<readonly [number, number, 0 | 1 | 2]>> = {
  melee: [[3,12,0],[4,11,0],[5,10,1],[6,9,1],[7,8,1],[8,7,1],[9,6,1],[10,5,2],[11,4,2],[12,3,2],[4,12,1]],
  projectile: [[2,8,0],[3,8,0],[4,8,1],[5,8,1],[6,8,1],[7,8,1],[8,7,1],[8,8,2],[8,9,1],[9,6,1],[9,7,2],[9,8,2],[9,9,2],[9,10,1],[10,8,2],[11,8,2],[12,8,1]],
  orbit: [[4,5,0],[5,4,0],[6,3,1],[8,3,1],[10,4,1],[11,5,0],[12,7,0],[12,9,1],[11,11,0],[9,12,1],[7,12,1],[5,11,0],[4,10,0],[3,8,1],[8,8,2]],
  aura: [[8,3,0],[5,4,0],[11,4,0],[4,6,1],[12,6,1],[3,8,0],[6,8,1],[7,7,2],[8,6,2],[9,7,2],[10,8,1],[8,10,2],[4,10,1],[12,10,1],[5,12,0],[11,12,0],[8,13,0]],
  homing: [[3,12,0],[4,11,0],[5,10,1],[6,8,1],[7,6,1],[9,5,2],[10,5,2],[11,6,2],[12,7,1],[10,7,2],[12,5,1]],
  nova: [[8,2,1],[8,5,0],[3,4,1],[5,6,0],[13,4,1],[11,6,0],[2,8,1],[5,8,0],[7,7,2],[8,7,2],[9,7,2],[7,8,2],[8,8,2],[9,8,2],[7,9,2],[8,9,2],[9,9,2],[11,8,0],[14,8,1],[5,10,0],[3,12,1],[11,10,0],[13,12,1],[8,11,0],[8,14,1]],
  sweep: [[2,11,0],[3,9,0],[4,7,1],[5,6,1],[6,5,1],[8,4,2],[10,5,2],[11,6,1],[12,7,1],[13,9,0],[14,11,0],[5,11,1],[6,12,1],[7,12,2],[8,13,2],[9,12,2],[10,12,1],[11,11,1]],
  wave: [[3,5,0],[5,5,1],[7,5,2],[9,5,1],[11,5,0],[4,8,0],[6,8,1],[8,8,2],[10,8,1],[12,8,0],[3,11,0],[5,11,1],[7,11,2],[9,11,1],[11,11,0]],
  laser: [[2,7,0],[3,7,1],[4,7,1],[5,7,2],[6,7,2],[7,7,2],[8,7,2],[9,7,2],[10,7,2],[11,7,1],[12,7,1],[13,7,0],[2,8,0],[3,8,1],[4,8,1],[5,8,2],[6,8,2],[7,8,2],[8,8,2],[9,8,2],[10,8,2],[11,8,1],[12,8,1],[13,8,0]],
  hazard: [[8,2,0],[7,4,1],[9,4,1],[6,6,1],[10,6,1],[5,8,1],[8,7,2],[11,8,1],[4,10,0],[7,10,2],[8,10,2],[9,10,2],[12,10,0],[3,12,0],[4,12,1],[5,12,1],[6,12,1],[7,12,1],[8,12,1],[9,12,1],[10,12,1],[11,12,1],[12,12,1],[13,12,0]],
  teleport: [[5,3,0],[7,3,1],[9,3,1],[11,4,0],[12,6,1],[12,8,2],[11,10,1],[10,11,0],[8,12,1],[6,12,1],[4,11,0],[3,9,1],[3,7,2],[4,5,1],[7,7,2],[8,8,2],[9,9,2]],
  convert: [[4,5,0],[5,4,1],[7,4,1],[8,5,2],[8,7,2],[7,8,1],[5,8,1],[4,7,0],[8,9,2],[9,8,1],[11,8,1],[12,9,0],[12,11,0],[11,12,1],[9,12,1],[8,11,2]],
  punch: [[3,7,0],[4,5,1],[6,5,1],[7,3,0],[8,5,2],[10,4,1],[11,6,1],[13,7,0],[11,8,2],[12,10,0],[9,10,2],[8,13,0],[7,10,2],[5,11,1],[5,9,2],[3,9,0],[7,7,2],[8,7,2],[9,7,2],[7,8,2],[8,8,2],[9,8,2],[8,9,2]],
  follower: [[5,6,0],[6,5,1],[7,6,2],[6,7,1],[10,9,0],[11,8,1],[12,9,2],[11,10,1],[3,11,0],[4,10,1],[5,11,1],[4,12,0]],
};

function hashId(id: string): number {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function createWeaponPixelModel(id: string, kind: WeaponKind): WeaponPixelModel {
  const pixels = [...KIND_PIXELS[kind]];
  let hash = hashId(id);
  for (let index = 0; index < 5; index += 1) {
    const x = 2 + (hash % 12);
    hash = Math.floor(hash / 13) ^ (hash << 3);
    const y = 2 + (Math.abs(hash) % 12);
    hash = Math.floor(hash / 11) ^ (hash << 2);
    pixels.push([x, y, index % 2 === 0 ? 2 : 0]);
  }
  return { id, kind, pixels };
}

const BASE_WEAPONS = [...WEAPONS, ...CHARACTERS.map((character) => character.weapon)];
const BASE_WEAPONS_BY_ID = new Map(BASE_WEAPONS.map((weapon) => [weapon.id, weapon]));

export const ALL_WEAPON_DEFS: WeaponDef[] = [
  ...BASE_WEAPONS,
  ...EVOLUTIONS.map((evolution) => ({
    ...evolution.result,
    kind: evolution.result.kind ?? BASE_WEAPONS_BY_ID.get(evolution.baseWeaponId)?.kind ?? 'projectile',
  })),
  ...RELIC_RECIPES.map((recipe) => recipe.result),
].filter((weapon, index, catalog) => catalog.findIndex((candidate) => candidate.id === weapon.id) === index);

export const WEAPON_PIXEL_MODELS: Record<string, WeaponPixelModel> = Object.fromEntries(
  ALL_WEAPON_DEFS.map((weapon) => [weapon.id, createWeaponPixelModel(weapon.id, weapon.kind)]),
);

export function getWeaponPixelModel(id: string | undefined, kind: WeaponKind): WeaponPixelModel {
  if (id && WEAPON_PIXEL_MODELS[id]) return WEAPON_PIXEL_MODELS[id];
  return createWeaponPixelModel(id ?? `unknown-${kind}`, kind);
}
