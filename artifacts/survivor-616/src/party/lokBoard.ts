/**
 * lokBoard.ts -- Turbo Crown Blitz board engine (Lok Party Slice 3).
 *
 * Pure, seeded state machine. The screen only draws and paces it:
 *   - When `s.pending` is set, the current player must act (human taps, or `botAction` decides).
 *   - Otherwise the screen calls `boardAdvance` at animation pace (one hop per call while moving).
 *   - `s.events` holds what happened in the last call, for juice, sound and banners.
 *
 * Loop per round: each player takes an item phase, rolls (standard 1-10 or their Signature Die),
 * hops along the graph (choosing at junctions, offered a Crown when passing Lok the Owl), lands and
 * resolves the space. After all four: a minigame (the screen runs it and reports placements).
 * The last three rounds are Overtime (spaces pay double). At the end two Bonus Crowns are revealed.
 */

// ---------------------------------------------------------------------------
// Board data
// ---------------------------------------------------------------------------

export type SpaceKind = 'cred' | 'glitch' | 'event' | 'supply' | 'hack' | 'archon' | 'start';
export type Traversal = 'walk' | 'stairs' | 'ladder' | 'bridge-over' | 'slide' | 'jump-pad';

export interface BoardNode {
  id: string;
  /** Ground-plane position (board units) and elevation tier 0..4. */
  x: number;
  y: number;
  z: number;
  kind: SpaceKind;
  next: string[];
  /** How the hop from this node to each `next` looks. Default walk. */
  via?: Record<string, Traversal>;
  /** Street level, for events that hit everyone "on the avenue". */
  street?: boolean;
}

export interface BoardDef {
  id: string;
  nodes: BoardNode[];
  start: string;
  crownSpots: string[];
}

export function nodeMap(b: BoardDef): Record<string, BoardNode> {
  return Object.fromEntries(b.nodes.map((n) => [n.id, n]));
}

/** Hops from `from` to `to` along `next` edges (BFS); Infinity if unreachable. */
export function hopDistance(b: BoardDef, from: string, to: string): number {
  if (from === to) return 0;
  const map = nodeMap(b);
  const seen = new Set([from]);
  let frontier = [from];
  for (let d = 1; d < 200 && frontier.length; d += 1) {
    const nextF: string[] = [];
    for (const id of frontier)
      for (const n of map[id]?.next ?? []) {
        if (n === to) return d;
        if (!seen.has(n)) {
          seen.add(n);
          nextF.push(n);
        }
      }
    frontier = nextF;
  }
  return Infinity;
}

// ---------------------------------------------------------------------------
// Characters, dice, items
// ---------------------------------------------------------------------------

export type DieFace = number | 'freeze-rival' | 'plus-cred' | 'boulder-ride' | 'gilded';

export const SIGNATURE_DICE: Record<string, DieFace[]> = {
  'zero-day': [0, 0, 4, 5, 6, 'freeze-rival'],
  shade: [2, 3, 3, 4, 5, 'plus-cred'],
  'quarry-kid': [1, 1, 6, 6, 7, 'boulder-ride'],
  'golden-hour': [3, 3, 4, 4, 5, 'gilded'],
};
export const DEFAULT_SIGNATURE: DieFace[] = [1, 2, 3, 4, 5, 6];

/** What a special face does: hops moved plus a bonus. */
export function faceMove(face: DieFace): number {
  if (typeof face === 'number') return face;
  return { 'freeze-rival': 3, 'plus-cred': 1, 'boulder-ride': 9, gilded: 4 }[face];
}

export type ItemId = 'double-dice' | 'custom-dice' | 'swap-mirror' | 'glitch-trap' | 'crown-radar';
export const ITEMS: ItemId[] = ['double-dice', 'custom-dice', 'swap-mirror', 'glitch-trap', 'crown-radar'];
export const MAX_ITEMS = 3;

export const CROWN_COST = 20;
export const MINIGAME_PAYOUT = [10, 6, 3, 1];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface BoardPlayer {
  index: number;
  characterId: string;
  bot: boolean;
  node: string;
  coins: number;
  crowns: number;
  items: ItemId[];
  /** Next roll is halved (Zero Day's freeze). */
  frozen: boolean;
  /** Item effects for this turn. */
  doubleDice: boolean;
  customValue: number | null;
  stats: { spacesMoved: number; chaos: number; coinsSpent: number; minigameCoins: number; minigameWins: number; steals: number };
}

export type Pending =
  | { type: 'item' }
  | { type: 'roll'; useSignature: boolean }
  | { type: 'junction'; options: string[] }
  | { type: 'crown' }
  | { type: 'custom-dice' };

export type Phase = 'turn' | 'move' | 'land' | 'minigame' | 'bonus' | 'over';

export type BoardEvent =
  | { kind: 'turn-start'; who: number; round: number }
  | { kind: 'item-used'; who: number; item: ItemId; target?: number }
  | { kind: 'roll'; who: number; face: DieFace; total: number; signature: boolean }
  | { kind: 'hop'; who: number; from: string; to: string; via: Traversal }
  | { kind: 'crown-bought'; who: number }
  | { kind: 'crown-passed'; who: number }
  | { kind: 'vendor-move'; to: string }
  | { kind: 'land'; who: number; space: SpaceKind; node: string }
  | { kind: 'coins'; who: number; delta: number; reason: string }
  | { kind: 'item-got'; who: number; item: ItemId }
  | { kind: 'trap-set'; who: number; node: string }
  | { kind: 'trap-sprung'; who: number; owner: number; amount: number }
  | { kind: 'swap'; a: number; b: number; what: 'coins' | 'places' }
  | { kind: 'freeze'; who: number }
  | { kind: 'event'; name: BoardEventName; who: number }
  | { kind: 'night'; night: boolean }
  | { kind: 'overtime' }
  | { kind: 'minigame' }
  | { kind: 'bonus'; name: BonusCrownName; winners: number[] }
  | { kind: 'game-over' };

export type BoardEventName = 'boulder-run' | 'night-market' | 'gantry-lift' | 'blackout';
export type BonusCrownName = 'minigame-mvp' | 'chaos-magnet' | 'street-sprinter' | 'high-roller';

export interface BoardState {
  seed: number;
  rng: () => number;
  board: BoardDef;
  map: Record<string, BoardNode>;
  players: BoardPlayer[];
  round: number;
  maxRounds: number;
  turnOf: number;
  phase: Phase;
  pending: Pending | null;
  stepsLeft: number;
  vendor: string;
  traps: Record<string, number>;
  night: boolean;
  events: BoardEvent[];
  bonus: { name: BonusCrownName; winners: number[] }[];
  /** Hops taken this move, for the trail. */
  trail: string[];
}

export function boardRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBoardGame(seed: number, board: BoardDef, roster: { characterId: string; bot: boolean }[], maxRounds = 10): BoardState {
  const rng = boardRng(seed);
  const s: BoardState = {
    seed,
    rng,
    board,
    map: nodeMap(board),
    players: roster.slice(0, 4).map((r, index) => ({
      index,
      characterId: r.characterId,
      bot: r.bot,
      node: board.start,
      coins: 10,
      crowns: 0,
      items: [],
      frozen: false,
      doubleDice: false,
      customValue: null,
      stats: { spacesMoved: 0, chaos: 0, coinsSpent: 0, minigameCoins: 0, minigameWins: 0, steals: 0 },
    })),
    round: 1,
    maxRounds: Math.max(3, maxRounds),
    turnOf: 0,
    phase: 'turn',
    pending: null,
    stepsLeft: 0,
    vendor: board.crownSpots[0],
    traps: {},
    night: false,
    events: [],
    bonus: [],
    trail: [],
  };
  relocateVendor(s);
  s.events = [];
  beginTurn(s);
  return s;
}

export const isOvertime = (s: BoardState) => s.round > s.maxRounds - 3;
const cur = (s: BoardState) => s.players[s.turnOf];

function addCoins(s: BoardState, p: BoardPlayer, delta: number, reason: string) {
  const d = delta < 0 ? -Math.min(p.coins, -delta) : delta;
  p.coins += d;
  if (d !== 0) s.events.push({ kind: 'coins', who: p.index, delta: d, reason });
  return d;
}

function relocateVendor(s: BoardState, near?: BoardPlayer) {
  const spots = s.board.crownSpots.filter((id) => id !== s.vendor && !s.players.some((p) => p.node === id));
  const pool = spots.length ? spots : s.board.crownSpots;
  let pick = pool[Math.floor(s.rng() * pool.length)];
  if (near) {
    let best = Infinity;
    for (const id of pool) {
      const d = hopDistance(s.board, near.node, id);
      if (d >= 3 && d < best) {
        best = d;
        pick = id;
      }
    }
  }
  s.vendor = pick;
  s.events.push({ kind: 'vendor-move', to: pick });
}

function beginTurn(s: BoardState) {
  const p = cur(s);
  s.phase = 'turn';
  s.trail = [p.node];
  p.doubleDice = false;
  p.customValue = null;
  s.events.push({ kind: 'turn-start', who: p.index, round: s.round });
  s.pending = p.items.length ? { type: 'item' } : { type: 'roll', useSignature: false };
}

// ---------------------------------------------------------------------------
// Actions (human or bot)
// ---------------------------------------------------------------------------

export type BoardAction =
  | { type: 'use-item'; item: ItemId | null }
  | { type: 'roll'; signature: boolean }
  | { type: 'custom'; value: number }
  | { type: 'junction'; to: string }
  | { type: 'crown'; buy: boolean };

export function boardAct(s: BoardState, a: BoardAction): void {
  s.events = [];
  const p = cur(s);
  const pend = s.pending;
  if (!pend) return;
  if (pend.type === 'item' && a.type === 'use-item') {
    s.pending = { type: 'roll', useSignature: false };
    if (a.item && p.items.includes(a.item)) useItem(s, p, a.item);
    return;
  }
  if (pend.type === 'custom-dice' && a.type === 'custom') {
    p.customValue = Math.min(6, Math.max(1, Math.floor(a.value)));
    s.pending = { type: 'roll', useSignature: false };
    return;
  }
  if (pend.type === 'roll' && a.type === 'roll') {
    roll(s, p, a.signature);
    return;
  }
  if (pend.type === 'junction' && a.type === 'junction' && pend.options.includes(a.to)) {
    s.pending = null;
    hop(s, p, a.to);
    return;
  }
  if (pend.type === 'crown' && a.type === 'crown') {
    s.pending = null;
    if (a.buy && p.coins >= CROWN_COST) {
      p.coins -= CROWN_COST;
      p.stats.coinsSpent += CROWN_COST;
      p.crowns += 1;
      s.events.push({ kind: 'coins', who: p.index, delta: -CROWN_COST, reason: 'crown' });
      s.events.push({ kind: 'crown-bought', who: p.index });
      relocateVendor(s);
    } else s.events.push({ kind: 'crown-passed', who: p.index });
    if (s.stepsLeft <= 0) s.phase = 'land';
  }
}

function useItem(s: BoardState, p: BoardPlayer, item: ItemId) {
  p.items.splice(p.items.indexOf(item), 1);
  p.stats.coinsSpent += 0;
  const rivals = s.players.filter((o) => o !== p);
  const leader = [...rivals].sort((a, b) => b.crowns - a.crowns || b.coins - a.coins)[0];
  switch (item) {
    case 'double-dice':
      p.doubleDice = true;
      s.events.push({ kind: 'item-used', who: p.index, item });
      break;
    case 'custom-dice':
      s.pending = { type: 'custom-dice' };
      s.events.push({ kind: 'item-used', who: p.index, item });
      break;
    case 'swap-mirror': {
      const t = leader.node;
      leader.node = p.node;
      p.node = t;
      s.trail = [p.node];
      s.events.push({ kind: 'item-used', who: p.index, item, target: leader.index });
      s.events.push({ kind: 'swap', a: p.index, b: leader.index, what: 'places' });
      break;
    }
    case 'glitch-trap':
      s.traps[p.node] = p.index;
      s.events.push({ kind: 'item-used', who: p.index, item });
      s.events.push({ kind: 'trap-set', who: p.index, node: p.node });
      break;
    case 'crown-radar':
      s.events.push({ kind: 'item-used', who: p.index, item });
      relocateVendor(s, p);
      break;
  }
}

function roll(s: BoardState, p: BoardPlayer, signature: boolean) {
  let face: DieFace;
  if (p.customValue !== null) face = p.customValue;
  else if (signature) {
    const faces = SIGNATURE_DICE[p.characterId] ?? DEFAULT_SIGNATURE;
    face = faces[Math.floor(s.rng() * faces.length)];
  } else face = 1 + Math.floor(s.rng() * 10);
  let total = faceMove(face);
  if (p.doubleDice) total += 1 + Math.floor(s.rng() * 10);
  if (p.frozen) {
    total = Math.ceil(total / 2);
    p.frozen = false;
  }
  s.events.push({ kind: 'roll', who: p.index, face, total, signature });
  if (face === 'freeze-rival') {
    const rival = nearestRival(s, p);
    if (rival) {
      rival.frozen = true;
      s.events.push({ kind: 'freeze', who: rival.index });
    }
  } else if (face === 'plus-cred') addCoins(s, p, 3, 'signature');
  else if (face === 'gilded') addCoins(s, p, 5, 'signature');
  s.stepsLeft = total;
  s.pending = null;
  s.phase = total > 0 ? 'move' : 'land';
}

function nearestRival(s: BoardState, p: BoardPlayer): BoardPlayer | null {
  let best: BoardPlayer | null = null;
  let bd = Infinity;
  for (const o of s.players) {
    if (o === p) continue;
    const d = Math.min(hopDistance(s.board, p.node, o.node), hopDistance(s.board, o.node, p.node));
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

function hop(s: BoardState, p: BoardPlayer, to: string) {
  const from = p.node;
  const via = s.map[from]?.via?.[to] ?? 'walk';
  p.node = to;
  p.stats.spacesMoved += 1;
  s.stepsLeft -= 1;
  s.trail.push(to);
  s.events.push({ kind: 'hop', who: p.index, from, to, via });
  if (to === s.vendor) {
    if (p.coins >= CROWN_COST) {
      s.pending = { type: 'crown' };
      return;
    }
    s.events.push({ kind: 'crown-passed', who: p.index });
  }
  if (s.stepsLeft <= 0) s.phase = 'land';
}

// ---------------------------------------------------------------------------
// Automatic advance (one beat per call)
// ---------------------------------------------------------------------------

export function boardAdvance(s: BoardState): void {
  s.events = [];
  if (s.pending) return;
  const p = cur(s);
  if (s.phase === 'move') {
    const node = s.map[p.node];
    const options = node?.next ?? [];
    if (!options.length) {
      s.phase = 'land';
      return;
    }
    if (options.length > 1) s.pending = { type: 'junction', options: [...options] };
    else hop(s, p, options[0]);
    return;
  }
  if (s.phase === 'land') {
    resolveSpace(s, p);
    endTurn(s);
    return;
  }
  if (s.phase === 'bonus') {
    s.phase = 'over';
    s.events.push({ kind: 'game-over' });
  }
}

function resolveSpace(s: BoardState, p: BoardPlayer) {
  const node = s.map[p.node];
  if (!node) return;
  s.events.push({ kind: 'land', who: p.index, space: node.kind, node: node.id });
  const ot = isOvertime(s);
  const trapOwner = s.traps[p.node];
  if (trapOwner !== undefined && trapOwner !== p.index) {
    const amt = -addCoins(s, p, -5, 'trap');
    if (amt > 0) addCoins(s, s.players[trapOwner], amt, 'trap');
    s.players[trapOwner].stats.steals += 1;
    delete s.traps[p.node];
    s.events.push({ kind: 'trap-sprung', who: p.index, owner: trapOwner, amount: amt });
  }
  switch (node.kind) {
    case 'cred':
      addCoins(s, p, (ot ? 6 : 3) + (s.night ? 1 : 0), 'cred');
      break;
    case 'glitch':
      addCoins(s, p, -((ot ? 6 : 3) + (s.night ? 1 : 0)), 'glitch');
      break;
    case 'supply': {
      p.stats.chaos += 1;
      if (p.items.length < MAX_ITEMS && s.rng() < 0.6) {
        const item = ITEMS[Math.floor(s.rng() * ITEMS.length)];
        p.items.push(item);
        s.events.push({ kind: 'item-got', who: p.index, item });
      } else addCoins(s, p, 7, 'supply');
      break;
    }
    case 'hack': {
      p.stats.chaos += 1;
      const others = s.players.filter((o) => o !== p);
      const o = others[Math.floor(s.rng() * others.length)];
      const r = s.rng();
      if (r < 0.4) {
        const t = p.coins;
        p.coins = o.coins;
        o.coins = t;
        s.events.push({ kind: 'swap', a: p.index, b: o.index, what: 'coins' });
      } else if (r < 0.75) {
        const t = p.node;
        p.node = o.node;
        o.node = t;
        s.events.push({ kind: 'swap', a: p.index, b: o.index, what: 'places' });
      } else {
        const rich = [...others].sort((a, b) => b.coins - a.coins)[0];
        const got = -addCoins(s, rich, -5, 'hack');
        addCoins(s, p, got, 'hack');
        p.stats.steals += 1;
      }
      break;
    }
    case 'archon': {
      p.stats.chaos += 1;
      const leader = [...s.players].sort((a, b) => b.crowns - a.crowns || b.coins - a.coins)[0];
      if (s.rng() < 0.6) addCoins(s, leader, -10, 'archon');
      else {
        const pick = s.board.nodes[Math.floor(s.rng() * s.board.nodes.length)];
        s.traps[pick.id] = -1;
        s.events.push({ kind: 'trap-set', who: -1, node: pick.id });
      }
      break;
    }
    case 'event':
      p.stats.chaos += 1;
      runEvent(s, p);
      break;
    case 'start':
      addCoins(s, p, 3, 'cred');
      break;
  }
  // An ARCHON trap (-1 owner) burns coins with no beneficiary.
  if (s.traps[p.node] === -1) {
    addCoins(s, p, -5, 'archon-trap');
    delete s.traps[p.node];
  }
}

const EVENT_TABLE: BoardEventName[] = ['boulder-run', 'night-market', 'gantry-lift', 'blackout'];

function runEvent(s: BoardState, p: BoardPlayer) {
  const name = EVENT_TABLE[Math.floor(s.rng() * EVENT_TABLE.length)];
  s.events.push({ kind: 'event', name, who: p.index });
  switch (name) {
    case 'boulder-run':
      for (const o of s.players) if (o !== p && s.map[o.node]?.street) addCoins(s, o, -4, 'boulder');
      break;
    case 'night-market':
      addCoins(s, p, 8, 'event');
      break;
    case 'gantry-lift': {
      const high = s.board.nodes.filter((n) => n.z >= 2);
      if (high.length) p.node = high[Math.floor(s.rng() * high.length)].id;
      break;
    }
    case 'blackout':
      s.night = !s.night;
      s.events.push({ kind: 'night', night: s.night });
      break;
  }
}

function endTurn(s: BoardState) {
  if (s.turnOf < s.players.length - 1) {
    s.turnOf += 1;
    beginTurn(s);
    return;
  }
  s.phase = 'minigame';
  s.pending = null;
  s.events.push({ kind: 'minigame' });
}

/** Feed minigame placements (player index order -> place 1..4). */
export function boardMinigameResult(s: BoardState, placements: number[]): void {
  s.events = [];
  if (s.phase !== 'minigame') return;
  s.players.forEach((p, i) => {
    const place = Math.min(4, Math.max(1, placements[i] ?? 4));
    const pay = MINIGAME_PAYOUT[place - 1];
    p.stats.minigameCoins += pay;
    if (place === 1) p.stats.minigameWins += 1;
    addCoins(s, p, pay, 'minigame');
  });
  s.round += 1;
  if (s.round > s.maxRounds) {
    awardBonus(s);
    s.phase = 'bonus';
    return;
  }
  // Day and night flip every three rounds; overtime announced once.
  if ((s.round - 1) % 3 === 0) {
    s.night = !s.night;
    s.events.push({ kind: 'night', night: s.night });
  }
  if (s.round === s.maxRounds - 2) s.events.push({ kind: 'overtime' });
  s.turnOf = 0;
  beginTurn(s);
}

function awardBonus(s: BoardState) {
  const table: { name: BonusCrownName; score: (p: BoardPlayer) => number }[] = [
    { name: 'minigame-mvp', score: (p) => p.stats.minigameCoins },
    { name: 'chaos-magnet', score: (p) => p.stats.chaos },
    { name: 'street-sprinter', score: (p) => p.stats.spacesMoved },
    { name: 'high-roller', score: (p) => p.stats.coinsSpent },
  ];
  const picks = [...table].sort(() => s.rng() - 0.5).slice(0, 2);
  for (const b of picks) {
    const best = Math.max(...s.players.map(b.score));
    const winners = best > 0 ? s.players.filter((p) => b.score(p) === best).map((p) => p.index) : [];
    for (const w of winners) s.players[w].crowns += 1;
    s.bonus.push({ name: b.name, winners });
    s.events.push({ kind: 'bonus', name: b.name, winners });
  }
}

export function boardStandings(s: BoardState): { index: number; place: number }[] {
  const order = [...s.players].sort((a, b) => b.crowns - a.crowns || b.coins - a.coins || a.index - b.index);
  return order.map((p, i) => ({ index: p.index, place: i + 1 }));
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

export function botAction(s: BoardState): BoardAction | null {
  const p = cur(s);
  const pend = s.pending;
  if (!pend) return null;
  const toVendor = hopDistance(s.board, p.node, s.vendor);
  switch (pend.type) {
    case 'item': {
      const has = (i: ItemId) => p.items.includes(i);
      if (has('crown-radar') && p.coins >= CROWN_COST && toVendor > 10) return { type: 'use-item', item: 'crown-radar' };
      if (has('custom-dice') && p.coins >= CROWN_COST && toVendor >= 1 && toVendor <= 6) return { type: 'use-item', item: 'custom-dice' };
      if (has('double-dice') && toVendor > 8) return { type: 'use-item', item: 'double-dice' };
      if (has('swap-mirror') && s.players.some((o) => o !== p && o.crowns > p.crowns)) return { type: 'use-item', item: 'swap-mirror' };
      if (has('glitch-trap')) return { type: 'use-item', item: 'glitch-trap' };
      return { type: 'use-item', item: null };
    }
    case 'custom-dice':
      return { type: 'custom', value: Math.min(6, Math.max(1, toVendor)) };
    case 'roll': {
      // Signature die when the safe/average roll is better for this spot.
      const sig = SIGNATURE_DICE[p.characterId];
      const sigAvg = sig ? sig.reduce<number>((n, f) => n + faceMove(f), 0) / sig.length : 3.5;
      return { type: 'roll', signature: toVendor <= 6 ? sigAvg <= 4.5 : sigAvg > 5.5 };
    }
    case 'junction': {
      const want = p.coins >= CROWN_COST;
      let best = pend.options[0];
      let bd = Infinity;
      for (const o of pend.options) {
        // Never draw from s.rng here: only the host runs bots online, so a draw would desync guests.
        const d = want ? hopDistance(s.board, o, s.vendor) : ((o.length * 131 + s.round * 17 + s.turnOf * 7 + o.charCodeAt(o.length - 1)) % 97) / 97;
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      return { type: 'junction', to: best };
    }
    case 'crown':
      return { type: 'crown', buy: true };
  }
}
