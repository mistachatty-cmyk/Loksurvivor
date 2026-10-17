import { CLIPS, DIRECTIONS, generateStudioProject, type Pixel, type StudioProject } from './v3Project';

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

function details(key: string, frame: number, clip: keyof typeof CLIPS): Pixel[] {
  const out: Pixel[] = [];
  const bounce = clip === 'walk' ? frame % 2 : 0;
  if (key === 'patchlight') {
    rect(out, 18, 11 + bounce, 12, 3, 1);
    rect(out, 19, 16 + bounce, 10, 3, 5);
    rect(out, 20, 16 + bounce, 6, 1, 3);
    rect(out, 9, 23 + bounce, 3, 13, 2);
    rect(out, 10, 27 + bounce, 2, 5, 4);
    rect(out, 20, 29 + bounce, 8, 2, 4);
    rect(out, 21, 30 + bounce, 6, 1, 5);
  } else if (key === 'mossbyte') {
    rect(out, 22, 12 + bounce, 4, 8, 2);
    rect(out, 18, 12 + bounce, 5, 3, 4);
    rect(out, 25, 10 + bounce, 5, 3, 4);
    rect(out, 18, 25 + bounce, 3, 4, 3);
    rect(out, 27, 25 + bounce, 3, 4, 3);
    rect(out, 20, 34 + bounce, 8, 2, 5);
  } else {
    rect(out, 18, 7 + bounce, 2, 7, 5);
    rect(out, 28, 7 + bounce, 2, 7, 5);
    rect(out, 16, 6 + bounce, 3, 2, 4);
    rect(out, 29, 6 + bounce, 3, 2, 4);
    rect(out, 5, 23 + bounce, 8, 2, 4);
    rect(out, 35, 23 + bounce, 8, 2, 4);
    rect(out, 7, 27 + bounce, 6, 2, 5);
    rect(out, 35, 27 + bounce, 6, 2, 5);
    rect(out, 21, 27 + bounce, 6, 2, 4);
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
    project.views[direction][clip].forEach((frame, index) => { frame.layers['lok-details'] = details(original.key, index, clip); });
  }
  project.remixAllowed = true;
  return project;
}
