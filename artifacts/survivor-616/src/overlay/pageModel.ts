/**
 * Pure (DOM-free) half of the page overlay: how a measured web page becomes a
 * game world. Everything here is deterministic and unit-tested under
 * `node:test`; the DOM-touching parts live in `scanner.ts`/`hider.ts`.
 *
 * Coordinate contract: the world is centred on (0,0) and `bounds` is the
 * FULL extent (the engine halves it), so `world = page - docSize/2`.
 */
import type { AreaDef, ObstacleDef } from '@/game/types';
import { WORLD_K } from './scale';

export interface DocSize {
  w: number;
  h: number;
}

/** One measurable element of the host page, in page (not viewport) pixels. */
/** What a block IS on the page. Drives what it drops and how tough it is. */
export type BlockRole = 'text' | 'link' | 'heading' | 'button' | 'image' | 'frame' | 'input' | 'box';

export interface PageBlock {
  /** Index into the scan result; also the `domId` the engine carries on the breakable. */
  id: number;
  /** Index into the scan's `elements` of the element this block is cut from / hides. */
  owner: number;
  /**
   * `box`: a whole element (image, button, small painted box) that disappears when broken.
   * `text`: one chunk of a line of text; breaking it cuts a hole in the owner instead.
   */
  kind: 'box' | 'text';
  role: BlockRole;
  /** HP multiplier from page structure (footer 2.5, nav/header 1.5, article 0.8, headings extra); 1 is plain. */
  armor: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  destroyed: boolean;
  /** Excluded from play (e.g. it sat on the player's spawn). The element is left untouched. */
  skip: boolean;
}

/** Hard cap on blocks alive in the world at once (reference clone and spike budget agree on ~1.5k). */
export const MAX_ACTIVE_BLOCKS = 1500;
/** The world keeps blocks within this many viewport heights either side of the player. */
export const STREAM_SPAN_VIEWPORTS = 1.5;

const MAX_DOC_W = 8000;
const MAX_DOC_H = 30000;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Tougher the bigger it is, so a hero image outlasts a link. Same shape as the reference clone's area scaling. */
export function blockHp(w: number, h: number): number {
  return clamp(Math.round((w * h) / 140), 18, 420);
}

export function clampDocSize(size: DocSize, viewport: DocSize): DocSize {
  return {
    w: clamp(Math.round(size.w), Math.max(1, viewport.w), MAX_DOC_W),
    h: clamp(Math.round(size.h), Math.max(1, viewport.h), MAX_DOC_H),
  };
}

export function pageToWorld(px: number, py: number, doc: DocSize, k: number = WORLD_K): { x: number; y: number } {
  return { x: (px - doc.w / 2) / k, y: (py - doc.h / 2) / k };
}

export function worldToPage(wx: number, wy: number, doc: DocSize, k: number = WORLD_K): { x: number; y: number } {
  return { x: wx * k + doc.w / 2, y: wy * k + doc.h / 2 };
}

/**
 * The engine wants centres in world units; the page gives top-left corners in css px. Page blocks are `soft`:
 * solid to the player, but enemies walk through them (so a horde never jams on a paragraph) and so does a dash.
 */
export function blockToObstacle(b: PageBlock, doc: DocSize, k: number = WORLD_K): ObstacleDef {
  const c = pageToWorld(b.x + b.w / 2, b.y + b.h / 2, doc, k);
  return { x: c.x, y: c.y, w: b.w / k, h: b.h / k, kind: 'page-block', hp: b.hp, domId: b.id, soft: true };
}

/**
 * Camera that lines the world up with a canvas pinned to the viewport: the
 * canvas centre sits over page point (scroll + canvas/2).
 */
export function cameraForScroll(
  scroll: { x: number; y: number },
  canvasCss: DocSize,
  doc: DocSize,
  k: number = WORLD_K,
): { x: number; y: number } {
  return pageToWorld(scroll.x + canvasCss.w / 2, scroll.y + canvasCss.h / 2, doc, k);
}

/** Scroll position that centres a page point in the viewport, clamped to what the page can scroll. */
export function scrollTargetFor(
  pagePoint: { x: number; y: number },
  viewport: DocSize,
  doc: DocSize,
): { x: number; y: number } {
  return {
    x: clamp(pagePoint.x - viewport.w / 2, 0, Math.max(0, doc.w - viewport.w)),
    y: clamp(pagePoint.y - viewport.h / 2, 0, Math.max(0, doc.h - viewport.h)),
  };
}

/** Blocks that should be alive in the world right now: inside the vertical window, nearest first when over the cap. */
export function selectActive(
  blocks: readonly PageBlock[],
  centerPageY: number,
  viewportH: number,
  cap = MAX_ACTIVE_BLOCKS,
): PageBlock[] {
  const span = viewportH * STREAM_SPAN_VIEWPORTS;
  const lo = centerPageY - span;
  const hi = centerPageY + span;
  const inWindow = blocks.filter((b) => !b.destroyed && !b.skip && b.y + b.h >= lo && b.y <= hi);
  if (inWindow.length <= cap) return inWindow;
  const dist = (b: PageBlock) => Math.abs(b.y + b.h / 2 - centerPageY);
  return inWindow.sort((a, b) => dist(a) - dist(b)).slice(0, cap);
}

/** Which blocks to add to / drop from the world to match `desired`, given the ids already alive. */
export function diffWindow(
  aliveIds: ReadonlySet<number>,
  desired: readonly PageBlock[],
): { add: PageBlock[]; removeIds: number[] } {
  const want = new Set(desired.map((b) => b.id));
  const add = desired.filter((b) => !aliveIds.has(b.id));
  const removeIds: number[] = [];
  for (const id of aliveIds) if (!want.has(id)) removeIds.push(id);
  return { add, removeIds };
}

/** Share of the page's block area destroyed, 0..1 (what the HUD shows as "page destroyed"). */
export function destroyedFraction(blocks: readonly PageBlock[]): number {
  let total = 0;
  let gone = 0;
  for (const b of blocks) {
    if (b.skip) continue;
    const area = Math.min(b.w * b.h, 60000);
    total += area;
    if (b.destroyed) gone += area;
  }
  return total > 0 ? gone / total : 0;
}

/** Flag blocks that overlap the spawn point so the player is never born inside a wall. Returns how many were skipped. */
export function skipBlocksNear(blocks: PageBlock[], pagePoint: { x: number; y: number }, radius: number): number {
  let skipped = 0;
  for (const b of blocks) {
    const nx = clamp(pagePoint.x, b.x, b.x + b.w);
    const ny = clamp(pagePoint.y, b.y, b.y + b.h);
    if ((nx - pagePoint.x) ** 2 + (ny - pagePoint.y) ** 2 <= radius * radius) {
      b.skip = true;
      skipped += 1;
    }
  }
  return skipped;
}

/**
 * The single "area" every page run uses: a walled arena exactly the size of
 * the page, no waves (pure demolition), and a duration so large the timed
 * clear never fires. Typed against `AreaDef` only, so it pulls in none of the
 * authored map data.
 */
export function overlayArea(doc: DocSize, k: number = WORLD_K): AreaDef {
  return {
    id: 'page-overlay',
    name: 'Demo Day',
    district: '616',
    description: 'The page you are standing on.',
    backdrop: '',
    bounds: { w: doc.w / k, h: doc.h / k },
    ground: { base: '#000000', tile: '#000000', seam: '#000000', glow: '#000000' },
    obstacles: [],
    durationSec: 1e9,
    waves: [],
    unlock: { kind: 'default' },
    threat: 'low',
  };
}
