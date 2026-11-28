/**
 * LokDropScreen -- the playable 60-second Lok Drop prototype (Lok Party Slice 1).
 *
 * 1 player + 3 bots, 2.5D front-facing vault floor (camera tilt, depth scale, z lift), the
 * juiceEngine on every hit, and the lokparty.meta.v1 report at the end.
 *
 * Art rule: every character is our own procedural rig (drawRig). The Drive reference images
 * only informed the camera tilt, wet-asphalt lighting, ring colors and the minimal top HUD.
 */

import { useEffect, useRef } from 'react';
import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { type KitGameId } from './cartridges';
import { DROP } from './lokDrop';


export const ROSTER_IDS = ['zero-day', 'shade', 'quarry-kid', 'golden-hour'] as const;

/** The four seats for a match: the human first, then the rest of the launch roster. */
export function seatOrder(humanId: string): string[] {
  return [humanId, ...ROSTER_IDS.filter((id) => id !== humanId)];
}
export const LANE_COLORS = ['#38f2ff', '#ff3fd2', '#ffd23f', '#7cff6b'];
export const VIEW_W = 1000;
export const VIEW_H = 700;
export const FLOOR_TOP = 190;
export const FLOOR_H = 470;
export const STEP = 1000 / 60;
export const RIG_SCALE = 1.9;
export const CREAM = '#FAF6EE';
export const ESPRESSO = '#3b2a20';

// ------------------------------------------------------------------ projection (2.5D)

export function depth(y: number): number {
  return 0.76 + 0.24 * (y / DROP.height);
}
export function project(x: number, y: number, z = 0): { sx: number; sy: number; k: number } {
  const k = depth(y);
  return { sx: VIEW_W / 2 + (x - DROP.width / 2) * k, sy: FLOOR_TOP + (y / DROP.height) * FLOOR_H - z * 0.72 * k, k };
}

// ------------------------------------------------------------------ fx particles

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Banner {
  text: string;
  until: number;
  color: string;
}

export function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ rig preview (lobby)

export function RigPreview({ id, size = 96 }: { id: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const def = CHARACTERS_BY_ID[id];
    if (!c || !def) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      drawShadow(ctx, c.width / 2, c.height - 10, 18);
      drawRig(ctx, def.rig, def.palette, 'idle', t - t0, c.width / 2, c.height - 10, 1, 2.2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}

// ------------------------------------------------------------------ screen


export type Phase = 'hub' | 'lobby' | 'online' | 'play' | 'board' | 'results' | 'practice' | 'vault';
export type PracticeGame = KitGameId | 'rush';
export type Mode = 'blitz' | 'drop' | 'friends';

export function inviteCode(): string | null {
  try {
    const c = new URLSearchParams(window.location.search).get('party');
    return c && /^[A-Z0-9]{5}$/i.test(c) ? c.toUpperCase() : null;
  } catch {
    return null;
  }
}

export interface Standing {
  characterId: string;
  place: number;
  crowns: number;
  coins: number;
  human: boolean;
}

