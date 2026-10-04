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

/** Display text for each style lives in locales/en.json under settings.fightStyle.<id>.label and .blurb. */
export const FIGHT_STYLES: Array<{ id: FightStyle }> = [
  { id: 'classic' },
  { id: 'quick' },
  { id: 'duo' },
  { id: 'arena' },
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
