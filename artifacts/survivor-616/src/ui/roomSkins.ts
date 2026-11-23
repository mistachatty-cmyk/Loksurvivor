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
  table: 'map', screen: 'map', counter: 'coin', wardrobe: 'star', mirror: 'spark', locker: 'gear', noticeboard: 'scroll', shelf: 'scroll',
  posters: 'star', stash: 'coin', trophies: 'trophy', jukebox: 'sound', booth: 'sound', petbed: 'heart', workbench: 'gear', rack: 'blade', cot: 'heart', desk: 'menu',
  wallpanel: 'gear', lever: 'gear', door: 'house', beacon: 'spark',
};

export interface RoomDrawState {
  now: number;
  /** The anchor the avatar is next to, if any: it is lit up. */
  focusId: string | null;
  /** Lever position: true = public hall, false = universal hall. */
  leverPublic: boolean;
  /** Live save info drawn on objects: a count tag and/or a pulsing alert dot. */
  status?: Record<string, { count?: number; alert?: boolean }>;
}

const compact = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** The 616 skyline in the back wall's window strip: layered towers with lit windows, a river glow, a neon sign. */
function drawSkyline(ctx: CanvasRenderingContext2D, layout: RoomLayout, skin: RoomSkin, now: number): void {
  const T = layout.tile, W = layout.cols * T, top = 4, bot = T * 1.5;
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, skin.id === 'bedroom616' ? '#1b1030' : '#0e2230'); g.addColorStop(1, skin.id === 'bedroom616' ? '#4a1a4f' : '#1d4a55');
  ctx.fillStyle = g; ctx.fillRect(6, top, W - 12, bot - top);
  let seed = layout.cols * 31 + (skin.id === 'lokHall' ? 7 : 3);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let layer = 0; layer < 2; layer += 1) {
    let x = 6;
    while (x < W - 6) {
      const bw = 16 + rnd() * 26, bh = 14 + rnd() * (layer ? 30 : 44);
      ctx.fillStyle = layer ? '#1a1226' : '#0d0916';
      ctx.fillRect(x, bot - bh, Math.min(bw, W - 6 - x), bh);
      if (layer) for (let wy = bot - bh + 4; wy < bot - 4; wy += 7) for (let wx = x + 3; wx < x + bw - 4 && wx < W - 8; wx += 6) {
        if (rnd() > 0.55) { ctx.fillStyle = rnd() > 0.85 ? skin.trim : '#ffd88a'; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 900 + wx + wy); ctx.fillRect(wx, wy, 2, 3); ctx.globalAlpha = 1; }
      }
      x += bw + 2;
    }
  }
  // Neon sign: the number of the place (digits only, drawn as text).
  ctx.save();
  ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = skin.trim; ctx.shadowBlur = 10 + Math.sin(now / 400) * 4;
  ctx.fillStyle = skin.id === 'bedroom616' ? '#ffd0e4' : '#fff4c9';
  ctx.fillText('616', W / 2, top + 20);
  ctx.restore();
}

export function drawRoomBase(ctx: CanvasRenderingContext2D, layout: RoomLayout, skin: RoomSkin, state: RoomDrawState): void {
  const T = layout.tile, W = layout.cols * T, H = layout.rows * T;
  for (let r = 0; r < layout.rows; r += 1) for (let c = 0; c < layout.cols; c += 1) {
    ctx.fillStyle = (c + r) % 2 ? skin.floorA : skin.floorB;
    ctx.fillRect(c * T, r * T, T, T);
  }
  // Floor rug under the middle of the room, with a border.
  ctx.fillStyle = `${skin.glow}12`;
  ctx.fillRect(T * 3, T * 4, W - T * 6, H - T * 7);
  ctx.strokeStyle = `${skin.glow}33`; ctx.lineWidth = 2;
  ctx.strokeRect(T * 3 + 4, T * 4 + 4, W - T * 6 - 8, H - T * 7 - 8);
  // Back wall: panelled, with a glowing trim line along its foot.
  for (const s of layout.solids) {
    ctx.fillStyle = skin.wall;
    ctx.fillRect(s.col * T, s.row * T, s.w * T, s.h * T);
    ctx.fillStyle = skin.wallTop;
    ctx.fillRect(s.col * T, s.row * T, s.w * T, T * 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let c = 0; c < s.w; c += 1) ctx.strokeRect(s.col * T + c * T + 3, s.row * T + T * 0.6, T - 6, s.h * T - T * 0.8);
    drawSkyline(ctx, layout, skin, state.now);
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
    case 'shelf': case 'trophies': {
      body('#352a42', skin.trim);
      const cols = ['#ff6b9a', '#38e1ff', '#f2c14e', '#9b7bff', '#7ef0bd'];
      for (let i = 0; i < a.w * 4; i += 1) { ctx.fillStyle = cols[i % cols.length]!; ctx.fillRect(x + 6 + i * 9, y + 9 + (i % 3) * 2, 6, h - 22); }
      break;
    }
    case 'wardrobe': {
      body('#3b2c4d', skin.trim);
      ctx.fillStyle = skin.ink; ctx.fillRect(x + w / 2 - 1, y + 8, 2, h - 14);
      ctx.fillStyle = skin.trim; ctx.fillRect(x + w / 2 - 6, y + h / 2, 3, 6); ctx.fillRect(x + w / 2 + 3, y + h / 2, 3, 6);
      break;
    }
    case 'locker': {
      body('#2b3b4d', skin.glow);
      ctx.fillStyle = skin.ink; for (let i = 0; i < 3; i += 1) ctx.fillRect(x + 12, y + 10 + i * 3, w - 24, 1.5);
      break;
    }
    case 'mirror': {
      body('#2b2240', skin.glow);
      const sh = ctx.createLinearGradient(x, y, x + w, y + h); sh.addColorStop(0, '#9fe9ff55'); sh.addColorStop(1, '#ffffff10');
      ctx.fillStyle = sh; ctx.fillRect(x + 6, y + 8, w - 12, h - 14);
      break;
    }
    case 'noticeboard': {
      body('#4a3a2a', skin.trim);
      const sheets = ['#fff4c9', '#ffd0e4', '#cfeeff'];
      for (let i = 0; i < 3; i += 1) { ctx.fillStyle = sheets[i]!; ctx.fillRect(x + 7 + (i % 2) * 9, y + 10 + i * Math.min(12, h / 4), 9, 9); }
      break;
    }
    case 'posters': {
      body('#2a2036', skin.trim);
      ctx.fillStyle = '#ff3d8b'; ctx.fillRect(x + 7, y + 9, w - 14, h - 18);
      ctx.fillStyle = '#ffd88a'; ctx.fillRect(x + 11, y + 14, w - 22, 3);
      break;
    }
    case 'screen': {
      body('#10303a', skin.glow);
      ctx.fillStyle = skin.glow; ctx.globalAlpha = 0.3 + pulse * 0.2; ctx.fillRect(x + 6, y + 10, w - 12, h - 18); ctx.globalAlpha = off ? 0.45 : 1;
      ctx.fillStyle = skin.glow; for (let i = 0; i < 4; i += 1) ctx.fillRect(x + 10, y + 14 + i * 5, (w - 20) * (0.4 + ((i * 37) % 10) / 20), 1.5);
      break;
    }
    case 'workbench': case 'desk': case 'counter': {
      body('#3a3040', skin.glow);
      ctx.fillStyle = '#1b1624'; ctx.fillRect(x + 4, y + h - 9, 4, 6); ctx.fillRect(x + w - 8, y + h - 9, 4, 6);
      if (a.kind === 'desk') { ctx.fillStyle = skin.glow; ctx.globalAlpha = 0.5; ctx.fillRect(x + w - 22, y + 8, 14, 9); ctx.globalAlpha = off ? 0.45 : 1; }
      break;
    }
    case 'rack': {
      body('#2a2d3a', skin.trim);
      ctx.strokeStyle = '#cfd6e6'; ctx.lineWidth = 2;
      for (let i = 0; i < a.w * 2; i += 1) { ctx.beginPath(); ctx.moveTo(x + 10 + i * 12, y + 7); ctx.lineTo(x + 10 + i * 12, y + h - 8); ctx.stroke(); }
      break;
    }
    case 'cot': case 'petbed': {
      body(a.kind === 'cot' ? '#2f3b4a' : '#4a2f45', skin.glow);
      ctx.fillStyle = a.kind === 'cot' ? '#cfeeff' : '#ffc2dc'; ctx.fillRect(x + 7, y + 9, 14, h - 18);
      break;
    }
    case 'stash': {
      body('#3a2f1a', '#f2c14e');
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(x + w / 2 - 3, y + h / 2 - 2, 6, 6);
      break;
    }
    case 'wallpanel': {
      body('#2a2d3a', skin.glow);
      ctx.fillStyle = skin.glow; ctx.globalAlpha = 0.6 + pulse * 0.3; ctx.fillRect(x + w - 11, y + 9, 3, 3); ctx.globalAlpha = off ? 0.45 : 1;
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
  const st = state.status?.[a.id];
  if (st && !off) {
    if (st.count !== undefined && st.count > 0) {
      const label = compact(st.count);
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const bw = Math.max(16, ctx.measureText(label).width + 8);
      ctx.fillStyle = skin.ink; ctx.fillRect(x + w - bw + 2, y - 7, bw, 14);
      ctx.strokeStyle = skin.glow; ctx.lineWidth = 1; ctx.strokeRect(x + w - bw + 2.5, y - 6.5, bw - 1, 13);
      ctx.fillStyle = '#fff'; ctx.fillText(label, x + w - bw / 2 + 2, y);
    }
    if (st.alert) {
      ctx.fillStyle = '#ff3d3d'; ctx.globalAlpha = 0.6 + pulse * 0.4;
      ctx.beginPath(); ctx.arc(x + 4, y + 2, 5 + pulse * 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(x + 3, y - 1, 2, 4); ctx.fillRect(x + 3, y + 4, 2, 2);
    }
  }
  ctx.restore();
}
