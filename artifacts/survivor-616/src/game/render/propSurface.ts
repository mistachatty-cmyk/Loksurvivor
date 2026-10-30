import { propNoise, type PropMaterial } from './breakableFx';

/** Small, deterministic surface details. No textures, timers or simulation state. */
export function drawPropSurface(
  ctx: CanvasRenderingContext2D,
  material: PropMaterial,
  x: number, y: number, w: number, h: number,
  seed: number,
  quality: 'performance' | 'balanced' | 'high' = 'high',
) {
  if (w < 8 || h < 8) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath(); ctx.rect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4); ctx.clip();
  const line = (color: string, width: number, points: number[]) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    ctx.moveTo(points[0]!, points[1]!);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!);
    ctx.stroke();
  };
  const left = -w / 2, top = -h / 2;
  // A light-catching upper bevel and lower ambient occlusion frame the surface.
  line('#ffffff35', 2, [left + 3, h / 2 - 3, left + 3, top + 3, w / 2 - 3, top + 3]);
  line('#00000066', 3, [left + 3, h / 2 - 3, w / 2 - 3, h / 2 - 3, w / 2 - 3, top + 3]);
  if (material === 'wood') {
    for (let i = 1; i < 4; i += 1) {
      const py = top + h * i / 4;
      line('#21160dbb', 1.5, [left, py, w / 2, py]);
      line('#ecc18b55', 1, [left, py + 2, w / 2, py + 2]);
    }
    line('#362115', Math.max(3, w * 0.085), [left + 5, top + 5, w / 2 - 5, h / 2 - 5]);
    line('#dca76b', Math.max(1, w * 0.035), [left + 5, top + 4, w / 2 - 5, h / 2 - 6]);
  } else if (material === 'metal') {
    ctx.fillStyle = '#07111d55'; ctx.fillRect(left + w * 0.16, top + h * 0.18, w * 0.68, h * 0.58);
    line('#c9e3ef55', 1, [left + w * 0.16, h * 0.26, left + w * 0.16, top + h * 0.18, w * 0.34, top + h * 0.18]);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = '#02081299'; ctx.fillRect(-w * 0.2, top + h * (0.3 + i * 0.13), w * 0.4, Math.max(1, h * 0.035));
    }
  } else if (material === 'stone') {
    for (let row = 1; row <= 2; row += 1) {
      const py = top + h * row / 3;
      line('#0a101980', 2, [left, py, w / 2, py]);
      const px = (row % 2 ? -0.17 : 0.2) * w;
      line('#0a101980', 2, [px, py - h / 3, px, py]);
      line('#edf2f733', 1, [left, py + 2, w / 2, py + 2]);
    }
  } else if (material === 'glass') {
    line('#e6fbff66', Math.max(2, w * 0.08), [-w * 0.3, h * 0.25, w * 0.05, -h * 0.3]);
    line('#e6fbff33', Math.max(1, w * 0.035), [-w * 0.1, h * 0.3, w * 0.25, -h * 0.25]);
  } else {
    line('#06352899', 3, [0, h / 2, -w * 0.08, 0, w * 0.05, -h * 0.4]);
    for (let i = 0; i < 3; i += 1) {
      const py = top + h * (0.25 + i * 0.23);
      line('#86efac66', 1, [-w * 0.3, py - h * 0.1, -w * 0.08, py + h * 0.1, w * 0.28, py - h * 0.12]);
    }
  }
  const count = quality === 'performance' ? 0 : quality === 'balanced' ? 4 : 8;
  for (let i = 0; i < count; i += 1) {
    const px = (propNoise(seed ^ Math.imul(i + 1, 7321)) - 0.5) * w * 0.78;
    const py = (propNoise(seed ^ Math.imul(i + 1, 19391)) - 0.5) * h * 0.78;
    ctx.fillStyle = i % 2 ? '#ffffff30' : '#03071255';
    ctx.fillRect(px, py, material === 'wood' ? Math.max(2, w * 0.12) : 2, 1);
  }
  if (material === 'wood' || material === 'metal') {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      ctx.fillStyle = '#0b1018'; ctx.fillRect(sx * w * 0.37 - 1, sy * h * 0.36 - 1, 3, 3);
      ctx.fillStyle = '#dde9ed88'; ctx.fillRect(sx * w * 0.37 - 1, sy * h * 0.36 - 1, 2, 1);
    }
  }
  ctx.restore();
}
