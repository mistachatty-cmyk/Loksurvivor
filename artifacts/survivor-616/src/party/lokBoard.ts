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
  /** Relics carried (relic race). */
  relics: number;
  /** Next roll goes two spaces further (a Tailwind Beacon). */
  tailwind: boolean;
  /** Blocks the next coin loss (a Safe House). */
  shield: boolean;
  stats: { spacesMoved: number; chaos: number; coinsSpent: number; minigameCoins: number; minigameWins: number; steals: number };
}

export type Pending =
  | { type: 'item' }
  | { type: 'roll'; useSignature: boolean }
  | { type: 'junction'; options: string[] }
  | { type: 'crown' }
  | { type: 'custom-dice' };

export type Phase = 'turn' | 'move' | 'land' | 'minigame' | 'bonus' | 'over';

/**
 * What a game is played to. 'rounds' is the classic Turbo Crown Blitz (most crowns after N rounds). The
 * race goals end the moment someone reaches the target (at the end of that round, so every player has had
 * the same number of turns) and are built for long sessions: the round cap is only a safety net.
 */
export type BoardGoal = { kind: 'rounds' } | { kind: 'crowns'; target: number } | { kind: 'relics'; target: number };
export const RACE_CAP_ROUNDS = 40;
export const goalLabelKey = (g: BoardGoal) => g.kind;

/**
 * A goal travels through the existing `rounds` number (lobby, online start message, props) so no network
 * shape changes and older clients still play a classic game: 5..15 = classic rounds, 100 + n = race to n
 * crowns, 200 + n = hunt n relics.
 */
export function encodeGoal(goal: BoardGoal, rounds: number): number {
  if (goal.kind === 'crowns') return 100 + goal.target;
  if (goal.kind === 'relics') return 200 + goal.target;
  return rounds;
}
export function decodeGoal(code: number): { rounds: number; goal: BoardGoal } {
  if (code >= 200) return { rounds: 10, goal: { kind: 'relics', target: Math.min(12, Math.max(2, code - 200)) } };
  if (code >= 100) return { rounds: 10, goal: { kind: 'crowns', target: Math.min(8, Math.max(2, code - 100)) } };
  return { rounds: code, goal: { kind: 'rounds' } };
}

/** Things the board puts down on its own, so the board answers back instead of sitting still. */
export type SpawnKind = 'cache' | 'beacon' | 'rest' | 'relic';
export interface Spawn {
  id: number;
  node: string;
  kind: SpawnKind;
  bornRound: number;
}
/** Supply caches, beacons and safe houses fade after this many rounds if nobody takes them. */
export const SPAWN_LIFE_ROUNDS = 2;
export const SPAWN_CAP = 3;
export const RELICS_ON_BOARD = 2;

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
  | { kind: 'spawn'; id: number; node: string; spawn: SpawnKind }
  | { kind: 'spawn-collected'; who: number; id: number; node: string; spawn: SpawnKind; relics: number }
  | { kind: 'spawn-fade'; id: number; node: string; spawn: SpawnKind }
  | { kind: 'shield-used'; who: number }
  | { kind: 'goal-reached'; who: number }
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
  goal: BoardGoal;
  spawns: Spawn[];
  nextSpawnId: number;
  /** The player who hit a race goal this round (the round still finishes). */
  goalHitBy: number | null;
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

export function createBoardGame(seed: number, board: BoardDef, roster: { characterId: string; bot: boolean }[], maxRounds = 10, goal: BoardGoal = { kind: 'rounds' }): BoardState {
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
      relics: 0,
      tailwind: false,
      shield: false,
      stats: { spacesMoved: 0, chaos: 0, coinsSpent: 0, minigameCoins: 0, minigameWins: 0, steals: 0 },
    })),
    round: 1,
    maxRounds: goal.kind === 'rounds' ? Math.max(3, maxRounds) : RACE_CAP_ROUNDS,
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
    goal,
    spawns: [],
    nextSpawnId: 1,
    goalHitBy: null,
  };
  relocateVendor(s);
  spawnRound(s);
  s.events = [];
  beginTurn(s);
  return s;
}

export const isOvertime = (s: BoardState) => s.goal.kind === 'rounds' && s.round > s.maxRounds - 3;
const cur = (s: BoardState) => s.players[s.turnOf];

const BLOCKABLE = new Set(['trap', 'glitch', 'boulder', 'archon', 'archon-trap', 'hack']);

function addCoins(s: BoardState, p: BoardPlayer, delta: number, reason: string) {
  if (delta < 0 && p.shield && BLOCKABLE.has(reason)) {
    p.shield = false;
    s.events.push({ kind: 'shield-used', who: p.index });
    return 0;
  }
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
      checkGoal(s, p);
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
  if (p.tailwind && total > 0) {
    total += 2;
    p.tailwind = false;
  }
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
  collectSpawns(s, p, to, false);
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
  collectSpawns(s, p, node.id, true);
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
  if (s.goalHitBy !== null) {
    // A race goal was hit this round: everyone has had their turn, so the race is over.
    s.events.push({ kind: 'goal-reached', who: s.goalHitBy });
    s.pending = null;
    awardBonus(s);
    s.phase = 'bonus';
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
  if (s.goal.kind === 'rounds' && s.round === s.maxRounds - 2) s.events.push({ kind: 'overtime' });
  spawnRound(s);
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
  const metric = (p: BoardPlayer) => (s.goal.kind === 'relics' ? p.relics : 0);
  const order = [...s.players].sort((a, b) => metric(b) - metric(a) || b.crowns - a.crowns || b.coins - a.coins || a.index - b.index);
  return order.map((p, i) => ({ index: p.index, place: i + 1 }));
}

// ---------------------------------------------------------------------------
// The board answers back: spawns and goals
// ---------------------------------------------------------------------------

/** Race progress for a player: how close they are to the goal, 0..1. */
export function goalProgress(s: BoardState, p: BoardPlayer): number {
  if (s.goal.kind === 'crowns') return Math.min(1, p.crowns / s.goal.target);
  if (s.goal.kind === 'relics') return Math.min(1, p.relics / s.goal.target);
  return Math.min(1, s.round / s.maxRounds);
}

function checkGoal(s: BoardState, p: BoardPlayer) {
  if (s.goal.kind === 'rounds' || s.goalHitBy !== null) return;
  const have = s.goal.kind === 'crowns' ? p.crowns : p.relics;
  if (have >= s.goal.target) s.goalHitBy = p.index;
}

const standing = (s: BoardState, p: BoardPlayer) => p.crowns * 20 + p.coins + (s.goal.kind === 'relics' ? p.relics * 25 : 0);

/** Forward hops along the board, so a spawn can be put "a few spaces ahead" of a player. */
function reachable(s: BoardState, from: string, maxHops: number): Map<string, number> {
  const out = new Map<string, number>([[from, 0]]);
  let frontier = [from];
  for (let d = 1; d <= maxHops && frontier.length; d += 1) {
    const nxt: string[] = [];
    for (const id of frontier) for (const n of s.map[id]?.next ?? []) if (!out.has(n)) {
      out.set(n, d);
      nxt.push(n);
    }
    frontier = nxt;
  }
  return out;
}

/**
 * At the top of every round the board puts something down, aimed so it makes sense: a few spaces ahead of
 * whoever is furthest behind (never on an occupied space, the owl, or another spawn), so being behind
 * means the next stretch of road is worth more. Uncollected caches, beacons and safe houses fade.
 */
export function spawnRound(s: BoardState): void {
  for (const sp of [...s.spawns]) {
    if (sp.kind !== 'relic' && s.round - sp.bornRound >= SPAWN_LIFE_ROUNDS) {
      s.spawns.splice(s.spawns.indexOf(sp), 1);
      s.events.push({ kind: 'spawn-fade', id: sp.id, node: sp.node, spawn: sp.kind });
    }
  }
  const taken = new Set<string>([s.board.start, s.vendor, ...s.players.map((p) => p.node), ...s.spawns.map((sp) => sp.node)]);
  const open = s.board.nodes.filter((n) => !taken.has(n.id));
  if (!open.length) return;
  const trailing = [...s.players].sort((a, b) => standing(s, a) - standing(s, b) || a.index - b.index)[0];
  const ahead = reachable(s, trailing.node, 9);
  const put = (kind: SpawnKind, lo: number, hi: number) => {
    const free = s.board.nodes.filter((n) => !taken.has(n.id));
    const near = free.filter((n) => {
      const d = ahead.get(n.id);
      return d !== undefined && d >= lo && d <= hi;
    });
    const pool = near.length ? near : free;
    if (!pool.length) return;
    const node = pool[Math.floor(s.rng() * pool.length)];
    taken.add(node.id);
    const spawn: Spawn = { id: s.nextSpawnId++, node: node.id, kind, bornRound: s.round };
    s.spawns.push(spawn);
    s.events.push({ kind: 'spawn', id: spawn.id, node: node.id, spawn: kind });
  };
  if (s.goal.kind === 'relics') {
    // Relics are the point of the race: keep a couple out, one near the player in last, one anywhere.
    const have = s.spawns.filter((sp) => sp.kind === 'relic').length;
    for (let i = have; i < RELICS_ON_BOARD; i += 1) put('relic', i === 0 ? 3 : 2, i === 0 ? 8 : 9);
  }
  const small = s.spawns.filter((sp) => sp.kind !== 'relic').length;
  if (small < SPAWN_CAP) {
    const r = s.rng();
    const kind: SpawnKind = r < 0.5 ? 'cache' : r < 0.75 ? 'beacon' : 'rest';
    put(kind, 2, 7);
  }
}

/** Pass-through pickups (caches, relics) on every hop; landing pickups (beacons, safe houses) when you stop. */
function collectSpawns(s: BoardState, p: BoardPlayer, node: string, landing: boolean) {
  for (const sp of [...s.spawns]) {
    if (sp.node !== node) continue;
    const onPass = sp.kind === 'cache' || sp.kind === 'relic';
    if (!onPass && !landing) continue;
    s.spawns.splice(s.spawns.indexOf(sp), 1);
    switch (sp.kind) {
      case 'cache':
        addCoins(s, p, isOvertime(s) ? 10 : 5, 'cache');
        if (p.items.length < MAX_ITEMS && s.rng() < 0.5) {
          const item = ITEMS[Math.floor(s.rng() * ITEMS.length)];
          p.items.push(item);
          s.events.push({ kind: 'item-got', who: p.index, item });
        }
        break;
      case 'relic':
        p.relics += 1;
        addCoins(s, p, 3, 'relic');
        checkGoal(s, p);
        break;
      case 'beacon':
        p.tailwind = true;
        break;
      case 'rest':
        p.frozen = false;
        p.shield = true;
        addCoins(s, p, 3, 'rest');
        break;
    }
    s.events.push({ kind: 'spawn-collected', who: p.index, id: sp.id, node, spawn: sp.kind, relics: p.relics });
  }
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
      // Otherwise head for the nearest thing worth picking up (relics first in a relic race).
      const prize = s.spawns.filter((sp) => sp.kind === 'relic' || sp.kind === 'cache' || s.goal.kind !== 'relics');
      let best = pend.options[0];
      let bd = Infinity;
      for (const o of pend.options) {
        // Never draw from s.rng here: only the host runs bots online, so a draw would desync guests.
        const toPrize = prize.length ? Math.min(...prize.map((sp) => hopDistance(s.board, o, sp.node))) : Infinity;
        const d = want ? hopDistance(s.board, o, s.vendor) : Number.isFinite(toPrize) && toPrize <= 8 ? toPrize : ((o.length * 131 + s.round * 17 + s.turnOf * 7 + o.charCodeAt(o.length - 1)) % 97) / 97;
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
