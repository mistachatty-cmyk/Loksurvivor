/**
 * A short scripted interaction between two rigs sharing a hideout room --
 * both idle-bob, and every few seconds one of them plays its `attack` or
 * `hurt` clip briefly as a stand-in "gesture" so a pair of rescued allies
 * (or an ally and the selected character) read as a relationship, not just
 * two names in a list. Reuses the existing 5 animation clips; no new
 * authoring in rigs.ts.
 */
import { useEffect, useRef } from 'react';

import { drawRig } from '@/game/render/sprite';
import type { AnimName, SpritePalette, SpriteRig } from '@/game/types';

export interface VignetteActor {
  name: string;
  rig: SpriteRig;
  palette: SpritePalette;
}

export interface HideoutVignetteProps {
  left: VignetteActor;
  right: VignetteActor;
  /** Canvas height in CSS pixels; width is derived from it. */
  size?: number;
  className?: string;
  /**
   * When provided (non-undefined), disables the internal ambient gesture
   * timer entirely; the vignette instead plays exactly this gesture once and
   * then holds idle until a new value arrives. Bump `nonce` to replay the
   * same side/anim pair back-to-back (e.g. two attacks in a row). Callers
   * should memoize this object keyed on `[side, anim, nonce]` so incidental
   * re-renders don't restart the clip. Omit the prop entirely for the
   * original ambient random-gesture behavior.
   */
  controlledGesture?: { side: 'left' | 'right'; anim: GestureAnim; nonce: number } | null;
}

export type GestureAnim = Extract<AnimName, 'attack' | 'hurt'>;

export function HideoutVignette({ left, right, size = 110, className = '', controlledGesture }: HideoutVignetteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = size * 2.4;
    const cssH = size;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;

    const leftScale = (cssH * 0.72) / left.rig.pixelHeight;
    const rightScale = (cssH * 0.72) / right.rig.pixelHeight;
    const groundY = cssH * 0.86;
    const leftX = cssW * 0.32;
    const rightX = cssW * 0.68;

    const start = performance.now();
    let raf = 0;
    let activeGesture: { side: 'left' | 'right'; anim: GestureAnim; since: number } | null =
      controlledGesture ? { side: controlledGesture.side, anim: controlledGesture.anim, since: start } : null;
    let nextGestureAt = controlledGesture !== undefined ? Infinity : start + 2200 + Math.random() * 2400;

    const drawGroundShadow = (x: number, rigHeight: number, scale: number) => {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(x, groundY, rigHeight * scale * 0.3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      if (controlledGesture === undefined && !activeGesture && time >= nextGestureAt) {
        const side: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
        const anim: GestureAnim = Math.random() < 0.7 ? 'attack' : 'hurt';
        activeGesture = { side, anim, since: time };
      }
      if (activeGesture) {
        const actor = activeGesture.side === 'left' ? left : right;
        const clip = actor.rig.anims[activeGesture.anim];
        const duration = clip.frames.length * clip.frameMs;
        if (time - activeGesture.since > duration) {
          activeGesture = null;
          if (controlledGesture === undefined) nextGestureAt = time + 3200 + Math.random() * 3600;
        }
      }

      const leftAnim: AnimName = activeGesture?.side === 'left' ? activeGesture.anim : 'idle';
      const rightAnim: AnimName = activeGesture?.side === 'right' ? activeGesture.anim : 'idle';
      const leftSince = activeGesture?.side === 'left' ? activeGesture.since : start;
      const rightSince = activeGesture?.side === 'right' ? activeGesture.since : start;

      drawGroundShadow(leftX, left.rig.pixelHeight, leftScale);
      drawGroundShadow(rightX, right.rig.pixelHeight, rightScale);

      // Facing 1/-1 so the pair reads as turned toward each other.
      drawRig(ctx, left.rig, left.palette, leftAnim, time - leftSince, leftX, groundY, 1, leftScale, { outline: true });
      drawRig(ctx, right.rig, right.palette, rightAnim, time - rightSince, rightX, groundY, -1, rightScale, { outline: true });
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [left, right, size, controlledGesture]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size * 2.4, height: size }}
      className={className}
      aria-hidden="true"
    />
  );
}

export default HideoutVignette;
