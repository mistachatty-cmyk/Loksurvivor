import type { RunWeapon, WeaponDef, WeaponMilestone } from '@/game/types';

/** What a weapon can do at its current level: the effect fields of every milestone reached, later ones winning. */
export interface MilestoneEffects {
  hitBurst?: WeaponMilestone['hitBurst'];
  echo?: WeaponMilestone['echo'];
  surge?: WeaponMilestone['surge'];
  every?: WeaponMilestone['every'];
}

const NONE: MilestoneEffects = {};

/** Milestones reached at this level, lowest first. */
export function reachedMilestones(def: Pick<WeaponDef, 'milestones'>, level: number): WeaponMilestone[] {
  return (def.milestones ?? []).filter((m) => m.level <= level).sort((a, b) => a.level - b.level);
}

export function milestoneEffects(def: Pick<WeaponDef, 'milestones'>, level: number): MilestoneEffects {
  if (!def.milestones || def.milestones.length === 0) return NONE;
  const out: MilestoneEffects = {};
  for (const m of reachedMilestones(def, level)) {
    if (m.hitBurst) out.hitBurst = m.hitBurst;
    if (m.echo) out.echo = m.echo;
    if (m.surge) out.surge = m.surge;
    if (m.every) out.every = m.every;
  }
  return out;
}

/** Milestones newly reached since the weapon last checked. Marks them granted and adds their bonus pieces. */
export function claimMilestones(weapon: RunWeapon): WeaponMilestone[] {
  if (!weapon.def.milestones || weapon.def.milestones.length === 0) return [];
  const already = weapon.milestoneLevel ?? 1;
  const fresh = reachedMilestones(weapon.def, weapon.level).filter((m) => m.level > already);
  if (fresh.length === 0) return [];
  for (const m of fresh) weapon.count += m.bonusCount ?? 0;
  weapon.milestoneLevel = Math.max(already, ...fresh.map((m) => m.level));
  return fresh;
}

/** True while a surge is lit, as a pure function of run time so it replays the same every time. */
export function surgeActive(surge: NonNullable<MilestoneEffects['surge']> | undefined, now: number): boolean {
  if (!surge) return false;
  return now % surge.everyMs < surge.durationMs;
}

/** True on every Nth cast (the Nth, 2Nth...). `casts` is the count including the one being fired. */
export function everyNth(every: MilestoneEffects['every'], casts: number): boolean {
  return Boolean(every) && casts > 0 && casts % every!.casts === 0;
}
