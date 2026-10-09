/**
 * Intro easter eggs: small badges that pop in a corner of the title screen.
 *
 * Each egg is one row. Eggs with a `weight` can drift in on their own now and then;
 * eggs with a `word` also appear the moment the player types it. Pure flavor, no
 * mechanical effect. Adding an egg means adding a row and its two locale strings.
 */
export interface IntroEggDef {
  id: string;
  /** Locale keys for the badge. */
  titleKey: string;
  lineKey: string;
  accent: string;
  /** Relative chance among the random pops; leave out for a typed-only egg. */
  weight?: number;
  /** Typed (letters and digits only, lowercase) to summon it on demand. */
  word?: string;
}

export const INTRO_EGGS: IntroEggDef[] = [
  {
    id: 'perfect-legend',
    titleKey: 'egg.perfect-legend.title',
    lineKey: 'egg.perfect-legend.line',
    accent: '#facc15',
    weight: 5,
    word: 'l13gend',
  },
  {
    id: 'bridge-616',
    titleKey: 'egg.bridge-616.title',
    lineKey: 'egg.bridge-616.line',
    accent: '#38bdf8',
    weight: 4,
    word: 'gr616',
  },
  {
    id: 'owl-wink',
    titleKey: 'egg.owl-wink.title',
    lineKey: 'egg.owl-wink.line',
    accent: '#c084fc',
    weight: 3,
    word: 'hoot',
  },
  {
    id: 'static-mite',
    titleKey: 'egg.static-mite.title',
    lineKey: 'egg.static-mite.line',
    accent: '#4ade80',
    weight: 3,
    word: 'squish',
  },
  {
    id: 'ten-hit-combo',
    titleKey: 'egg.ten-hit-combo.title',
    lineKey: 'egg.ten-hit-combo.line',
    accent: '#f87171',
    word: 'hadouken',
  },
];

/** Chance that a title screen visit brings any random pop at all. */
export const INTRO_EGG_POP_CHANCE = 0.18;

/** How long a badge stays up. */
export const INTRO_EGG_SHOW_MS = 6000;

/** Weighted pick among the random-pop eggs, or null when this visit gets none. */
export function pickIntroEgg(rng: () => number, eggs: readonly IntroEggDef[] = INTRO_EGGS, chance = INTRO_EGG_POP_CHANCE): IntroEggDef | null {
  if (rng() >= chance) return null;
  const pool = eggs.filter((egg) => (egg.weight ?? 0) > 0);
  const total = pool.reduce((sum, egg) => sum + (egg.weight ?? 0), 0);
  if (total <= 0) return null;
  let pick = rng() * total;
  for (const egg of pool) {
    pick -= egg.weight ?? 0;
    if (pick <= 0) return egg;
  }
  return pool[pool.length - 1] ?? null;
}

/** The egg whose `word` the typed text now ends with, if any. */
export function eggForTyped(typed: string, eggs: readonly IntroEggDef[] = INTRO_EGGS): IntroEggDef | null {
  const text = typed.toLowerCase();
  return eggs.find((egg) => egg.word !== undefined && text.endsWith(egg.word)) ?? null;
}
