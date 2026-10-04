/**
 * Device-local choice of how travel-encounter fights are presented. The
 * classic card-throw popup stays the default; the other three play on the
 * arena engine:
 *   quick -- your lead LokPet, three moves, an eight-round cap
 *   duo   -- your operator and LokPet fight together, operator assist each round
 *   arena -- the full side-by-side battle: every move, finishers, Cheer
 * Layout adapts to the screen in every new style; nothing here is about size.
 */
export type FightStyle = 'classic' | 'quick' | 'duo' | 'arena';

export const FIGHT_STYLES: Array<{ id: FightStyle; label: string; blurb: string }> = [
  { id: 'classic', label: 'Classic', blurb: 'The original card-throw popup. Throw a Battle Deck card or a punch.' },
  { id: 'quick', label: 'Quick', blurb: 'Your lead LokPet, three moves, at most eight rounds, next enemy move shown.' },
  { id: 'duo', label: 'Duo', blurb: 'Operator and LokPet fight together: pick a LokPet move and an operator assist every round.' },
  { id: 'arena', label: 'Arena', blurb: 'The full battle: every move including finishers, Cheer, up to twenty rounds.' },
];

const KEY = 'survivor616.fightstyle';
/** Written by the first quick-fight build, which only had an on/off switch. */
const LEGACY_KEY = 'survivor616.quickfight';

export function getFightStyle(): FightStyle {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored && FIGHT_STYLES.some((style) => style.id === stored)) return stored as FightStyle;
    if (window.localStorage.getItem(LEGACY_KEY) === 'on') return 'quick';
  } catch {
    // Storage unavailable -- fall through to the default.
  }
  return 'classic';
}

export function setFightStyle(style: FightStyle): void {
  try {
    window.localStorage.setItem(KEY, style);
  } catch {
    // Storage unavailable -- the choice lasts until reload.
  }
}
