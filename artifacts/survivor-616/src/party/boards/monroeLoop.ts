/**
 * Sector 616: Monroe Loop -- the first Lok Party board.
 *
 * A clockwise street loop around four city blocks, with real elevation:
 * - Rooftop shortcut: a fire-escape LADDER up from the bottom avenue, across the roofs and a steel
 *   gantry BRIDGE over the Grand River, then STAIRS down to the top avenue.
 * - The east terrace: STAIRS up to a raised plaza, with a boulder-chute SLIDE straight down to the
 *   bottom avenue as a risky shortcut.
 * Board units: x 0..1800, y 0..1100 (y toward the camera); z is the elevation tier.
 */

import type { BoardDef, BoardNode, SpaceKind, Traversal } from '../lokBoard';

const K: Record<string, SpaceKind> = { c: 'cred', g: 'glitch', e: 'event', s: 'supply', h: 'hack', a: 'archon', S: 'start' };

function line(prefix: string, pts: [number, number, number][], kinds: string, street = false): BoardNode[] {
  return pts.map(([x, y, z], i) => ({ id: `${prefix}${i}`, x, y, z, kind: K[kinds[i] ?? 'c'], next: [], street }));
}

// Top avenue, left to right.
const T = line(
  'T',
  Array.from({ length: 11 }, (_, i) => [250 + i * 130, 190, 0] as [number, number, number]),
  'ccecgcsccec',
  true,
);
// East side, top to bottom, up onto the terrace and back down.
const R = line(
  'R',
  [
    [1660, 300, 0],
    [1690, 420, 1],
    [1700, 540, 1],
    [1690, 660, 1],
    [1670, 780, 1],
    [1650, 900, 0],
  ],
  'chcacg',
);
// Bottom avenue, right to left.
const B = line(
  'B',
  Array.from({ length: 11 }, (_, i) => [1550 - i * 130, 1010, 0] as [number, number, number]),
  'cgcscecgccS',
  true,
);
// West side, bottom to top (crosses the river on the street bridge).
const L = line(
  'L',
  [
    [140, 880, 0],
    [120, 750, 0],
    [115, 620, 0],
    [125, 490, 0],
    [150, 360, 0],
  ],
  'csgec',
);
// Rooftop shortcut, bottom to top through the middle.
const G = line(
  'G',
  [
    [905, 860, 2],
    [915, 740, 2],
    [920, 630, 2],
    [915, 520, 2],
    [880, 430, 2],
  ],
  'cehsc',
);

const nodes: BoardNode[] = [...T, ...R, ...B, ...L, ...G];
const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

function link(from: string, to: string, via: Traversal = 'walk') {
  const n = byId[from];
  n.next.push(to);
  if (via !== 'walk') n.via = { ...(n.via ?? {}), [to]: via };
}

for (let i = 0; i < T.length - 1; i += 1) link(`T${i}`, `T${i + 1}`);
link('T10', 'R0');
link('R0', 'R1', 'stairs');
for (let i = 1; i < 4; i += 1) link(`R${i}`, `R${i + 1}`);
link('R4', 'R5', 'stairs');
link('R5', 'B0');
for (let i = 0; i < B.length - 1; i += 1) link(`B${i}`, `B${i + 1}`);
link('B10', 'L0');
for (let i = 0; i < L.length - 1; i += 1) link(`L${i}`, `L${i + 1}`);
link('L4', 'T0');
// Junction 1: bottom avenue middle -> fire escape ladder -> rooftops -> gantry -> stairs down.
link('B5', 'G0', 'ladder');
link('G0', 'G1');
link('G1', 'G2', 'bridge-over');
link('G2', 'G3', 'bridge-over');
link('G3', 'G4');
link('G4', 'T5', 'stairs');
// Junction 2: terrace edge -> boulder chute straight down to the bottom avenue.
link('R3', 'B2', 'slide');

// Junction nodes stay plain cred so a choice is never also a penalty.
byId.B5.kind = 'cred';
byId.R3.kind = 'cred';

export const MONROE_LOOP: BoardDef = {
  id: 'monroe-loop',
  nodes,
  start: 'B10',
  crownSpots: ['T8', 'R2', 'B7', 'L2', 'G3', 'T3'],
};
