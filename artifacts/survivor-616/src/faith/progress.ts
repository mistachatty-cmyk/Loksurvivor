// Faith growth (docs/184): one gentle bar that only ever fills. Nothing is lost for missing a day. Names are plain growth words, the same for everyone.
import type { FaithState } from './faithStore';
export const LEVELS = ['Seed', 'Sprout', 'Sapling', 'Branch', 'Vine', 'Grove', 'Orchard', 'Harvest', 'Spring', 'Evergreen'] as const;
const cum = (n: number): number => 10 * n * (n - 1);   // growth needed to reach level n: 0, 20, 60, 120, 200 ...
/** Growth points. Opening verses counts up to 100 so tapping "Another verse" cannot run it up. */
export function growth(s: FaithState): number {
  return Math.min(s.opened, 100) + s.chapters.length * 5 + s.marks.length * 2 + new Set(s.days).size * 3 + (s.bounces ?? 0) * 2;
}
export interface Level { level: number; name: string; xp: number; into: number; need: number; pct: number; max: boolean }
export function levelOf(xp: number): Level {
  const x = Math.max(0, Math.floor(xp)); let n = 1; while (n < LEVELS.length && x >= cum(n + 1)) n++;
  const max = n === LEVELS.length, into = x - cum(n), need = max ? 0 : cum(n + 1) - cum(n);
  return { level: n, name: LEVELS[n - 1], xp: x, into, need, pct: max ? 100 : Math.round((into / need) * 100), max };
}
export const faithLevel = (s: FaithState): Level => levelOf(growth(s));
/** Markup for the growth bar. */
export function growthBar(l: Level): string {
  return `<div class="fg" role="group" aria-label="Faith growth"><div class="fg-top"><b>${l.name}</b><span>${l.max ? 'Fully grown. Keep going at your own pace.' : `${l.into} of ${l.need} to ${LEVELS[l.level]}`}</span></div><div class="fg-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${l.pct}"><i style="width:${l.pct}%"></i></div></div>`;
}
