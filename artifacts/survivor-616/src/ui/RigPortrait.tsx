/**
 * Draws a character's actual in-game sprite rig, animated, on a transparent
 * canvas. Menus use this instead of the raw reference sheets so a portrait
 * always matches what the player controls during a run.
 */
import { useEffect, useRef } from 'react';

import { drawRig } from '@/game/render/sprite';
import type { AnimName, SpritePalette, SpriteRig } from '@/game/types';
import { prefersReducedMotion as prefersReducedMotionNow } from '@/anim/motion';

export interface RigPortraitProps {
  rig: SpriteRig;
  palette: SpritePalette;
  anim?: AnimName;
  /** Canvas height in CSS pixels; width is derived from it. */
  size?: number;
  className?: string;
  /** Disable frame animation for compact/static contexts; reduced-motion also disables it automatically. */
  animated?: boolean;
  /**
   * Fixed pixels per sprite pixel, overriding the fit-to-canvas scale. Multiples of 4
   * keep every sprite pixel the same size (the baked frames are 4x), which is what the
   * operator inspector uses for a crisp full-resolution view.
   */
  pixelScale?: number;
}

export function RigPortrait({
  rig,
  palette,
  anim = 'idle',
  size = 96,
  className = '',
  animated = true,
  pixelScale,
}: RigPortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = size;
    const cssH = size;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;

    const scale = pixelScale && pixelScale > 0 ? pixelScale : (cssH * 0.82) / rig.pixelHeight;
    const start = performance.now();
    let raf = 0;

    const reduceMotion = prefersReducedMotionNow();
    const shouldAnimate = animated && !reduceMotion;
    const frame = (time: number) => {
      if (shouldAnimate) raf = requestAnimationFrame(frame);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      // Ground shadow so the figure is not floating in the card.
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(cssW / 2, cssH * 0.92, rig.pixelHeight * scale * 0.3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawRig(ctx, rig, palette, anim, time - start, cssW / 2, cssH * 0.92, 1, scale, {
        outline: true,
      });
    };

    if (shouldAnimate) raf = requestAnimationFrame(frame);
    else frame(start);
    return () => cancelAnimationFrame(raf);
  }, [rig, palette, anim, size, animated, pixelScale]);

  return (
    <canvas
      ref={canvasRef}
      data-character-portrait
      style={{ width: size, height: size }}
      className={className}
      aria-hidden="true"
    />
  );
}

export default RigPortrait;
