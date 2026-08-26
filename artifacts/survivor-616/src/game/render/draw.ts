/**
 * Canvas renderer for a run.
 *
 * The world is drawn in world units; the camera transform handles scroll and
 * zoom. Everything is flat-shaded rectangles and simple vector shapes so it
 * reads as pixel art without needing image atlases.
 */

import type { World } from '@/game/engine/world';
import { DUNGEON_ERAS } from '@/game/data/dungeonEras';
import { STATUS_EFFECTS_BY_ID } from '@/game/data/statusEffects';
import type { ObstacleDef } from '@/game/types';

import { drawRig, drawShadow } from './sprite';
import { clamp } from '@/game/engine/math';

/** World units of sprite height per rig pixel. */
const SPRITE_SCALE = 2.05;

export interface Viewport {
  width: number;
  height: number;
  dpr: number;
}

function hashCell(x: number, y: number): number {
  let h = x * 73856093 + y * 19349663;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ */
/* Ground                                                              */
/* ------------------------------------------------------------------ */

function drawGround(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number) {
  const ground = w.area.ground;
  ctx.fillStyle = ground.base;
  ctx.fillRect(left, top, right - left, bottom - top);

  const tile = 64;
  const startX = Math.floor(left / tile) * tile;
  const startY = Math.floor(top / tile) * tile;

  // Slab shading: alternating tiles plus a few glowing puddles.
  for (let x = startX; x < right; x += tile) {
    for (let y = startY; y < bottom; y += tile) {
      const cx = x / tile;
      const cy = y / tile;
      const noise = hashCell(cx, cy);
      if (noise > 0.62) {
        ctx.fillStyle = ground.tile;
        ctx.globalAlpha = 0.5 + noise * 0.3;
        ctx.fillRect(x, y, tile, tile);
        ctx.globalAlpha = 1;
      }
      if (noise > 0.93) {
        ctx.fillStyle = ground.glow;
        ctx.globalAlpha = 0.3;
        const px = x + 10 + noise * 18;
        const py = y + 14 + noise * 12;
        ctx.beginPath();
        ctx.ellipse(px, py, 22, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  ctx.strokeStyle = ground.seam;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  for (let x = startX; x < right; x += tile) {
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
  }
  for (let y = startY; y < bottom; y += tile) {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Small, deterministic bits of city dressing that sit between the combat props. */
function drawStreetDressing(ctx: CanvasRenderingContext2D, w: World, left: number, top: number, right: number, bottom: number) {
  const endless = Boolean(w.area.endless);
  const dungeon = Boolean(w.endless?.inDungeon);
  const accent = groundAccent(w);
  const step = 192;
  const startX = Math.floor(left / step) * step;
  const startY = Math.floor(top / step) * step;

  ctx.save();
  ctx.lineWidth = 2;
  for (let x = startX; x < right; x += step) {
    for (let y = startY; y < bottom; y += step) {
      const n = hashCell(x / step, y / step);
      // Broken curb segments and painted lane fragments stop the grid reading
      // as a collection of square arenas while remaining purely cosmetic.
      if (n > 0.42) {
        ctx.globalAlpha = dungeon ? 0.12 : 0.2;
        ctx.strokeStyle = dungeon ? w.area.ground.glow : w.area.ground.seam;
        ctx.setLineDash(n > 0.72 ? [18, 12] : [5, 15]);
        ctx.beginPath();
        ctx.moveTo(x + 18, y + 34 + n * 18);
        ctx.lineTo(x + 142, y + 34 + n * 18);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (!dungeon && n > 0.78) {
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = accent;
        ctx.beginPath();
        ctx.moveTo(x + 20, y + 150);
        ctx.lineTo(x + 76, y + 132);
        ctx.lineTo(x + 134, y + 150);
        ctx.stroke();
      }
      if (endless && n < 0.16) {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#101018';
        ctx.beginPath();
        ctx.ellipse(x + 96, y + 96, 38 + n * 30, 11 + n * 8, n * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawChunkLandmark(
  ctx: CanvasRenderingContext2D,
  block: {
    x: number;
    y: number;
    landmark?: { name: string; kind: string; accent: string };
  },
) {
  const landmark = block.landmark;
  if (!landmark) return;

  const { x, y } = block;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = landmark.accent;
  ctx.fillStyle = `${landmark.accent}26`;
  ctx.shadowColor = landmark.accent;
  ctx.shadowBlur = 18;

  if (landmark.kind === 'bridge') {
    // The tall deck and paired towers are intentionally readable from a
    // distance, while the chevrons point toward the only safe river gap.
    ctx.fillStyle = '#1c3443';
    ctx.fillRect(x - 32, y - 122, 64, 244);
    ctx.strokeRect(x - 32, y - 122, 64, 244);
    ctx.fillStyle = landmark.accent;
    ctx.globalAlpha = 0.72;
    for (let plankY = y - 104; plankY <= y + 104; plankY += 22) {
      ctx.fillRect(x - 26, plankY, 52, 5);
    }
    ctx.globalAlpha = 0.95;
    ctx.fillRect(x - 58, y - 128, 12, 40);
    ctx.fillRect(x + 46, y - 128, 12, 40);
    ctx.fillRect(x - 58, y + 88, 12, 40);
    ctx.fillRect(x + 46, y + 88, 12, 40);

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#f6c453';
    for (const markerY of [y - 172, y + 172]) {
      ctx.beginPath();
      if (markerY < y) {
        ctx.moveTo(x - 18, markerY + 10);
        ctx.lineTo(x, markerY - 8);
        ctx.lineTo(x + 18, markerY + 10);
      } else {
        ctx.moveTo(x - 18, markerY - 10);
        ctx.lineTo(x, markerY + 8);
        ctx.lineTo(x + 18, markerY - 10);
      }
      ctx.stroke();
    }
  } else if (landmark.kind === 'market') {
    ctx.fillRect(x - 116, y - 34, 232, 68);
    ctx.strokeRect(x - 116, y - 34, 232, 68);
    ctx.fillRect(x - 12, y - 86, 24, 52);
    ctx.strokeRect(x - 12, y - 86, 24, 52);
    ctx.fillStyle = landmark.accent;
    ctx.globalAlpha = 0.75;
    for (let awningX = x - 96; awningX <= x + 72; awningX += 28) {
      ctx.beginPath();
      ctx.moveTo(awningX, y - 29);
      ctx.lineTo(awningX + 20, y - 29);
      ctx.lineTo(awningX + 14, y - 8);
      ctx.lineTo(awningX + 6, y - 8);
      ctx.closePath();
      ctx.fill();
    }
  } else if (landmark.kind === 'rail-yard') {
    ctx.globalAlpha = 0.55;
    for (const trackY of [y - 32, y + 32]) {
      ctx.beginPath();
      ctx.moveTo(x - 126, trackY);
      ctx.lineTo(x + 126, trackY);
      ctx.stroke();
      for (let trackX = x - 108; trackX <= x + 108; trackX += 24) {
        ctx.fillRect(trackX - 2, trackY - 7, 4, 14);
      }
    }
    ctx.globalAlpha = 0.95;
    ctx.fillRect(x - 8, y - 92, 16, 160);
    ctx.strokeRect(x - 26, y - 108, 52, 16);
    ctx.fillRect(x - 34, y - 88, 68, 5);
  } else {
    // Four approach paths and a rotunda make the plaza a useful visual anchor.
    ctx.globalAlpha = 0.42;
    ctx.fillRect(x - 128, y - 7, 256, 14);
    ctx.fillRect(x - 7, y - 128, 14, 256);
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.arc(x, y, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(x - 4, y - 68, 8, 24);
    ctx.fillRect(x - 4, y + 44, 8, 24);
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(landmark.name.toUpperCase(), x, y - 142);
  ctx.restore();
}

function drawCityMapFeatures(ctx: CanvasRenderingContext2D, w: World) {
  const e = w.endless;
  if (!e || e.inDungeon || e.inBuilding) return;

  for (const block of e.cityBlocks) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = block.river ? '#4de1ff' : '#f6c453';
    ctx.setLineDash([10, 12]);
    ctx.lineWidth = 2;
    ctx.strokeRect(block.x - block.w / 2 + 8, block.y - block.h / 2 + 8, block.w - 16, block.h - 16);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = block.landmark?.accent ?? (block.river ? '#6ee7ff' : '#f6c453');
    ctx.font = '10px monospace';
    ctx.fillText(
      `${block.landmark?.name.toUpperCase() ?? block.kind.toUpperCase()} · ${block.cx},${block.cy}`,
      block.x - block.w / 2 + 18,
      block.y - block.h / 2 + 22,
    );
    ctx.restore();
  }

  for (const river of e.riverSegments) {
    ctx.save();
    ctx.fillStyle = '#123b58';
    ctx.globalAlpha = 0.82;
    ctx.fillRect(river.x - river.w / 2, river.y - river.h / 2, river.w, river.h);
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = '#6ee7ff';
    ctx.lineWidth = 2;
    for (let x = river.x - river.w / 2 + 12; x < river.x + river.w / 2; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, river.y - 18);
      ctx.lineTo(x + 16, river.y - 8);
      ctx.lineTo(x, river.y + 2);
      ctx.stroke();
    }
    if (river.crossingX !== null) {
      ctx.fillStyle = '#f6c453';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(river.crossingX - 28, river.y - river.h / 2, 56, river.h);
    } else {
      // Orange bank caps warn that this river edge is not a crossing.
      ctx.strokeStyle = '#fb7185';
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(river.x - river.w / 2 + 8, river.y - river.h / 2 + 5);
      ctx.lineTo(river.x + river.w / 2 - 8, river.y - river.h / 2 + 5);
      ctx.moveTo(river.x - river.w / 2 + 8, river.y + river.h / 2 - 5);
      ctx.lineTo(river.x + river.w / 2 - 8, river.y + river.h / 2 - 5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  for (const block of e.cityBlocks) {
    drawChunkLandmark(ctx, block);
  }

  for (const door of e.buildingEntrances) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#f6c453';
    ctx.fillRect(door.x - door.w / 2, door.y - door.h / 2, door.w, door.h);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(door.x - 5, door.y - 8, 10, 16);
    ctx.font = '9px monospace';
    ctx.fillText(door.label.toUpperCase(), door.x - 35, door.y - 20);
    ctx.restore();
  }
}

function groundAccent(w: World): string {
  if (w.endless?.inDungeon) return effectiveGround(w).glow;
  return w.area.ground.glow;
}

/** A streetlight pool that keeps the middle of the fight readable. */
function drawLightPool(ctx: CanvasRenderingContext2D, w: World) {
  const radius = 340;
  const gradient = ctx.createRadialGradient(w.player.x, w.player.y, 20, w.player.x, w.player.y, radius);
  gradient.addColorStop(0, 'rgba(255,255,255,0.075)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.03)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(w.player.x - radius, w.player.y - radius, radius * 2, radius * 2);
}

function drawLandmark(ctx: CanvasRenderingContext2D, w: World) {
  const landmark = w.area.landmark;
  if (!landmark) return;
  const x = 0;
  const y = -150;
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = landmark.accent;
  ctx.fillStyle = `${landmark.accent}22`;
  ctx.shadowColor = landmark.accent;
  ctx.shadowBlur = 16;

  if (landmark.kind === 'market') {
    // Long hall, repeated awnings, and a high bell tower.
    ctx.fillRect(x - 142, y - 26, 284, 58);
    ctx.strokeRect(x - 142, y - 26, 284, 58);
    ctx.fillRect(x - 22, y - 76, 44, 50);
    ctx.strokeRect(x - 22, y - 76, 44, 50);
    ctx.fillStyle = landmark.accent;
    for (let i = -3; i <= 3; i += 1) {
      ctx.globalAlpha = i % 2 === 0 ? 0.85 : 0.32;
      ctx.beginPath();
      ctx.moveTo(x + i * 40 - 20, y - 42);
      ctx.lineTo(x + i * 40 + 20, y - 42);
      ctx.lineTo(x + i * 40 + 12, y - 20);
      ctx.lineTo(x + i * 40 - 12, y - 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x, y + 2, 14, 0, Math.PI * 2);
    ctx.stroke();
  } else if (landmark.kind === 'rail-yard') {
    ctx.globalAlpha = 0.5;
    for (const trackY of [-44, 44]) {
      ctx.beginPath();
      ctx.moveTo(x - 190, y + trackY);
      ctx.lineTo(x + 190, y + trackY);
      ctx.stroke();
      for (let trackX = -170; trackX <= 170; trackX += 34) {
        ctx.fillRect(x + trackX - 2, y + trackY - 9, 4, 18);
      }
    }
    ctx.globalAlpha = 0.85;
    // Signal tower with a stepped cap, deliberately taller than nearby props.
    ctx.fillRect(x - 9, y - 78, 18, 136);
    ctx.strokeRect(x - 30, y - 94, 60, 18);
    ctx.fillRect(x - 42, y - 76, 84, 5);
    ctx.fillRect(x - 34, y - 58, 5, 116);
    ctx.fillRect(x + 29, y - 58, 5, 116);
    ctx.fillStyle = '#fff1d0';
    ctx.fillRect(x - 4, y - 72, 8, 8);
  } else if (landmark.kind === 'plaza') {
    // Four approach paths make the rotunda readable even at mobile zoom.
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x - 155, y - 8, 310, 16);
    ctx.fillRect(x - 8, y - 155, 16, 310);
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.arc(x, y, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(x - 4, y - 80, 8, 28);
    ctx.fillRect(x - 4, y + 52, 8, 28);
  } else {
    // Floodgate: twin buttresses and a central gate face.
    ctx.fillRect(x - 170, y - 38, 340, 76);
    ctx.strokeRect(x - 170, y - 38, 340, 76);
    ctx.fillRect(x - 190, y - 64, 26, 102);
    ctx.fillRect(x + 164, y - 64, 26, 102);
    ctx.strokeRect(x - 190, y - 64, 26, 102);
    ctx.strokeRect(x + 164, y - 64, 26, 102);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 130, y + 26);
    ctx.lineTo(x - 60, y - 24);
    ctx.lineTo(x + 15, y + 26);
    ctx.lineTo(x + 90, y - 24);
    ctx.lineTo(x + 150, y + 26);
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = landmark.accent;
    ctx.fillRect(x - 5, y - 30, 10, 60);
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(landmark.name.toUpperCase(), x, y - 92);
  ctx.restore();
}

function effectiveGround(w: World) {
  if (w.endless?.inDungeon) {
    const era = DUNGEON_ERAS[w.endless.dungeonEraIndex];
    if (era) return era.ground;
  }
  return w.area.ground;
}

function inferObstacleKind(obs: { w: number; h: number }): ObstacleDef['kind'] {
  const aspect = obs.w / obs.h;
  if (aspect > 2.5) return 'barrier';
  if (obs.w > 95) return 'car';
  if (obs.w > 65) return 'dumpster';
  return 'crate';
}

function drawArenaEdges(ctx: CanvasRenderingContext2D, w: World) {
  // Endless mode has no walls.
  if (w.area.endless) return;

  const halfW = w.bounds.w / 2;
  const halfH = w.bounds.h / 2;
  const thickness = 26;

  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(-halfW - 400, -halfH - 400, w.bounds.w + 800, 400);
  ctx.fillRect(-halfW - 400, halfH, w.bounds.w + 800, 400);
  ctx.fillRect(-halfW - 400, -halfH, 400, w.bounds.h);
  ctx.fillRect(halfW, -halfH, 400, w.bounds.h);

  ctx.fillStyle = w.area.ground.seam;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-halfW, -halfH, w.bounds.w, 4);
  ctx.fillRect(-halfW, halfH - 4, w.bounds.w, 4);
  ctx.fillRect(-halfW, -halfH, 4, w.bounds.h);
  ctx.fillRect(halfW - 4, -halfH, 4, w.bounds.h);
  ctx.globalAlpha = 1;

  // Hazard striping just inside the boundary.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = w.area.ground.glow;
  for (let x = -halfW; x < halfW; x += 46) {
    ctx.fillRect(x, -halfH + 4, 24, thickness * 0.35);
    ctx.fillRect(x, halfH - 4 - thickness * 0.35, 24, thickness * 0.35);
  }
  ctx.restore();
}

/** Glowing doorway markers for dungeon entrances on the street. */
function drawDungeonEntrances(ctx: CanvasRenderingContext2D, w: World) {
  const e = w.endless;
  if (!e || e.inDungeon) return;

  const pulse = 0.65 + Math.sin(w.now / 380) * 0.35;

  for (const en of e.dungeonEntrances) {
    const x = en.x - en.w / 2;
    const y = en.y - en.h / 2;

    // Glow
    ctx.save();
    ctx.shadowColor = '#f0a848';
    ctx.shadowBlur = 22 * pulse;
    ctx.globalAlpha = 0.55 + pulse * 0.3;

    // Portal frame
    ctx.fillStyle = '#f0a848';
    ctx.fillRect(x, y, en.w, 4);               // top bar
    ctx.fillRect(x, y + en.h - 4, en.w, 4);    // bottom bar
    ctx.fillRect(x, y, 4, en.h);               // left post
    ctx.fillRect(x + en.w - 4, y, 4, en.h);    // right post

    // Stair symbol inside
    ctx.globalAlpha = 0.4 * pulse;
    ctx.fillStyle = '#fff8e0';
    const cx = en.x;
    const cy = en.y;
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(cx - 7 + i * 5, cy - 3 + i * 3, 12 - i * 4, 2);
    }

    ctx.restore();
  }
}

/** Exit zone marker shown inside dungeon rooms. */
function drawDungeonExit(ctx: CanvasRenderingContext2D, w: World) {
  const e = w.endless;
  if (!e || !e.inDungeon || !e.exitZone) return;

  const exit = e.exitZone;
  const x = exit.x - exit.w / 2;
  const y = exit.y - exit.h / 2;
  const pulse = 0.65 + Math.sin(w.now / 300) * 0.35;

  ctx.save();
  ctx.shadowColor = '#7ef0bd';
  ctx.shadowBlur = 20 * pulse;
  ctx.globalAlpha = 0.6 + pulse * 0.25;

  ctx.strokeStyle = '#7ef0bd';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, exit.w - 4, exit.h - 4);

  // Arrow pointing right (the exit)
  ctx.fillStyle = '#7ef0bd';
  ctx.globalAlpha = 0.55 * pulse;
  ctx.beginPath();
  const mx = exit.x + 4;
  const my = exit.y;
  ctx.moveTo(mx - 8, my - 6);
  ctx.lineTo(mx + 8, my);
  ctx.lineTo(mx - 8, my + 6);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawDungeonChest(ctx: CanvasRenderingContext2D, w: World) {
  const chest = w.endless?.dungeonChest;
  if (!chest || !w.endless?.inDungeon) return;
  const pulse = 0.65 + Math.sin(w.now / 260) * 0.35;
  ctx.save();
  ctx.globalAlpha = chest.unlocked ? 0.85 + pulse * 0.15 : 0.55;
  ctx.shadowColor = chest.unlocked ? '#ffd166' : '#64748b';
  ctx.shadowBlur = chest.unlocked ? 20 * pulse : 6;
  ctx.fillStyle = chest.unlocked ? '#a16207' : '#334155';
  ctx.fillRect(chest.x - 20, chest.y - 16, 40, 28);
  ctx.fillStyle = chest.unlocked ? '#fde68a' : '#94a3b8';
  ctx.fillRect(chest.x - 20, chest.y - 16, 40, 7);
  ctx.fillRect(chest.x - 3, chest.y - 5, 6, 10);
  ctx.font = '9px monospace';
  ctx.fillText(chest.opened ? 'SECURED' : chest.unlocked ? 'OPEN' : 'LOCKED', chest.x - 28, chest.y + 30);
  ctx.restore();
}

/** Faint perimeter walls around a dungeon room so the player knows the boundary. */
function drawDungeonRoomBorder(ctx: CanvasRenderingContext2D, w: World) {
  const e = w.endless;
  if (!e || !e.inDungeon) return;

  const hw = e.dungeonBounds.w / 2;
  const hh = e.dungeonBounds.h / 2;
  const cx = e.dungeonCenterX;
  const cy = e.dungeonCenterY;

  const ground = effectiveGround(w);

  ctx.save();
  ctx.strokeStyle = ground.seam;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.7;
  ctx.strokeRect(cx - hw, cy - hh, e.dungeonBounds.w, e.dungeonBounds.h);

  ctx.strokeStyle = ground.glow;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.25;
  ctx.strokeRect(cx - hw + 6, cy - hh + 6, e.dungeonBounds.w - 12, e.dungeonBounds.h - 12);

  ctx.restore();
}

const OBSTACLE_COLORS: Record<ObstacleDef['kind'], { top: string; side: string; trim: string }> = {
  dumpster: { top: '#2f5d4a', side: '#1c3a2e', trim: '#48876c' },
  car: { top: '#57324a', side: '#331d2c', trim: '#8a4f74' },
  crate: { top: '#6b4a2c', side: '#3f2b19', trim: '#94693e' },
  planter: { top: '#3a4a2c', side: '#232d1a', trim: '#5c7444' },
  barrier: { top: '#5a5a62', side: '#33333a', trim: '#8b8b96' },
  'ac-unit': { top: '#4a5560', side: '#2b323a', trim: '#6f7d8c' },
  'neon-sign': { top: '#193c50', side: '#102632', trim: '#4de1ff' },
  barrel: { top: '#70411f', side: '#3d2414', trim: '#f0760a' },
  'fuse-box': { top: '#275343', side: '#18352b', trim: '#7ef0bd' },
  'street-lamp': { top: '#66512a', side: '#302614', trim: '#ffd166' },
  'car-wreck': { top: '#493a4d', side: '#29232d', trim: '#a77aa8' },
  'crate-breakable': { top: '#6b4a2c', side: '#3f2b19', trim: '#d69b5d' },
  'security-camera': { top: '#3e4650', side: '#252a31', trim: '#ff7ab8' },
  cover: { top: '#5f4b35', side: '#33281e', trim: '#fbbf24' },
  'reflective-surface': { top: '#263e5b', side: '#142438', trim: '#d8b4fe' },
  flora: { top: '#244b32', side: '#142a1d', trim: '#54b96e' },
  building: { top: '#303344', side: '#171923', trim: '#70769a' },
  river: { top: '#123b58', side: '#0a2030', trim: '#4de1ff' },
  'metal-box': { top: '#536273', side: '#2d3745', trim: '#cbd5e1' },
  bench: { top: '#70543a', side: '#3b2c20', trim: '#c58b5d' },
  pothole: { top: '#17131a', side: '#0a080d', trim: '#ef4444' },
};

function drawPotholes(ctx: CanvasRenderingContext2D, w: World) {
  for (const pothole of w.potholes) {
    const progress = pothole.state === 'opening'
      ? clamp((w.now - pothole.openingStartedAt) / pothole.openingMs, 0, 1)
      : pothole.state === 'open' || pothole.state === 'resolved' ? 1 : 0;
    const pulse = 0.72 + Math.sin(w.now / 90) * 0.2;
    const x = pothole.x;
    const y = pothole.y;
    ctx.save();
    ctx.globalAlpha = pothole.state === 'dormant' ? 0.5 : 0.88;
    ctx.fillStyle = pothole.state === 'open' ? '#050308' : '#17131a';
    ctx.beginPath();
    ctx.ellipse(x, y + 6, pothole.w * (0.42 + progress * 0.08), pothole.h * (0.28 + progress * 0.08), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pothole.state === 'dormant' ? '#5b4050' : '#ef4444';
    ctx.lineWidth = pothole.state === 'opening' ? 3 : 2;
    if (pothole.state === 'opening') {
      ctx.globalAlpha = 0.6 + progress * 0.35;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -w.now / 18;
    }
    ctx.beginPath();
    ctx.ellipse(x, y + 5, pothole.w * (0.46 + progress * 0.1), pothole.h * (0.31 + progress * 0.09), 0, 0, Math.PI * 2);
    ctx.stroke();
    if (pothole.state === 'open') {
      ctx.globalAlpha = pulse * 0.42;
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 5, pothole.w * 0.58, pothole.h * 0.44, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('KEEP CLEAR', x, y - pothole.h * 0.42);
    } else if (pothole.state === 'opening') {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MOVE', x, y - pothole.h * 0.42);
    }
    ctx.restore();
  }
}

function drawObstacles(ctx: CanvasRenderingContext2D, w: World) {
  const height = 16;
  // Draw the live prop records so streamed chunks and moving props share the
  // same authored silhouette and profile.
  const obstacleList: Array<{ x: number; y: number; w: number; h: number; kind: ObstacleDef['kind'] }> =
    w.area.endless
      ? w.breakables.filter((b) => !b.broken).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h, kind: o.kind }))
      : w.breakables.filter((b) => !b.broken).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h, kind: o.kind }));

  for (const obstacle of obstacleList) {
    const colors = OBSTACLE_COLORS[obstacle.kind] ?? OBSTACLE_COLORS.crate;
    const x = obstacle.x - obstacle.w / 2;
    const y = obstacle.y - obstacle.h / 2;

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 10, y + obstacle.h + 10, obstacle.w, Math.max(5, obstacle.h * 0.18));
    ctx.globalAlpha = 1;

    ctx.fillStyle = colors.side;
    ctx.fillRect(x, y - height + obstacle.h, obstacle.w, height);
    ctx.fillStyle = colors.top;
    ctx.fillRect(x, y - height, obstacle.w, obstacle.h);
    ctx.strokeStyle = colors.trim;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y - height + 1, obstacle.w - 2, obstacle.h - 2);

    // Combat props get a strong, readable symbol in addition to their silhouette.
    if (obstacle.kind === 'cover') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + obstacle.w * 0.18, y - height + obstacle.h * 0.65);
      ctx.lineTo(x + obstacle.w * 0.38, y - height + obstacle.h * 0.28);
      ctx.lineTo(x + obstacle.w * 0.62, y - height + obstacle.h * 0.65);
      ctx.lineTo(x + obstacle.w * 0.82, y - height + obstacle.h * 0.28);
      ctx.stroke();
      ctx.restore();
    } else if (obstacle.kind === 'reflective-surface') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#f5e8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + obstacle.w * 0.2, y - height + obstacle.h * 0.75);
      ctx.lineTo(x + obstacle.w * 0.5, y - height + obstacle.h * 0.2);
      ctx.lineTo(x + obstacle.w * 0.8, y - height + obstacle.h * 0.75);
      ctx.stroke();
      ctx.restore();
    } else if (obstacle.kind === 'flora') {
      ctx.save();
      ctx.fillStyle = '#18321f';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(obstacle.x - 3, y - height + obstacle.h * 0.55, 6, obstacle.h * 0.45);
      ctx.fillStyle = '#4fbd68';
      for (let i = 0; i < 5; i += 1) {
        const leafX = obstacle.x + Math.sin(i * 2.7) * obstacle.w * 0.35;
        const leafY = y - height + obstacle.h * (0.2 + i * 0.13);
        ctx.beginPath();
        ctx.ellipse(leafX, leafY, obstacle.w * 0.28, obstacle.h * 0.13, i % 2 ? 0.45 : -0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (obstacle.kind === 'barrier') {
      // Add a curb and repeating reflectors so long cover reads as a street
      // object instead of another arena wall.
      ctx.save();
      ctx.fillStyle = colors.trim;
      ctx.globalAlpha = 0.75;
      for (let marker = x + 12; marker < x + obstacle.w - 6; marker += 24) {
        ctx.fillRect(marker, y - height + obstacle.h * 0.35, 8, 3);
      }
      ctx.restore();
    } else if (obstacle.kind === 'car' || obstacle.kind === 'car-wreck') {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#d8b4fe';
      ctx.fillRect(x + obstacle.w * 0.18, y - height + obstacle.h * 0.22, obstacle.w * 0.64, 5);
      ctx.fillStyle = '#11121a';
      ctx.fillRect(x + obstacle.w * 0.16, y - height + obstacle.h * 0.7, 12, 5);
      ctx.fillRect(x + obstacle.w * 0.72, y - height + obstacle.h * 0.7, 12, 5);
      ctx.restore();
    }

    const live = w.breakables.find((b) => Math.abs(b.x - obstacle.x) < 1 && Math.abs(b.y - obstacle.y) < 1);
    if (live?.clickPrimed) {
      ctx.save();
      const pulse = 0.7 + Math.sin(w.now / 120) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x - 5, y - height - 5, obstacle.w + 10, obstacle.h + 10);
      ctx.setLineDash([]);
      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NEXT HIT REVERSES', obstacle.x, y - height - 10);
      ctx.restore();
    }
    if (live && !live.broken && live.hp <= live.maxHp * 0.5) {
      ctx.save();
      ctx.strokeStyle = live.kind === 'barrel' ? '#ffb347' : '#f5d7a1';
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + obstacle.w * 0.25, y - height + 5);
      ctx.lineTo(x + obstacle.w * 0.48, y - height + obstacle.h * 0.6);
      ctx.lineTo(x + obstacle.w * 0.7, y - height + obstacle.h * 0.25);
      ctx.stroke();
      ctx.restore();
    } else if (obstacle.kind === 'metal-box') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 7, y - height + 7, obstacle.w - 14, obstacle.h - 14);
      ctx.beginPath();
      ctx.moveTo(x + obstacle.w * 0.2, y - height + obstacle.h * 0.2);
      ctx.lineTo(x + obstacle.w * 0.8, y - height + obstacle.h * 0.8);
      ctx.moveTo(x + obstacle.w * 0.8, y - height + obstacle.h * 0.2);
      ctx.lineTo(x + obstacle.w * 0.2, y - height + obstacle.h * 0.8);
      ctx.stroke();
      ctx.restore();
    } else if (obstacle.kind === 'bench') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#e2b07a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + obstacle.w * 0.12, y - height + obstacle.h * 0.32);
      ctx.lineTo(x + obstacle.w * 0.88, y - height + obstacle.h * 0.32);
      ctx.moveTo(x + obstacle.w * 0.2, y - height + obstacle.h * 0.75);
      ctx.lineTo(x + obstacle.w * 0.8, y - height + obstacle.h * 0.75);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawObjectLighting(ctx: CanvasRenderingContext2D, w: World) {
  for (const pole of w.breakables) {
    if (pole.kind !== 'street-lamp' || !pole.broken || !pole.hazardUntil || pole.hazardUntil <= w.now) continue;
    const radius = 92;
    const pulse = 0.65 + Math.sin(w.now / 85) * 0.2;
    const gradient = ctx.createRadialGradient(pole.x, pole.y, 4, pole.x, pole.y, radius);
    gradient.addColorStop(0, '#ffe66d88');
    gradient.addColorStop(0.55, '#8be9fd35');
    gradient.addColorStop(1, '#8be9fd00');
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pole.x, pole.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d9f7ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.stroke();
    ctx.restore();
  }
  if (w.now < w.ultActiveUntil) {
    const radius = 160;
    const g = ctx.createRadialGradient(w.player.x, w.player.y, 8, w.player.x, w.player.y, radius);
    g.addColorStop(0, `${w.character.palette.glow}1f`); g.addColorStop(1, `${w.character.palette.glow}00`);
    ctx.fillStyle = g; ctx.fillRect(w.player.x - radius, w.player.y - radius, radius * 2, radius * 2);
  }
  for (const enemy of w.enemies) {
    if (enemy.dying || enemy.defId !== 'ash-wisp') continue;
    const r = 52;
    const g = ctx.createRadialGradient(enemy.x, enemy.y, 2, enemy.x, enemy.y, r);
    g.addColorStop(0, '#ff4de155'); g.addColorStop(1, '#ff4de100');
    ctx.fillStyle = g; ctx.fillRect(enemy.x - r, enemy.y - r, r * 2, r * 2);
  }
  for (const boss of w.enemies.filter((e) => !e.dying && e.def.family === 'Boss' && w.now - e.animStartedAt < 1200)) {
    const fade = 1 - (w.now - boss.animStartedAt) / 1200;
    ctx.save(); ctx.globalAlpha = Math.max(0, fade) * 0.32; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(boss.x - 12, boss.y - 300); ctx.lineTo(boss.x - 70, boss.y + 20); ctx.lineTo(boss.x + 70, boss.y + 20); ctx.lineTo(boss.x + 12, boss.y - 300); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  const sources = w.breakables.filter((b) => !b.broken && ['barrel', 'neon-sign', 'street-lamp', 'fuse-box'].includes(b.kind));
  let dynamicCount = 0;
  for (const b of sources) {
    const isBarrel = b.kind === 'barrel';
    const radius = b.kind === 'street-lamp' ? 200 : b.kind === 'barrel' ? 120 + Math.sin(w.now / 80) * 10 : b.kind === 'neon-sign' ? 90 : 80;
    const color = b.kind === 'barrel' ? '#f0760a' : b.kind === 'neon-sign' ? '#4de1ff' : b.kind === 'fuse-box' ? '#7ef0bd' : '#ffd166';
    const pulse = b.kind === 'neon-sign' ? 0.8 + Math.sin(w.now / 420) * 0.15 : 1;
    const gradient = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, radius);
    gradient.addColorStop(0, `${color}55`);
    gradient.addColorStop(0.45, `${color}20`);
    gradient.addColorStop(1, `${color}00`);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = gradient;
    ctx.fillRect(b.x - radius, b.y - radius, radius * 2, radius * 2);
    if (b.kind === 'fuse-box') {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = color;
      ctx.fillRect(b.x - b.w * 0.8, b.y + b.h / 2, b.w * 1.6, 10);
    }
    ctx.restore();

    if (dynamicCount++ < 3 && isBarrel) {
      for (const actor of [w.player, ...w.enemies].slice(0, 45)) {
        if (Math.hypot(actor.x - b.x, actor.y - b.y) > radius) continue;
        const dx = actor.x - b.x; const dy = actor.y - b.y; const len = Math.hypot(dx, dy) || 1;
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(actor.x + (dx / len) * 12, actor.y + (dy / len) * 12, actor.radius * 1.3, 4, Math.atan2(dy, dx), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  // Rebuild hard-edged occlusion every frame. The two rear-most corners of
  // each nearby obstacle are projected away from the moving light source, so
  // shadows rotate, stretch, and vanish immediately when a breakable breaks.
  const shadowSources = sources.slice(0, 5);
  const shadowObjects = w.breakables.filter((b) => !b.broken && !['barrel', 'neon-sign', 'street-lamp', 'fuse-box'].includes(b.kind));
  for (const source of shadowSources) {
    for (const object of shadowObjects) {
      const distance = Math.hypot(object.x - source.x, object.y - source.y);
      if (distance > 260) continue;
      const corners = [
        { x: object.x - object.w / 2, y: object.y - object.h / 2 },
        { x: object.x + object.w / 2, y: object.y - object.h / 2 },
        { x: object.x + object.w / 2, y: object.y + object.h / 2 },
        { x: object.x - object.w / 2, y: object.y + object.h / 2 },
      ];
      const awayX = (object.x - source.x) / (distance || 1);
      const awayY = (object.y - source.y) / (distance || 1);
      const far = [...corners].sort((a, b) =>
        (b.x * awayX + b.y * awayY) - (a.x * awayX + a.y * awayY),
      ).slice(0, 2);
      const length = Math.min(180, Math.max(55, 300 - distance));
      ctx.save();
      ctx.globalAlpha = 0.56;
      ctx.fillStyle = '#020208';
      ctx.beginPath();
      ctx.moveTo(far[0]!.x, far[0]!.y);
      ctx.lineTo(far[1]!.x, far[1]!.y);
      ctx.lineTo(far[1]!.x + awayX * length, far[1]!.y + awayY * length);
      ctx.lineTo(far[0]!.x + awayX * length, far[0]!.y + awayY * length);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = source.kind === 'neon-sign' ? '#4de1ff' : '#ffd166';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(far[0]!.x, far[0]!.y);
      ctx.lineTo(far[1]!.x, far[1]!.y);
      ctx.stroke();
      ctx.restore();
    }
  }
  // Neon glass keeps a ghost of its sign on the pavement for two seconds.
  for (const b of w.breakables) {
    if (b.kind !== 'neon-sign' || !b.broken || w.now - b.brokenAt >= 2000) continue;
    const fade = 1 - (w.now - b.brokenAt) / 2000;
    ctx.save(); ctx.globalAlpha = fade * 0.3; ctx.fillStyle = '#4de1ff';
    ctx.fillRect(b.x - b.w / 2, b.y + b.h / 2, b.w, 8); ctx.restore();
  }
  // Security cameras sweep a cosmetic cone; it never changes enemy stats.
  for (const b of w.breakables) {
    if (b.broken || b.kind !== 'security-camera') continue;
    const angle = Math.sin(w.now / 900) * 0.75;
    const gradient = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, 170);
    gradient.addColorStop(0, '#ffffff30'); gradient.addColorStop(1, '#ff7ab800');
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(angle); ctx.globalAlpha = 0.22;
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 170, -0.18, 0.18); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  for (const pole of w.breakables) {
    if (pole.kind !== 'street-lamp' || !pole.broken || !pole.hazardUntil || pole.hazardUntil <= w.now) continue;
    const angle = pole.fallAngle ?? Math.PI / 2;
    ctx.save();
    ctx.translate(pole.x, pole.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#302614';
    ctx.fillRect(-4, -pole.h, 8, pole.h);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-10, -pole.h - 4, 20, 8);
    ctx.restore();
  }
}

function drawAwarenessArrow(ctx: CanvasRenderingContext2D, w: World) {
  const elite = w.enemies.find((e) => !e.dying && (e.def.family === 'Boss' || e.maxHp > 100) && Math.hypot(e.x - w.player.x, e.y - w.player.y) < 500);
  if (!elite) return;
  const dx = elite.x - w.player.x; const dy = elite.y - w.player.y; const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(w.player.x, w.player.y + 24);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ff7ab8';
  ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(8, -6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Entities                                                            */
/* ------------------------------------------------------------------ */

function drawPickups(ctx: CanvasRenderingContext2D, w: World) {
  for (const pickup of w.pickups) {
    const bob = Math.sin((w.now - pickup.bornAt) / 220) * 2;
    const x = pickup.x;
    const y = pickup.y + bob;

    ctx.save();
    switch (pickup.kind) {
      case 'xp':
        ctx.fillStyle = '#6ee7ff';
        ctx.shadowColor = '#6ee7ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 5, y);
        ctx.closePath();
        ctx.fill();
        break;
      case 'health':
        ctx.fillStyle = '#7dffb2';
        ctx.shadowColor = '#7dffb2';
        ctx.shadowBlur = 10;
        ctx.fillRect(x - 6, y - 2, 12, 4);
        ctx.fillRect(x - 2, y - 6, 4, 12);
        break;
      case 'cred':
        ctx.fillStyle = '#ffd166';
        ctx.shadowColor = '#ffd166';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'sweep':
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 14;
        for (let i = 0; i < 4; i += 1) {
          const angle = (Math.PI / 2) * i + w.now / 400;
          ctx.fillRect(x + Math.cos(angle) * 6 - 2, y + Math.sin(angle) * 6 - 2, 4, 4);
        }
        break;
      case 'loot-box': {
        const pulse = 0.7 + Math.sin((w.now - pickup.bornAt) / 180) * 0.3;
        // Blue crate body
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 18 * pulse;
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(x - 9, y - 8, 18, 16);
        // Top highlight
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(x - 9, y - 8, 18, 4);
        // Side highlight
        ctx.globalAlpha = 0.6 * pulse;
        ctx.fillStyle = '#93c5fd';
        ctx.fillRect(x - 7, y - 6, 3, 11);
        // Lock icon
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(x, y + 1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - 2, y + 1, 4, 4);
        break;
      }
    }
    ctx.restore();
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, w: World) {
  for (const effect of w.effects) {
    const life = (w.now - effect.bornAt) / Math.max(1, effect.expiresAt - effect.bornAt);
    const fade = 1 - life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);

    switch (effect.kind) {
      case 'slash': {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 9 * fade + 3;
        ctx.lineCap = 'round';
        const sweep = effect.spread * (0.35 + life * 0.9);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (0.55 + life * 0.5), effect.angle - sweep, effect.angle + sweep);
        ctx.stroke();
        break;
      }
      case 'nova':
      case 'ring': {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = effect.kind === 'ring' ? 6 * fade + 2 : 8 * fade + 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (0.25 + life * 0.85), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = Math.max(0, fade * 0.14);
        ctx.fillStyle = effect.color;
        ctx.fill();
        break;
      }
      case 'aura':
      case 'spark': {
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * fade, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'wave': {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 5 * fade + 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (0.45 + life * 0.55),
          effect.angle - effect.spread, effect.angle + effect.spread);
        ctx.stroke();
        break;
      }
      case 'laser': {
        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 16;
        ctx.lineWidth = 12 * fade + 3;
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.lineTo(effect.x + Math.cos(effect.angle) * effect.radius,
          effect.y + Math.sin(effect.angle) * effect.radius);
        ctx.stroke();
        break;
      }
      case 'hazard': {
        ctx.strokeStyle = effect.color;
        ctx.fillStyle = effect.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (0.92 + Math.sin(w.now / 150) * 0.04), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha *= 0.12;
        ctx.fill();
        break;
      }
      case 'teleport': {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (1 - fade) + 8, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }
}

function drawPersistentAura(ctx: CanvasRenderingContext2D, w: World) {
  for (const weapon of w.weapons.filter((entry) => entry.def.kind === 'aura')) {
    const radius = weapon.def.range * w.stats.area;
    const pulse = 0.06 + Math.sin(w.now / 260) * 0.02;
    const color = weapon.def.color ?? w.character.palette.glow;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(w.player.x, w.player.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawOrbiters(ctx: CanvasRenderingContext2D, w: World) {
  for (const orb of w.orbiters) {
    const x = w.player.x + Math.cos(orb.angle) * orb.radius;
    const y = w.player.y + Math.sin(orb.angle) * orb.radius;
    ctx.save();
    const weapon = w.weapons.find((entry) => entry.def.id === orb.weaponId);
    const color = weapon?.def.color ?? w.character.palette.glow;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x) - 5, Math.round(y) - 4, 10, 8);
    ctx.fillStyle = w.character.palette.ink;
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 4, 2, 8);
    ctx.fillRect(Math.round(x) + 2, Math.round(y) - 4, 2, 8);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x) - 6, Math.round(y) - 8, 5, 3);
    ctx.restore();
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, w: World) {
  for (const proj of w.projectiles) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = proj.color;
    ctx.lineWidth = proj.radius;
    ctx.lineCap = 'round';
    if (proj.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(proj.trail[0]!.x, proj.trail[0]!.y);
      for (const point of proj.trail) ctx.lineTo(point.x, point.y);
      ctx.lineTo(proj.x, proj.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = proj.fromPlayer ? proj.color : '#ff7a7a';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRescue(ctx: CanvasRenderingContext2D, w: World) {
  const rescue = w.rescue;
  if (rescue.status === 'pending' || rescue.status === 'freed') return;

  const pulse = 0.5 + Math.sin(w.now / 240) * 0.3;
  ctx.save();
  ctx.globalAlpha = 0.25 + pulse * 0.2;
  ctx.strokeStyle = '#ffe08a';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -w.now / 40;
  ctx.beginPath();
  ctx.arc(rescue.x, rescue.y, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // A hunched figure behind bars.
  ctx.fillStyle = '#141018';
  ctx.fillRect(rescue.x - 14, rescue.y - 26, 28, 30);
  ctx.fillStyle = '#c9a26a';
  ctx.fillRect(rescue.x - 7, rescue.y - 18, 14, 16);
  ctx.fillStyle = '#8a8f9c';
  for (let i = -12; i <= 12; i += 6) {
    ctx.fillRect(rescue.x + i, rescue.y - 26, 2, 30);
  }
  ctx.fillRect(rescue.x - 14, rescue.y - 28, 28, 3);

  if (rescue.progress > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(rescue.x - 24, rescue.y + 12, 48, 6);
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(rescue.x - 23, rescue.y + 13, 46 * rescue.progress, 4);
  }
  ctx.restore();
}

function drawActors(ctx: CanvasRenderingContext2D, w: World) {
  const outlineEnemies = w.enemies.length < 70;

  for (const pet of w.lokPets) {
    const pulse = 0.86 + Math.sin(w.now / 115 + pet.uid) * 0.14;
    const alpha = pet.ghost ? 0.3 + pulse * 0.08 : pulse;
    const y = pet.y - 4;
    ctx.save();
    ctx.translate(pet.x, y);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = pet.palette.glow;
    ctx.shadowBlur = pet.ghost ? 13 : 9;
    ctx.fillStyle = pet.palette.body;
    ctx.strokeStyle = pet.palette.accent;
    ctx.lineWidth = 2;
    if (pet.ghost) ctx.setLineDash([3, 3]);

    switch (pet.silhouette) {
      case 'pouncer':
        ctx.beginPath(); ctx.ellipse(0, 2, 10, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-7, -3); ctx.lineTo(-9, -12); ctx.lineTo(-2, -7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(7, -3); ctx.lineTo(9, -12); ctx.lineTo(2, -7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = pet.palette.glow; ctx.beginPath(); ctx.arc(10, 0, 7, -1.2, 0.75); ctx.stroke();
        break;
      case 'skull':
        ctx.beginPath(); ctx.arc(0, 0, 9, Math.PI, 0); ctx.lineTo(7, 8); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = pet.palette.eye; ctx.fillRect(-5, -1, 3, 4); ctx.fillRect(2, -1, 3, 4);
        ctx.fillStyle = pet.palette.bodyDark; ctx.fillRect(-2, 4, 4, 3);
        break;
      case 'winglet':
        ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(-15, -7); ctx.lineTo(-9, 7); ctx.lineTo(0, 4); ctx.lineTo(9, 7); ctx.lineTo(15, -7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = pet.palette.eye; ctx.fillRect(-2, -1, 4, 4);
        break;
      case 'spark':
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(5, -3); ctx.lineTo(12, 0); ctx.lineTo(5, 4); ctx.lineTo(0, 12); ctx.lineTo(-5, 4); ctx.lineTo(-12, 0); ctx.lineTo(-5, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = pet.palette.eye; ctx.fillRect(-2, -2, 4, 4);
        break;
      case 'jelly':
        ctx.beginPath(); ctx.moveTo(-11, 7); ctx.lineTo(-9, -2); ctx.quadraticCurveTo(-7, -11, 0, -9); ctx.quadraticCurveTo(7, -11, 9, -2); ctx.lineTo(11, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = pet.palette.eye; ctx.fillRect(-5, -1, 3, 4); ctx.fillRect(2, -1, 3, 4);
        break;
      case 'clockwork':
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = pet.palette.accent; ctx.fillRect(-3, -3, 6, 6);
        ctx.strokeStyle = pet.palette.glow; ctx.beginPath(); ctx.moveTo(-13, -6); ctx.lineTo(-8, -3); ctx.moveTo(13, 5); ctx.lineTo(8, 2); ctx.stroke();
        break;
    }
    if (!pet.ghost) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = pet.palette.glow;
      ctx.beginPath(); ctx.ellipse(0, 10, 14, 4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // Followers stay just above the ground layer and use a compact mark so
  // swarms remain readable on phones without needing a second sprite atlas.
  for (const follower of w.followers) {
    const pulse = 0.8 + Math.sin(w.now / 110 + follower.uid) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.shadowColor = follower.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = follower.color;
    ctx.beginPath();
    ctx.arc(follower.x, follower.y - follower.radius * 0.35, follower.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(follower.x - 2, follower.y - follower.radius * 0.65, 4, 3);
    ctx.restore();
  }

  // Painter's order: things further up the screen render first.
  const sorted = [...w.enemies].sort((a, b) => a.y - b.y);
  const playerDrawn = { done: false };

  const drawPlayer = () => {
    if (playerDrawn.done) return;
    playerDrawn.done = true;
    const p = w.player;
    const scale = SPRITE_SCALE;
    const fallProgress = p.falling ? clamp((w.now - p.fallStartedAt) / 700, 0, 1) : 0;
    drawShadow(ctx, p.x, p.y + 2, p.radius * (1 - fallProgress * 0.65));

    if (p.dashUntil > w.now) {
      const dashProgress = clamp((w.now - p.dashStartedAt) / 180, 0, 1);
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 4; i >= 1; i -= 1) {
        ctx.globalAlpha = (1 - i / 5) * (1 - dashProgress * 0.35);
        ctx.strokeStyle = w.character.palette.accentBright;
        ctx.lineWidth = 3 + (5 - i);
        ctx.beginPath();
        ctx.moveTo(
          p.x - p.dashDirectionX * (i * 13 + 12),
          p.y - p.dashDirectionY * (i * 13 + 12),
        );
        ctx.lineTo(p.x - p.dashDirectionX * (i * 13), p.y - p.dashDirectionY * (i * 13));
        ctx.stroke();
      }
      ctx.restore();
    }

    // A faint accent ring keeps the player findable in a crowd.
    ctx.save();
    const ring = ctx.createRadialGradient(p.x, p.y + 2, 2, p.x, p.y + 2, p.radius + 15);
    ring.addColorStop(0, `${w.character.palette.accent}35`);
    ring.addColorStop(1, `${w.character.palette.accent}00`);
    ctx.fillStyle = ring;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, p.radius + 12, (p.radius + 12) * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = w.character.palette.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, p.radius + 3, (p.radius + 3) * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const invuln = w.now < p.invulnUntil && w.outcome === 'running';
    const blink = invuln && Math.floor(w.now / 70) % 2 === 0;
    drawRig(
      ctx,
      w.character.rig,
      w.character.palette,
      p.anim,
      w.now - p.animStartedAt,
      p.x,
      p.y + 2 + fallProgress * 12,
      p.facing,
      scale * (1 - fallProgress * 0.72),
      {
        flash: w.now < p.hitFlashUntil,
        outline: true,
        alpha: blink ? 0.45 : 1,
        dissolve: w.outcome === 'dead' && !p.falling ? Math.min(0.85, (w.now - p.animStartedAt) / 900) : fallProgress * 0.25,
        tint:
          w.now < w.ultActiveUntil
            ? { color: w.character.palette.glow, alpha: 0.28 }
            : undefined,
      },
    );
  };

  for (const enemy of sorted) {
    if (enemy.y > w.player.y) drawPlayer();
    const converted = enemy.convertedUntil > w.now && !enemy.dying;
    if (!enemy.dying && (enemy.telegraphUntil > w.now || enemy.specialUntil > w.now)) {
      const telegraph = enemy.telegraphUntil > w.now;
      const radius = enemy.specialRadius || enemy.radius * 3;
      ctx.save();
      ctx.globalAlpha = telegraph ? 0.72 : 0.28;
      ctx.strokeStyle = enemy.specialKind === 'current' ? '#35d0bb' : '#e879f9';
      ctx.lineWidth = telegraph ? 3 : 6;
      if (telegraph) {
        ctx.setLineDash([10, 7]);
        ctx.lineDashOffset = -w.now / 24;
      }
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, telegraph ? radius * (0.82 + 0.18 * Math.sin(w.now / 90)) : radius, 0, Math.PI * 2);
      ctx.stroke();
      if (telegraph) {
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = enemy.specialKind === 'current' ? '#35d0bb' : '#e879f9';
        ctx.fill();
      }
      ctx.restore();
    }
    const fallProgress = enemy.falling ? clamp((w.now - enemy.fallStartedAt) / 620, 0, 1) : 0;
    const dissolve = enemy.dying && !enemy.falling ? Math.min(0.95, (w.now - enemy.deathAt) / 520) : fallProgress * 0.28;
    const ghosting = enemy.ghostUntil > w.now && !enemy.dying;
    const freeze = enemy.activeEffects.find((effect) => effect.id === 'freeze');
    if (converted) {
      const pulse = 0.72 + Math.sin(w.now / 130) * 0.18;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#65f6d1';
      ctx.shadowColor = '#65f6d1';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y + 2, enemy.radius + 9 + Math.sin(w.now / 170) * 2, 0, Math.PI * 2);
      ctx.stroke();
      // A compact chevron above the enemy reads as "friendly" without
      // obscuring the enemy sprite or the health bar.
      ctx.fillStyle = '#65f6d1';
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y - enemy.radius * 2.25);
      ctx.lineTo(enemy.x - 7, enemy.y - enemy.radius * 2.65);
      ctx.lineTo(enemy.x - 2, enemy.y - enemy.radius * 2.65);
      ctx.lineTo(enemy.x, enemy.y - enemy.radius * 2.42);
      ctx.lineTo(enemy.x + 2, enemy.y - enemy.radius * 2.65);
      ctx.lineTo(enemy.x + 7, enemy.y - enemy.radius * 2.65);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (freeze && !enemy.dying) {
      const freezeDef = STATUS_EFFECTS_BY_ID.freeze!;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.1 * Math.sin(w.now / 100);
      ctx.strokeStyle = freezeDef.color;
      ctx.shadowColor = freezeDef.color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y + 2, enemy.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawShadow(ctx, enemy.x, enemy.y + 2, enemy.radius * (1 - Math.max(dissolve, fallProgress) * 0.6));
    const shadowed = w.breakables.some((b) => !b.broken &&
      enemy.x > b.x + 10 - enemy.radius && enemy.x < b.x + b.w + 10 + enemy.radius &&
      enemy.y > b.y + 12 - enemy.radius && enemy.y < b.y + b.h + 12 + enemy.radius);
    ctx.save();
    ctx.globalAlpha = ghosting ? 0.22 : shadowed ? 0.4 : 1;
    drawRig(
      ctx,
      enemy.def.rig,
      enemy.def.palette,
      enemy.anim,
      w.now - enemy.animStartedAt,
      enemy.x,
      enemy.y + 2 + fallProgress * 10,
      enemy.facing,
      SPRITE_SCALE * (enemy.def.family === 'Boss' ? 1.55 : 1) * (enemy.radius / enemy.baseRadius) * (1 - fallProgress * 0.72),
      {
        flash: w.now < enemy.hitFlashUntil,
        outline: outlineEnemies || enemy.def.family === 'Boss',
        dissolve,
        tint: converted
          ? { color: '#65f6d1', alpha: 0.42 }
          : freeze ? { color: STATUS_EFFECTS_BY_ID.freeze!.color, alpha: 0.38 } : undefined,
      },
    );
    ctx.restore();

    // Health bar for anything meaningfully tough.
    if (!enemy.dying && enemy.hp < enemy.maxHp && enemy.maxHp > 60) {
      const width = Math.max(22, enemy.radius * 2.2);
      const top = enemy.y - enemy.radius * 2.6;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(enemy.x - width / 2, top, width, 4);
      ctx.fillStyle = converted ? '#65f6d1' : enemy.def.palette.accent;
      ctx.fillRect(enemy.x - width / 2, top, width * (enemy.hp / enemy.maxHp), 4);
    }
  }
  drawPlayer();
}

function drawParticles(ctx: CanvasRenderingContext2D, w: World) {
  for (const particle of w.particles) {
    const life = (w.now - particle.bornAt) / particle.lifeMs;
    ctx.globalAlpha = Math.max(0, 1 - life);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function drawPopups(ctx: CanvasRenderingContext2D, w: World) {
  ctx.font = 'bold 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  for (const popup of w.popups) {
    const life = (w.now - popup.bornAt) / 700;
    ctx.globalAlpha = Math.max(0, 1 - life);
    ctx.fillStyle = '#000000';
    ctx.fillText(popup.text, popup.x + 1, popup.y + 1);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, popup.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function renderWorld(ctx: CanvasRenderingContext2D, w: World, view: Viewport) {
  const { width, height, dpr } = view;

  // Show roughly the same slice of the world regardless of screen size.
  const targetView = width < 620 ? 470 : Math.min(980, width * 0.78);
  const zoom = width / targetView;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#06060a';
  ctx.fillRect(0, 0, width, height);

  const shakeX = w.shake > 0 ? (Math.random() - 0.5) * w.shake : 0;
  const shakeY = w.shake > 0 ? (Math.random() - 0.5) * w.shake : 0;

  ctx.save();
  ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
  ctx.scale(zoom, zoom);
  ctx.translate(-w.camera.x, -w.camera.y);

  const halfViewW = width / 2 / zoom;
  const halfViewH = height / 2 / zoom;
  const left = w.camera.x - halfViewW - 40;
  const right = w.camera.x + halfViewW + 40;
  const top = w.camera.y - halfViewH - 40;
  const bottom = w.camera.y + halfViewH + 40;

  // Use the era's ground palette when inside a dungeon room.
  const ground = effectiveGround(w);
  drawGround(ctx, { ...w, area: { ...w.area, ground } }, left, top, right, bottom);
  if (w.endless?.inDungeon) {
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.1 + Math.min(0.08, w.endless.dungeonEraIndex * 0.015);
    ctx.fillRect(left, top, right - left, bottom - top);
    ctx.globalAlpha = 1;
  }
  drawCityMapFeatures(ctx, w);
  drawStreetDressing(ctx, { ...w, area: { ...w.area, ground } }, left, top, right, bottom);
  drawLightPool(ctx, w);
  drawLandmark(ctx, w);
  drawObjectLighting(ctx, w);
  drawArenaEdges(ctx, w);
  drawDungeonRoomBorder(ctx, w);
  drawPersistentAura(ctx, w);
  drawRescue(ctx, w);
  drawPickups(ctx, w);
  drawDungeonEntrances(ctx, w);
  drawDungeonExit(ctx, w);
  drawDungeonChest(ctx, w);
  drawPotholes(ctx, w);
  drawObstacles(ctx, w);
  drawAwarenessArrow(ctx, w);
  drawActors(ctx, w);
  drawOrbiters(ctx, w);
  drawEffects(ctx, w);
  drawProjectiles(ctx, w);
  drawParticles(ctx, w);
  drawPopups(ctx, w);

  ctx.restore();

  // Vignette keeps the eye on the middle of the fight.
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.38,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.78,
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Damage flash.
  const sinceHit = w.now - w.player.lastDamageAt;
  if (sinceHit < 260) {
    ctx.globalAlpha = (1 - sinceHit / 260) * 0.3;
    ctx.fillStyle = '#ff2d55';
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }
}
