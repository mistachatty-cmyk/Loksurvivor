/**
 * Room skins: how a `RoomLayout` is drawn. Procedural Canvas2D only (no bitmaps, no emoji, no stock icons), animated
 * from the clock passed in. A skin is a palette plus `drawAnchor` cases, so a new look is data, not a new room.
 * `bedroom616` is the neon-street look; `lokHall` is the neutral universal look. Queens N Kings brings its own
 * castle skin to the same interface (see docs/UNIFIED_ROOMS_PLAN.md).
 */
import type { RoomAnchor, RoomLayout } from '../../../../lib/lok-universe/src/rooms';
import { drawGlyph } from './lokGlyphCanvas';
import type { LokGlyphKey } from './lokGlyphs.generated';

export interface RoomSkin {
  id: 'bedroom616' | 'lokHall';
  floorA: string; floorB: string; wall: string; wallTop: string; trim: string; glow: string; ink: string;
}

export const SKIN_BEDROOM_616: RoomSkin = { id: 'bedroom616', floorA: '#1a1622', floorB: '#201a2b', wall: '#2b2236', wallTop: '#120e1a', trim: '#ff3d8b', glow: '#38e1ff', ink: '#0a0710' };
export const SKIN_LOK_HALL: RoomSkin = { id: 'lokHall', floorA: '#13202a', floorB: '#182836', wall: '#1d3140', wallTop: '#0c151c', trim: '#f2c14e', glow: '#7ef0bd', ink: '#060b0f' };

const GLYPH_FOR_KIND: Record<string, LokGlyphKey> = {
  table: 'map', screen: 'map', counter: 'coin', wardrobe: 'heart', mirror: 'spark', locker: 'gear', noticeboard: 'scroll', shelf: 'scroll',
  posters: 'star', trophies: 'trophy', jukebox: 'sound', booth: 'sound', petbed: 'heart', workbench: 'gear', rack: 'blade', cot: 'heart', desk: 'menu',
  wallpanel: 'gear', lever: 'gear', door: 'house', beacon: 'spark',
};

export interface RoomDrawState {
  now: number;
  /** The anchor the avatar is next to, if any: it is lit up. */
  focusId: string | null;
  /** Lever position: true = public hall, false = universal hall. */
  leverPublic: boolean;
}

export function drawRoomBase(ctx: CanvasRenderingContext2D, layout: RoomLayout, skin: RoomSkin, state: RoomDrawState): void {
  const T = layout.tile, W = layout.cols * T, H = layout.rows * T;
  for (let r = 0; r < layout.rows; r += 1) for (let c = 0; c < layout.cols; c += 1) {
    ctx.fillStyle = (c + r) % 2 ? skin.floorA : skin.floorB;
    ctx.fillRect(c * T, r * T, T, T);
  }
  // Floor rug under the middle of the room.
  ctx.fillStyle = `${skin.glow}12`;
  ctx.fillRect(T * 3, T * 4, W - T * 6, H - T * 7);
  // Back wall: panelled, with a glowing trim line along its foot.
  for (const s of layout.solids) {
    ctx.fillStyle = skin.wall;
    ctx.fillRect(s.col * T, s.row * T, s.w * T, s.h * T);
    ctx.fillStyle = skin.wallTop;
    ctx.fillRect(s.col * T, s.row * T, s.w * T, T * 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let c = 0; c < s.w; c += 1) ctx.strokeRect(s.col * T + c * T + 3, s.row * T + T * 0.6, T - 6, s.h * T - T * 0.8);
    const glow = 0.55 + Math.sin(state.now / 700) * 0.15;
    ctx.fillStyle = skin.trim;
    ctx.globalAlpha = glow;
    ctx.fillRect(s.col * T, (s.row + s.h) * T - 3, s.w * T, 3);
    ctx.globalAlpha = 1;
  }
}

/** A shadow under tall things, then the object itself. `state.focusId` lifts and lights the one in reach. */
export function drawAnchor(ctx: CanvasRenderingContext2D, layout: RoomLayout, skin: RoomSkin, a: RoomAnchor, state: RoomDrawState): void {
  const T = layout.tile;
  const x = a.col * T, y = a.row * T, w = a.w * T, h = a.h * T;
  const on = state.focusId === a.id;
  const off = a.enabled === false;
  const pulse = 0.5 + Math.sin(state.now / 260) * 0.5;
  ctx.save();
  ctx.globalAlpha = off ? 0.45 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 2, y + h - 3, w - 4, 5);

  const body = (fill: string, edge: string) => {
    ctx.fillStyle = skin.ink; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = fill; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = edge; ctx.fillRect(x + 3, y + 3, w - 6, 3);
  };
  switch (a.kind) {
    case 'door': {
      ctx.fillStyle = skin.ink; ctx.fillRect(x, y, w, h);
      const lit = off ? '#2a2a33' : skin.glow;
      ctx.fillStyle = lit; ctx.globalAlpha = (off ? 0.45 : 0.45 + pulse * 0.25);
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      ctx.globalAlpha = off ? 0.45 : 1;
      ctx.strokeStyle = lit; ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      break;
    }
    case 'lever': {
      body('#33283f', skin.trim);
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + w / 2, y + h - 10);
      ctx.lineTo(x + w / 2 + (state.leverPublic ? 10 : -10), y + 10); ctx.stroke();
      ctx.fillStyle = state.leverPublic ? '#f2c14e' : skin.glow;
      ctx.beginPath(); ctx.arc(x + w / 2 + (state.leverPublic ? 10 : -10), y + 10, 4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'table': {
      body('#3a2f4a', skin.glow);
      ctx.fillStyle = `${skin.glow}33`; ctx.fillRect(x + 10, y + 12, w - 20, h - 24);
      ctx.strokeStyle = `${skin.glow}aa`; ctx.lineWidth = 1;
      for (let i = 1; i < 4; i += 1) { ctx.beginPath(); ctx.moveTo(x + 10 + (i * (w - 20)) / 4, y + 12); ctx.lineTo(x + 10 + (i * (w - 20)) / 4, y + h - 12); ctx.stroke(); }
      break;
    }
    case 'beacon': {
      body('#1e3a46', skin.glow);
      ctx.fillStyle = skin.glow; ctx.globalAlpha = 0.25 + pulse * 0.35;
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 14 + pulse * 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'jukebox': case 'booth': {
      body('#40204f', skin.trim);
      ctx.fillStyle = skin.glow; ctx.globalAlpha = 0.4 + pulse * 0.4;
      for (let i = 0; i < 4; i += 1) ctx.fillRect(x + 8 + i * 6, y + h - 12 - ((Math.sin(state.now / 120 + i) + 1) * 6), 3, 8 + (Math.sin(state.now / 120 + i) + 1) * 6);
      ctx.globalAlpha = off ? 0.45 : 1;
      break;
    }
    case 'trophies': case 'shelf': case 'wardrobe': case 'locker': case 'mirror': case 'noticeboard': case 'posters': case 'screen': case 'wallpanel': {
      body(a.kind === 'screen' ? '#10303a' : '#352a42', a.kind === 'screen' ? skin.glow : skin.trim);
      if (a.kind === 'screen') { ctx.fillStyle = skin.glow; ctx.globalAlpha = 0.3 + pulse * 0.2; ctx.fillRect(x + 6, y + 10, w - 12, h - 18); ctx.globalAlpha = off ? 0.45 : 1; }
      break;
    }
    default: body('#352a42', skin.trim);
  }
  // Glyph badge so every object says what it is without text.
  const key = GLYPH_FOR_KIND[a.kind] ?? 'dot';
  ctx.fillStyle = off ? '#8b8b98' : '#fff';
  drawGlyph(ctx, key, x + w / 2, y + h / 2 + 1, Math.min(w, h) * 0.42);
  if (on && !off) {
    ctx.globalAlpha = 0.6 + pulse * 0.4;
    ctx.strokeStyle = skin.glow; ctx.lineWidth = 2;
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
  }
  ctx.restore();
}
