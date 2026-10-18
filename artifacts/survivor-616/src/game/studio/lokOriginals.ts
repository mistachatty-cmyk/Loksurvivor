import { CLIPS, DIRECTIONS, generateStudioProject, type Direction, type Pixel, type StudioProject } from './v3Project';

export interface LokOriginal {
  key: string;
  name: string;
  kind: StudioProject['kind'];
  sourceId: string;
  description: string;
  palette: [string, string, string, string, string, string];
  rig: StudioProject['rigFamily'];
  style: StudioProject['styleFamily'];
}

/** First-party art recipes. Gallery previews remain drafts until the shared staff review approves a revision. */
export const LOK_ORIGINALS: readonly LokOriginal[] = [
  { key: 'patchlight', name: 'Patchlight', kind: 'operator', sourceId: 'shade', description: 'A night-shift courier with a lantern visor, repair pack, and a bright orange route marker.', palette: ['#111d2b', '#263e50', '#4f7889', '#caf7f2', '#ff9f43', '#ffe09a'], rig: 'humanoid', style: 'industrial' },
  { key: 'mossbyte', name: 'Mossbyte', kind: 'operator', sourceId: 'shade', description: 'A tiny rooftop garden with a big heart, springy feet, and a glowing seed crown.', palette: ['#102a27', '#285b4d', '#57a97d', '#d8f7bc', '#b7e660', '#f5de88'], rig: 'blob', style: 'whimsical' },
  { key: 'relay-moth', name: 'Relay Moth', kind: 'enemy', sourceId: 'watchlight', description: 'A violet signal hunter whose antennae and wing markings flare before it strikes.', palette: ['#1b1738', '#493768', '#8f68ae', '#eee1ff', '#ff74ad', '#76e9ef'], rig: 'winged', style: 'creepy' },
];

function rect(out: Pixel[], x: number, y: number, width: number, height: number, color: number) {
  for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) {
    if (px >= 0 && px < 48 && py >= 0 && py < 48) out.push([px, py, color]);
  }
}

function details(key: string, direction: Direction, frame: number, clip: keyof typeof CLIPS): Pixel[] {
  const out: Pixel[] = [];
  const bounce = clip === 'walk' ? frame % 2 : 0;
  const fall = clip === 'death' ? Math.min(frame * 2, 12) : 0;
  const back = direction === 'N' || direction === 'NW' || direction === 'NE';
  const side = direction === 'E' || direction === 'W' || direction === 'NE' || direction === 'NW' || direction === 'SE' || direction === 'SW';
  const leftFacing = direction === 'W' || direction === 'NW' || direction === 'SW';
  const directionMark: Record<Direction, number> = { S: 22, SW: 19, W: 17, NW: 20, N: 24, NE: 27, E: 30, SE: 27 };
  if (key === 'patchlight') {
    rect(out, 18, 11 + bounce + fall, 12, 3, 1);
    if (!back) { rect(out, side ? (leftFacing ? 19 : 24) : 19, 16 + bounce + fall, side ? 5 : 10, 3, 5); rect(out, side ? (leftFacing ? 20 : 25) : 20, 16 + bounce + fall, side ? 3 : 6, 1, 3); }
    rect(out, 9, 23 + bounce + fall, 3, Math.max(3, 13 - fall), 2);
    rect(out, 10, 27 + bounce + fall, 2, Math.max(2, 5 - Math.floor(fall / 3)), 4);
    rect(out, 20, 29 + bounce + fall, 8, 2, 4);
    rect(out, directionMark[direction], 24 + bounce + fall, 2, 2, 5);
    if (clip === 'walk') rect(out, 14 + frame, 38 + bounce, 2, 1, 5);
    if (clip === 'attack') rect(out, 35 + frame, 19 + fall, 2 + frame, 2, 5);
    if (clip === 'hurt') rect(out, 16, 20 + frame + fall, 3, 2, 5);
    if (clip === 'idle') rect(out, 30 + frame, 14 - (frame % 2), 2, 2, 5);
  } else if (key === 'mossbyte') {
    const sway = clip === 'idle' ? [0, 1, 0, -1][frame]! : 0;
    rect(out, 22 + sway, 12 + bounce + fall, 4, Math.max(2, 8 - Math.floor(fall / 2)), 2);
    rect(out, 18, 12 + bounce + fall, 5, 3, 4);
    rect(out, 25, 10 + bounce + fall, 5, 3, 4);
    if (!back) { rect(out, side ? (leftFacing ? 19 : 26) : 18, 25 + bounce + fall, 3, clip === 'hurt' ? 1 : 4, 3); if (!side) rect(out, 27, 25 + bounce + fall, 3, clip === 'hurt' ? 1 : 4, 3); }
    rect(out, 20, 34 + bounce + fall, 8, 2, 5);
    rect(out, directionMark[direction], 21 + bounce + fall, 2, 2, 4);
    if (clip === 'walk') rect(out, 14 + frame * 3, 37 + fall, 4, 2, 4);
    if (clip === 'attack') rect(out, 31 + frame, 25 + fall, 3, 3, 4);
    if (clip === 'idle') rect(out, 20 + frame * 2, 8, 2, 2, 5);
  } else {
    const wingLift = clip === 'idle' ? [0, 1, 2, 1][frame]! : clip === 'walk' ? [0, 2, 4, 2, 0, 1][frame]! : clip === 'attack' ? frame : 0;
    rect(out, 18, 7 + bounce + fall, 2, 7, 5);
    rect(out, 28, 7 + bounce + fall, 2, 7, 5);
    rect(out, 16, 6 + bounce + fall, 3, 2, 4);
    rect(out, 29, 6 + bounce + fall, 3, 2, 4);
    rect(out, 5, 23 - wingLift + bounce + fall, 8, 2, 4);
    rect(out, 35, 23 - wingLift + bounce + fall, 8, 2, 4);
    rect(out, 7, 27 - wingLift + bounce + fall, 6, 2, 5);
    rect(out, 35, 27 - wingLift + bounce + fall, 6, 2, 5);
    rect(out, directionMark[direction], 19 + bounce + fall, 2, 2, 5);
    if (!back) rect(out, 21, 27 + bounce + fall, 6, clip === 'hurt' ? 1 : 2, 4);
    if (clip === 'walk') rect(out, 16 + frame * 2, 39, 2, 1, 5);
    if (clip === 'attack') rect(out, 22 + frame, 33 + fall, 4, 2, 5);
    if (clip === 'idle') { rect(out, 4 + frame, 20, 2, 2, 5); rect(out, 42 - frame, 20, 2, 2, 5); }
  }
  return out;
}

export function createLokOriginal(original: LokOriginal, id: string, sourceId = original.sourceId): StudioProject {
  const project = generateStudioProject({ id, kind: original.kind, sourceId, seed: `lok-original:${original.key}`, name: original.name, prompt: original.description, rigFamily: original.rig, styleFamily: original.style });
  project.palette[1] = original.palette[0];
  project.palette[2] = original.palette[1];
  project.palette[3] = original.palette[2];
  project.palette[4] = original.palette[3];
  project.palette[5] = original.palette[4];
  project.palette[9] = original.palette[5];
  project.layers.push({ id: 'lok-details', name: 'Lok details', pivot: [24, 32], order: project.layers.length, visible: true });
  for (const direction of DIRECTIONS) for (const clip of Object.keys(CLIPS) as (keyof typeof CLIPS)[]) {
    project.views[direction][clip].forEach((frame, index) => { frame.layers['lok-details'] = details(original.key, direction, index, clip); });
  }
  project.remixAllowed = true;
  return project;
}
