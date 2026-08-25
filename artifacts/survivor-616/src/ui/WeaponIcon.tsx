/**
 * A small procedural glyph representing a weapon pickup on its level-up
 * card, keyed off `WeaponDef.kind` (no new data needed -- every weapon
 * already has one) and tinted with `WeaponDef.color`. Kept in the same
 * flat-shape, no-bitmap style as the rig rendering so it reads as part of
 * the same world, not a mismatched icon font.
 */
import { useEffect, useRef } from 'react';
import type { WeaponKind } from '@/game/types';

export interface WeaponIconProps {
  kind: WeaponKind;
  color?: string;
  size?: number;
  className?: string;
}

function drawGlyph(ctx: CanvasRenderingContext2D, kind: WeaponKind, color: string, s: number) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, s * 0.08);
  const c = s / 2;

  switch (kind) {
    case 'melee': {
      // A short diagonal slash arc.
      ctx.beginPath();
      ctx.arc(c, c, s * 0.32, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
      break;
    }
    case 'projectile': {
      // A dart / bolt shape.
      ctx.beginPath();
      ctx.moveTo(c - s * 0.3, c);
      ctx.lineTo(c + s * 0.22, c - s * 0.14);
      ctx.lineTo(c + s * 0.12, c);
      ctx.lineTo(c + s * 0.22, c + s * 0.14);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'orbit': {
      // A ring with a single orbiting dot.
      ctx.beginPath();
      ctx.arc(c, c, s * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c + s * 0.3, c, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'aura': {
      // Concentric pulse rings.
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(c, c, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(c, c, s * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'homing': {
      // A bent chevron, like a seeking arrow.
      ctx.beginPath();
      ctx.moveTo(c - s * 0.26, c + s * 0.2);
      ctx.quadraticCurveTo(c, c - s * 0.28, c + s * 0.26, c - s * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c + s * 0.14, c - s * 0.18);
      ctx.lineTo(c + s * 0.26, c - s * 0.05);
      ctx.lineTo(c + s * 0.1, c + s * 0.02);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'nova': {
      // A radial burst.
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * s * 0.1, c + Math.sin(a) * s * 0.1);
        ctx.lineTo(c + Math.cos(a) * s * 0.32, c + Math.sin(a) * s * 0.32);
        ctx.stroke();
      }
      break;
    }
    case 'sweep': {
      // A wide flat arc, like a swung bar.
      ctx.beginPath();
      ctx.arc(c, c + s * 0.1, s * 0.3, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      break;
    }
    default:
      ctx.beginPath();
      ctx.arc(c, c, s * 0.2, 0, Math.PI * 2);
      ctx.fill();
  }
}

export function WeaponIcon({ kind, color = '#ffffff', size = 28, className = '' }: WeaponIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // Backing tile so the glyph reads as an "item" rather than loose lines.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

    drawGlyph(ctx, kind, color, size);
  }, [kind, color, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={className}
      aria-hidden="true"
    />
  );
}

export default WeaponIcon;
