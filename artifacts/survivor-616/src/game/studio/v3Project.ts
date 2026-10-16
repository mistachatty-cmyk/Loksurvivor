/** Character Studio v3 projects live outside the legacy Forge save. */
import type { ForgedOperator } from '@/game/data/operatorForge';
export const STUDIO_VERSION = 3 as const;
export const STUDIO_SIZE = 48;
export const DIRECTIONS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'] as const;
export const CLIPS = { idle: 4, walk: 6, attack: 4, hurt: 2, death: 8 } as const;
export const REQUIRED_FRAMES = DIRECTIONS.length * Object.values(CLIPS).reduce((a, b) => a + b, 0);
export const RIG_FAMILIES = ['humanoid', 'quadruped', 'blob', 'insectoid', 'floating', 'winged'] as const;
export const STYLE_FAMILIES = ['cute', 'creepy', 'street', 'industrial', 'whimsical', 'Null'] as const;
const STYLE_COLORS: Record<StyleFamily, [string, string, string, string]> = {
  cute: ['#ff8dbb', '#ffc4dc', '#ffdf69', '#fff4a8'],
  creepy: ['#50345e', '#91619c', '#d14f75', '#75d9c5'],
  street: ['#343c5e', '#7584a6', '#f7a14a', '#f6d166'],
  industrial: ['#4b5961', '#9ba6a8', '#e68b42', '#b5e8ee'],
  whimsical: ['#7d53b6', '#c08bea', '#f58ab1', '#a9e88b'],
  Null: ['#153f4a', '#3e8190', '#4bd2c7', '#b3fafa'],
};

export type Direction = typeof DIRECTIONS[number];
export type ClipName = keyof typeof CLIPS;
export type RigFamily = typeof RIG_FAMILIES[number];
export type StyleFamily = typeof STYLE_FAMILIES[number];
export type Pixel = [x: number, y: number, color: number];
export interface StudioLayer { id: string; name: string; pivot: [number, number]; order: number; visible: boolean }
export interface StudioFrame { ms: number; approved: boolean; layers: Record<string, Pixel[]>; offsets: Record<string, [number, number]>; rotations?: Record<string, number> }
export interface StudioProject {
  version: typeof STUDIO_VERSION;
  id: string;
  kind: 'operator' | 'enemy';
  name: string;
  sourceId: string;
  seed: string;
  prompt: string;
  rigFamily: RigFamily;
  styleFamily: StyleFamily;
  palette: string[];
  layers: StudioLayer[];
  views: Record<Direction, Record<ClipName, StudioFrame[]>>;
  revision: number;
  parentRevisionId: string | null;
  remixAllowed: boolean;
  approvalState: 'draft' | 'submitted' | 'approved' | 'rejected' | 'removed';
  updatedAt: number;
}

function hash(value: string): number {
  let h = 2166136261;
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}
function choose<T>(items: readonly T[], seed: string): T { return items[hash(seed) % items.length]!; }
function rect(out: Pixel[], x: number, y: number, w: number, h: number, color: number) {
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
    if (px >= 0 && py >= 0 && px < STUDIO_SIZE && py < STUDIO_SIZE) out.push([px, py, color]);
  }
}
function pixels(family: RigFamily, layer: string, direction: Direction, clip: ClipName, frame: number): Pixel[] {
  const out: Pixel[] = [];
  const sideways = direction === 'E' || direction === 'W' || direction === 'NE' || direction === 'NW' || direction === 'SE' || direction === 'SW';
  const bounce = clip === 'walk' ? frame % 2 : clip === 'hurt' ? frame : 0;
  const strike = clip === 'attack' ? frame * 2 : 0;
  const fall = clip === 'death' ? frame * 2 : 0;
  if (layer === 'body') {
    if (family === 'blob') rect(out, 13, 20 + fall, 22, Math.max(3, 17 - fall), 2);
    else if (family === 'quadruped') rect(out, 9, 20 + fall, 28, Math.max(3, 12 - fall), 2);
    else if (family === 'insectoid') { rect(out, 15, 18 + fall, 18, Math.max(3, 16 - fall), 2); rect(out, 19, 32 + fall, 10, 7, 3); }
    else if (family === 'floating') rect(out, 15, 18 + bounce + fall, 18, Math.max(3, 20 - fall), 2);
    else rect(out, sideways ? 18 : 16, 21 + fall, sideways ? 12 : 16, Math.max(3, 17 - fall), 2);
  } else if (layer === 'head') {
    const y = family === 'blob' ? 18 : family === 'quadruped' ? 14 : 11;
    rect(out, 17, y + bounce + fall, 14, Math.max(2, 12 - fall), 3);
    if (direction !== 'N' && direction !== 'NW' && direction !== 'NE') {
      rect(out, sideways ? 25 : 20, y + 5 + bounce + fall, 2, 2, 4);
      if (!sideways) rect(out, 26, y + 5 + bounce + fall, 2, 2, 4);
    }
  } else if (layer === 'left limb' || layer === 'right limb') {
    const left = layer === 'left limb';
    const x = left ? 11 : 33;
    if (family === 'quadruped' || family === 'insectoid') {
      rect(out, x, 29 + bounce + fall, 4, Math.max(2, 12 - fall), 1);
      if (family === 'insectoid') rect(out, left ? 6 : 38, 25 + fall, 4, 11, 1);
    } else if (family !== 'blob') rect(out, x + (left ? -strike : strike), 24 + bounce + fall, 5, Math.max(2, 12 - fall), 1);
  } else if (layer === 'accent') {
    if (family === 'winged') { rect(out, 3, 18 + bounce + fall, 13, 12, 5); rect(out, 32, 18 + bounce + fall, 13, 12, 5); }
    else if (family === 'floating') rect(out, 16, 40 + bounce + fall, 16, 2, 5);
    else rect(out, 20, 26 + bounce + fall, 8, 3, 5);
  }
  return out;
}

export interface GenerateOptions { id: string; kind: StudioProject['kind']; sourceId: string; seed: string; prompt?: string; name?: string; rigFamily?: RigFamily; styleFamily?: StyleFamily }
export function generateStudioProject(options: GenerateOptions): StudioProject {
  const words = (options.prompt ?? '').toLowerCase();
  const rigFamily = options.rigFamily ?? RIG_FAMILIES.find((value) => words.includes(value)) ?? choose(RIG_FAMILIES, options.seed + ':rig');
  const styleFamily = options.styleFamily ?? STYLE_FAMILIES.find((value) => words.includes(value.toLowerCase())) ?? choose(STYLE_FAMILIES, options.seed + ':style');
  const layers: StudioLayer[] = ['body', 'head', 'left limb', 'right limb', 'accent'].map((name, order) => ({ id: `layer-${order}`, name, pivot: [24, 32], order, visible: true }));
  const views = {} as StudioProject['views'];
  for (const direction of DIRECTIONS) {
    const clips = {} as Record<ClipName, StudioFrame[]>;
    for (const clip of Object.keys(CLIPS) as ClipName[]) {
      clips[clip] = Array.from({ length: CLIPS[clip] }, (_, frame) => ({
        ms: clip === 'death' ? 95 : 130,
        approved: false,
        layers: Object.fromEntries(layers.map((layer) => [layer.id, pixels(rigFamily, layer.name, direction, clip, frame)])),
        offsets: {},
        rotations: {},
      }));
    }
    views[direction] = clips;
  }
  const palette = ['#000000', '#1a1830', '#4b3b65', '#8d6ba6', '#f4e9d8', '#e95868', '#f5aa4c', '#f9db6d', '#568f79', '#8bcab8', '#5c78ba', '#91b5ed', '#54354b', '#9e5371', '#d9a7a3', '#ffffff'];
  [palette[2], palette[3], palette[5], palette[9]] = STYLE_COLORS[styleFamily];
  return {
    version: STUDIO_VERSION, id: options.id, kind: options.kind, name: options.name || 'Untitled creation',
    sourceId: options.sourceId, seed: options.seed, prompt: options.prompt ?? '', rigFamily, styleFamily,
    palette,
    layers, views, revision: 1, parentRevisionId: null, remixAllowed: false, approvalState: 'draft', updatedAt: Date.now(),
  };
}

export function generateBlankStudioProject(options: GenerateOptions): StudioProject {
  const project = generateStudioProject(options);
  for (const direction of DIRECTIONS) for (const clip of Object.keys(CLIPS) as ClipName[]) {
    for (const frame of project.views[direction][clip]) {
      for (const layer of project.layers) frame.layers[layer.id] = [];
    }
  }
  return project;
}

/** Copy a v1/v2 design into an editable v3 draft without changing its legacy record. */
export function projectFromForgedOperator(operator: ForgedOperator, id: string): StudioProject {
  const project = generateStudioProject({ id, kind: 'operator', sourceId: operator.kitId, seed: operator.id, name: operator.name, prompt: `${operator.design.species} ${operator.design.flavor}` });
  const colors = operator.design.palette;
  project.palette[1] = colors.ink;
  project.palette[2] = colors.bodyDark;
  project.palette[3] = colors.body;
  project.palette[4] = colors.skin;
  project.palette[5] = colors.accent;
  project.palette[9] = colors.glow;
  return project;
}

export function approvalCount(project: StudioProject): number {
  return DIRECTIONS.reduce((total, direction) => total + (Object.keys(CLIPS) as ClipName[]).reduce((n, clip) => n + project.views[direction][clip].filter((frame) => frame.approved).length, 0), 0);
}
export function emptyStudioFrameCount(project: StudioProject): number {
  return DIRECTIONS.reduce((total, direction) => total + (Object.keys(CLIPS) as ClipName[]).reduce((count, clip) =>
    count + project.views[direction][clip].filter((frame) => !Object.values(frame.layers).some((pixels) => pixels.length > 0)).length, 0), 0);
}

/** Seed only untouched, empty frames from a first pose. Existing art and frame timing stay intact. */
export function seedEmptyStudioFrames(project: StudioProject, sourceDirection: Direction, sourceClip: ClipName, sourceIndex: number): StudioProject {
  const pose = project.views[sourceDirection][sourceClip][sourceIndex];
  if (!pose || !Object.values(pose.layers).some((pixels) => pixels.length > 0)) return project;
  const views = structuredClone(project.views);
  let filled = 0;
  for (const direction of DIRECTIONS) for (const clip of Object.keys(CLIPS) as ClipName[]) for (const frame of views[direction][clip]) {
    if (Object.values(frame.layers).some((pixels) => pixels.length > 0)) continue;
    frame.layers = structuredClone(pose.layers);
    frame.offsets = structuredClone(pose.offsets);
    frame.rotations = structuredClone(pose.rotations ?? {});
    frame.approved = false;
    filled++;
  }
  return filled ? { ...project, views, approvalState: 'draft', revision: project.revision + 1, updatedAt: Date.now() } : project;
}
export function studioErrors(project: StudioProject): string[] {
  const errors: string[] = [];
  if (project.version !== STUDIO_VERSION) errors.push('Unsupported project version');
  if (!project.name.trim() || !project.sourceId.trim()) errors.push('Name and source are required');
  if (project.palette.length !== 16 || project.palette.some((color) => !/^#[0-9a-fA-F]{6}$/.test(color))) errors.push('Palette must have 16 valid colors');
  if (!project.layers.length || project.layers.length > 16 || new Set(project.layers.map((layer) => layer.id)).size !== project.layers.length || project.layers.some((layer) => !layer.name.trim())) errors.push('Use 1 to 16 named layers with unique IDs');
  for (const direction of DIRECTIONS) for (const clip of Object.keys(CLIPS) as ClipName[]) {
    const frames = project.views[direction]?.[clip];
    if (!frames || frames.length !== CLIPS[clip]) { errors.push(`${direction} ${clip} needs ${CLIPS[clip]} frames`); continue; }
    for (const frame of frames) {
      if (!Number.isFinite(frame.ms) || frame.ms < 30 || frame.ms > 1000) errors.push(`${direction} ${clip} has invalid timing`);
      for (const row of Object.values(frame.layers)) for (const [x, y, color] of row) if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 48 || y >= 48 || !Number.isInteger(color) || color < 0 || color > 15) { errors.push(`${direction} ${clip} has pixels outside the canvas`); break; }
    }
  }
  if (!project.layers.some((layer) => layer.visible && DIRECTIONS.some((direction) => (Object.keys(CLIPS) as ClipName[]).some((clip) =>
    project.views[direction]?.[clip]?.some((frame) => (frame.layers[layer.id]?.length ?? 0) > 0))))) errors.push('Add visible art before submitting');
  return [...new Set(errors)];
}
export function isStudioComplete(project: StudioProject): boolean { return studioErrors(project).length === 0 && approvalCount(project) === REQUIRED_FRAMES; }
export function transformStudioPixel(frame: StudioFrame, layer: StudioLayer, x: number, y: number): [number, number] {
  const angle = ((frame.rotations?.[layer.id] ?? 0) * Math.PI) / 180;
  const [px, py] = layer.pivot;
  const dx = x - px; const dy = y - py;
  const [ox, oy] = frame.offsets[layer.id] ?? [0, 0];
  return [Math.round(px + dx * Math.cos(angle) - dy * Math.sin(angle) + ox), Math.round(py + dx * Math.sin(angle) + dy * Math.cos(angle) + oy)];
}
export function studioFrameAt(project: StudioProject, direction: Direction, clip: ClipName, elapsedMs: number): number {
  const frames = project.views[direction][clip];
  const total = frames.reduce((sum, frame) => sum + frame.ms, 0);
  let position = clip === 'death' ? Math.min(Math.max(0, elapsedMs), total - 1) : ((elapsedMs % total) + total) % total;
  let index = 0;
  while (index < frames.length - 1 && position >= frames[index]!.ms) position -= frames[index++]!.ms;
  return index;
}
export function renderStudioPixels(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, project: StudioProject, frame: StudioFrame): void {
  ctx.clearRect(0, 0, 48, 48);
  for (const layer of [...project.layers].sort((a, b) => a.order - b.order)) {
    if (!layer.visible) continue;
    for (const [x, y, color] of frame.layers[layer.id] ?? []) {
      ctx.fillStyle = project.palette[color] ?? '#ffffff';
      const [px, py] = transformStudioPixel(frame, layer, x, y);
      ctx.fillRect(px, py, 1, 1);
    }
  }
}
function replaceFrame(project: StudioProject, direction: Direction, clip: ClipName, index: number, transform: (frame: StudioFrame) => StudioFrame): StudioProject {
  const original = project.views[direction]?.[clip]?.[index];
  if (!original) throw new Error('Frame does not exist');
  const frames = [...project.views[direction][clip]];
  frames[index] = transform(original);
  return { ...project, views: { ...project.views, [direction]: { ...project.views[direction], [clip]: frames } }, updatedAt: Date.now() };
}
export function editStudioFrame(project: StudioProject, direction: Direction, clip: ClipName, index: number, edit: (frame: StudioFrame) => void): StudioProject {
  const next = replaceFrame(project, direction, clip, index, (original) => {
    const frame = structuredClone(original);
    edit(frame);
    frame.approved = false;
    return frame;
  });
  return { ...next, approvalState: 'draft', revision: next.revision + 1 };
}
/** Changes to the shared palette or layer stack require every frame to be reviewed again. */
export function editStudioAppearance(project: StudioProject, edit: (draft: StudioProject) => void): StudioProject {
  const draft = structuredClone(project);
  edit(draft);
  for (const direction of DIRECTIONS) for (const clip of Object.keys(CLIPS) as ClipName[]) {
    for (const frame of draft.views[direction][clip]) frame.approved = false;
  }
  draft.approvalState = 'draft';
  draft.revision = project.revision + 1;
  draft.updatedAt = Date.now();
  return draft;
}
/** Copy one animation clip to the other directions. Copies always need fresh review. */
export function copyStudioClipToDirections(project: StudioProject, sourceDirection: Direction, clip: ClipName): StudioProject {
  const views = { ...project.views };
  for (const direction of DIRECTIONS) {
    if (direction === sourceDirection) continue;
    views[direction] = {
      ...project.views[direction],
      [clip]: project.views[sourceDirection][clip].map((frame) => ({ ...structuredClone(frame), approved: false })),
    };
  }
  return { ...project, views, approvalState: 'draft', revision: project.revision + 1, updatedAt: Date.now() };
}
/** Copy one frame's pose to every other frame in its clip, keeping target timing. */
export function copyStudioFrameToClip(project: StudioProject, direction: Direction, clip: ClipName, sourceIndex: number): StudioProject {
  const source = project.views[direction]?.[clip]?.[sourceIndex];
  if (!source) throw new Error('Frame does not exist');
  const frames = project.views[direction][clip].map((frame, index) => index === sourceIndex
    ? frame
    : { ...structuredClone(source), ms: frame.ms, approved: false });
  return {
    ...project,
    views: { ...project.views, [direction]: { ...project.views[direction], [clip]: frames } },
    approvalState: 'draft',
    revision: project.revision + 1,
    updatedAt: Date.now(),
  };
}
/** Paint or erase a square brush. x/y identify the brush's top-left logical pixel. */
export function paintStudioBrush(frame: StudioFrame, layerId: string, x: number, y: number, color: number, size = 1, erase = false): void {
  const brushSize = Math.max(1, Math.min(8, Math.floor(size)));
  const left = Math.floor(x);
  const top = Math.floor(y);
  const pixels = frame.layers[layerId] ?? [];
  const touched = new Set<string>();
  for (let py = top; py < top + brushSize; py++) for (let px = left; px < left + brushSize; px++) {
    if (px >= 0 && py >= 0 && px < STUDIO_SIZE && py < STUDIO_SIZE) touched.add(`${px},${py}`);
  }
  frame.layers[layerId] = pixels.filter(([px, py]) => !touched.has(`${px},${py}`));
  if (!erase) for (const key of touched) {
    const [px, py] = key.split(',').map(Number);
    frame.layers[layerId]!.push([px!, py!, color]);
  }
}
/** Fill every logical cell between two input points so quick pen or touch strokes stay continuous. */
export function paintStudioLine(frame: StudioFrame, layerId: string, fromX: number, fromY: number, toX: number, toY: number, color: number, size = 1, erase = false): void {
  let x = fromX;
  let y = fromY;
  const dx = Math.abs(toX - fromX);
  const dy = Math.abs(toY - fromY);
  const stepX = fromX < toX ? 1 : -1;
  const stepY = fromY < toY ? 1 : -1;
  let error = dx - dy;
  while (true) {
    paintStudioBrush(frame, layerId, x, y, color, size, erase);
    if (x === toX && y === toY) break;
    const twiceError = 2 * error;
    if (twiceError > -dy) { error -= dy; x += stepX; }
    if (twiceError < dx) { error += dx; y += stepY; }
  }
}
export function approveStudioFrame(project: StudioProject, direction: Direction, clip: ClipName, index: number): StudioProject {
  const next = replaceFrame(project, direction, clip, index, (frame) => ({ ...frame, approved: true }));
  return { ...next, revision: next.revision + 1 };
}
export function approveStudioClip(project: StudioProject, direction: Direction, clip: ClipName): StudioProject {
  const frames = project.views[direction][clip].map((frame) => ({ ...frame, approved: true }));
  return {
    ...project,
    views: { ...project.views, [direction]: { ...project.views[direction], [clip]: frames } },
    revision: project.revision + 1,
    updatedAt: Date.now(),
  };
}
