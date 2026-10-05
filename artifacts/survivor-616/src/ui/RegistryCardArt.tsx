/**
 * Draws a card's model from its published art recipe (see `CardArtRecipe` in
 * @workspace/lok-client). One code path for every card from every game: this
 * game's own cards use their real rigs, and a card from another game is
 * redrawn from that game's own sprite data -- as close to its model as the
 * recipe allows, never a bitmap or a guess. Unknown recipe kinds fall back to
 * a name-initials face rather than failing.
 */
import { useEffect, useRef } from 'react';

import type { CardArtRecipe, RegistryCard } from '@workspace/lok-client';

import type { LokPetPalette, LokPetSilhouette, SpritePalette, SpriteRig } from '@/game/types';
import { LokPetIcon } from './LokPetVariantSheet';
import { RARITY_STYLE } from './LockDeckCollection';
import { RigPortrait } from './RigPortrait';

function PixelGrid({ grid, palette, size, motion }: { grid: string[]; palette: Record<string, string>; size: number; motion?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rows = grid.length;
    const cols = Math.max(...grid.map((row) => row.length));
    canvas.width = cols;
    canvas.height = rows;
    ctx.clearRect(0, 0, cols, rows);
    grid.forEach((row, y) => {
      [...row].forEach((key, x) => {
        const color = key === '0' ? undefined : palette[key];
        if (!color) return;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      });
    });
  }, [grid, palette]);
  const bob = motion === 'sleep' ? 'none' : 'registry-art-bob 1.6s ease-in-out infinite';
  return <canvas ref={ref} aria-hidden="true" style={{ width: size, height: size, imageRendering: 'pixelated', animation: bob }} />;
}

function InitialsFace({ card, size }: { card: RegistryCard; size: number }) {
  const style = RARITY_STYLE[card.rarity] ?? RARITY_STYLE.common!;
  return (
    <div className="grid place-items-center" style={{ width: size, height: size }} aria-hidden="true">
      <span className={`text-3xl font-black ${style.ink}`}>{card.name.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

export function RegistryCardArt({ card, size = 96, animated = true }: { card: RegistryCard; size?: number; animated?: boolean }) {
  const art: CardArtRecipe | null = card.art;
  if (art?.kind === 'sprite-rig') {
    return <RigPortrait rig={art.rig as SpriteRig} palette={art.palette as unknown as SpritePalette} anim={art.anim ?? 'idle'} size={size} animated={animated} />;
  }
  if (art?.kind === 'lokpet-silhouette') {
    return <LokPetIcon silhouette={art.silhouette as LokPetSilhouette} palette={art.palette as unknown as LokPetPalette} size={size} />;
  }
  if (art?.kind === 'pixel-grid') {
    return <PixelGrid grid={art.grid} palette={art.palette} size={size} motion={animated ? art.motion : 'sleep'} />;
  }
  return <InitialsFace card={card} size={size} />;
}
