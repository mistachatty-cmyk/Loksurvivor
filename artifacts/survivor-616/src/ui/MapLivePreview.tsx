import { useEffect, useMemo, useRef } from 'react';

import { getCharacter } from '@/game/data/characters';
import { customMapToArea } from '@/game/data/customMaps';
import { createWorld } from '@/game/engine/world';
import { renderWorld } from '@/game/render/draw';
import { useMeta } from '@/game/state/metaStore';
import type { CustomMap } from '@/game/types';

/**
 * Renders an authored map through the *real* game renderer instead of the
 * editor's schematic boxes, so what you place is what you'll actually play.
 *
 * The editor's own placement markers stay mounted above this canvas and stay
 * draggable -- this only replaces the flat backdrop, it does not replace the
 * editing layer. A single frame of a paused world at t=0 is drawn: obstacles,
 * ground, lighting and arena edges are all present, while wave-spawned enemies
 * are not (they're spawn *rates*, not fixed positions, so the editor's markers
 * remain the only honest way to show them).
 */
export function MapLivePreview({ map }: { map: CustomMap }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { meta } = useMeta();

  // Rebuilding a world is not free, so only do it when the authored content
  // actually changes -- not on every unrelated editor re-render.
  const signature = JSON.stringify({
    bounds: map.bounds,
    ground: map.groundAssetId,
    landmark: map.landmarkAssetId,
    backdrop: map.backdrop,
    placements: map.placements.map((p) => [p.assetId, p.x, p.y, p.w, p.h]),
  });

  const world = useMemo(() => {
    try {
      const character = getCharacter(meta.selectedCharacterId);
      return createWorld(customMapToArea(map), character, character.stats, 1234);
    } catch {
      // A half-authored map should never take the editor down with it.
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, meta.selectedCharacterId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      // Centre on the map origin and zoom out far enough that the whole
      // authored area fits, whichever axis is the binding constraint.
      world.camera.x = 0;
      world.camera.y = 0;
      const margin = 120;
      const fitByWidth = map.bounds.w + margin;
      const fitByHeight = (map.bounds.h + margin) * (width / Math.max(1, height));
      renderWorld(ctx, world, {
        width,
        height,
        dpr,
        targetViewOverride: Math.max(fitByWidth, fitByHeight),
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [world, map.bounds.w, map.bounds.h]);

  if (!world) return null;
  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden="true" />;
}

export default MapLivePreview;
