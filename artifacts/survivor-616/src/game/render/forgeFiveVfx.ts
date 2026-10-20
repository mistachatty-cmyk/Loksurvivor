/** Distinct canvas silhouettes for the five authored Forge Five signature shots. */
export const FORGE_FIVE_WEAPON_IDS = [
  'vitrail-glass', 'kiln-brick', 'threadwake-needle', 'quarry-bell', 'courier-star',
] as const;

interface Shot {
  weaponId?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: Array<{ x: number; y: number }>;
}

export function drawForgeFiveProjectile(ctx: CanvasRenderingContext2D, shot: Shot, now: number): boolean {
  if (!FORGE_FIVE_WEAPON_IDS.includes(shot.weaponId as typeof FORGE_FIVE_WEAPON_IDS[number])) return false;
  const angle = Math.atan2(shot.vy, shot.vx);
  ctx.save();
  ctx.translate(shot.x, shot.y);
  ctx.rotate(angle);

  switch (shot.weaponId) {
    case 'vitrail-glass': {
      ctx.shadowColor = '#44d9ec'; ctx.shadowBlur = 14;
      for (let i = -1; i <= 1; i += 1) {
        ctx.fillStyle = i === 0 ? '#f9d37d' : '#44d9ec';
        ctx.beginPath();
        ctx.moveTo(13, i * 5); ctx.lineTo(-8, i * 5 - 5); ctx.lineTo(-5, i * 5 + 5);
        ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = '#fff8de'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(13, 0); ctx.lineTo(-8, 10); ctx.stroke();
      break;
    }
    case 'kiln-brick': {
      ctx.shadowColor = '#ff7040'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#512417'; ctx.fillRect(-11, -7, 22, 14);
      ctx.strokeStyle = '#ffd28d'; ctx.lineWidth = 2; ctx.strokeRect(-11, -7, 22, 14);
      ctx.fillStyle = '#ffb04f'; ctx.fillRect(-6, -4, 5, 3); ctx.fillRect(3, 1, 5, 3);
      for (let i = 0; i < 3; i += 1) {
        const flicker = Math.sin(now / 95 + i * 2) * 3;
        ctx.fillRect(-17 - i * 5, (i - 1) * 6 + flicker, 3, 3);
      }
      break;
    }
    case 'threadwake-needle': {
      ctx.shadowColor = '#ee83cf'; ctx.shadowBlur = 12;
      ctx.strokeStyle = '#86f0dd'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const x = -35 + i * 7;
        const y = Math.sin(now / 130 + i * 1.5) * 5;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(0, 0); ctx.stroke();
      ctx.fillStyle = '#fff0bd';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-7, -3); ctx.lineTo(-7, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ee83cf'; ctx.beginPath(); ctx.arc(-5, 0, 2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'quarry-bell': {
      const pulse = (now / 170) % 1;
      ctx.shadowColor = '#8ad6f3'; ctx.shadowBlur = 12;
      ctx.strokeStyle = '#b6d6e3'; ctx.lineWidth = 2;
      for (let i = 0; i < 2; i += 1) {
        ctx.globalAlpha = 0.65 - pulse * 0.3;
        ctx.beginPath(); ctx.arc(0, 0, 10 + pulse * 9 + i * 8, -1.1, 1.1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff0c2';
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-5, -7); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#56626c'; ctx.beginPath(); ctx.arc(-4, 0, 3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'courier-star': {
      ctx.shadowColor = '#7addff'; ctx.shadowBlur = 18;
      ctx.strokeStyle = '#7addff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-8, 0); ctx.stroke();
      ctx.strokeStyle = '#f5a9dc'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-28, -5); ctx.lineTo(-8, -2); ctx.moveTo(-28, 5); ctx.lineTo(-8, 2); ctx.stroke();
      ctx.fillStyle = '#fff5c8'; ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 === 0 ? 12 : 4;
        const a = i * Math.PI / 5;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
  }
  ctx.restore();
  return true;
}
