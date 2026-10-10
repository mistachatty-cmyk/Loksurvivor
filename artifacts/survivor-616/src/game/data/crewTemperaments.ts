/**
 * How each rescued crew member carries themselves on the hideout strip.
 * Pure data read by `engine/hideoutCrewLife.ts`: a new ally needs no engine
 * change, only (optionally) a row here -- anyone without one gets the calm default.
 *
 * Every trait is a plain number so personality reads in motion, not text:
 * how fast and bouncy someone walks, how far from their spot they roam, how soon
 * they get up to something, whether they seek people out, keep to themselves, or
 * would rather fiddle with something.
 */

export interface CrewTemperament {
  /** Walking speed in strip pixels per millisecond. */
  speed: number;
  /** How far from their spot they stray, in strip pixels. */
  roam: number;
  /** 0..1: how soon they stop standing and do something. */
  restless: number;
  /** 0..1: how often they walk over to chat with another crew member. */
  social: number;
  /** 0..1: how likely they are to wander up to a prop, or to you. */
  curious: number;
  /** 0..1: how likely they are to back away when you walk up. */
  shy: number;
  /** 0..1: how much of their idle time goes to working with their hands. */
  busy: number;
  /** Vertical bob of each stride, in strip pixels. */
  bounce: number;
  /** Stride rate, radians per millisecond. */
  cadence: number;
}

export const DEFAULT_CREW_TEMPERAMENT: CrewTemperament = {
  speed: 0.042, roam: 110, restless: 0.45, social: 0.5, curious: 0.4, shy: 0.2, busy: 0.3, bounce: 2, cadence: 0.012,
};

const t = (overrides: Partial<CrewTemperament>): CrewTemperament => ({ ...DEFAULT_CREW_TEMPERAMENT, ...overrides });

/** Keyed by `AllyDef.id`. */
export const CREW_TEMPERAMENTS: Record<string, CrewTemperament> = {
  // Brisk, chatty shopkeeper who is always tidying something.
  vee: t({ speed: 0.055, roam: 150, restless: 0.55, social: 0.85, curious: 0.4, shy: 0, busy: 0.6, bounce: 2.4, cadence: 0.014 }),
  // Slow and measured: long pauses, long looks, rarely hurries.
  deacon: t({ speed: 0.026, roam: 80, restless: 0.22, social: 0.35, curious: 0.2, shy: 0.1, busy: 0.2, bounce: 1, cadence: 0.008 }),
  // Restless rooftop tagger: fast, springy, into everything.
  nyx: t({ speed: 0.075, roam: 220, restless: 0.9, social: 0.5, curious: 0.85, shy: 0.1, busy: 0.4, bounce: 4, cadence: 0.02 }),
  // Calm, a little guarded.
  sable: t({ speed: 0.034, roam: 100, restless: 0.3, social: 0.3, curious: 0.5, shy: 0.55, busy: 0.7, bounce: 1.4, cadence: 0.01 }),
  // Busy kitchen: never still for long, always glad of company.
  mamajo: t({ speed: 0.05, roam: 100, restless: 0.7, social: 0.9, curious: 0.3, shy: 0, busy: 0.8, bounce: 2.2, cadence: 0.013 }),
  // The commander holds her ground and lets others come to her.
  bulbosa: t({ speed: 0.03, roam: 60, restless: 0.18, social: 0.4, curious: 0.25, shy: 0, busy: 0.1, bounce: 1.2, cadence: 0.009 }),
  // Drifts about looking for the shot.
  morrow: t({ speed: 0.044, roam: 260, restless: 0.75, social: 0.3, curious: 0.9, shy: 0.3, busy: 0.3, bounce: 1.6, cadence: 0.011 }),
  // Tinkerer: happiest with something in their hands.
  cinder: t({ speed: 0.05, roam: 120, restless: 0.5, social: 0.4, curious: 0.7, shy: 0.2, busy: 0.95, bounce: 2.2, cadence: 0.014 }),
  // Runner: the fastest, bounciest and least able to stand still.
  pippa: t({ speed: 0.085, roam: 240, restless: 0.95, social: 0.8, curious: 0.7, shy: 0, busy: 0.2, bounce: 5, cadence: 0.024 }),
  // Easygoing ambler who stops to talk to anyone.
  denny: t({ speed: 0.038, roam: 170, restless: 0.5, social: 0.85, curious: 0.5, shy: 0, busy: 0.25, bounce: 2, cadence: 0.011 }),
  // Keeps to her stall.
  ruth: t({ speed: 0.034, roam: 60, restless: 0.3, social: 0.7, curious: 0.3, shy: 0.1, busy: 0.7, bounce: 1.4, cadence: 0.01 }),
  frankie: t({ speed: 0.05, roam: 140, restless: 0.55, social: 0.6, curious: 0.5, shy: 0.1, busy: 0.7, bounce: 2.4, cadence: 0.014 }),
  // Prim and steady.
  constance: t({ speed: 0.038, roam: 80, restless: 0.32, social: 0.5, curious: 0.2, shy: 0.3, busy: 0.5, bounce: 1.1, cadence: 0.009 }),
  theo: t({ speed: 0.045, roam: 120, restless: 0.5, social: 0.35, curious: 0.6, shy: 0.4, busy: 0.85, bounce: 1.8, cadence: 0.012 }),
  otis: t({ speed: 0.05, roam: 130, restless: 0.6, social: 0.6, curious: 0.7, shy: 0.2, busy: 0.9, bounce: 2.2, cadence: 0.014 }),
  // A process that does not quite behave like a person: drifts, shies, stares.
  archivist: t({ speed: 0.03, roam: 200, restless: 0.6, social: 0.2, curious: 0.9, shy: 0.65, busy: 0.4, bounce: 0.8, cadence: 0.007 }),
  // Last officer standing: patrols in a straight, steady march.
  sarge: t({ speed: 0.055, roam: 200, restless: 0.7, social: 0.35, curious: 0.2, shy: 0, busy: 0.2, bounce: 3, cadence: 0.016 }),
  'patch-mercer': t({ speed: 0.05, roam: 110, restless: 0.55, social: 0.45, curious: 0.5, shy: 0.2, busy: 0.9, bounce: 2, cadence: 0.013 }),
  // Held a door shut against the dark: steady, watchful, keeps near the exit and does not like surprises.
  'latch-brooks': t({ speed: 0.034, roam: 70, restless: 0.28, social: 0.4, curious: 0.25, shy: 0.45, busy: 0.6, bounce: 1.2, cadence: 0.009 }),
  'mara-vance': t({ speed: 0.07, roam: 180, restless: 0.8, social: 0.5, curious: 0.5, shy: 0.1, busy: 0.4, bounce: 3.6, cadence: 0.019 }),
};

export function crewTemperamentFor(id: string): CrewTemperament {
  return CREW_TEMPERAMENTS[id] ?? DEFAULT_CREW_TEMPERAMENT;
}
