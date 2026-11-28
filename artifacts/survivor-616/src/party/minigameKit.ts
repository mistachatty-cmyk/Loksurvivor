/**
 * The Lok Party minigame kit: one contract every minigame fills in, so a new game is a rules file
 * plus an art file, and gets the shared entrance, controls, effects, HUD and podium for free
 * (MinigameStage.tsx). Blueprint s10 calls this the cartridge contract.
 *
 * House rules for every cartridge (owner, 2026-11-27): a party game you play, with every player's
 * character on screen doing something; seeded score-attack rules (pure, no DOM) so online only needs
 * to share final scores; one thumb on a phone, keys on desktop; and juice on every hit.
 */

import type { useT } from '@/lib/i18n';

export interface MinigameSeat {
  characterId: string;
  bot: boolean;
  /** 0..1, for bots. */
  botSkill?: number;
}

/** What the stage hands the rules each fixed step, already in the game's world units. */
export interface StageInput {
  /** -1..1 from arrow keys or WASD. */
  keys: { x: number; y: number };
  /** The world point under a held finger or mouse, or null. */
  aim: { x: number; y: number } | null;
  holding: boolean;
  /** A quick tap this step, in world units. */
  tap: { x: number; y: number } | null;
  /** Space or Enter this step. */
  action: boolean;
}

export interface MinigameResult {
  index: number;
  characterId: string;
  placement: number;
  /** The score. Named like the Lok Drop's so the board and the online relay treat all games alike. */
  banked: number;
}

/** The canvas is always 600 stage units wide; its height follows the phone. */
export interface StageView {
  w: number;
  h: number;
}

export type StageSound = 'hit' | 'crack' | 'slam' | 'bank';

/** Effects a cartridge can fire, in stage units. The stage owns particles, toasts and the camera. */
export interface StageFx {
  impact(x: number, y: number, weight: number): void;
  burst(x: number, y: number, color: string, count: number, opts?: { speed?: number; size?: number; gravity?: number; smoke?: boolean }): void;
  toast(x: number, y: number, text: string, color: string, size?: number): void;
  flash(color: string, ms: number): void;
  sound(kind: StageSound): void;
  chime(bright?: boolean): void;
}

export interface RenderInfo {
  view: StageView;
  clock: number;
  me: number;
  calm: boolean;
}

export interface MinigameCartridge<S> {
  id: string;
  labels(t: ReturnType<typeof useT>): { title: string; prompt: string; hint: string };
  /** The colour of the entrance title. */
  accent: string;
  bpm?: number;
  create(seed: number, seats: MinigameSeat[]): S;
  step(s: S, inputs: (StageInput | null)[], dtMs: number): void;
  isOver(s: S): boolean;
  timeLeftMs(s: S): number;
  scores(s: S): number[];
  results(s: S): MinigameResult[];
  /** Stage point to world point, for touch. */
  toWorld(view: StageView, x: number, y: number): { x: number; y: number };
  /** World point to stage point, for effects. */
  toStage(view: StageView, x: number, y: number): { x: number; y: number };
  render(ctx: CanvasRenderingContext2D, s: S, info: RenderInfo): void;
  /** Turn this step's rule events into effects. Called after every fixed step. */
  react(s: S, fx: StageFx, info: RenderInfo): void;
  /** Screen-space overlay drawn over the HUD (banners, counters). Stage units, no camera shake. */
  hud?(ctx: CanvasRenderingContext2D, s: S, info: RenderInfo): void;
  /** Show the touch DASH button; the value is how ready the player's dash is, 0..1. */
  dashReady?(s: S, me: number): number;
}

export const SEAT_COLORS = ['#38f2ff', '#ff3fd2', '#ffd23f', '#7cff6b'] as const;

/** Entrance timeline, in ms from mount. A tap skips ahead to the countdown. */
export const ENTRANCE = {
  titleMs: 650,
  lineupMs: 650,
  lineupEachMs: 260,
  countdownAt: 2600,
  beatMs: 900,
  /** countdownAt + 3 beats. */
  playAt: 5300,
  goMs: 700,
} as const;

export const PODIUM_MS = 4200;

export type MinigameId = 'drop' | 'rush' | 'rumble' | 'collapse' | 'gems' | 'pose';
const ROTATION: MinigameId[] = ['drop', 'rush', 'rumble', 'collapse', 'gems', 'pose'];

/** Which minigame closes a given board round. Every client works it out the same way. */
export const minigameForRound = (round: number): MinigameId => ROTATION[(((Math.floor(round) - 1) % ROTATION.length) + ROTATION.length) % ROTATION.length];
