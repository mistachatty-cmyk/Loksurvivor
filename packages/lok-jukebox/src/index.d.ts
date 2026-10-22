export type TheaterLevelNumber = 1 | 2 | 3;
export type TheaterLevelName = 'active' | 'dim' | 'theater';

export interface TheaterLevel {
  level: TheaterLevelNumber;
  name: TheaterLevelName;
  /** 0 hidden, 1 fully visible. */
  uiOpacity: number;
  /** Muffling amount; 0 is clear sound. */
  dampen: number;
}

export interface TheaterOptions {
  /** While paused the level stays at 1. Default false. */
  paused?: boolean;
  /** With false the sound is never dampened, only the UI fades. Default true. */
  theaterMix?: boolean;
  /** Milliseconds spent in Level 1. Default 4000. */
  activeMs?: number;
  /** Milliseconds spent in Level 2. Default 20000. */
  dimMs?: number;
}

export const THEATER_ACTIVE_MS: number;
export const THEATER_DIM_MS: number;
export const THEATER_LEVELS: readonly Readonly<TheaterLevel>[];
export function levelAt(msSinceTouch: number, options?: TheaterOptions): TheaterLevel;
export function nextChangeIn(msSinceTouch: number, options?: TheaterOptions): number | null;

export interface Tone {
  lowpassHz: number;
  bassDb: number;
}
export const OPEN_HZ: number;
export const MIN_HZ: number;
export const MAX_DAMPEN: number;
export const MAX_BASS_DB: number;
export const TONE_RAMP_SECONDS: number;
export const TRANSPARENT_TONE: Readonly<Tone>;
export function dampenToTone(dampen: number): Tone;

export interface GroupedBands {
  bass: number;
  mid: number;
  treble: number;
}
export interface FiveBands {
  sub?: number;
  bass?: number;
  lowMid?: number;
  mid?: number;
  high?: number;
}
export interface Grade {
  glow: number;
  hue: number;
  vignette: number;
  grain: number;
}
export const RISE_MS: number;
export const FALL_MS: number;
export const IDLE_BANDS: Readonly<GroupedBands>;
export function groupBands(bands: FiveBands | undefined): GroupedBands;
export function smoothBands(prev: GroupedBands | undefined, next: GroupedBands | undefined, dtMs: number): GroupedBands;
export function gradeFrom(bands: FiveBands | GroupedBands | undefined, energy: number): Grade;

export type DiscPatternName = 'sunburst' | 'rings' | 'halftone' | 'horizon' | 'stripes' | 'eclipse' | 'mosaic';
export interface JukeboxTrack {
  id: string;
  title: string;
  pattern?: DiscPatternName;
  /** Background, figure, accent as hex colors. */
  palette?: [string, string, string];
  /** Later: where to read more. https only. */
  links?: { label: string; href: string }[];
  info?: string;
}
export const DISC_PATTERNS: readonly DiscPatternName[];
export function validateManifest(tracks: unknown): string[];
