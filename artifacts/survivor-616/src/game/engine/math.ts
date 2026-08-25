/** Small math helpers shared by the simulation and the renderer. */

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function length(x: number, y: number): number {
  return Math.hypot(x, y);
}

/** Deterministic PRNG so a run can be reasoned about while debugging. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Shortest signed difference between two angles, in radians. */
export function angleDelta(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export interface Aabb {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Whether a circle overlaps an axis-aligned box, with no side effects. */
export function circleHitsBox(x: number, y: number, radius: number, box: Aabb): boolean {
  const halfW = box.w / 2;
  const halfH = box.h / 2;
  const nearestX = clamp(x, box.x - halfW, box.x + halfW);
  const nearestY = clamp(y, box.y - halfH, box.y + halfH);
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Push a circle out of an axis-aligned box along the shallowest axis.
 * Returns true when a correction was applied.
 */
export function resolveCircleBox(
  pos: { x: number; y: number },
  radius: number,
  box: Aabb,
): boolean {
  const halfW = box.w / 2;
  const halfH = box.h / 2;
  const nearestX = clamp(pos.x, box.x - halfW, box.x + halfW);
  const nearestY = clamp(pos.y, box.y - halfH, box.y + halfH);
  const dx = pos.x - nearestX;
  const dy = pos.y - nearestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > radius * radius) return false;

  if (distSq > 1e-6) {
    const d = Math.sqrt(distSq);
    const push = radius - d;
    pos.x += (dx / d) * push;
    pos.y += (dy / d) * push;
    return true;
  }

  // Circle center is inside the box: eject along the closest face.
  const left = Math.abs(pos.x - (box.x - halfW));
  const right = Math.abs(box.x + halfW - pos.x);
  const top = Math.abs(pos.y - (box.y - halfH));
  const bottom = Math.abs(box.y + halfH - pos.y);
  const min = Math.min(left, right, top, bottom);
  if (min === left) pos.x = box.x - halfW - radius;
  else if (min === right) pos.x = box.x + halfW + radius;
  else if (min === top) pos.y = box.y - halfH - radius;
  else pos.y = box.y + halfH + radius;
  return true;
}
