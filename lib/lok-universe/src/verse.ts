// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * The Lok verse look: one painter for the halls that belong to the whole universe (the Lok hall, and later other
 * shared rooms), so every game shows the same place. Games keep their own look inside their own rooms; this is the
 * neutral ground between them. Walls and floor carry only universe marks (the Lok sign, door plaques). A game's own
 * identity appears only on its own door plaque, in its own color. Pure Canvas2D, no assets, no dependencies.
 */
import type { RoomAnchor, RoomLayout } from "./rooms";

/** Palette for the verse. "Arcade Night" base from the GSix standard: obsidian, teal accent, gold secondary. */
export const VERSE = {
  ink: "#07080c",
  wall: "#10131b",
  wallHi: "#1a1f2c",
  floorA: "#12161f",
  floorB: "#171c27",
  teal: "#35e0c8",
  gold: "#f2c14e",
  text: "#eaf2ff",
  /** Door plaque colors per game. A game's color is its only mark on shared walls. */
  game: { survivor: "#ff3d8b", qnk: "#4c8dff", lok: "#f2c14e", soon: "#7a8196" } as Record<string, string>,
} as const;

export interface VerseState {
  now: number;
  focusId: string | null;
  /** The game drawing this hall, so its "home" door wears its color. */
  homeGame: string;
}

const doorGame = (a: RoomAnchor, home: string): string => (a.id === "hall-616" ? "survivor" : a.id === "hall-qnk" ? "qnk" : a.id === "hall-soon" ? "soon" : home);

/** Floor, back wall, sign and floor lights. Call before drawing anchors and avatars. */
export function drawVerseBase(ctx: CanvasRenderingContext2D, layout: RoomLayout, s: VerseState): void {
  const T = layout.tile, W = layout.cols * T, H = layout.rows * T;
  // Floor: polished dark tiles with a soft reflection falling off from the wall.
  for (let r = 2; r < layout.rows; r += 1) for (let c = 0; c < layout.cols; c += 1) {
    ctx.fillStyle = (c + r) % 2 ? VERSE.floorA : VERSE.floorB; ctx.fillRect(c * T, r * T, T, T);
  }
  const refl = ctx.createLinearGradient(0, T * 2, 0, H);
  refl.addColorStop(0, "rgba(120,170,255,0.10)"); refl.addColorStop(0.5, "rgba(120,170,255,0.02)"); refl.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = refl; ctx.fillRect(0, T * 2, W, H - T * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.035)"; ctx.lineWidth = 1;
  for (let c = 0; c <= layout.cols; c += 1) { ctx.beginPath(); ctx.moveTo(c * T + 0.5, T * 2); ctx.lineTo(c * T + 0.5, H); ctx.stroke(); }
  // Center inlay: two rings and six spokes, a quiet mark of the verse around the beacon.
  const cx = W / 2, cy = T * 6;
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = "rgba(53,224,200,0.28)"; ctx.lineWidth = 2;
  for (const rad of [T * 2.6, T * 3.4]) { ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = "rgba(242,193,78,0.22)";
  for (let i = 0; i < 6; i += 1) { const a = (i / 6) * Math.PI * 2 + s.now / 20000; ctx.beginPath(); ctx.moveTo(Math.cos(a) * T * 2.6, Math.sin(a) * T * 2.6); ctx.lineTo(Math.cos(a) * T * 3.4, Math.sin(a) * T * 3.4); ctx.stroke(); }
  ctx.restore();
  // Back wall: panelling with vertical light strips.
  const wall = ctx.createLinearGradient(0, 0, 0, T * 2);
  wall.addColorStop(0, VERSE.ink); wall.addColorStop(1, VERSE.wallHi);
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, T * 2);
  ctx.fillStyle = VERSE.wall;
  for (let c = 0; c < layout.cols; c += 1) { ctx.fillRect(c * T + 4, 10, T - 8, T * 2 - 22); }
  for (let c = 1; c < layout.cols; c += 2) {
    const pulse = 0.55 + 0.35 * Math.sin(s.now / 900 + c);
    ctx.fillStyle = `rgba(53,224,200,${0.35 * pulse})`; ctx.fillRect(c * T - 1, 14, 2, T * 2 - 30);
  }
  ctx.fillStyle = VERSE.gold; ctx.fillRect(0, T * 2 - 4, W, 3);
  // The sign.
  ctx.save(); ctx.font = "bold 26px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = VERSE.teal; ctx.shadowBlur = 12 + 4 * Math.sin(s.now / 500);
  ctx.fillStyle = VERSE.text; ctx.fillText("LOK", W / 2, 22); ctx.restore();
  // Floor lights leading from the beacon to each doorway.
  for (const a of layout.anchors) if (a.kind === "door" && a.row < 4) {
    const ax = (a.col + a.w / 2) * T;
    const g = ctx.createLinearGradient(0, T * 3, 0, T * 5.2); g.addColorStop(0, `${VERSE.game[doorGame(a, s.homeGame)] ?? VERSE.gold}55`); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(ax - T * 0.55, T * 3, T * 1.1, T * 2.2);
  }
}

/** One object in the hall: doors with plaques, the notice board, the beacon. Draw sorted by feet with avatars. */
export function drawVerseAnchor(ctx: CanvasRenderingContext2D, layout: RoomLayout, a: RoomAnchor, s: VerseState, label: string): void {
  const T = layout.tile, x = a.col * T, y = a.row * T, w = a.w * T, h = a.h * T, on = a.id === s.focusId, off = a.enabled === false;
  ctx.save(); ctx.globalAlpha = off ? 0.5 : 1;
  const pulse = 0.5 + 0.5 * Math.sin(s.now / 450);
  if (a.kind === "door") {
    const col = VERSE.game[doorGame(a, s.homeGame)] ?? VERSE.gold;
    const north = a.row < 4;
    if (north) {
      // Arched alcove in the back wall, glowing in the game's color.
      ctx.fillStyle = VERSE.ink; ctx.beginPath(); ctx.moveTo(x + 4, y + h); ctx.lineTo(x + 4, y - T * 0.5); ctx.quadraticCurveTo(x + w / 2, y - T * 1.25, x + w - 4, y - T * 0.5); ctx.lineTo(x + w - 4, y + h); ctx.fill();
      const g = ctx.createLinearGradient(0, y - T, 0, y + h); g.addColorStop(0, `${col}00`); g.addColorStop(1, `${col}${off ? "22" : "66"}`);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = on ? 4 : 2.5; ctx.shadowColor = col; ctx.shadowBlur = off ? 0 : 8 + 6 * pulse; ctx.stroke(); ctx.shadowBlur = 0;
      // Plaque.
      ctx.fillStyle = VERSE.ink; ctx.fillRect(x + w / 2 - 38, y - T * 0.38, 76, 16);
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(x + w / 2 - 38 + 0.5, y - T * 0.38 + 0.5, 75, 15);
    } else {
      ctx.fillStyle = VERSE.ink; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      ctx.fillStyle = `${col}33`; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      ctx.strokeStyle = col; ctx.lineWidth = on ? 4 : 2; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
    }
    ctx.fillStyle = VERSE.text; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label.toUpperCase().slice(0, 14), x + w / 2, north ? y - T * 0.38 + 8 : y + h / 2);
  } else if (a.kind === "noticeboard") {
    ctx.fillStyle = "#2a2018"; ctx.fillRect(x + 4, y + 6, w - 8, h - 12);
    ctx.strokeStyle = VERSE.gold; ctx.lineWidth = on ? 3 : 1.5; ctx.strokeRect(x + 4, y + 6, w - 8, h - 12);
    const sheets = ["#fff4c9", "#cfeeff", "#ffd0e4", "#d6ffe6"];
    for (let i = 0; i < 4; i += 1) { ctx.fillStyle = sheets[i]!; ctx.save(); ctx.translate(x + 12 + (i % 2) * 15, y + 16 + Math.floor(i / 2) * 30); ctx.rotate(((i * 37) % 7 - 3) * 0.03); ctx.fillRect(0, 0, 13, 20); ctx.fillStyle = "#c33"; ctx.fillRect(5, -1, 3, 3); ctx.restore(); }
  } else if (a.kind === "beacon") {
    const cx = x + w / 2, base = y + h - 6;
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(cx, base, w * 0.4, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = VERSE.wallHi; ctx.fillRect(cx - 10, base - 40, 20, 40);
    ctx.fillStyle = VERSE.teal; ctx.shadowColor = VERSE.teal; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(cx, base - 48, 9, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    for (let i = 0; i < 3; i += 1) { const t = ((s.now / 1800) + i / 3) % 1; ctx.strokeStyle = `rgba(53,224,200,${0.5 * (1 - t)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, base - 48, 12 + t * 34, 0, Math.PI * 2); ctx.stroke(); }
    if (on) { ctx.strokeStyle = VERSE.text; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4); }
  }
  ctx.restore();
}

const TOKEN_TAG: Record<string, string> = { survivor: "616", qnk: "QnK", lok: "LOK" };

/** Another player: a round token in their game's color with the game tag and a short name. No avatars cross games. */
export function drawHallPeer(ctx: CanvasRenderingContext2D, x: number, y: number, game: string, name: string): void {
  const col = VERSE.game[game] ?? VERSE.gold;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.ellipse(x, y + 2, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = VERSE.ink; ctx.beginPath(); ctx.arc(x, y - 14, 13, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(x, y - 14, 11, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - 14, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = VERSE.ink; ctx.font = "bold 7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(TOKEN_TAG[game] ?? "LOK", x, y - 14);
  ctx.font = "bold 9px monospace"; ctx.strokeStyle = VERSE.ink; ctx.lineWidth = 3; ctx.fillStyle = VERSE.text; ctx.strokeText(name, x, y - 33); ctx.fillText(name, x, y - 33);
  ctx.restore();
}
