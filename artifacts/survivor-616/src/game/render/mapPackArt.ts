import { MAP_PROP_ART_BY_ID } from '@/game/data/mapPack';

/** Top-down, layered world art. Coordinates and animation are shared by editor and run. */
export function drawMapPackProp(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  now: number,
  damage = 0,
) {
  const art = MAP_PROP_ART_BY_ID[id];
  if (!art) return;
  const pulse = 0.65 + Math.sin(now / 570 + x * 0.02) * 0.24;
  const ruined = damage >= 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 100, h / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const fill = (color: string, a: number, b: number, c: number, d: number) => { ctx.fillStyle = color; ctx.fillRect(a, b, c, d); };
  const line = (color: string, width: number, points: Array<[number, number]>) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    points.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.stroke();
  };
  const ring = (color: string, cx: number, cy: number, rx: number, ry: number, width = 3) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  };

  // A soft footprint and a darker lower edge keep every object grounded.
  ctx.globalAlpha = 0.32;
  fill('#000000', -47, -39, 100, 92);
  ctx.globalAlpha = 1;
  fill(art.theme === 'null' ? '#06251e' : '#1c2630', -50, -50, 100, 100);
  fill(art.theme === 'null' ? '#0b4231' : '#334155', -47, -48, 94, 88);
  ctx.strokeStyle = art.color; ctx.lineWidth = 3; ctx.strokeRect(-47, -48, 94, 88);

  switch (id) {
    case 'transit-shelter':
      fill('#102a37', -45, -36, 90, 61); fill('#67e8f9', -39, -31, 29, 48); fill('#67e8f9', 10, -31, 29, 48);
      fill('#111827', -5, -35, 10, 54); fill('#fbbf24', -44, 29, 88, 8);
      for (let i = 0; i < 4; i += 1) line('#bae6fd', 2, [[-34 + i * 20, -29], [-45 + i * 20, 15]]);
      break;
    case 'bus-wreck':
      fill('#a64b22', -46, -32, 92, 66); fill('#111827', -32, -27, 60, 26);
      for (let i = 0; i < 4; i += 1) fill('#6b9ba7', -28 + i * 16, -23, 12, 18);
      fill('#f59e0b', -44, 18, 88, 10); ring('#0f172a', -34, 38, 9, 9, 5); ring('#0f172a', 31, 38, 9, 9, 5);
      line('#fbbf24', 3, [[-40, -32], [-8, -39], [39, -28]]);
      break;
    case 'ticket-kiosk':
      fill('#182b38', -40, -38, 80, 76); fill('#38bdf8', -32, -29, 64, 30);
      fill('#0b1724', -27, -24, 54, 20); fill('#fbbf24', -17, 13, 34, 10);
      for (let i = 0; i < 3; i += 1) fill('#94a3b8', -24 + i * 22, 28, 12, 5);
      break;
    case 'rail-sign':
      fill('#0b1724', -45, -33, 90, 59); fill('#facc15', -43, -29, 86, 6);
      fill('#facc15', -42, 17, 83, 5); fill('#38bdf8', -34, -11, 48, 5);
      line('#fbbf24', 5, [[20, -11], [34, -3], [20, 5]]);
      break;
    case 'lamp-cluster':
      for (const px of [-27, 27]) { fill('#475569', px - 5, -37, 10, 76); ring('#fde68a', px, -36, 16, 12, 5); }
      ctx.globalAlpha = pulse * 0.2; fill('#fde68a', -47, -43, 94, 80); ctx.globalAlpha = 1;
      break;
    case 'power-cabinet':
      fill('#1e3a4a', -37, -41, 74, 78); fill('#0f172a', -26, -27, 52, 46);
      ring('#60a5fa', 0, -3, 15, 15); line('#facc15', 5, [[-5, -20], [5, -4], [-2, -4], [8, 14]]);
      for (let i = 0; i < 3; i += 1) fill('#67e8f9', -27 + i * 24, 25, 12, 3);
      break;
    case 'barricade':
      fill('#b45309', -46, -22, 92, 50);
      for (let i = 0; i < 5; i += 1) line('#fde68a', 8, [[-49 + i * 21, -19], [-22 + i * 21, 25]]);
      fill('#334155', -46, 30, 14, 10); fill('#334155', 31, 30, 14, 10);
      break;
    case 'cache-cart':
      fill('#92400e', -38, -28, 76, 54); fill('#fbbf24', -34, -25, 68, 12);
      fill('#0f172a', -29, -8, 58, 23); ring('#f59e0b', 0, 3, 13, 9, 3);
      ring('#111827', -27, 30, 7, 7, 4); ring('#111827', 27, 30, 7, 7, 4);
      break;
    case 'root-arch':
      ring('#34d399', 0, 1, 39, 34, 11); ring('#052e25', 0, 1, 27, 22, 7);
      for (let i = -2; i <= 2; i += 1) line('#6ee7b7', 3, [[i * 15, -38], [i * 12, -27], [i * 10, -12]]);
      break;
    case 'pulse-sapling':
      line('#14532d', 14, [[0, 37], [0, -15], [-17, -30]]);
      for (let i = 0; i < 5; i += 1) ring(i % 2 ? '#10b981' : '#6ee7b7', Math.sin(i * 2.5) * 28, -22 + Math.cos(i * 2.5) * 19, 15, 11, 6);
      ring('#d1fae5', 0, -17, 5 + pulse * 3, 5 + pulse * 3);
      break;
    case 'holographic-tree':
      ctx.globalAlpha = 0.6 + pulse * 0.25;
      line('#67e8f9', 9, [[0, 39], [0, -13]]);
      for (let i = 0; i < 4; i += 1) ring('#22d3ee', Math.sin(i * 2.1) * 22, -23 + Math.cos(i * 1.8) * 15, 19, 10, 3);
      for (let i = 0; i < 5; i += 1) fill('#a5f3fc', -35, -36 + i * 13, 70, 2);
      ctx.globalAlpha = 1;
      break;
    case 'spore-vent':
      ring('#115e45', 0, 6, 39, 27, 11); ring('#0b1724', 0, 6, 25, 17, 6);
      for (let i = 0; i < 7; i += 1) { const sx = Math.sin(i * 2.2 + now / 850) * 29; const sy = -33 + (i * 13 + now / 80) % 63; ring('#a7f3d0', sx, sy, 2, 2, 2); }
      break;
    case 'resin-pod':
      ring('#064e3b', 0, 0, 33, 40, 12); ring('#2dd4bf', 0, -6, 25, 28, 6);
      line('#a7f3d0', 3, [[-12, 16], [-18, -3], [-2, -24], [14, -12]]);
      ring('#d1fae5', 7, -5, 5, 7);
      break;
    case 'living-cable':
      for (let i = -2; i <= 2; i += 1) line(i % 2 ? '#0f766e' : '#5eead4', 5, [[-48, i * 12], [-23, i * 10 + 7], [5, i * 9 - 7], [26, i * 10 + 4], [48, i * 12]]);
      break;
    case 'crystal-stump':
      fill('#164e63', -32, -11, 64, 43);
      for (let i = -2; i <= 2; i += 1) {
        line('#a78bfa', 5, [[i * 13, 19], [i * 10 - 7, -15], [i * 10, -41], [i * 10 + 7, -15]]);
      }
      ring('#c4b5fd', 0, 10, 28, 14, 4);
      break;
    case 'node-pylon':
      fill('#052e25', -26, -40, 52, 78); fill('#10b981', -22, -33, 44, 64);
      fill('#042f2e', -16, -27, 32, 54); ring('#d1fae5', 0, -4, 13 + pulse * 2, 19, 4);
      for (let i = 0; i < 4; i += 1) fill('#34d399', -43 + i * 21, 34, 12, 5);
      break;
  }

  if (damage > 0) {
    ctx.globalAlpha = Math.min(0.9, 0.35 + damage * 0.55);
    line('#020617', 3 + damage * 3, [[-38, -21], [-12, -7], [-5, 15], [20, 26]]);
    line('#e2e8f0', 1.5, [[-37, -22], [-11, -8], [-4, 14]]);
    if (damage > 0.55) line('#020617', 4, [[33, -37], [16, -15], [28, 5], [7, 30]]);
    ctx.globalAlpha = 1;
  }
  if (ruined) {
    fill('#071116', -49, -49, 98, 94);
    for (let i = 0; i < 7; i += 1) {
      const px = Math.sin(i * 8.3 + x) * 37;
      const py = Math.cos(i * 5.7 + y) * 31;
      fill(i % 2 ? art.color : '#64748b', px, py, 7 + i % 3 * 4, 4 + i % 2 * 3);
    }
  }
  ctx.restore();
}
