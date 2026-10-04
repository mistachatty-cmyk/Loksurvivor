/**
 * "Potato mode" hero: your actual character rig, walking back and forth
 * along a ground line, rendered with the same `drawRig` the game itself
 * uses (see RigPortrait) -- not a scripted GIF or a pre-rendered clip. It
 * fades out and drifts upward (parallax) as the page scrolls, so it never
 * fights the room nav / Head Out grid for space on a short mobile viewport.
 *
 * Deliberately does not run the real simulation (`stepWorld`) -- this is
 * decoration behind static menu content, not gameplay, and pulling in the
 * full engine here would mean faking a World, enemies and a camera for a
 * strip that's a few hundred pixels tall. A heavier "live combat" version
 * of this hero is a separate, bigger piece of work.
 */
import { useEffect, useRef } from 'react';

import { drawRig } from '@/game/render/sprite';
import type { SpritePalette, SpriteRig } from '@/game/types';
import { prefersReducedMotion as prefersReducedMotionNow } from '@/anim/motion';

export interface HideoutPreviewProps {
  rig: SpriteRig;
  palette: SpritePalette;
  /** Canvas height in CSS pixels. */
  height?: number;
  className?: string;
}

const WALK_SPEED_PX_PER_MS = 0.045;

export function HideoutPreview({ rig, palette, height = 176, className = '' }: HideoutPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = prefersReducedMotionNow();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cssW = root.clientWidth;
    const cssH = height;

    const resize = () => {
      cssW = root.clientWidth;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);

    let isVisible = document.visibilityState === 'visible';
    const onVisibility = () => { isVisible = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', onVisibility);

    // Fade + parallax drift over the first ~220px of scroll -- past that the
    // preview is fully hidden and costs nothing but a `display: none` check.
    const FADE_RANGE_PX = 220;
    let scrollT = 0;
    const onScroll = () => {
      const rect = root.getBoundingClientRect();
      const scrolledPast = Math.max(0, -rect.top);
      scrollT = Math.min(1, scrolledPast / FADE_RANGE_PX);
      root.style.opacity = String(1 - scrollT);
      root.style.transform = reduceMotion ? 'none' : `translateY(${-scrollT * 32}px)`;
      root.style.pointerEvents = scrollT >= 1 ? 'none' : 'auto';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const scale = (cssH * 0.7) / rig.pixelHeight;
    const groundY = cssH * 0.86;
    const start = performance.now();
    let raf = 0;

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      if (!isVisible || scrollT >= 1) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const elapsed = reduceMotion ? 0 : time - start;
      const rangeW = Math.max(cssW * 0.6, 1);
      const marginX = (cssW - rangeW) / 2;
      // Ping-pong walk across the strip; reduced motion holds a still idle pose center-stage.
      const t = reduceMotion ? 0.5 : (elapsed * WALK_SPEED_PX_PER_MS) % (rangeW * 2);
      const forward = t < rangeW;
      const localX = forward ? t : rangeW * 2 - t;
      const screenX = marginX + localX;
      const facing: 1 | -1 = forward ? 1 : -1;
      const anim = reduceMotion ? 'idle' : 'walk';

      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(screenX, groundY, rig.pixelHeight * scale * 0.32, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawRig(ctx, rig, palette, anim, elapsed, screenX, groundY, facing, scale, { outline: true });
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onScroll);
    };
  }, [rig, palette, height]);

  return (
    <div
      ref={rootRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height }}
      data-testid="hideout-preview"
      aria-hidden="true"
    >
      {/* The canvas below only clears to transparent, so without this the
          hideout's own weather rain-particle layer (rendered behind the whole
          screen) shows through raw and unstyled, reading as a visual glitch
          slicing across the character instead of atmosphere. Same dim
          treatment AttractMode's own background sim uses. */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/35" />
      <canvas ref={canvasRef} className="relative z-10 block h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/2 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

export default HideoutPreview;
