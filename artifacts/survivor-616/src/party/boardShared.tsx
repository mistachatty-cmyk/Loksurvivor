/**
 * BoardScreen -- Turbo Crown Blitz on the Monroe Loop (Lok Party Slice 3).
 *
 * Draws and paces the pure board engine (lokBoard.ts). Human choices are big cream buttons at
 * thumb height (fired on pointerdown); bots think for a beat so turns read like a show.
 * A 30-second minigame closes each round, rotating the Lok Drop, Ring Run Rush, Roof Rumble and Roof Collapse.
 */

import { type BoardState, type DieFace } from './lokBoard';
import { type OnlineSession } from './partyNet';

export const LANE = ['#38f2ff', '#ff3fd2', '#ffd23f', '#7cff6b'];
export const CREAM = '#FAF6EE';
export const ESPRESSO = '#3b2a20';
export const HOP_MS = 230;
export const RIG_SCALE = 1.45;

export interface Props {
  humanId: string;
  rounds?: number;
  seed: number;
  ladderTier: number;
  getAudioContext: () => AudioContext | null;
  onFinish: (s: BoardState, localSeat: number) => void;
  /** Present when this is an online party. */
  online?: OnlineSession;
  onQuit: () => void;
}

export interface Float {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
  coin?: boolean;
}

export interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  r: number;
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function faceLabel(f: DieFace): string {
  if (typeof f === 'number') return String(f);
  return { 'freeze-rival': 'FREEZE', 'plus-cred': '+3', 'boulder-ride': 'BOULDER', gilded: 'GILDED' }[f];
}

export type SeatRole = 'local' | 'bot' | 'remote';

