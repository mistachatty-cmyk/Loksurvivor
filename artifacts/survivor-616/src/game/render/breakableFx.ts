import type { ObstacleDef } from '@/game/types';

export type PropMaterial = 'wood' | 'glass' | 'metal' | 'stone' | 'organic';
export type DamageStage = 0 | 1 | 2 | 3;

export interface CrackPath {
  angle: number;
  length: number;
  bends: number[];
}

/** Damage reads in three deliberate steps, independent of an obstacle's HP scale. */
export function propDamageStage(damageRatio: number): DamageStage {
  if (damageRatio >= 0.72) return 3;
  if (damageRatio >= 0.43) return 2;
  if (damageRatio >= 0.16) return 1;
  return 0;
}

/** A compact material vocabulary keeps procedural impact art coherent by prop family. */
export function propMaterial(kind: ObstacleDef['kind'], artAssetId?: string): PropMaterial {
  const id = `${kind}:${artAssetId ?? ''}`.toLowerCase();
  if (/glass|mirror|reflect|neon-sign|window|kiosk|shelter/.test(id)) return 'glass';
  if (/crystal|concrete|stone|pothole|barricade|barrier/.test(id)) return 'stone';
  if (/root|spore|resin|flora|tree|sapling|stump|living-cable|holographic/.test(id)) return 'organic';
  if (/crate|planter|bench|wood|cache-cart/.test(id)) return 'wood';
  if (/server-rack|metal-box|barrel|fuse-box|street-lamp|security-camera/.test(id)) return 'metal';
  if (/building|concrete|stone|pothole/.test(id)) return 'stone';
  return 'metal';
}

export function propNoise(seed: number) {
  let value = seed | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967296;
}

/** Stable crack arms: adding a damage stage preserves every earlier fracture. */
export function propCrackPaths(seed: number, stage: DamageStage): CrackPath[] {
  const count = stage * 2;
  return Array.from({ length: count }, (_, index) => {
    const armSeed = (seed ^ Math.imul(index + 1, 0x45d9f3b)) | 0;
    const bends = [0, 1, 2].map((bend) => propNoise(armSeed + bend * 0x9e3779b) * 0.3 - 0.15);
    return {
      angle: propNoise(armSeed ^ 0x27d4eb2d) * Math.PI * 2,
      length: 0.22 + propNoise(armSeed ^ 0x165667b1) * 0.25,
      bends,
    };
  });
}

const MATERIAL_PALETTE: Record<PropMaterial, { dark: string; light: string; accent: string }> = {
  wood: { dark: '#24170f', light: '#f4c27a', accent: '#b8733e' },
  glass: { dark: '#102735', light: '#ecfeff', accent: '#67e8f9' },
  metal: { dark: '#101820', light: '#e2e8f0', accent: '#fbbf24' },
  stone: { dark: '#10131b', light: '#cbd5e1', accent: '#94a3b8' },
  organic: { dark: '#071c16', light: '#d9f99d', accent: '#34d399' },
};

export interface PropDamageVisual {
  x: number;
  y: number;
  w: number;
  h: number;
  damageRatio: number;
  material: PropMaterial;
  seed: number;
  now: number;
  lastHitAt?: number;
  lastHitX?: number;
  lastHitY?: number;
  brokenAt?: number;
  motionEnabled?: boolean;
  fragmentLimit?: number;
}

/** Procedural pixel-style fractures and debris shared by authored and map-pack props. */
export function drawPropDamage(ctx: CanvasRenderingContext2D, visual: PropDamageVisual) {
  const { x, y, w, h, material, seed, now } = visual;
  if (w <= 0 || h <= 0 || (visual.brokenAt !== undefined && now - visual.brokenAt >= 760)) return;
  const stage = propDamageStage(visual.damageRatio);
  const palette = MATERIAL_PALETTE[material];
  const brokenAt = visual.brokenAt;
  ctx.save();
  ctx.translate(x, y);

  if (brokenAt !== undefined) {
    const age = Math.max(0, now - brokenAt);
    const fade = Math.max(0, 1 - age / 760);
    const size = Math.max(2, Math.min(w, h) * 0.12);
    ctx.globalAlpha = 0.46 * fade;
    ctx.fillStyle = '#070a10';
    ctx.fillRect(-w * 0.38, h * 0.18, w * 0.76, Math.max(3, h * 0.2));
    for (let index = 0; index < (visual.fragmentLimit ?? 9); index += 1) {
      const pieceSeed = seed ^ Math.imul(index + 1, 0x45d9f3b);
      const angle = propNoise(pieceSeed) * Math.PI * 2;
      const reach = 0.12 + propNoise(pieceSeed ^ 0x27d4eb2d) * 0.36;
      const flight = Math.min(age / 520, 1);
      const lift = visual.motionEnabled === false ? 0 : Math.sin(flight * Math.PI) * h * (0.15 + reach * 0.5);
      const directionX = visual.lastHitX === undefined ? 0 : Math.max(-1, Math.min(1, (x - visual.lastHitX) / (w * 0.5)));
      const directionY = visual.lastHitY === undefined ? 0 : Math.max(-1, Math.min(1, (y - visual.lastHitY) / (h * 0.5)));
      const drift = (visual.motionEnabled === false ? 0.75 : Math.min(age / 230, 1)) * Math.max(w, h) * reach;
      const fall = visual.motionEnabled === false ? 0 : (age / 760) * h * 0.18;
      const px = (Math.cos(angle) + directionX * 0.8) * drift;
      const py = (Math.sin(angle) + directionY * 0.8) * drift * 0.45 + fall - lift;
      const shard = size * (0.5 + propNoise(pieceSeed ^ 0x165667b1));
      ctx.globalAlpha = fade * (0.85 - propNoise(pieceSeed ^ 0x119de1f3) * 0.35);
      ctx.fillStyle = index % 3 === 0 ? palette.accent : index % 3 === 1 ? palette.light : palette.dark;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle + (visual.motionEnabled === false ? 0 : flight * (index % 2 ? 3 : -3)));
      if (material === 'glass' || material === 'stone') {
        ctx.beginPath();
        ctx.moveTo(-shard * 0.65, shard * 0.4);
        ctx.lineTo(-shard * 0.2, -shard * 0.75);
        ctx.lineTo(shard * 0.7, shard * 0.2);
        ctx.closePath(); ctx.fill();
      } else {
        const length = material === 'wood' ? shard * 1.8 : shard;
        ctx.fillRect(-length / 2, -shard * 0.25, length, shard * 0.5);
      }
      ctx.fillStyle = palette.light;
      ctx.globalAlpha *= 0.6;
      ctx.fillRect(-shard * 0.25, -shard * 0.25, shard * 0.5, 1);
      ctx.restore();
    }
    if (material !== 'glass' && visual.motionEnabled !== false && age < 420) {
      // Four restrained dust lobes, bounded independently of fragment quality.
      for (let i = 0; i < Math.min(4, visual.fragmentLimit ?? 9); i += 1) {
        const spread = age / 420;
        ctx.globalAlpha = (1 - spread) * 0.12;
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.ellipse((i - 1.5) * w * spread * 0.25, h * 0.2 - spread * h * 0.12,
          Math.max(1, w * (0.06 + spread * 0.1)), Math.max(1, h * (0.04 + spread * 0.05)), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (visual.motionEnabled !== false && age < 180) {
      ctx.globalAlpha = (1 - age / 180) * 0.6;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = Math.max(1, size * 0.3);
      ctx.strokeRect(-w * 0.18, -h * 0.18, w * 0.36, h * 0.36);
    }
    ctx.restore();
    return;
  }

  if (stage > 0) {
    const hitX = visual.lastHitX === undefined ? 0 : Math.max(-0.45, Math.min(0.45, (visual.lastHitX - x) / Math.max(w, 1)));
    const hitY = visual.lastHitY === undefined ? 0 : Math.max(-0.45, Math.min(0.45, (visual.lastHitY - y) / Math.max(h, 1)));
    const paths = propCrackPaths(seed, stage);
    const scale = Math.min(w, h);
    ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
    ctx.lineJoin = 'miter';
    for (let index = 0; index < paths.length; index += 1) {
      const path = paths[index]!;
      const startX = hitX * w;
      const startY = hitY * h;
      const length = scale * path.length;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      for (let bend = 0; bend < 3; bend += 1) {
        const progress = (bend + 1) / 3;
        const turn = path.angle + path.bends[bend]!;
        ctx.lineTo(startX + Math.cos(turn) * length * progress, startY + Math.sin(turn) * length * progress);
      }
      ctx.strokeStyle = palette.dark;
      ctx.lineWidth = material === 'glass' ? 1.5 : Math.max(1.5, scale * 0.035);
      ctx.globalAlpha = 0.82;
      ctx.stroke();
      if (material === 'glass' || material === 'metal' || material === 'stone') {
        ctx.beginPath();
        ctx.moveTo(startX - 1, startY - 1);
        ctx.lineTo(startX + Math.cos(path.angle) * length * 0.72 - 1, startY + Math.sin(path.angle) * length * 0.72 - 1);
        ctx.strokeStyle = palette.light;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
      }
    }

    // Smaller forks keep the main impact readable while damage accumulates.
    ctx.strokeStyle = palette.dark;
    ctx.lineWidth = Math.max(0.75, scale * 0.015);
    ctx.globalAlpha = 0.75;
    for (const path of paths) {
      const length = scale * path.length;
      const forkX = hitX * w + Math.cos(path.angle + path.bends[1]!) * length * 0.67;
      const forkY = hitY * h + Math.sin(path.angle + path.bends[1]!) * length * 0.67;
      ctx.beginPath(); ctx.moveTo(forkX, forkY);
      ctx.lineTo(forkX + Math.cos(path.angle + 0.8) * length * 0.32, forkY + Math.sin(path.angle + 0.8) * length * 0.32);
      ctx.stroke();
    }

    if (material === 'metal' && stage >= 2) {
      ctx.globalAlpha = 0.28 + stage * 0.08;
      ctx.fillStyle = palette.dark;
      ctx.fillRect(hitX * w - scale * 0.1, hitY * h - scale * 0.07, scale * 0.2, scale * 0.14);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = Math.max(1, scale * 0.018);
      ctx.strokeRect(hitX * w - scale * 0.1, hitY * h - scale * 0.07, scale * 0.2, scale * 0.14);
    }

    if (stage === 3 && material === 'glass') {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = palette.dark;
      for (let index = 0; index < 4; index += 1) {
        const pieceSeed = seed ^ Math.imul(index + 1, 0x27d4eb2d);
        const px = hitX * w + (propNoise(pieceSeed) - 0.5) * w * 0.55;
        const py = hitY * h + (propNoise(pieceSeed ^ 0x165667b1) - 0.5) * h * 0.55;
        ctx.fillRect(px, py, Math.max(2, w * 0.06), Math.max(2, h * 0.07));
      }
    }

  }
  const hitAge = visual.lastHitAt === undefined ? Number.POSITIVE_INFINITY : now - visual.lastHitAt;
  if (visual.motionEnabled !== false && hitAge >= 0 && hitAge < 125) {
    const pulse = 1 - hitAge / 125;
    const hitX = visual.lastHitX === undefined ? 0 : Math.max(-0.45, Math.min(0.45, (visual.lastHitX - x) / Math.max(w, 1)));
    const hitY = visual.lastHitY === undefined ? 0 : Math.max(-0.45, Math.min(0.45, (visual.lastHitY - y) / Math.max(h, 1)));
    const chip = Math.max(2, Math.min(w, h) * (0.035 + pulse * 0.025));
    ctx.globalAlpha = pulse * 0.48;
    ctx.fillStyle = palette.light;
    ctx.fillRect(hitX * w - chip / 2, hitY * h - chip / 2, chip, chip);
  }
  ctx.restore();
}
