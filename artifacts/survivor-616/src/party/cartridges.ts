/**
 * Every kit-based Lok Party minigame in one list, so the board, the practice menu and the tests find a
 * game by its id and a new game is one more line here (plus its rules and art files).
 */

import type { MinigameCartridge, MinigameId } from './minigameKit';
import { gemVacuum } from './gemVacuumArt';
import { strikePose } from './strikePoseArt';
import { roofCollapse, roofRumble } from './roofRumbleArt';

/** Ring Run Rush and the Lok Drop run their own loops, so they are not here. */
export type KitGameId = Exclude<MinigameId, 'drop' | 'rush'>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CARTRIDGES: Record<KitGameId, MinigameCartridge<any>> = {
  rumble: roofRumble,
  collapse: roofCollapse,
  gems: gemVacuum,
  pose: strikePose,
};

export const isKitGame = (id: MinigameId): id is KitGameId => id in CARTRIDGES;

/** The practice menu's order. */
export const PRACTICE_ORDER: (KitGameId | 'rush')[] = ['rumble', 'collapse', 'gems', 'pose', 'rush'];
