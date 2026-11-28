/**
 * boardArt.ts -- procedural art for the Monroe Loop board (Lok Party Slice 3).
 *
 * Everything is drawn in code: no bitmaps, no emoji, no stock symbols. The static city is baked
 * once per lighting mood (golden hour / midnight neon) into an offscreen canvas; living things
 * (lamp pools, neon breath, river shimmer, motes, tiles, the owl, dice) are drawn every frame.
 *
 * Projection: a 3/4 oblique view. x shears slightly with depth so building side faces show.
 */

import type { BoardDef, BoardNode, SpaceKind, Traversal } from './lokBoard';

export const WORLD_W = 2000;
export const WORLD_H = 1030;
export const Z_PX = 52;

export function P(x: number, y: number, z = 0): { x: number; y: number } {
  return { x: 170 + x - y * 0.14, y: 250 + y * 0.6 - z * Z_PX };
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

export interface Mood {
  night: boolean;
  sky: [string, string];
  asphalt: string;
  asphaltDark: string;
  sidewalk: string;
  curb: string;
  lane: string;
  water: [string, string];
  wallShade: number;
  windowDay: [string, string];
  windowLit: string;
  windowDark: string;
  rim: string;
  shadow: string;
}

export const GOLDEN: Mood = {
  night: false,
  sky: ['#f6b76b', '#7d4c7a'],
  asphalt: '#5b4a57',
  asphaltDark: '#4a3b48',
  sidewalk: '#a88f85',
  curb: '#e8cdb5',
  lane: '#ffe3a8',
  water: ['#5fa3c9', '#2d5b86'],
  wallShade: 0.72,
  windowDay: ['#ffe9b8', '#8db6d6'],
  windowLit: '#ffd889',
  windowDark: '#3e4a6b',
  rim: '#ffd59a',
  shadow: 'rgba(40,18,40,0.35)',
};

export const MIDNIGHT: Mood = {
  night: true,
  sky: ['#1a1446', '#05041a'],
  asphalt: '#17142f',
  asphaltDark: '#100e24',
  sidewalk: '#2b2650',
  curb: '#5d57a3',
  lane: '#7f78ff',
  water: ['#16376b', '#071431'],
  wallShade: 0.55,
  windowDay: ['#2a2f5a', '#141833'],
  windowLit: '#ffcf6e',
  windowDark: '#1b1d38',
  rim: '#7ef3ff',
  shadow: 'rgba(0,0,10,0.5)',
};

export const SPACE_COLOR: Record<SpaceKind, { top: string; side: string; rim: string; glyph: string }> = {
  cred: { top: '#38d5ff', side: '#0f6e9c', rim: '#c8f6ff', glyph: '#06344d' },
  glitch: { top: '#ff3fa4', side: '#8a0f55', rim: '#ffd0e9', glyph: '#4d062d' },
  event: { top: '#ffcb3c', side: '#a5650a', rim: '#fff3c2', glyph: '#5a3402' },
  supply: { top: '#5fe36f', side: '#1f7a2e', rim: '#d6ffd9', glyph: '#0b3d14' },
  hack: { top: '#ff9a2f', side: '#97480a', rim: '#ffe0bd', glyph: '#4a2203' },
  archon: { top: '#e3264a', side: '#6e0a1d', rim: '#ffc2cc', glyph: '#2b0008' },
  start: { top: '#f4efe6', side: '#8c8173', rim: '#ffffff', glyph: '#3b2a20' },
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
  return `rgb(${r},${g},${b})`;
}

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function quad(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** Ground-plane rectangle (board units) as a projected quad. */
function groundRect(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, z = 0) {
  quad(ctx, [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)]);
}

// ---------------------------------------------------------------------------
// City layout (static scenery)
// ---------------------------------------------------------------------------

type Facade = 'brick' | 'glass' | 'stucco' | 'tile';

export interface Building {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  h: number;
  facade: Facade;
  color: string;
  sign?: { text: string; color: string };
  awning?: string;
  waterTower?: boolean;
  fireEscape?: number;
  seed: number;
}

export const BUILDINGS: Building[] = [
  // Back row, behind the top avenue (tall skyline).
  { x0: 60, y0: 20, x1: 300, y1: 110, h: 230, facade: 'brick', color: '#8a3b33', waterTower: true, seed: 1 },
  { x0: 310, y0: 30, x1: 520, y1: 110, h: 290, facade: 'glass', color: '#2f5f73', sign: { text: '616', color: '#38f2ff' }, seed: 2 },
  { x0: 530, y0: 20, x1: 760, y1: 110, h: 200, facade: 'stucco', color: '#c9a27a', seed: 3 },
  { x0: 770, y0: 25, x1: 1010, y1: 110, h: 320, facade: 'glass', color: '#3b3f74', sign: { text: 'LOK', color: '#ff3fd2' }, seed: 4 },
  { x0: 1020, y0: 20, x1: 1260, y1: 110, h: 240, facade: 'brick', color: '#6e3a2c', waterTower: true, seed: 5 },
  { x0: 1270, y0: 30, x1: 1500, y1: 110, h: 270, facade: 'tile', color: '#3e6b5b', seed: 6 },
  { x0: 1510, y0: 20, x1: 1790, y1: 110, h: 210, facade: 'brick', color: '#7a4a34', sign: { text: 'MONROE', color: '#ffcb3c' }, seed: 7 },
  // North interior blocks (low so the top avenue reads).
  { x0: 300, y0: 385, x1: 520, y1: 500, h: 74, facade: 'stucco', color: '#d1ad86', awning: '#d9473a', seed: 8 },
  { x0: 530, y0: 385, x1: 790, y1: 500, h: 86, facade: 'brick', color: '#94443a', sign: { text: 'DINER', color: '#ff7a3c' }, seed: 9 },
  { x0: 830, y0: 400, x1: 990, y1: 500, h: 104, facade: 'brick', color: '#5d3a5a', seed: 10 },
  { x0: 1040, y0: 385, x1: 1290, y1: 500, h: 82, facade: 'tile', color: '#2f7b74', awning: '#2fbfff', seed: 11 },
  { x0: 1300, y0: 385, x1: 1540, y1: 500, h: 70, facade: 'stucco', color: '#b88d6a', seed: 12 },
  // South interior blocks, in front of the river.
  { x0: 300, y0: 740, x1: 540, y1: 920, h: 80, facade: 'brick', color: '#7e3d31', awning: '#f2c14e', seed: 13 },
  { x0: 550, y0: 740, x1: 790, y1: 920, h: 66, facade: 'glass', color: '#35606e', sign: { text: 'ARCADE', color: '#7cff6b' }, seed: 14 },
  { x0: 840, y0: 735, x1: 990, y1: 900, h: 104, facade: 'brick', color: '#6a3f2e', fireEscape: 905, seed: 15 },
  { x0: 1040, y0: 740, x1: 1280, y1: 920, h: 78, facade: 'tile', color: '#4c4f86', seed: 16 },
  { x0: 1290, y0: 740, x1: 1540, y1: 920, h: 64, facade: 'stucco', color: '#cfa37c', awning: '#3fbf7f', seed: 17 },
];

const RIVER = { y0: 560, y1: 690, depth: 0.7 };
const TERRACE = { x0: 1600, y0: 360, x1: 1770, y1: 840 };

/** Things the player has poked: toggled windows, recolored signs, switched-off lamps. */
export interface CityState {
  windows: Set<string>;
  signs: Record<number, number>;
  lampsOff: Set<number>;
}
export const SIGN_COLORS = ['#38f2ff', '#ff3fd2', '#ffcb3c', '#7cff6b', '#b56cff', '#ff7a3c'];
export function createCityState(): CityState {
  return { windows: new Set(), signs: {}, lampsOff: new Set() };
}
export function signColor(b: Building, city: CityState): string {
  const i = city.signs[b.seed];
  return i === undefined ? b.sign!.color : SIGN_COLORS[i % SIGN_COLORS.length];
}

/** Window rectangles in world-screen space (shared by drawing and tap hit-tests). */
export function windowRects(b: Building): { key: string; x: number; y: number; w: number; h: number; lit: boolean }[] {
  const zt = b.h / Z_PX;
  const fl = P(b.x0, b.y1, 0);
  const fr = P(b.x1, b.y1, 0);
  const tl = P(b.x0, b.y1, zt);
  const W = fr.x - fl.x;
  const H = fl.y - tl.y;
  const floors = Math.max(1, Math.floor((H - 26) / 30));
  const cols = Math.max(2, Math.floor(W / 30));
  const ww = Math.min(14, W / cols - 9);
  const out: { key: string; x: number; y: number; w: number; h: number; lit: boolean }[] = [];
  for (let f = 0; f < floors; f += 1)
    for (let c = 0; c < cols; c += 1)
      out.push({ key: `${b.seed}:${f}:${c}`, x: fl.x + (c + 0.5) * (W / cols) - ww / 2, y: tl.y + 12 + f * 30, w: ww, h: 14, lit: hash(b.seed * 131 + f * 17 + c * 7) > 0.45 });
  return out;
}

/** Screen-space box for a building sprite (with room for roof props and signs). */
export function buildingBox(b: Building): { x: number; y: number; w: number; h: number } {
  const zt = b.h / Z_PX;
  const fl = P(b.x0, b.y1, 0);
  const br = P(b.x1, b.y0, zt);
  const bl = P(b.x0, b.y0, zt);
  const x = fl.x - 8;
  const y = Math.min(br.y, bl.y) - 80;
  return { x, y, w: br.x + 48 - x, h: fl.y + 4 - y };
}

export interface Sprite {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function makeSprite(box: { x: number; y: number; w: number; h: number }, scale: number, draw: (ctx: CanvasRenderingContext2D) => void): Sprite {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(box.w * scale));
  c.height = Math.max(1, Math.ceil(box.h * scale));
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.translate(-box.x, -box.y);
  draw(ctx);
  return { canvas: c, ...box };
}

export function bakeBuilding(b: Building, mood: Mood, scale: number, city: CityState): Sprite {
  return makeSprite(buildingBox(b), scale, (ctx) => drawBuilding(ctx, b, mood, city));
}

export const GANTRY_SORT = 700;
export const SLIDE_SORT = 960;

export function bakeGantry(mood: Mood, scale: number): Sprite {
  const a = P(870, 760, 2);
  const b = P(950, 500, 2.6);
  const c = P(950, 650, -0.8);
  const box = { x: a.x - 20, y: b.y - 20, w: b.x - a.x + 60, h: c.y - b.y + 40 };
  return makeSprite(box, scale, (ctx) => drawGantry(ctx, mood));
}

export function bakeSlide(mood: Mood, scale: number): Sprite {
  const a = P(1660, 670, 1);
  const b = P(1300, 1000, 0);
  const box = { x: b.x - 30, y: a.y - 30, w: a.x - b.x + 70, h: b.y - a.y + 80 };
  return makeSprite(box, scale, (ctx) => drawSlideChute(ctx, mood));
}

/** Depth key: larger draws later. Elevated spaces sit above their own building. */
export function nodeSortY(n: { y: number; z: number }): number {
  return n.y + n.z * 100;
}

// ---------------------------------------------------------------------------
// Backdrop (baked)
// ---------------------------------------------------------------------------

export function bakeGround(mood: Mood, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(WORLD_W * scale);
  c.height = Math.round(WORLD_H * scale);
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  const sky = ctx.createLinearGradient(0, 0, 0, 380);
  sky.addColorStop(0, mood.sky[1]);
  sky.addColorStop(1, mood.sky[0]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  if (mood.night) {
    for (let i = 0; i < 140; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + hash(i) * 0.6})`;
      ctx.fillRect(hash(i + 7) * WORLD_W, hash(i + 13) * 220, 1.5, 1.5);
    }
  } else {
    const sun = ctx.createRadialGradient(1600, 120, 4, 1600, 120, 300);
    sun.addColorStop(0, 'rgba(255,240,200,0.95)');
    sun.addColorStop(0.2, 'rgba(255,200,120,0.5)');
    sun.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(1250, -200, 700, 640);
  }
  drawGround(ctx, mood);
  drawRiver(ctx, mood);
  for (const b of BUILDINGS) drawBuildingShadow(ctx, b, mood);
  drawTerrace(ctx, mood);
  return c;
}

function drawGround(ctx: CanvasRenderingContext2D, mood: Mood) {
  // Base block ground (sidewalk pavers everywhere), then roads on top.
  ctx.fillStyle = mood.sidewalk;
  groundRect(ctx, -400, 110, 2400, 1700);
  ctx.fill();
  // Paver grid.
  ctx.strokeStyle = rgba(mood.night ? '#ffffff' : '#3b2a20', 0.07);
  ctx.lineWidth = 1;
  for (let y = 120; y < 1150; y += 26) {
    const a = P(-200, y);
    const b = P(2100, y);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (let x = -200; x < 2100; x += 40) {
    const a = P(x, 110);
    const b = P(x, 1150);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  const roads: [number, number, number, number][] = [
    [40, 140, 1800, 245], // top avenue
    [40, 960, 1800, 1065], // bottom avenue
    [40, 140, 210, 1065], // west
    [1590, 140, 1800, 1065], // east
    [860, 245, 960, 330], // short center alleys
  ];
  for (const [x0, y0, x1, y1] of roads) {
    const g = ctx.createLinearGradient(0, P(0, y0).y, 0, P(0, y1).y);
    g.addColorStop(0, mood.asphaltDark);
    g.addColorStop(1, mood.asphalt);
    ctx.fillStyle = g;
    groundRect(ctx, x0, y0, x1, y1);
    ctx.fill();
  }
  // Asphalt grain.
  for (let i = 0; i < 2600; i += 1) {
    const x = 40 + hash(i * 3.1) * 1760;
    const y = 140 + hash(i * 7.7) * 925;
    const onRoad = y < 245 || y > 960 || x < 210 || x > 1590;
    if (!onRoad) continue;
    const p = P(x, y);
    ctx.fillStyle = hash(i) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(p.x, p.y, 1.6, 1.2);
  }
  // Curbs.
  ctx.strokeStyle = mood.curb;
  ctx.lineWidth = 2.5;
  for (const [x0, y0, x1, y1] of [
    [210, 245, 1590, 245],
    [210, 960, 1590, 960],
    [210, 245, 210, 960],
    [1590, 245, 1590, 960],
  ]) {
    const a = P(x0, y0);
    const b = P(x1, y1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Lane dashes.
  ctx.strokeStyle = rgba(mood.lane, 0.55);
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 18]);
  for (const [x0, y0, x1, y1] of [
    [220, 192, 1580, 192],
    [220, 1012, 1580, 1012],
  ]) {
    const a = P(x0, y0 + 28);
    const b = P(x1, y1 + 28);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at the four corners.
  ctx.fillStyle = rgba(mood.night ? '#c9c4ff' : '#fff6e6', 0.55);
  for (const [cx, cy] of [
    [225, 195],
    [1575, 195],
    [225, 1010],
    [1575, 1010],
  ]) {
    for (let i = -3; i <= 3; i += 1) {
      groundRect(ctx, cx + i * 14 - 4, cy - 46, cx + i * 14 + 4, cy - 34);
      ctx.fill();
    }
  }
  // Manhole covers.
  for (const [x, y] of [
    [700, 205],
    [1200, 1025],
    [125, 430],
  ]) {
    const p = P(x, y);
    ctx.fillStyle = mood.night ? '#2c2a44' : '#3d3238';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    for (let k = -2; k <= 2; k += 1) {
      ctx.beginPath();
      ctx.moveTo(p.x - 10, p.y + k * 2.4);
      ctx.lineTo(p.x + 10, p.y + k * 2.4);
      ctx.stroke();
    }
  }
}

function drawRiver(ctx: CanvasRenderingContext2D, mood: Mood) {
  const { y0, y1, depth } = RIVER;
  const dz = -depth;
  // North embankment wall face (we look at it from the south).
  const top = [P(-100, y0, 0), P(2100, y0, 0)];
  const bot = [P(-100, y0, dz), P(2100, y0, dz)];
  ctx.fillStyle = mood.night ? '#2b2747' : '#8d7466';
  quad(ctx, [top[0], top[1], bot[1], bot[0]]);
  ctx.fill();
  // Stone courses.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let k = 1; k < 4; k += 1) {
    const a = P(-100, y0, (dz * k) / 4);
    const b = P(2100, y0, (dz * k) / 4);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    for (let x = -100 + (k % 2) * 30; x < 2100; x += 60) {
      const s = P(x, y0, (dz * (k - 1)) / 4);
      const e = P(x, y0, (dz * k) / 4);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
  }
  // Water.
  const w0 = P(0, y0, dz).y;
  const w1 = P(0, y1, dz).y;
  const g = ctx.createLinearGradient(0, w0, 0, w1);
  g.addColorStop(0, mood.water[1]);
  g.addColorStop(1, mood.water[0]);
  ctx.fillStyle = g;
  quad(ctx, [P(-100, y0, dz), P(2100, y0, dz), P(2100, y1, dz), P(-100, y1, dz)]);
  ctx.fill();
  // South bank lip and railings.
  ctx.fillStyle = mood.curb;
  quad(ctx, [P(-100, y1, 0), P(2100, y1, 0), P(2100, y1 + 8, 0), P(-100, y1 + 8, 0)]);
  ctx.fill();
  ctx.strokeStyle = mood.night ? '#8b86d8' : '#4a3a36';
  ctx.lineWidth = 1.5;
  for (const yy of [y0 - 4, y1 + 4]) {
    const a = P(-100, yy, 0.35);
    const b = P(2100, yy, 0.35);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    for (let x = -100; x < 2100; x += 34) {
      const s = P(x, yy, 0);
      const e = P(x, yy, 0.35);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
  }
  // West street bridge deck over the river.
  ctx.fillStyle = mood.asphalt;
  groundRect(ctx, 40, y0 - 6, 210, y1 + 6, 0.02);
  ctx.fill();
  ctx.strokeStyle = mood.curb;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBuildingShadow(ctx: CanvasRenderingContext2D, b: Building, mood: Mood) {
  const fl = P(b.x0, b.y1, 0);
  const fr = P(b.x1, b.y1, 0);
  ctx.fillStyle = mood.shadow;
  const sx = mood.night ? 10 : 34;
  quad(ctx, [fl, fr, { x: fr.x + sx, y: fr.y + 10 }, { x: fl.x + sx, y: fl.y + 10 }]);
  ctx.fill();
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, mood: Mood, city: CityState) {
  const { x0, y0, x1, y1, h } = b;
  const zt = h / Z_PX;
  const fl = P(x0, y1, 0);
  const fr = P(x1, y1, 0);
  const tl = P(x0, y1, zt);
  const tr = P(x1, y1, zt);
  const br = P(x1, y0, zt);
  const bl = P(x0, y0, zt);
  const sideBottomBack = P(x1, y0, 0);
  // Right side face.
  ctx.fillStyle = shade(b.color, mood.wallShade * 0.85);
  quad(ctx, [fr, sideBottomBack, br, tr]);
  ctx.fill();
  // Front face.
  const fg = ctx.createLinearGradient(0, tl.y, 0, fl.y);
  fg.addColorStop(0, shade(b.color, mood.night ? 0.8 : 1.08));
  fg.addColorStop(1, shade(b.color, mood.night ? 0.55 : 0.82));
  ctx.fillStyle = fg;
  ctx.fillRect(fl.x, tl.y, fr.x - fl.x, fl.y - tl.y);
  // Facade texture.
  const W = fr.x - fl.x;
  const H = fl.y - tl.y;
  ctx.save();
  ctx.beginPath();
  ctx.rect(fl.x, tl.y, W, H);
  ctx.clip();
  if (b.facade === 'brick') {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    for (let y = tl.y + 5, row = 0; y < fl.y; y += 6, row += 1) {
      ctx.beginPath();
      ctx.moveTo(fl.x, y);
      ctx.lineTo(fr.x, y);
      ctx.stroke();
      for (let x = fl.x + (row % 2) * 7; x < fr.x; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 6);
        ctx.stroke();
      }
    }
  } else if (b.facade === 'tile') {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    for (let y = tl.y; y < fl.y; y += 10) {
      ctx.beginPath();
      ctx.moveTo(fl.x, y);
      ctx.lineTo(fr.x, y);
      ctx.stroke();
    }
    for (let x = fl.x; x < fr.x; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, tl.y);
      ctx.lineTo(x, fl.y);
      ctx.stroke();
    }
  } else if (b.facade === 'stucco') {
    for (let i = 0; i < W * H * 0.02; i += 1) {
      ctx.fillStyle = hash(i + b.seed * 91) > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(fl.x + hash(i * 1.3 + b.seed) * W, tl.y + hash(i * 2.7 + b.seed) * H, 2, 2);
    }
  } else {
    // Glass curtain wall: mullions.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    for (let x = fl.x + 8; x < fr.x; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, tl.y);
      ctx.lineTo(x, fl.y);
      ctx.stroke();
    }
  }
  // Windows (tappable: a toggled window flips its light).
  for (const w of windowRects(b)) {
    const toggled = city.windows.has(w.key);
    const on = mood.night ? w.lit !== toggled : toggled;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(w.x - 2, w.y - 2, w.w + 4, 18);
    if (on) ctx.fillStyle = mood.windowLit;
    else if (mood.night) ctx.fillStyle = mood.windowDark;
    else {
      const wg = ctx.createLinearGradient(w.x, w.y, w.x + w.w, w.y + 14);
      wg.addColorStop(0, mood.windowDay[0]);
      wg.addColorStop(1, mood.windowDay[1]);
      ctx.fillStyle = wg;
    }
    ctx.fillRect(w.x, w.y, w.w, 14);
    if (on) {
      // Warm interior: a lamp glow and a silhouette shelf.
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(w.x + 1, w.y + 1, w.w * 0.4, 4);
      ctx.fillStyle = 'rgba(120,60,20,0.35)';
      ctx.fillRect(w.x, w.y + 10, w.w, 4);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(w.x + w.w / 2 - 0.5, w.y, 1, 14);
    ctx.fillStyle = mood.night ? 'rgba(255,255,255,0.15)' : 'rgba(255,240,220,0.5)';
    ctx.fillRect(w.x - 2, w.y + 14, w.w + 4, 2);
  }
  // Ground floor: door and shop window.
  const doorX = fl.x + W * 0.5 - 7;
  ctx.fillStyle = shade(b.color, 0.4);
  ctx.fillRect(doorX, fl.y - 22, 14, 22);
  ctx.fillStyle = mood.night ? 'rgba(255,207,110,0.5)' : 'rgba(255,255,255,0.25)';
  ctx.fillRect(doorX + 2, fl.y - 20, 10, 8);
  ctx.restore();
  // Awning.
  if (b.awning) {
    const ay = fl.y - 26;
    for (let x = fl.x + 4, i = 0; x < fr.x - 4; x += 10, i += 1) {
      ctx.fillStyle = i % 2 ? '#f7efe3' : b.awning;
      ctx.beginPath();
      ctx.moveTo(x, ay);
      ctx.lineTo(x + 10, ay);
      ctx.lineTo(x + 12, ay + 9);
      ctx.quadraticCurveTo(x + 7, ay + 13, x + 2, ay + 9);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Top (roof) face with parapet.
  ctx.fillStyle = shade(b.color, mood.night ? 0.42 : 0.62);
  quad(ctx, [tl, tr, br, bl]);
  ctx.fill();
  ctx.strokeStyle = shade(b.color, mood.night ? 0.9 : 1.25);
  ctx.lineWidth = 2;
  quad(ctx, [tl, tr, br, bl]);
  ctx.stroke();
  // Rim light along the top front edge.
  ctx.strokeStyle = rgba(mood.rim, mood.night ? 0.55 : 0.8);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.stroke();
  // Roof props: AC units and vents.
  for (let i = 0; i < 3; i += 1) {
    const rx = x0 + (x1 - x0) * (0.2 + hash(b.seed + i * 3) * 0.6);
    const ry = y0 + (y1 - y0) * (0.25 + hash(b.seed * 2 + i) * 0.5);
    const p = P(rx, ry, zt);
    ctx.fillStyle = mood.night ? '#4a4870' : '#b9aea5';
    ctx.fillRect(p.x - 9, p.y - 10, 18, 10);
    ctx.fillStyle = mood.night ? '#33315a' : '#8a7f78';
    ctx.fillRect(p.x + 9, p.y - 10, 4, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k += 1) {
      ctx.beginPath();
      ctx.moveTo(p.x - 7 + k * 4.5, p.y - 8);
      ctx.lineTo(p.x - 7 + k * 4.5, p.y - 2);
      ctx.stroke();
    }
  }
  if (b.waterTower) drawWaterTower(ctx, P((x0 + x1) / 2 + 30, (y0 + y1) / 2, zt), mood);
  if (b.fireEscape !== undefined) drawFireEscape(ctx, b, mood);
  if (b.sign) drawSignBox(ctx, b, mood, signColor(b, city));
}

function drawWaterTower(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, mood: Mood) {
  ctx.strokeStyle = mood.night ? '#5a557f' : '#5a4436';
  ctx.lineWidth = 2;
  for (const dx of [-14, -5, 5, 14]) {
    ctx.beginPath();
    ctx.moveTo(p.x + dx, p.y);
    ctx.lineTo(p.x + dx * 0.7, p.y - 24);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(p.x - 13, p.y - 10);
  ctx.lineTo(p.x + 13, p.y - 18);
  ctx.moveTo(p.x + 13, p.y - 10);
  ctx.lineTo(p.x - 13, p.y - 18);
  ctx.stroke();
  const g = ctx.createLinearGradient(p.x - 16, 0, p.x + 16, 0);
  g.addColorStop(0, mood.night ? '#5b3f3a' : '#a0623f');
  g.addColorStop(0.6, mood.night ? '#7b5246' : '#c98457');
  g.addColorStop(1, mood.night ? '#3a2826' : '#6d3f28');
  ctx.fillStyle = g;
  ctx.fillRect(p.x - 16, p.y - 52, 32, 28);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let k = 1; k < 4; k += 1) {
    ctx.beginPath();
    ctx.moveTo(p.x - 16, p.y - 52 + k * 7);
    ctx.lineTo(p.x + 16, p.y - 52 + k * 7);
    ctx.stroke();
  }
  ctx.fillStyle = mood.night ? '#2d2340' : '#5a3a2a';
  ctx.beginPath();
  ctx.moveTo(p.x - 19, p.y - 52);
  ctx.lineTo(p.x, p.y - 68);
  ctx.lineTo(p.x + 19, p.y - 52);
  ctx.closePath();
  ctx.fill();
}

function drawFireEscape(ctx: CanvasRenderingContext2D, b: Building, mood: Mood) {
  const x = b.fireEscape!;
  const iron = mood.night ? '#8f8ad6' : '#2d2520';
  ctx.strokeStyle = iron;
  ctx.fillStyle = iron;
  const zt = b.h / Z_PX;
  // Landings every floor, zig-zag stairs between, a drop ladder to the street.
  for (let k = 0; k <= 2; k += 1) {
    const z = 0.6 + (k * (zt - 0.6)) / 2;
    const a = P(x - 34, b.y1 + 4, z);
    const c = P(x + 34, b.y1 + 4, z);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i += 1) {
      const t = P(x - 34 + i * 8.5, b.y1 + 4, z);
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x, t.y - 10);
      ctx.stroke();
    }
    const r0 = P(x - 34, b.y1 + 4, z);
    const r1 = P(x + 34, b.y1 + 4, z);
    ctx.beginPath();
    ctx.moveTo(r0.x, r0.y - 10);
    ctx.lineTo(r1.x, r1.y - 10);
    ctx.stroke();
    if (k < 2) {
      const s0 = P(k % 2 ? x + 30 : x - 30, b.y1 + 4, z);
      const s1 = P(k % 2 ? x - 30 : x + 30, b.y1 + 4, 0.6 + ((k + 1) * (zt - 0.6)) / 2);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();
    }
  }
  // Drop ladder to the street.
  const l0 = P(x, b.y1 + 4, 0);
  const l1 = P(x, b.y1 + 4, 0.6);
  ctx.lineWidth = 1.5;
  for (const dx of [-5, 5]) {
    ctx.beginPath();
    ctx.moveTo(l0.x + dx, l0.y);
    ctx.lineTo(l1.x + dx, l1.y);
    ctx.stroke();
  }
  for (let y = l1.y; y < l0.y; y += 5) {
    ctx.beginPath();
    ctx.moveTo(l0.x - 5, y);
    ctx.lineTo(l0.x + 5, y);
    ctx.stroke();
  }
}

/** Sign plate rectangle in world-screen space (for taps). */
export function signRect(b: Building): { x: number; y: number; w: number; h: number } {
  const p = P((b.x0 + b.x1) / 2, b.y1, (b.h / Z_PX) * 0.62);
  const w = b.sign!.text.length * 14 + 22;
  return { x: p.x - w / 2, y: p.y - 15, w, h: 30 };
}

function drawSignBox(ctx: CanvasRenderingContext2D, b: Building, mood: Mood, color: string) {
  const sign = { text: b.sign!.text, color };
  const zt = b.h / Z_PX;
  const p = P((b.x0 + b.x1) / 2, b.y1, zt * 0.62);
  ctx.font = '900 20px ui-sans-serif, system-ui, sans-serif';
  const w = ctx.measureText(sign.text).width + 22;
  ctx.fillStyle = mood.night ? '#120d24' : '#2a1f2b';
  ctx.strokeStyle = mood.night ? '#3a2e66' : '#1a1218';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(p.x - w / 2, p.y - 15, w, 30, 6);
  ctx.fill();
  ctx.stroke();
  // Bolts.
  ctx.fillStyle = '#8a8199';
  for (const dx of [-w / 2 + 5, w / 2 - 5]) for (const dy of [-10, 10]) ctx.fillRect(p.x + dx - 1, p.y + dy - 1, 2, 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = rgba(sign.color, mood.night ? 0.35 : 0.2);
  ctx.strokeText(sign.text, p.x, p.y + 1);
  ctx.fillStyle = mood.night ? sign.color : shade(sign.color, 0.8);
  ctx.fillText(sign.text, p.x, p.y + 1);
}

export function drawGantry(ctx: CanvasRenderingContext2D, mood: Mood) {
  const x0 = 870;
  const x1 = 950;
  const ya = 500;
  const yb = 760;
  const z = 2;
  const steel = mood.night ? '#7f7cc9' : '#3b3640';
  const steelHi = mood.night ? '#c3c0ff' : '#8a7f86';
  // Pylons down into the river.
  for (const y of [600, 650]) {
    for (const x of [x0 + 6, x1 - 6]) {
      const a = P(x, y, z);
      const b = P(x, y, -RIVER.depth);
      ctx.fillStyle = mood.night ? '#3a3770' : '#5a4f58';
      ctx.fillRect(a.x - 4, a.y, 8, b.y - a.y);
    }
  }
  // Deck plates.
  ctx.fillStyle = mood.night ? '#2c2a55' : '#6b6067';
  quad(ctx, [P(x0, ya, z), P(x1, ya, z), P(x1, yb, z), P(x0, yb, z)]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let y = ya; y < yb; y += 16) {
    const a = P(x0, y, z);
    const b = P(x1, y, z);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Two truss sides with X bracing and rivets.
  for (const x of [x0, x1]) {
    const top = (y: number) => P(x, y, z + 0.55);
    const bot = (y: number) => P(x, y, z);
    ctx.strokeStyle = steel;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(top(ya).x, top(ya).y);
    ctx.lineTo(top(yb).x, top(yb).y);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let y = ya; y < yb; y += 40) {
      ctx.beginPath();
      ctx.moveTo(bot(y).x, bot(y).y);
      ctx.lineTo(top(y + 40).x, top(y + 40).y);
      ctx.moveTo(top(y).x, top(y).y);
      ctx.lineTo(bot(y + 40).x, bot(y + 40).y);
      ctx.moveTo(top(y).x, top(y).y);
      ctx.lineTo(bot(y).x, bot(y).y);
      ctx.stroke();
      ctx.fillStyle = steelHi;
      const r = top(y);
      ctx.fillRect(r.x - 1.5, r.y - 1.5, 3, 3);
    }
  }
  // Warning stripes on the deck ends.
  for (const y of [ya + 4, yb - 12]) {
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = i % 2 ? '#1a1218' : '#ffcb3c';
      quad(ctx, [P(x0 + i * 13, y, z), P(x0 + i * 13 + 13, y, z), P(x0 + i * 13 + 13, y + 8, z), P(x0 + i * 13, y + 8, z)]);
      ctx.fill();
    }
  }
}

function drawTerrace(ctx: CanvasRenderingContext2D, mood: Mood) {
  const { x0, y0, x1, y1 } = TERRACE;
  const z = 1;
  // Front retaining wall (south end) and west wall.
  const stone = mood.night ? '#3a3566' : '#a08371';
  ctx.fillStyle = shade(stone.startsWith('#') ? stone : '#a08371', 0.8);
  quad(ctx, [P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, z), P(x0, y1, z)]);
  ctx.fill();
  ctx.fillStyle = shade(stone, 0.65);
  quad(ctx, [P(x0, y0, 0), P(x0, y1, 0), P(x0, y1, z), P(x0, y0, z)]);
  ctx.fill();
  // Stone blocks on the walls.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let y = y0; y < y1; y += 30) {
    const a = P(x0, y, 0);
    const b = P(x0, y, z);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Plaza top: hex pavers.
  ctx.fillStyle = mood.night ? '#2f2a5a' : '#c9ad94';
  quad(ctx, [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)]);
  ctx.fill();
  ctx.strokeStyle = rgba(mood.night ? '#8f88ff' : '#6d5446', 0.25);
  for (let y = y0 + 15; y < y1; y += 22)
    for (let x = x0 + ((y / 22) % 2) * 11; x < x1; x += 22) {
      const p = P(x, y, z);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 6, 3.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  // Stairs at both ends (rendered as stepped wedges).
  for (const [ya, yb] of [
    [300, 400],
    [800, 900],
  ]) {
    for (let i = 0; i < 6; i += 1) {
      const zz = ya < 500 ? (i + 1) / 6 : 1 - i / 6;
      const yy = ya + ((yb - ya) * i) / 6;
      ctx.fillStyle = shade(stone, 0.9 - (i % 2) * 0.08);
      quad(ctx, [P(1630, yy, zz), P(1740, yy, zz), P(1740, yy + (yb - ya) / 6, zz), P(1630, yy + (yb - ya) / 6, zz)]);
      ctx.fill();
      ctx.strokeStyle = rgba(mood.rim, 0.4);
      ctx.stroke();
    }
  }
}

export function drawSlideChute(ctx: CanvasRenderingContext2D, mood: Mood) {
  const a = P(1660, 670, 1);
  const c1 = P(1560, 760, 0.9);
  const c2 = P(1420, 880, 0.4);
  const b = P(1300, 1000, 0);
  const metal = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  metal.addColorStop(0, mood.night ? '#9a96e8' : '#c9c1bb');
  metal.addColorStop(1, mood.night ? '#4a4790' : '#6e6460');
  // Supports.
  ctx.strokeStyle = mood.night ? '#3a3770' : '#4a3f3a';
  ctx.lineWidth = 3;
  for (const t of [0.25, 0.5, 0.75]) {
    const x = (1 - t) ** 3 * a.x + 3 * (1 - t) ** 2 * t * c1.x + 3 * (1 - t) * t * t * c2.x + t ** 3 * b.x;
    const y = (1 - t) ** 3 * a.y + 3 * (1 - t) ** 2 * t * c1.y + 3 * (1 - t) * t * t * c2.y + t ** 3 * b.y;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 40 * (1 - t));
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(a.x + 4, a.y + 6);
  ctx.bezierCurveTo(c1.x + 4, c1.y + 6, c2.x + 4, c2.y + 6, b.x + 4, b.y + 6);
  ctx.stroke();
  ctx.strokeStyle = metal;
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = mood.night ? '#23214a' : '#57504c';
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.strokeStyle = rgba(mood.rim, 0.7);
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 9]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
}

function drawTree(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, mood: Mood, k = 1) {
  ctx.fillStyle = mood.night ? '#3b3466' : '#7a5f50';
  ctx.fillRect(p.x - 10 * k, p.y - 8 * k, 20 * k, 9 * k);
  ctx.fillStyle = mood.night ? '#2a2450' : '#5e483d';
  ctx.fillRect(p.x - 10 * k, p.y - 8 * k, 20 * k, 2 * k);
  ctx.fillStyle = mood.night ? '#3a2a2a' : '#5a3b28';
  ctx.fillRect(p.x - 2 * k, p.y - 26 * k, 4 * k, 18 * k);
  const leaves = mood.night ? ['#14513f', '#1d6b52', '#2b8a6b'] : ['#4f7a2f', '#6f9a3a', '#a9c25a'];
  const blobs: [number, number, number][] = [
    [0, -38, 15],
    [-10, -32, 11],
    [10, -31, 11],
    [-4, -46, 9],
    [6, -44, 9],
  ];
  blobs.forEach(([dx, dy, r], i) => {
    ctx.fillStyle = leaves[i % 3];
    ctx.beginPath();
    ctx.arc(p.x + dx * k, p.y + dy * k, r * k, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = rgba(mood.night ? '#7ef3ff' : '#fff2b0', 0.35);
  ctx.beginPath();
  ctx.arc(p.x + 4 * k, p.y - 44 * k, 4 * k, 0, Math.PI * 2);
  ctx.fill();
}

export const LAMPS: [number, number][] = [
  [380, 245],
  [800, 245],
  [1220, 245],
  [380, 960],
  [800, 960],
  [1220, 960],
  [210, 520],
  [210, 820],
  [1590, 270],
];

export type PropKind = 'lamp' | 'tree' | 'crate' | 'hydrant' | 'bench' | 'shelter' | 'bollards';
export interface Prop {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  k?: number;
  lamp?: number;
}

export const PROPS: Prop[] = (() => {
  const out: Prop[] = [];
  let id = 0;
  LAMPS.forEach(([x, y], i) => out.push({ id: id++, kind: 'lamp', x, y, z: 0, lamp: i }));
  for (const [x, y] of [
    [460, 960],
    [1080, 960],
    [210, 690],
    [520, 250],
    [1420, 250],
  ])
    out.push({ id: id++, kind: 'tree', x, y, z: 0 });
  for (const y of [420, 560, 760]) out.push({ id: id++, kind: 'tree', x: TERRACE.x1 - 18, y, z: 1, k: 0.9 });
  for (const x of [300, 760, 1250, 1700]) out.push({ id: id++, kind: 'tree', x, y: 1135, z: 0, k: 1.15 });
  for (const [x, y, n] of [
    [820, 520, 3],
    [1000, 720, 2],
    [560, 960, 2],
  ])
    for (let i = 0; i < n; i += 1) out.push({ id: id++, kind: 'crate', x: x + (i % 2) * 22, y, z: i > 1 ? 0.45 : 0 });
  for (const [x, y] of [
    [640, 960],
    [1500, 245],
  ])
    out.push({ id: id++, kind: 'hydrant', x, y, z: 0 });
  for (const x of [520, 1000, 1480]) out.push({ id: id++, kind: 'bench', x, y: 1130, z: 0 });
  out.push({ id: id++, kind: 'shelter', x: 1100, y: 1140, z: 0 });
  out.push({ id: id++, kind: 'bollards', x: 0, y: 1095, z: 0 });
  return out;
})();

export function propSortY(p: Prop): number {
  return p.y + p.z * 100 + 2;
}

/** Tap target for a prop, world-screen space. */
export function propHit(p: Prop): { x: number; y: number; r: number } | null {
  const b = P(p.x, p.y, p.z);
  switch (p.kind) {
    case 'lamp':
      return { x: b.x + 6, y: b.y - 50, r: 30 };
    case 'tree':
      return { x: b.x, y: b.y - 34 * (p.k ?? 1), r: 22 * (p.k ?? 1) };
    case 'crate':
      return { x: b.x + 3, y: b.y - 11, r: 16 };
    case 'hydrant':
      return { x: b.x, y: b.y - 8, r: 12 };
    case 'bench':
      return { x: b.x, y: b.y - 8, r: 24 };
    case 'shelter':
      return { x: b.x, y: b.y - 30, r: 40 };
    default:
      return null;
  }
}

/** Draw a prop with its live reaction (sway, wobble) and lamp state. */
export function drawProp(ctx: CanvasRenderingContext2D, p: Prop, mood: Mood, city: CityState, react: number) {
  const b = P(p.x, p.y, p.z);
  const wob = react > 0 ? Math.sin(react * 30) * react * 0.25 : 0;
  switch (p.kind) {
    case 'lamp': {
      const off = city.lampsOff.has(p.lamp ?? -1);
      const head = P(p.x, p.y, 1.6);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(wob * 0.5);
      ctx.translate(-b.x, -b.y);
      ctx.strokeStyle = mood.night ? '#5d58a8' : '#2d2520';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(head.x, head.y);
      ctx.lineTo(head.x + 12, head.y + 2);
      ctx.stroke();
      ctx.fillStyle = mood.night ? '#5d58a8' : '#2d2520';
      ctx.fillRect(b.x - 4, b.y - 3, 8, 4);
      ctx.fillStyle = off ? '#3a3550' : mood.night ? '#fff1b8' : '#f3e1c6';
      ctx.beginPath();
      ctx.ellipse(head.x + 12, head.y + 4, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'tree': {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(wob * 0.6);
      ctx.translate(-b.x, -b.y);
      drawTree(ctx, b, mood, p.k ?? 1);
      ctx.restore();
      break;
    }
    case 'crate': {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(1 + wob * 0.6, 1 - wob * 0.6);
      ctx.translate(-b.x, -b.y);
      drawCrate(ctx, b, mood);
      ctx.restore();
      break;
    }
    case 'hydrant': {
      ctx.fillStyle = '#d63a2f';
      ctx.fillRect(b.x - 4, b.y - 14, 8, 14);
      ctx.fillRect(b.x - 7, b.y - 9, 14, 4);
      ctx.fillStyle = '#ff7a6b';
      ctx.fillRect(b.x - 3, b.y - 17, 6, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x - 3, b.y - 13, 2, 10);
      break;
    }
    case 'bench': {
      ctx.fillStyle = mood.night ? '#5a4a7a' : '#8a5a3a';
      for (let k = 0; k < 3; k += 1) ctx.fillRect(b.x - 24, b.y - 14 + k * 4 - wob * 6, 48, 3);
      ctx.fillStyle = mood.night ? '#3a3266' : '#3b2f2e';
      ctx.fillRect(b.x - 22, b.y - 2, 3, 6);
      ctx.fillRect(b.x + 19, b.y - 2, 3, 6);
      break;
    }
    case 'shelter': {
      ctx.fillStyle = mood.night ? 'rgba(126,243,255,0.18)' : 'rgba(200,230,255,0.35)';
      ctx.fillRect(b.x - 40, b.y - 52, 80, 46);
      ctx.strokeStyle = mood.night ? '#8f88ff' : '#3b2f2e';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x - 40, b.y - 52, 80, 46);
      ctx.fillStyle = mood.night ? '#ff3fd2' : '#d9473a';
      ctx.fillRect(b.x - 44, b.y - 58 - wob * 8, 88, 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 9px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('616 TRANSIT', b.x, b.y - 52 - wob * 8);
      break;
    }
    case 'bollards': {
      ctx.strokeStyle = mood.curb;
      ctx.lineWidth = 2.5;
      const pa = P(-200, 1100);
      const pb = P(2100, 1100);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      for (let x = 120; x < 1850; x += 70) {
        const q = P(x, 1095);
        ctx.fillStyle = mood.night ? '#4a4590' : '#3b2f2e';
        ctx.fillRect(q.x - 3, q.y - 14, 6, 14);
        ctx.fillStyle = mood.night ? '#ffcb3c' : '#e8cdb5';
        ctx.fillRect(q.x - 3, q.y - 12, 6, 2);
      }
      break;
    }
  }
}

function drawCrate(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, mood: Mood) {
  const wood = mood.night ? '#6a4a6a' : '#b07a45';
  ctx.fillStyle = wood;
  ctx.fillRect(p.x - 10, p.y - 20, 20, 20);
  ctx.fillStyle = shade(wood, 0.75);
  ctx.beginPath();
  ctx.moveTo(p.x + 10, p.y - 20);
  ctx.lineTo(p.x + 16, p.y - 24);
  ctx.lineTo(p.x + 16, p.y - 4);
  ctx.lineTo(p.x + 10, p.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(wood, 1.2);
  ctx.beginPath();
  ctx.moveTo(p.x - 10, p.y - 20);
  ctx.lineTo(p.x - 4, p.y - 24);
  ctx.lineTo(p.x + 16, p.y - 24);
  ctx.lineTo(p.x + 10, p.y - 20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(wood, 0.5);
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x - 10, p.y - 20, 20, 20);
  ctx.beginPath();
  ctx.moveTo(p.x - 10, p.y - 20);
  ctx.lineTo(p.x + 10, p.y);
  ctx.moveTo(p.x + 10, p.y - 20);
  ctx.lineTo(p.x - 10, p.y);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Paths between spaces (baked)
// ---------------------------------------------------------------------------

export function drawEdges(ctx: CanvasRenderingContext2D, board: BoardDef, mood: Mood) {
  const map = Object.fromEntries(board.nodes.map((n) => [n.id, n]));
  for (const n of board.nodes) {
    for (const t of n.next) {
      const m = map[t];
      if (!m) continue;
      drawEdge(ctx, n, m, n.via?.[t] ?? 'walk', mood);
    }
  }
}

export function drawEdge(ctx: CanvasRenderingContext2D, a: BoardNode, b: BoardNode, via: Traversal, mood: Mood) {
  const pa = P(a.x, a.y, a.z);
  const pb = P(b.x, b.y, b.z);
  const glow = mood.night ? '#7ef3ff' : '#fff1c9';
  if (via === 'ladder') {
    ctx.strokeStyle = mood.night ? '#c9c4ff' : '#2d2520';
    ctx.lineWidth = 2.5;
    for (const dx of [-7, 7]) {
      ctx.beginPath();
      ctx.moveTo(pa.x + dx, pa.y);
      ctx.lineTo(pb.x + dx, pb.y);
      ctx.stroke();
    }
    const steps = 10;
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = pa.x + (pb.x - pa.x) * t;
      const y = pa.y + (pb.y - pa.y) * t;
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x + 7, y);
      ctx.stroke();
    }
    return;
  }
  if (via === 'slide') {
    // The chute itself is scenery; mark the entry with chevrons.
    ctx.fillStyle = rgba('#ffcb3c', 0.9);
    for (let i = 0; i < 3; i += 1) {
      const t = 0.12 + i * 0.07;
      const x = pa.x + (pb.x - pa.x) * t;
      const y = pa.y + (pb.y - pa.y) * t;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 4);
      ctx.lineTo(x + 6, y + 2);
      ctx.lineTo(x - 6, y + 6);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  if (via === 'stairs' && Math.abs(a.z - b.z) > 0.5 && (a.id.startsWith('G') || b.id.startsWith('G'))) {
    // Rooftop stairway: a stepped run.
    const steps = 8;
    ctx.fillStyle = mood.night ? '#4a4580' : '#8a7166';
    ctx.strokeStyle = rgba(glow, 0.5);
    ctx.lineWidth = 1;
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps;
      const x = pa.x + (pb.x - pa.x) * t;
      const y = pa.y + (pb.y - pa.y) * t;
      ctx.fillRect(x - 12, y - 2, 24, 6);
      ctx.strokeRect(x - 12, y - 2, 24, 6);
    }
    return;
  }
  // Walk / bridge: a glowing dotted ribbon with direction chevrons.
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y + 2);
  ctx.lineTo(pb.x, pb.y + 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(glow, mood.night ? 0.55 : 0.75);
  ctx.lineWidth = 4;
  ctx.setLineDash([2, 9]);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const mx = (pa.x + pb.x) / 2;
  const my = (pa.y + pb.y) / 2;
  const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(ang);
  ctx.fillStyle = rgba(glow, 0.9);
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(-3, -4);
  ctx.lineTo(-1, 0);
  ctx.lineTo(-3, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.lineCap = 'butt';
}

// ---------------------------------------------------------------------------
// Live scenery (every frame)
// ---------------------------------------------------------------------------

export function drawLiveGround(ctx: CanvasRenderingContext2D, night: number, t: number, city: CityState) {
  // Lamp pools: soft at golden hour, strong at night.
  LAMPS.forEach(([x, y], li) => {
    if (city.lampsOff.has(li)) return;
    const ground = P(x + 10, y + 10, 0);
    const a = 0.12 + 0.38 * night;
    const g = ctx.createRadialGradient(ground.x, ground.y, 4, ground.x, ground.y, 90);
    g.addColorStop(0, `rgba(255,220,140,${a})`);
    g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y, 90, 46, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // River shimmer.
  const y0 = 560;
  const y1 = 690;
  ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.12 * night})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 40; i += 1) {
    const yy = y0 + 10 + hash(i) * (y1 - y0 - 20);
    const xx = ((hash(i * 3.3) * 2200 + t * (0.02 + hash(i) * 0.03)) % 2200) - 100;
    const p = P(xx, yy, -0.7);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 10 + hash(i * 9) * 18, p.y);
    ctx.stroke();
  }
}

/** Light that floats above everything: lamp halos, neon breath, motes. */
export function drawLiveAir(ctx: CanvasRenderingContext2D, night: number, t: number, pulse: number, city: CityState) {
  if (night > 0.1)
    LAMPS.forEach(([x, y], li) => {
      if (city.lampsOff.has(li)) return;
      const head = P(x, y, 1.6);
      const h = ctx.createRadialGradient(head.x + 12, head.y + 4, 1, head.x + 12, head.y + 4, 26);
      h.addColorStop(0, `rgba(255,240,190,${0.8 * night})`);
      h.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = h;
      ctx.fillRect(head.x - 20, head.y - 24, 64, 56);
    });
  // Neon breath on the signs (night only).
  if (night > 0.05) {
    for (const b of BUILDINGS) {
      if (!b.sign) continue;
      const p = P((b.x0 + b.x1) / 2, b.y1, (b.h / Z_PX) * 0.62);
      const flick = hash(Math.floor(t / 90) + b.seed) > 0.97 ? 0.3 : 1;
      const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 70);
      const col = signColor(b, city);
      g.addColorStop(0, rgba(col, (0.25 + 0.2 * pulse) * night * flick));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 70, p.y - 70, 140, 140);
    }
    // Drifting motes.
    for (let i = 0; i < 26; i += 1) {
      const x = (hash(i) * 1800 + Math.sin(t / 2000 + i) * 40) % 1800;
      const y = 200 + hash(i * 5) * 800 - ((t / 40 + i * 37) % 120);
      const p = P(x, y, 0.6);
      ctx.fillStyle = `rgba(126,243,255,${0.35 * night})`;
      ctx.fillRect(p.x, p.y, 2, 2);
    }
  }
}

// ---------------------------------------------------------------------------
// Spaces
// ---------------------------------------------------------------------------

export function drawSpace(ctx: CanvasRenderingContext2D, n: BoardNode, t: number, opts: { highlight?: boolean; trap?: boolean; night?: number; bounce?: number } = {}) {
  const c = SPACE_COLOR[n.kind];
  const p = P(n.x, n.y, n.z);
  const rx = 27;
  const ry = 15;
  const thick = 4;
  const b = opts.bounce ?? 0;
  const lift = (opts.highlight ? 3 + Math.sin(t / 120) * 2 : 0) + Math.max(0, Math.sin(b * Math.PI)) * 10;
  const y = p.y - lift;
  // Light spill onto the street around the pad.
  const spill = ctx.createRadialGradient(p.x, p.y + 2, 6, p.x, p.y + 2, 48);
  spill.addColorStop(0, rgba(c.top, 0.22 + 0.18 * (opts.night ?? 0)));
  spill.addColorStop(1, rgba(c.top, 0));
  ctx.fillStyle = spill;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, 48, 27, 0, 0, Math.PI * 2);
  ctx.fill();
  // Socket: the pad is set into the pavement, not floating on it.
  ctx.fillStyle = 'rgba(10,6,20,0.55)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 3, rx + 5, ry + 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 3, rx + 5, ry + 4, 0, 0.1, Math.PI - 0.1);
  ctx.stroke();
  // Side band (the tile's thickness).
  ctx.fillStyle = c.side;
  ctx.beginPath();
  ctx.ellipse(p.x, y + thick, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(p.x - rx, y);
  ctx.ellipse(p.x, y, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  // Side highlight stripe.
  ctx.strokeStyle = rgba('#ffffff', 0.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(p.x, y + thick * 0.55, rx - 1, ry - 1, 0, 0.15, Math.PI - 0.15);
  ctx.stroke();
  // Top with a radial bevel.
  const g = ctx.createRadialGradient(p.x - 8, y - 6, 2, p.x, y, rx);
  g.addColorStop(0, c.rim);
  g.addColorStop(0.35, c.top);
  g.addColorStop(1, c.side);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(p.x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Inner recessed face.
  ctx.fillStyle = rgba(c.top, 0.9);
  ctx.beginPath();
  ctx.ellipse(p.x, y + 1, rx - 6, ry - 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(c.side, 0.6);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Rim light.
  ctx.strokeStyle = rgba(c.rim, 0.9);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(p.x, y, rx - 0.5, ry - 0.5, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  // Glow at night.
  if ((opts.night ?? 0) > 0.05) {
    const gl = ctx.createRadialGradient(p.x, y, 4, p.x, y, 46);
    gl.addColorStop(0, rgba(c.top, 0.25 * (opts.night ?? 0)));
    gl.addColorStop(1, rgba(c.top, 0));
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.ellipse(p.x, y, 46, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(p.x, y + 1);
  ctx.scale(1, 0.62);
  drawGlyph(ctx, n.kind, c.glyph, t);
  ctx.restore();
  if (opts.trap) drawTrapMarker(ctx, p.x, y, t);
  if (opts.highlight) {
    ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(t / 110)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, y, rx + 6, ry + 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Original vector glyphs, one per space kind. Drawn in a unit roughly 22 px tall. */
export function drawGlyph(ctx: CanvasRenderingContext2D, kind: SpaceKind, color: string, t: number) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (kind) {
    case 'cred': {
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3, -5);
      ctx.lineTo(-3, 4);
      ctx.lineTo(4, 4);
      ctx.stroke();
      break;
    }
    case 'glitch': {
      ctx.beginPath();
      ctx.moveTo(-3, -11);
      ctx.lineTo(3, -2);
      ctx.lineTo(-2, 0);
      ctx.lineTo(4, 10);
      ctx.stroke();
      ctx.fillRect(-10, -6, 3, 3);
      ctx.fillRect(7, -9, 3, 3);
      ctx.fillRect(-8, 6, 3, 3);
      break;
    }
    case 'event': {
      // Lok the Owl's eyes under a brow.
      ctx.beginPath();
      ctx.moveTo(-11, -6);
      ctx.quadraticCurveTo(0, -1, 11, -6);
      ctx.stroke();
      for (const dx of [-5, 5]) {
        ctx.beginPath();
        ctx.arc(dx, 2, 4.5, 0, Math.PI * 2);
        ctx.stroke();
        const look = Math.sin(t / 700) * 1.5;
        ctx.beginPath();
        ctx.arc(dx + look, 2, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'supply': {
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-9, -8, 18, 16);
      ctx.beginPath();
      ctx.moveTo(-9, -8);
      ctx.lineTo(9, 8);
      ctx.moveTo(9, -8);
      ctx.lineTo(-9, 8);
      ctx.stroke();
      break;
    }
    case 'hack': {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-11, -8, 22, 15, 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-6, -3);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-6, 3);
      ctx.stroke();
      if (Math.floor(t / 400) % 2) ctx.fillRect(0, 2, 6, 2);
      break;
    }
    case 'archon': {
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(11, 8);
      ctx.lineTo(-11, 8);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 2, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'start': {
      ctx.beginPath();
      ctx.moveTo(-6, 10);
      ctx.lineTo(-6, -10);
      ctx.lineTo(8, -5);
      ctx.lineTo(-6, 0);
      ctx.stroke();
      break;
    }
  }
}

function drawTrapMarker(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const s = 1 + Math.sin(t / 140) * 0.08;
  ctx.save();
  ctx.translate(x, y - 22);
  ctx.scale(s, s);
  ctx.fillStyle = '#1a0a14';
  ctx.strokeStyle = '#ff3fa4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? 6 : 11;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff3fa4';
  ctx.fillRect(-1.5, -1.5, 3, 3);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Lok the Owl (crown vendor), crown, coin, dice block
// ---------------------------------------------------------------------------

export function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number, flat = false) {
  const spin = flat ? 1 : Math.cos(t / 500);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.max(0.15, Math.abs(spin)), 1);
  const w = size;
  const h = size * 0.72;
  const g = ctx.createLinearGradient(0, -h, 0, h * 0.4);
  g.addColorStop(0, '#fff6c4');
  g.addColorStop(0.45, '#ffcf3c');
  g.addColorStop(1, '#b06a07');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#4a2a05';
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.beginPath();
  ctx.moveTo(-w / 2, h * 0.35);
  ctx.lineTo(-w / 2, -h * 0.35);
  ctx.lineTo(-w / 4, -h * 0.05);
  ctx.lineTo(0, -h * 0.6);
  ctx.lineTo(w / 4, -h * 0.05);
  ctx.lineTo(w / 2, -h * 0.35);
  ctx.lineTo(w / 2, h * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Band and gems.
  ctx.fillStyle = '#d98f12';
  ctx.fillRect(-w / 2, h * 0.12, w, h * 0.23);
  ctx.strokeRect(-w / 2, h * 0.12, w, h * 0.23);
  const gems: [number, string][] = [
    [-w * 0.3, '#ff3fa4'],
    [0, '#38d5ff'],
    [w * 0.3, '#5fe36f'],
  ];
  for (const [gx, col] of gems) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(gx, h * 0.235, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(gx - size * 0.03, h * 0.235 - size * 0.04, size * 0.025, size * 0.025);
  }
  for (const px of [-w / 2, 0, w / 2]) {
    ctx.fillStyle = '#fff6c4';
    ctx.beginPath();
    ctx.arc(px, px === 0 ? -h * 0.6 : -h * 0.35, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t = 0, spinning = false) {
  const sx = spinning ? Math.max(0.12, Math.abs(Math.cos(t / 160))) : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  ctx.fillStyle = '#a3620a';
  ctx.beginPath();
  ctx.arc(0, r * 0.12, r, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.4, -r * 0.4, 1, 0, 0, r);
  g.addColorStop(0, '#fff6c4');
  g.addColorStop(0.5, '#ffcf3c');
  g.addColorStop(1, '#d98f12');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a5205';
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.2, r * 0.2);
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.38);
  ctx.lineTo(-r * 0.2, r * 0.3);
  ctx.lineTo(r * 0.28, r * 0.3);
  ctx.stroke();
  ctx.restore();
}

export function drawOwl(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, t: number) {
  const bob = Math.sin(t / 380) * 2;
  const blink = (t % 3600) < 120;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);
  // Pedestal (stone with gold trim).
  const ped = ctx.createLinearGradient(-26, 0, 26, 0);
  ped.addColorStop(0, '#5a4a6e');
  ped.addColorStop(0.5, '#8a7aa6');
  ped.addColorStop(1, '#3e3150');
  ctx.fillStyle = ped;
  ctx.beginPath();
  ctx.ellipse(0, -bob, 26, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-22, -14 - bob, 44, 14);
  ctx.fillStyle = '#ffcf3c';
  ctx.fillRect(-22, -16 - bob, 44, 3);
  ctx.beginPath();
  ctx.ellipse(0, -16 - bob, 22, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#6f5f8c';
  ctx.fill();
  ctx.translate(0, -18);
  // Body with layered feathers.
  const body = ctx.createLinearGradient(0, -60, 0, 0);
  body.addColorStop(0, '#8a5b3c');
  body.addColorStop(1, '#5a3622');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -28, 20, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b170c';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Chest scallops.
  ctx.fillStyle = '#f3e2c3';
  ctx.beginPath();
  ctx.ellipse(0, -20, 12, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,50,0.55)';
  ctx.lineWidth = 1.2;
  for (let row = 0; row < 4; row += 1)
    for (let i = -2; i <= 2; i += 1) {
      const cx = i * 4.5 + (row % 2) * 2.2;
      const cy = -30 + row * 6;
      if (Math.abs(cx) > 10 - row) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.4, 0, Math.PI);
      ctx.stroke();
    }
  // Wings.
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#6e4329';
    ctx.beginPath();
    ctx.ellipse(side * 17, -24, 7, 18, side * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b170c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,190,0.4)';
    for (let k = 0; k < 3; k += 1) {
      ctx.beginPath();
      ctx.moveTo(side * 14, -32 + k * 7);
      ctx.lineTo(side * 20, -28 + k * 7);
      ctx.stroke();
    }
  }
  // Head with ear tufts and facial disc.
  ctx.fillStyle = '#8a5b3c';
  ctx.beginPath();
  ctx.ellipse(0, -60, 19, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b170c';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#6e4329';
    ctx.beginPath();
    ctx.moveTo(side * 9, -70);
    ctx.lineTo(side * 18, -84);
    ctx.lineTo(side * 16, -68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#f3e2c3';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 7.5, -60, 8.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eyes.
  for (const side of [-1, 1]) {
    if (blink) {
      ctx.strokeStyle = '#2b170c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(side * 7.5 - 5, -60);
      ctx.lineTo(side * 7.5 + 5, -60);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffcf3c';
    ctx.beginPath();
    ctx.arc(side * 7.5, -60, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#120a06';
    ctx.beginPath();
    ctx.arc(side * 7.5 + Math.sin(t / 900) * 1.2, -60, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(side * 7.5 - 0.5, -62.5, 1.8, 1.8);
  }
  // Beak.
  ctx.fillStyle = '#ffb03c';
  ctx.beginPath();
  ctx.moveTo(-3, -56);
  ctx.lineTo(3, -56);
  ctx.lineTo(0, -50);
  ctx.closePath();
  ctx.fill();
  // Bow tie (Lok purple).
  ctx.fillStyle = '#b56cff';
  ctx.beginPath();
  ctx.moveTo(0, -45);
  ctx.lineTo(-8, -49);
  ctx.lineTo(-8, -41);
  ctx.closePath();
  ctx.moveTo(0, -45);
  ctx.lineTo(8, -49);
  ctx.lineTo(8, -41);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a3fd0';
  ctx.fillRect(-2, -47, 4, 4);
  // Talons.
  ctx.fillStyle = '#ffb03c';
  for (const side of [-1, 1]) for (const k of [-3, 0, 3]) ctx.fillRect(side * 7 + k - 1, -2, 2, 4);
  ctx.restore();
  // Floating crown above the head.
  drawCrown(ctx, x, y - 112 * scale + Math.sin(t / 300) * 4, 24 * scale, t);
}

export function drawDiceBlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, label: string, color: string, t: number, sq: { x: number; y: number } = { x: 1, y: 1 }) {
  const s = size;
  const d = s * 0.32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sq.x, sq.y);
  ctx.translate(-s / 2, -s / 2);
  // Shadow below.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(s / 2 + d / 2, s + d + 18, s * 0.6, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Top face.
  ctx.fillStyle = shade(color, 1.25);
  quad(ctx, [
    { x: 0, y: 0 },
    { x: d, y: -d },
    { x: s + d, y: -d },
    { x: s, y: 0 },
  ]);
  ctx.fill();
  // Right face.
  ctx.fillStyle = shade(color, 0.7);
  quad(ctx, [
    { x: s, y: 0 },
    { x: s + d, y: -d },
    { x: s + d, y: s - d },
    { x: s, y: s },
  ]);
  ctx.fill();
  // Front face.
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, shade(color, 1.1));
  g.addColorStop(1, shade(color, 0.85));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0, 0, s, s, s * 0.12);
  ctx.fill();
  ctx.strokeStyle = '#1a1020';
  ctx.lineWidth = 3;
  ctx.stroke();
  quad(ctx, [
    { x: 0, y: 0 },
    { x: d, y: -d },
    { x: s + d, y: -d },
    { x: s + d, y: s - d },
    { x: s, y: s },
    { x: s, y: 0 },
  ]);
  ctx.stroke();
  // Inner panel and shine.
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.roundRect(s * 0.14, s * 0.14, s * 0.72, s * 0.72, s * 0.1);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.roundRect(s * 0.08, s * 0.06, s * 0.5, s * 0.07, s * 0.04);
  ctx.fill();
  // Corner studs.
  ctx.fillStyle = shade(color, 0.6);
  for (const [cx, cy] of [
    [0.07, 0.07],
    [0.93, 0.07],
    [0.07, 0.93],
    [0.93, 0.93],
  ]) {
    ctx.beginPath();
    ctx.arc(s * cx, s * cy, s * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1a1020';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const big = label.length <= 2;
  ctx.font = `900 ${big ? s * 0.48 : s * 0.17}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(label, s / 2, s / 2 + (big ? s * 0.03 : 0));
  ctx.restore();
  void t;
}


/** Spawn colours: one per kind so a glance tells you what is worth walking toward. */
export const SPAWN_COLOR: Record<'cache' | 'beacon' | 'rest' | 'relic', string> = {
  cache: '#ffcf3c',
  beacon: '#38d5ff',
  rest: '#5fe36f',
  relic: '#c77dff',
};

/**
 * Procedural pickup art for things the board puts down: a gold crate (cache), a cyan pulse pillar (beacon),
 * a green arch (safe house) and a spinning violet shard (relic). `age` 0..1 is how close it is to fading:
 * fading pickups blink slowly so nobody is surprised when one vanishes. Never animates when `calm` is set.
 */
export function drawSpawn(ctx: CanvasRenderingContext2D, kind: 'cache' | 'beacon' | 'rest' | 'relic', x: number, y: number, t: number, age: number, calm: boolean) {
  const col = SPAWN_COLOR[kind];
  const bob = calm ? 0 : Math.sin(t / 380 + x) * 3;
  if (age > 0.75 && !calm && Math.floor(t / 280) % 2 === 0) ctx.globalAlpha = 0.45;
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 40);
  glow.addColorStop(0, col + '66');
  glow.addColorStop(1, col + '00');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 40, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y - 24 + bob);
  ctx.scale(1.7, 1.7);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2b1a12';
  ctx.fillStyle = col;
  if (kind === 'cache') {
    ctx.beginPath();
    ctx.roundRect(-11, -9, 22, 18, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff6c4';
    ctx.fillRect(-11, -2, 22, 4);
  } else if (kind === 'beacon') {
    ctx.beginPath();
    ctx.moveTo(-7, 10);
    ctx.lineTo(-3, -16);
    ctx.lineTo(3, -16);
    ctx.lineTo(7, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const r = 8 + (calm ? 4 : ((t / 90) % 14));
    ctx.strokeStyle = col;
    ctx.globalAlpha *= Math.max(0, 1 - r / 24);
    ctx.beginPath();
    ctx.arc(0, -18, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'rest') {
    ctx.beginPath();
    ctx.moveTo(-12, 10);
    ctx.lineTo(-12, -2);
    ctx.quadraticCurveTo(0, -18, 12, -2);
    ctx.lineTo(12, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2b1a12';
    ctx.fillRect(-4, 0, 8, 10);
  } else {
    // A faceted gem: a hexagon that breathes its width (a cheap turn), with a bright facet and a glint.
    const w = calm ? 1 : 0.78 + 0.22 * Math.abs(Math.cos(t / 700));
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(11 * w, -6);
    ctx.lineTo(11 * w, 6);
    ctx.lineTo(0, 14);
    ctx.lineTo(-11 * w, 6);
    ctx.lineTo(-11 * w, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e9c9ff';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(11 * w, -6);
    ctx.lineTo(0, 0);
    ctx.lineTo(-11 * w, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3 * w, -9, 2.5, 5);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
