// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Lok rooms: the shared, style-free contract for walkable rooms (bedrooms and halls) in every Lok game.
 *
 * A room is layout + content + skin. THIS file is layout and content only: where things are, where you can
 * stand, what an object does when you use it, how doors resolve. Each game draws it with its own skin
 * (see docs/LOK_UNIFIED_ROOMS.md). Pure functions, no DOM, no canvas, no storage, so both games and their tests share it.
 *
 * Coordinates are in tiles (col, row) for layout and in world units (tile * layout.tile) for walking.
 */

export type RoomId = "room.616" | "room.qnk" | "room.lok" | "hall.616" | "hall.qnk" | "hall.lok";
export type RoomGame = "survivor" | "qnk" | "lok";

/** What using an object does. Ids are each game's own panel and destination names, nothing is renamed. */
export type RoomAction =
  | { type: "panel"; panel: string }
  | { type: "door"; to: RoomId }
  | { type: "lever" }
  | { type: "launch"; game: RoomGame; mode?: string }
  | { type: "external"; game: RoomGame; note?: string }
  /** Shows a line of text and does nothing else (a notice board, the centre beacon). `key` is the game's own text key. */
  | { type: "note"; key: string };

export interface RoomRect { col: number; row: number; w: number; h: number }

export interface RoomAnchor extends RoomRect {
  /** Unique within the layout. Skins switch on `kind` to draw it; the game maps `id` to a label. */
  id: string;
  kind: string;
  action: RoomAction;
  /** False draws the object as unavailable (a door to a hall that does not exist yet). */
  enabled?: boolean;
}

export interface RoomLayout {
  id: RoomId;
  cols: number;
  rows: number;
  /** World units per tile. */
  tile: number;
  /** Where the avatar appears, in tiles. */
  start: { col: number; row: number };
  /** Walls and furniture you cannot walk through. Anchors are solid unless `walkable` lists them. */
  solids: RoomRect[];
  anchors: RoomAnchor[];
}

const inside = (r: RoomRect, c: number, rw: number) => c >= r.col && c < r.col + r.w && rw >= r.row && rw < r.row + r.h;

/** Tiles you cannot stand on: the room edge is implied, solids and every anchor are solid. */
export function shutTiles(layout: RoomLayout): Set<string> {
  const out = new Set<string>();
  for (const r of [...layout.solids, ...layout.anchors]) {
    for (let c = r.col; c < r.col + r.w; c += 1) for (let rw = r.row; rw < r.row + r.h; rw += 1) out.add(`${c},${rw}`);
  }
  return out;
}

/** Everything wrong with a layout, as plain sentences. Empty means valid. */
export function validateLayout(layout: RoomLayout): string[] {
  const problems: string[] = [];
  const within = (r: RoomRect) => r.col >= 0 && r.row >= 0 && r.col + r.w <= layout.cols && r.row + r.h <= layout.rows && r.w > 0 && r.h > 0;
  const ids = new Set<string>();
  for (const a of layout.anchors) {
    if (ids.has(a.id)) problems.push(`duplicate anchor id ${a.id}`);
    ids.add(a.id);
    if (!within(a)) problems.push(`anchor ${a.id} is outside the room`);
  }
  for (const s of layout.solids) if (!within(s)) problems.push("a solid is outside the room");
  const { col, row } = layout.start;
  if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) problems.push("start is outside the room");
  else if (shutTiles(layout).has(`${col},${row}`)) problems.push("start is on a shut tile");
  for (let i = 0; i < layout.anchors.length; i += 1) {
    for (let j = i + 1; j < layout.anchors.length; j += 1) {
      const a = layout.anchors[i]!, b = layout.anchors[j]!;
      if (a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h) problems.push(`anchors ${a.id} and ${b.id} overlap`);
    }
  }
  return problems;
}

/** Free tiles touching an anchor: where a player can stand to use it. */
export function useTiles(layout: RoomLayout, anchor: RoomAnchor): Array<{ col: number; row: number }> {
  const shut = shutTiles(layout);
  const out: Array<{ col: number; row: number }> = [];
  for (let c = anchor.col - 1; c <= anchor.col + anchor.w; c += 1) {
    for (let r = anchor.row - 1; r <= anchor.row + anchor.h; r += 1) {
      if (inside(anchor, c, r)) continue;
      if (c < 0 || r < 0 || c >= layout.cols || r >= layout.rows) continue;
      if (!shut.has(`${c},${r}`)) out.push({ col: c, row: r });
    }
  }
  return out;
}

/** Ids of anchors a player starting at `start` can never reach (should be empty). */
export function unreachableAnchors(layout: RoomLayout): string[] {
  const shut = shutTiles(layout);
  const seen = new Set<string>();
  const queue = [`${layout.start.col},${layout.start.row}`];
  seen.add(queue[0]!);
  while (queue.length) {
    const [c, r] = queue.shift()!.split(",").map(Number) as [number, number];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc!, nr = r + dr!, key = `${nc},${nr}`;
      if (nc < 0 || nr < 0 || nc >= layout.cols || nr >= layout.rows || shut.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push(key);
    }
  }
  return layout.anchors.filter((a) => !useTiles(layout, a).some((t) => seen.has(`${t.col},${t.row}`))).map((a) => a.id);
}

export interface RoomPos { x: number; y: number }

/** Where the avatar starts, in world units (tile centre). */
export function startPos(layout: RoomLayout): RoomPos {
  return { x: (layout.start.col + 0.5) * layout.tile, y: (layout.start.row + 0.5) * layout.tile };
}

const AVATAR_RADIUS_FRACTION = 0.3;

function hitsSolid(layout: RoomLayout, x: number, y: number): boolean {
  const r = layout.tile * AVATAR_RADIUS_FRACTION;
  if (x - r < 0 || y - r < 0 || x + r > layout.cols * layout.tile || y + r > layout.rows * layout.tile) return true;
  const shut = shutTiles(layout);
  const c0 = Math.floor((x - r) / layout.tile), c1 = Math.floor((x + r) / layout.tile);
  const r0 = Math.floor((y - r) / layout.tile), r1 = Math.floor((y + r) / layout.tile);
  for (let c = c0; c <= c1; c += 1) for (let rw = r0; rw <= r1; rw += 1) if (shut.has(`${c},${rw}`)) return true;
  return false;
}

/** Move by (dx, dy) world units with wall sliding: each axis is tried on its own. */
export function stepAvatar(layout: RoomLayout, pos: RoomPos, dx: number, dy: number): RoomPos {
  let { x, y } = pos;
  if (dx !== 0 && !hitsSolid(layout, x + dx, y)) x += dx;
  if (dy !== 0 && !hitsSolid(layout, x, y + dy)) y += dy;
  return { x, y };
}

/** The usable anchor within `reach` world units of the avatar, nearest first, or null. */
export function nearestAnchor(layout: RoomLayout, pos: RoomPos, reach = layout.tile * 1.25): RoomAnchor | null {
  let best: RoomAnchor | null = null;
  let bestD = Infinity;
  for (const a of layout.anchors) {
    const cx = Math.max(a.col * layout.tile, Math.min(pos.x, (a.col + a.w) * layout.tile));
    const cy = Math.max(a.row * layout.tile, Math.min(pos.y, (a.row + a.h) * layout.tile));
    const d = Math.hypot(pos.x - cx, pos.y - cy);
    if (d <= reach && d < bestD) { best = a; bestD = d; }
  }
  return best;
}

/* ---------- Where the bedroom door leads ---------- */

/** The lever in the bedroom: which hall the door leads to. */
export type HallChoice = "public" | "universal";

/** Each game's public hall, if it has one. Queens N Kings has the Grand Hall; Survivor 616 has none yet. */
export const PUBLIC_HALLS: Record<RoomGame, RoomId | null> = { survivor: null, qnk: "hall.qnk", lok: null };
export const HOME_ROOMS: Record<RoomGame, RoomId> = { survivor: "room.616", qnk: "room.qnk", lok: "room.lok" };
export const UNIVERSAL_HALL: RoomId = "hall.lok";

export function hasPublicHall(game: RoomGame): boolean { return PUBLIC_HALLS[game] !== null; }

/**
 * The room the bedroom door opens. With the lever on "public" a game that has a public hall goes there; a game
 * without one (Survivor 616 today) falls through to the universal hall, so the door always leads somewhere.
 */
export function resolveBedroomDoor(game: RoomGame, choice: HallChoice): RoomId {
  const pub = PUBLIC_HALLS[game];
  return choice === "public" && pub ? pub : UNIVERSAL_HALL;
}

/** The lever flips between the two choices. A game with no public hall keeps `universal` and says why. */
export function pullLever(game: RoomGame, choice: HallChoice): { choice: HallChoice; shut: boolean } {
  if (!hasPublicHall(game)) return { choice: "universal", shut: choice === "universal" ? true : false };
  return { choice: choice === "public" ? "universal" : "public", shut: false };
}

export const HALL_CHOICE_KEY = "lok.rooms.hallChoice.v1";
export function loadHallChoice(game: RoomGame, store?: Pick<Storage, "getItem"> | null): HallChoice {
  try {
    const raw = (store === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : store)?.getItem(`${HALL_CHOICE_KEY}.${game}`);
    if (raw === "public" && hasPublicHall(game)) return "public";
  } catch { /* storage unavailable: use the default */ }
  return "universal";
}
export function saveHallChoice(game: RoomGame, choice: HallChoice, store?: Pick<Storage, "setItem"> | null): void {
  try { (store === undefined ? (typeof localStorage === "undefined" ? null : localStorage) : store)?.setItem(`${HALL_CHOICE_KEY}.${game}`, choice); } catch { /* still works this visit */ }
}

/** The Lok hall every game's door leads to. Doors are keyed by id (hall-616, hall-qnk, hall-soon, home); each game decides what a door does. */
export const LOK_HALL_LAYOUT: RoomLayout = {
  id: 'hall.lok',
  cols: 22,
  rows: 12,
  tile: 48,
  start: { col: 10, row: 9 },
  solids: [{ col: 0, row: 0, w: 22, h: 2 }],
  anchors: [
    // North wall: one doorway per game hall. 616 has no public hall yet, so its doorway is shown but shut.
    { id: 'hall-616', kind: 'door', col: 4, row: 2, w: 2, h: 1, enabled: false, action: { type: 'door', to: 'hall.616' } },
    { id: 'hall-qnk', kind: 'door', col: 10, row: 2, w: 2, h: 1, action: { type: 'external', game: 'qnk', note: 'hall.qnk' } },
    { id: 'hall-soon', kind: 'door', col: 16, row: 2, w: 2, h: 1, enabled: false, action: { type: 'note', key: 'room.note.moreGames' } },
    { id: 'board', kind: 'noticeboard', col: 1, row: 5, w: 1, h: 2, action: { type: 'note', key: 'room.note.hallBoard' } },
    { id: 'beacon', kind: 'beacon', col: 10, row: 5, w: 2, h: 2, action: { type: 'note', key: 'room.note.beacon' } },
    // South: the way home.
    { id: 'home', kind: 'door', col: 10, row: 11, w: 2, h: 1, action: { type: 'door', to: 'room.616' } },
  ],
};
