import { useEffect, useRef } from 'react';

import { getWeaponPixelModel } from '@/game/data/weaponPixelModels';
import type { WeaponKind } from '@/game/types';

export interface WeaponIconProps {
  kind: WeaponKind;
  weaponId?: string;
  label?: string;
  color?: string;
  size?: number;
  className?: string;
}

const PIXEL_GRID = 16;

function shade(hex: string, amount: number): string {
  const normalized = hex.startsWith('#') && hex.length === 7 ? hex.slice(1) : 'ffffff';
  const channel = (offset: number) => Math.max(0, Math.min(255, parseInt(normalized.slice(offset, offset + 2), 16) + amount));
  return `rgb(${channel(0)} ${channel(2)} ${channel(4)})`;
}

export function WeaponIcon({ kind, weaponId, label, color = '#ffffff', size = 28, className = '' }: WeaponIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(3,7,18,.88)';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = `${color}66`;
    ctx.strokeRect(.5, .5, size - 1, size - 1);

    const unit = size / PIXEL_GRID;
    const tones = [shade(color, -70), color, shade(color, 70)];
    for (const [x, y, tone] of getWeaponPixelModel(weaponId, kind).pixels) {
      ctx.fillStyle = tones[tone];
      ctx.fillRect(Math.floor(x * unit), Math.floor(y * unit), Math.ceil(unit), Math.ceil(unit));
    }
  }, [color, kind, size, weaponId]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label ? `${label} pixel weapon model` : undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}

export default WeaponIcon;
