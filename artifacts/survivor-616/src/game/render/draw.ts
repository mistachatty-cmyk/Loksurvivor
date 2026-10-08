/**
 * Canvas renderer for a run.
 *
 * The world is drawn in world units; the camera transform handles scroll and
 * zoom. Everything is flat-shaded rectangles and simple vector shapes so it
 * reads as pixel art without needing image atlases.
 */

import { drawStyledPickup } from './pickupArtStyles';
import { LANDED_HEAT_RADIUS, fogAt, type FluidKind, type Pickup, type Popup, type World } from '@/game/engine/world';
import { DAMAGE_TIERS, GLOW_FROM_TIER } from '@/game/data/damageNumbers';
import { DUNGEON_ERAS } from '@/game/data/dungeonEras';
import { ENDLESS_BANDS_BY_ID } from '@/game/data/endlessBands';
import { STATUS_EFFECTS_BY_ID } from '@/game/data/statusEffects';
import { AMBIENT_KINDS_BY_ID } from '@/game/data/ambient';
import { LOKPET_VARIANTS_BY_ID, lokPetSpritePalette } from '@/game/data/lokPets';
import { evolvedRig } from '@/game/engine/petEvolution';
import { ALLIES_BY_ID } from '@/game/data/progression';
import type { AreaSky, EnemyDef, ObstacleDef, SpritePalette, StormCloudMode } from '@/game/types';
import { buildingSupplyPoint, getBuildingPrefab } from '@/game/engine/chunks';
import { blendSpritePalettes } from '@/game/data/characterSkins';

import { drawRig, drawShadow } from './sprite';
import { reactionMultiplier } from '@/game/data/reactivity';
import { clamp, dist2 } from '@/game/engine/math';
import { drawForgeFiveProjectile } from './forgeFiveVfx';
import { drawMapPackProp } from './mapPackArt';

/** World units of sprite height per rig pixel. */
export const SPRITE_SCALE = 2.05;
/** LokPets read as small companions, a notch below full enemy scale. */
const LOKPET_SPRITE_SCALE = SPRITE_SCALE * 0.82;

/**
 * Render-time size multiplier by `EnemyDef.sizeClass` -- a mini reads as
 * visibly small fry, a giant fills the screen the way a boss always did.
 * See run-presentation.md.
 */
const SIZE_CLASS_SCALE: Record<NonNullable<import('@/game/types').EnemyDef['sizeClass']>, number> = {
  mini: 0.7,
  standard: 1,
  elite: 1.2,
  giant: 1.55,
  boss: 1.8,
};
function sizeClassScale(def: import('@/game/types').EnemyDef): number {
  if (def.sizeClass) return SIZE_CLASS_SCALE[def.sizeClass];
  // Pre-existing content never set sizeClass; keep the old Boss-only bump.
  return def.family === 'Boss' ? 1.55 : 1;
}

export interface Viewport {
  width: number;
  height: number;
  dpr: number;
  /**
   * A renderer-only pressure signal from the run loop. It never removes an
   * entity from the simulation or changes damage: it only limits cosmetic
   * work that is off-camera or too dense to read.
   */
  visualBudget?: 'full' | 'reduced' | 'minimal';
  /**
   * How many world units wide the view should show. Normally derived from
   * `width` so every screen sees roughly the same slice of the world; the
   * map editor overrides it to fit a whole authored map in one frame.
   */
  targetViewOverride?: number;
  /**
   * Draw only the actors and effects onto a transparent canvas, with no floor,
   * sky, lighting, vignette or obstacle art. The page overlay composites this
   * over a live web page, which supplies the whole backdrop itself.
   */
  overlay?: boolean;
  /** With `overlay`, keep whatever the caller already drew on the canvas (the reveal layer) instead of clearing it first. */
  preserve?: boolean;
}

type ViewBounds = { left: number; top: number; right: number; bottom: number };

function isNearView(x: number, y: number, bounds: ViewBounds, padding = 0): boolean {
  return x >= bounds.left - padding && x <= bounds.right + padding
    && y >= bounds.top - padding && y <= bounds.bottom + padding;
}

function hashCell(x: number, y: number): number {
  let h = x * 73856093 + y * 19349663;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ */
/* Ground                                                              */
/* ------------------------------------------------------------------ */

/**
 * Rotates a hex color's hue by `degrees`, keeping saturation/lightness --
 * used only by `discoMode` (see `RunModifiers.discoMode`) to cycle an
 * area's static ground colors into a shifting disco palette. Pure function
 * of its inputs, so callers drive it off `w.now` (run-elapsed ms) the same
 * way `World.cycle.phase` is derived, per CLAUDE.md.
 */
function rotateHueHex(hex: string, degrees: number): string {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const r = (parseInt(full.slice(0, 2), 16) || 0) / 255;
  const g = (parseInt(full.slice(2, 4), 16) || 0) / 255;
  const b = (parseInt(full.slice(4, 6), 16) || 0) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  h = (h + degrees) % 360;
  if (h < 0) h += 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r2, g2, b2] = [0, 0, 0];
  if (h < 60) [r2, g2, b2] = [c, x, 0];
  else if (h < 120) [r2, g2, b2] = [x, c, 0];
  else if (h < 180) [r2, g2, b2] = [0, c, x];
  else if (h < 240) [r2, g2, b2] = [0, x, c];
  else if (h < 300) [r2, g2, b2] = [x, 0, c];
  else [r2, g2, b2] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

/**
 * Rotates every color in a `SpritePalette` by `degrees` via `rotateHueHex`,
 * except `ink` (kept as-is so the silhouette outline stays readable) --
 * used by `traits.hueShiftMs` (see `withHueShift` below) the same way
 * `rotateHueHex` alone drives `RunModifiers.discoMode`'s ground cycling.
 */
function hueShiftPalette(base: SpritePalette, degrees: number): SpritePalette {
  return {
    ink: base.ink,
    body: rotateHueHex(base.body, degrees),
    bodyDark: rotateHueHex(base.bodyDark, degrees),
    accent: rotateHueHex(base.accent, degrees),
    accentBright: rotateHueHex(base.accentBright, degrees),
    skin: rotateHueHex(base.skin, degrees),
    glow: rotateHueHex(base.glow, degrees),
  };
}

function drawGround(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number) {
  const areaGround = w.area.ground;
  const ground = w.modifiers.discoMode
    ? {
        base: rotateHueHex(areaGround.base, (w.now / 20) % 360),
        tile: rotateHueHex(areaGround.tile, (w.now / 20 + 90) % 360),
        seam: areaGround.seam,
        glow: rotateHueHex(areaGround.glow, (w.now / 20 + 180) % 360),
      }
    : areaGround;
  ctx.fillStyle = ground.base;
  ctx.fillRect(left, top, right - left, bottom - top);

  const tile = 64;
  const startX = Math.floor(left / tile) * tile;
  const startY = Math.floor(top / tile) * tile;

  // Slab shading: alternating tiles plus a few glowing puddles.
  for (let x = startX; x < right; x += tile) {
    for (let y = startY; y < bottom; y += tile) {
      const cx = x / tile;
      const cy = y / tile;
      const noise = hashCell(cx, cy);
      if (noise > 0.62) {
        ctx.fillStyle = ground.tile;
        ctx.globalAlpha = 0.5 + noise * 0.3;
        ctx.fillRect(x, y, tile, tile);
        ctx.globalAlpha = 1;
      }
      if (noise > 0.93) {
        ctx.fillStyle = ground.glow;
        ctx.globalAlpha = 0.3;
        const px = x + 10 + noise * 18;
        const py = y + 14 + noise * 12;
        ctx.beginPath();
        ctx.ellipse(px, py, 22, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  ctx.strokeStyle = ground.seam;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  for (let x = startX; x < right; x += tile) {
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
  }
  for (let y = startY; y < bottom; y += tile) {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawAuthoredGroundTiles(ctx: CanvasRenderingContext2D, w: World) {
  for (const patch of w.area.authoredGroundTiles ?? []) {
    const left = patch.x - patch.w / 2;
    const top = patch.y - patch.h / 2;
    ctx.fillStyle = patch.base;
    ctx.fillRect(left, top, patch.w, patch.h);
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = patch.tile;
    ctx.fillRect(left + 4, top + 4, Math.max(0, patch.w - 8), Math.max(0, patch.h - 8));
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = patch.seam;
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, patch.w, patch.h);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = patch.glow;
    ctx.beginPath();
    ctx.ellipse(patch.x, patch.y, Math.max(4, patch.w * 0.28), Math.max(3, patch.h * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** Small, deterministic bits of city dressing that sit between the combat props. */
function drawStreetDressing(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number) {
  const endless = Boolean(w.area.endless);
  const dungeon = Boolean(w.endless?.inDungeon);
  const accent = groundAccent(w);
  const step = 192;
  const startX = Math.floor(left / step) * step;
  const startY = Math.floor(top / step) * step;

  ctx.save();
  ctx.lineWidth = 2;
  for (let x = startX; x < right; x += step) {
    for (let y = startY; y < bottom; y += step) {
      const n = hashCell(x / step, y / step);
      // Broken curb segments and painted lane fragments stop the grid reading
      // as a collection of square arenas while remaining purely cosmetic.
      if (n > 0.42) {
        ctx.globalAlpha = dungeon ? 0.12 : 0.2;
        ctx.strokeStyle = dungeon ? w.area.ground.glow : w.area.ground.seam;
        ctx.setLineDash(n > 0.72 ? [18, 12] : [5, 15]);
        ctx.beginPath();
        ctx.moveTo(x + 18, y + 34 + n * 18);
        ctx.lineTo(x + 142, y + 34 + n * 18);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (!dungeon && n > 0.78) {
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = accent;
        ctx.beginPath();
        ctx.moveTo(x + 20, y + 150);
        ctx.lineTo(x + 76, y + 132);
        ctx.lineTo(x + 134, y + 150);
        ctx.stroke();
      }
      if (endless && n < 0.16) {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#101018';
        ctx.beginPath();
        ctx.ellipse(x + 96, y + 96, 38 + n * 30, 11 + n * 8, n * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Sky ambiance -- drifting clouds, their ground shadows, birds, and    */
/* firefly-lit stretches of road. Purely decorative: derived each frame */
/* from world position + w.now, never touching engine/simulation state. */
/* ------------------------------------------------------------------ */

/**
 * What the sky is doing overhead. Endless dungeons and building interiors are
 * roofed no matter what the area authored, and an area with no `sky` is clear.
 */
function effectiveSky(w: World): AreaSky {
  if (w.endless?.inDungeon || w.endless?.inBuilding) return 'roofed';
  return w.area.sky ?? 'clear';
}

/**
 * Every weather-driven knob in one table, so a new condition is a record here
 * rather than a scatter of `if (sky === ...)` through the draw calls.
 */
interface SkyProfile {
  /** Upper bound on the cell hash -- higher means more clouds. */
  cloudChance: number;
  cloudAlpha: number;
  shadowAlpha: number;
  birds: boolean;
  /** Light bugs shelter in the wet. */
  fireflies: boolean;
  litter: boolean;
  /** 0..1 rain strength. */
  rain: number;
  /** 0..1 fog strength. */
  fog: number;
  /** Milliseconds between lightning windows; 0 disables it. */
  lightningPeriodMs: number;
}

const SKY_PROFILES: Record<AreaSky, SkyProfile> = {
  clear: {
    cloudChance: 0.42, cloudAlpha: 1, shadowAlpha: 1,
    birds: true, fireflies: true, litter: true,
    rain: 0, fog: 0, lightningPeriodMs: 34000,
  },
  overcast: {
    cloudChance: 0.6, cloudAlpha: 0.9, shadowAlpha: 1.5,
    birds: true, fireflies: true, litter: true,
    rain: 0, fog: 0.1, lightningPeriodMs: 24000,
  },
  rain: {
    // Rain already carries the mood; heavy fog on top of streaks and shade
    // just turns the arena to mush, so this stays light.
    cloudChance: 0.6, cloudAlpha: 0.7, shadowAlpha: 1.6,
    birds: false, fireflies: false, litter: true,
    rain: 1, fog: 0.1, lightningPeriodMs: 9000,
  },
  fog: {
    cloudChance: 0.4, cloudAlpha: 0.4, shadowAlpha: 0.5,
    birds: false, fireflies: true, litter: true,
    rain: 0, fog: 1, lightningPeriodMs: 0,
  },
  roofed: {
    cloudChance: 0, cloudAlpha: 0, shadowAlpha: 0,
    birds: false, fireflies: false, litter: false,
    rain: 0, fog: 0, lightningPeriodMs: 0,
  },
  'cyber-storm': {
    cloudChance: 0.85, cloudAlpha: 0.95, shadowAlpha: 1.9,
    birds: false, fireflies: true, litter: true,
    rain: 0.95, fog: 0.25, lightningPeriodMs: 4800,
  },
  'toxic-haze': {
    cloudChance: 0.55, cloudAlpha: 0.8, shadowAlpha: 0.85,
    birds: false, fireflies: true, litter: true,
    rain: 0, fog: 0.85, lightningPeriodMs: 0,
  },
  'solar-flare': {
    cloudChance: 0.35, cloudAlpha: 0.6, shadowAlpha: 1.35,
    birds: true, fireflies: false, litter: true,
    rain: 0, fog: 0.15, lightningPeriodMs: 0,
  },
};

/**
 * Bounded (non-endless) arenas are walled off well inside the padded camera
 * view, and the void beyond those walls is painted over later by
 * drawArenaEdges -- so ground-level ambiance has to stay inside the actual
 * arena bounds or it silently disappears under that overpaint.
 */
function clipToArena(w: World, left: number, top: number, right: number, bottom: number) {
  if (w.area.endless) return { left, top, right, bottom };
  const halfW = w.bounds.w / 2;
  const halfH = w.bounds.h / 2;
  return {
    left: Math.max(left, -halfW),
    top: Math.max(top, -halfH),
    right: Math.min(right, halfW),
    bottom: Math.min(bottom, halfH),
  };
}

interface CloudPuff { x: number; y: number; rx: number; ry: number; density: number; }

const CLOUD_CELL = 300;
/**
 * How far a cloud is displaced from its own shadow per unit of distance from
 * the camera. This is what sells the clouds as being *above* the street
 * rather than painted onto it: pan the camera and they slide against the
 * ground the way a real overhead object would.
 */
const CLOUD_PARALLAX = 0.075;

/**
 * Lobes tracing one cloud, in units of its radii. Filled as a single path so
 * the overlaps union instead of showing seams -- gives a lumpy silhouette
 * rather than the obvious stack of two ellipses this used to be.
 */
const CLOUD_LOBES = [
  { dx: -0.58, dy: 0.12, rx: 0.52, ry: 0.58 },
  { dx: -0.18, dy: -0.2, rx: 0.74, ry: 0.9 },
  { dx: 0.28, dy: -0.04, rx: 0.64, ry: 0.74 },
  { dx: 0.68, dy: 0.16, rx: 0.42, ry: 0.48 },
  { dx: 0.04, dy: 0.24, rx: 0.62, ry: 0.42 },
];

function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const raw = hex.replace('#', '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    return [
      parseInt(full.slice(0, 2), 16) || 0,
      parseInt(full.slice(2, 4), 16) || 0,
      parseInt(full.slice(4, 6), 16) || 0,
    ];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const to = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[to(r1!, r2!), to(g1!, g2!), to(b1!, b2!)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * One soft radial blob per colour, rasterised once and reused.
 *
 * Building a fresh `createRadialGradient` for every lobe of every cloud each
 * frame measured ~22ms/frame in rain -- well under 60fps on a desktop, so
 * hopeless on a phone. Blitting a cached sprite instead is a plain drawImage,
 * and the non-uniform scale gives the ellipse shape for free.
 */
const SOFT_BLOB_SIZE = 128;
const softBlobCache = new Map<string, HTMLCanvasElement>();

function softBlob(color: string): HTMLCanvasElement | null {
  const cached = softBlobCache.get(color);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = SOFT_BLOB_SIZE;
  canvas.height = SOFT_BLOB_SIZE;
  const blobCtx = canvas.getContext('2d');
  if (!blobCtx) return null;
  const r = SOFT_BLOB_SIZE / 2;
  const gradient = blobCtx.createRadialGradient(r, r, r * 0.2, r, r, r);
  gradient.addColorStop(0, withAlpha(color, 1));
  gradient.addColorStop(1, withAlpha(color, 0));
  blobCtx.fillStyle = gradient;
  blobCtx.fillRect(0, 0, SOFT_BLOB_SIZE, SOFT_BLOB_SIZE);
  // Only ever a handful of distinct colours (one per area palette); the cap is
  // just so a pathological caller can't grow this without bound.
  if (softBlobCache.size < 64) softBlobCache.set(color, canvas);
  return canvas;
}

/**
 * A cloud painted as a cluster of soft-edged blobs rather than filled shapes.
 *
 * This is the whole trick for reading these as sky: a hard edge reads as a
 * solid object lying on the street, while a soft falloff reads as atmosphere
 * passing overhead. The lobes overlap and accumulate, so the middle of a cloud
 * comes out denser than its fringes the way a real one does -- which means the
 * per-lobe alpha here is much lower than the density you actually see.
 */
function paintSoftCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number,
  scale = 1,
  lobes = CLOUD_LOBES,
) {
  if (alpha <= 0.002 || !Number.isFinite(alpha)) return;
  if (rx <= 0 || ry <= 0 || scale <= 0 || !Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(scale) || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const blob = softBlob(color);
  if (!blob) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const lobe of lobes) {
    const lrx = Math.max(1, lobe.rx * rx * scale);
    const lry = Math.max(1, lobe.ry * ry * scale);
    if (!Number.isFinite(lrx) || !Number.isFinite(lry) || lrx <= 0 || lry <= 0) continue;
    ctx.drawImage(
      blob,
      x + lobe.dx * rx * scale - lrx,
      y + lobe.dy * ry * scale - lry,
      lrx * 2,
      lry * 2,
    );
  }
  ctx.restore();
}

/** One drifting cloud silhouette per sparse grid cell in view, wrapped seamlessly along its lane. */
function computeCloudPuffs(
  w: World,
  profile: SkyProfile,
  left: number,
  top: number,
  right: number,
  bottom: number,
): CloudPuff[] {
  if (profile.cloudChance <= 0) return [];
  const clip = clipToArena(w, left, top, right, bottom);
  const puffs: CloudPuff[] = [];
  const startX = Math.floor(clip.left / CLOUD_CELL) * CLOUD_CELL - CLOUD_CELL;
  const startY = Math.floor(clip.top / CLOUD_CELL) * CLOUD_CELL - CLOUD_CELL;
  for (let x = startX; x < clip.right + CLOUD_CELL; x += CLOUD_CELL) {
    for (let y = startY; y < clip.bottom + CLOUD_CELL; y += CLOUD_CELL) {
      const gx = x / CLOUD_CELL;
      const gy = y / CLOUD_CELL;
      const n = hashCell(gx, gy);
      if (n > profile.cloudChance) continue;
      const laneSpeed = 0.006 + hashCell(gx + 31, gy) * 0.008;
      const phase = hashCell(gx + 71, gy - 17) * CLOUD_CELL;
      const driftX = (w.now * laneSpeed + phase) % CLOUD_CELL;
      const cx = x + driftX;
      const cy = y + CLOUD_CELL * 0.5 + Math.sin(w.now / 6000 + gy * 3.1) * 30;
      // Normalise the hash so cloud size stays consistent as cloudChance
      // changes with the weather -- otherwise overcast skies get only big ones.
      const size = hashCell(gx + 13, gy + 13);
      puffs.push({ x: cx, y: cy, rx: 62 + size * 92, ry: 27 + size * 35, density: size });
    }
  }
  return puffs;
}

/**
 * Cool indigo shade sliding across the street. This is the primary read of the
 * whole effect -- in a top-down view a passing cloud is mostly its shadow --
 * so it is drawn stronger than the cloud body above it.
 */
function drawCloudShadows(ctx: CanvasRenderingContext2D, puffs: CloudPuff[], profile: SkyProfile) {
  if (puffs.length === 0 || profile.shadowAlpha <= 0) return;
  ctx.save();
  for (const p of puffs) {
    const alpha = Math.min(0.26, (0.12 + p.density * 0.09) * profile.shadowAlpha);
    paintSoftCloud(ctx, p.x, p.y, p.rx, p.ry, '#141b3a', alpha);
  }
  ctx.restore();
}

/** Only the crown of a cloud catches light; keep the lit pass to the top lobes. */
const CLOUD_CROWN_LOBES = CLOUD_LOBES.slice(1, 4);

/**
 * The clouds themselves.
 *
 * 616 runs at night, and a night city lights its own cloud deck from below --
 * so the body is tinted toward the district's accent and reads as a faint warm
 * glow rather than a grey mass. That is also what makes it legible at all:
 * pushing the ground shadow harder instead just loses it against pavement
 * that is already nearly black.
 */
function drawClouds(ctx: CanvasRenderingContext2D, w: World, puffs: CloudPuff[], profile: SkyProfile) {
  if (puffs.length === 0 || profile.cloudAlpha <= 0) return;
  const body = mixHex('#c3cfe9', w.area.ground.glow, 0.35);
  ctx.save();
  for (const p of puffs) {
    // Offset from the shadow grows with distance from the camera, so cloud and
    // shade separate the further off-centre you look -- that separation moving
    // as you walk is what sells them as being up in the air.
    const x = p.x + (p.x - w.camera.x) * CLOUD_PARALLAX - 24;
    const y = p.y + (p.y - w.camera.y) * CLOUD_PARALLAX - 46;
    paintSoftCloud(ctx, x, y, p.rx, p.ry, body, (0.13 + p.density * 0.09) * profile.cloudAlpha);
    paintSoftCloud(
      ctx,
      x - p.rx * 0.08,
      y - p.ry * 0.28,
      p.rx,
      p.ry,
      '#fff8e8',
      (0.07 + p.density * 0.05) * profile.cloudAlpha,
      0.75,
      CLOUD_CROWN_LOBES,
    );
  }
  ctx.restore();
}

const BIRD_CELL = 420;

/** Loose flocks of small birds wheeling across the sky in slow, wrapped passes. */
function drawBirds(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number) {
  const startX = Math.floor(left / BIRD_CELL) * BIRD_CELL - BIRD_CELL;
  const startY = Math.floor(top / BIRD_CELL) * BIRD_CELL - BIRD_CELL;
  ctx.save();
  ctx.strokeStyle = '#1c1c22';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  for (let x = startX; x < right + BIRD_CELL; x += BIRD_CELL) {
    for (let y = startY; y < bottom + BIRD_CELL; y += BIRD_CELL) {
      const gx = x / BIRD_CELL;
      const gy = y / BIRD_CELL;
      const n = hashCell(gx + 500, gy + 500);
      if (n > 0.16) continue;
      const angle = hashCell(gx, gy + 200) * Math.PI * 2;
      const speed = 0.03 + hashCell(gx + 9, gy) * 0.018;
      const phase = hashCell(gx - 9, gy + 9) * BIRD_CELL;
      const drift = ((w.now * speed + phase) % BIRD_CELL) - BIRD_CELL / 2;
      const leaderX = x + BIRD_CELL / 2 + Math.cos(angle) * drift;
      const leaderY = y + BIRD_CELL / 2 + Math.sin(angle) * drift;
      const count = 3 + Math.floor(hashCell(gx + 3, gy - 3) * 3);
      for (let i = 0; i < count; i += 1) {
        const back = i * 16;
        const lateral = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 10;
        const bx = leaderX - Math.cos(angle) * back - Math.sin(angle) * lateral;
        const by = leaderY - Math.sin(angle) * back + Math.cos(angle) * lateral;
        const flap = 0.55 + Math.sin(w.now / 110 + i * 1.7 + n * 6) * 0.55;
        const wing = 5 + flap * 4;
        ctx.beginPath();
        ctx.moveTo(bx - wing, by + wing * 0.5);
        ctx.lineTo(bx, by - 1);
        ctx.lineTo(bx + wing, by + wing * 0.5);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

const FIREFLY_CELL = 260;

/** A handful of road stretches glow with small clusters of hovering light bugs. */
function drawRoadFireflies(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number) {
  const clip = clipToArena(w, left, top, right, bottom);
  const startX = Math.floor(clip.left / FIREFLY_CELL) * FIREFLY_CELL;
  const startY = Math.floor(clip.top / FIREFLY_CELL) * FIREFLY_CELL;
  ctx.save();
  for (let x = startX; x < clip.right; x += FIREFLY_CELL) {
    for (let y = startY; y < clip.bottom; y += FIREFLY_CELL) {
      const gx = x / FIREFLY_CELL;
      const gy = y / FIREFLY_CELL;
      const n = hashCell(gx + 900, gy + 900);
      if (n > 0.16) continue;
      const cx = x + FIREFLY_CELL * (0.25 + 0.5 * hashCell(gx + 900, gy));
      const cy = y + FIREFLY_CELL * (0.25 + 0.5 * hashCell(gx, gy + 900));
      const count = 3 + Math.floor(hashCell(gx - 4, gy + 4) * 4);
      for (let i = 0; i < count; i += 1) {
        const seed = hashCell(gx + i * 7.3, gy - i * 3.1);
        const orbitR = 14 + seed * 30;
        const orbitSpeed = i % 2 === 0 ? 1 : -1;
        const angle = w.now / (700 + seed * 500) * orbitSpeed + seed * Math.PI * 2;
        const fx = cx + Math.cos(angle) * orbitR;
        const fy = cy + Math.sin(angle * 1.3) * orbitR * 0.6;
        const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(w.now / (240 + seed * 200) + seed * 10));
        const r = 10 + glow * 6;
        const gradient = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
        gradient.addColorStop(0, `rgba(214, 245, 140, ${0.55 * glow})`);
        gradient.addColorStop(1, 'rgba(214, 245, 140, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(fx, fy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 220, ${0.7 * glow})`;
        ctx.beginPath();
        ctx.arc(fx, fy, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

const LITTER_CELL = 340;

/** Paper scraps and leaves tumbling along the same wind lanes the clouds ride. */
function drawWindLitter(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number) {
  const clip = clipToArena(w, left, top, right, bottom);
  const startX = Math.floor(clip.left / LITTER_CELL) * LITTER_CELL - LITTER_CELL;
  const startY = Math.floor(clip.top / LITTER_CELL) * LITTER_CELL;
  ctx.save();
  for (let x = startX; x < clip.right + LITTER_CELL; x += LITTER_CELL) {
    for (let y = startY; y < clip.bottom; y += LITTER_CELL) {
      const gx = x / LITTER_CELL;
      const gy = y / LITTER_CELL;
      const n = hashCell(gx + 210, gy - 210);
      if (n > 0.34) continue;
      const speed = 0.05 + n * 0.09;
      const phase = hashCell(gx + 5, gy + 5) * LITTER_CELL;
      const sx = x + ((w.now * speed + phase) % (LITTER_CELL * 2));
      const sy = y + LITTER_CELL * hashCell(gx - 5, gy - 5) + Math.sin(w.now / 320 + gx * 2.3) * 14;
      // A scrap that has blown past the arena edge would be painted over by
      // drawArenaEdges anyway -- skip it rather than draw into the void.
      if (sx < clip.left || sx > clip.right || sy < clip.top || sy > clip.bottom) continue;
      const size = 3 + n * 5;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(w.now / 180 + n * 9);
      ctx.globalAlpha = 0.3 + n * 0.4;
      ctx.fillStyle = n > 0.2 ? '#8a7f6a' : '#6f7a5c';
      ctx.fillRect(-size / 2, -size / 3, size, size * 0.66);
      ctx.restore();
    }
  }
  ctx.restore();
}

const VENT_CELL = 420;

/** Street grates breathing steam -- a grate plate plus a few rising puffs. */
function drawSteamVents(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number) {
  const clip = clipToArena(w, left, top, right, bottom);
  const startX = Math.floor(clip.left / VENT_CELL) * VENT_CELL;
  const startY = Math.floor(clip.top / VENT_CELL) * VENT_CELL;
  ctx.save();
  for (let x = startX; x < clip.right; x += VENT_CELL) {
    for (let y = startY; y < clip.bottom; y += VENT_CELL) {
      const gx = x / VENT_CELL;
      const gy = y / VENT_CELL;
      const n = hashCell(gx - 330, gy + 330);
      if (n > 0.16) continue;
      const vx = x + VENT_CELL * (0.2 + 0.6 * hashCell(gx - 330, gy));
      const vy = y + VENT_CELL * (0.2 + 0.6 * hashCell(gx, gy + 330));
      if (vx < clip.left || vx > clip.right) continue;

      // Grate plate so the steam reads as coming from somewhere.
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#0c0f14';
      ctx.fillRect(vx - 14, vy - 7, 28, 14);
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#2b3440';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -9; i <= 9; i += 6) {
        ctx.moveTo(vx + i, vy - 6);
        ctx.lineTo(vx + i, vy + 6);
      }
      ctx.stroke();

      for (let i = 0; i < 3; i += 1) {
        const t = ((w.now / 2600) + i / 3 + n * 4) % 1;
        const rise = t * 52;
        const radius = 7 + t * 20;
        const alpha = Math.sin(t * Math.PI) * 0.42;
        if (alpha <= 0.005) continue;
        const puffX = vx + Math.sin(w.now / 900 + i * 2 + n * 6) * 8 * t;
        const puffY = vy - rise;
        const gradient = ctx.createRadialGradient(puffX, puffY, 0, puffX, puffY, radius);
        gradient.addColorStop(0, `rgba(206, 220, 235, ${alpha})`);
        gradient.addColorStop(1, 'rgba(206, 220, 235, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(puffX, puffY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

const RAIN_CELL = 64;

/**
 * Falling rain, leaning with the same wind that carries the clouds and litter.
 * Each cell owns one drop that wraps within the cell; neighbouring cells fill
 * the gaps, so a sparse grid reads as continuous rainfall.
 */
function drawRain(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number, intensity: number) {
  if (intensity <= 0) return;
  const startX = Math.floor(left / RAIN_CELL) * RAIN_CELL;
  const startY = Math.floor(top / RAIN_CELL) * RAIN_CELL;
  ctx.save();
  ctx.strokeStyle = '#a8c8e8';
  ctx.lineWidth = 1.3;
  ctx.globalAlpha = 0.38 * intensity;
  ctx.beginPath();
  for (let x = startX; x < right; x += RAIN_CELL) {
    for (let y = startY; y < bottom; y += RAIN_CELL) {
      const n = hashCell(x / RAIN_CELL + 11, y / RAIN_CELL - 11);
      const fall = (w.now * (0.5 + n * 0.28) + n * 5000) % RAIN_CELL;
      const dx = x + n * RAIN_CELL * 0.8 + fall * 0.26;
      const dy = y + fall;
      const len = 13 + n * 10;
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - len * 0.26, dy - len);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Dynamic atmospheric particle layers for The Lev Expansion skies:
 * - cyber-storm: high-speed electric ion sparks and ground electrostatic arc discharges
 * - toxic-haze: buoyant phosphorescent chemical spore motes undulated by atmospheric currents
 * - solar-flare: scorching convection heat distortion motes rising vertically into the sky
 */
function drawAtmosphericParticles(
  ctx: CanvasRenderingContext2D,
  w: World,
  left: number,
  top: number,
  right: number,
  bottom: number,
  sky: AreaSky,
) {
  if (sky === 'roofed' || sky === 'clear' || sky === 'overcast' || sky === 'fog') return;
  const clip = clipToArena(w, left, top, right, bottom);
  const width = clip.right - clip.left;
  const height = clip.bottom - clip.top;
  if (width <= 0 || height <= 0) return;

  const CELL = 180;
  const startX = Math.floor(clip.left / CELL) * CELL;
  const startY = Math.floor(clip.top / CELL) * CELL;

  ctx.save();
  if (sky === 'cyber-storm') {
    // Electric ion sparks & micro-lightning arcs
    for (let x = startX; x < clip.right; x += CELL) {
      for (let y = startY; y < clip.bottom; y += CELL) {
        const n = hashCell(x / CELL + 83, y / CELL - 83);
        const sparkT = (w.now * 0.0018 * (0.8 + n) + n * 10) % 1;
        const px = x + n * CELL + Math.sin(w.now * 0.008 + n * 20) * 16;
        const py = y + sparkT * CELL;
        const color = n > 0.5 ? '#38bdf8' : '#c084fc';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55 + Math.sin(w.now * 0.02 + n * 50) * 0.4;
        ctx.fillRect(px, py, 2.5, 2.5);

        // Ground-level electrostatic discharge
        if (n > 0.88 && Math.sin(w.now * 0.004 + n * 100) > 0.85) {
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + 12 * (n - 0.5), py + 8);
          ctx.lineTo(px + 24 * (n - 0.5), py + 14);
          ctx.stroke();
        }
      }
    }
  } else if (sky === 'toxic-haze') {
    // Bioluminescent chemical spore motes floating gently
    for (let x = startX; x < clip.right; x += CELL) {
      for (let y = startY; y < clip.bottom; y += CELL) {
        const n = hashCell(x / CELL - 31, y / CELL + 31);
        const t = (w.now * 0.0004 * (0.6 + n * 0.4) + n * 7) % 1;
        const px = x + n * CELL + Math.sin(w.now * 0.0015 + n * 12) * 28;
        const py = y + (1 - t) * CELL;
        const r = 2 + n * 2;
        ctx.fillStyle = n > 0.4 ? '#84cc16' : '#a3e635';
        ctx.globalAlpha = (0.35 + Math.sin(w.now * 0.003 + n * 30) * 0.25) * 0.85;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (sky === 'solar-flare') {
    // Incandescent solar ember particles rising against gravity
    for (let x = startX; x < clip.right; x += CELL) {
      for (let y = startY; y < clip.bottom; y += CELL) {
        const n = hashCell(x / CELL + 59, y / CELL + 101);
        const t = (w.now * 0.0009 * (0.9 + n * 0.3) + n * 9) % 1;
        const px = x + n * CELL + Math.sin(w.now * 0.002 + n * 15) * 14;
        const py = y + (1 - t) * CELL;
        const color = n > 0.6 ? '#f59e0b' : '#fb923c';
        ctx.fillStyle = color;
        ctx.globalAlpha = (0.45 + Math.sin(w.now * 0.005 + n * 40) * 0.3) * 0.9;
        ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }
  }
  ctx.restore();
}

/**
 * Ripple rings sitting exactly on the puddles `drawGround` paints -- same tile
 * size, same 0.93 hash threshold, same offsets -- so the rain lands in the
 * water instead of merely near it. Keep in sync if those puddles ever move.
 */
const PUDDLE_TILE = 64;

function drawPuddleRipples(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number, intensity: number) {
  if (intensity <= 0) return;
  const clip = clipToArena(w, left, top, right, bottom);
  const startX = Math.floor(clip.left / PUDDLE_TILE) * PUDDLE_TILE;
  const startY = Math.floor(clip.top / PUDDLE_TILE) * PUDDLE_TILE;
  ctx.save();
  ctx.strokeStyle = '#cfe6f5';
  ctx.lineWidth = 1;
  for (let x = startX; x < clip.right; x += PUDDLE_TILE) {
    for (let y = startY; y < clip.bottom; y += PUDDLE_TILE) {
      const noise = hashCell(x / PUDDLE_TILE, y / PUDDLE_TILE);
      if (noise <= 0.93) continue;
      const px = x + 10 + noise * 18;
      const py = y + 14 + noise * 12;
      for (let i = 0; i < 3; i += 1) {
        const t = ((w.now / 1400) + i / 3 + noise * 7) % 1;
        const radius = 3 + t * 19;
        ctx.globalAlpha = (1 - t) * 0.45 * intensity;
        ctx.beginPath();
        ctx.ellipse(px, py, radius, radius * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** A cold wash over wet ground, so a rainy district doesn't just have rain in the air. */
function drawWetSheen(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number, intensity: number) {
  if (intensity <= 0) return;
  const clip = clipToArena(w, left, top, right, bottom);
  ctx.save();
  ctx.globalAlpha = 0.07 * intensity;
  ctx.fillStyle = '#5d8fbf';
  ctx.fillRect(clip.left, clip.top, clip.right - clip.left, clip.bottom - clip.top);
  ctx.restore();
}

const FOG_CELL = 460;

/**
 * Slow banks of fog. Drawn as soft overlapping blobs on their own drift lanes
 * rather than a flat wash, so the murk moves and thins instead of sitting
 * over the whole arena as dead grey.
 */
function drawFogBanks(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number, intensity: number) {
  if (intensity <= 0) return;
  const startX = Math.floor(left / FOG_CELL) * FOG_CELL - FOG_CELL;
  const startY = Math.floor(top / FOG_CELL) * FOG_CELL - FOG_CELL;
  ctx.save();
  for (let x = startX; x < right + FOG_CELL; x += FOG_CELL) {
    for (let y = startY; y < bottom + FOG_CELL; y += FOG_CELL) {
      const gx = x / FOG_CELL;
      const gy = y / FOG_CELL;
      const n = hashCell(gx - 47, gy + 47);
      if (n > 0.7) continue;
      const drift = (w.now * (0.004 + n * 0.005) + n * FOG_CELL) % (FOG_CELL * 2);
      const fx = x + drift;
      const fy = y + FOG_CELL * 0.5 + Math.sin(w.now / 7000 + gy * 2.2) * 26;
      const rx = 210 + n * 190;
      const ry = 64 + n * 54;
      const blob = softBlob('#b0becd');
      if (!blob) continue;
      if (rx <= 0 || ry <= 0 || !Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(fx) || !Number.isFinite(fy)) continue;
      ctx.globalAlpha = (0.16 + n * 0.16) * intensity;
      ctx.drawImage(blob, fx - rx, fy - ry, rx * 2, ry * 2);
    }
  }
  ctx.restore();
}

/**
 * Neon doesn't breathe evenly -- it holds, then stutters. A per-sign hash on a
 * coarse time slot gives each sign its own arrhythmic brownouts.
 */
function neonFlicker(now: number, uid: number): number {
  const base = 0.82 + Math.sin(now / 420 + uid) * 0.12;
  const n = hashCell(Math.floor(now / 90), uid);
  if (n > 0.955) return base * 0.34;
  if (n > 0.9) return base * 0.68;
  return base;
}

/**
 * Distant lightning: most windows stay quiet, and a live one fires two quick
 * strokes. Capped low so it never washes out the fight.
 */
function lightningIntensity(now: number, period: number): number {
  if (period <= 0) return 0;
  if (hashCell(Math.floor(now / period), 77) > 0.45) return 0;
  const t = (now % period) / period;
  const stroke = (offset: number, width: number) => {
    const d = t - offset;
    return d >= 0 && d < width ? 1 - d / width : 0;
  };
  return Math.min(1, stroke(0.01, 0.012) * 0.9 + stroke(0.035, 0.02) * 0.6);
}

function drawChunkLandmark(
  ctx: CanvasRenderingContext2D,
  block: {
    x: number;
    y: number;
    landmark?: { name: string; kind: string; accent: string };
  },
) {
  const landmark = block.landmark;
  if (!landmark) return;

  const { x, y } = block;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = landmark.accent;
  ctx.fillStyle = `${landmark.accent}26`;
  ctx.shadowColor = landmark.accent;
  ctx.shadowBlur = 18;

  if (landmark.kind === 'bridge') {
    // The tall deck and paired towers are intentionally readable from a
    // distance, while the chevrons point toward the only safe river gap.
    ctx.fillStyle = '#1c3443';
    ctx.fillRect(x - 32, y - 122, 64, 244);
    ctx.strokeRect(x - 32, y - 122, 64, 244);
    ctx.fillStyle = landmark.accent;
    ctx.globalAlpha = 0.72;
    for (let plankY = y - 104; plankY <= y + 104; plankY += 22) {
      ctx.fillRect(x - 26, plankY, 52, 5);
    }
    ctx.globalAlpha = 0.95;
    ctx.fillRect(x - 58, y - 128, 12, 40);
    ctx.fillRect(x + 46, y - 128, 12, 40);
    ctx.fillRect(x - 58, y + 88, 12, 40);
    ctx.fillRect(x + 46, y + 88, 12, 40);

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#f6c453';
    for (const markerY of [y - 172, y + 172]) {
      ctx.beginPath();
      if (markerY < y) {
        ctx.moveTo(x - 18, markerY + 10);
        ctx.lineTo(x, markerY - 8);
        ctx.lineTo(x + 18, markerY + 10);
      } else {
        ctx.moveTo(x - 18, markerY - 10);
        ctx.lineTo(x, markerY + 8);
        ctx.lineTo(x + 18, markerY - 10);
      }
      ctx.stroke();
    }
  } else if (landmark.kind === 'market') {
    ctx.fillRect(x - 116, y - 34, 232, 68);
    ctx.strokeRect(x - 116, y - 34, 232, 68);
    ctx.fillRect(x - 12, y - 86, 24, 52);
    ctx.strokeRect(x - 12, y - 86, 24, 52);
    ctx.fillStyle = landmark.accent;
    ctx.globalAlpha = 0.75;
    for (let awningX = x - 96; awningX <= x + 72; awningX += 28) {
      ctx.beginPath();
      ctx.moveTo(awningX, y - 29);
      ctx.lineTo(awningX + 20, y - 29);
      ctx.lineTo(awningX + 14, y - 8);
      ctx.lineTo(awningX + 6, y - 8);
      ctx.closePath();
      ctx.fill();
    }
  } else if (landmark.kind === 'rail-yard') {
    ctx.globalAlpha = 0.55;
    for (const trackY of [y - 32, y + 32]) {
      ctx.beginPath();
      ctx.moveTo(x - 126, trackY);
      ctx.lineTo(x + 126, trackY);
      ctx.stroke();
      for (let trackX = x - 108; trackX <= x + 108; trackX += 24) {
        ctx.fillRect(trackX - 2, trackY - 7, 4, 14);
      }
    }
    ctx.globalAlpha = 0.95;
    ctx.fillRect(x - 8, y - 92, 16, 160);
    ctx.strokeRect(x - 26, y - 108, 52, 16);
    ctx.fillRect(x - 34, y - 88, 68, 5);
  } else if (landmark.kind === 'scrapyard') {
    // A crooked stack of crushed-car silhouettes behind a chain fence line.
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 130, y + 60);
    ctx.lineTo(x + 130, y + 60);
    ctx.stroke();
    for (let fenceX = -120; fenceX <= 120; fenceX += 20) {
      ctx.beginPath();
      ctx.moveTo(x + fenceX, y + 60);
      ctx.lineTo(x + fenceX, y + 20);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.92;
    ctx.fillRect(x - 44, y - 18, 88, 40);
    ctx.strokeRect(x - 44, y - 18, 88, 40);
    ctx.fillRect(x - 28, y - 52, 56, 36);
    ctx.strokeRect(x - 28, y - 52, 56, 36);
    ctx.fillRect(x - 12, y - 82, 24, 32);
    ctx.strokeRect(x - 12, y - 82, 24, 32);
  } else if (landmark.kind === 'overpass') {
    // A raised roadway slab on paired support pillars.
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x - 150, y - 96, 300, 26);
    ctx.strokeRect(x - 150, y - 96, 300, 26);
    ctx.globalAlpha = 0.6;
    for (const pillarX of [x - 96, x, x + 96]) {
      ctx.fillRect(pillarX - 10, y - 70, 20, 158);
      ctx.strokeRect(pillarX - 10, y - 70, 20, 158);
    }
  } else {
    // Four approach paths and a rotunda make the plaza a useful visual anchor.
    ctx.globalAlpha = 0.42;
    ctx.fillRect(x - 128, y - 7, 256, 14);
    ctx.fillRect(x - 7, y - 128, 14, 256);
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.arc(x, y, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(x - 4, y - 68, 8, 24);
    ctx.fillRect(x - 4, y + 44, 8, 24);
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(landmark.name.toUpperCase(), x, y - 142);
  ctx.restore();
}

type EndlessBuilding = NonNullable<World['endless']>['buildings'][number];

function drawWalkInFloor(ctx: CanvasRenderingContext2D, building: EndlessBuilding) {
  const left = building.x - building.w / 2 + 10;
  const top = building.y - building.h / 2 + 10;
  const width = building.w - 20;
  const height = building.h - 20;
  const id = building.prefabId;
  const domestic = id === 'duplex' || id === 'apartment' || id === 'penthouse';
  const tiled = id === 'clinic' || id === 'laundromat' || id === 'harbor-office';
  const industrial = id === 'warehouse' || id === 'auto-shop' || id === 'toll-plaza' || id === 'lev-substation';
  const digital = id === 'antenna-hub' || id === 'server-cluster' || id === 'skyline-spire' || id === 'nanite-foundry';
  const crypt = id === 'catacomb-crypt';

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, width, height);
  ctx.clip();
  ctx.globalAlpha = 1;
  ctx.fillStyle = domestic ? '#182923' : tiled ? '#132631' : industrial ? '#24252b' : digital ? '#111d2b' : crypt ? '#28232b' : '#2a2028';
  ctx.fillRect(left, top, width, height);

  ctx.strokeStyle = building.accent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.19;
  if (domestic || id === 'corner-store' || id === 'bar') {
    // Floorboards and alternating short seams keep homes distinct from work sites.
    for (let y = top + 14, row = 0; y < top + height; y += 15, row += 1) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + width, y);
      ctx.stroke();
      for (let x = left + (row % 2 ? 28 : 56); x < left + width; x += 56) {
        ctx.beginPath();
        ctx.moveTo(x, y - 15);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  } else if (tiled || crypt) {
    const tile = crypt ? 29 : 22;
    for (let x = left + tile; x < left + width; x += tile) {
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + height); ctx.stroke();
    }
    for (let y = top + tile; y < top + height; y += tile) {
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + width, y); ctx.stroke();
    }
  } else if (industrial) {
    for (let y = top + 16; y < top + height; y += 18) {
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + width, y); ctx.stroke();
    }
    ctx.globalAlpha = 0.11;
    for (let x = left + 16; x < left + width; x += 36) {
      ctx.fillRect(x, top, 8, height);
    }
  } else if (digital) {
    for (let x = left + 22; x < left + width; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, building.y - 8);
      ctx.lineTo(x + 18, building.y - 8);
      ctx.stroke();
      ctx.fillRect(x + 16, building.y - 10, 4, 4);
    }
  }

  // The light is localized, keeping actors and the door lane clear in dense fights.
  const light = ctx.createRadialGradient(building.x, building.y, 8, building.x, building.y, Math.max(width, height) * 0.6);
  light.addColorStop(0, `${building.accent}30`);
  light.addColorStop(1, `${building.accent}00`);
  ctx.globalAlpha = 1;
  ctx.fillStyle = light;
  ctx.fillRect(left, top, width, height);
  ctx.restore();

  const door = buildingSupplyPoint(building);
  ctx.save();
  ctx.globalAlpha = 0.68;
  ctx.fillStyle = building.accent;
  if (building.doorSide === 'north' || building.doorSide === 'south') {
    ctx.fillRect(door.x - 13, door.y - 3, 26, 6);
  } else {
    ctx.fillRect(door.x - 3, door.y - 13, 6, 26);
  }
  ctx.restore();
}

function drawCityMapFeatures(ctx: CanvasRenderingContext2D, w: World) {
  const e = w.endless;
  if (!e || e.inDungeon || e.inBuilding) return;

  for (const block of e.cityBlocks) {
    ctx.save();
    const roadWidth = 112;
    const sidewalk = 12;
    ctx.globalAlpha = 0.74;
    ctx.fillStyle = '#0e1720';
    ctx.fillRect(block.x - block.w / 2, block.y - roadWidth / 2, block.w, roadWidth);
    ctx.fillRect(block.x - roadWidth / 2, block.y - block.h / 2, roadWidth, block.h);
    ctx.globalAlpha = 0.48;
    ctx.strokeStyle = block.districtAccent;
    ctx.lineWidth = 2;
    ctx.setLineDash([22, 18]);
    ctx.beginPath();
    if (block.streetAxis === 'horizontal') {
      ctx.moveTo(block.x - block.w / 2, block.y);
      ctx.lineTo(block.x + block.w / 2, block.y);
    } else {
      ctx.moveTo(block.x, block.y - block.h / 2);
      ctx.lineTo(block.x, block.y + block.h / 2);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = block.river ? '#4de1ff' : block.bandAccent ?? block.districtAccent;
    ctx.lineWidth = 3;
    ctx.strokeRect(block.x - block.w / 2 + sidewalk, block.y - block.h / 2 + sidewalk, block.w - sidewalk * 2, block.h - sidewalk * 2);
    ctx.globalAlpha = 0.74;
    ctx.fillStyle = block.landmark?.accent ?? block.bandAccent ?? block.districtAccent;
    ctx.font = 'bold 10px monospace';
    ctx.fillText(
      `${block.district.toUpperCase()} · ${block.landmark?.name.toUpperCase() ?? block.kind.toUpperCase()}`,
      block.x - block.w / 2 + 18,
      block.y - block.h / 2 + 22,
    );
    ctx.restore();
  }

  for (const river of e.riverSegments) {
    ctx.save();
    ctx.fillStyle = '#123b58';
    ctx.globalAlpha = 0.82;
    ctx.fillRect(river.x - river.w / 2, river.y - river.h / 2, river.w, river.h);
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = '#6ee7ff';
    ctx.lineWidth = 2;
    for (let x = river.x - river.w / 2 + 12; x < river.x + river.w / 2; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, river.y - 18);
      ctx.lineTo(x + 16, river.y - 8);
      ctx.lineTo(x, river.y + 2);
      ctx.stroke();
    }
    if (river.crossingX !== null) {
      ctx.fillStyle = '#f6c453';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(river.crossingX - 28, river.y - river.h / 2, 56, river.h);
    } else {
      // Orange bank caps warn that this river edge is not a crossing.
      ctx.strokeStyle = '#fb7185';
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(river.x - river.w / 2 + 8, river.y - river.h / 2 + 5);
      ctx.lineTo(river.x + river.w / 2 - 8, river.y - river.h / 2 + 5);
      ctx.moveTo(river.x - river.w / 2 + 8, river.y + river.h / 2 - 5);
      ctx.lineTo(river.x + river.w / 2 - 8, river.y + river.h / 2 - 5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  for (const block of e.cityBlocks) {
    drawChunkLandmark(ctx, block);
  }

  for (const building of e.buildings) {
    const left = building.x - building.w / 2;
    const top = building.y - building.h / 2;
    const walkedInside = e.buildingEntryStyle === 'seamless' && e.walkInBuildingId === building.id;
    ctx.save();
    ctx.fillStyle = walkedInside ? '#0a1118' : '#131a25';
    ctx.globalAlpha = 0.96;
    ctx.fillRect(left, top, building.w, building.h);
    ctx.fillStyle = `${building.accent}${walkedInside ? '28' : '18'}`;
    ctx.fillRect(left + 8, top + 8, building.w - 16, building.h - 16);
    ctx.strokeStyle = building.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(left, top, building.w, building.h);
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([7, 7]);
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 7, top + 7, building.w - 14, building.h - 14);
    ctx.setLineDash([]);
    if (walkedInside) {
      drawWalkInFloor(ctx, building);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.86;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(building.name.toUpperCase(), building.x, top + 28);
    } else {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#dbeafe';
      const windowCount = Math.max(2, Math.floor((building.w - 36) / 34));
      for (let index = 0; index < windowCount; index += 1) {
        const wx = left + 18 + index * ((building.w - 36) / Math.max(1, windowCount - 1));
        ctx.fillRect(wx - 5, top + 18, 10, 5);
        ctx.fillRect(wx - 5, top + building.h - 23, 10, 5);
      }
      const isVerticalDoor = building.doorSide === 'east' || building.doorSide === 'west';
      ctx.fillStyle = '#fff3b0';
      if (isVerticalDoor) {
        const dx = building.doorSide === 'west' ? left - 3 : left + building.w - 3;
        ctx.fillRect(dx, building.y - 10, 6, 20);
      } else {
        const dy = building.doorSide === 'north' ? top - 3 : top + building.h - 3;
        ctx.fillRect(building.x - 10, dy, 20, 6);
      }
      ctx.fillStyle = building.accent;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(building.x - Math.min(58, building.sign.length * 4), building.y - 5, Math.min(116, building.sign.length * 8), 15);
      ctx.fillStyle = '#08111a';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(building.sign, building.x, building.y + 5);
    }
    if (e.buildingEntryStyle === 'seamless' && building.supplyKind && !e.claimedBuildingSupplies.has(building.id)) {
      const supplyColor = building.supplyKind === 'health' ? '#7dffb2'
        : building.supplyKind === 'water-flask' ? '#38bdf8'
        : building.supplyKind === 'cred' ? '#fbbf24'
        : '#c084fc';
      const supplyLabel = building.supplyKind === 'health' ? 'HEAL'
        : building.supplyKind === 'water-flask' ? 'WATER'
        : building.supplyKind === 'cred' ? 'CRED'
        : 'SALVAGE';
      ctx.fillStyle = supplyColor;
      ctx.strokeStyle = supplyColor;
      if (walkedInside) {
        const supply = buildingSupplyPoint(building);
        ctx.globalAlpha = 0.85;
        ctx.shadowColor = supplyColor;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(supply.x, supply.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(supplyLabel, supply.x, supply.y - 13);
      } else {
        ctx.globalAlpha = 0.75;
        ctx.fillRect(left + 13, top + 35, 6, 6);
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(supplyLabel, left + 24, top + 41);
      }
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }

  for (const door of e.buildingEntrances) {
    ctx.save();
    ctx.globalAlpha = e.buildingEntryStyle === 'seamless' ? 0.42 : 0.85;
    ctx.fillStyle = '#f6c453';
    ctx.fillRect(door.x - door.w / 2, door.y - door.h / 2, door.w, door.h);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(door.x - 5, door.y - 8, 10, 16);
    ctx.font = '9px monospace';
    ctx.fillText(e.buildingEntryStyle === 'seamless' ? 'OPEN' : 'ENTER', door.x - 18, door.y - 20);
    ctx.restore();
  }
}

function drawEndlessRouteEvent(ctx: CanvasRenderingContext2D, w: World) {
  const event = w.endless?.routeEvent;
  if (!event || event.phase !== 'available' || w.endless?.inDungeon || w.endless?.inBuilding) return;
  const accent = ENDLESS_BANDS_BY_ID[event.bandId]?.accent ?? '#fff';
  const pulse = 1 + Math.sin(w.now / 180) * 0.15;
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.fillStyle = `${accent}22`;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 22;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(event.x, event.y, 28 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(event.x, event.y - 14);
  ctx.lineTo(event.x, event.y + 14);
  ctx.moveTo(event.x - 14, event.y);
  ctx.lineTo(event.x + 14, event.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(event.title.toUpperCase(), event.x, event.y - 40);
  ctx.font = '9px monospace';
  ctx.fillStyle = accent;
  ctx.fillText(`RISK / REWARD · +${event.rewardCred} CRED`, event.x, event.y + 48);
  ctx.restore();
}

function drawBuildingInterior(ctx: CanvasRenderingContext2D, w: World) {
  const e = w.endless;
  if (!e?.inBuilding || !e.buildingPrefabId) return;
  const prefab = getBuildingPrefab(e.buildingPrefabId as Parameters<typeof getBuildingPrefab>[0]);
  const { w: width, h: height } = e.dungeonBounds;
  const left = e.buildingCenterX - width / 2;
  const top = e.buildingCenterY - height / 2;

  ctx.save();
  ctx.fillStyle = '#0a1118';
  ctx.globalAlpha = 0.98;
  ctx.fillRect(left, top, width, height);
  ctx.fillStyle = `${prefab.accent}12`;
  ctx.fillRect(left + 12, top + 12, width - 24, height - 24);
  ctx.strokeStyle = prefab.accent;
  ctx.lineWidth = 5;
  ctx.strokeRect(left, top, width, height);
  ctx.globalAlpha = 0.45;
  ctx.setLineDash([9, 7]);
  ctx.lineWidth = 2;
  ctx.strokeRect(left + 10, top + 10, width - 20, height - 20);
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(prefab.name.toUpperCase(), e.buildingCenterX, top - 16);
  ctx.font = '9px monospace';
  ctx.fillStyle = prefab.accent;
  ctx.fillText('INTERIOR · FIND THE EXIT', e.buildingCenterX, top - 3);
  ctx.textAlign = 'left';
  ctx.restore();
}

function groundAccent(w: World): string {
  if (w.endless?.inDungeon) return effectiveGround(w).glow;
  return w.area.ground.glow;
}

/** A streetlight pool that keeps the middle of the fight readable. */
/**
 * Visual-only music reaction. The renderer owns `scale`/`glow`/`lightRadius`
 * so a beat can never perturb the simulation -- two clients watching the same
 * run with different tracks still see identical gameplay.
 */
function musicVisual(w: World, reactions: Parameters<typeof reactionMultiplier>[0], target: 'scale' | 'glow' | 'lightRadius'): number {
  if (w.audio.source === 'none') return 1;
  return reactionMultiplier(reactions, target, w.audio, {
    beat: w.beatPulse,
    downbeat: w.downbeatPulse,
    onset: w.onsetPulse,
  });
}

/**
 * Screen-wide tint stops keyed to `w.cycle.phase` (0/1 = midnight, 0.5 =
 * neutral daylight) -- a cool blue at midnight, a warm dusk/dawn tone
 * either side of it, fully transparent at noon.
 */
const TIME_OF_DAY_STOPS: Array<[number, [number, number, number, number]]> = [
  [0, [10, 14, 40, 0.16]],
  [0.25, [60, 24, 70, 0.12]],
  [0.5, [0, 0, 0, 0]],
  [0.75, [90, 46, 12, 0.1]],
  [1, [10, 14, 40, 0.16]],
];

function timeOfDayTint(phase: number): string {
  const clamped = clamp(phase, 0, 1);
  let a = TIME_OF_DAY_STOPS[0]!;
  let b = TIME_OF_DAY_STOPS[TIME_OF_DAY_STOPS.length - 1]!;
  for (let i = 0; i < TIME_OF_DAY_STOPS.length - 1; i += 1) {
    if (clamped >= TIME_OF_DAY_STOPS[i]![0] && clamped <= TIME_OF_DAY_STOPS[i + 1]![0]) {
      a = TIME_OF_DAY_STOPS[i]!;
      b = TIME_OF_DAY_STOPS[i + 1]!;
      break;
    }
  }
  const span = b[0] - a[0] || 1;
  const t = (clamped - a[0]) / span;
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const [r1, g1, b1, alpha1] = a[1];
  const [r2, g2, b2, alpha2] = b[1];
  const r = Math.round(lerp(r1, r2));
  const g = Math.round(lerp(g1, g2));
  const bl = Math.round(lerp(b1, b2));
  const alpha = lerp(alpha1, alpha2);
  return `rgba(${r}, ${g}, ${bl}, ${alpha.toFixed(3)})`;
}

function drawLightPool(ctx: CanvasRenderingContext2D, w: World) {
  // The player's pool of light breathes with the low end -- the most legible
  // beat cue on screen, because it moves the whole frame rather than a sprite.
  const radius = 340 * (w.audio.source === 'none' ? 1 : 1 + 0.16 * w.audio.bands.sub + 0.1 * w.beatPulse);
  const gradient = ctx.createRadialGradient(w.player.x, w.player.y, 20, w.player.x, w.player.y, radius);
  gradient.addColorStop(0, 'rgba(255,255,255,0.075)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.03)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(w.player.x - radius, w.player.y - radius, radius * 2, radius * 2);
}

function drawLandmark(ctx: CanvasRenderingContext2D, w: World) {
  const landmark = w.area.landmark;
  if (!landmark) return;
  const x = landmark.position?.x ?? 0;
  const y = landmark.position?.y ?? -150;
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = landmark.accent;
  ctx.fillStyle = `${landmark.accent}22`;
  ctx.shadowColor = landmark.accent;
  ctx.shadowBlur = 16;

  if (landmark.kind === 'market') {
    // Long hall, repeated awnings, and a high bell tower.
    ctx.fillRect(x - 142, y - 26, 284, 58);
    ctx.strokeRect(x - 142, y - 26, 284, 58);
    ctx.fillRect(x - 22, y - 76, 44, 50);
    ctx.strokeRect(x - 22, y - 76, 44, 50);
    ctx.fillStyle = landmark.accent;
    for (let i = -3; i <= 3; i += 1) {
      ctx.globalAlpha = i % 2 === 0 ? 0.85 : 0.32;
      ctx.beginPath();
      ctx.moveTo(x + i * 40 - 20, y - 42);
      ctx.lineTo(x + i * 40 + 20, y - 42);
      ctx.lineTo(x + i * 40 + 12, y - 20);
      ctx.lineTo(x + i * 40 - 12, y - 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y + 2, 14, 0, Math.PI * 2);
    ctx.stroke();
  } else if (landmark.kind === 'rail-yard') {
    ctx.globalAlpha = 0.5;
    for (const trackY of [-44, 44]) {
      ctx.beginPath();
      ctx.moveTo(x - 190, y + trackY);
      ctx.lineTo(x + 190, y + trackY);
      ctx.stroke();
      for (let trackX = -170; trackX <= 170; trackX += 34) {
        ctx.fillRect(x + trackX - 2, y + trackY - 9, 4, 18);
      }
    }
    ctx.globalAlpha = 0.85;
    // Signal tower with a stepped cap, deliberately taller than nearby props.
    ctx.fillRect(x - 9, y - 78, 18, 136);
    ctx.strokeRect(x - 30, y - 94, 60, 18);
    ctx.fillRect(x - 42, y - 76, 84, 5);
    ctx.fillRect(x - 34, y - 58, 5, 116);
    ctx.fillRect(x + 29, y - 58, 5, 116);
    ctx.fillStyle = '#fff1d0';
    ctx.fillRect(x - 4, y - 72, 8, 8);
  } else if (landmark.kind === 'plaza') {
    // Four approach paths make the rotunda readable even at mobile zoom.
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x - 155, y - 8, 310, 16);
    ctx.fillRect(x - 8, y - 155, 16, 310);
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.arc(x, y, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(x - 4, y - 80, 8, 28);
    ctx.fillRect(x - 4, y + 52, 8, 28);
  } else if (landmark.kind === 'pressure-rooms') {
    ctx.globalAlpha = 0.72;
    for (const roomX of [-122, 0, 122]) {
      ctx.fillRect(x + roomX - 48, y - 46, 96, 92);
      ctx.strokeRect(x + roomX - 48, y - 46, 96, 92);
      ctx.strokeRect(x + roomX - 18, y - 30, 36, 62);
    }
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, y + 76, 34, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = landmark.accent;
    ctx.fillRect(x - 30, y + 76, 60, 5);
  } else {
    // Floodgate: twin buttresses and a central gate face.
    ctx.fillRect(x - 170, y - 38, 340, 76);
    ctx.strokeRect(x - 170, y - 38, 340, 76);
    ctx.fillRect(x - 190, y - 64, 26, 102);
    ctx.fillRect(x + 164, y - 64, 26, 102);
    ctx.strokeRect(x - 190, y - 64, 26, 102);
    ctx.strokeRect(x + 164, y - 64, 26, 102);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 130, y + 26);
    ctx.lineTo(x - 60, y - 24);
    ctx.lineTo(x + 15, y + 26);
    ctx.lineTo(x + 90, y - 24);
    ctx.lineTo(x + 150, y + 26);
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = landmark.accent;
    ctx.fillRect(x - 5, y - 30, 10, 60);
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(landmark.name.toUpperCase(), x, y - 92);
  ctx.restore();
}

function effectiveGround(w: World) {
  if (w.endless?.inDungeon) {
    const era = DUNGEON_ERAS[w.endless.dungeonEraIndex];
    if (era) return era.ground;
  }
  if (w.endless && !w.endless.inBuilding) {
    const band = ENDLESS_BANDS_BY_ID[w.endless.currentBandId];
    if (band) return band.ground;
  }
  return w.area.ground;
}

function drawDistrictIncursion(ctx: CanvasRenderingContext2D, w: World) {
  const state = w.districtIncursion;
  if (!state || state.phase === 'pending') return;
  const x = 0;
  const y = -150;
  const accent = state.accent;
  ctx.save();
  ctx.globalAlpha = state.phase === 'warning' ? 0.34 : state.phase === 'active' ? 0.56 : 0.22;
  ctx.strokeStyle = accent;
  ctx.fillStyle = `${accent}18`;
  ctx.lineWidth = 3;
  ctx.setLineDash(state.phase === 'warning' ? [10, 8] : []);

  if (state.kind === 'flood-surge') {
    const safeLane = ((state.cycle + 1) % 3 - 1) * 180;
    for (const lane of [-180, 0, 180]) {
      ctx.fillStyle = lane === safeLane ? `${accent}32` : '#147e8c18';
      ctx.fillRect(lane - 48, y - 275, 96, 550);
      ctx.strokeRect(lane - 48, y - 275, 96, 550);
    }
    ctx.fillStyle = accent;
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.phase === 'active' ? 'SAFE LANE' : 'LANES SHIFTING', safeLane, y - 286);
  } else if (state.kind === 'market-bell') {
    ctx.beginPath();
    ctx.arc(x, y, 160, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 188, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillRect(x - 12, y - 24, 24, 24);
    ctx.beginPath();
    ctx.arc(x, y - 24, 17, Math.PI, 0);
    ctx.stroke();
  } else if (state.kind === 'freight-arrival') {
    for (const trackY of [-72, 0, 72]) {
      ctx.beginPath();
      ctx.moveTo(x - 300, y + trackY);
      ctx.lineTo(x + 300, y + trackY);
      ctx.stroke();
      for (let trackX = -280; trackX <= 280; trackX += 42) {
        ctx.fillRect(trackX - 2, y + trackY - 8, 4, 16);
      }
    }
    ctx.fillStyle = accent;
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MOVING COVER', x, y - 116);
  } else if (state.kind === 'fountain-ritual') {
    const safeAngle = Math.PI / 2 + (state.cycle % 4) * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, 260, safeAngle - 0.88, safeAngle + 0.88);
    ctx.closePath();
    ctx.fillStyle = `${accent}38`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 260, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 90, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SAFE QUARTER', x, y - 272);
  }
  ctx.restore();
}

/** Procedural, targetless presentation for the rare Running Man sighting. */
function drawRunningMan(ctx: CanvasRenderingContext2D, w: World) {
  const state = w.runningMan;
  if (state.phase === 'waiting' || state.phase === 'complete') return;
  const pathX = state.endX - state.startX;
  const pathY = state.endY - state.startY;
  const pathLength = Math.hypot(pathX, pathY);
  if (pathLength < 1) return;
  const dirX = pathX / pathLength;
  const dirY = pathY / pathLength;
  const normalX = -dirY;
  const normalY = dirX;
  const warningPulse = 0.45 + Math.sin(w.now / 85) * 0.2;

  ctx.save();
  ctx.strokeStyle = state.phase === 'warning' ? '#fbbf24' : '#e0f2fe';
  ctx.fillStyle = '#fbbf24';
  ctx.globalAlpha = state.phase === 'warning' ? warningPulse : 0.24;
  ctx.lineWidth = 3;
  ctx.setLineDash(state.phase === 'warning' ? [18, 12] : [6, 16]);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(state.startX + normalX * 86 * side, state.startY + normalY * 86 * side);
    ctx.lineTo(state.endX + normalX * 86 * side, state.endY + normalY * 86 * side);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.font = 'bold 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.globalAlpha = state.phase === 'warning' ? 0.9 : 0.48;
  ctx.fillText('CLEAR THE CROSSING LINE', (state.startX + state.endX) / 2, (state.startY + state.endY) / 2 - 112);

  if (state.phase === 'running') {
    const progress = clamp((w.now - state.startedAt) / Math.max(1, state.endsAt - state.startedAt), 0, 1);
    const x = state.startX + pathX * progress;
    const y = state.startY + pathY * progress;
    const angle = Math.atan2(pathY, pathX);
    const stride = Math.sin(w.now / 48);

    // Speed streaks live behind the figure and make the crossing direction
    // readable even under high enemy density.
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 4;
    for (let i = 1; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x - dirX * (28 + i * 22) + normalX * i * 6, y - dirY * (28 + i * 22) + normalY * i * 6);
      ctx.lineTo(x - dirX * (74 + i * 28) + normalX * i * 6, y - dirY * (74 + i * 28) + normalY * i * 6);
      ctx.stroke();
    }

    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.ellipse(0, 25, 28, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Compact pixel runner: coat, bright head mark, pumping arms, and a
    // deliberately exaggerated stride. No image/likeness dependency.
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-14, -25, 30, 42);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-10, -20, 5, 30);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-8, -39, 17, 15);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-10, -42, 23, 5);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-20, -17 + stride * 5, 8, 26);
    ctx.fillRect(15, -17 - stride * 5, 8, 26);
    ctx.fillRect(-11, 14, 8, 26 + stride * 8);
    ctx.fillRect(7, 14, 8, 26 - stride * 8);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(-15, 36 + stride * 8, 15, 6);
    ctx.fillRect(8, 36 - stride * 8, 16, 6);
  }
  ctx.restore();
}

function inferObstacleKind(obs: { w: number; h: number }): ObstacleDef['kind'] {
  const aspect = obs.w / obs.h;
  if (aspect > 2.5) return 'barrier';
  if (obs.w > 95) return 'car';
  if (obs.w > 65) return 'dumpster';
  return 'crate';
}

/**
 * `view` is the visible world rect. The out-of-bounds blackout has to reach
 * the edge of *that*, not a fixed distance: a zoomed-out camera (Sector
 * Command's commander view) otherwise shows lit ground past the arena wall.
 */
function drawArenaEdges(
  ctx: CanvasRenderingContext2D,
  w: World,
  view: { left: number; top: number; right: number; bottom: number },
) {
  // Endless mode has no walls.
  if (w.area.endless) return;

  const halfW = w.bounds.w / 2;
  const halfH = w.bounds.h / 2;
  const thickness = 26;

  ctx.fillStyle = '#0a0a0d';
  const outLeft = Math.min(view.left, -halfW) - 400;
  const outRight = Math.max(view.right, halfW) + 400;
  const outTop = Math.min(view.top, -halfH) - 400;
  const outBottom = Math.max(view.bottom, halfH) + 400;
  ctx.fillRect(outLeft, outTop, outRight - outLeft, -halfH - outTop);
  ctx.fillRect(outLeft, halfH, outRight - outLeft, outBottom - halfH);
  ctx.fillRect(outLeft, -halfH, -halfW - outLeft, w.bounds.h);
  ctx.fillRect(halfW, -halfH, outRight - halfW, w.bounds.h);

  const groundTint = w.musicColorOverride ?? (w.worldColorFullRecolor ? w.worldColorPalette : undefined);
  ctx.fillStyle = groundTint ? mixHex(w.area.ground.seam, groundTint.bodyDark, 0.3) : w.area.ground.seam;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-halfW, -halfH, w.bounds.w, 4);
  ctx.fillRect(-halfW, halfH - 4, w.bounds.w, 4);
  ctx.fillRect(-halfW, -halfH, 4, w.bounds.h);
  ctx.fillRect(halfW - 4, -halfH, 4, w.bounds.h);
  ctx.globalAlpha = 1;

  // Hazard striping just inside the boundary.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = groundTint ? mixHex(w.area.ground.glow, groundTint.accent, 0.35) : w.area.ground.glow;
  for (let x = -halfW; x < halfW; x += 46) {
    ctx.fillRect(x, -halfH + 4, 24, thickness * 0.35);
    ctx.fillRect(x, halfH - 4 - thickness * 0.35, 24, thickness * 0.35);
  }
  ctx.restore();
}

/** Glowing doorway markers for dungeon entrances on the street. */
function drawDungeonEntrances(ctx: CanvasRenderingContext2D, w: World) {
  const e = w.endless;
  if (!e || e.inDungeon) return;

  const pulse = 0.65 + Math.sin(w.now / 380) * 0.35;

  for (const en of e.dungeonEntrances) {
    const x = en.x - en.w / 2;
    const y = en.y - en.h / 2;

    // Glow
    ctx.save();
    ctx.shadowColor = '#f0a848';
    ctx.shadowBlur = 22 * pulse;
    ctx.globalAlpha = 0.55 + pulse * 0.3;

    // Portal frame
    ctx.fillStyle = '#f0a848';
    ctx.fillRect(x, y, en.w, 4);               // top bar
    ctx.fillRect(x, y + en.h - 4, en.w, 4);    // bottom bar
    ctx.fillRect(x, y, 4, en.h);               // left post
    ctx.fillRect(x + en.w - 4, y, 4, en.h);    // right post

    // Stair symbol inside
    ctx.globalAlpha = 0.4 * pulse;
    ctx.fillStyle = '#fff8e0';
    const cx = en.x;
    const cy = en.y;
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(cx - 7 + i * 5, cy - 3 + i * 3, 12 - i * 4, 2);
    }

    ctx.restore();
  }
}

/** Exit zone marker shown inside dungeon rooms. */
function drawDungeonExit(ctx: CanvasRenderingContext2D, w: World) {
  const e = w.endless;
  if (!e || (!e.inDungeon && !e.inBuilding) || !e.exitZone) return;

  const exit = e.exitZone;
  const x = exit.x - exit.w / 2;
  const y = exit.y - exit.h / 2;
  const pulse = 0.65 + Math.sin(w.now / 300) * 0.35;

  ctx.save();
  ctx.shadowColor = '#7ef0bd';
  ctx.shadowBlur = 20 * pulse;
  ctx.globalAlpha = 0.6 + pulse * 0.25;

  ctx.strokeStyle = '#7ef0bd';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, exit.w - 4, exit.h - 4);

  // Arrow points toward the outside of the active room.
  ctx.fillStyle = '#7ef0bd';
  ctx.globalAlpha = 0.55 * pulse;
  ctx.beginPath();
  const mx = exit.x + 4;
  const my = exit.y;
  ctx.moveTo(mx - 8, my - 6);
  ctx.lineTo(mx + 8, my);
  ctx.lineTo(mx - 8, my + 6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(e.inBuilding ? 'OUT' : 'EXIT', exit.x, exit.y + 31);
  ctx.textAlign = 'left';

  ctx.restore();
}

function drawDungeonChest(ctx: CanvasRenderingContext2D, w: World) {
  const chest = w.endless?.dungeonChest;
  if (!chest || !w.endless?.inDungeon) return;
  const pulse = 0.65 + Math.sin(w.now / 260) * 0.35;
  ctx.save();
  ctx.globalAlpha = chest.unlocked ? 0.85 + pulse * 0.15 : 0.55;
  ctx.shadowColor = chest.unlocked ? '#ffd166' : '#64748b';
  ctx.shadowBlur = chest.unlocked ? 20 * pulse : 6;
  ctx.fillStyle = chest.unlocked ? '#a16207' : '#334155';
  ctx.fillRect(chest.x - 20, chest.y - 16, 40, 28);
  ctx.fillStyle = chest.unlocked ? '#fde68a' : '#94a3b8';
  ctx.fillRect(chest.x - 20, chest.y - 16, 40, 7);
  ctx.fillRect(chest.x - 3, chest.y - 5, 6, 10);
  ctx.font = '9px monospace';
  ctx.fillText(chest.opened ? 'SECURED' : chest.unlocked ? 'OPEN' : 'LOCKED', chest.x - 28, chest.y + 30);
  ctx.restore();
}

/** Faint perimeter walls around a dungeon room so the player knows the boundary. */
function drawDungeonRoomBorder(ctx: CanvasRenderingContext2D, w: World) {
  const e = w.endless;
  if (!e || !e.inDungeon) return;

  const hw = e.dungeonBounds.w / 2;
  const hh = e.dungeonBounds.h / 2;
  const cx = e.dungeonCenterX;
  const cy = e.dungeonCenterY;

  const ground = effectiveGround(w);

  ctx.save();
  ctx.strokeStyle = ground.seam;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.7;
  ctx.strokeRect(cx - hw, cy - hh, e.dungeonBounds.w, e.dungeonBounds.h);

  ctx.strokeStyle = ground.glow;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.25;
  ctx.strokeRect(cx - hw + 6, cy - hh + 6, e.dungeonBounds.w - 12, e.dungeonBounds.h - 12);

  ctx.restore();
}

const OBSTACLE_COLORS: Record<ObstacleDef['kind'], { top: string; side: string; trim: string }> = {
  'map-prop': { top: '#579d9c', side: '#244960', trim: '#b6fbef' },
  dumpster: { top: '#2f5d4a', side: '#1c3a2e', trim: '#48876c' },
  car: { top: '#57324a', side: '#331d2c', trim: '#8a4f74' },
  crate: { top: '#6b4a2c', side: '#3f2b19', trim: '#94693e' },
  planter: { top: '#3a4a2c', side: '#232d1a', trim: '#5c7444' },
  barrier: { top: '#5a5a62', side: '#33333a', trim: '#8b8b96' },
  'ac-unit': { top: '#4a5560', side: '#2b323a', trim: '#6f7d8c' },
  'neon-sign': { top: '#193c50', side: '#102632', trim: '#4de1ff' },
  barrel: { top: '#70411f', side: '#3d2414', trim: '#f0760a' },
  'fuse-box': { top: '#275343', side: '#18352b', trim: '#7ef0bd' },
  'street-lamp': { top: '#66512a', side: '#302614', trim: '#ffd166' },
  'car-wreck': { top: '#493a4d', side: '#29232d', trim: '#a77aa8' },
  'crate-breakable': { top: '#6b4a2c', side: '#3f2b19', trim: '#d69b5d' },
  'security-camera': { top: '#3e4650', side: '#252a31', trim: '#ff7ab8' },
  cover: { top: '#5f4b35', side: '#33281e', trim: '#fbbf24' },
  'reflective-surface': { top: '#263e5b', side: '#142438', trim: '#d8b4fe' },
  flora: { top: '#244b32', side: '#142a1d', trim: '#54b96e' },
  building: { top: '#303344', side: '#171923', trim: '#70769a' },
  river: { top: '#123b58', side: '#0a2030', trim: '#4de1ff' },
  'metal-box': { top: '#536273', side: '#2d3745', trim: '#cbd5e1' },
  bench: { top: '#70543a', side: '#3b2c20', trim: '#c58b5d' },
  pothole: { top: '#17131a', side: '#0a080d', trim: '#ef4444' },
  'trash-can': { top: '#3a4a3f', side: '#20291f', trim: '#7fae8f' },
  mailbox: { top: '#1c3f66', side: '#0f2440', trim: '#4d8bd6' },
  'fire-hydrant': { top: '#8c1f1f', side: '#4a0f0f', trim: '#ffb3b3' },
  'parking-meter': { top: '#4a4a52', side: '#28282e', trim: '#c9c9d2' },
  'attack-block': { top: '#3a1620', side: '#1e0b11', trim: '#ff5c5c' },
  'server-rack': { top: '#0e1b26', side: '#081119', trim: '#1fe6ff' },
  'tree-digital': { top: '#064e3b', side: '#022c22', trim: '#10b981' },
  'tree-fake': { top: '#083344', side: '#051b24', trim: '#06b6d4' },
  skyscraper: { top: '#1e293b', side: '#0f172a', trim: '#38bdf8' },
  'transformer-station': { top: '#334155', side: '#1e293b', trim: '#eab308' },
  'skyline-bridge': { top: '#1e293b', side: '#0f172a', trim: '#06b6d4' },
  'beacon-tower': { top: '#3b0764', side: '#2e1065', trim: '#ec4899' },
  'security-gate': { top: '#451a03', side: '#291003', trim: '#f97316' },
  'bunker-hatch': { top: '#1c1917', side: '#0c0a09', trim: '#a8a29e' },
  'data-pipe': { top: '#12372f', side: '#071d19', trim: '#86efac' },
  'digi-arch': { top: '#12324a', side: '#071923', trim: '#22d3ee' },
  'pressure-door': { top: '#374151', side: '#171f2b', trim: '#facc15' },
  /** Never drawn by the page overlay (the live page is the visual); present so the table stays exhaustive. */
  'page-block': { top: '#4b5563', side: '#1f2937', trim: '#9ca3af' },
};

const FLUID_FILL_COLORS: Record<FluidKind, { base: string; rim: string; glow: string }> = {
  water: { base: '#1f6f9e', rim: '#3fb6ff', glow: '#dff6ff' },
  oil: { base: '#17141c', rim: '#3d3550', glow: '#6d5f8a' },
  'burning-oil': { base: '#3a1408', rim: '#ff6b35', glow: '#ffd166' },
  coolant: { base: '#8fd0e8', rim: '#bfe9ff', glow: '#eaf9ff' },
  runoff: { base: '#5a6a1a', rim: '#6b7a1f', glow: '#b6ff2e' },
  'fire-storm': { base: '#4a1206', rim: '#ff7a3d', glow: '#ffcf7a' },
  'acid-storm': { base: '#33430f', rim: '#b8ff5c', glow: '#e9ffb0' },
  frost: { base: '#274a56', rim: '#bfe9ff', glow: '#eaffff' },
};

function drawFluids(ctx: CanvasRenderingContext2D, w: World) {
  for (const tile of w.fluids) {
    const colors = FLUID_FILL_COLORS[tile.kind];
    // Hold near-full alpha, only fade during the final third of the tile's life.
    const remaining = (tile.expiresAt - w.now) / Math.max(1, tile.expiresAt - tile.spawnedAt);
    const fadeAlpha = clamp(remaining * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.55 * fadeAlpha;
    ctx.fillStyle = colors.base;
    ctx.beginPath();
    ctx.ellipse(tile.x, tile.y + 4, tile.radius, tile.radius * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.35 * fadeAlpha;
    ctx.strokeStyle = colors.rim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(tile.x, tile.y + 4, tile.radius * 0.92, tile.radius * 0.57, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (
      tile.kind === 'burning-oil' || tile.kind === 'coolant' || tile.kind === 'runoff' ||
      tile.kind === 'fire-storm' || tile.kind === 'acid-storm' || tile.kind === 'frost'
    ) {
      const pulse = 0.5 + Math.sin(w.now / 140 + tile.uid) * 0.3;
      ctx.globalAlpha = pulse * 0.4 * fadeAlpha;
      ctx.fillStyle = colors.glow;
      ctx.beginPath();
      ctx.ellipse(tile.x, tile.y + 4, tile.radius * 0.4, tile.radius * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Electrified water: a jittered arc from a connected puddle to any live street-lamp hazard.
  const activeLamps = w.breakables.filter(
    (b) => b.kind === 'street-lamp' && b.broken && b.hazardUntil && w.now < b.hazardUntil,
  );
  for (const tile of w.fluids) {
    if (tile.kind !== 'water') continue;
    for (const lamp of activeLamps) {
      if (Math.hypot(tile.x - lamp.x, tile.y - lamp.y) > 92 + tile.radius) continue;
      ctx.save();
      const pulse = 0.65 + Math.sin(w.now / 85) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#8be9ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lamp.x, lamp.y);
      const midX = (lamp.x + tile.x) / 2 + Math.sin(w.now / 40) * 6;
      const midY = (lamp.y + tile.y) / 2 + Math.cos(w.now / 46) * 6;
      ctx.lineTo(midX, midY);
      ctx.lineTo(tile.x, tile.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawPotholes(ctx: CanvasRenderingContext2D, w: World) {
  for (const pothole of w.potholes) {
    const progress = pothole.state === 'opening'
      ? clamp((w.now - pothole.openingStartedAt) / pothole.openingMs, 0, 1)
      : pothole.state === 'open' || pothole.state === 'resolved' ? 1 : 0;
    const pulse = 0.72 + Math.sin(w.now / 90) * 0.2;
    const x = pothole.x;
    const y = pothole.y;
    ctx.save();
    ctx.globalAlpha = pothole.state === 'dormant' ? 0.5 : 0.88;
    ctx.fillStyle = pothole.state === 'open' ? '#050308' : '#17131a';
    ctx.beginPath();
    ctx.ellipse(x, y + 6, pothole.w * (0.42 + progress * 0.08), pothole.h * (0.28 + progress * 0.08), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pothole.state === 'dormant' ? '#5b4050' : '#ef4444';
    ctx.lineWidth = pothole.state === 'opening' ? 3 : 2;
    if (pothole.state === 'opening') {
      ctx.globalAlpha = 0.6 + progress * 0.35;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -w.now / 18;
    }
    ctx.beginPath();
    ctx.ellipse(x, y + 5, pothole.w * (0.46 + progress * 0.1), pothole.h * (0.31 + progress * 0.09), 0, 0, Math.PI * 2);
    ctx.stroke();
    if (pothole.state === 'open') {
      ctx.globalAlpha = pulse * 0.42;
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 5, pothole.w * 0.58, pothole.h * 0.44, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('KEEP CLEAR', x, y - pothole.h * 0.42);
    } else if (pothole.state === 'opening') {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MOVE', x, y - pothole.h * 0.42);
    }
    ctx.restore();
  }
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  w: World,
  viewBounds: { left: number; top: number; right: number; bottom: number },
) {
  const height = 16;
  const margin = 80;
  // Draw the live prop records so streamed chunks and moving props share the
  // same authored silhouette and profile. Culled to the camera viewport --
  // endless mode can have a full 5x5 chunk window's worth of breakables
  // loaded at once, and this ran unfiltered every frame before.
  const obstacleList: Array<{ x: number; y: number; w: number; h: number; kind: ObstacleDef['kind']; artAssetId?: string; damage?: number }> = [];
  const closedBuildings = w.endless?.buildingEntryStyle === 'seamless' && !w.endless.inDungeon
    ? w.endless.buildings.filter((building) =>
        building.id !== w.endless!.walkInBuildingId &&
        building.x + building.w / 2 >= viewBounds.left - margin &&
        building.x - building.w / 2 <= viewBounds.right + margin &&
        building.y + building.h / 2 >= viewBounds.top - margin &&
        building.y - building.h / 2 <= viewBounds.bottom + margin,
      )
    : [];
  for (const o of w.breakables) {
    if (o.broken && o.kind !== 'map-prop') continue;
    if (o.x < viewBounds.left - margin || o.x > viewBounds.right + margin
      || o.y < viewBounds.top - margin || o.y > viewBounds.bottom + margin) continue;
    if (closedBuildings.some((building) =>
        Math.abs(o.x - building.x) < building.w / 2 - 12 &&
        Math.abs(o.y - building.y) < building.h / 2 - 12,
      )) continue;
    obstacleList.push({ x: o.x, y: o.y, w: o.w, h: o.h, kind: o.kind, artAssetId: o.artAssetId, damage: o.broken ? 1 : Number.isFinite(o.maxHp) ? 1 - o.hp / o.maxHp : 0 });
  }
  for (const o of w.area.decorations ?? []) {
    if (o.x < viewBounds.left - margin || o.x > viewBounds.right + margin || o.y < viewBounds.top - margin || o.y > viewBounds.bottom + margin) continue;
    obstacleList.push(o);
  }

  const worldTint = w.musicColorOverride ?? (w.worldColorFullRecolor ? w.worldColorPalette : undefined);
  for (const obstacle of obstacleList) {
    if (obstacle.kind === 'map-prop' && obstacle.artAssetId) {
      drawMapPackProp(ctx, obstacle.artAssetId, obstacle.x, obstacle.y, obstacle.w, obstacle.h, w.now, obstacle.damage);
      continue;
    }
    const baseColors = OBSTACLE_COLORS[obstacle.kind] ?? OBSTACLE_COLORS.crate;
    const colors = worldTint
      ? { top: mixHex(baseColors.top, worldTint.accent, 0.25), side: mixHex(baseColors.side, worldTint.bodyDark, 0.25), trim: mixHex(baseColors.trim, worldTint.accentBright, 0.3) }
      : baseColors;
    const x = obstacle.x - obstacle.w / 2;
    const y = obstacle.y - obstacle.h / 2;

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 10, y + obstacle.h + 10, obstacle.w, Math.max(5, obstacle.h * 0.18));
    ctx.globalAlpha = 1;

    ctx.fillStyle = colors.side;
    ctx.fillRect(x, y - height + obstacle.h, obstacle.w, height);
    ctx.fillStyle = colors.top;
    ctx.fillRect(x, y - height, obstacle.w, obstacle.h);
    ctx.strokeStyle = colors.trim;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y - height + 1, obstacle.w - 2, obstacle.h - 2);

    // Combat props get a strong, readable symbol in addition to their silhouette.
    if (obstacle.kind === 'cover') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + obstacle.w * 0.18, y - height + obstacle.h * 0.65);
      ctx.lineTo(x + obstacle.w * 0.38, y - height + obstacle.h * 0.28);
      ctx.lineTo(x + obstacle.w * 0.62, y - height + obstacle.h * 0.65);
      ctx.lineTo(x + obstacle.w * 0.82, y - height + obstacle.h * 0.28);
      ctx.stroke();
      ctx.restore();
    } else if (obstacle.kind === 'reflective-surface') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#f5e8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + obstacle.w * 0.2, y - height + obstacle.h * 0.75);
      ctx.lineTo(x + obstacle.w * 0.5, y - height + obstacle.h * 0.2);
      ctx.lineTo(x + obstacle.w * 0.8, y - height + obstacle.h * 0.75);
      ctx.stroke();
      ctx.restore();
    } else if (obstacle.kind === 'flora') {
      ctx.save();
      ctx.fillStyle = '#18321f';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(obstacle.x - 3, y - height + obstacle.h * 0.55, 6, obstacle.h * 0.45);
      ctx.fillStyle = '#4fbd68';
      for (let i = 0; i < 5; i += 1) {
        const leafX = obstacle.x + Math.sin(i * 2.7) * obstacle.w * 0.35;
        const leafY = y - height + obstacle.h * (0.2 + i * 0.13);
        ctx.beginPath();
        ctx.ellipse(leafX, leafY, obstacle.w * 0.28, obstacle.h * 0.13, i % 2 ? 0.45 : -0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (obstacle.kind === 'barrier') {
      // Add a curb and repeating reflectors so long cover reads as a street
      // object instead of another arena wall.
      ctx.save();
      ctx.fillStyle = colors.trim;
      ctx.globalAlpha = 0.75;
      for (let marker = x + 12; marker < x + obstacle.w - 6; marker += 24) {
        ctx.fillRect(marker, y - height + obstacle.h * 0.35, 8, 3);
      }
      ctx.restore();
    } else if (obstacle.kind === 'car' || obstacle.kind === 'car-wreck') {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#d8b4fe';
      ctx.fillRect(x + obstacle.w * 0.18, y - height + obstacle.h * 0.22, obstacle.w * 0.64, 5);
      ctx.fillStyle = '#11121a';
      ctx.fillRect(x + obstacle.w * 0.16, y - height + obstacle.h * 0.7, 12, 5);
      ctx.fillRect(x + obstacle.w * 0.72, y - height + obstacle.h * 0.7, 12, 5);
      ctx.restore();
    } else if (obstacle.kind === 'trash-can') {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = colors.trim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(obstacle.x, y - height + obstacle.h * 0.16, obstacle.w * 0.42, obstacle.h * 0.1, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#3f2b19';
      ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(obstacle.x + i * obstacle.w * 0.18, y - height + obstacle.h * 0.05);
        ctx.lineTo(obstacle.x + i * obstacle.w * 0.24, y - height - obstacle.h * 0.14);
        ctx.stroke();
      }
      ctx.restore();
    } else if (obstacle.kind === 'mailbox') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = colors.trim;
      ctx.fillRect(x + obstacle.w * 0.6, y - height + obstacle.h * 0.1, obstacle.w * 0.32, obstacle.h * 0.16);
      ctx.strokeStyle = '#0f2440';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + obstacle.w * 0.18, y - height + obstacle.h * 0.45, obstacle.w * 0.64, 2);
      ctx.restore();
    } else if (obstacle.kind === 'fire-hydrant') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = colors.trim;
      ctx.fillRect(x - 3, y - height + obstacle.h * 0.42, 5, 5);
      ctx.fillRect(x + obstacle.w - 2, y - height + obstacle.h * 0.42, 5, 5);
      ctx.beginPath();
      ctx.arc(obstacle.x, y - height + obstacle.h * 0.16, obstacle.w * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (obstacle.kind === 'parking-meter') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = colors.trim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(obstacle.x, y - height + obstacle.h * 0.22, obstacle.w * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#28282e';
      ctx.fillRect(obstacle.x - 1, y - height + obstacle.h * 0.16, 2, obstacle.h * 0.12);
      ctx.restore();
    } else if (obstacle.kind === 'tree-digital') {
      ctx.save();
      const isCentralTree = obstacle.w >= 100 || (Math.abs(obstacle.x) < 5 && Math.abs(obstacle.y) < 5);
      if (isCentralTree) {
        // Massive Central Living Digital Tree: Yggdrasil Null
        const trunkW = obstacle.w * 0.44;
        const trunkH = obstacle.h * 1.15;
        const treeTopY = y - height - obstacle.h * 0.95;

        // Glowing root network on ground radiating outwards
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = 0.85;
        for (let r = 0; r < 8; r += 1) {
          const rootAngle = (r * Math.PI) / 4 + Math.sin(w.now * 0.001) * 0.05;
          const rDist = obstacle.w * 0.9;
          ctx.beginPath();
          ctx.moveTo(obstacle.x, y);
          const midX = obstacle.x + Math.cos(rootAngle) * (rDist * 0.5);
          const midY = y + Math.sin(rootAngle) * (rDist * 0.5) * 0.55;
          const endX = obstacle.x + Math.cos(rootAngle) * rDist;
          const endY = y + Math.sin(rootAngle) * rDist * 0.55;
          ctx.quadraticCurveTo(midX + Math.sin(r) * 12, midY, endX, endY);
          ctx.stroke();
        }

        // Carbon trunk
        ctx.fillStyle = '#0f1f18';
        ctx.globalAlpha = 0.98;
        ctx.fillRect(obstacle.x - trunkW / 2, y - trunkH, trunkW, trunkH);

        // Vertical emerald circuit veins on trunk
        ctx.fillStyle = '#34d399';
        ctx.globalAlpha = 0.8 + Math.sin(w.now * 0.003) * 0.2;
        for (let v = -2; v <= 2; v += 1) {
          ctx.fillRect(obstacle.x + v * (trunkW * 0.18) - 1.5, y - trunkH + 4, 3, trunkH - 8);
        }

        // Sprawling digital foliage canopy
        const canopyW = obstacle.w * 1.85;
        const canopyH = obstacle.h * 1.55;
        const pulse = 0.9 + Math.sin(w.now * 0.002) * 0.1;
        ctx.globalAlpha = 0.95;

        // Canopy shadow & dark underlayer
        ctx.fillStyle = '#022c22';
        ctx.beginPath();
        ctx.ellipse(obstacle.x, treeTopY + 18, canopyW * 0.52, canopyH * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();

        // Layered emerald pixel foliage clusters
        ctx.fillStyle = '#047857';
        for (let c = 0; c < 9; c += 1) {
          const cx = obstacle.x + Math.cos(c * 0.72) * (canopyW * 0.3);
          const cy = treeTopY + Math.sin(c * 0.72) * (canopyH * 0.25);
          ctx.beginPath();
          ctx.ellipse(cx, cy, canopyW * 0.28, canopyH * 0.24, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bright neon circuit foliage highlights
        ctx.fillStyle = '#10b981';
        ctx.globalAlpha = pulse;
        for (let c = 0; c < 6; c += 1) {
          const cx = obstacle.x + Math.sin(c * 1.2) * (canopyW * 0.2);
          const cy = treeTopY - 10 + Math.cos(c * 1.2) * (canopyH * 0.18);
          ctx.beginPath();
          ctx.ellipse(cx, cy, canopyW * 0.18, canopyH * 0.15, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Floating digital data leaves orbiting crown
        ctx.fillStyle = '#6ee7b7';
        for (let l = 0; l < 6; l += 1) {
          const orbitAngle = (w.now * 0.0015 + l * 1.05) % (Math.PI * 2);
          const lx = obstacle.x + Math.cos(orbitAngle) * (canopyW * 0.48);
          const ly = treeTopY + Math.sin(orbitAngle) * (canopyH * 0.28);
          ctx.fillRect(lx - 3, ly - 3, 6, 6);
        }
      } else {
        // Standard Cybernetic Tree
        const trunkW = obstacle.w * 0.32;
        const trunkH = obstacle.h * 0.85;
        const treeTopY = y - height - obstacle.h * 0.4;

        ctx.fillStyle = '#0a1d15';
        ctx.fillRect(obstacle.x - trunkW / 2, y - trunkH, trunkW, trunkH);

        // Circuit line
        ctx.fillStyle = '#10b981';
        ctx.globalAlpha = 0.8;
        ctx.fillRect(obstacle.x - 1, y - trunkH + 2, 2, trunkH - 4);

        // Foliage layers
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.ellipse(obstacle.x, treeTopY, obstacle.w * 0.65, obstacle.h * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#10b981';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(obstacle.x, treeTopY - 6, obstacle.w * 0.42, obstacle.h * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (obstacle.kind === 'tree-fake') {
      // Holographic Decoy Tree: translucent, cyan/teal flickering scanlines
      ctx.save();
      const flicker = 0.48 + Math.sin(w.now * 0.012 + obstacle.x) * 0.2;
      ctx.globalAlpha = flicker;

      // Base projector pedestal
      ctx.fillStyle = '#083344';
      ctx.fillRect(obstacle.x - 9, y - 4, 18, 6);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(obstacle.x - 6, y - 3, 12, 2);

      // Holographic trunk
      const trunkW = obstacle.w * 0.26;
      const trunkH = obstacle.h * 0.8;
      const treeTopY = y - height - obstacle.h * 0.35;

      ctx.fillStyle = '#0891b2';
      ctx.fillRect(obstacle.x - trunkW / 2, y - trunkH, trunkW, trunkH);

      // Hologram canopy outline & fill
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.ellipse(obstacle.x, treeTopY, obstacle.w * 0.6, obstacle.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // CRT horizontal holographic scanlines
      ctx.fillStyle = '#a5f3fc';
      for (let s = y - height - obstacle.h * 0.8; s < y; s += 5) {
        ctx.fillRect(obstacle.x - obstacle.w * 0.55, s, obstacle.w * 1.1, 1.5);
      }

      // Glitch tear offset
      if (Math.sin(w.now * 0.005 + obstacle.y) > 0.75) {
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(obstacle.x - obstacle.w * 0.4, treeTopY, obstacle.w * 0.8, 3);
      }
      ctx.restore();
    } else if (obstacle.kind === 'skyscraper') {
      ctx.save();
      // Multi-story corporate skyscraper facade with glowing window matrix & rooftop spire
      const roofY = y - height;
      // Window matrix on side facade
      const rows = Math.max(2, Math.floor(height / 14));
      const cols = Math.max(3, Math.floor(obstacle.w / 16));
      const cellW = (obstacle.w - 12) / cols;
      const cellH = (height - 10) / rows;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const winX = x + 6 + c * cellW;
          const winY = roofY + 6 + r * cellH;
          const litSeed = Math.sin((obstacle.x + c * 17) * 12.9898 + (obstacle.y + r * 13) * 78.233);
          if (litSeed > -0.1) {
            ctx.fillStyle = litSeed > 0.5 ? '#38bdf8' : litSeed > 0.2 ? '#fef08a' : '#0284c7';
            ctx.globalAlpha = 0.75 + Math.sin(w.now * 0.002 + litSeed * 10) * 0.2;
            ctx.fillRect(winX, winY, cellW - 4, cellH - 4);
          }
        }
      }
      // Rooftop parapet trim & elevator penthouse
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + obstacle.w * 0.35, roofY - 14, obstacle.w * 0.3, 14);
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(x + obstacle.w * 0.35 + 3, roofY - 10, obstacle.w * 0.3 - 6, 2);
      // Warning antenna spire
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(obstacle.x, roofY - 14);
      ctx.lineTo(obstacle.x, roofY - 32);
      ctx.stroke();
      // Blinking red aircraft collision beacon
      const beaconLit = Math.sin(w.now * 0.006 + obstacle.x) > 0;
      ctx.fillStyle = beaconLit ? '#ef4444' : '#450a0a';
      ctx.beginPath();
      ctx.arc(obstacle.x, roofY - 33, beaconLit ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (obstacle.kind === 'transformer-station') {
      ctx.save();
      const roofY = y - height;
      // High-voltage warning hazard stripes on face
      ctx.fillStyle = '#eab308';
      ctx.fillRect(x + 4, roofY + 4, obstacle.w - 8, 5);
      ctx.fillStyle = '#000000';
      for (let s = x + 4; s < x + obstacle.w - 8; s += 10) {
        ctx.beginPath();
        ctx.moveTo(s, roofY + 4);
        ctx.lineTo(s + 5, roofY + 9);
        ctx.lineTo(s + 3, roofY + 9);
        ctx.lineTo(s - 2, roofY + 4);
        ctx.fill();
      }
      // Twin porcelain insulator coils atop unit
      const coilCount = Math.max(2, Math.floor(obstacle.w / 28));
      for (let i = 0; i < coilCount; i += 1) {
        const cx = x + (i + 0.5) * (obstacle.w / coilCount);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(cx - 4, roofY - 12, 8, 12);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(cx - 6, roofY - 8, 12, 2);
        ctx.fillRect(cx - 6, roofY - 4, 12, 2);
        // Intermittent electric spark discharge
        if (Math.sin(w.now * 0.015 + i * 3 + obstacle.x) > 0.85) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, roofY - 12);
          ctx.lineTo(cx + (Math.random() - 0.5) * 14, roofY - 20 - Math.random() * 8);
          ctx.stroke();
        }
      }
      ctx.restore();
    } else if (obstacle.kind === 'skyline-bridge') {
      ctx.save();
      const roofY = y - height;
      // Illuminated turquoise walkway floor strip
      ctx.fillStyle = '#06b6d4';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + 2, roofY + obstacle.h * 0.4, obstacle.w - 4, 3);
      // Steel suspension trusses & glass canopy balustrade
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      for (let tx = x; tx <= x + obstacle.w; tx += 20) {
        ctx.moveTo(tx, roofY + obstacle.h * 0.4);
        ctx.lineTo(tx + 10, roofY);
        ctx.lineTo(tx + 20, roofY + obstacle.h * 0.4);
      }
      ctx.stroke();
      ctx.restore();
    } else if (obstacle.kind === 'beacon-tower') {
      ctx.save();
      const roofY = y - height;
      // Communication lattice mast
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.strokeRect(obstacle.x - 6, roofY - 26, 12, 26);
      ctx.beginPath();
      ctx.moveTo(obstacle.x - 6, roofY);
      ctx.lineTo(obstacle.x + 6, roofY - 26);
      ctx.moveTo(obstacle.x + 6, roofY);
      ctx.lineTo(obstacle.x - 6, roofY - 26);
      ctx.stroke();
      // Concentric radio signal pulses expanding outward
      const pulsePhase = (w.now * 0.003 + obstacle.y) % 1;
      ctx.strokeStyle = '#ec4899';
      ctx.globalAlpha = (1 - pulsePhase) * 0.8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(obstacle.x, roofY - 28, 6 + pulsePhase * 24, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
      ctx.restore();
    } else if (obstacle.kind === 'security-gate') {
      ctx.save();
      const roofY = y - height;
      // Twin armored biometric stanchions
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x, roofY, 8, obstacle.h);
      ctx.fillRect(x + obstacle.w - 8, roofY, 8, obstacle.h);
      // Laser security tripwire beam
      const laserGlow = 0.6 + Math.sin(w.now * 0.008) * 0.3;
      ctx.globalAlpha = laserGlow;
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(x + 8, roofY + obstacle.h * 0.45, obstacle.w - 16, 2.5);
      // Biometric status LED
      ctx.fillStyle = Math.sin(w.now * 0.004) > 0 ? '#22c55e' : '#ef4444';
      ctx.beginPath();
      ctx.arc(x + 4, roofY + 6, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (obstacle.kind === 'bunker-hatch') {
      ctx.save();
      // Subterranean blast door flush with asphalt
      const cx = obstacle.x;
      const cy = y - height * 0.5;
      const r = Math.min(obstacle.w, obstacle.h) * 0.44;
      // Bolted steel perimeter ring
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Inner hatch plate
      ctx.fillStyle = '#44403c';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      // Hydraulic locking spokes
      ctx.strokeStyle = '#a8a29e';
      ctx.lineWidth = 2.5;
      for (let a = 0; a < 4; a += 1) {
        const ang = (a * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * (r * 0.7), cy + Math.sin(ang) * (r * 0.7));
        ctx.stroke();
      }
      // Status indicator light
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const live = w.breakables.find((b) => Math.abs(b.x - obstacle.x) < 1 && Math.abs(b.y - obstacle.y) < 1);
    if (live && live.rawDataBreakage > 0.025) {
      ctx.save();
      const severity = live.rawDataBreakage;
      const blocks = Math.max(1, Math.ceil(severity * 7));
      ctx.globalAlpha = 0.22 + severity * 0.55;
      ctx.fillStyle = severity > 0.65 ? '#facc15' : '#86efac';
      for (let i = 0; i < blocks; i += 1) {
        const rx = hashCell(live.uid, i * 13) * Math.max(4, obstacle.w - 8);
        const ry = hashCell(live.uid + 31, i * 17) * Math.max(4, obstacle.h - 8);
        const size = 3 + Math.floor(hashCell(live.uid + 67, i * 19) * 6);
        ctx.fillRect(x + 4 + rx, y - height + 4 + ry, size, size);
      }
      if (severity > 0.72) {
        ctx.globalAlpha = 0.8;
        ctx.font = 'bold 8px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('RAW DATA', obstacle.x, y - height - 5);
      }
      ctx.restore();
    }
    if (live?.chainActive && !live.landedHeatActive) {
      ctx.save();
      const speed = Math.hypot(live.vx, live.vy);
      const pulse = 0.62 + Math.sin(w.now / 92) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.shadowColor = '#ffb347';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(x - 4, y - height - 4, obstacle.w + 8, obstacle.h + 8);
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        live.chainCycles > 0 ? `CHAIN ${Math.min(3, live.chainCycles)}/3` : speed > 0 ? 'CHAIN LIVE' : 'CHAIN READY',
        obstacle.x,
        y - height - 9,
      );
      ctx.restore();
    }
    if (live?.landedHeatActive) {
      ctx.save();
      const pulse = 0.65 + Math.sin(w.now / 105) * 0.25;
      ctx.globalAlpha = pulse;
      ctx.shadowColor = '#ff4d5e';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ff4d5e';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 5, y - height - 5, obstacle.w + 10, obstacle.h + 10);
      ctx.fillStyle = '#ff4d5e';
      ctx.globalAlpha = 0.28 + pulse * 0.18;
      ctx.fillRect(x, y - height, obstacle.w, obstacle.h);
      ctx.restore();
    }
    if (live?.clickPrimed) {
      ctx.save();
      const pulse = 0.7 + Math.sin(w.now / 120) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x - 5, y - height - 5, obstacle.w + 10, obstacle.h + 10);
      ctx.setLineDash([]);
      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NEXT HIT REVERSES', obstacle.x, y - height - 10);
      ctx.restore();
    }
    if (live && !live.broken && live.hp <= live.maxHp * 0.5) {
      ctx.save();
      ctx.strokeStyle = live.kind === 'barrel' ? '#ffb347' : '#f5d7a1';
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + obstacle.w * 0.25, y - height + 5);
      ctx.lineTo(x + obstacle.w * 0.48, y - height + obstacle.h * 0.6);
      ctx.lineTo(x + obstacle.w * 0.7, y - height + obstacle.h * 0.25);
      ctx.stroke();
      ctx.restore();
    } else if (obstacle.kind === 'metal-box') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 7, y - height + 7, obstacle.w - 14, obstacle.h - 14);
      ctx.beginPath();
      ctx.moveTo(x + obstacle.w * 0.2, y - height + obstacle.h * 0.2);
      ctx.lineTo(x + obstacle.w * 0.8, y - height + obstacle.h * 0.8);
      ctx.moveTo(x + obstacle.w * 0.8, y - height + obstacle.h * 0.2);
      ctx.lineTo(x + obstacle.w * 0.2, y - height + obstacle.h * 0.8);
      ctx.stroke();
      ctx.restore();
    } else if (obstacle.kind === 'bench') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#e2b07a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + obstacle.w * 0.12, y - height + obstacle.h * 0.32);
      ctx.lineTo(x + obstacle.w * 0.88, y - height + obstacle.h * 0.32);
      ctx.moveTo(x + obstacle.w * 0.2, y - height + obstacle.h * 0.75);
      ctx.lineTo(x + obstacle.w * 0.8, y - height + obstacle.h * 0.75);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawObjectLighting(ctx: CanvasRenderingContext2D, w: World) {
  for (const prop of w.breakables) {
    if (prop.broken || !prop.chainActive || prop.landedHeatActive || (!prop.vx && !prop.vy)) continue;
    const speed = Math.hypot(prop.vx, prop.vy);
    const pulse = 0.4 + Math.sin(w.now / 92) * 0.12;
    const radius = Math.max(prop.w, prop.h) * 0.62 + clamp(speed / 60, 0, 1) * 12;
    const gradient = ctx.createRadialGradient(prop.x, prop.y, 3, prop.x, prop.y, radius);
    gradient.addColorStop(0, '#ffb34738');
    gradient.addColorStop(0.55, '#ff7a1820');
    gradient.addColorStop(1, '#ff2d5500');
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const prop of w.breakables) {
    if (prop.broken || !prop.landedHeatActive) continue;
    const pulse = 0.65 + Math.sin(w.now / 105) * 0.25;
    const radius = LANDED_HEAT_RADIUS + Math.sin(w.now / 72) * 10;
    const gradient = ctx.createRadialGradient(prop.x, prop.y, 5, prop.x, prop.y, radius);
    gradient.addColorStop(0, '#ff4d5e66');
    gradient.addColorStop(0.48, '#ff7a1830');
    gradient.addColorStop(1, '#ff2d5500');
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff4d5e';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, radius * (0.78 + pulse * 0.12), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  for (const pole of w.breakables) {
    if (pole.kind !== 'street-lamp' || !pole.broken || !pole.hazardUntil || pole.hazardUntil <= w.now) continue;
    const radius = 92;
    const pulse = 0.65 + Math.sin(w.now / 85) * 0.2;
    const gradient = ctx.createRadialGradient(pole.x, pole.y, 4, pole.x, pole.y, radius);
    gradient.addColorStop(0, '#ffe66d88');
    gradient.addColorStop(0.55, '#8be9fd35');
    gradient.addColorStop(1, '#8be9fd00');
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pole.x, pole.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d9f7ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.stroke();
    ctx.restore();
  }
  if (w.now < w.ultActiveUntil) {
    const radius = 160;
    const g = ctx.createRadialGradient(w.player.x, w.player.y, 8, w.player.x, w.player.y, radius);
    g.addColorStop(0, `${w.character.palette.glow}1f`); g.addColorStop(1, `${w.character.palette.glow}00`);
    ctx.fillStyle = g; ctx.fillRect(w.player.x - radius, w.player.y - radius, radius * 2, radius * 2);
  }
  for (const enemy of w.enemies) {
    if (enemy.dying || enemy.defId !== 'ash-wisp') continue;
    if (Math.abs(enemy.x - w.camera.x) > 760 || Math.abs(enemy.y - w.camera.y) > 760) continue;
    const r = 52;
    const g = ctx.createRadialGradient(enemy.x, enemy.y, 2, enemy.x, enemy.y, r);
    g.addColorStop(0, '#ff4de155'); g.addColorStop(1, '#ff4de100');
    ctx.fillStyle = g; ctx.fillRect(enemy.x - r, enemy.y - r, r * 2, r * 2);
  }
  for (const boss of w.enemies.filter((e) => !e.dying && e.def.family === 'Boss' && w.now - e.animStartedAt < 1200
    && Math.abs(e.x - w.camera.x) <= 760 && Math.abs(e.y - w.camera.y) <= 760)) {
    const fade = 1 - (w.now - boss.animStartedAt) / 1200;
    ctx.save(); ctx.globalAlpha = Math.max(0, fade) * 0.32; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(boss.x - 12, boss.y - 300); ctx.lineTo(boss.x - 70, boss.y + 20); ctx.lineTo(boss.x + 70, boss.y + 20); ctx.lineTo(boss.x + 12, boss.y - 300); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  const sources = w.breakables.filter((b) => !b.broken && ['barrel', 'neon-sign', 'street-lamp', 'fuse-box', 'attack-block', 'server-rack'].includes(b.kind));
  let dynamicCount = 0;
  for (const b of sources) {
    const isBarrel = b.kind === 'barrel';
    const radius = b.kind === 'street-lamp' ? 200 : b.kind === 'barrel' ? 120 + Math.sin(w.now / 80) * 10
      : b.kind === 'neon-sign' ? 90 : b.kind === 'attack-block' ? 100 + Math.sin(w.now / 140) * 18
      : b.kind === 'server-rack' ? 80 : 80;
    const color = b.kind === 'barrel' ? '#f0760a' : b.kind === 'neon-sign' ? '#4de1ff'
      : b.kind === 'fuse-box' ? '#7ef0bd' : b.kind === 'attack-block' ? '#ff5c5c'
      : b.kind === 'server-rack' ? '#1fe6ff' : '#ffd166';
    const pulse = b.kind === 'neon-sign' ? neonFlicker(w.now, b.uid) : 1;
    const gradient = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, radius);
    gradient.addColorStop(0, `${color}55`);
    gradient.addColorStop(0.45, `${color}20`);
    gradient.addColorStop(1, `${color}00`);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = gradient;
    ctx.fillRect(b.x - radius, b.y - radius, radius * 2, radius * 2);
    if (b.kind === 'fuse-box') {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = color;
      ctx.fillRect(b.x - b.w * 0.8, b.y + b.h / 2, b.w * 1.6, 10);
    }
    ctx.restore();

    if (dynamicCount++ < 3 && isBarrel) {
      for (const actor of [w.player, ...w.enemies].slice(0, 45)) {
        if (Math.hypot(actor.x - b.x, actor.y - b.y) > radius) continue;
        const dx = actor.x - b.x; const dy = actor.y - b.y; const len = Math.hypot(dx, dy) || 1;
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(actor.x + (dx / len) * 12, actor.y + (dy / len) * 12, actor.radius * 1.3, 4, Math.atan2(dy, dx), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  // Rebuild hard-edged occlusion every frame. The two rear-most corners of
  // each nearby obstacle are projected away from the moving light source, so
  // shadows rotate, stretch, and vanish immediately when a breakable breaks.
  const shadowSources = sources.slice(0, 5);
  const shadowObjects = w.breakables.filter((b) => !b.broken && !['barrel', 'neon-sign', 'street-lamp', 'fuse-box', 'attack-block', 'server-rack'].includes(b.kind));
  for (const source of shadowSources) {
    for (const object of shadowObjects) {
      const distance = Math.hypot(object.x - source.x, object.y - source.y);
      if (distance > 260) continue;
      const corners = [
        { x: object.x - object.w / 2, y: object.y - object.h / 2 },
        { x: object.x + object.w / 2, y: object.y - object.h / 2 },
        { x: object.x + object.w / 2, y: object.y + object.h / 2 },
        { x: object.x - object.w / 2, y: object.y + object.h / 2 },
      ];
      const awayX = (object.x - source.x) / (distance || 1);
      const awayY = (object.y - source.y) / (distance || 1);
      const far = [...corners].sort((a, b) =>
        (b.x * awayX + b.y * awayY) - (a.x * awayX + a.y * awayY),
      ).slice(0, 2);
      const length = Math.min(180, Math.max(55, 300 - distance));
      ctx.save();
      ctx.globalAlpha = 0.56;
      ctx.fillStyle = '#020208';
      ctx.beginPath();
      ctx.moveTo(far[0]!.x, far[0]!.y);
      ctx.lineTo(far[1]!.x, far[1]!.y);
      ctx.lineTo(far[1]!.x + awayX * length, far[1]!.y + awayY * length);
      ctx.lineTo(far[0]!.x + awayX * length, far[0]!.y + awayY * length);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = source.kind === 'neon-sign' ? '#4de1ff' : '#ffd166';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(far[0]!.x, far[0]!.y);
      ctx.lineTo(far[1]!.x, far[1]!.y);
      ctx.stroke();
      ctx.restore();
    }
  }
  // Neon glass keeps a ghost of its sign on the pavement for two seconds.
  for (const b of w.breakables) {
    if (b.kind !== 'neon-sign' || !b.broken || w.now - b.brokenAt >= 2000) continue;
    const fade = 1 - (w.now - b.brokenAt) / 2000;
    ctx.save(); ctx.globalAlpha = fade * 0.3; ctx.fillStyle = '#4de1ff';
    ctx.fillRect(b.x - b.w / 2, b.y + b.h / 2, b.w, 8); ctx.restore();
  }
  // Security cameras sweep a cosmetic cone; it never changes enemy stats.
  for (const b of w.breakables) {
    if (b.broken || b.kind !== 'security-camera') continue;
    const angle = Math.sin(w.now / 900) * 0.75;
    const gradient = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, 170);
    gradient.addColorStop(0, '#ffffff30'); gradient.addColorStop(1, '#ff7ab800');
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(angle); ctx.globalAlpha = 0.22;
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 170, -0.18, 0.18); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  for (const pole of w.breakables) {
    if (pole.kind !== 'street-lamp' || !pole.broken || !pole.hazardUntil || pole.hazardUntil <= w.now) continue;
    const angle = pole.fallAngle ?? Math.PI / 2;
    ctx.save();
    ctx.translate(pole.x, pole.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#302614';
    ctx.fillRect(-4, -pole.h, 8, pole.h);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-10, -pole.h - 4, 20, 8);
    ctx.restore();
  }
}

/**
 * Tier 2 economy: reinforcement beacons. A standing beacon pulses and carries a
 * health bar, because "why did my reinforcements stop" must be answerable at a
 * glance; a broken one leaves a dark stump so the ground still reads as lost.
 */
function drawBeacons(ctx: CanvasRenderingContext2D, w: World) {
  for (const beacon of w.beacons) {
    const half = 22;
    if (beacon.broken) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#2b2b33';
      ctx.fillRect(beacon.x - half, beacon.y - 6, half * 2, 12);
      ctx.restore();
      continue;
    }

    const pulse = 0.5 + 0.5 * Math.sin(w.now / 420);
    ctx.save();
    // Ground glow, so it reads as a place and not just a prop.
    const glow = ctx.createRadialGradient(beacon.x, beacon.y, 4, beacon.x, beacon.y, 90);
    glow.addColorStop(0, `rgba(250, 204, 21, ${0.16 + pulse * 0.1})`);
    glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(beacon.x - 90, beacon.y - 90, 180, 180);

    ctx.fillStyle = w.now < beacon.hitFlashUntil ? '#fff' : '#3f3f18';
    ctx.fillRect(beacon.x - half, beacon.y - 34, half * 2, 44);
    ctx.fillStyle = '#facc15';
    ctx.globalAlpha = 0.6 + pulse * 0.4;
    ctx.fillRect(beacon.x - half + 4, beacon.y - 30, half * 2 - 8, 6);
    ctx.globalAlpha = 1;
    ctx.fillRect(beacon.x - 3, beacon.y - 52, 6, 20);

    // Health bar.
    const ratio = Math.max(0, beacon.hp / beacon.maxHp);
    ctx.fillStyle = '#00000099';
    ctx.fillRect(beacon.x - half, beacon.y + 16, half * 2, 5);
    ctx.fillStyle = ratio > 0.35 ? '#facc15' : '#ff4d5e';
    ctx.fillRect(beacon.x - half, beacon.y + 16, half * 2 * ratio, 5);
    ctx.restore();
  }
}

/**
 * Fog of war. Drawn after the world and the arena edges, so it covers terrain,
 * props and actors alike, and before the screen-space overlays so the HUD stays
 * readable. Cells are painted at grid resolution with a blur, which is what
 * stops a 64-unit grid reading as a checkerboard.
 */
function drawFog(
  ctx: CanvasRenderingContext2D,
  w: World,
  left: number,
  top: number,
  right: number,
  bottom: number,
) {
  const fog = w.fog;
  if (!fog) return;
  const halfW = w.bounds.w / 2;
  const halfH = w.bounds.h / 2;
  const minCol = Math.max(0, Math.floor((left + halfW) / fog.cell));
  const maxCol = Math.min(fog.cols - 1, Math.ceil((right + halfW) / fog.cell));
  const minRow = Math.max(0, Math.floor((top + halfH) / fog.cell));
  const maxRow = Math.min(fog.rows - 1, Math.ceil((bottom + halfH) / fog.cell));

  ctx.save();
  ctx.filter = 'blur(12px)';
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const state = fog.cells[row * fog.cols + col] ?? 0;
      if (state === 2) continue;
      ctx.fillStyle = state === 1 ? 'rgba(4, 6, 12, 0.62)' : 'rgba(3, 4, 9, 0.97)';
      const x = col * fog.cell - halfW;
      const y = row * fog.cell - halfH;
      // Overdraw by a cell edge so the blur has neighbours to blend into.
      ctx.fillRect(x - 1, y - 1, fog.cell + 2, fog.cell + 2);
    }
  }
  ctx.restore();
}

function drawAwarenessArrow(ctx: CanvasRenderingContext2D, w: World) {
  const elite = w.enemies.find((e) => !e.dying && (e.def.family === 'Boss' || e.maxHp > 100) && Math.hypot(e.x - w.player.x, e.y - w.player.y) < 500);
  if (!elite) return;
  const dx = elite.x - w.player.x; const dy = elite.y - w.player.y; const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(w.player.x, w.player.y + 24);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ff7ab8';
  ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Entities                                                            */
/* ------------------------------------------------------------------ */

/**
 * XP gem tiers, keyed off pickup value so a bigger drop reads as a bigger,
 * brighter, more insistent gem instead of the same dot regardless of worth.
 * See run-presentation.md.
 */
interface XpGemTier {
  color: string;
  glow: string;
  halfSize: number;
  blur: number;
  pulseAmp: number;
  sparkle: boolean;
}
const XP_GEM_TIERS: readonly XpGemTier[] = [
  { color: '#4fb3c9', glow: '#4fb3c9', halfSize: 4, blur: 6, pulseAmp: 0, sparkle: false }, // spark
  { color: '#6ee7ff', glow: '#6ee7ff', halfSize: 6, blur: 10, pulseAmp: 0, sparkle: false }, // shard (original look)
  { color: '#ffb347', glow: '#ffd166', halfSize: 8, blur: 15, pulseAmp: 0.1, sparkle: false }, // gem
  { color: '#e879f9', glow: '#f5d0fe', halfSize: 11, blur: 22, pulseAmp: 0.18, sparkle: true }, // prism
];
function xpGemTier(value: number): XpGemTier {
  if (value >= 20) return XP_GEM_TIERS[3]!;
  if (value >= 10) return XP_GEM_TIERS[2]!;
  if (value >= 4) return XP_GEM_TIERS[1]!;
  return XP_GEM_TIERS[0]!;
}

/** The original drop drawings (the free Potato Pack). Caller save()s/restore()s. */
export function drawPickupClassic(ctx: CanvasRenderingContext2D, pickup: Pickup, now: number) {
  const bob = Math.sin((now - pickup.bornAt) / 220) * 2;
  const x = pickup.x;
  const y = pickup.y + bob;
  // A quick grow-in on spawn reads as a "pop" instead of appearing inert.
  const age = now - pickup.bornAt;
  const pop = age >= 180 ? 1 : 0.35 + 0.65 * (age / 180);
  switch (pickup.kind) {
    case 'xp': {
      const tier = xpGemTier(pickup.value);
      const pulse = tier.pulseAmp > 0 ? 1 + Math.sin((now - pickup.bornAt) / 200) * tier.pulseAmp : 1;
      const s = tier.halfSize * pop * pulse;
      ctx.fillStyle = tier.color;
      ctx.shadowColor = tier.glow;
      ctx.shadowBlur = tier.blur * pulse;
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.8, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.8, y);
      ctx.closePath();
      ctx.fill();
      if (tier.sparkle) {
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 2; i += 1) {
          const angle = now / 260 + i * Math.PI;
          ctx.fillRect(x + Math.cos(angle) * (s + 5) - 1, y + Math.sin(angle) * (s + 5) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'health':
      ctx.fillStyle = '#7dffb2';
      ctx.shadowColor = '#7dffb2';
      ctx.shadowBlur = 10;
      ctx.fillRect(x - 6, y - 2, 12, 4);
      ctx.fillRect(x - 2, y - 6, 4, 12);
      break;
    case 'cred':
      ctx.fillStyle = '#ffd166';
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'sweep':
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 14;
      for (let i = 0; i < 4; i += 1) {
        const angle = (Math.PI / 2) * i + now / 400;
        ctx.fillRect(x + Math.cos(angle) * 6 - 2, y + Math.sin(angle) * 6 - 2, 4, 4);
      }
      break;
    case 'loot-box': {
      const pulse = 0.7 + Math.sin((now - pickup.bornAt) / 180) * 0.3;
      // Blue crate body
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(x - 9, y - 8, 18, 16);
      // Top highlight
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(x - 9, y - 8, 18, 4);
      // Side highlight
      ctx.globalAlpha = 0.6 * pulse;
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(x - 7, y - 6, 3, 11);
      // Lock icon
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x, y + 1, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 2, y + 1, 4, 4);
      break;
    }
    case 'card-pack': {
      const pulse = 0.75 + Math.sin((now - pickup.bornAt) / 150) * 0.25;
      ctx.rotate(-0.12); ctx.shadowColor = '#f0abfc'; ctx.shadowBlur = 20 * pulse; ctx.fillStyle = '#4a044e'; ctx.fillRect(x - 8, y - 11, 16, 22); ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 2; ctx.strokeRect(x - 8, y - 11, 16, 22); ctx.fillStyle = '#fdf4ff'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.fillText('LP', x, y + 2);
      break;
    }
    case 'coin': {
      ctx.fillStyle = '#e8d48a'; ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#7c5f18'; ctx.stroke();
      break;
    }
    case 'glitch-cache': {
      const pulse = 0.8 + Math.sin((now - pickup.bornAt) / 120) * 0.2;
      const glitchShift = (Math.floor(now / 150) % 3 === 0) ? 2 : 0;
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(x - 10 + glitchShift, y - 9, 20, 18);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 10, y - 9, 20, 18);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(x - 6, y - 5, 12, 10);
      ctx.fillStyle = '#67e8f9';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('0x', x + glitchShift, y + 3);
      break;
    }
    case 'relic-vault-chest': {
      const pulse = 0.85 + Math.sin((now - pickup.bornAt) / 160) * 0.15;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 22 * pulse;
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(x - 12, y - 10, 24, 20);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 12, y - 10, 24, 20);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(x - 10, y - 8, 20, 6);
      // Golden Keyhole
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x, y + 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 1.5, y + 2, 3, 5);
      break;
    }
    case 'firefly-amber-chest': {
      const pulse = 0.8 + Math.sin((now - pickup.bornAt) / 140) * 0.2;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 24 * pulse;
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x - 11, y - 9, 22, 18);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x - 9, y - 7, 18, 14);
      // Orbiting glowing fireflies
      for (let fi = 0; fi < 3; fi += 1) {
        const fAngle = (now / 350) + (fi * Math.PI * 2) / 3;
        const fx = x + Math.cos(fAngle) * 14;
        const fy = y + Math.sin(fAngle) * 8;
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(fx - 1.5, fy - 1.5, 3, 3);
      }
      break;
    }
    case 'mimic-chest': {
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#451a03';
      ctx.fillRect(x - 9, y - 8, 18, 16);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x - 9, y - 8, 18, 5);
      // Twitching ominous lock
      const twitch = Math.sin(now / 100) > 0.8 ? 1 : 0;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x - 2, y + 1 + twitch, 4, 3);
      break;
    }
    case 'phosphor-ore': {
      const pulse = 0.75 + Math.sin((now - pickup.bornAt) / 130) * 0.25;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 16 * pulse;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 6, y - 1);
      ctx.lineTo(x + 4, y + 6);
      ctx.lineTo(x - 4, y + 6);
      ctx.lineTo(x - 6, y - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'silicon-alloy': {
      const pulse = 0.8 + Math.sin((now - pickup.bornAt) / 160) * 0.2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14 * pulse;
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(x - 6, y - 5, 12, 10);
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(x - 4, y - 3, 8, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 2, y - 1, 4, 2);
      break;
    }
    case 'cyber-resin': {
      const pulse = 0.8 + Math.sin((now - pickup.bornAt) / 150) * 0.2;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 15 * pulse;
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d8b4fe';
      ctx.beginPath();
      ctx.arc(x - 1.5, y - 1.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'rootglass-cell': {
      const pulse = 0.7 + Math.sin((now - pickup.bornAt) / 180) * 0.3;
      ctx.shadowColor = '#5eead4';
      ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = '#0f766e';
      ctx.fillRect(x - 8, y - 10, 16, 20);
      ctx.fillStyle = '#99f6e4';
      ctx.beginPath();
      ctx.moveTo(x, y - 7); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fef3c7'; ctx.fillRect(x - 1, y - 4, 2, 8);
      break;
    }
    case 'prism-quartz': {
      const pulse = 0.85 + Math.sin((now - pickup.bornAt) / 120) * 0.15;
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 20 * pulse;
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 8);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 3, 2, 6);
      break;
    }
    case 'water-flask': {
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(x, y + 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(x - 2, y - 6, 4, 4);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(x - 1, y + 1, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

function drawPickups(ctx: CanvasRenderingContext2D, w: World) {
  for (const pickup of w.pickups) {
    ctx.save();
    if (w.dropStyle !== 'classic' && w.graphicsQuality !== 'performance') {
      drawStyledPickup(ctx, pickup, w.now, w.dropStyle, w.graphicsQuality !== 'high', w.pickups.length > 120);
    } else {
      drawPickupClassic(ctx, pickup, w.now);
    }
    ctx.restore();
  }
}

const STORM_CLOUD_COLORS: Record<StormCloudMode, { core: string; fx: string }> = {
  rain: { core: '#7fb3e0', fx: '#bcdcff' },
  'fire-rain': { core: '#ff6b35', fx: '#ffd166' },
  'acid-rain': { core: '#8fce4a', fx: '#dfffa0' },
  'frost-rain': { core: '#8fd9f0', fx: '#eaffff' },
};

/**
 * Storm Chaser's cloud: a soft drifting mass overhead, a dashed ground
 * reticle showing its effect radius, and a handful of mode-colored falling
 * marks (rain / embers / acid drips) -- purely time-derived, no particle
 * array to manage. Drawn slightly larger and steadier while being dragged
 * as a "you've got hold of it" cue. See run-presentation.md.
 */
function drawStormCloud(ctx: CanvasRenderingContext2D, w: World) {
  const cloud = w.stormCloud;
  if (!cloud) return;
  const colors = STORM_CLOUD_COLORS[cloud.mode];
  const bob = Math.sin(w.now / 500) * 4;
  const holdPulse = cloud.dragging ? 1.15 : 1 + Math.sin(w.now / 260) * 0.05;
  const config = w.character.stormCloud;
  const effectRadius = (config?.effectRadius ?? 90);

  ctx.save();
  ctx.strokeStyle = colors.core;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.arc(cloud.x, cloud.y, effectRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < 5; i += 1) {
    const seed = i * 0.62;
    const fall = (w.now / 3.2 + seed * 900) % 260;
    const fx = cloud.x + Math.sin(seed * 7) * effectRadius * 0.6;
    const fy = cloud.y + 14 + fall;
    if (fy > cloud.y + effectRadius * 0.75) continue;
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - fall / 260);
    ctx.strokeStyle = colors.fx;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx, fy + 9);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  const cy = cloud.y - 32 + bob;
  ctx.translate(cloud.x, cy);
  ctx.scale(holdPulse, holdPulse);
  ctx.shadowColor = colors.core;
  ctx.shadowBlur = 18;
  ctx.fillStyle = colors.core;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 13, 0, 0, Math.PI * 2);
  ctx.ellipse(-14, 4, 15, 10, 0, 0, Math.PI * 2);
  ctx.ellipse(14, 4, 15, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.fx;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(-4, -4, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A ground reticle that pulses faster as impact nears, plus a comet that
 * streaks down from off-screen for the final stretch before it. Purely
 * derived from `PendingMeteor` timestamps -- no separate visual entity to
 * keep in sync. See run-presentation.md.
 */
function drawPendingMeteors(ctx: CanvasRenderingContext2D, w: World) {
  for (const m of w.pendingMeteors) {
    const remaining = m.impactAt - w.now;
    const total = Math.max(1, m.impactAt - m.telegraphAt);
    const urgency = clamp(1 - remaining / total, 0, 1);
    ctx.save();
    ctx.strokeStyle = m.color;
    ctx.globalAlpha = 0.3 + 0.35 * Math.abs(Math.sin(w.now / (140 - urgency * 90)));
    ctx.lineWidth = 2 + urgency * 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius * (0.85 + Math.sin(w.now / 100) * 0.05), 0, Math.PI * 2);
    ctx.stroke();

    const fallWindow = 260;
    if (remaining <= fallWindow) {
      const fallT = clamp(1 - remaining / fallWindow, 0, 1);
      const startY = m.y - 420;
      const cy = startY + (m.y - startY) * fallT;
      const cx = m.x + (1 - fallT) * 36;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (1 - fallT) * 16, cy - 55 - (1 - fallT) * 35);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, w: World, bounds: ViewBounds, visualBudget: NonNullable<Viewport['visualBudget']>) {
  const cosmeticLimit = visualBudget === 'minimal' ? 60 : visualBudget === 'reduced' ? 130 : Number.POSITIVE_INFINITY;
  const cosmeticStride = visualBudget === 'minimal' ? 3 : visualBudget === 'reduced' ? 2 : 1;
  let cosmeticDrawn = 0;
  for (const effect of w.effects) {
    // Effects often outlive the projectile that created them. Rendering all
    // of them even when they are well beyond the camera was a quiet cost in
    // dense/endless runs; gameplay still updates every instance in world.ts.
    if (!isNearView(effect.x, effect.y, bounds, effect.radius + 48)) continue;
    if (w.now < effect.bornAt) continue;
    const gameplayReadable = effect.kind === 'laser' || effect.kind === 'hazard' || effect.kind === 'nova' || effect.kind === 'ring' || effect.kind === 'wave';
    if (!gameplayReadable) {
      if (cosmeticDrawn >= cosmeticLimit || effect.uid % cosmeticStride !== 0) continue;
      cosmeticDrawn += 1;
    }
    const life = (w.now - effect.bornAt) / Math.max(1, effect.expiresAt - effect.bornAt);
    const fade = 1 - life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);

    switch (effect.kind) {
      case 'slash': {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 9 * fade + 3;
        ctx.lineCap = 'round';
        const sweep = effect.spread * (0.35 + life * 0.9);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (0.55 + life * 0.5), effect.angle - sweep, effect.angle + sweep);
        ctx.stroke();
        if (effect.weaponId?.startsWith('firewall-') || effect.weaponId?.startsWith('rewind-') || effect.weaponId?.startsWith('eclipse-')) {
          ctx.shadowColor = effect.color;
          ctx.shadowBlur = 16 * fade;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 + 3 * fade;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius * (0.55 + life * 0.5), effect.angle - sweep, effect.angle + sweep);
          ctx.stroke();
          if (effect.weaponId.startsWith('eclipse-')) {
            ctx.setLineDash([12, 7]);
            ctx.strokeStyle = '#7c3aed';
            ctx.lineWidth = 5 * fade;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.radius * (0.69 + life * 0.5), effect.angle - sweep, effect.angle + sweep);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        if (effect.weaponId === 'breakpoint-hands' || effect.weaponId === 'breakpoint-finale') {
          const tipX = effect.x + Math.cos(effect.angle) * effect.radius * 0.8;
          const tipY = effect.y + Math.sin(effect.angle) * effect.radius * 0.8;
          ctx.save();
          ctx.translate(tipX, tipY);
          ctx.rotate(effect.angle);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = effect.color;
          ctx.shadowBlur = 16;
          ctx.fillRect(-13, -9, 26, 18);
          ctx.fillStyle = effect.color;
          ctx.fillRect(-8, -5, 16, 10);
          ctx.restore();
        }
        break;
      }
      case 'nova':
      case 'ring': {
        const visualRadius = effect.radius * (0.2 + life * 0.9);
        if (effect.weaponId === 'commentstorm-crown' || effect.weaponId === 'crown-of-replies') {
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = 4 * fade + 1;
          ctx.shadowColor = effect.color;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, visualRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px monospace';
          ctx.fillText(effect.weaponId === 'crown-of-replies' ? '!!' : '?!', effect.x - 10, effect.y + 6);
          break;
        }
        if (effect.weaponId === 'spray-can') {
          // Paint ejects in uneven wedges and droplets, not a clean pulse.
          ctx.strokeStyle = effect.color;
          ctx.fillStyle = effect.color;
          ctx.lineWidth = 5 * fade + 2;
          for (let i = 0; i < 9; i += 1) {
            const angle = i * 2.39996 + life * 0.4;
            const length = visualRadius * (0.6 + (i % 3) * 0.18);
            ctx.beginPath();
            ctx.moveTo(effect.x + Math.cos(angle) * visualRadius * 0.18, effect.y + Math.sin(angle) * visualRadius * 0.18);
            ctx.lineTo(effect.x + Math.cos(angle) * length, effect.y + Math.sin(angle) * length);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(effect.x + Math.cos(angle) * length, effect.y + Math.sin(angle) * length, 3 + (i % 3) * 2, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        if (effect.weaponId === 'cryo-grenade') {
          // Six brittle ice plates expand, rotate, and separate.
          ctx.strokeStyle = effect.color;
          ctx.fillStyle = effect.color;
          ctx.lineWidth = 3;
          for (let i = 0; i < 6; i += 1) {
            const angle = (i / 6) * Math.PI * 2 + life * 0.5;
            const cx = effect.x + Math.cos(angle) * visualRadius * 0.58;
            const cy = effect.y + Math.sin(angle) * visualRadius * 0.58;
            ctx.beginPath();
            for (let corner = 0; corner < 6; corner += 1) {
              const a = angle + (corner / 6) * Math.PI * 2;
              const x = cx + Math.cos(a) * visualRadius * 0.18;
              const y = cy + Math.sin(a) * visualRadius * 0.18;
              if (corner === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.globalAlpha = Math.max(0, fade * 0.32);
            ctx.fill();
            ctx.globalAlpha = Math.max(0, fade);
            ctx.stroke();
          }
          break;
        }
        if (effect.weaponId === 'graviton-repulsor' || effect.weaponId === 'lev-expansion') {
          // Tilted gravity planes shear away from the center.
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = 5 * fade + 1;
          for (let i = 0; i < 4; i += 1) {
            ctx.save();
            ctx.translate(effect.x, effect.y);
            ctx.rotate(i * Math.PI / 4 + life * (i % 2 === 0 ? 0.7 : -0.7));
            ctx.scale(1, 0.28 + i * 0.08);
            ctx.beginPath();
            ctx.arc(0, 0, visualRadius * (0.65 + i * 0.1), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          break;
        }
        if (effect.weaponId === 'exposure-flash') {
          // Offset shutter frames make this read as photography, not a blast.
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = 4 * fade + 1;
          for (let i = 0; i < 3; i += 1) {
            const size = visualRadius * (0.65 + i * 0.22);
            ctx.save();
            ctx.translate(effect.x, effect.y);
            ctx.rotate((i - 1) * 0.16);
            ctx.strokeRect(-size, -size * 0.65, size * 2, size * 1.3);
            ctx.restore();
          }
          break;
        }
        if (effect.weaponId === 'resonance-bell') {
          // Bell-mouth arcs stagger downward like visible chimes.
          ctx.strokeStyle = effect.color;
          ctx.lineCap = 'round';
          for (let i = 0; i < 4; i += 1) {
            ctx.lineWidth = 6 - i;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y - visualRadius * 0.18, visualRadius * (0.4 + i * 0.18), 0.18, Math.PI - 0.18);
            ctx.stroke();
          }
          break;
        }
        if (effect.weaponId === 'mask-pulse') {
          // Two eye-shaped sweeps open from a hollow mask center.
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = 5 * fade + 1;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(effect.x + side * visualRadius * 0.28, effect.y, visualRadius * 0.3, visualRadius * 0.14, side * 0.18, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        }
        if (effect.weaponId === 'boombox') {
          // Square speaker cones thump outward on each damage tick.
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = 5 * fade + 1;
          ctx.save();
          ctx.translate(effect.x, effect.y);
          ctx.rotate(Math.PI / 4);
          ctx.strokeRect(-visualRadius * 0.58, -visualRadius * 0.58, visualRadius * 1.16, visualRadius * 1.16);
          ctx.restore();
          break;
        }
        if (effect.weaponId === 'lotus-hum') {
          // Eight petals unfold around the player rather than flashing.
          ctx.strokeStyle = effect.color;
          ctx.fillStyle = effect.color;
          for (let i = 0; i < 8; i += 1) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.save();
            ctx.translate(effect.x + Math.cos(angle) * visualRadius * 0.38, effect.y + Math.sin(angle) * visualRadius * 0.38);
            ctx.rotate(angle);
            ctx.globalAlpha = Math.max(0, fade * 0.22);
            ctx.beginPath();
            ctx.ellipse(visualRadius * 0.18, 0, visualRadius * 0.32, visualRadius * 0.12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = Math.max(0, fade * 0.8);
            ctx.stroke();
            ctx.restore();
          }
          break;
        }
        const ringCount = effect.kind === 'nova' ? 3 : 1;
        for (let ring = 0; ring < ringCount; ring += 1) {
          const ringLife = clamp(life - ring * 0.14, 0, 1);
          if (ringLife <= 0) continue;
          ctx.globalAlpha = Math.max(0, (1 - ringLife) * fade);
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = effect.kind === 'ring' ? 6 * fade + 2 : 7 * (1 - ringLife * 0.5) + 2;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius * (0.2 + ringLife * 0.9), 0, Math.PI * 2);
          ctx.stroke();
        }
        if (effect.kind === 'nova') {
          const core = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, effect.radius * 0.4);
          core.addColorStop(0, effect.color);
          core.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = Math.max(0, fade * 0.5);
          ctx.fillStyle = core;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = Math.max(0, fade * 0.14);
          ctx.fillStyle = effect.color;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius * (0.25 + life * 0.85), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'impact': {
        // Comic-book impact star: jagged spikes radiating from the punch point.
        const spikes = 8;
        const outer = effect.radius * (0.35 + life * 0.65);
        const inner = outer * 0.42;
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = Math.max(0, fade * 0.85);
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i += 1) {
          const r = i % 2 === 0 ? outer : inner;
          const a = (Math.PI * i) / spikes + w.now / 900;
          const px = effect.x + Math.cos(a) * r;
          const py = effect.y + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fffdf0';
        ctx.globalAlpha = Math.max(0, fade * 0.6);
        ctx.stroke();

        if (effect.color === '#e2e8f0' || effect.weaponId === 'monitor-crack') {
          // 4th-Wall Breaking: Radial Monitor Screen Fracture Lines
          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5 * fade;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 8;
          const crackCount = 7;
          for (let c = 0; c < crackCount; c += 1) {
            const baseAngle = (c * Math.PI * 2) / crackCount + 0.2;
            let cx = effect.x;
            let cy = effect.y;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const segments = 4;
            const segLen = (outer * 1.5) / segments;
            for (let s = 0; s < segments; s += 1) {
              const segAngle = baseAngle + Math.sin(c * 17 + s * 31) * 0.35;
              cx += Math.cos(segAngle) * segLen;
              cy += Math.sin(segAngle) * segLen;
              ctx.lineTo(cx, cy);
              if (s === 2) {
                const bx = cx + Math.cos(segAngle + 0.8) * segLen * 0.8;
                const by = cy + Math.sin(segAngle + 0.8) * segLen * 0.8;
                ctx.moveTo(cx, cy);
                ctx.lineTo(bx, by);
                ctx.moveTo(cx, cy);
              }
            }
            ctx.stroke();
          }
          ctx.restore();
        }
        break;
      }
      case 'aura':
      case 'spark': {
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * fade, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'wave': {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 5 * fade + 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (0.45 + life * 0.55),
          effect.angle - effect.spread, effect.angle + effect.spread);
        ctx.stroke();
        if (effect.weaponId === 'pitch-reaper' || effect.weaponId === 'requiem-return') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2 + 2 * fade;
          ctx.setLineDash([11, 7, 3, 7]);
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius * (0.4 + life * 0.55),
            effect.angle - effect.spread, effect.angle + effect.spread);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case 'laser': {
        const endX = effect.x + Math.cos(effect.angle) * effect.radius;
        const endY = effect.y + Math.sin(effect.angle) * effect.radius;
        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 20;
        ctx.lineCap = 'round';
        // Segmented, pulsing beam: a bright core plus a wider, flickering outer glow.
        const pulse = 0.7 + Math.sin(w.now / 55) * 0.3;
        ctx.globalAlpha = Math.max(0, fade * 0.35);
        ctx.lineWidth = (18 + 6 * Math.sin(w.now / 40)) * pulse;
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * fade + 2;
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        if (effect.weaponId === 'subwoofer-railstaff' || effect.weaponId === 'bassline-overdrive' || effect.weaponId === 'cipher-cathedral' || effect.weaponId === 'cipher-sanctuary') {
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 12]);
          ctx.beginPath();
          ctx.moveTo(effect.x, effect.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(endX, endY, 4 + 3 * fade, 0, Math.PI * 2);
          ctx.fill();
        }

        if (effect.weaponId === 'inspect-element') {
          // DevTools CSS Box Model Inspection Reticle at target endpoint
          ctx.save();
          ctx.translate(endX, endY);
          
          // Orange Margin Box
          ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
          ctx.strokeStyle = '#ea580c';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(-28, -28, 56, 56);
          ctx.fillRect(-28, -28, 56, 56);

          // Green Padding Box
          ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
          ctx.strokeStyle = '#16a34a';
          ctx.setLineDash([]);
          ctx.strokeRect(-20, -20, 40, 40);
          ctx.fillRect(-20, -20, 40, 40);

          // Blue Content Box (<div.threat 24x24>)
          ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.strokeStyle = '#0284c7';
          ctx.strokeRect(-12, -12, 24, 24);
          ctx.fillRect(-12, -12, 24, 24);

          // Tag indicator
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 7px monospace';
          ctx.textAlign = 'center';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 8;
          ctx.fillText('div#target 48×48', 0, -32);
          ctx.restore();
        }
        break;
      }
      case 'hazard': {
        const phase = w.now / 260;
        const radius = effect.radius;
        ctx.strokeStyle = effect.color;
        ctx.fillStyle = effect.color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);

        if (effect.weaponId === 'cipher-cathedral' || effect.weaponId === 'cipher-sanctuary') {
          ctx.shadowColor = effect.color;
          ctx.shadowBlur = 12;
          for (let i = 0; i < 3; i += 1) {
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, radius * (0.48 + i * 0.2), i * 0.35 + phase * 0.08, i * 0.35 + phase * 0.08 + Math.PI * 1.35);
            ctx.stroke();
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(effect.x - 3, effect.y - 3, 6, 6);
        } else if (effect.weaponId === 'cache-of-lost-hooks' || effect.weaponId === 'chorus-cache') {
          ctx.shadowColor = effect.color;
          ctx.shadowBlur = 14;
          for (let i = 0; i < 3; i += 1) {
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, radius * (0.32 + i * 0.28), 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px monospace';
          ctx.fillText('♫', effect.x - 8, effect.y + 5);
        } else if (effect.weaponId === 'emberback') {
          // An uneven firebreak with independently licking flame points.
          ctx.beginPath();
          for (let i = 0; i < 20; i += 1) {
            const angle = (i / 20) * Math.PI * 2;
            const lick = i % 2 === 0 ? 0.78 : 0.98 + Math.sin(phase * 2 + i) * 0.08;
            const x = effect.x + Math.cos(angle) * radius * lick;
            const y = effect.y + Math.sin(angle) * radius * lick;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.globalAlpha *= 0.32;
          for (let i = 0; i < 8; i += 1) {
            const angle = (i / 8) * Math.PI * 2 + phase * 0.08;
            const inner = radius * 0.5;
            ctx.beginPath();
            ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
            ctx.lineTo(effect.x + Math.cos(angle - 0.08) * radius * 0.92, effect.y + Math.sin(angle - 0.08) * radius * 0.92);
            ctx.lineTo(effect.x + Math.cos(angle + 0.08) * radius * 0.74, effect.y + Math.sin(angle + 0.08) * radius * 0.74);
            ctx.closePath();
            ctx.fill();
          }
        } else if (effect.weaponId === 'acid-garden') {
          // Overlapping chemical blooms read as splatter instead of a ring.
          ctx.globalAlpha *= 0.42;
          for (let i = 0; i < 11; i += 1) {
            const angle = i * 2.39996;
            const distance = radius * (0.18 + (i % 4) * 0.18);
            const bubbleRadius = radius * (0.12 + (i % 3) * 0.055) * (1 + Math.sin(phase + i) * 0.08);
            ctx.beginPath();
            ctx.arc(effect.x + Math.cos(angle) * distance, effect.y + Math.sin(angle) * distance, bubbleRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        } else if (effect.weaponId === 'infinite-cassette') {
          // A cassette hub with loose magnetic tape snaking through the field.
          ctx.globalAlpha *= 0.75;
          ctx.strokeRect(effect.x - radius * 0.32, effect.y - radius * 0.2, radius * 0.64, radius * 0.4);
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(effect.x + side * radius * 0.16, effect.y, radius * 0.08, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(effect.x - radius * 0.16, effect.y + radius * 0.12);
          ctx.bezierCurveTo(
            effect.x - radius * 0.9, effect.y + Math.sin(phase) * radius * 0.25,
            effect.x + radius * 0.9, effect.y + Math.cos(phase * 0.8) * radius * 0.35,
            effect.x + radius * 0.18, effect.y - radius * 0.1,
          );
          ctx.stroke();
        } else if (effect.weaponId === 'singularity-core') {
          // Warped accretion rings collapse toward an opaque gravity well.
          ctx.globalAlpha *= 0.8;
          for (let i = 0; i < 3; i += 1) {
            ctx.save();
            ctx.translate(effect.x, effect.y);
            ctx.rotate(phase * (i % 2 === 0 ? 0.15 : -0.12) + i);
            ctx.scale(1, 0.34 + i * 0.16);
            ctx.beginPath();
            ctx.arc(0, 0, radius * (0.48 + i * 0.2), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          ctx.globalAlpha = Math.min(1, ctx.globalAlpha * 1.6);
          ctx.fillStyle = '#020617';
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, radius * 0.24, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Character-only fields still receive a readable authored sigil,
          // never the old generic dashed circle.
          ctx.globalAlpha *= 0.65;
          ctx.beginPath();
          for (let i = 0; i < 12; i += 1) {
            const angle = (i / 12) * Math.PI * 2 + phase * 0.04;
            const pointRadius = radius * (i % 2 === 0 ? 0.95 : 0.62);
            const x = effect.x + Math.cos(angle) * pointRadius;
            const y = effect.y + Math.sin(angle) * pointRadius;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.globalAlpha *= 0.18;
          ctx.fill();
        }
        break;
      }
      case 'web': {
        // Ambient connector between two hazard nodes -- thin, faint, no hit
        // detection. Reads as "you're standing inside a web" between the
        // anchor points that actually do the freezing. See run-presentation.md.
        const endX = effect.x + Math.cos(effect.angle) * effect.radius;
        const endY = effect.y + Math.sin(effect.angle) * effect.radius;
        ctx.strokeStyle = effect.color;
        ctx.globalAlpha *= 0.5 + Math.sin(w.now / 220) * 0.15;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        break;
      }
      case 'teleport': {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (1 - fade) + 8, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'glitch': {
        // 4th-Wall Breaking: Desktop Marquee Selection Box & CRT Scanline Disruption
        const boxW = Math.max(90, effect.radius * 1.6);
        const boxH = Math.max(70, effect.radius * 1.2);
        const left = effect.x - boxW / 2;
        const top = effect.y - boxH / 2;

        ctx.save();
        ctx.fillStyle = effect.weaponId === 'kernel-panic' ? 'rgba(37, 99, 235, 0.35)' : 'rgba(14, 165, 233, 0.22)';
        ctx.fillRect(left, top, boxW, boxH);

        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -w.now / 40;
        ctx.strokeRect(left, top, boxW, boxH);

        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        const handleSize = 5;
        ctx.fillRect(left - handleSize / 2, top - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(left + boxW - handleSize / 2, top - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(left - handleSize / 2, top + boxH - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(left + boxW - handleSize / 2, top + boxH - handleSize / 2, handleSize, handleSize);

        const curX = left + Math.sin(w.now / 120) * 4;
        const curY = top + Math.cos(w.now / 120) * 4;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(curX, curY);
        ctx.lineTo(curX + 16, curY + 11);
        ctx.lineTo(curX + 10, curY + 11);
        ctx.lineTo(curX + 14, curY + 20);
        ctx.lineTo(curX + 10, curY + 22);
        ctx.lineTo(curX + 6, curY + 13);
        ctx.lineTo(curX, curY + 17);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const jitterLines = 4;
        for (let j = 0; j < jitterLines; j += 1) {
          const jy = top + ((w.now / 8 + j * 23) % boxH);
          const jOffset = (Math.sin(w.now / 30 + j) * 8);
          ctx.fillStyle = j % 2 === 0 ? 'rgba(236, 72, 153, 0.45)' : 'rgba(6, 182, 212, 0.45)';
          ctx.fillRect(left + jOffset, jy, boxW, 2);
        }

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 6;
        const bannerText = effect.weaponId === 'kernel-panic' ? '*** BSOD: 0x0000007E ***' : '[DELETE SELECTED: 0xNULL]';
        ctx.fillText(bannerText, left + 6, top - 6);
        ctx.restore();
        break;
      }
      case 'waveform': {
        // Real-Time Stereo Audio Oscilloscope Waveform Ribbon
        ctx.save();
        const segments = 28;
        const stepLen = effect.radius / segments;
        const perpX = -Math.sin(effect.angle);
        const perpY = Math.cos(effect.angle);

        const channels = [
          { color: effect.color, phase: 0, ampMult: 1, offset: -2 },
          { color: '#f43f5e', phase: Math.PI * 0.5, ampMult: 0.8, offset: 2 },
        ];

        for (const ch of channels) {
          ctx.strokeStyle = ch.color;
          ctx.lineWidth = (3.5 * fade + 1.5);
          ctx.shadowColor = ch.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          for (let s = 0; s <= segments; s += 1) {
            const dist = s * stepLen;
            const progress = s / segments;
            const envelope = Math.sin(progress * Math.PI);
            const wave = Math.sin(s * 0.75 + w.now / 50 + ch.phase) * 16 * envelope
              + Math.sin(s * 1.5 - w.now / 35) * 7 * envelope;
            const px = effect.x + Math.cos(effect.angle) * dist + perpX * (wave + ch.offset);
            const py = effect.y + Math.sin(effect.angle) * dist + perpY * (wave + ch.offset);
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);

            if (s % 5 === 0 && s > 0) {
              const tickH = 6 * envelope;
              ctx.strokeRect(px - 1, py - tickH / 2, 2, tickH);
            }
          }
          ctx.stroke();
        }

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * fade;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        for (let s = 0; s <= segments; s += 1) {
          const dist = s * stepLen;
          const progress = s / segments;
          const envelope = Math.sin(progress * Math.PI);
          const wave = Math.sin(s * 0.75 + w.now / 50) * 16 * envelope;
          const px = effect.x + Math.cos(effect.angle) * dist + perpX * wave;
          const py = effect.y + Math.sin(effect.angle) * dist + perpY * wave;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'dialup-carrier': {
        const perpX = -Math.sin(effect.angle);
        const perpY = Math.cos(effect.angle);
        const segments = 36;
        const stepLen = effect.radius / segments;

        ctx.save();
        // High-frequency Phosphor CRT Green Noise & Carrier Wave
        ctx.strokeStyle = '#22c55e';
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3 * fade;

        // Carrier FSK Sine Ribbon
        ctx.beginPath();
        for (let s = 0; s <= segments; s += 1) {
          const dist = s * stepLen;
          const progress = s / segments;
          const envelope = Math.sin(progress * Math.PI);
          const fskFreq = (s % 8 < 4) ? 2.4 : 1.1;
          const wave = Math.sin(s * fskFreq + w.now / 30) * 18 * envelope;
          const px = effect.x + Math.cos(effect.angle) * dist + perpX * wave;
          const py = effect.y + Math.sin(effect.angle) * dist + perpY * wave;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // White-hot core beam
        ctx.strokeStyle = '#f0fdf4';
        ctx.lineWidth = 1.2 * fade;
        ctx.beginPath();
        for (let s = 0; s <= segments; s += 1) {
          const dist = s * stepLen;
          const progress = s / segments;
          const envelope = Math.sin(progress * Math.PI);
          const fskFreq = (s % 8 < 4) ? 2.4 : 1.1;
          const wave = Math.sin(s * fskFreq + w.now / 30) * 18 * envelope;
          const px = effect.x + Math.cos(effect.angle) * dist + perpX * wave;
          const py = effect.y + Math.sin(effect.angle) * dist + perpY * wave;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Terminal Modem Handshake Telemetry Text
        const packetLabels = ['> ATDT 56K', 'CONNECT 56000', 'V.90 SYN', '0x7E ACK', '+++ATH0'];
        ctx.fillStyle = '#86efac';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let pIdx = 0; pIdx < 3; pIdx += 1) {
          const pDist = effect.radius * (0.3 + pIdx * 0.3);
          const pAngle = effect.angle;
          const tx = effect.x + Math.cos(pAngle) * pDist;
          const ty = effect.y + Math.sin(pAngle) * pDist + (pIdx % 2 === 0 ? -12 : 12);
          ctx.fillText(packetLabels[(Math.floor(w.now / 300) + pIdx) % packetLabels.length]!, tx, ty);
        }
        ctx.restore();
        break;
      }

      case 'rickroll-disco': {
        ctx.save();
        const gridSize = 4;
        const tileSize = (effect.radius * 2) / (gridSize + 1);
        const discoColors = ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#06b6d4', '#f43f5e'];
        const beatStep = Math.floor(w.now / 200);

        // Animated neon disco dance floor tiles
        for (let gx = -2; gx <= 2; gx += 1) {
          for (let gy = -2; gy <= 2; gy += 1) {
            const tileX = effect.x + gx * tileSize;
            const tileY = effect.y + gy * tileSize;
            if (dist2(tileX, tileY, effect.x, effect.y) > effect.radius * effect.radius) continue;

            const colorIndex = Math.abs(gx * 3 + gy * 7 + beatStep) % discoColors.length;
            ctx.fillStyle = discoColors[colorIndex]!;
            ctx.globalAlpha = 0.42 * fade;
            ctx.fillRect(tileX - tileSize * 0.45, tileY - tileSize * 0.45, tileSize * 0.9, tileSize * 0.9);

            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = 0.65 * fade;
            ctx.lineWidth = 1;
            ctx.strokeRect(tileX - tileSize * 0.45, tileY - tileSize * 0.45, tileSize * 0.9, tileSize * 0.9);
          }
        }

        // Floating retro music notes
        const notes = ['♪', '♫', '♬', '♩'];
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let n = 0; n < 4; n += 1) {
          const noteAngle = (Math.PI * 2 * n) / 4 + w.now / 600;
          const noteDist = effect.radius * 0.65;
          const nx = effect.x + Math.cos(noteAngle) * noteDist;
          const ny = effect.y + Math.sin(noteAngle) * noteDist + Math.sin(w.now / 150 + n) * 8;
          ctx.fillStyle = discoColors[(n + beatStep) % discoColors.length]!;
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 10;
          ctx.globalAlpha = 0.95 * fade;
          ctx.fillText(notes[n % notes.length]!, nx, ny);
        }

        // Center silhouette dancer (Rick's iconic trench coat rhythm groove)
        const danceHop = Math.abs(Math.sin(w.now / 110)) * 6;
        const kickAngle = Math.sin(w.now / 110) * 0.4;
        const dcX = effect.x;
        const dcY = effect.y - danceHop;

        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 14;
        ctx.globalAlpha = 0.95 * fade;

        // Head with pompadour
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(dcX, dcY - 20, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.arc(dcX + 1, dcY - 22, 4.5, Math.PI, Math.PI * 2);
        ctx.fill();

        // Trench Coat Torso
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(dcX - 6, dcY - 14);
        ctx.lineTo(dcX + 6, dcY - 14);
        ctx.lineTo(dcX + 8, dcY - 1);
        ctx.lineTo(dcX - 8, dcY - 1);
        ctx.closePath();
        ctx.fill();

        // Coat lapels & tie
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(dcX - 1, dcY - 13, 2, 8);

        // Kicking Legs
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(dcX - 3, dcY - 1);
        ctx.lineTo(dcX - 6 + kickAngle * 10, dcY + 11);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dcX + 3, dcY - 1);
        ctx.lineTo(dcX + 6 - kickAngle * 10, dcY + 11);
        ctx.stroke();

        // Dancing Arms holding microphone
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(dcX - 6, dcY - 12);
        ctx.lineTo(dcX - 11, dcY - 6 + Math.sin(w.now / 110) * 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dcX + 6, dcY - 12);
        ctx.lineTo(dcX + 10, dcY - 16 - Math.sin(w.now / 110) * 4);
        ctx.stroke();

        // Mic
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(dcX + 11, dcY - 18 - Math.sin(w.now / 110) * 4, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        break;
      }

      case 'bsod-crash': {
        ctx.save();
        const crashW = Math.min(effect.radius * 2.2, 420);
        const crashH = Math.min(effect.radius * 1.5, 240);

        // Solid Cobalt Blue Screen of Death
        ctx.fillStyle = '#0000aa';
        ctx.globalAlpha = 0.88 * fade;
        ctx.shadowColor = '#1d4ed8';
        ctx.shadowBlur = 24;
        ctx.fillRect(effect.x - crashW / 2, effect.y - crashH / 2, crashW, crashH);

        // White border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(effect.x - crashW / 2, effect.y - crashH / 2, crashW, crashH);

        // CRT Scanline Simulation
        ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        for (let sl = -crashH / 2; sl < crashH / 2; sl += 4) {
          ctx.fillRect(effect.x - crashW / 2, effect.y + sl, crashW, 1.5);
        }

        // Monospace crash text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const startX = effect.x - crashW / 2 + 12;
        let startY = effect.y - crashH / 2 + 12;

        ctx.fillText('A problem has been detected and Loksurvivor has been halted.', startX, startY);
        startY += 15;
        ctx.fillText('DRIVER_IRQL_NOT_LESS_OR_EQUAL', startX, startY);
        startY += 15;
        ctx.fillText('*** STOP: 0x000000D1 (0x0000000C, 0x00000002, 0xF86B5A89)', startX, startY);
        startY += 18;
        const memoryPct = Math.min(100, Math.floor(((w.now - effect.bornAt) / 650) * 100));
        ctx.fillText(`Beginning dump of physical memory: ${memoryPct}%`, startX, startY);
        startY += 15;
        const cursorBlink = Math.floor(w.now / 250) % 2 === 0 ? '_' : ' ';
        ctx.fillText(`Physical memory dump complete. Restarting ${cursorBlink}`, startX, startY);

        ctx.restore();
        break;
      }

      case 'matrix-rain': {
        ctx.save();
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 12;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';

        const streamCount = 7;
        const colSpacing = (effect.radius * 2) / (streamCount + 1);
        const glyphs = ['1', '0', '1', '0', '0xFF', '404', '7B', 'NULL', 'λ', '0', '1'];

        for (let col = -3; col <= 3; col += 1) {
          const streamX = effect.x + col * colSpacing;
          const colSeed = Math.abs(col * 739);
          const streamOffset = ((w.now * 0.18 + colSeed * 50) % (effect.radius * 2)) - effect.radius;
          
          for (let row = 0; row < 6; row += 1) {
            const charY = effect.y + streamOffset - row * 13;
            if (dist2(streamX, charY, effect.x, effect.y) > effect.radius * effect.radius) continue;

            const charIndex = (colSeed + row + Math.floor(w.now / 150)) % glyphs.length;
            const char = glyphs[charIndex]!;

            if (row === 0) {
              // Leading glaring white head glyph
              ctx.fillStyle = '#ffffff';
              ctx.globalAlpha = 0.95 * fade;
            } else {
              // Fading green phosphor trail
              ctx.fillStyle = '#22c55e';
              ctx.globalAlpha = Math.max(0.12, (1 - row * 0.16)) * fade;
            }
            ctx.fillText(char, streamX, charY);
          }
        }
        ctx.restore();
        break;
      }
    }
    ctx.restore();
  }
}

function drawPersistentAura(ctx: CanvasRenderingContext2D, w: World) {
  for (const weapon of w.weapons.filter((entry) => entry.def.kind === 'aura')) {
    const radius = weapon.def.range * w.stats.area;
    const pulse = 0.06 + Math.sin(w.now / 260) * 0.02;
    const color = weapon.def.color ?? w.character.palette.glow;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(w.player.x, w.player.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawOrbiters(ctx: CanvasRenderingContext2D, w: World) {
  for (const orb of w.orbiters) {
    const x = w.player.x + Math.cos(orb.angle) * orb.radius;
    const y = w.player.y + Math.sin(orb.angle) * orb.radius;
    ctx.save();
    const weapon = w.weapons.find((entry) => entry.def.id === orb.weaponId);
    const color = weapon?.def.color ?? w.character.palette.glow;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    if (weapon?.def.id === 'commentstorm-crown' || weapon?.def.id === 'crown-of-replies') {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(weapon.def.id === 'crown-of-replies' ? '!' : '?', x - 5, y + 5);
    } else if (weapon?.def.id === 'orbit-rings') {
      // A thin gold-violet annulus rather than a blade -- reads as a ring, not a rectangle.
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (weapon?.def.id === 'spinning-loading-wheel') {
      // Authentic retro OS spinning rainbow beachball / HTML5 buffer spinner
      ctx.translate(Math.round(x), Math.round(y));
      const spinAngle = orb.angle * 3.5 + w.now / 150;
      ctx.rotate(spinAngle);
      
      const pinwheelColors = ['#ff2a2a', '#ff9900', '#ffff00', '#00dd00', '#00c0ff', '#0033ff', '#9900ff', '#ff00aa'];
      const slices = pinwheelColors.length;
      const wheelRadius = 13;
      
      for (let s = 0; s < slices; s += 1) {
        const a1 = (s * Math.PI * 2) / slices;
        const a2 = ((s + 1) * Math.PI * 2) / slices;
        ctx.fillStyle = pinwheelColors[s]!;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, wheelRadius, a1, a2);
        ctx.closePath();
        ctx.fill();
      }

      // Outer glass rim & inner hub
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // HTML5 Buffering text indicator
      ctx.rotate(-spinAngle);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#06b6d4';
      ctx.fillText('99%...', 0, -wheelRadius - 4);
    } else {
      // Default: a spinning vinyl-blade silhouette, angled along its orbit direction.
      const spinAngle = orb.angle + Math.PI / 2;
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(spinAngle);
      ctx.fillStyle = color;
      ctx.fillRect(-5, -4, 10, 8);
      ctx.fillStyle = w.character.palette.ink;
      ctx.fillRect(-2, -4, 2, 8);
      ctx.fillRect(2, -4, 2, 8);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-6, -8, 5, 3);
    }
    ctx.restore();
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, w: World, bounds: ViewBounds) {
  for (const proj of w.projectiles) {
    if (!isNearView(proj.x, proj.y, bounds, Math.max(36, proj.radius + 28))) continue;
    // Zero Day: a thrown frozen enemy renders as its own rig in flight
    // instead of a normal weapon-projectile sprite.
    if (proj.carriedEnemyUid !== undefined) {
      const carried = w.enemies.find((e) => e.uid === proj.carriedEnemyUid);
      ctx.save();
      if (carried) {
        drawRig(ctx, carried.def.rig, carried.def.palette, 'idle', 0, proj.x, proj.y, proj.vx >= 0 ? 1 : -1,
          SPRITE_SCALE * sizeClassScale(carried.def) * 0.85, { tint: { color: '#22c55e', alpha: 0.6 } });
      } else {
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      continue;
    }

    if (drawForgeFiveProjectile(ctx, proj, w.now)) continue;

    if (proj.customKind === 'dvd-logo') {
      ctx.save();
      ctx.translate(proj.x, proj.y);
      const isEvolved = proj.weaponId === 'dvd-screensaver';
      const logoW = isEvolved ? 48 : 42;
      const logoH = isEvolved ? 28 : 24;
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = isEvolved ? 22 : 14;

      // Outer glowing pill box
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-logoW / 2, -logoH / 2, logoW, logoH, 6);
      ctx.fill();
      ctx.stroke();

      // Disc ellipse beneath
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 4, 15, 4.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Bold text "DVD"
      ctx.fillStyle = proj.color;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DVD', 0, -3.5);

      // Subtext "VIDEO"
      ctx.font = 'bold 6px sans-serif';
      ctx.fillText(isEvolved ? 'ULTRA' : 'VIDEO', 0, 5.5);

      if (isEvolved) {
        // Holographic sheen streak
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-logoW / 2 + 5, logoH / 2 - 2);
        ctx.lineTo(logoW / 2 - 5, -logoH / 2 + 2);
        ctx.stroke();
      }

      ctx.restore();
      continue;
    }

    if (proj.customKind === 'baby-llama' || proj.customKind === 'elemental-llama') {
      const isElemental = proj.customKind === 'elemental-llama' || proj.isElementalLlama;
      ctx.save();
      ctx.translate(proj.x, proj.y);
      const facingLeft = proj.vx < 0;
      if (facingLeft) {
        ctx.scale(-1, 1);
      }

      // Floating trail symbol
      const heartOffset = Math.sin(w.now / 100) * 3;
      ctx.font = '10px sans-serif';
      if (isElemental) {
        ctx.fillStyle = '#c084fc';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.fillText('⚡', -14, -6 + heartOffset);
      } else {
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#fb7185';
        ctx.shadowBlur = 6;
        ctx.fillText('❤', -14, -6 + heartOffset);
      }

      // Fluffy llama body
      ctx.shadowColor = isElemental ? '#a855f7' : '#fda4af';
      ctx.shadowBlur = isElemental ? 12 : 8;
      ctx.fillStyle = isElemental ? '#faf5ff' : '#fff5f5';
      ctx.beginPath();
      ctx.roundRect(-10, -5, 16, 12, 5);
      ctx.fill();

      // Long neck & head
      ctx.beginPath();
      ctx.roundRect(4, -14, 7, 12, 3);
      ctx.roundRect(4, -18, 10, 8, 3);
      ctx.fill();

      // Cute pointy ears / crown
      ctx.fillStyle = isElemental ? '#c084fc' : '#fecdd3';
      ctx.beginPath();
      ctx.moveTo(5, -18);
      ctx.lineTo(6, -23);
      ctx.lineTo(9, -18);
      ctx.fill();

      // Saddle
      ctx.fillStyle = isElemental ? '#7e22ce' : '#fb7185';
      ctx.fillRect(-6, -5, 9, 7);
      ctx.fillStyle = isElemental ? '#38bdf8' : '#fde047';
      ctx.fillRect(-6, 0, 9, 2);

      // Eye
      ctx.fillStyle = isElemental ? '#0284c7' : '#1e1b4b';
      ctx.beginPath();
      ctx.arc(11, -15, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Animated trotting legs
      const legCycle = Math.sin(w.now / 50);
      ctx.strokeStyle = isElemental ? '#c084fc' : '#fbcfe8';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(6, 7);
      ctx.lineTo(6 + legCycle * 4, 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(9, 7);
      ctx.lineTo(9 - legCycle * 4, 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-6, 7);
      ctx.lineTo(-6 - legCycle * 4, 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3, 7);
      ctx.lineTo(-3 + legCycle * 4, 14);
      ctx.stroke();

      ctx.restore();
      continue;
    }

    if (proj.customKind === 'nyan-cat') {
      ctx.save();
      ctx.translate(proj.x, proj.y);
      const heading = Math.atan2(proj.vy, proj.vx);
      ctx.rotate(heading);

      // Undulating Rainbow Trail (6 stripes)
      const rainbowColors = ['#ff0000', '#ff9900', '#ffff00', '#33ff00', '#0099ff', '#9933ff'];
      const trailPoints = proj.trail;
      if (trailPoints.length > 1) {
        ctx.save();
        ctx.rotate(-heading); // Draw trail in world space
        ctx.translate(-proj.x, -proj.y);
        for (let r = 0; r < 6; r += 1) {
          ctx.strokeStyle = rainbowColors[r]!;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          const yOffset = (r - 2.5) * 2.4;
          for (let t = 0; t < trailPoints.length; t += 1) {
            const pt = trailPoints[t]!;
            const waveOffset = Math.sin((w.now / 60) + t * 0.8) * 3;
            if (t === 0) ctx.moveTo(pt.x, pt.y + yOffset + waveOffset);
            else ctx.lineTo(pt.x, pt.y + yOffset + waveOffset);
          }
          ctx.lineTo(proj.x, proj.y + yOffset);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Pop-Tart Body (Crisp golden pastry with strawberry frosting and sprinkles)
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#fed7aa';
      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-12, -8, 20, 16, 3);
      ctx.fill();
      ctx.stroke();

      // Pink strawberry frosting
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.roundRect(-10, -6, 16, 12, 2);
      ctx.fill();

      // Sprinkles (dark pink dots)
      ctx.fillStyle = '#be185d';
      ctx.fillRect(-7, -4, 2, 2);
      ctx.fillRect(-3, -2, 2, 2);
      ctx.fillRect(1, -4, 2, 2);
      ctx.fillRect(-6, 2, 2, 2);
      ctx.fillRect(-1, 2, 2, 2);
      ctx.fillRect(2, 0, 2, 2);

      // Gray Cat Head & Ears
      ctx.fillStyle = '#94a3b8';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8, -8);
      ctx.lineTo(12, -14);
      ctx.lineTo(14, -7);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(11, 4);
      ctx.lineTo(15, 10);
      ctx.lineTo(16, 3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(7, -7, 12, 14, 4);
      ctx.fill();
      ctx.stroke();

      // Cheeks & Eyes
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(9, 3, 2, 2);
      ctx.fillRect(9, -5, 2, 2);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(14, -3, 2, 2);
      ctx.fillRect(14, 2, 2, 2);

      // Tail (wagging)
      const tailWag = Math.sin(w.now / 70) * 4;
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.roundRect(-17, -2 + tailWag, 6, 4, 2);
      ctx.fill();

      // Sparkling star
      const starPhase = (w.now / 120) % (Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText('✦', -16 + Math.cos(starPhase) * 6, -10 + Math.sin(starPhase) * 6);

      ctx.restore();
      continue;
    }

    if (proj.customKind === 'popup-window') {
      ctx.save();
      ctx.translate(proj.x, proj.y);
      const winW = 74;
      const winH = 46;

      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 12;

      // Authentic Win95 Beveled Window Frame
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(-winW / 2, -winH / 2, winW, winH);

      // 3D Bevel highlight & shadow
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-winW / 2, winH / 2);
      ctx.lineTo(-winW / 2, -winH / 2);
      ctx.lineTo(winW / 2, -winH / 2);
      ctx.stroke();

      ctx.strokeStyle = '#404040';
      ctx.beginPath();
      ctx.moveTo(-winW / 2, winH / 2);
      ctx.lineTo(winW / 2, winH / 2);
      ctx.lineTo(winW / 2, -winH / 2);
      ctx.stroke();

      // Titlebar (Dark Blue Gradient)
      const grad = ctx.createLinearGradient(-winW / 2 + 2, 0, winW / 2 - 2, 0);
      grad.addColorStop(0, '#000080');
      grad.addColorStop(1, '#1084d0');
      ctx.fillStyle = grad;
      ctx.fillRect(-winW / 2 + 2, -winH / 2 + 2, winW - 4, 12);

      // Title text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const title = (proj.popupTitle ?? 'Alert.exe').slice(0, 11);
      ctx.fillText(title, -winW / 2 + 5, -winH / 2 + 8);

      // Close Button [X]
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(winW / 2 - 12, -winH / 2 + 3, 9, 10);
      ctx.strokeStyle = '#808080';
      ctx.strokeRect(winW / 2 - 12, -winH / 2 + 3, 9, 10);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('×', winW / 2 - 7.5, -winH / 2 + 8);

      // Window Body Icon & Text
      const icon = proj.popupKind === 'warn' ? '⚠' : proj.popupKind === 'million' ? '★' : proj.popupKind === 'ipod' ? '♫' : '!';
      const iconColor = proj.popupKind === 'warn' ? '#eab308' : proj.popupKind === 'million' ? '#ef4444' : '#2563eb';
      ctx.fillStyle = iconColor;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(icon, -winW / 2 + 12, 4);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'left';
      const bodyText = proj.popupText ?? '1,000,000th VISITOR!';
      ctx.fillText(bodyText.slice(0, 13), -winW / 2 + 22, 1);
      if (bodyText.length > 13) {
        ctx.fillText(bodyText.slice(13, 26), -winW / 2 + 22, 10);
      }

      // OK Button
      ctx.fillStyle = '#d4d4d4';
      ctx.fillRect(-8, winH / 2 - 11, 16, 8);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(-8, winH / 2 - 11, 16, 8);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 5.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OK', 0, winH / 2 - 6.5);

      ctx.restore();
      continue;
    }

    if (proj.customKind === 'dom-tag') {
      ctx.save();
      ctx.translate(proj.x, proj.y);
      const heading = Math.atan2(proj.vy, proj.vx);
      ctx.rotate(heading);

      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;

      // Dark code pill container
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      const tagStr = proj.tagText ?? '<canvas>';
      ctx.font = 'bold 9px monospace';
      const textMetrics = ctx.measureText(tagStr);
      const pillW = textMetrics.width + 14;
      const pillH = 18;

      ctx.beginPath();
      ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(tagStr, 0, 0);

      // Glowing cutting pincer brackets
      const scissorAngle = Math.sin(w.now / 60) * 0.35;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-pillW / 2 - 4, -8);
      ctx.lineTo(pillW / 2 + 4, -8 - scissorAngle * 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-pillW / 2 - 4, 8);
      ctx.lineTo(pillW / 2 + 4, 8 + scissorAngle * 10);
      ctx.stroke();

      ctx.restore();
      continue;
    }

    if (proj.customKind === 'byte-block') {
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;

      const size = 26;
      // 3D Isometric Shaded Blue Byte Cube
      // Top face
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 2, -size / 4);
      ctx.lineTo(0, 0);
      ctx.lineTo(-size / 2, -size / 4);
      ctx.closePath();
      ctx.fill();

      // Left face
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.moveTo(-size / 2, -size / 4);
      ctx.lineTo(0, 0);
      ctx.lineTo(0, size / 2);
      ctx.lineTo(-size / 2, size / 4);
      ctx.closePath();
      ctx.fill();

      // Right face
      ctx.fillStyle = '#1e40af';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(size / 2, -size / 4);
      ctx.lineTo(size / 2, size / 4);
      ctx.lineTo(0, size / 2);
      ctx.closePath();
      ctx.fill();

      // Hex code label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(proj.tagText ?? '0xDEAD', 0, size / 6);

      ctx.restore();
      continue;
    }

    if (proj.customKind === 'golden-cookie') {
      ctx.save();
      ctx.translate(proj.x, proj.y);
      const heading = Math.atan2(proj.vy, proj.vx);
      ctx.rotate(heading + w.now / 150);

      // Golden radiance aura
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 18;

      // Golden Cookie Base
      const r = 16;
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(-2, -2, r * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // Chocolate chips
      ctx.fillStyle = '#451a03';
      const chipOffsets = [
        { x: -6, y: -5 },
        { x: 4, y: -7 },
        { x: -3, y: 3 },
        { x: 7, y: 2 },
        { x: 0, y: -2 },
        { x: -7, y: 7 },
      ];
      for (const chip of chipOffsets) {
        ctx.beginPath();
        ctx.arc(chip.x, chip.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outer golden crispy edge
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      // Orbiting frantic auto-clicking mouse cursors
      ctx.rotate(-heading - w.now / 150);
      for (let c = 0; c < 3; c += 1) {
        const cAngle = (Math.PI * 2 * c) / 3 + w.now / 120;
        const cx = Math.cos(cAngle) * 26;
        const cy = Math.sin(cAngle) * 26;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(cAngle + Math.PI / 4);
        
        // Classic white pointer cursor with black outline
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(8, 8);
        ctx.lineTo(4, 8);
        ctx.lineTo(6, 12);
        ctx.lineTo(4, 13);
        ctx.lineTo(2, 9);
        ctx.lineTo(-1, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Floating click feedback: "+777"
      const clickPulse = Math.sin(w.now / 80);
      if (clickPulse > 0.4) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('+777', 0, -22);
      }

      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = proj.color;
    ctx.lineWidth = proj.radius;
    ctx.lineCap = 'round';
    if (proj.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(proj.trail[0]!.x, proj.trail[0]!.y);
      for (const point of proj.trail) ctx.lineTo(point.x, point.y);
      ctx.lineTo(proj.x, proj.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 12;
    const heading = Math.atan2(proj.vy, proj.vx);
    const bodyColor = proj.fromPlayer ? proj.color : '#ff7a7a';

    if (proj.radius >= 20 && proj.color === '#ec4899') {
      // V-Sync Slayer: 4th-Wall Horizontal Screen Tear Seam
      ctx.translate(proj.x, proj.y);
      ctx.rotate(heading);
      const tearLen = proj.radius * 3.4;
      const tearH = proj.radius * 0.9;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-tearLen * 0.5, -tearH * 0.5, tearLen, tearH * 0.5);
      ctx.fillRect(-tearLen * 0.5 - 6, 0, tearLen, tearH * 0.5);
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-tearLen * 0.5 - 6, 0);
      for (let tx = -tearLen * 0.5; tx <= tearLen * 0.5; tx += 12) {
        ctx.lineTo(tx, (Math.sin(tx * 0.3 + w.now / 20) * 3));
      }
      ctx.stroke();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (proj.color === '#c084fc') {
      // Solitaire Cascade: Bouncing retro dialog window with cascade shadow frames
      ctx.translate(proj.x, proj.y);
      ctx.rotate(heading * 0.25);
      const winW = 24;
      const winH = 20;
      for (let cf = 2; cf >= 1; cf -= 1) {
        ctx.globalAlpha = 0.25 * cf;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(-winW / 2 - cf * 4, -winH / 2 - cf * 4, winW, winH);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.strokeRect(-winW / 2 - cf * 4, -winH / 2 - cf * 4, winW, winH);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-winW / 2, -winH / 2, winW, winH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(-winW / 2, -winH / 2, winW, winH);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(-winW / 2 + 1, -winH / 2 + 1, winW - 2, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(winW / 2 - 4, -winH / 2 + 1.5, 3, 3);
    } else if (proj.radius >= 20) {
      // "The Bus" and similarly huge sweep shots: an elongated vehicle silhouette, not a dot.
      ctx.translate(proj.x, proj.y);
      ctx.rotate(heading);
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-proj.radius * 1.6, -proj.radius * 0.55, proj.radius * 3.2, proj.radius * 1.1);
      ctx.fillStyle = '#0d1117';
      for (let wx = -proj.radius * 1.1; wx <= proj.radius * 1.1; wx += proj.radius * 0.7) {
        ctx.fillRect(wx, -proj.radius * 0.15, proj.radius * 0.4, proj.radius * 0.5);
      }
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-proj.radius * 1.5, -proj.radius * 0.55, proj.radius * 3, proj.radius * 0.22);
    } else if (proj.targetUid !== null) {
      // Homing shots: a chevron oriented toward its target, with a faint tracking pulse.
      ctx.translate(proj.x, proj.y);
      ctx.rotate(heading);
      const r = proj.radius * 1.8;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.7, r * 0.7);
      ctx.lineTo(-r * 0.25, 0);
      ctx.lineTo(-r * 0.7, -r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.35 + Math.sin(w.now / 90) * 0.15;
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawRescue(ctx: CanvasRenderingContext2D, w: World) {
  const rescue = w.rescue;
  if (rescue.status === 'pending' || rescue.status === 'freed') return;

  const ally = rescue.allyId ? ALLIES_BY_ID[rescue.allyId] : undefined;
  const ringColor = ally?.palette.glow ?? '#ffe08a';
  const bodyColor = ally?.palette.accent ?? '#c9a26a';

  const pulse = 0.5 + Math.sin(w.now / 240) * 0.3;
  ctx.save();
  ctx.globalAlpha = 0.25 + pulse * 0.2;
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -w.now / 40;
  ctx.beginPath();
  ctx.arc(rescue.x, rescue.y, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // A hunched figure behind bars, tinted with the actual ally's palette so
  // different allies visibly read as different people mid-rescue.
  ctx.fillStyle = ally?.palette.bodyDark ?? '#141018';
  ctx.fillRect(rescue.x - 14, rescue.y - 26, 28, 30);
  ctx.fillStyle = bodyColor;
  ctx.fillRect(rescue.x - 7, rescue.y - 18, 14, 16);
  ctx.fillStyle = '#8a8f9c';
  for (let i = -12; i <= 12; i += 6) {
    ctx.fillRect(rescue.x + i, rescue.y - 26, 2, 30);
  }
  ctx.fillRect(rescue.x - 14, rescue.y - 28, 28, 3);

  if (rescue.progress > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(rescue.x - 24, rescue.y + 12, 48, 6);
    ctx.fillStyle = ringColor;
    ctx.fillRect(rescue.x - 23, rescue.y + 13, 46 * rescue.progress, 4);
  }
  ctx.restore();
}

/**
 * Civilians and cats. Drawn before the props so scenery occludes them --
 * they read as background life moving behind the cars rather than as
 * combatants, and it hides the fact that they never collide with anything.
 */
function drawAmbient(ctx: CanvasRenderingContext2D, w: World) {
  if (effectiveSky(w) === 'roofed') return;
  for (const actor of w.ambient) {
    const kind = AMBIENT_KINDS_BY_ID[actor.kindId];
    if (!kind) continue;
    ctx.save();
    ctx.globalAlpha = 0.7;
    drawShadow(ctx, actor.x, actor.y + 2, 11);
    drawRig(
      ctx,
      kind.rig,
      kind.palette,
      actor.anim,
      w.now - actor.animStartedAt,
      actor.x,
      actor.y,
      actor.facing,
      SPRITE_SCALE * 0.78,
      { outline: false },
    );
    ctx.restore();
  }
}

function coneColorForKind(kind: 'pull' | 'slow' | 'chill' | 'burn' | 'shock'): string {
  return kind === 'pull' ? '#f472b6'
    : kind === 'slow' ? '#38bdf8'
    : kind === 'chill' ? '#93c5fd'
    : kind === 'burn' ? '#fb923c'
    : '#a78bfa';
}

/**
 * Fills a cone and animates a thin "scan" arc sweeping from its origin to
 * its edge every ~900ms, so every cone in the game (sentry/tracker/beacon/
 * commander drones) reads as a live beam instead of a static wedge.
 */
function drawScanCone(
  ctx: CanvasRenderingContext2D,
  w: World,
  x: number,
  y: number,
  range: number,
  centerAngle: number,
  halfAngle: number,
  color: string,
  alpha: number,
  now: number,
  react?: Parameters<typeof reactionMultiplier>[0],
) {
  // Music-reactive cones: 'scale' breathes the cone's reach with the track,
  // 'glow' brightens its fill on the beat -- both no-ops without a `react`
  // array on the enemy (musicVisual returns 1), so most cones stay static.
  const drawRange = range * musicVisual(w, react, 'scale');
  const drawAlpha = alpha * musicVisual(w, react, 'glow');
  ctx.save();
  ctx.globalAlpha = drawAlpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, drawRange, centerAngle - halfAngle, centerAngle + halfAngle);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const sweepT = (now / 900) % 1;
  ctx.save();
  ctx.globalAlpha = drawAlpha * 1.6 * (1 - sweepT);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, drawRange * sweepT, centerAngle - halfAngle, centerAngle + halfAngle);
  ctx.stroke();
  ctx.restore();
}

/** A wandering detection circle spawned by a 'commander' enemy -- pulses like a radar contact. */
function drawRoamingDetector(ctx: CanvasRenderingContext2D, w: World, detector: World['roamingDetectors'][number]) {
  const color = coneColorForKind(detector.effectKind);
  const pulse = 0.5 + 0.5 * Math.sin(w.now / 260);
  ctx.save();
  ctx.globalAlpha = 0.16 + pulse * 0.08;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(detector.x, detector.y, detector.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -w.now / 20;
  ctx.beginPath();
  ctx.arc(detector.x, detector.y, detector.radius * (0.75 + pulse * 0.2), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** The "stuck" marker floating over the player while a beacon/commander effect is riding them. */
function drawPlayerConeMark(ctx: CanvasRenderingContext2D, w: World) {
  if (w.now >= w.playerConeUntil || !w.playerConeKind) return;
  const color = coneColorForKind(w.playerConeKind);
  const bob = Math.sin(w.now / 180) * 3;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(w.player.x, w.player.y - 34 + bob, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoamingDetectors(ctx: CanvasRenderingContext2D, w: World) {
  for (const detector of w.roamingDetectors) {
    drawRoamingDetector(ctx, w, detector);
  }
}

function drawActors(
  ctx: CanvasRenderingContext2D,
  w: World,
  viewBounds: { left: number; top: number; right: number; bottom: number },
) {
  // 'high' (default) is the original, unchanged 70-enemy threshold.
  // 'balanced'/'performance' drop the purely-decorative non-boss outline
  // earlier -- it's an extra fillRect per part, so it's one of the cheaper
  // knobs to trim first at density. Boss/giant outlines are untouched
  // (drawn unconditionally at the call site) since those aid readability.
  const outlineThreshold = w.graphicsQuality === 'performance' ? 0 : w.graphicsQuality === 'balanced' ? 40 : 70;
  const outlineEnemies = w.enemies.length < outlineThreshold;
  const skipEnemyShadows = w.graphicsQuality === 'performance' && w.enemies.length >= 150;

  for (const pet of w.lokPets) {
    const pulse = 0.86 + Math.sin(w.now / 115 + pet.uid) * 0.14;
    const alpha = pet.ghost ? 0.3 + pulse * 0.08 : pulse;
    const facing: 1 | -1 = pet.vx < -4 ? -1 : 1;
    const rig = evolvedRig(pet.silhouette, pet.evolutionOverlays);
    const palette = lokPetSpritePalette(pet.palette);
    const petScale = LOKPET_SPRITE_SCALE * (pet.sizeScale ?? 1) * (0.9 + pulse * 0.1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = pet.palette.glow;
    ctx.shadowBlur = pet.ghost ? 13 : pet.legendary ? 16 : 9;
    drawRig(ctx, rig, palette, 'idle', w.now - pet.bornAt, pet.x, pet.y, facing, petScale, {
      outline: !pet.ghost,
    });
    if (pet.variantId === 'clockwork-beetle' && !pet.ghost) {
      // The shell is a real moving clock, not a static badge. Its hands run
      // continuously and visibly overcrank while Borrowed Moment is active.
      const centerY = pet.y - 9 * petScale;
      const radius = 5.2 * petScale;
      const accelerated = w.now < pet.specialActiveUntil;
      const minuteAngle = w.now / (accelerated ? 75 : 620);
      const hourAngle = w.now / (accelerated ? 240 : 2400);
      ctx.save();
      ctx.fillStyle = `${pet.palette.eye}d9`;
      ctx.strokeStyle = pet.palette.accent;
      ctx.lineWidth = Math.max(1, petScale * 0.55);
      ctx.beginPath(); ctx.arc(pet.x, centerY, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (let mark = 0; mark < 4; mark += 1) {
        const angle = mark * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(pet.x + Math.cos(angle) * radius * 0.72, centerY + Math.sin(angle) * radius * 0.72);
        ctx.lineTo(pet.x + Math.cos(angle) * radius * 0.92, centerY + Math.sin(angle) * radius * 0.92);
        ctx.stroke();
      }
      ctx.strokeStyle = pet.palette.bodyDark;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pet.x, centerY); ctx.lineTo(pet.x + Math.cos(hourAngle) * radius * 0.48, centerY + Math.sin(hourAngle) * radius * 0.48); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pet.x, centerY); ctx.lineTo(pet.x + Math.cos(minuteAngle) * radius * 0.72, centerY + Math.sin(minuteAngle) * radius * 0.72); ctx.stroke();
      ctx.fillStyle = pet.palette.glow;
      ctx.beginPath(); ctx.arc(pet.x, centerY, Math.max(1.4, petScale), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (!pet.ghost) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = pet.palette.glow;
      ctx.beginPath(); ctx.ellipse(pet.x, pet.y + 3, 14, 4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // Followers stay just above the ground layer and use a compact mark so
  // swarms remain readable on phones without needing a second sprite atlas.
  for (const follower of w.followers) {
    const pulse = 0.8 + Math.sin(w.now / 110 + follower.uid) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.shadowColor = follower.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = follower.color;
    ctx.beginPath();
    ctx.arc(follower.x, follower.y - follower.radius * 0.35, follower.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(follower.x - 2, follower.y - follower.radius * 0.65, 4, 3);
    ctx.restore();
  }

  // Painter's order only needs on-screen actors. Simulation still owns all
  // 1,000 Unleashed enemies, while expensive rig drawing and sorting stay
  // proportional to what the camera can actually show.
  const margin = 100;
  const sorted = w.enemies
    .filter((enemy) => enemy.x >= viewBounds.left - margin && enemy.x <= viewBounds.right + margin
      && enemy.y >= viewBounds.top - margin && enemy.y <= viewBounds.bottom + margin)
    .sort((a, b) => a.y - b.y);
  const playerDrawn = { done: false };

  const drawPlayer = () => {
    if (playerDrawn.done) return;
    playerDrawn.done = true;
    const p = w.player;
    const scale = SPRITE_SCALE * w.playerSizeMult;
    const fallProgress = p.falling ? clamp((w.now - p.fallStartedAt) / 700, 0, 1) : 0;
    drawShadow(ctx, p.x, p.y + 2, p.radius * (1 - fallProgress * 0.65));

    if (p.dashUntil > w.now) {
      const dashProgress = clamp((w.now - p.dashStartedAt) / 180, 0, 1);
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 4; i >= 1; i -= 1) {
        ctx.globalAlpha = (1 - i / 5) * (1 - dashProgress * 0.35);
        ctx.strokeStyle = w.character.palette.accentBright;
        ctx.lineWidth = 3 + (5 - i);
        ctx.beginPath();
        ctx.moveTo(
          p.x - p.dashDirectionX * (i * 13 + 12),
          p.y - p.dashDirectionY * (i * 13 + 12),
        );
        ctx.lineTo(p.x - p.dashDirectionX * (i * 13), p.y - p.dashDirectionY * (i * 13));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Every cosmetic keeps the same readable base ring, then adds a
    // deterministic procedural flourish. No style touches simulation state.
    ctx.save();
    const ring = ctx.createRadialGradient(p.x, p.y + 2, 2, p.x, p.y + 2, p.radius + 15);
    ring.addColorStop(0, `${w.character.palette.accent}35`);
    ring.addColorStop(1, `${w.character.palette.accent}00`);
    ctx.fillStyle = ring;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, p.radius + 12, (p.radius + 12) * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = w.character.palette.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, p.radius + 3, (p.radius + 3) * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();

    const accent = w.character.palette.accentBright;
    const glow = w.character.palette.glow;
    const phase = w.now / 1000;
    if (w.runAuraStyle === 'radar-sweep') {
      ctx.translate(p.x, p.y + 2);
      ctx.rotate(phase * 2.4);
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = accent;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius + 16, (p.radius + 16) * 0.44, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(p.radius + 20, 0);
      ctx.stroke();
    } else if (w.runAuraStyle === 'ember-orbit') {
      for (let i = 0; i < 3; i += 1) {
        const angle = phase * 2.8 + (i * Math.PI * 2) / 3;
        const x = p.x + Math.cos(angle) * (p.radius + 11);
        const y = p.y + 2 + Math.sin(angle) * (p.radius * 0.42 + 4);
        ctx.globalAlpha = 0.68 + Math.sin(phase * 5 + i) * 0.22;
        ctx.fillStyle = i === 1 ? glow : accent;
        ctx.shadowColor = glow;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, 2.5 + i * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (w.runAuraStyle === 'rain-signal') {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i += 1) {
        const lane = i - 3;
        const travel = (phase * 52 + i * 9) % 34;
        const x = p.x + lane * 5;
        const y = p.y - 28 + travel;
        ctx.globalAlpha = 0.25 + (i % 3) * 0.18;
        ctx.beginPath();
        ctx.moveTo(x + 2, y - 4);
        ctx.lineTo(x - 1, y + 3);
        ctx.stroke();
      }
    } else if (w.runAuraStyle === 'glitch-echo') {
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        const jitter = Math.sin(phase * 13 + i * 4.7) * 5;
        ctx.globalAlpha = 0.18 + i * 0.08;
        ctx.strokeStyle = i % 2 === 0 ? accent : glow;
        ctx.strokeRect(
          p.x - p.radius - 5 + jitter,
          p.y - 20 + i * 8,
          p.radius * 2 + 10 - Math.abs(jitter),
          3,
        );
      }
    } else if (w.runAuraStyle === 'mothlight') {
      ctx.fillStyle = accent;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 7;
      for (let i = 0; i < 5; i += 1) {
        const angle = phase * (0.8 + i * 0.07) + i * 1.27;
        const radius = p.radius + 12 + (i % 2) * 7;
        const x = p.x + Math.cos(angle) * radius;
        const y = p.y - 5 + Math.sin(angle * 1.4) * (p.radius + 7);
        const size = 1.8 + (i % 2);
        ctx.globalAlpha = 0.4 + Math.sin(phase * 4 + i) * 0.22;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillRect(-size, -size, size * 2, size * 2);
        ctx.restore();
      }
    } else if (w.runAuraStyle === 'tile-bloom') {
      const tileSize = 12;
      for (let ix = -1; ix <= 1; ix += 1) {
        for (let iy = -1; iy <= 1; iy += 1) {
          const bloom = Math.sin(phase * 2.2 + (ix + iy) * 0.9) * 0.5 + 0.5;
          ctx.globalAlpha = 0.18 + bloom * 0.32;
          ctx.fillStyle = (ix + iy) % 2 === 0 ? accent : glow;
          ctx.shadowColor = glow;
          ctx.shadowBlur = 6 + bloom * 6;
          const tx = p.x + ix * tileSize - tileSize / 2;
          const ty = p.y + 6 + iy * tileSize * 0.5 - tileSize * 0.25;
          ctx.fillRect(tx, ty, tileSize - 1, tileSize * 0.5 - 1);
        }
      }
    }

    const paletteEffect = w.paletteEffect;
    if (paletteEffect) {
      const cycle = phase * Math.PI * 2 * paletteEffect.speed;
      const intensity = paletteEffect.intensity;
      ctx.translate(p.x, p.y + 2);
      ctx.strokeStyle = paletteEffect.kind === 'prism' ? accent : glow;
      ctx.shadowColor = paletteEffect.kind === 'prism' ? w.character.palette.accent : glow;
      ctx.shadowBlur = 8 + intensity * 14;
      ctx.lineWidth = 1.5 + intensity * 1.5;
      if (paletteEffect.kind === 'glow') {
        ctx.globalAlpha = 0.28 + Math.sin(cycle) * 0.08;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius + 18, (p.radius + 18) * 0.44, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (paletteEffect.kind === 'pulse') {
        const pulse = (Math.sin(cycle) + 1) / 2;
        ctx.globalAlpha = (0.18 + pulse * 0.45) * intensity;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius + 9 + pulse * 15, (p.radius + 9 + pulse * 15) * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (paletteEffect.kind === 'prism') {
        for (let i = 0; i < 3; i += 1) {
          const offset = Math.sin(cycle + i * 2.1) * 5;
          ctx.globalAlpha = (0.22 + i * 0.09) * intensity;
          ctx.strokeStyle = [w.character.palette.accent, w.character.palette.accentBright, w.character.palette.glow][i]!;
          ctx.beginPath();
          ctx.ellipse(offset, i - 1, p.radius + 11 + i * 4, (p.radius + 11 + i * 4) * 0.4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (paletteEffect.kind === 'flicker') {
        const on = Math.sin(cycle * 2.7) > -0.2;
        ctx.globalAlpha = (on ? 0.6 : 0.12) * intensity;
        ctx.setLineDash([3, 5]);
        ctx.strokeRect(-p.radius - 8, -p.radius - 12, p.radius * 2 + 16, p.radius * 2 + 16);
        ctx.setLineDash([]);
      } else if (paletteEffect.kind === 'wave') {
        for (let i = 0; i < 2; i += 1) {
          const travel = ((phase * paletteEffect.speed + i * 0.5) % 1);
          ctx.globalAlpha = (1 - travel) * 0.42 * intensity;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.radius + 8 + travel * 28, (p.radius + 8 + travel * 28) * 0.42, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    const invuln = w.now < p.invulnUntil && w.outcome === 'running';
    const blink = invuln && Math.floor(w.now / 70) % 2 === 0;
    const stealthed = w.now < w.stealthUntil;
    const stealthAlpha = w.stealthConfig?.fullInvisible ? 0.12 : 0.32;
    ctx.save();
    if (w.character.rarity === 'legendary') {
      ctx.shadowColor = w.character.palette.glow;
      ctx.shadowBlur = 13 + Math.sin(w.now / 180) * 3;
    }
    drawRig(
      ctx,
      w.character.rig,
      w.character.palette,
      p.anim,
      w.now - p.animStartedAt,
      p.x,
      p.y + 2 + fallProgress * 12,
      p.facing,
      scale * (1 - fallProgress * 0.72) * musicVisual(w, w.character.react, 'scale'),
      {
        flash: w.now < p.hitFlashUntil,
        outline: true,
        alpha: blink ? 0.45 : stealthed ? stealthAlpha : 1,
        dissolve: w.outcome === 'dead' && !p.falling ? Math.min(0.85, (w.now - p.animStartedAt) / 900) : fallProgress * 0.25,
        tint:
          w.now < w.ultActiveUntil
            ? { color: w.character.palette.glow, alpha: 0.28 }
            : undefined,
      },
    );
    ctx.restore();

    // The base aura stays on the ground for readable movement, while this
    // second layer makes the selected aura clearly wrap the fighter too.
    // It is rendered after the rig so it reads as an intentional cosmetic,
    // not as a floor decal hidden beneath the player.
    ctx.save();
    const headY = p.y - 22 * w.playerSizeMult + fallProgress * 12;
    const overheadRadius = (p.radius + 11) * w.playerSizeMult;
    ctx.strokeStyle = accent;
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    if (w.runAuraStyle === 'street-halo') {
      ctx.globalAlpha = 0.58 + Math.sin(phase * 3) * 0.15;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(p.x, headY - 3, overheadRadius, overheadRadius * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (w.runAuraStyle === 'radar-sweep') {
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(p.x, headY, overheadRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const scan = phase * 3;
      ctx.beginPath();
      ctx.moveTo(p.x, headY);
      ctx.lineTo(p.x + Math.cos(scan) * overheadRadius, headY + Math.sin(scan) * overheadRadius);
      ctx.stroke();
    } else if (w.runAuraStyle === 'ember-orbit') {
      for (let i = 0; i < 3; i += 1) {
        const angle = phase * 3.2 + (i * Math.PI * 2) / 3;
        ctx.globalAlpha = 0.65 + Math.sin(phase * 7 + i) * 0.2;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(angle) * overheadRadius, headY + Math.sin(angle) * (overheadRadius * 0.55), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (w.runAuraStyle === 'rain-signal') {
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.4;
      for (let i = -2; i <= 2; i += 1) {
        const drift = (phase * 22 + i * 8) % 16;
        ctx.beginPath();
        ctx.moveTo(p.x + i * 7 + 2, headY - 14 + drift);
        ctx.lineTo(p.x + i * 7 - 2, headY - 8 + drift);
        ctx.stroke();
      }
    } else if (w.runAuraStyle === 'glitch-echo') {
      ctx.globalAlpha = 0.34;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i += 1) {
        const jitter = Math.sin(phase * 15 + i) * 4;
        ctx.strokeRect(p.x - overheadRadius + jitter, headY - 9 + i * 6, overheadRadius * 2, 2);
      }
    } else if (w.runAuraStyle === 'mothlight') {
      for (let i = 0; i < 4; i += 1) {
        const angle = phase * (1.2 + i * 0.1) + i * 1.6;
        ctx.globalAlpha = 0.45 + Math.sin(phase * 4 + i) * 0.2;
        ctx.save();
        ctx.translate(p.x + Math.cos(angle) * overheadRadius, headY + Math.sin(angle * 1.3) * (overheadRadius * 0.65));
        ctx.rotate(angle);
        ctx.fillRect(-2, -1, 4, 2);
        ctx.restore();
      }
    } else if (w.runAuraStyle === 'tile-bloom') {
      ctx.globalAlpha = 0.5 + Math.sin(phase * 2.2) * 0.18;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.rect(p.x - overheadRadius * 0.5, headY - 4, overheadRadius, 6);
      ctx.stroke();
    }
    ctx.restore();

    // Hats deliberately hover above every rig instead of being attached to a
    // specific head shape. This keeps the first collection readable across
    // the full roster and leaves room for character-specific fitting later.
    if (w.hatStyle !== 'none') {
      ctx.save();
      const hatY = headY - 13 - Math.sin(phase * 2.4) * 1.8;
      ctx.translate(p.x, hatY);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = w.character.palette.accentBright;
      ctx.strokeStyle = w.character.palette.glow;
      ctx.shadowColor = w.character.palette.glow;
      ctx.shadowBlur = 9;
      ctx.lineWidth = 1.5;
      if (w.hatStyle === 'top-hat') {
        ctx.fillRect(-6, -8, 12, 7); ctx.fillRect(-9, -1, 18, 2);
      } else if (w.hatStyle === 'halo') {
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 3, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (w.hatStyle === 'crown') {
        ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(-7, -6); ctx.lineTo(-2, -1); ctx.lineTo(0, -8); ctx.lineTo(3, -1); ctx.lineTo(8, -6); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill();
      } else if (w.hatStyle === 'satellite') {
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 9, -0.9, 0.9); ctx.stroke();
      } else if (w.hatStyle === 'rain-cloud') {
        ctx.beginPath(); ctx.arc(-4, 0, 4, 0, Math.PI * 2); ctx.arc(1, -2, 5, 0, Math.PI * 2); ctx.arc(6, 1, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-7, 0, 16, 3);
      } else if (w.hatStyle === 'cone') {
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-7, 4); ctx.lineTo(7, 4); ctx.closePath(); ctx.fill();
      } else if (w.hatStyle === 'orbital-eye') {
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = w.character.palette.ink; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
      } else if (w.hatStyle === 'moth-cap') {
        ctx.fillRect(-7, -2, 14, 4); ctx.fillRect(-4, -6, 8, 4); ctx.beginPath(); ctx.arc(-7, -3, 3, 0, Math.PI * 2); ctx.arc(7, -3, 3, 0, Math.PI * 2); ctx.fill();
      } else if (w.hatStyle === 'antenna') {
        ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(-3, -9); ctx.moveTo(0, 2); ctx.lineTo(3, -9); ctx.stroke();
        ctx.globalAlpha = 0.6 + Math.sin(phase * 5) * 0.35;
        ctx.beginPath(); ctx.arc(-3, -9, 1.8, 0, Math.PI * 2); ctx.arc(3, -9, 1.8, 0, Math.PI * 2); ctx.fill();
      } else if (w.hatStyle === 'vinyl-disc') {
        ctx.save();
        ctx.rotate(phase * 3.4);
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = w.character.palette.ink;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    if (w.character.id === 'llama-mama' || w.character.id === 'llama-overlord') {
      ctx.save();
      const overheadY = headY - 14;
      const ego = w.llamaEgoScore ?? 0;
      if (ego > 0) {
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        const isOverlord = w.character.id === 'llama-overlord';
        ctx.fillStyle = isOverlord ? '#c084fc' : '#f43f5e';
        ctx.shadowColor = isOverlord ? '#a855f7' : '#fb7185';
        ctx.shadowBlur = 8;
        ctx.fillText(isOverlord ? `👑 SUPREMACY +${ego}` : `👑 EGO +${ego}`, p.x, overheadY);
      }
      if (w.llamaMamaRageUntil && w.now < w.llamaMamaRageUntil) {
        const rageY = ego > 0 ? overheadY - 14 : overheadY;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4500';
        ctx.shadowColor = '#ff6a00';
        ctx.shadowBlur = 12;
        ctx.fillText("WE'RE OVER IT! PERIOD!", p.x, rageY);
      }
      ctx.restore();
    }
  };

  // Full-recolor setting: blend each enemy's own palette with the active
  // world-color theme, same math as the player's own blend
  // (characterSkins.ts's blendSpritePalettes). Cached per enemy id per frame
  // since many enemies on screen share one EnemyDef.
  const enemyColorTheme = w.musicColorOverride ?? (w.worldColorFullRecolor ? w.worldColorPalette : undefined);
  const enemyPaletteCache = enemyColorTheme ? new Map<string, SpritePalette>() : null;
  const resolveEnemyPalette = (def: EnemyDef): SpritePalette => {
    if (!enemyPaletteCache || !enemyColorTheme) return def.palette;
    const cached = enemyPaletteCache.get(def.id);
    if (cached) return cached;
    const blended = blendSpritePalettes(def.palette, enemyColorTheme, 0.35);
    enemyPaletteCache.set(def.id, blended);
    return blended;
  };
  // traits.hueShiftMs: purely visual, continuous hue rotation, never cached
  // per def id like resolveEnemyPalette above -- it varies per instance
  // (offset by uid) and per frame (driven by w.now), so it's computed fresh
  // on top of whatever palette resolveEnemyPalette already produced.
  const withHueShift = (def: EnemyDef, uid: number, base: SpritePalette): SpritePalette => {
    const hueShiftMs = def.traits?.hueShiftMs;
    if (!hueShiftMs) return base;
    const degrees = ((w.now + uid * 137) / hueShiftMs) * 360;
    return hueShiftPalette(base, degrees);
  };

  // Hoisted out of the per-enemy loop: it was a filter-free `some` over every
  // breakable for every visible enemy.
  const liveBreakables = w.breakables.filter((b) => !b.broken);

  for (const enemy of sorted) {
    // Fog of war: hostiles are only drawn where you can currently see. An
    // "explored" cell remembers the terrain, never the units standing on it.
    // Your own units are always drawn -- they are what does the seeing.
    if (w.fog && !enemy.commanded && fogAt(w, enemy.x, enemy.y) < 2) continue;
    if (enemy.y > w.player.y) drawPlayer();
    const converted = enemy.convertedUntil > w.now && !enemy.dying;
    if (!enemy.dying && enemy.def.behavior === 'sentry' && enemy.def.traits?.coneDetect) {
      const detect = enemy.def.traits.coneDetect;
      const halfAngle = (detect.halfAngleDeg * Math.PI) / 180;
      drawScanCone(ctx, w, enemy.x, enemy.y, detect.range, enemy.weave, halfAngle, '#f59e0b', 0.22, w.now, enemy.def.react);
    }
    if (!enemy.dying && enemy.def.behavior === 'tracker' && enemy.def.traits?.lockCone) {
      const lock = enemy.def.traits.lockCone;
      const startHalf = (lock.startHalfAngleDeg * Math.PI) / 180;
      const minHalf = (lock.minHalfAngleDeg * Math.PI) / 180;
      const closeness = 1 - clamp((enemy.weave - minHalf) / Math.max(0.001, startHalf - minHalf), 0, 1);
      const faceAngle = Math.atan2(w.player.y - enemy.y, w.player.x - enemy.x);
      const color = closeness > 0.7 ? '#ff2d55' : '#ef4444';
      drawScanCone(ctx, w, enemy.x, enemy.y, lock.range, faceAngle, enemy.weave, color, 0.2 + closeness * 0.35, w.now, enemy.def.react);
    }
    if (!enemy.dying && enemy.def.behavior === 'beacon' && enemy.def.traits?.colorCone) {
      const cone = enemy.def.traits.colorCone;
      const halfAngle = (cone.halfAngleDeg * Math.PI) / 180;
      const activeKind = cone.kinds[Math.floor(w.now / (cone.flickerMs ?? 1400)) % cone.kinds.length] ?? cone.kinds[0];
      drawScanCone(ctx, w, enemy.x, enemy.y, cone.range, enemy.weave, halfAngle, coneColorForKind(activeKind), 0.26, w.now, enemy.def.react);
    }
    if (!enemy.dying && enemy.def.behavior === 'commander') {
      const shielded = w.now < enemy.shieldedUntil;
      ctx.save();
      if (shielded) {
        // Heavy shield: a solid, slowly rotating hex-ish ring -- undamageable.
        const pulse = 0.6 + 0.4 * Math.sin(w.now / 220);
        ctx.globalAlpha = 0.35 + pulse * 0.25;
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 4;
      } else {
        // Locked on: a thin dashed ring around whoever it's currently buffing.
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -w.now / 15;
      }
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (!enemy.dying && (enemy.telegraphUntil > w.now || enemy.specialUntil > w.now)) {
      const telegraph = enemy.telegraphUntil > w.now;
      const radius = enemy.specialRadius || enemy.radius * 3;
      ctx.save();
      ctx.globalAlpha = telegraph ? 0.72 : 0.28;
      ctx.strokeStyle = enemy.specialKind === 'current' ? '#35d0bb' : '#e879f9';
      ctx.lineWidth = telegraph ? 3 : 6;
      if (telegraph) {
        ctx.setLineDash([10, 7]);
        ctx.lineDashOffset = -w.now / 24;
      }
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, telegraph ? radius * (0.82 + 0.18 * Math.sin(w.now / 90)) : radius, 0, Math.PI * 2);
      ctx.stroke();
      if (telegraph) {
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = enemy.specialKind === 'current' ? '#35d0bb' : '#e879f9';
        ctx.fill();
      }
      ctx.restore();
    }
    const fallProgress = enemy.falling ? clamp((w.now - enemy.fallStartedAt) / 620, 0, 1) : 0;
    const dissolve = enemy.dying && !enemy.falling ? Math.min(0.95, (w.now - enemy.deathAt) / 520) : fallProgress * 0.28;
    const ghosting = enemy.ghostUntil > w.now && !enemy.dying;
    // Wraiths (see oddity-arenas.md): near-fully invisible while lurking, not
    // literally alpha 0 -- a keen-eyed player can still catch a shimmer.
    const hidden = enemy.invisibleUntil > w.now && !enemy.dying;
    const freeze = enemy.activeEffects.find((effect) => effect.id === 'freeze');
    // Zero Day: "stone" enemies -- a flat tint reusing drawRig's existing
    // tint option, plus a frozen anim frame (no idle/attack progression).
    const stoned = enemy.frozenUntil > w.now && !enemy.dying;
    // Sector Command: a selected unit gets a bright ring, and a unit walking
    // to an order gets a thin line to where it is going. Captured units
    // already read as allies via the existing `converted` tint below.
    // Sector Command: a primed enemy is one you can grab *right now*. Without
    // this the capture button was a lottery -- you could not tell who was in
    // the window, or that a window existed.
    if (!enemy.commanded && !enemy.dying && enemy.capturableUntil > w.now) {
      const pulse = 0.55 + 0.35 * Math.sin(w.now / 130);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#65f6d1';
      ctx.shadowColor = '#65f6d1';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      const r = enemy.radius + 10;
      // Four corner brackets read as a reticle without hiding the sprite.
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        ctx.beginPath();
        ctx.moveTo(enemy.x + sx * r, enemy.y + 2 + sy * r - sy * 6);
        ctx.lineTo(enemy.x + sx * r, enemy.y + 2 + sy * r);
        ctx.lineTo(enemy.x + sx * r - sx * 6, enemy.y + 2 + sy * r);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (enemy.commanded && !enemy.dying) {
      if (enemy.selectedForCommand) {
        ctx.save();
        ctx.globalAlpha = 0.6 + 0.25 * Math.sin(w.now / 110);
        ctx.strokeStyle = '#e5faff';
        ctx.shadowColor = '#65f6d1';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y + 2, enemy.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (enemy.orderKind === 'move' || enemy.orderKind === 'attack-move') {
        ctx.save();
        ctx.globalAlpha = 0.22;
        // Attack-move reads red: you are taking ground, not repositioning.
        ctx.strokeStyle = enemy.orderKind === 'attack-move' ? '#ff8f6b' : '#65f6d1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(enemy.orderX, enemy.orderY);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (stoned && enemy.selectedForThrow) {
      const pulse = 0.55 + 0.25 * Math.sin(w.now / 90);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#e5faff';
      ctx.shadowColor = '#7ef9a0';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -w.now / 20;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y + 2, enemy.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (converted) {
      const pulse = 0.72 + Math.sin(w.now / 130) * 0.18;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#65f6d1';
      ctx.shadowColor = '#65f6d1';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y + 2, enemy.radius + 9 + Math.sin(w.now / 170) * 2, 0, Math.PI * 2);
      ctx.stroke();
      // A compact chevron above the enemy reads as "friendly" without
      // obscuring the enemy sprite or the health bar.
      ctx.fillStyle = '#65f6d1';
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y - enemy.radius * 2.25);
      ctx.lineTo(enemy.x - 7, enemy.y - enemy.radius * 2.65);
      ctx.lineTo(enemy.x - 2, enemy.y - enemy.radius * 2.65);
      ctx.lineTo(enemy.x, enemy.y - enemy.radius * 2.42);
      ctx.lineTo(enemy.x + 2, enemy.y - enemy.radius * 2.65);
      ctx.lineTo(enemy.x + 7, enemy.y - enemy.radius * 2.65);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (enemy.isVeteran && !enemy.dying) {
      const affixColors: Record<string, string> = {
        armored: '#38bdf8',
        overclocked: '#facc15',
        incendiary: '#ef4444',
        vampiric: '#e11d48',
        magnetic: '#a855f7',
      };
      const vColor = affixColors[enemy.veteranAffix ?? 'armored'] ?? '#fbbf24';
      ctx.save();
      const vPulse = 0.65 + Math.sin(w.now / 110) * 0.25;
      ctx.globalAlpha = vPulse;
      ctx.strokeStyle = vColor;
      ctx.shadowColor = vColor;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y + 2, enemy.radius + 8, 0, Math.PI * 2);
      ctx.stroke();

      // Veteran Crown / Star insignia above head
      ctx.fillStyle = vColor;
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`★ ${enemy.veteranAffix?.toUpperCase() ?? 'VETERAN'}`, enemy.x, enemy.y - enemy.radius - 8);
      ctx.restore();
    }
    if (freeze && !enemy.dying) {
      const freezeDef = STATUS_EFFECTS_BY_ID.freeze!;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.1 * Math.sin(w.now / 100);
      ctx.strokeStyle = freezeDef.color;
      ctx.shadowColor = freezeDef.color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y + 2, enemy.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (!skipEnemyShadows) drawShadow(ctx, enemy.x, enemy.y + 2, enemy.radius * (1 - Math.max(dissolve, fallProgress) * 0.6));
    let shadowed = false;
    for (let bi = 0; bi < liveBreakables.length; bi += 1) {
      const b = liveBreakables[bi]!;
      if (enemy.x > b.x + 10 - enemy.radius && enemy.x < b.x + b.w + 10 + enemy.radius &&
        enemy.y > b.y + 12 - enemy.radius && enemy.y < b.y + b.h + 12 + enemy.radius) {
        shadowed = true;
        break;
      }
    }
    const enemyAlpha = hidden ? 0.05 : ghosting ? 0.22 : shadowed ? 0.4 : 1;
    const alphaBefore = ctx.globalAlpha;
    ctx.globalAlpha = enemyAlpha;
    const enemyPalette = withHueShift(enemy.def, enemy.uid, resolveEnemyPalette(enemy.def));
    const grossed = enemy.activeEffects.some((effect) => effect.id === 'grossed-out' && effect.expiresAt > w.now);
    const squirmX = grossed ? Math.sin(w.now / 42 + enemy.uid) * 5 : 0;
    drawRig(
      ctx,
      enemy.def.rig,
      enemyPalette,
      enemy.anim,
      stoned ? 0 : w.now - enemy.animStartedAt,
      enemy.x + squirmX,
      enemy.y + 2 + fallProgress * 10,
      enemy.facing,
      SPRITE_SCALE * sizeClassScale(enemy.def) * (enemy.radius / enemy.baseRadius) * (1 - fallProgress * 0.72) * musicVisual(w, enemy.def.react, 'scale'),
      {
        flash: w.now < enemy.hitFlashUntil,
        outline: outlineEnemies || enemy.def.family === 'Boss' || enemy.def.sizeClass === 'giant',
        dissolve,
        tint: stoned
          ? { color: '#22c55e', alpha: 0.68 }
          : converted
          ? { color: '#65f6d1', alpha: 0.42 }
          : freeze ? { color: STATUS_EFFECTS_BY_ID.freeze!.color, alpha: 0.38 } : undefined,
      },
    );
    ctx.globalAlpha = alphaBefore;
    if (grossed) {
      ctx.save();
      ctx.strokeStyle = '#d5f77e';
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 8, -0.8, 2.8);
      ctx.stroke();
      ctx.restore();
    }

    if (!hidden && !enemy.dying && enemy.def.faction === 'Data Goblins') {
      const fleeing = w.area.id === 'rapid-pressure-rooms'
        && w.rescue.status === 'freed'
        && enemy.def.id !== 'data-gob-archgnawer';
      let nearbyData: (typeof w.breakables)[number] | undefined;
      let nearbyDistance = Number.POSITIVE_INFINITY;
      for (const prop of w.breakables) {
        if (prop.broken || !prop.breakable) continue;
        const candidateDistance = Math.hypot(enemy.x - prop.x, enemy.y - prop.y);
        if (candidateDistance >= nearbyDistance) continue;
        nearbyData = prop;
        nearbyDistance = candidateDistance;
      }
      const chewing = !fleeing && enemy.anim === 'attack' && nearbyData
        && nearbyDistance < 150;
      ctx.save();
      if (fleeing) {
        ctx.strokeStyle = '#86efac';
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 2;
        for (let trail = 0; trail < 3; trail += 1) {
          const offset = 12 + trail * 8;
          ctx.beginPath();
          ctx.moveTo(enemy.x - enemy.facing * offset, enemy.y - 5);
          ctx.lineTo(enemy.x - enemy.facing * (offset + 6), enemy.y);
          ctx.lineTo(enemy.x - enemy.facing * offset, enemy.y + 5);
          ctx.stroke();
        }
      } else if (chewing && nearbyData) {
        ctx.strokeStyle = '#67e8f9';
        ctx.fillStyle = '#d9f99d';
        ctx.globalAlpha = 0.82;
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = -w.now / 45;
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(nearbyData.x, nearbyData.y);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let bit = 0; bit < 3; bit += 1) {
          const phase = ((w.now / 420) + bit / 3) % 1;
          ctx.fillRect(
            nearbyData.x + (enemy.x - nearbyData.x) * phase - 1.5,
            nearbyData.y + (enemy.y - nearbyData.y) * phase - 1.5,
            3,
            3,
          );
        }
      } else {
        ctx.strokeStyle = '#86efac';
        ctx.globalAlpha = 0.38 + Math.sin((w.now + enemy.uid * 70) / 170) * 0.12;
        ctx.setLineDash([2, 6]);
        ctx.lineDashOffset = w.now / 70;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Health bar for anything meaningfully tough.
    if (!hidden && !enemy.dying && enemy.hp < enemy.maxHp && enemy.maxHp > 60) {
      const width = Math.max(22, enemy.radius * 2.2);
      const top = enemy.y - enemy.radius * 2.6;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(enemy.x - width / 2, top, width, 4);
      ctx.fillStyle = converted ? '#65f6d1' : enemyPalette.accent;
      ctx.fillRect(enemy.x - width / 2, top, width * (enemy.hp / enemy.maxHp), 4);
    }

    if (enemy.cutifiedUntil && enemy.cutifiedUntil > w.now && !enemy.dying) {
      ctx.save();
      const heartPulse = Math.sin((w.now + enemy.uid * 130) / 180) * 3;
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#fb7185';
      ctx.shadowBlur = 6;
      ctx.fillText('❤', enemy.x - 7, enemy.y - enemy.radius - 10 + heartPulse);
      ctx.fillText('❤', enemy.x + 7, enemy.y - enemy.radius - 14 - heartPulse);

      const bubblePhase = (w.now / 350 + enemy.uid) % (Math.PI * 2);
      ctx.strokeStyle = '#fbcfe8';
      ctx.fillStyle = 'rgba(251, 207, 232, 0.4)';
      ctx.lineWidth = 1.5;
      for (let bi = 0; bi < 3; bi += 1) {
        const bx = enemy.x + Math.sin(bubblePhase + bi * 2.1) * (enemy.radius + 8);
        const by = enemy.y - enemy.radius - (bi * 9) - (bubblePhase * 5);
        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  drawPlayer();
  drawGuests(ctx, w);
}

/**
 * Million Horde crowd: every dot is a real member of the crowd field with its
 * own position, waiting in the shell just outside the camera until a live
 * actor slot opens. Only the sampled in-view subset is drawn (bounded per
 * frame), batched into two paths, so the cost does not grow with population.
 */
function drawMillionHordeCrowd(ctx: CanvasRenderingContext2D, w: World, bounds: ViewBounds) {
  const field = w.hordeField;
  if (!field || field.count === 0) return;
  const margin = 10;
  const left = bounds.left - margin;
  const right = bounds.right + margin;
  const top = bounds.top - margin;
  const bottom = bounds.bottom + margin;
  const count = field.count;
  const xs = field.x;
  const ys = field.y;
  const visible = field.visible;
  const limit = w.graphicsQuality === 'performance' ? 1800 : w.graphicsQuality === 'balanced' ? 3600 : field.visibleCount;
  const total = Math.min(field.visibleCount, limit);

  ctx.save();
  ctx.fillStyle = '#ef4444';
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  for (let k = 0; k < total; k += 1) {
    const i = visible[k]!;
    if (i >= count || k % 5 === 0) continue;
    const x = xs[i]!;
    const y = ys[i]!;
    if (x < left || x > right || y < top || y > bottom) continue;
    ctx.rect(x - 1.1, y - 1.6, 2.2, 3.2);
  }
  ctx.fill();
  ctx.fillStyle = '#fecaca';
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (let k = 0; k < total; k += 5) {
    const i = visible[k]!;
    if (i >= count) continue;
    const x = xs[i]!;
    const y = ys[i]!;
    if (x < left || x > right || y < top || y > bottom) continue;
    ctx.rect(x - 1.1, y - 1.6, 2.2, 3.2);
  }
  ctx.fill();
  ctx.restore();
}

/**
 * Screen-space edge glow that thickens with the size of the waiting crowd, so
 * a population too large to draw dot by dot still reads as a mass pressing in.
 * Four gradient strips: constant cost at any population.
 */
function drawMillionHordePressure(ctx: CanvasRenderingContext2D, w: World, width: number, height: number) {
  const field = w.hordeField;
  if (!field || field.count < 20_000) return;
  const density = clamp(Math.log10(field.count) / 7, 0.2, 1);
  const alpha = 0.1 + density * 0.2;
  const depthX = Math.min(width * 0.16, 150);
  const depthY = Math.min(height * 0.2, 130);
  const edge = `rgba(239,68,68,${alpha.toFixed(3)})`;
  const clear = 'rgba(239,68,68,0)';
  const strip = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, edge);
    g.addColorStop(1, clear);
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };
  strip(0, 0, depthX, 0, 0, 0, depthX, height);
  strip(width, 0, width - depthX, 0, width - depthX, 0, depthX, height);
  strip(0, 0, 0, depthY, 0, 0, width, depthY);
  strip(0, height, 0, height - depthY, 0, height - depthY, width, depthY);
}

/**
 * LokSurvivorArena: guests get a plain rig draw -- shadow, rig, name/kill
 * tag -- deliberately skipping the host's aura/dash/palette-effect
 * cosmetics in `drawPlayer` above, since none of that state exists on a
 * `GuestPlayerActor`. Drawn after the enemy/host painter's-order pass
 * rather than interleaved into it, so a guest can occasionally draw in
 * front of/behind a nearby enemy it shouldn't -- a cosmetic compromise, not
 * a gameplay one, and fine for the arena skeleton.
 */
function drawGuests(ctx: CanvasRenderingContext2D, w: World) {
  for (const guest of w.guests) {
    drawShadow(ctx, guest.x, guest.y + 2, guest.radius);
    drawRig(
      ctx,
      guest.character.rig,
      guest.character.palette,
      guest.anim,
      w.now - guest.animStartedAt,
      guest.x,
      guest.y + 2,
      guest.facing,
      SPRITE_SCALE,
      { flash: w.now < guest.hitFlashUntil, outline: true, alpha: 1 },
    );
    ctx.save();
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = guest.character.palette.accentBright;
    ctx.textAlign = 'center';
    ctx.fillText(guest.id, guest.x, guest.y - guest.radius - 12);
    ctx.restore();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, w: World, bounds: ViewBounds, visualBudget: NonNullable<Viewport['visualBudget']>) {
  const limit = visualBudget === 'minimal' ? 56 : visualBudget === 'reduced' ? 112 : Number.POSITIVE_INFINITY;
  const stride = visualBudget === 'minimal' ? 3 : visualBudget === 'reduced' ? 2 : 1;
  let drawn = 0;
  for (let index = 0; index < w.particles.length; index += 1) {
    const particle = w.particles[index]!;
    if (!isNearView(particle.x, particle.y, bounds, 12) || index % stride !== 0 || drawn >= limit) continue;
    drawn += 1;
    const life = (w.now - particle.bornAt) / particle.lifeMs;
    ctx.globalAlpha = Math.max(0, 1 - life);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

/**
 * One cascade-style damage number: sized by tier, outlined for contrast, with
 * a quick scale-pop on landing, a fade over the last third of its life, and a
 * colored glow from `GLOW_FROM_TIER` up (skipped on the minimal visual budget).
 * Caller has set `textAlign = 'center'`.
 */
function drawCascadePopup(ctx: CanvasRenderingContext2D, w: World, popup: Popup, allowGlow: boolean) {
  const tier = DAMAGE_TIERS[popup.tier ?? 0]!;
  const age = w.now - popup.bornAt;
  const life = age / (popup.lifeMs ?? 1500);
  const pop = age < 140 ? 1 + 0.45 * (1 - age / 140) : 1;
  const size = Math.round(tier.size * pop);
  ctx.globalAlpha = life < 0.65 ? 1 : Math.max(0, 1 - (life - 0.65) / 0.35);
  ctx.font = `900 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(popup.text, popup.x, popup.y);
  if (allowGlow && (popup.tier ?? 0) >= GLOW_FROM_TIER) {
    ctx.shadowColor = popup.color;
    ctx.shadowBlur = 8 + (popup.tier ?? 0);
  }
  ctx.fillStyle = popup.color;
  ctx.fillText(popup.text, popup.x, popup.y);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 13px ui-monospace, SFMono-Regular, Menlo, monospace';
}

function drawPopups(ctx: CanvasRenderingContext2D, w: World, bounds: ViewBounds, visualBudget: NonNullable<Viewport['visualBudget']>) {
  ctx.font = 'bold 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  const limit = visualBudget === 'minimal' ? 18 : visualBudget === 'reduced' ? 28 : Number.POSITIVE_INFINITY;
  let drawn = 0;
  for (const popup of w.popups) {
    if (!isNearView(popup.x, popup.y, bounds, 32) || drawn >= limit) continue;
    drawn += 1;
    if (popup.tier !== undefined) {
      drawCascadePopup(ctx, w, popup, visualBudget !== 'minimal');
      continue;
    }
    const life = (w.now - popup.bornAt) / 700;
    ctx.globalAlpha = Math.max(0, 1 - life);
    ctx.fillStyle = '#000000';
    ctx.fillText(popup.text, popup.x + 1, popup.y + 1);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, popup.y);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
}

/* ------------------------------------------------------------------ */
/* Electric chains & Bubble wash mechanics                             */
/* ------------------------------------------------------------------ */

function drawElectricChains(ctx: CanvasRenderingContext2D, w: World) {
  if (!w.electricChains || w.electricChains.length === 0) return;
  ctx.save();
  for (const chain of w.electricChains) {
    const age = w.now - chain.bornAt;
    const dur = chain.expiresAt - chain.bornAt;
    const progress = age / Math.max(1, dur);
    const alpha = Math.max(0, 1 - progress);

    ctx.strokeStyle = chain.style === 'catenary' ? '#fbbf24' : '#38bdf8';
    ctx.shadowColor = chain.style === 'catenary' ? '#f59e0b' : '#0284c7';
    ctx.shadowBlur = chain.style === 'catenary' ? 16 : 10;
    ctx.lineWidth = chain.style === 'catenary' ? 4 : 2.5;
    ctx.globalAlpha = alpha;

    const dx = chain.x2 - chain.x1;
    const dy = chain.y2 - chain.y1;
    const dist = Math.hypot(dx, dy);
    const segments = Math.max(4, Math.floor(dist / 14));

    ctx.beginPath();
    ctx.moveTo(chain.x1, chain.y1);
    const normalX = -dy / (dist || 1);
    const normalY = dx / (dist || 1);

    for (let i = 1; i < segments; i += 1) {
      const t = i / segments;
      const jitter = (Math.sin(w.now / 30 + i * 3) * 7) + Math.sin(i * 11.7 + chain.bornAt) * 2.5;
      const sx = chain.x1 + dx * t + normalX * jitter;
      const sy = chain.y1 + dy * t + normalY * jitter;
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(chain.x2, chain.y2);
    ctx.stroke();

    // Hot white inner lightning core
    ctx.strokeStyle = chain.style === 'catenary' ? '#67e8f9' : '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (chain.style === 'catenary') {
      ctx.fillStyle = '#e0f2fe';
      for (let i = 1; i < 4; i += 1) {
        const t = i / 4;
        ctx.beginPath(); ctx.arc(chain.x1 + dx * t, chain.y1 + dy * t, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawMapSetPieces(ctx: CanvasRenderingContext2D, w: World) {
  if (!w.area.mapFeature && !w.area.mapInteractables?.length) return;
  ctx.save();
  if (w.area.mapFeature === 'fractured-616') {
    ctx.translate(-70, -80);
    ctx.rotate(-0.045);
    ctx.font = '900 154px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#fbbf24'; ctx.fillText('616', 0, 0);
    ctx.lineWidth = 5; ctx.strokeStyle = '#67e8f9'; ctx.strokeText('616', 0, 0);
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#0b1724'; ctx.lineWidth = 8;
    for (const offset of [-54, 0, 53]) {
      ctx.beginPath(); ctx.moveTo(offset - 18, -73); ctx.lineTo(offset + 7, -17); ctx.lineTo(offset - 10, 65); ctx.stroke();
    }
  } else if (w.area.mapFeature === 'glassroot-shrine') {
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 4; ctx.globalAlpha = 0.4;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath(); ctx.ellipse(0, 0, 110 + i * 39, 79 + i * 29, i * 0.25, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();

  const relays = w.area.mapInteractables?.filter((entry) => entry.kind === 'relay') ?? [];
  const anchors = w.area.mapInteractables?.filter((entry) => entry.kind === 'root-anchor') ?? [];
  const sporesQuiet = anchors.length > 0 && anchors.every((entry) => w.mapActivated.has(entry.id));
  for (const entry of w.area.mapInteractables ?? []) {
    if (entry.kind === 'plate' && !relays.every((relay) => w.mapActivated.has(relay.id))) continue;
    const active = w.mapActivated.has(entry.id);
    if (entry.kind === 'relay') {
      ctx.save();
      ctx.fillStyle = '#10232e'; ctx.strokeStyle = active ? '#5eead4' : '#fbbf24'; ctx.lineWidth = 3;
      ctx.fillRect(entry.x - 21, entry.y - 17, 42, 34); ctx.strokeRect(entry.x - 21, entry.y - 17, 42, 34);
      ctx.fillStyle = active ? '#5eead4' : '#fbbf24'; ctx.fillRect(entry.x - 14, entry.y - 9, 28, 5);
      ctx.fillStyle = active ? '#34d399' : '#fb7185'; ctx.beginPath(); ctx.arc(entry.x, entry.y + 7, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (entry.kind === 'root-anchor' && sporesQuiet) continue;
    if (entry.kind === 'root-anchor' || entry.kind === 'relay') {
      if (active) continue;
      const color = entry.kind === 'relay' ? '#fbbf24' : '#5eead4';
      ctx.save(); ctx.globalAlpha = 0.28; ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(entry.x, entry.y, 45 + Math.sin(w.now / 380) * 4, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (!active && (entry.kind === 'cache' || entry.kind === 'plate' || entry.kind === 'coil')) {
      ctx.save(); ctx.strokeStyle = entry.kind === 'plate' ? '#fbbf24' : '#67e8f9'; ctx.fillStyle = '#071116';
      ctx.lineWidth = 3; ctx.fillRect(entry.x - 17, entry.y - 17, 34, 34); ctx.strokeRect(entry.x - 17, entry.y - 17, 34, 34);
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e0f2fe'; ctx.fillText(entry.kind === 'plate' ? '616' : entry.kind === 'coil' ? '⚡' : '▣', entry.x, entry.y);
      ctx.restore();
    }
  }
  if (w.area.mapFeature === 'fractured-616' && !sporesQuiet && w.graphicsQuality !== 'performance') {
    ctx.save(); ctx.fillStyle = '#6ee7b7';
    for (let i = 0; i < 24; i += 1) {
      const px = 250 + (i * 149) % 850;
      const py = -720 + ((i * 227 + w.now / 35) % 1390);
      ctx.globalAlpha = 0.12 + (i % 3) * 0.06;
      ctx.beginPath(); ctx.arc(px, py, 2 + i % 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  if (w.area.mapFeature === 'fractured-616' && w.graphicsQuality === 'high') {
    ctx.save();
    for (const [drainX, drainY] of [[-820, 95], [-340, 410], [-610, -415]]) {
      ctx.fillStyle = '#cbd5e1';
      for (let plume = 0; plume < 5; plume += 1) {
        const phase = ((w.now / 85 + plume * 17) % 90) / 90;
        ctx.globalAlpha = 0.12 * (1 - phase);
        ctx.beginPath();
        ctx.ellipse(drainX + Math.sin(w.now / 680 + plume) * 9, drainY - phase * 85, 6 + phase * 13, 3 + phase * 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function drawBubbleWash(ctx: CanvasRenderingContext2D, w: World) {
  if (!w.bubbleWash) return;
  const bw = w.bubbleWash;

  // Draw suds foam particles
  if (bw.foamParticles.length > 0) {
    ctx.save();
    for (const fp of bw.foamParticles) {
      ctx.save();
      ctx.translate(fp.x, fp.y);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = fp.color;
      ctx.beginPath();
      ctx.arc(0, 0, fp.r, 0, Math.PI * 2);
      ctx.fill();

      // Specular shine highlight
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(-fp.r * 0.35, -fp.r * 0.35, fp.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Draw warning or surge wash overlay
  if (bw.state === 'warning' || bw.state === 'surging') {
    ctx.save();
    const isSurging = bw.state === 'surging';
    const pulse = (Math.sin(w.now / (isSurging ? 60 : 130)) + 1) * 0.5;
    const alpha = isSurging ? 0.2 + pulse * 0.15 : 0.08 + pulse * 0.12;
    ctx.fillStyle = bw.direction > 0 ? `rgba(236, 72, 153, ${alpha})` : `rgba(56, 189, 248, ${alpha})`;
    const halfW = w.bounds.w / 2;
    const halfH = w.bounds.h / 2;
    ctx.fillRect(-halfW, -halfH, w.bounds.w, w.bounds.h);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * How many world units are shown across the screen's width, before the
 * `zoom = width / targetView` division that turns it into a scale factor.
 * Keeping the width:targetView ratio constant (~0.78) is what keeps the
 * camera showing "roughly the same slice of the world" as screen width
 * changes -- the cap below exists only to bound the view distance on truly
 * huge (ultra-wide/4K) monitors, and must stay well above the width of
 * ordinary desktop/laptop screens (1280-1920) or those screens creep past
 * the intended ratio and the camera reads as progressively more zoomed in
 * the wider the window gets.
 */
export function targetViewForWidth(width: number, override?: number): number {
  return Math.max(1, override ?? (width < 620 ? 470 : Math.min(1500, width * 0.78)));
}

/** Completed Artiste marks linger in world space just long enough to read. */
function drawArtisteTrail(ctx: CanvasRenderingContext2D, w: World) {
  const state = w.artisteDraw;
  if (!state || state.points.length < 2 || w.now >= state.visibleUntil) return;
  const alpha = Math.max(0, Math.min(1, (state.visibleUntil - w.now) / 520));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = w.character.palette.glow;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = w.character.palette.accent;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(state.points[0]!.x, state.points[0]!.y);
  for (let index = 1; index < state.points.length; index += 1) {
    const point = state.points[index]!;
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = w.character.palette.accentBright;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

/**
 * Scenery only, for the page overlay's reveal layer: the area's ground, authored tiles, street dressing and
 * landmark, drawn straight to `ctx` with no shake, actors, sky or lighting. `cam` is the world point at the
 * centre of the canvas. Deterministic in (world, cam), so it can be redrawn every frame and animate (disco
 * hue-cycle follows `w.now`). `w` can be any World; the overlay uses a second, never-stepped one built from a
 * real area, because its own area is a black page-sized arena.
 */
export function renderGroundLayer(
  ctx: CanvasRenderingContext2D,
  w: World,
  view: Pick<Viewport, 'width' | 'height' | 'dpr' | 'targetViewOverride'>,
  cam: { x: number; y: number },
) {
  const { width, height, dpr } = view;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const zoom = Math.max(0.001, width / targetViewForWidth(width, view.targetViewOverride));
  ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);
  const left = cam.x - width / 2 / zoom - 40;
  const right = cam.x + width / 2 / zoom + 40;
  const top = cam.y - height / 2 / zoom - 40;
  const bottom = cam.y + height / 2 / zoom + 40;
  drawGround(ctx, w, left, top, right, bottom);
  drawAuthoredGroundTiles(ctx, w);
  drawStreetDressing(ctx, w, left, top, right, bottom);
  drawLandmark(ctx, w);
  const tint = timeOfDayTint(w.cycle.phase);
  if (tint !== 'rgba(0, 0, 0, 0.000)') {
    ctx.fillStyle = tint;
    ctx.fillRect(left, top, right - left, bottom - top);
  }
  ctx.restore();
}

export function renderWorld(ctx: CanvasRenderingContext2D, w: World, view: Viewport) {
  const { width, height, dpr } = view;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;

  // Show roughly the same slice of the world regardless of screen size,
  // unless a caller (the map editor's whole-map preview) asks for a
  // specific slice width.
  const targetView = targetViewForWidth(width, view.targetViewOverride);
  const zoom = Math.max(0.001, width / targetView);

  const overlay = view.overlay === true;
  ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
  if (overlay) {
    if (!view.preserve) ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = '#06060a';
    ctx.fillRect(0, 0, width, height);
  }

  // The page overlay shakes the real scroll position in whole cells instead, so the page and the
  // game move together; a fractional random translate here would tear the sprites off the pixel grid.
  const shakeX = !overlay && w.shake > 0 ? (Math.random() - 0.5) * w.shake : 0;
  const shakeY = !overlay && w.shake > 0 ? (Math.random() - 0.5) * w.shake : 0;

  ctx.save();
  ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
  ctx.scale(zoom, zoom);
  ctx.translate(-w.camera.x, -w.camera.y);

  const halfViewW = width / 2 / zoom;
  const halfViewH = height / 2 / zoom;
  const left = w.camera.x - halfViewW - 40;
  const right = w.camera.x + halfViewW + 40;
  const top = w.camera.y - halfViewH - 40;
  const bottom = w.camera.y + halfViewH + 40;
  const viewBounds = { left, top, right, bottom };
  // At the standard cap, let high quality stay visually complete. Once the
  // screen is genuinely busy, keep player-facing combat cues while reducing
  // only nonessential VFX. A smaller backing scale supplied by RunScreen is
  // a separate, last-resort safeguard for a slower device.
  const visualBudget = view.visualBudget
    ?? (w.graphicsQuality === 'performance' && w.enemies.length >= 80
      ? 'minimal'
      : w.graphicsQuality !== 'high' && w.enemies.length >= 150
        ? 'reduced'
        : 'full');

  // Use the era's ground palette when inside a dungeon room.
  const ground = effectiveGround(w);
  const sky = effectiveSky(w);
  const profile = SKY_PROFILES[sky];
  // Settings toggle: some players would rather birds/fireflies stay put
  // through bad weather than duck out of sight for it.
  const showBirds = profile.birds || !w.wildlifeSheltersInRain;
  const showFireflies = profile.fireflies || !w.wildlifeSheltersInRain;
  const cloudPuffs = overlay ? [] : computeCloudPuffs(w, profile, left, top, right, bottom);
  // Overlay mode skips every layer that paints the environment; only the
  // actors/pickups/effects below are drawn, over a transparent canvas.
  if (!overlay) {
    drawGround(ctx, { ...w, area: { ...w.area, ground } }, left, top, right, bottom);
    drawAuthoredGroundTiles(ctx, w);
    if (w.endless?.inDungeon) {
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.1 + Math.min(0.08, w.endless.dungeonEraIndex * 0.015);
      ctx.fillRect(left, top, right - left, bottom - top);
      ctx.globalAlpha = 1;
    }
    const tint = timeOfDayTint(w.cycle.phase);
    if (tint !== 'rgba(0, 0, 0, 0.000)') {
      ctx.fillStyle = tint;
      // Low-Light Optics: keep a hint of the time-of-day mood without the city
      // actually hiding anything from a player who paid not to be surprised.
      ctx.globalAlpha = w.nightVisionEnabled ? 0.25 : 1;
      ctx.fillRect(left, top, right - left, bottom - top);
      ctx.globalAlpha = 1;
    }
    drawCloudShadows(ctx, cloudPuffs, profile);
    drawWetSheen(ctx, w, left, top, right, bottom, profile.rain);
    drawCityMapFeatures(ctx, w);
    drawEndlessRouteEvent(ctx, w);
    drawBuildingInterior(ctx, w);
    drawStreetDressing(ctx, { ...w, area: { ...w.area, ground } }, left, top, right, bottom);
    drawMapSetPieces(ctx, w);
    drawMillionHordeCrowd(ctx, w, viewBounds);
    drawLightPool(ctx, w);
    drawLandmark(ctx, w);
    drawDistrictIncursion(ctx, w);
    drawObjectLighting(ctx, w);
    if (sky !== 'roofed') {
      drawSteamVents(ctx, w, left, top, right, bottom);
      if (showFireflies) drawRoadFireflies(ctx, w, left, top, right, bottom);
      if (profile.litter) drawWindLitter(ctx, w, left, top, right, bottom);
      drawPuddleRipples(ctx, w, left, top, right, bottom, profile.rain);
    }
    drawBeacons(ctx, w);
    drawArenaEdges(ctx, w, { left, top, right, bottom });
    drawFog(ctx, w, left, top, right, bottom);
    drawDungeonRoomBorder(ctx, w);
  }
  drawPersistentAura(ctx, w);
  drawRescue(ctx, w);
  drawPickups(ctx, w);
  if (!overlay) {
    drawDungeonEntrances(ctx, w);
    drawDungeonExit(ctx, w);
    drawDungeonChest(ctx, w);
  }
  drawFluids(ctx, w);
  if (!overlay) {
    drawPotholes(ctx, w);
    drawAmbient(ctx, w);
    drawObstacles(ctx, w, viewBounds);
    drawAwarenessArrow(ctx, w);
    drawRoamingDetectors(ctx, w);
  }
  drawArtisteTrail(ctx, w);
  drawActors(ctx, w, { left, top, right, bottom });
  if (w.frogSwing) {
    const caught = w.enemies.find((enemy) => enemy.uid === w.frogSwing!.targetUid && !enemy.dying);
    if (caught) {
      ctx.save();
      const digiFrog = LOKPET_VARIANTS_BY_ID['circuit-frog']!;
      drawRig(ctx, evolvedRig('circuit-frog', []), lokPetSpritePalette(digiFrog.palette), 'idle', w.now - w.frogSwing.startedAt, w.player.x + w.player.facing * 13, w.player.y - 8, w.player.facing, LOKPET_SPRITE_SCALE * 0.66);
      ctx.strokeStyle = '#f28dbd';
      ctx.shadowColor = '#7ee787';
      ctx.shadowBlur = 14;
      ctx.lineWidth = w.frogSwing.evolved ? 8 : 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w.player.x, w.player.y - 6);
      ctx.quadraticCurveTo((w.player.x + caught.x) / 2, (w.player.y + caught.y) / 2 - 20, caught.x, caught.y);
      ctx.stroke();
      ctx.fillStyle = '#b5f59d';
      ctx.beginPath();
      ctx.arc(caught.x, caught.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  drawRunningMan(ctx, w);
  drawPlayerConeMark(ctx, w);
  drawStormCloud(ctx, w);
  drawOrbiters(ctx, w);
  drawEffects(ctx, w, viewBounds, visualBudget);
  drawBubbleWash(ctx, w);
  drawElectricChains(ctx, w);
  drawProjectiles(ctx, w, viewBounds);
  drawPendingMeteors(ctx, w);
  drawParticles(ctx, w, viewBounds, visualBudget);
  drawPopups(ctx, w, viewBounds, visualBudget);
  if (sky !== 'roofed' && !overlay) {
    if (showBirds) drawBirds(ctx, w, left, top, right, bottom);
    drawClouds(ctx, w, cloudPuffs, profile);
    drawFogBanks(ctx, w, left, top, right, bottom, profile.fog);
    drawRain(ctx, w, left, top, right, bottom, profile.rain);
    drawAtmosphericParticles(ctx, w, left, top, right, bottom, sky);
  }

  ctx.restore();

  // Vignette keeps the eye on the middle of the fight.
  if (!overlay) {
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.38,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.78,
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  if (!overlay) drawMillionHordePressure(ctx, w, width, height);

  // Distant lightning, under the damage flash so a hit still reads as red.
  const bolt = overlay ? 0 : lightningIntensity(w.now, profile.lightningPeriodMs);
  if (bolt > 0) {
    ctx.globalAlpha = bolt * (sky === 'cyber-storm' ? 0.22 : 0.16);
    ctx.fillStyle = sky === 'cyber-storm' ? '#d8b4fe' : '#cfe0ff';
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  // Damage flash.
  const sinceHit = w.now - w.player.lastDamageAt;
  if (sinceHit < 260) {
    ctx.globalAlpha = (1 - sinceHit / 260) * 0.3;
    ctx.fillStyle = '#ff2d55';
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  // Full-screen impact flash (Firefly Cannon, special explosions)
  if (w.screenFlash && w.now < w.screenFlash.until) {
    const elapsed = w.now - w.screenFlash.startedAt;
    const progress = Math.min(1, Math.max(0, elapsed / Math.max(1, w.screenFlash.durationMs)));
    ctx.globalAlpha = (1 - progress) * w.screenFlash.maxAlpha;
    ctx.fillStyle = w.screenFlash.color;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
}
