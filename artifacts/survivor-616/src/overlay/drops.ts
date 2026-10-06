/**
 * What a destroyed part of a web page gives back, by what it WAS: a heading pays out big XP, a button can
 * heal, a large image is a loot crate, an ad frame sets off a sweep. Pure (a table and a roll), so it is
 * tested without a DOM. The engine already pays a little XP for every page block; these are the extras.
 *
 * Quality rises with depth down the page (`depth` 0..1), and loot crates have a per-page budget so a
 * gallery page cannot bury the player in them.
 */
import type { BlockRole } from './pageModel';

export type DropKind = 'xp' | 'health' | 'cred' | 'sweep' | 'loot-box';

export interface Drop {
  kind: DropKind;
  value: number;
}

export interface DropContext {
  role: BlockRole;
  /** Block area in css px squared. */
  area: number;
  /** How far down the page the block sits, 0..1. */
  depth: number;
  /** Loot crates this page may still hand out; the roll lowers it when it spends one. */
  lootLeft: { value: number };
}

export const LOOT_BOX_BUDGET = 14;
export const HEALTH_VALUE = 20;

/** Cred scales with how big the thing was: a banner pays more than a comma. */
export function credValue(area: number): number {
  return Math.min(15, Math.max(2, Math.round(Math.sqrt(Math.max(0, area)) / 12)));
}

/** Rolls the extra drops for one destroyed block. `rng` returns 0..1. */
export function rollDrops(ctx: DropContext, rng: () => number): Drop[] {
  const q = 1 + Math.max(0, Math.min(1, ctx.depth)) * 0.6;
  const chance = (p: number) => rng() < Math.min(0.95, p * q);
  const out: Drop[] = [];
  const cred = () => out.push({ kind: 'cred', value: credValue(ctx.area) });
  const crate = () => {
    if (ctx.lootLeft.value > 0) {
      ctx.lootLeft.value -= 1;
      out.push({ kind: 'loot-box', value: 0 });
    } else {
      out.push({ kind: 'cred', value: credValue(ctx.area) * 3 });
    }
  };

  switch (ctx.role) {
    case 'text':
      if (chance(0.03)) cred();
      break;
    case 'link':
      out.push({ kind: 'xp', value: 4 });
      if (chance(0.04)) cred();
      break;
    case 'heading':
      out.push({ kind: 'xp', value: 12 });
      if (chance(0.35)) cred();
      break;
    case 'button':
      if (chance(0.2)) out.push({ kind: 'health', value: HEALTH_VALUE });
      break;
    case 'input':
      if (chance(0.5)) out.push({ kind: 'health', value: HEALTH_VALUE + 4 });
      break;
    case 'image':
      if (ctx.area >= 40000) crate();
      else if (ctx.area >= 5000) {
        if (chance(0.35)) cred();
      } else if (chance(0.1)) cred();
      break;
    case 'frame':
      out.push({ kind: 'sweep', value: 0 });
      crate();
      break;
    case 'box':
      if (chance(0.05)) cred();
      break;
  }
  return out;
}
