/**
 * lokPartyMeta.ts -- Lok Party's own progression (save key `lokparty.meta.v1`).
 *
 * Pure functions over a plain object, so node:test covers all of it and the same file can
 * run inside 616, inside Queens N Kings, or as standalone party.gsix.online.
 *
 * The golden rule (blueprint section 12A): Party progress lives in its OWN namespace and
 * never grants combat power to any main game. The only things that leave are
 *   1. cosmetics (exported by id for the main games to show), and
 *   2. a once-a-day "first win" grant that each game pays through its own capped reward
 *      path (616: the hideout reward choke point, 60 cred a day, 15 per grant).
 * Grants are one-way and idempotent by id; the main game marks them claimed.
 *
 * Naming note: the blueprint's key items are called Beacon Keys here (the repo forbids the
 * other word). Fragments: 3 make a key.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LOK_PARTY_META_KEY = 'lokparty.meta.v1';

export const GRADES = ['C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S-', 'S', 'S+'] as const;
export type Grade = (typeof GRADES)[number];

export const gradeIndex = (g: Grade): number => GRADES.indexOf(g);
export const gradeAtLeast = (g: Grade, floor: Grade): boolean => gradeIndex(g) >= gradeIndex(floor);

/** Mastery points awarded per grade (index-aligned with GRADES). */
export const MASTERY_POINTS_BY_GRADE = [80, 100, 120, 140, 160, 190, 220, 250, 300, 340, 400] as const;

/** Cumulative points needed to REACH level n+1 from level 1 (levels 1..10). */
export const MASTERY_THRESHOLDS = [0, 400, 1000, 1800, 2800, 4000, 5500, 7300, 9400, 11800] as const;
/** Past level 10, every this many points is one more infinite level (a crest star). */
export const MASTERY_INFINITE_STEP = 2500;
/** Levels that need Marks of Mastery (earned on S- or better) to cross into. */
export const MASTERY_MARK_GATES: Record<number, number> = { 5: 1, 7: 2, 10: 3 };
/** What each gate unlocks; ids are exported cosmetics. */
export const MASTERY_UNLOCKS: Record<number, string> = {
  5: 'dice-gold-trim',
  7: 'mastery-chroma',
  10: 'mastery-crest',
};

export const RANK_TIERS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', '616 Apex'] as const;
export type RankTier = (typeof RANK_TIERS)[number];
/** Tiers below Master have four divisions (4 -> 1); Master and Apex are open LP. */
export const DIVISIONS = 4;
export const LP_PER_DIVISION = 100;
export const APEX_LP = 400;
export type LadderId = 'solo' | 'crew';

export const PASS_TIERS = 50;
export const PASS_XP_PER_TIER = 1000;
export const PASS_BONUS_XP = 500;
export const FIRST_WIN_XP = 400;
export const KEY_FRAGMENTS_PER_KEY = 3;
export const REROLL_COST = 3;

/** Cross-game daily valve, paid by each game's own capped path (never more than these). */
export const BRIDGE_FIRST_WIN: Record<BridgeGame, { kind: 'cred' | 'gold'; amount: number }> = {
  survivor616: { kind: 'cred', amount: 15 },
  'queens-n-kings': { kind: 'gold', amount: 15 },
};
export type BridgeGame = 'survivor616' | 'queens-n-kings';

// ---------------------------------------------------------------------------
// Cosmetic pool (what Vault Capsules can drop). Ids only; art is procedural elsewhere.
// ---------------------------------------------------------------------------

export type ShardRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ShardKind = 'palette' | 'cape' | 'dice-skin' | 'foil-card' | 'emote' | 'jukebox-track' | 'hat';

export interface CosmeticDef {
  id: string;
  kind: ShardKind;
  rarity: ShardRarity;
}

export const PARTY_COSMETICS: readonly CosmeticDef[] = [
  { id: 'palette-monroe-neon', kind: 'palette', rarity: 'common' },
  { id: 'palette-pawnford-dusk', kind: 'palette', rarity: 'common' },
  { id: 'palette-thaw-glacier', kind: 'palette', rarity: 'rare' },
  { id: 'palette-astral-plum', kind: 'palette', rarity: 'epic' },
  { id: 'cape-crown-knight', kind: 'cape', rarity: 'rare' },
  { id: 'cape-floodwall', kind: 'cape', rarity: 'common' },
  { id: 'cape-archon-static', kind: 'cape', rarity: 'legendary' },
  { id: 'dice-cyan-glass', kind: 'dice-skin', rarity: 'common' },
  { id: 'dice-magenta-glass', kind: 'dice-skin', rarity: 'common' },
  { id: 'dice-gold-l', kind: 'dice-skin', rarity: 'epic' },
  { id: 'foil-lok-drop', kind: 'foil-card', rarity: 'rare' },
  { id: 'foil-extraction', kind: 'foil-card', rarity: 'epic' },
  { id: 'emote-owl-nod', kind: 'emote', rarity: 'common' },
  { id: 'emote-vault-flex', kind: 'emote', rarity: 'rare' },
  { id: 'track-monroe-pulse', kind: 'jukebox-track', rarity: 'rare' },
  { id: 'hat-relay-cap', kind: 'hat', rarity: 'common' },
  { id: 'hat-gold-crown', kind: 'hat', rarity: 'legendary' },
];

export const COSMETICS_BY_ID: Record<string, CosmeticDef> = Object.fromEntries(PARTY_COSMETICS.map((c) => [c.id, c]));

export const FORGE_DUST: Record<ShardRarity, number> = { common: 120, rare: 300, epic: 750, legendary: 1500 };
export const DISENCHANT_DUST: Record<ShardRarity, number> = { common: 30, rare: 75, epic: 180, legendary: 360 };
const RARITY_WEIGHT: Record<ShardRarity, number> = { common: 60, rare: 28, epic: 10, legendary: 2 };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface CharacterMastery {
  points: number;
  marks: number;
  /** Highest level crossed; gates need marks so this can trail `levelFromPoints`. */
  level: number;
  bestGrade: Grade | null;
  matches: number;
  /** Lifetime signature stats (Eternals-style). */
  stats: Record<string, number>;
  /** Highest milestone index reached per stat. */
  milestones: Record<string, number>;
}

export interface LadderState {
  tier: number; // index into RANK_TIERS
  division: number; // 4..1 (1 is top); 0 for Master/Apex
  lp: number;
  wins: number;
  losses: number;
  peakTier: number;
}

export interface Shard {
  /** Unique instance id. */
  uid: string;
  cosmeticId: string;
}

export interface WeeklyMission {
  id: MissionKind;
  target: number;
  progress: number;
  claimed: boolean;
}

export type MissionKind = 'win-matches' | 'play-matches' | 'earn-a-grade' | 'bank-loot' | 'clutch-plays';

export interface BridgeGrant {
  id: string;
  game: BridgeGame;
  kind: 'cred' | 'gold';
  amount: number;
  createdAt: number;
}

export interface LokPartyMeta {
  version: 1;
  split: number;
  matches: number;
  wins: number;
  characters: Record<string, CharacterMastery>;
  ladders: Record<LadderId, LadderState>;
  pass: { split: number; xp: number; bonusShardsGranted: number };
  vault: {
    capsules: number;
    keyFragments: number;
    keys: number;
    shards: Shard[];
    dust: number;
    owned: string[];
    /** Characters that already dropped a capsule this split. */
    earnedThisSplit: string[];
    nextUid: number;
  };
  daily: { day: string; firstWinDone: boolean };
  weekly: { week: string; missions: WeeklyMission[] };
  /** Equipped Passport Crystals (challenge ids, up to 3). */
  crystals: string[];
  /** One-way, idempotent grants waiting for a main game to pay them. */
  outbox: BridgeGrant[];
  /** Ids a main game has confirmed paid. */
  paid: string[];
  /** Splits where Gold+ was reached on any ladder (Victorious reward). */
  victorious: number[];
}

export function emptyLadder(): LadderState {
  return { tier: 0, division: DIVISIONS, lp: 0, wins: 0, losses: 0, peakTier: 0 };
}

export function emptyMastery(): CharacterMastery {
  return { points: 0, marks: 0, level: 1, bestGrade: null, matches: 0, stats: {}, milestones: {} };
}

export function createLokPartyMeta(split = 1): LokPartyMeta {
  return {
    version: 1,
    split,
    matches: 0,
    wins: 0,
    characters: {},
    ladders: { solo: emptyLadder(), crew: emptyLadder() },
    pass: { split, xp: 0, bonusShardsGranted: 0 },
    vault: { capsules: 0, keyFragments: 0, keys: 0, shards: [], dust: 0, owned: [], earnedThisSplit: [], nextUid: 1 },
    daily: { day: '', firstWinDone: false },
    weekly: { week: '', missions: [] },
    crystals: [],
    outbox: [],
    paid: [],
    victorious: [],
  };
}

// ---------------------------------------------------------------------------
// Time keys and seeded rolls
// ---------------------------------------------------------------------------

export function dayKey(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO-ish week key (Monday start, local time). */
export function weekKey(nowMs: number): string {
  const d = new Date(nowMs);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `w${dayKey(monday.getTime())}`;
}

/** Mulberry32, same family as engine/math createRng; local so this file has no game imports. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

/** Everything a mode reports about one player's match. All 0..1 fields are clamped. */
export interface MatchPerformance {
  characterId: string;
  placement: number; // 1 = first
  players: number;
  /** Mode objective share, 0..1 (Lok Drop: share of all banked loot). */
  objective: number;
  /** Minigame or duel win rate, 0..1 (board modes). Lok Drop: knockouts landed share. */
  skill: number;
  /** Clutch plays (late banks, last-turn steals). */
  clutch: number;
  /** Risk/heat 0..1: how much was carried exposed. */
  risk: number;
  /** Signature stat increments for this character. */
  stats?: Record<string, number>;
  /** Lok Drop: loot banked this match (for missions). */
  banked?: number;
}

const c01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** 0..100 performance score. Placement weighs most; risk only helps if it paid off. */
export function performanceScore(p: MatchPerformance): number {
  const players = Math.max(2, p.players);
  const place = 1 - (Math.min(players, Math.max(1, p.placement)) - 1) / (players - 1);
  const clutch = Math.min(1, Math.max(0, p.clutch) / 3);
  const riskPaid = c01(p.risk) * c01(p.objective);
  return Math.round(100 * (0.4 * place + 0.3 * c01(p.objective) + 0.15 * c01(p.skill) + 0.1 * clutch + 0.05 * riskPaid * 2) * 100) / 100;
}

export function gradeFor(score: number): Grade {
  const cuts = [0, 22, 32, 40, 48, 56, 64, 72, 80, 88, 95];
  let g = 0;
  for (let i = 0; i < cuts.length; i += 1) if (score >= cuts[i]) g = i;
  return GRADES[g];
}

// ---------------------------------------------------------------------------
// Mastery
// ---------------------------------------------------------------------------

export function levelFromPoints(points: number): number {
  let lvl = 1;
  for (let i = 0; i < MASTERY_THRESHOLDS.length; i += 1) if (points >= MASTERY_THRESHOLDS[i]) lvl = i + 1;
  if (lvl >= 10) lvl = 10 + Math.floor((points - MASTERY_THRESHOLDS[9]) / MASTERY_INFINITE_STEP);
  return lvl;
}

/** Signature stat milestones fire live banners. */
export const STAT_MILESTONES = [10, 25, 50, 100, 250, 500, 1000] as const;

export function applyMastery(m: CharacterMastery, grade: Grade, stats: Record<string, number> = {}): { mastery: CharacterMastery; levelUps: number[]; unlocks: string[]; milestones: { stat: string; value: number }[] } {
  const points = m.points + MASTERY_POINTS_BY_GRADE[gradeIndex(grade)];
  const marks = m.marks + (gradeAtLeast(grade, 'S-') ? 1 : 0);
  const want = levelFromPoints(points);
  let level = m.level;
  const levelUps: number[] = [];
  const unlocks: string[] = [];
  while (level < want) {
    const next = level + 1;
    const need = MASTERY_MARK_GATES[next];
    if (need !== undefined && marks < need) break;
    level = next;
    levelUps.push(level);
    if (MASTERY_UNLOCKS[level]) unlocks.push(MASTERY_UNLOCKS[level]);
  }
  const newStats = { ...m.stats };
  const newMilestones = { ...m.milestones };
  const hit: { stat: string; value: number }[] = [];
  for (const [k, v] of Object.entries(stats)) {
    if (!Number.isFinite(v) || v <= 0) continue;
    newStats[k] = (newStats[k] ?? 0) + Math.floor(v);
    let idx = newMilestones[k] ?? -1;
    while (idx + 1 < STAT_MILESTONES.length && newStats[k] >= STAT_MILESTONES[idx + 1]) {
      idx += 1;
      hit.push({ stat: k, value: STAT_MILESTONES[idx] });
    }
    newMilestones[k] = idx;
  }
  const best = m.bestGrade && gradeIndex(m.bestGrade) >= gradeIndex(grade) ? m.bestGrade : grade;
  return {
    mastery: { points, marks, level, bestGrade: best, matches: m.matches + 1, stats: newStats, milestones: newMilestones },
    levelUps,
    unlocks,
    milestones: hit,
  };
}

// ---------------------------------------------------------------------------
// Ranked ladders
// ---------------------------------------------------------------------------

const MASTER = RANK_TIERS.indexOf('Master');
const APEX = RANK_TIERS.indexOf('616 Apex');

export function lpDelta(placement: number, players: number, grade: Grade): number {
  const base = players <= 2 ? (placement === 1 ? 22 : -18) : ([24, 10, -8, -18][Math.min(3, Math.max(0, placement - 1))] ?? -18);
  // A great grade softens a loss and sweetens a win, by at most 6 LP.
  const g = Math.round((gradeIndex(grade) - 5) * 1.2);
  return base + Math.max(-6, Math.min(6, g));
}

export function applyLp(l: LadderState, delta: number, won: boolean): LadderState {
  let { tier, division, lp } = l;
  lp += delta;
  if (tier >= MASTER) {
    if (lp < 0) {
      // Master floor drops back to Diamond 1 at 75 LP.
      if (tier === MASTER) return finishLadder(l, MASTER - 1, 1, 75, won);
      tier = MASTER;
      lp = APEX_LP + lp;
    }
    if (tier === MASTER && lp >= APEX_LP) {
      tier = APEX;
      lp -= APEX_LP;
    }
    return finishLadder(l, tier, 0, Math.max(0, lp), won);
  }
  while (lp >= LP_PER_DIVISION) {
    lp -= LP_PER_DIVISION;
    if (division > 1) division -= 1;
    else {
      tier += 1;
      division = tier >= MASTER ? 0 : DIVISIONS;
      if (tier >= MASTER) break;
    }
  }
  if (lp < 0) {
    const atFloor = tier === 0 && division === DIVISIONS;
    // Tier floors protect: dropping a division inside a tier is allowed, dropping a tier is not.
    if (atFloor || division === DIVISIONS) lp = 0;
    else {
      division += 1;
      lp = LP_PER_DIVISION + lp;
    }
  }
  return finishLadder(l, tier, division, lp, won);
}

function finishLadder(prev: LadderState, tier: number, division: number, lp: number, won: boolean): LadderState {
  return {
    tier,
    division,
    lp,
    wins: prev.wins + (won ? 1 : 0),
    losses: prev.losses + (won ? 0 : 1),
    peakTier: Math.max(prev.peakTier, tier),
  };
}

export function ladderLabel(l: LadderState): string {
  const name = RANK_TIERS[l.tier];
  if (l.tier >= MASTER) return `${name} ${l.lp} LP`;
  return `${name} ${['', 'I', 'II', 'III', 'IV'][l.division]} ${l.lp} LP`;
}

// ---------------------------------------------------------------------------
// Split Pass
// ---------------------------------------------------------------------------

export function passTier(xp: number): number {
  return Math.min(PASS_TIERS, Math.floor(xp / PASS_XP_PER_TIER));
}

/** Bonus shards owed past tier 50 (every 500 XP). */
export function passBonusShards(xp: number): number {
  const over = xp - PASS_TIERS * PASS_XP_PER_TIER;
  return over > 0 ? Math.floor(over / PASS_BONUS_XP) : 0;
}

export function matchXp(p: MatchPerformance, grade: Grade): number {
  const place = [180, 140, 110, 90][Math.min(3, Math.max(0, p.placement - 1))] ?? 90;
  return place + gradeIndex(grade) * 12;
}

// ---------------------------------------------------------------------------
// Weekly missions
// ---------------------------------------------------------------------------

const MISSION_POOL: { id: MissionKind; target: number }[] = [
  { id: 'win-matches', target: 2 },
  { id: 'play-matches', target: 5 },
  { id: 'earn-a-grade', target: 3 },
  { id: 'bank-loot', target: 60 },
  { id: 'clutch-plays', target: 3 },
];
export const MISSION_XP = 600;

export function rollWeeklyMissions(week: string): WeeklyMission[] {
  const rng = seededRng(hashString(week));
  const pool = [...MISSION_POOL];
  const out: WeeklyMission[] = [];
  while (out.length < 3 && pool.length) {
    const i = Math.floor(rng() * pool.length);
    const m = pool.splice(i, 1)[0];
    out.push({ id: m.id, target: m.target, progress: 0, claimed: false });
  }
  return out;
}

function missionIncrement(id: MissionKind, p: MatchPerformance, grade: Grade): number {
  switch (id) {
    case 'win-matches':
      return p.placement === 1 ? 1 : 0;
    case 'play-matches':
      return 1;
    case 'earn-a-grade':
      return gradeAtLeast(grade, 'A-') ? 1 : 0;
    case 'bank-loot':
      return Math.max(0, Math.floor(p.banked ?? 0));
    case 'clutch-plays':
      return Math.max(0, Math.floor(p.clutch));
  }
}

// ---------------------------------------------------------------------------
// Vault: capsules, Beacon Keys, shards, forge, reroll
// ---------------------------------------------------------------------------

export function rollCosmetic(rng: () => number, exclude: ReadonlySet<string> = new Set()): CosmeticDef {
  const pool = PARTY_COSMETICS.filter((c) => !exclude.has(c.id));
  const list = pool.length ? pool : PARTY_COSMETICS;
  const total = list.reduce((s, c) => s + RARITY_WEIGHT[c.rarity], 0);
  let r = rng() * total;
  for (const c of list) {
    r -= RARITY_WEIGHT[c.rarity];
    if (r <= 0) return c;
  }
  return list[list.length - 1];
}

export interface OpenResult {
  meta: LokPartyMeta;
  shards: Shard[];
}

/** Opening a capsule spends one capsule and one Beacon Key; drops two shards. */
export function openCapsule(meta: LokPartyMeta, seed: number): OpenResult | null {
  if (meta.vault.capsules < 1 || meta.vault.keys < 1) return null;
  const rng = seededRng(seed);
  let uid = meta.vault.nextUid;
  const shards: Shard[] = [];
  for (let i = 0; i < 2; i += 1) shards.push({ uid: `s${uid++}`, cosmeticId: rollCosmetic(rng).id });
  return {
    shards,
    meta: { ...meta, vault: { ...meta.vault, capsules: meta.vault.capsules - 1, keys: meta.vault.keys - 1, shards: [...meta.vault.shards, ...shards], nextUid: uid } },
  };
}

/** Forge a shard into a permanent unlock for dust. */
export function forgeShard(meta: LokPartyMeta, uid: string): LokPartyMeta | null {
  const shard = meta.vault.shards.find((s) => s.uid === uid);
  const def = shard && COSMETICS_BY_ID[shard.cosmeticId];
  if (!shard || !def) return null;
  if (meta.vault.owned.includes(def.id)) return null;
  const cost = FORGE_DUST[def.rarity];
  if (meta.vault.dust < cost) return null;
  return {
    ...meta,
    vault: { ...meta.vault, dust: meta.vault.dust - cost, shards: meta.vault.shards.filter((s) => s.uid !== uid), owned: [...meta.vault.owned, def.id] },
  };
}

export function disenchantShard(meta: LokPartyMeta, uid: string): LokPartyMeta | null {
  const shard = meta.vault.shards.find((s) => s.uid === uid);
  const def = shard && COSMETICS_BY_ID[shard.cosmeticId];
  if (!shard || !def) return null;
  return { ...meta, vault: { ...meta.vault, dust: meta.vault.dust + DISENCHANT_DUST[def.rarity], shards: meta.vault.shards.filter((s) => s.uid !== uid) } };
}

/**
 * Reroll three shards into one GUARANTEED permanent unlock the player does not own yet.
 * Rarity floor is the lowest rarity among the three sacrificed (so rerolls never feel like a downgrade).
 */
export function rerollShards(meta: LokPartyMeta, uids: readonly string[], seed: number): { meta: LokPartyMeta; unlocked: CosmeticDef } | null {
  if (new Set(uids).size !== REROLL_COST) return null;
  const picked = uids.map((u) => meta.vault.shards.find((s) => s.uid === u));
  if (picked.some((s) => !s)) return null;
  const owned = new Set(meta.vault.owned);
  const remaining = PARTY_COSMETICS.filter((c) => !owned.has(c.id));
  if (!remaining.length) return null;
  const order: ShardRarity[] = ['common', 'rare', 'epic', 'legendary'];
  const floor = Math.min(...picked.map((s) => order.indexOf(COSMETICS_BY_ID[s!.cosmeticId]?.rarity ?? 'common')));
  const eligible = remaining.filter((c) => order.indexOf(c.rarity) >= floor);
  const pool = eligible.length ? eligible : remaining;
  const rng = seededRng(seed);
  const unlocked = pool[Math.floor(rng() * pool.length)];
  const gone = new Set(uids);
  return {
    unlocked,
    meta: { ...meta, vault: { ...meta.vault, shards: meta.vault.shards.filter((s) => !gone.has(s.uid)), owned: [...meta.vault.owned, unlocked.id] } },
  };
}

// ---------------------------------------------------------------------------
// The one entry point: apply a finished match
// ---------------------------------------------------------------------------

export interface MatchContext {
  nowMs: number;
  seed: number;
  ladder: LadderId;
  /** Set false for unranked/practice; still grades, still pays pass XP. */
  ranked?: boolean;
}

export interface MatchReport {
  score: number;
  grade: Grade;
  masteryLevelUps: number[];
  masteryUnlocks: string[];
  milestones: { stat: string; value: number }[];
  masteryLevel: number;
  masteryPoints: number;
  lpBefore: LadderState;
  lpAfter: LadderState;
  lpChange: number;
  passXpGained: number;
  passTierBefore: number;
  passTierAfter: number;
  firstWinOfDay: boolean;
  capsuleEarned: boolean;
  keyFragmentsEarned: number;
  keysCompleted: number;
  bonusShards: Shard[];
  missionsCompleted: MissionKind[];
  bridgeGrants: BridgeGrant[];
  victoriousUnlocked: boolean;
}

export function applyMatch(meta0: LokPartyMeta, p: MatchPerformance, ctx: MatchContext): { meta: LokPartyMeta; report: MatchReport } {
  let meta = refreshTimers(meta0, ctx.nowMs);
  const score = performanceScore(p);
  const grade = gradeFor(score);
  const won = p.placement === 1;

  // Mastery
  const before = meta.characters[p.characterId] ?? emptyMastery();
  const m = applyMastery(before, grade, p.stats);
  meta = { ...meta, characters: { ...meta.characters, [p.characterId]: m.mastery } };

  // Ladder
  const ranked = ctx.ranked !== false;
  const lpBefore = meta.ladders[ctx.ladder];
  const delta = ranked ? lpDelta(p.placement, p.players, grade) : 0;
  const lpAfter = ranked ? applyLp(lpBefore, delta, won) : lpBefore;
  meta = { ...meta, ladders: { ...meta.ladders, [ctx.ladder]: lpAfter } };
  const goldIdx = RANK_TIERS.indexOf('Gold');
  const victoriousUnlocked = lpAfter.tier >= goldIdx && !meta.victorious.includes(meta.split);
  if (victoriousUnlocked) meta = { ...meta, victorious: [...meta.victorious, meta.split] };

  // First win of the day
  const firstWinOfDay = won && !meta.daily.firstWinDone;
  if (firstWinOfDay) meta = { ...meta, daily: { ...meta.daily, firstWinDone: true } };

  // Missions
  const missionsCompleted: MissionKind[] = [];
  let missionXp = 0;
  const missions = meta.weekly.missions.map((mi) => {
    if (mi.claimed) return mi;
    const progress = Math.min(mi.target, mi.progress + missionIncrement(mi.id, p, grade));
    if (progress >= mi.target) {
      missionsCompleted.push(mi.id);
      missionXp += MISSION_XP;
      return { ...mi, progress, claimed: true };
    }
    return { ...mi, progress };
  });
  meta = { ...meta, weekly: { ...meta.weekly, missions } };

  // Pass
  const passXpGained = matchXp(p, grade) + (firstWinOfDay ? FIRST_WIN_XP : 0) + missionXp;
  const passTierBefore = passTier(meta.pass.xp);
  const xp = meta.pass.xp + passXpGained;
  const owedBonus = passBonusShards(xp) - meta.pass.bonusShardsGranted;
  const rng = seededRng(ctx.seed ^ 0x5eed);
  let uid = meta.vault.nextUid;
  const bonusShards: Shard[] = [];
  for (let i = 0; i < owedBonus; i += 1) bonusShards.push({ uid: `s${uid++}`, cosmeticId: rollCosmetic(rng).id });
  meta = {
    ...meta,
    pass: { ...meta.pass, xp, bonusShardsGranted: meta.pass.bonusShardsGranted + Math.max(0, owedBonus) },
    vault: { ...meta.vault, shards: [...meta.vault.shards, ...bonusShards], nextUid: uid },
  };

  // Vault capsule: S- or better on a character that has not dropped one this split.
  const capsuleEarned = gradeAtLeast(grade, 'S-') && !meta.vault.earnedThisSplit.includes(p.characterId);
  // Beacon Key fragments: finishing gives one; a win or an S grade gives one more each.
  const keyFragmentsEarned = 1 + (won ? 1 : 0) + (gradeAtLeast(grade, 'S') ? 1 : 0);
  const fragments = meta.vault.keyFragments + keyFragmentsEarned;
  const keysCompleted = Math.floor(fragments / KEY_FRAGMENTS_PER_KEY);
  meta = {
    ...meta,
    vault: {
      ...meta.vault,
      capsules: meta.vault.capsules + (capsuleEarned ? 1 : 0),
      earnedThisSplit: capsuleEarned ? [...meta.vault.earnedThisSplit, p.characterId] : meta.vault.earnedThisSplit,
      keyFragments: fragments % KEY_FRAGMENTS_PER_KEY,
      keys: meta.vault.keys + keysCompleted,
    },
  };

  // Cross-game bridge (one-way, idempotent per day and game)
  const bridgeGrants: BridgeGrant[] = [];
  if (firstWinOfDay) {
    const day = dayKey(ctx.nowMs);
    for (const game of Object.keys(BRIDGE_FIRST_WIN) as BridgeGame[]) {
      const id = `lokparty:first-win:${game}:${day}`;
      if (meta.paid.includes(id) || meta.outbox.some((g) => g.id === id)) continue;
      const def = BRIDGE_FIRST_WIN[game];
      bridgeGrants.push({ id, game, kind: def.kind, amount: def.amount, createdAt: ctx.nowMs });
    }
    meta = { ...meta, outbox: [...meta.outbox, ...bridgeGrants] };
  }

  meta = { ...meta, matches: meta.matches + 1, wins: meta.wins + (won ? 1 : 0) };

  return {
    meta,
    report: {
      score,
      grade,
      masteryLevelUps: m.levelUps,
      masteryUnlocks: m.unlocks,
      milestones: m.milestones,
      masteryLevel: m.mastery.level,
      masteryPoints: m.mastery.points,
      lpBefore,
      lpAfter,
      lpChange: delta,
      passXpGained,
      passTierBefore,
      passTierAfter: passTier(xp),
      firstWinOfDay,
      capsuleEarned,
      keyFragmentsEarned,
      keysCompleted,
      bonusShards,
      missionsCompleted,
      bridgeGrants,
      victoriousUnlocked,
    },
  };
}

/** Roll the daily and weekly windows forward; resets the split's capsule list on a new split. */
export function refreshTimers(meta: LokPartyMeta, nowMs: number): LokPartyMeta {
  let out = meta;
  const day = dayKey(nowMs);
  if (out.daily.day !== day) out = { ...out, daily: { day, firstWinDone: false } };
  const week = weekKey(nowMs);
  if (out.weekly.week !== week) out = { ...out, weekly: { week, missions: rollWeeklyMissions(week) } };
  return out;
}

export function startSplit(meta: LokPartyMeta, split: number): LokPartyMeta {
  if (split <= meta.split) return meta;
  return {
    ...meta,
    split,
    pass: { split, xp: 0, bonusShardsGranted: 0 },
    vault: { ...meta.vault, earnedThisSplit: [] },
    // Soft reset: drop each ladder four divisions, never below Iron IV.
    ladders: { solo: softReset(meta.ladders.solo), crew: softReset(meta.ladders.crew) },
  };
}

function softReset(l: LadderState): LadderState {
  const steps = l.tier >= MASTER ? 0 : (l.tier * DIVISIONS + (DIVISIONS - l.division));
  const down = Math.max(0, (l.tier >= MASTER ? MASTER * DIVISIONS : steps) - DIVISIONS);
  const tier = Math.floor(down / DIVISIONS);
  return { ...emptyLadder(), tier, division: DIVISIONS - (down % DIVISIONS), peakTier: l.peakTier };
}

// ---------------------------------------------------------------------------
// Bridge: the main game pays, then confirms
// ---------------------------------------------------------------------------

export function pendingGrants(meta: LokPartyMeta, game: BridgeGame): BridgeGrant[] {
  return meta.outbox.filter((g) => g.game === game && !meta.paid.includes(g.id));
}

export function markGrantPaid(meta: LokPartyMeta, id: string): LokPartyMeta {
  if (meta.paid.includes(id)) return meta;
  return { ...meta, paid: [...meta.paid.slice(-60), id], outbox: meta.outbox.filter((g) => g.id !== id) };
}

/** Cosmetic ids a main game may display (flex only, never stats). */
export function exportFlex(meta: LokPartyMeta): string[] {
  const mastery = Object.entries(meta.characters).flatMap(([id, m]) =>
    Object.entries(MASTERY_UNLOCKS)
      .filter(([lvl]) => m.level >= Number(lvl))
      .map(([, unlock]) => `${unlock}:${id}`),
  );
  const victorious = meta.victorious.map((s) => `victorious-aura:split-${s}`);
  return [...meta.vault.owned, ...mastery, ...victorious];
}

// ---------------------------------------------------------------------------
// Persistence (defensive: a corrupt save never crashes and never touches other keys)
// ---------------------------------------------------------------------------

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function sanitizeLokPartyMeta(raw: unknown): LokPartyMeta {
  const base = createLokPartyMeta();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<LokPartyMeta>;
  if (r.version !== 1) return base;
  const ladder = (l: unknown): LadderState => {
    const x = (l ?? {}) as Partial<LadderState>;
    const tier = Math.min(RANK_TIERS.length - 1, Math.max(0, Math.floor(num(x.tier))));
    return {
      tier,
      division: tier >= MASTER ? 0 : Math.min(DIVISIONS, Math.max(1, Math.floor(num(x.division, DIVISIONS)))),
      lp: Math.max(0, num(x.lp)),
      wins: Math.max(0, num(x.wins)),
      losses: Math.max(0, num(x.losses)),
      peakTier: Math.max(tier, Math.floor(num(x.peakTier))),
    };
  };
  const chars: Record<string, CharacterMastery> = {};
  for (const [id, m] of Object.entries(r.characters ?? {})) {
    const x = (m ?? {}) as Partial<CharacterMastery>;
    chars[id] = {
      points: Math.max(0, num(x.points)),
      marks: Math.max(0, num(x.marks)),
      level: Math.max(1, Math.floor(num(x.level, 1))),
      bestGrade: GRADES.includes(x.bestGrade as Grade) ? (x.bestGrade as Grade) : null,
      matches: Math.max(0, num(x.matches)),
      stats: { ...(x.stats ?? {}) },
      milestones: { ...(x.milestones ?? {}) },
    };
  }
  const v = (r.vault ?? {}) as Partial<LokPartyMeta['vault']>;
  return {
    ...base,
    split: Math.max(1, num(r.split, 1)),
    matches: Math.max(0, num(r.matches)),
    wins: Math.max(0, num(r.wins)),
    characters: chars,
    ladders: { solo: ladder(r.ladders?.solo), crew: ladder(r.ladders?.crew) },
    pass: { split: num(r.pass?.split, 1), xp: Math.max(0, num(r.pass?.xp)), bonusShardsGranted: Math.max(0, num(r.pass?.bonusShardsGranted)) },
    vault: {
      capsules: Math.max(0, num(v.capsules)),
      keyFragments: Math.max(0, num(v.keyFragments)) % KEY_FRAGMENTS_PER_KEY,
      keys: Math.max(0, num(v.keys)),
      shards: Array.isArray(v.shards) ? v.shards.filter((s) => s && typeof s.uid === 'string' && COSMETICS_BY_ID[s.cosmeticId]) : [],
      dust: Math.max(0, num(v.dust)),
      owned: Array.isArray(v.owned) ? v.owned.filter((id) => typeof id === 'string') : [],
      earnedThisSplit: Array.isArray(v.earnedThisSplit) ? v.earnedThisSplit.filter((id) => typeof id === 'string') : [],
      nextUid: Math.max(1, num(v.nextUid, 1)),
    },
    daily: { day: typeof r.daily?.day === 'string' ? r.daily.day : '', firstWinDone: r.daily?.firstWinDone === true },
    weekly: { week: typeof r.weekly?.week === 'string' ? r.weekly.week : '', missions: Array.isArray(r.weekly?.missions) ? r.weekly!.missions : [] },
    crystals: Array.isArray(r.crystals) ? r.crystals.slice(0, 3) : [],
    outbox: Array.isArray(r.outbox) ? r.outbox : [],
    paid: Array.isArray(r.paid) ? r.paid : [],
    victorious: Array.isArray(r.victorious) ? r.victorious : [],
  };
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadLokPartyMeta(store: KeyValueStore | null | undefined): LokPartyMeta {
  try {
    const raw = store?.getItem(LOK_PARTY_META_KEY);
    return raw ? sanitizeLokPartyMeta(JSON.parse(raw)) : createLokPartyMeta();
  } catch {
    return createLokPartyMeta();
  }
}

export function saveLokPartyMeta(store: KeyValueStore | null | undefined, meta: LokPartyMeta): void {
  try {
    store?.setItem(LOK_PARTY_META_KEY, JSON.stringify(meta));
  } catch {
    /* storage full or blocked: progress stays in memory this session */
  }
}
