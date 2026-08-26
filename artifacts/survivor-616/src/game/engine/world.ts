/**
 * The run simulation.
 *
 * Fixed-behaviour physics: circles for actors, axis-aligned boxes for
 * scenery, impulse-based knockback with friction, and a uniform grid so
 * hundreds of enemies can separate from each other without melting a phone.
 *
 * Nothing in here reaches into React. `RunScreen` steps the world and reads
 * snapshots out of it.
 */

import { getEnemy } from '@/game/data/enemies';
import { DUNGEON_ERAS } from '@/game/data/dungeonEras';
import { EVOLUTIONS, EVOLUTIONS_BY_ID } from '@/game/data/evolutions';
import { PASSIVES, PASSIVES_BY_ID } from '@/game/data/passives';
import { UPGRADES } from '@/game/data/progression';
import { WEAPONS_BY_ID } from '@/game/data/weapons';
import { rollPrize } from '@/game/data/prizes';
import { LOKPET_ELEMENT_COLORS, rollLokPet } from '@/game/data/lokPets';
import { OBJECTIVES } from '@/game/data/objectives';
import { STATUS_EFFECTS_BY_ID } from '@/game/data/statusEffects';
import type {
  AreaDef,
  BaseStats,
  CharacterDef,
  CompletedObjective,
  EnemyDef,
  EndlessState,
  HudSnapshot,
  LootPrizeDef,
  LokPetInstance,
  LokPetRoll,
  ObjectiveDef,
  RunObjective,
  RunResult,
  RunPassive,
  RunWeapon,
  StatusEffectInstance,
  UpgradeDef,
  WeaponDef,
  ObstacleDef,
} from '@/game/types';

import {
  clamp,
  createRng,
  dist2,
  randRange,
  resolveCircleBox,
  type Aabb,
} from './math';
import { CHUNK_SIZE, chunkKey, chunkOrigin, generateChunk, worldToChunkCoords } from './chunks';

/* ------------------------------------------------------------------ */
/* Entities                                                            */
/* ------------------------------------------------------------------ */

export type AnimState = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

export interface Actor {
  uid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Knockback velocity, decays separately from steering. */
  kx: number;
  ky: number;
  radius: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  anim: AnimState;
  animStartedAt: number;
  hitFlashUntil: number;
}

export interface PlayerActor extends Actor {
  invulnUntil: number;
  lastDamageAt: number;
}

export interface EnemyActor extends Actor {
  defId: string;
  def: EnemyDef;
  speed: number;
  damage: number;
  xp: number;
  mass: number;
  contactReadyAt: number;
  /** Charger wind-up / dash bookkeeping. */
  chargeReadyAt: number;
  chargeUntil: number;
  /** Spitter fire timer. */
  fireReadyAt: number;
  /** Drifters weave around their heading. */
  weave: number;
  specialReadyAt: number;
  telegraphUntil: number;
  specialUntil: number;
  specialRadius: number;
  specialKind: 'shockwave' | 'current' | null;
  ghostUntil: number;
  burstUntil: number;
  baseRadius: number;
  convertedUntil: number;
  convertedAttackReadyAt: number;
  dying: boolean;
  deathAt: number;
  activeEffects: StatusEffectInstance[];
}

export interface Projectile {
  uid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  knockback: number;
  fromPlayer: boolean;
  expiresAt: number;
  /** Homing projectiles steer toward this enemy. */
  targetUid: number | null;
  turnRate: number;
  color: string;
  trail: Array<{ x: number; y: number }>;
  pierce: number;
  hitUids: Set<number>;
  /** Obstacles already reflected from, preventing a single frame from looping. */
  obstacleUids?: Set<number>;
  obstacleInteraction?: 'block' | 'reflect';
  statusEffectId?: string;
  /** Pet shots can detonate into a second area hit on contact. */
  explosionRadius?: number;
  explosionDamage?: number;
}

export type EffectKind = 'slash' | 'nova' | 'aura' | 'spark' | 'ring' | 'wave' | 'laser' | 'hazard' | 'teleport';

export interface Effect {
  uid: number;
  kind: EffectKind;
  x: number;
  y: number;
  radius: number;
  /** Slash arcs use these. */
  angle: number;
  spread: number;
  bornAt: number;
  expiresAt: number;
  color: string;
  /** Effects that damage over their lifetime re-check on a cadence. */
  damage: number;
  knockback: number;
  hitUids: Set<number>;
  followPlayer: boolean;
  nextTickAt?: number;
  hurtsPlayer?: boolean;
}

export interface Orbiter {
  weaponId: string;
  angle: number;
  radius: number;
  damage: number;
  cooldowns: Map<number, number>;
}

export type PickupKind = 'xp' | 'health' | 'cred' | 'sweep' | 'loot-box';

export interface Pickup {
  uid: number;
  kind: PickupKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  bornAt: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  bornAt: number;
  vy: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  bornAt: number;
  lifeMs: number;
}

export interface Follower {
  uid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  damage: number;
  bornAt: number;
  expiresAt: number;
  growAfterMs: number;
  maxRadius: number;
  orbitAngle: number;
  orbitRadius: number;
  color: string;
  weaponId: string;
  readyAt?: number;
}

export interface RescueState {
  status: 'pending' | 'available' | 'freeing' | 'freed';
  x: number;
  y: number;
  /** 0..1 progress while the player stands in the ring. */
  progress: number;
  appearAtSec: number;
  allyId?: string;
}

export type RunOutcome = 'running' | 'cleared' | 'dead';

export interface Alert {
  text: string;
  bornAt: number;
}

export interface BreakableObstacle extends Aabb {
  uid: number;
  kind: ObstacleDef['kind'];
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  broken: boolean;
  brokenAt: number;
  contacts: number;
  /** Falling light-pole state. */
  fallAngle?: number;
  hazardUntil?: number;
  hazardNextTickAt?: number;
}

const BREAKABLE_HP: Partial<Record<ObstacleDef['kind'], number>> = {
  crate: 40, 'crate-breakable': 40, 'neon-sign': 60, barrel: 80,
  'fuse-box': 100, 'street-lamp': 55, dumpster: 90, 'car-wreck': 150, car: 120,
  cover: 180,
};
const PUSHABLE_KINDS = new Set<ObstacleDef['kind']>(['crate-breakable', 'dumpster', 'car-wreck', 'cover']);
const PROJECTILE_BLOCKING_KINDS = new Set<ObstacleDef['kind']>(['crate-breakable', 'crate', 'barrel', 'street-lamp', 'cover', 'reflective-surface']);

/* ------------------------------------------------------------------ */
/* World                                                               */
/* ------------------------------------------------------------------ */

export interface World {
  area: AreaDef;
  character: CharacterDef;
  /** Live stats after upgrades. */
  stats: BaseStats;

  /** Seconds since the run started. */
  time: number;
  /** Milliseconds since the run started -- used for all timers. */
  now: number;

  player: PlayerActor;
  enemies: EnemyActor[];
  projectiles: Projectile[];
  effects: Effect[];
  orbiters: Orbiter[];
  weapons: RunWeapon[];
  passives: RunPassive[];
  pickups: Pickup[];
  popups: Popup[];
  particles: Particle[];
  followers: Follower[];
  lokPets: LokPetInstance[];
  /** All LokPets generated this run, including companions that have expired. */
  lokPetHistory: LokPetInstance[];

  obstacles: Aabb[];
  breakables: BreakableObstacle[];
  bounds: { w: number; h: number };

  camera: { x: number; y: number };
  shake: number;

  level: number;
  xp: number;
  xpToNext: number;
  pendingLevelUps: number;

  weaponLevel: number;
  weaponCount: number;
  ultCooldownMult: number;

  weaponReadyAt: number;
  ultReadyAt: number;
  ultActiveUntil: number;

  kills: number;
  killsByEnemy: Record<string, number>;
  cred: number;

  rescue: RescueState;
  alerts: Alert[];
  outcome: RunOutcome;

  upgradeStacks: Record<string, number>;
  spawnCredit: number[];
  nextUid: number;
  rng: () => number;
  /** Rebuilt every frame for enemy separation. */
  grid: Map<number, EnemyActor[]>;

  /** Seed used to create rng; also forwarded to endless chunk generation. */
  rngSeed: number;
  /** Present only when area.endless === true. */
  endless?: EndlessState;

  /* ---- Loot box system ---- */
  /** Kill counts at which a milestone box has already dropped (prevent double-drops). */
  lootBoxMilestonesHit: Set<number>;
  /** Prizes queued for the reel overlay; each entry is consumed by RunScreen. */
  pendingReel: LootPrizeDef[];
  /** Total blue boxes opened this run. */
  lootBoxesOpened: number;
  /** Label of each prize collected this run. */
  openedPrizes: string[];
  /** Loot tokens earned (prizes + objective rewards). */
  lootTokensGained: number;

  /* ---- Objective system ---- */
  objectives: RunObjective[];
  completedObjectives: CompletedObjective[];
}

const MAX_ENEMIES = 190;
const CELL = 48;

/** Kill counts that drop a blue loot box (each fires once per run). */
const LOOT_BOX_MILESTONES = [15, 30, 50, 75, 100, 150, 200];

/** Return the subset of objectives valid for the given run mode. */
function validObjectivesForArea(endless: boolean): ObjectiveDef[] {
  return OBJECTIVES.filter((o) => {
    // walk-blocks requires the endless distance tracker; exclude from timed runs.
    if (o.kind === 'walk-blocks' && !endless) return false;
    return true;
  });
}

/** Roll 2 random starting objectives for a run. */
function rollStartingObjectives(rng: () => number, endless: boolean): RunObjective[] {
  const pool = [...validObjectivesForArea(endless)];
  const picks: RunObjective[] = [];
  while (picks.length < 2 && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    const def = pool.splice(i, 1)[0]!;
    picks.push({ def, progress: 0, completed: false });
  }
  return picks;
}

/** Pick a fresh objective that isn't already active and hasn't been completed. */
function rollNextObjective(
  rng: () => number,
  active: RunObjective[],
  completed: CompletedObjective[],
  endless: boolean,
): RunObjective | null {
  const usedIds = new Set([
    ...active.map((o) => o.def.id),
    ...completed.map((c) => c.id),
  ]);
  const pool = validObjectivesForArea(endless).filter((o) => !usedIds.has(o.id));
  if (pool.length === 0) return null;
  const def = pool[Math.floor(rng() * pool.length)]!;
  return { def, progress: 0, completed: false };
}

function xpForLevel(level: number): number {
  return Math.round(6 + level * 5 + Math.pow(level, 1.55) * 2);
}

export function createWorld(
  area: AreaDef,
  character: CharacterDef,
  stats: BaseStats,
  seed = Date.now() % 100000,
): World {
  const player: PlayerActor = {
    uid: 1,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    radius: 12,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    facing: 1,
    anim: 'idle',
    animStartedAt: 0,
    hitFlashUntil: 0,
    invulnUntil: 0,
    lastDamageAt: -9999,
  };

  const rng = createRng(seed);

  const world: World = {
    area,
    character,
    stats: { ...stats },
    time: 0,
    now: 0,
    player,
    enemies: [],
    projectiles: [],
    effects: [],
    orbiters: [],
    weapons: [{ def: character.weapon, level: 1, count: character.weapon.count ?? 1, readyAt: 400 }],
    passives: [],
    pickups: [],
    popups: [],
    particles: [],
    followers: [],
    lokPets: [],
    lokPetHistory: [],
    obstacles: area.obstacles.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h })),
    breakables: [],
    bounds: area.bounds,
    camera: { x: 0, y: 0 },
    shake: 0,
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    pendingLevelUps: 0,
    weaponLevel: 1,
    weaponCount: character.weapon.count ?? 1,
    ultCooldownMult: 1,
    weaponReadyAt: 400,
    ultReadyAt: 4000,
    ultActiveUntil: -1,
    kills: 0,
    killsByEnemy: {},
    cred: 0,
    rescue: {
      status: area.rescueAllyId ? 'pending' : 'freed',
      x: 0,
      y: 0,
      progress: 0,
      appearAtSec: Math.round(area.durationSec * 0.35),
      allyId: area.rescueAllyId,
    },
    alerts: [],
    outcome: 'running',
    upgradeStacks: {},
    spawnCredit: area.waves.map(() => 0),
    nextUid: 100,
    rng,
    grid: new Map(),
    rngSeed: seed,
    endless: undefined,
    lootBoxMilestonesHit: new Set(),
    pendingReel: [],
    lootBoxesOpened: 0,
    openedPrizes: [],
    lootTokensGained: 0,
    objectives: rollStartingObjectives(rng, !!area.endless),
    completedObjectives: [],
  };

  world.breakables = area.obstacles.map((o) => {
    const hp = BREAKABLE_HP[o.kind] ?? 999999;
    return { ...o, uid: uid(world), kind: o.kind, hp, maxHp: hp, vx: 0, vy: 0, broken: false, brokenAt: 0, contacts: 0 };
  });

  if (area.endless) {
    world.endless = {
      maxDistancePx: 0,
      dungeonDepth: 0,
      inDungeon: false,
      inBuilding: false,
      buildingLabel: '',
      buildingReturnX: 0,
      buildingReturnY: 0,
      dungeonRoom: 0,
      dungeonBossDefeated: false,
      dungeonChest: null,
      dungeonEraIndex: -1, // will be incremented to 0 on first entry
      dungeonBounds: { w: 560, h: 440 },
      streetReturnX: 0,
      streetReturnY: 0,
      dungeonCenterX: 0,
      dungeonCenterY: 0,
      exitZone: null,
      dungeonEntrances: [],
      consumedEntranceChunks: new Set(),
      chunkObstacles: new Map(),
      spawnBudget: 0,
      rngSeed: seed,
      pendingTransition: null,
      cityBlocks: [],
      riverSegments: [],
      buildingEntrances: [],
    };
    // The endless area bounds sentinel won't be used for clamping, but the
    // rescue system reads durationSec.  Keep rescue disabled in endless mode.
    world.rescue.status = 'freed';
  }

  if (character.weapon.kind === 'orbit') {
    rebuildOrbiters(world);
  }
  if (character.weapon.follower?.lifetimeMs === 0) spawnFollowers(world, character.weapon);
  return world;
}

function uid(w: World): number {
  w.nextUid += 1;
  return w.nextUid;
}

function pushAlert(w: World, text: string) {
  w.alerts.push({ text, bornAt: w.now });
  if (w.alerts.length > 4) w.alerts.shift();
}

/* ------------------------------------------------------------------ */
/* Derived stats                                                       */
/* ------------------------------------------------------------------ */

function ultActive(w: World): boolean {
  return w.now < w.ultActiveUntil;
}

function damageMult(w: World): number {
  const ult = ultActive(w) ? (w.character.ultimate.effect.damageMult ?? 1) : 1;
  return w.stats.power * ult;
}

function areaMult(w: World): number {
  return w.stats.area;
}

function speedMult(w: World): number {
  return ultActive(w) ? (w.character.ultimate.effect.speedMult ?? 1) : 1;
}

function cooldownMult(w: World): number {
  const ult = ultActive(w) ? (w.character.ultimate.effect.cooldownMult ?? 1) : 1;
  return w.stats.haste * ult;
}

function weaponDamage(w: World): number {
  const weapon = w.weapons[0]?.def ?? w.character.weapon;
  const levelBonus = 1 + ((w.weapons[0]?.level ?? w.weaponLevel) - 1) * weapon.levelDamageScale;
  return weapon.damage * levelBonus * damageMult(w);
}

function runWeaponDamage(w: World, weapon: RunWeapon): number {
  return weapon.def.damage * (1 + (weapon.level - 1) * weapon.def.levelDamageScale) * damageMult(w);
}

/* ------------------------------------------------------------------ */
/* Spatial grid                                                        */
/* ------------------------------------------------------------------ */

function cellKey(x: number, y: number): number {
  const cx = Math.floor(x / CELL) + 512;
  const cy = Math.floor(y / CELL) + 512;
  return cx * 4096 + cy;
}

function rebuildGrid(w: World) {
  w.grid.clear();
  for (const enemy of w.enemies) {
    if (enemy.dying) continue;
    const key = cellKey(enemy.x, enemy.y);
    const bucket = w.grid.get(key);
    if (bucket) bucket.push(enemy);
    else w.grid.set(key, [enemy]);
  }
}

function forEachNearby(w: World, x: number, y: number, radius: number, fn: (e: EnemyActor) => void) {
  const cells = Math.ceil(radius / CELL);
  const baseX = Math.floor(x / CELL);
  const baseY = Math.floor(y / CELL);
  for (let ix = -cells; ix <= cells; ix += 1) {
    for (let iy = -cells; iy <= cells; iy += 1) {
      const bucket = w.grid.get((baseX + ix + 512) * 4096 + (baseY + iy + 512));
      if (!bucket) continue;
      for (const enemy of bucket) fn(enemy);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Spawning                                                            */
/* ------------------------------------------------------------------ */

function spawnEnemy(w: World, def: EnemyDef, hpMult: number, position?: { x: number; y: number }) {
  if (w.enemies.length >= MAX_ENEMIES) return;

  let x = 0;
  let y = 0;

  if (position) {
    x = position.x;
    y = position.y;
  } else if (w.area.endless) {
    // No arena walls — spawn on a ring around the player, clamped only inside dungeon rooms.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const angle = w.rng() * Math.PI * 2;
      const radius = randRange(w.rng, 310, 430);
      x = w.player.x + Math.cos(angle) * radius;
      y = w.player.y + Math.sin(angle) * radius;
      if (dist2(x, y, w.player.x, w.player.y) > 220 * 220) break;
    }
    if (w.endless?.inDungeon || w.endless?.inBuilding) {
      const e = w.endless;
      const hw = e.dungeonBounds.w / 2 - 30;
      const hh = e.dungeonBounds.h / 2 - 30;
      x = clamp(x, e.dungeonCenterX - hw, e.dungeonCenterX + hw);
      y = clamp(y, e.dungeonCenterY - hh, e.dungeonCenterY + hh);
    }
  } else {
    const halfW = w.bounds.w / 2;
    const halfH = w.bounds.h / 2;
    // Spawn on a ring outside the player's view but inside the arena.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const angle = w.rng() * Math.PI * 2;
      const radius = randRange(w.rng, 310, 430);
      x = clamp(w.player.x + Math.cos(angle) * radius, -halfW + 24, halfW - 24);
      y = clamp(w.player.y + Math.sin(angle) * radius, -halfH + 24, halfH - 24);
      if (dist2(x, y, w.player.x, w.player.y) > 220 * 220) break;
    }
  }

  const hp = def.hp * hpMult;
  const enemy: EnemyActor = {
    uid: uid(w),
    defId: def.id,
    def,
    x,
    y,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    radius: def.radius,
    hp,
    maxHp: hp,
    facing: 1,
    anim: 'walk',
    animStartedAt: w.now,
    hitFlashUntil: 0,
    speed: def.speed,
    damage: def.damage,
    xp: def.xp,
    mass: def.mass,
    contactReadyAt: 0,
    chargeReadyAt: w.now + randRange(w.rng, 800, 2600),
    chargeUntil: 0,
    fireReadyAt: w.now + randRange(w.rng, 600, 2400),
    weave: w.rng() * Math.PI * 2,
    specialReadyAt: w.now + randRange(w.rng, 1400, 3200),
    telegraphUntil: 0,
    specialUntil: 0,
    specialRadius: 0,
    specialKind: null,
    ghostUntil: 0,
    burstUntil: 0,
    baseRadius: def.radius,
    convertedUntil: 0,
    convertedAttackReadyAt: 0,
    dying: false,
    deathAt: 0,
    activeEffects: [],
  };
  w.enemies.push(enemy);

  if (def.family === 'Boss') {
    pushAlert(w, `${def.name} has arrived`);
    w.shake = Math.max(w.shake, 16);
  }
}

function formationPositions(w: World, formation: NonNullable<import('@/game/types').WaveDef['formation']>, count: number) {
  const positions: Array<{ x: number; y: number }> = [];
  const angle = w.rng() * Math.PI * 2;
  const distance = 300;
  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(1, count - 1);
    let x = Math.cos(angle) * distance;
    let y = Math.sin(angle) * distance;
    if (formation === 'ring') {
      const a = angle + (Math.PI * 2 * i) / count;
      x = Math.cos(a) * distance;
      y = Math.sin(a) * distance;
    } else if (formation === 'wedge' || formation === 'pincer') {
      const side = i % 2 === 0 ? -1 : 1;
      const spread = (Math.floor(i / 2) + 1) * 34;
      x += Math.cos(angle + side * 0.55) * spread;
      y += Math.sin(angle + side * 0.55) * spread;
    } else if (formation === 'wall') {
      x += Math.cos(angle + Math.PI / 2) * ((t - 0.5) * 260);
      y += Math.sin(angle + Math.PI / 2) * ((t - 0.5) * 260);
    } else if (formation === 'file' || formation === 'escort') {
      x += Math.cos(angle) * (i * 42);
      y += Math.sin(angle) * (i * 42);
    } else if (formation === 'bait') {
      const bait = i === 0 ? 0.6 : 1;
      x *= bait; y *= bait;
    }
    positions.push({ x: w.player.x + x, y: w.player.y + y });
  }
  return positions;
}

function updateSpawning(w: World, dt: number) {
  const waves = w.area.waves;
  for (let i = 0; i < waves.length; i += 1) {
    const wave = waves[i]!;
    if (w.time < wave.fromSec || w.time > wave.toSec) continue;
    w.spawnCredit[i] = (w.spawnCredit[i] ?? 0) + wave.ratePerSec * dt;
    while ((w.spawnCredit[i] ?? 0) >= 1) {
      w.spawnCredit[i] = (w.spawnCredit[i] ?? 0) - 1;
      const def = getEnemy(wave.enemyId);
      const ids = [wave.enemyId, ...(wave.group ?? [])];
      const total = wave.burst * ids.length;
      const positions = wave.formation ? formationPositions(w, wave.formation, total) : [];
      let positionIndex = 0;
      for (let b = 0; b < wave.burst; b += 1) {
        spawnEnemy(w, def, wave.hpMult ?? 1, positions[positionIndex++]);
        for (const groupEnemyId of wave.group ?? []) {
          spawnEnemy(w, getEnemy(groupEnemyId), wave.hpMult ?? 1, positions[positionIndex++]);
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Damage                                                              */
/* ------------------------------------------------------------------ */

function spawnParticles(w: World, x: number, y: number, color: string, count: number, power = 90) {
  for (let i = 0; i < count; i += 1) {
    const angle = w.rng() * Math.PI * 2;
    const speed = randRange(w.rng, power * 0.3, power);
    w.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: randRange(w.rng, 1.5, 3.5),
      color,
      bornAt: w.now,
      lifeMs: randRange(w.rng, 220, 520),
    });
  }
  if (w.particles.length > 320) w.particles.splice(0, w.particles.length - 320);
}

function spawnFollower(w: World, weapon: WeaponDef, index: number) {
  const spec = weapon.follower;
  if (!spec || w.followers.length >= 18) return;
  const angle = (Math.PI * 2 * index) / Math.max(1, spec.count) + w.rng() * 0.35;
  const radius = spec.radius;
  w.followers.push({
    uid: uid(w),
    x: w.player.x + Math.cos(angle) * (radius + 18),
    y: w.player.y + Math.sin(angle) * (radius + 18),
    vx: 0,
    vy: 0,
    radius: 7,
    baseRadius: 7,
    damage: weapon.damage,
    bornAt: w.now,
    expiresAt: spec.lifetimeMs ? w.now + spec.lifetimeMs : Number.POSITIVE_INFINITY,
    growAfterMs: spec.growAfterMs ?? 0,
    maxRadius: spec.maxRadius ?? 12,
    orbitAngle: angle,
    orbitRadius: radius,
    color: weapon.color ?? w.character.palette.accent,
    weaponId: weapon.id,
  });
}

function spawnFollowers(w: World, weapon: WeaponDef) {
  const spec = weapon.follower;
  if (!spec) return;
  for (let i = 0; i < spec.count; i += 1) spawnFollower(w, weapon, i);
  spawnParticles(w, w.player.x, w.player.y, weapon.color ?? w.character.palette.accent, Math.min(10, spec.count * 2), 70);
}

const MAX_LOKPETS = 4;
const LOKPET_GHOST_AFTER_MS = 60_000;

function lokPetStatusId(pet: LokPetInstance): string | undefined {
  if (pet.element === 'fire') return 'burning';
  if (pet.element === 'freeze') return 'freeze';
  if (pet.element === 'slow') return 'slow';
  return undefined;
}

function lokPetDamage(w: World, pet: LokPetInstance): number {
  const attackMultiplier = pet.attackKind === 'rapid-shot'
    ? 0.55
    : pet.attackKind === 'heavy-shot'
      ? 1.8
      : pet.attackKind === 'explosion'
        ? 0.95
        : 1;
  return Math.max(1, pet.stats.damage * attackMultiplier * damageMult(w));
}

function showLokPetBurst(
  w: World,
  x: number,
  y: number,
  radius: number,
  damage: number,
  color: string,
  statusEffectId?: string,
  explosive = false,
) {
  novaDamage(w, x, y, radius, damage, explosive ? 4 : 1.5, statusEffectId);
  damageBreakable(w, x, y, radius, damage);
  w.effects.push({
    uid: uid(w),
    kind: 'nova',
    x,
    y,
    radius,
    angle: 0,
    spread: 0,
    bornAt: w.now,
    expiresAt: w.now + 380,
    color,
    damage: 0,
    knockback: 0,
    hitUids: new Set(),
    followPlayer: false,
  });
  spawnParticles(w, x, y, color, explosive ? 12 : 6, explosive ? 130 : 80);
  if (explosive) w.shake = Math.max(w.shake, 5);
}

function fireLokPetShot(w: World, pet: LokPetInstance, target: EnemyActor) {
  const dx = target.x - pet.x;
  const dy = target.y - pet.y;
  const distance = Math.hypot(dx, dy) || 1;
  const speed = pet.stats.projectileSpeed;
  const explosion = pet.attackKind === 'explosion';
  w.projectiles.push({
    uid: uid(w),
    x: pet.x,
    y: pet.y,
    vx: (dx / distance) * speed,
    vy: (dy / distance) * speed,
    radius: pet.attackKind === 'heavy-shot' ? 7 : 5,
    damage: lokPetDamage(w, pet),
    knockback: pet.attackKind === 'heavy-shot' ? 4 : 1.5,
    fromPlayer: true,
    expiresAt: w.now + 1900,
    targetUid: target.uid,
    turnRate: pet.attackKind === 'rapid-shot' ? 5.5 : 3.8,
    color: pet.palette.accent,
    trail: [],
    pierce: pet.attackKind === 'heavy-shot' ? 1 : 0,
    hitUids: new Set(),
    obstacleInteraction: 'block',
    statusEffectId: lokPetStatusId(pet),
    explosionRadius: explosion ? pet.stats.explosionRadius : undefined,
    explosionDamage: explosion ? lokPetDamage(w, pet) : undefined,
  });
  spawnParticles(w, pet.x, pet.y, pet.palette.glow, 2, 40);
}

/** Spawn one generated chest companion, replacing the oldest at the mobile-safe cap. */
export function spawnLokPet(w: World, roll: LokPetRoll): LokPetInstance {
  if (w.lokPets.length >= MAX_LOKPETS) {
    const oldest = w.lokPets.shift();
    if (oldest) spawnParticles(w, oldest.x, oldest.y, oldest.palette.glow, 6, 65);
    pushAlert(w, 'LokPet signal rotated');
  }
  const index = w.lokPets.length;
  const orbitAngle = (Math.PI * 2 * index) / MAX_LOKPETS + w.rng() * 0.2;
  const pet: LokPetInstance = {
    ...roll,
    uid: uid(w),
    x: w.player.x + Math.cos(orbitAngle) * (40 + index * 6),
    y: w.player.y + Math.sin(orbitAngle) * (40 + index * 6),
    vx: 0,
    vy: 0,
    orbitAngle,
    orbitRadius: 40 + index * 6,
    bornAt: w.now,
    ghostAt: w.now + LOKPET_GHOST_AFTER_MS,
    expiresAt: w.now + roll.stats.lifetimeMs,
    ghost: false,
    readyAt: w.now + 500,
    nextPulseAt: w.now + 500,
    hp: roll.stats.health,
    maxHp: roll.stats.health,
  };
  w.lokPets.push(pet);
  w.lokPetHistory.push(pet);
  spawnParticles(w, pet.x, pet.y, pet.palette.glow, 10, 85);
  pushAlert(w, `${pet.name} joined the run`);
  return pet;
}

function updateLokPets(w: World, dt: number) {
  for (let i = w.lokPets.length - 1; i >= 0; i -= 1) {
    const pet = w.lokPets[i]!;
    if (w.now >= pet.expiresAt) {
      spawnParticles(w, pet.x, pet.y, pet.palette.glow, 8, 55);
      w.lokPets.splice(i, 1);
      continue;
    }

    if (!pet.ghost && w.now >= pet.ghostAt) {
      pet.ghost = true;
      spawnParticles(w, pet.x, pet.y, '#dbeafe', 14, 95);
      pushAlert(w, `${pet.name} crossed into ghost phase`);
    }

    pet.orbitAngle += dt * (pet.ghost ? 1.35 : 1.8);
    const tx = w.player.x + Math.cos(pet.orbitAngle) * pet.orbitRadius;
    const ty = w.player.y + Math.sin(pet.orbitAngle) * pet.orbitRadius;
    const dx = tx - pet.x;
    const dy = ty - pet.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = pet.stats.moveSpeed * (Math.hypot(dx, dy) > 120 ? 1.35 : 1);
    pet.vx += (dx / len * speed - pet.vx) * Math.min(1, dt * 7);
    pet.vy += (dy / len * speed - pet.vy) * Math.min(1, dt * 7);
    pet.x += pet.vx * dt;
    pet.y += pet.vy * dt;

    const target = nearestEnemy(w, pet.x, pet.y, pet.stats.range);
    if (!target || w.now < pet.readyAt) continue;

    if (pet.attackKind === 'pulse') {
      showLokPetBurst(
        w,
        pet.x,
        pet.y,
        pet.stats.pulseRadius,
        lokPetDamage(w, pet),
        pet.palette.glow,
        lokPetStatusId(pet),
      );
      pet.nextPulseAt = w.now + pet.stats.cooldownMs;
      pet.readyAt = pet.nextPulseAt;
    } else {
      fireLokPetShot(w, pet, target);
      pet.readyAt = w.now + pet.stats.cooldownMs;
    }
  }
}

function updateFollowers(w: World, dt: number) {
  for (let i = w.followers.length - 1; i >= 0; i -= 1) {
    const follower = w.followers[i]!;
    if (w.now >= follower.expiresAt) {
      spawnParticles(w, follower.x, follower.y, follower.color, 4, 45);
      w.followers.splice(i, 1);
      continue;
    }
    const age = w.now - follower.bornAt;
    const growth = follower.growAfterMs > 0 ? clamp((age - follower.growAfterMs) / 900, 0, 1) : 1;
    follower.radius = follower.baseRadius + (follower.maxRadius - follower.baseRadius) * growth;
    follower.orbitAngle += dt * (follower.maxRadius > follower.baseRadius ? 1.7 : 3.2);
    const target = nearestEnemy(w, follower.x, follower.y, 240);
    const tx = target ? target.x : w.player.x + Math.cos(follower.orbitAngle) * follower.orbitRadius;
    const ty = target ? target.y : w.player.y + Math.sin(follower.orbitAngle) * follower.orbitRadius;
    const dx = tx - follower.x;
    const dy = ty - follower.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = target ? 145 : 95;
    follower.vx += (dx / len * speed - follower.vx) * Math.min(1, dt * 7);
    follower.vy += (dy / len * speed - follower.vy) * Math.min(1, dt * 7);
    follower.x += follower.vx * dt;
    follower.y += follower.vy * dt;
    if (target && dist2(target.x, target.y, follower.x, follower.y) <= (target.radius + follower.radius) ** 2) {
      const cooldown = follower.readyAt ?? 0;
      if (w.now >= cooldown) {
        follower.readyAt = w.now + 620;
        damageEnemy(w, target, follower.damage * damageMult(w), 1.4, follower.x, follower.y);
        spawnParticles(w, follower.x, follower.y, follower.color, 3, 55);
      }
    }
  }
}

function damageEnemy(
  w: World,
  enemy: EnemyActor,
  amount: number,
  knockback: number,
  fromX: number,
  fromY: number,
  statusEffectId?: string,
) {
  if (enemy.dying) return;
  if (statusEffectId) applyStatusEffect(w, enemy, statusEffectId);
  const dealt = Math.max(1, Math.round(amount));
  enemy.hp -= dealt;
  enemy.hitFlashUntil = w.now + 90;

  if (knockback > 0) {
    const dx = enemy.x - fromX;
    const dy = enemy.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const impulse = (knockback * 60) / Math.max(0.35, enemy.mass);
    enemy.kx += (dx / len) * impulse;
    enemy.ky += (dy / len) * impulse;
  }

  w.popups.push({
    x: enemy.x + randRange(w.rng, -5, 5),
    y: enemy.y + enemy.radius + 10,
    text: String(dealt),
    color: '#ffe8a3',
    bornAt: w.now,
    vy: 26,
  });
  if (w.popups.length > 40) w.popups.shift();

  if (enemy.hp <= 0) {
    killEnemy(w, enemy);
  }
}

/** Apply a metadata-defined effect, refreshing duration and stacking safely. */
function applyStatusEffect(w: World, enemy: EnemyActor, id: string) {
  const def = STATUS_EFFECTS_BY_ID[id];
  if (!def) return;
  const existing = enemy.activeEffects.find((effect) => effect.id === id);
  if (existing) {
    existing.expiresAt = Math.max(existing.expiresAt, w.now + def.durationMs);
    existing.stacks = Math.min(def.maxStacks, existing.stacks + 1);
    return;
  }
  enemy.activeEffects.push({ id, stacks: 1, appliedAt: w.now, expiresAt: w.now + def.durationMs });
}

function updateStatusEffects(w: World) {
  for (const enemy of w.enemies) {
    for (const effect of enemy.activeEffects) {
      if ((effect.id === 'burning' || effect.id === 'acid') && w.now >= (effect.nextTickAt ?? effect.appliedAt)) {
        const tick = effect.id === 'burning' ? 2 : 1;
        effect.nextTickAt = w.now + 520;
        damageEnemy(w, enemy, tick * effect.stacks, 0, enemy.x, enemy.y);
      }
    }
    enemy.activeEffects = enemy.activeEffects.filter((effect) => effect.expiresAt > w.now);
  }
}

function statusSpeedMultiplier(enemy: EnemyActor): number {
  return enemy.activeEffects.reduce((multiplier, effect) => {
    const def = STATUS_EFFECTS_BY_ID[effect.id];
    return multiplier * (def?.speedMultiplier ?? 1);
  }, 1);
}

function killEnemy(w: World, enemy: EnemyActor) {
  enemy.dying = true;
  // Effects do not linger on a defeated actor or leak into later snapshots.
  enemy.activeEffects = [];
  enemy.deathAt = w.now;
  enemy.anim = 'death';
  enemy.animStartedAt = w.now;
  w.kills += 1;
  w.killsByEnemy[enemy.defId] = (w.killsByEnemy[enemy.defId] ?? 0) + 1;
  spawnParticles(w, enemy.x, enemy.y + enemy.radius, enemy.def.palette.accent, 8, 110);

  // Loot.
  w.pickups.push({
    uid: uid(w),
    kind: 'xp',
    x: enemy.x,
    y: enemy.y,
    vx: randRange(w.rng, -40, 40),
    vy: randRange(w.rng, -40, 40),
    value: enemy.xp,
    bornAt: w.now,
  });

  const roll = w.rng();
  if (roll < 0.045) {
    w.pickups.push({
      uid: uid(w), kind: 'health', x: enemy.x, y: enemy.y,
      vx: randRange(w.rng, -30, 30), vy: randRange(w.rng, -30, 30),
      value: 22, bornAt: w.now,
    });
  } else if (roll < 0.11) {
    w.pickups.push({
      uid: uid(w), kind: 'cred', x: enemy.x, y: enemy.y,
      vx: randRange(w.rng, -30, 30), vy: randRange(w.rng, -30, 30),
      value: Math.max(1, Math.round(enemy.xp / 2)), bornAt: w.now,
    });
  } else if (roll < 0.125) {
    w.pickups.push({
      uid: uid(w), kind: 'sweep', x: enemy.x, y: enemy.y,
      vx: 0, vy: 0, value: 0, bornAt: w.now,
    });
  }

  if (enemy.def.family === 'Boss') {
    if (w.endless?.inDungeon && w.endless.dungeonRoom === 3) {
      w.endless.dungeonBossDefeated = true;
      if (w.endless.dungeonChest) w.endless.dungeonChest.unlocked = true;
      pushAlert(w, 'BOSS DOWN — multi-reward chest unlocked');
    }
    pushAlert(w, `${enemy.def.name} is down`);
    w.shake = Math.max(w.shake, 20);
    for (let i = 0; i < 6; i += 1) {
      w.pickups.push({
        uid: uid(w), kind: 'cred', x: enemy.x + randRange(w.rng, -30, 30),
        y: enemy.y + randRange(w.rng, -30, 30), vx: 0, vy: 0, value: 20, bornAt: w.now,
      });
    }
    // Guaranteed loot box on boss kill.
    spawnLootBox(w, enemy.x, enemy.y);
    pushAlert(w, 'Blue box dropped');
    return;
  }

  // Milestone loot boxes at specific kill counts.
  for (const milestone of LOOT_BOX_MILESTONES) {
    if (w.kills === milestone && !w.lootBoxMilestonesHit.has(milestone)) {
      w.lootBoxMilestonesHit.add(milestone);
      spawnLootBox(w, enemy.x, enemy.y);
      pushAlert(w, `${milestone} down — blue box dropped`);
      break;
    }
  }
}

function damagePlayer(w: World, amount: number, fromX: number, fromY: number) {
  const p = w.player;
  if (w.now < p.invulnUntil) return;
  if (ultActive(w) && w.character.ultimate.effect.invulnerable) return;

  const reduced = amount * (1 - clamp(w.stats.armor, 0, 0.6));
  p.hp -= reduced;
  p.invulnUntil = w.now + 420;
  p.hitFlashUntil = w.now + 160;
  p.anim = 'hurt';
  p.animStartedAt = w.now;
  p.lastDamageAt = w.now;
  w.shake = Math.max(w.shake, 7);

  const dx = p.x - fromX;
  const dy = p.y - fromY;
  const len = Math.hypot(dx, dy) || 1;
  p.kx += (dx / len) * 140;
  p.ky += (dy / len) * 140;

  spawnParticles(w, p.x, p.y + 14, '#ff5f6d', 6, 80);

  if (p.hp <= 0) {
    p.hp = 0;
    w.outcome = 'dead';
    p.anim = 'death';
    p.animStartedAt = w.now;
  }
}

/** Damage every enemy inside a circle once. */
function novaDamage(w: World, x: number, y: number, radius: number, damage: number, knockback: number, statusEffectId?: string) {
  forEachNearby(w, x, y, radius + 40, (enemy) => {
    if (enemy.dying) return;
    const reach = radius + enemy.radius;
    if (dist2(enemy.x, enemy.y, x, y) <= reach * reach) {
      damageEnemy(w, enemy, damage, knockback, x, y, statusEffectId);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Weapons                                                             */
/* ------------------------------------------------------------------ */

function rebuildOrbiters(w: World, runWeapon = w.weapons.find((entry) => entry.def.kind === 'orbit')) {
  if (!runWeapon) return;
  const weapon = runWeapon.def;
  const count = Math.max(1, runWeapon.count);
  const existing = w.orbiters;
  w.orbiters = [];
  const baseAngle = existing[0]?.angle ?? 0;
  for (let i = 0; i < count; i += 1) {
    w.orbiters.push({
      weaponId: weapon.id,
      angle: baseAngle + (Math.PI * 2 * i) / count,
      radius: weapon.range,
      damage: 0,
      cooldowns: new Map(),
    });
  }
}

function nearestEnemy(w: World, x: number, y: number, maxRange: number, exclude?: Set<number>) {
  let best: EnemyActor | null = null;
  let bestDist = maxRange * maxRange;
  for (const enemy of w.enemies) {
    if (enemy.dying) continue;
    if (exclude?.has(enemy.uid)) continue;
    const d = dist2(enemy.x, enemy.y, x, y);
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

function fireWeapon(w: World, runWeapon: RunWeapon) {
  const weapon = runWeapon.def;
  const p = w.player;
  const damage = runWeaponDamage(w, runWeapon);
  const reach = weapon.range * areaMult(w);
  const palette = w.character.palette;

  switch (weapon.kind) {
    case 'follower': {
      spawnFollowers(w, weapon);
      p.anim = 'attack';
      p.animStartedAt = w.now;
      break;
    }
    case 'melee': {
      const target = nearestEnemy(w, p.x, p.y, reach + 120);
      const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.facing > 0 ? 0 : Math.PI;
      p.facing = Math.cos(angle) >= 0 ? 1 : -1;
      w.effects.push({
        uid: uid(w),
        kind: 'slash',
        x: p.x,
        y: p.y,
        radius: reach,
        angle,
        spread: 1.25,
        bornAt: w.now,
        expiresAt: w.now + 170,
        color: palette.accent,
        damage,
        knockback: 3.4,
        hitUids: new Set(),
        followPlayer: true,
      });
      p.anim = 'attack';
      p.animStartedAt = w.now;
      break;
    }

    case 'nova': {
      w.effects.push({
        uid: uid(w),
        kind: 'nova',
        x: p.x,
        y: p.y,
        radius: reach,
        angle: 0,
        spread: 0,
        bornAt: w.now,
        expiresAt: w.now + 280,
        color: palette.accent,
        damage,
        knockback: 5.5,
        hitUids: new Set(),
        followPlayer: false,
      });
      novaDamage(w, p.x, p.y, reach, damage, 5.5, weapon.statusEffectId);
      damageBreakable(w, p.x, p.y, reach, damage);
      p.anim = 'attack';
      p.animStartedAt = w.now;
      w.shake = Math.max(w.shake, 3);
      break;
    }

    case 'aura': {
      // The aura is permanent; each activation is a damage tick.
      novaDamage(w, p.x, p.y, reach, damage, 0.6);
      break;
    }

    case 'wave': {
      const count = Math.max(1, runWeapon.count);
      const target = nearestEnemy(w, p.x, p.y, reach + 100);
      const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : (p.facing > 0 ? 0 : Math.PI);
      for (let i = 0; i < count; i += 1) {
        w.effects.push({
          uid: uid(w), kind: 'wave', x: p.x, y: p.y, radius: reach * (0.55 + i * 0.22),
          angle, spread: 0.38, bornAt: w.now + i * 120, expiresAt: w.now + 330 + i * 120,
          color: weapon.color ?? palette.accent, damage, knockback: 4.5, hitUids: new Set(), followPlayer: false,
        });
      }
      p.anim = 'attack'; p.animStartedAt = w.now;
      break;
    }

    case 'laser': {
      const target = nearestEnemy(w, p.x, p.y, reach);
      const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : (p.facing > 0 ? 0 : Math.PI);
      w.effects.push({
        uid: uid(w), kind: 'laser', x: p.x, y: p.y, radius: reach, angle, spread: 0.055,
        bornAt: w.now, expiresAt: w.now + 260, color: weapon.color ?? palette.accent,
        damage, knockback: 2, hitUids: new Set(), followPlayer: false,
      });
      p.anim = 'attack'; p.animStartedAt = w.now;
      break;
    }

    case 'hazard': {
      w.effects.push({
        uid: uid(w), kind: 'hazard', x: p.x, y: p.y, radius: reach, angle: 0, spread: Math.PI * 2,
        bornAt: w.now, expiresAt: w.now + (weapon.durationMs ?? 5000), color: weapon.color ?? palette.accent,
        damage, knockback: 0, hitUids: new Set(), followPlayer: false, nextTickAt: w.now,
        hurtsPlayer: true,
      });
      pushAlert(w, weapon.id === 'acid-garden' ? 'ACID GARDEN' : 'FIRE HAZARD');
      break;
    }

    case 'teleport': {
      const target = nearestEnemy(w, p.x, p.y, reach);
      if (target) {
        const dx = target.x - p.x; const dy = target.y - p.y; const len = Math.hypot(dx, dy) || 1;
        p.x = target.x - (dx / len) * (p.radius + target.radius + 8);
        p.y = target.y - (dy / len) * (p.radius + target.radius + 8);
        novaDamage(w, p.x, p.y, 42, damage, 3.5, weapon.statusEffectId);
        w.effects.push({ uid: uid(w), kind: 'teleport', x: p.x, y: p.y, radius: 42, angle: 0, spread: 0,
          bornAt: w.now, expiresAt: w.now + 420, color: weapon.color ?? palette.accent, damage: 0, knockback: 0,
          hitUids: new Set(), followPlayer: false });
      }
      p.anim = 'attack'; p.animStartedAt = w.now;
      break;
    }

    case 'convert': {
      if (weapon.follower) spawnFollowers(w, weapon);
      const target = nearestEnemy(w, p.x, p.y, reach);
      if (target) {
        // Conversion is represented by a brief ally flash and a harmless stun;
        // enemy AI remains data-driven while the crowd-control feedback is visible.
        applyStatusEffect(w, target, 'slow');
        target.convertedUntil = w.now + (weapon.durationMs ?? 5000);
        target.convertedAttackReadyAt = w.now;
        target.activeEffects.push({ id: 'freeze', stacks: 1, appliedAt: w.now, expiresAt: target.convertedUntil });
        damageEnemy(w, target, damage, 0, p.x, p.y, weapon.statusEffectId);
        pushAlert(w, 'TEMPORARY ALLY');
      }
      break;
    }

    case 'punch': {
      const target = nearestEnemy(w, p.x, p.y, reach);
      const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : (p.facing > 0 ? 0 : Math.PI);
      w.effects.push({ uid: uid(w), kind: 'slash', x: p.x, y: p.y, radius: reach, angle, spread: 0.7,
        bornAt: w.now, expiresAt: w.now + (weapon.durationMs ?? 420), color: weapon.color ?? palette.accent,
        damage, knockback: 12, hitUids: new Set(), followPlayer: false });
      p.anim = 'attack'; p.animStartedAt = w.now; w.shake = Math.max(w.shake, 12);
      pushAlert(w, 'POW!');
      break;
    }

    case 'homing':
    case 'projectile': {
      const used = new Set<number>();
      const shots = Math.max(1, runWeapon.count);
      for (let i = 0; i < shots; i += 1) {
        const target = nearestEnemy(w, p.x, p.y, weapon.range, used);
        if (target) used.add(target.uid);
        const angle = target
          ? Math.atan2(target.y - p.y, target.x - p.x)
          : (p.facing > 0 ? 0 : Math.PI) + randRange(w.rng, -0.4, 0.4);
        const speed = weapon.speed ?? 200;
        w.projectiles.push({
          uid: uid(w),
          x: p.x,
          y: p.y + 10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 6,
          damage,
          knockback: 1.8,
          fromPlayer: true,
          expiresAt: w.now + (weapon.lifetimeMs ?? 2000),
          targetUid: weapon.kind === 'homing' ? (target?.uid ?? null) : null,
          turnRate: weapon.kind === 'homing' ? 5.2 : 0,
          color: palette.accent,
          trail: [],
          pierce: 0,
          hitUids: new Set(),
          obstacleUids: new Set(),
          obstacleInteraction: weapon.obstacleInteraction ?? 'block',
          statusEffectId: weapon.statusEffectId,
        });
      }
      p.anim = 'attack';
      p.animStartedAt = w.now;
      break;
    }

    case 'orbit':
      // Handled continuously in updateOrbiters.
      break;
    case 'sweep': {
      const fromLeft = w.rng() > 0.5;
      const x = w.player.x + (fromLeft ? -620 : 620);
      const y = w.player.y + randRange(w.rng, -reach * 0.55, reach * 0.55);
      const vx = fromLeft ? (weapon.speed ?? 480) : -(weapon.speed ?? 480);
      w.projectiles.push({
        uid: uid(w), x, y, vx, vy: 0, radius: 24, damage, knockback: 7,
        fromPlayer: true, expiresAt: w.now + (weapon.lifetimeMs ?? 1200), targetUid: null,
        turnRate: 0, color: weapon.color ?? palette.accent, trail: [], pierce: 999,
        hitUids: new Set(),
         obstacleUids: new Set(),
      });
      pushAlert(w, 'The Bus');
      w.shake = Math.max(w.shake, 5);
      break;
    }
  }
}

function updateOrbiters(w: World, dt: number) {
  const p = w.player;
  const orbitWeapons = w.weapons.filter((entry) => entry.def.kind === 'orbit');
  for (const runWeapon of orbitWeapons) {
    const weapon = runWeapon.def;
    const damage = runWeaponDamage(w, runWeapon);
    const radius = weapon.range * areaMult(w);
    const spin = (weapon.speed ?? 2.5) / cooldownMult(w);
    const orbs = w.orbiters.filter((orb) => orb.weaponId === weapon.id);
    for (const orb of orbs) {
    orb.angle += spin * dt;
    orb.radius = radius;
    const ox = p.x + Math.cos(orb.angle) * radius;
    const oy = p.y + Math.sin(orb.angle) * radius;
    forEachNearby(w, ox, oy, 22, (enemy) => {
      if (enemy.dying) return;
      const ready = orb.cooldowns.get(enemy.uid) ?? 0;
      if (w.now < ready) return;
      const reach = 11 + enemy.radius;
      if (dist2(enemy.x, enemy.y, ox, oy) <= reach * reach) {
        orb.cooldowns.set(enemy.uid, w.now + 420);
        damageEnemy(w, enemy, damage, 2.2, ox, oy);
      }
    });
    }
  }
}

export function activateUltimate(w: World): boolean {
  if (w.now < w.ultReadyAt || w.outcome !== 'running') return false;
  const ult = w.character.ultimate;
  w.ultActiveUntil = w.now + ult.durationMs;
  w.ultReadyAt = w.now + ult.cooldownMs * w.ultCooldownMult;

  if (ult.effect.novaDamage && ult.effect.novaRadius) {
    const radius = ult.effect.novaRadius * areaMult(w);
    novaDamage(w, w.player.x, w.player.y, radius, ult.effect.novaDamage * w.stats.power, 8);
    w.effects.push({
      uid: uid(w),
      kind: 'ring',
      x: w.player.x,
      y: w.player.y,
      radius,
      angle: 0,
      spread: 0,
      bornAt: w.now,
      expiresAt: w.now + 520,
      color: w.character.palette.glow,
      damage: 0,
      knockback: 0,
      hitUids: new Set(),
      followPlayer: false,
    });
  }
  w.shake = Math.max(w.shake, 12);
  pushAlert(w, ult.name);
  return true;
}

/* ------------------------------------------------------------------ */
/* Upgrades                                                            */
/* ------------------------------------------------------------------ */

export function rollUpgradeChoices(w: World, count = 3): UpgradeDef[] {
  const pool: UpgradeDef[] = UPGRADES.filter((u) => {
    if (u.weaponKinds && !w.weapons.some((weapon) => u.weaponKinds!.includes(weapon.def.kind))) return false;
    return (w.upgradeStacks[u.id] ?? 0) < u.maxStacks;
  }).map((u) => ({ ...u, cardKind: 'upgrade' as const }));
  for (const weapon of w.weapons) {
    if (weapon.level < 8) {
      pool.push({
        id: `level-${weapon.def.id}`, name: `${weapon.def.name} +`, description: `Level up ${weapon.def.name}. More damage per hit.`,
        weight: 11, maxStacks: 7, effects: [], cardKind: 'weapon', weaponId: weapon.def.id,
      });
    }
  }
  if (w.weapons.length < 6) {
    for (const weapon of Object.values(WEAPONS_BY_ID)) {
      if (!w.weapons.some((entry) => entry.def.id === weapon.id)) {
        pool.push({ id: `weapon-${weapon.id}`, name: weapon.name, description: weapon.description, weight: 5, maxStacks: 1, effects: [], cardKind: 'weapon', weaponId: weapon.id });
      }
    }
  }
  for (const passive of PASSIVES) {
    const owned = w.passives.find((entry) => entry.def.id === passive.id);
    if ((!owned && w.passives.length < 6) || (owned && owned.stacks < passive.maxStacks)) {
      pool.push({ id: `passive-${passive.id}`, name: passive.name, description: passive.description, weight: passive.weight, maxStacks: passive.maxStacks, effects: passive.effects, cardKind: 'passive', passiveId: passive.id });
    }
  }
  for (const evolution of EVOLUTIONS) {
    const weapon = w.weapons.find((entry) => entry.def.id === evolution.baseWeaponId);
    const passive = w.passives.find((entry) => entry.def.id === evolution.requiredPassiveId);
    if (weapon && passive && weapon.def.id !== evolution.id) {
      pool.push({ id: `evolution-${evolution.id}`, name: evolution.name, description: evolution.description, weight: 14, maxStacks: 1, effects: [], cardKind: 'evolution', evolutionId: evolution.id });
    }
  }

  const picks: UpgradeDef[] = [];
  const available = [...pool];
  while (picks.length < count && available.length > 0) {
    const totalWeight = available.reduce((sum, u) => sum + u.weight, 0);
    let roll = w.rng() * totalWeight;
    let index = 0;
    for (let i = 0; i < available.length; i += 1) {
      roll -= available[i]!.weight;
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picks.push(available[index]!);
    available.splice(index, 1);
  }
  return picks;
}

export function applyUpgrade(w: World, upgrade: UpgradeDef) {
  w.upgradeStacks[upgrade.id] = (w.upgradeStacks[upgrade.id] ?? 0) + 1;

  if (upgrade.cardKind === 'weapon' && upgrade.weaponId) {
    const existing = w.weapons.find((weapon) => weapon.def.id === upgrade.weaponId);
    if (existing) {
      existing.level = Math.min(8, existing.level + 1);
      if (existing.def.kind === 'orbit') rebuildOrbiters(w);
    } else {
      const def = WEAPONS_BY_ID[upgrade.weaponId];
      if (def && w.weapons.length < 6) {
        const runWeapon = { def, level: 1, count: def.count ?? 1, readyAt: w.now + 500 };
        w.weapons.push(runWeapon);
        if (def.kind === 'orbit') rebuildOrbiters(w, runWeapon);
        pushAlert(w, `${def.name} equipped`);
      }
    }
  }
  if (upgrade.cardKind === 'passive' && upgrade.passiveId) {
    const def = PASSIVES_BY_ID[upgrade.passiveId];
    if (def) {
      const existing = w.passives.find((passive) => passive.def.id === def.id);
      if (existing) existing.stacks += 1;
      else if (w.passives.length < 6) w.passives.push({ def, stacks: 1 });
      for (const effect of def.effects) applyEffect(w, effect);
      pushAlert(w, `${def.name} picked up`);
    }
  }
  if (upgrade.cardKind === 'evolution' && upgrade.evolutionId) {
    const evolution = EVOLUTIONS_BY_ID[upgrade.evolutionId];
    const weapon = evolution && w.weapons.find((entry) => entry.def.id === evolution.baseWeaponId);
    if (evolution && weapon) {
      weapon.def = evolution.result;
      weapon.level = Math.min(8, weapon.level + 1);
      if (weapon.def.kind === 'orbit') rebuildOrbiters(w, weapon);
      pushAlert(w, `${evolution.name} evolved`);
    }
  }

  for (const effect of upgrade.effects) {
    applyEffect(w, effect);
  }
  w.pendingLevelUps = Math.max(0, w.pendingLevelUps - 1);
}

function applyLootPrize(w: World, prize: LootPrizeDef) {
  switch (prize.kind) {
    case 'cred':
      w.cred += prize.amount ?? 0;
      w.popups.push({
        x: w.player.x, y: w.player.y + 30, text: prize.label,
        color: '#ffd166', bornAt: w.now, vy: 28,
      });
      break;
    case 'token':
      w.lootTokensGained += prize.amount ?? 1;
      w.popups.push({
        x: w.player.x, y: w.player.y + 30, text: prize.label,
        color: '#f59e0b', bornAt: w.now, vy: 28,
      });
      break;
    case 'heal':
      w.player.hp = clamp(w.player.hp + (prize.amount ?? 0), 0, w.player.maxHp);
      w.popups.push({
        x: w.player.x, y: w.player.y + 30, text: prize.label,
        color: '#7dffb2', bornAt: w.now, vy: 28,
      });
      break;
    case 'stat': {
      if (prize.stat && prize.add !== undefined) {
        const current = w.stats[prize.stat];
        w.stats[prize.stat] = current + prize.add;
        if (prize.stat === 'maxHp') {
          w.player.maxHp = w.stats.maxHp;
          w.player.hp = clamp(w.player.hp, 1, w.player.maxHp);
        }
      }
      w.popups.push({
        x: w.player.x, y: w.player.y + 30, text: prize.label,
        color: '#6ee7ff', bornAt: w.now, vy: 28,
      });
      break;
    }
    case 'weapon': {
      // Pick a weapon the player doesn't own yet and add it.
      const unowned = Object.values(WEAPONS_BY_ID).filter(
        (wep) => !w.weapons.some((entry) => entry.def.id === wep.id),
      );
      if (unowned.length > 0 && w.weapons.length < 6) {
        const def = unowned[Math.floor(w.rng() * unowned.length)]!;
        const runWeapon = { def, level: 1, count: def.count ?? 1, readyAt: w.now + 500 };
        w.weapons.push(runWeapon);
        if (def.kind === 'orbit') rebuildOrbiters(w, runWeapon);
        pushAlert(w, `${def.name} unlocked`);
        w.popups.push({
          x: w.player.x, y: w.player.y + 30, text: `+ ${def.name}`,
          color: '#a78bfa', bornAt: w.now, vy: 28,
        });
      } else {
        // Arsenal is full — give cred instead.
        w.cred += 80;
        w.popups.push({
          x: w.player.x, y: w.player.y + 30, text: '+80 Cred',
          color: '#ffd166', bornAt: w.now, vy: 28,
        });
      }
      break;
    }
    case 'lokpet': {
      const pet = prize.lokPet ?? rollLokPet(w.rng);
      spawnLokPet(w, pet);
      w.popups.push({
        x: w.player.x,
        y: w.player.y + 30,
        text: `+ ${pet.name}`,
        color: LOKPET_ELEMENT_COLORS[pet.element],
        bornAt: w.now,
        vy: 28,
      });
      break;
    }
  }
}

function spawnLootBox(w: World, x: number, y: number) {
  w.pickups.push({
    uid: uid(w), kind: 'loot-box', x, y,
    vx: randRange(w.rng, -20, 20), vy: randRange(w.rng, -20, 20),
    value: 0, bornAt: w.now,
  });
}

function applyEffect(w: World, effect: UpgradeDef['effects'][number]) {
  switch (effect.kind) {
      case 'stat': {
        const current = w.stats[effect.stat];
        let next = current;
        if (effect.add !== undefined) next += effect.add;
        if (effect.mult !== undefined) next *= effect.mult;
        w.stats[effect.stat] = next;
        if (effect.stat === 'maxHp') {
          w.player.maxHp = w.stats.maxHp;
          w.player.hp = clamp(w.player.hp, 1, w.player.maxHp);
        }
        if (effect.stat === 'armor') {
          w.stats.armor = clamp(w.stats.armor, 0, 0.6);
        }
        break;
      }
      case 'weaponLevel':
        for (const weapon of w.weapons) weapon.level = Math.min(8, weapon.level + effect.amount);
        w.weaponLevel = w.weapons[0]?.level ?? w.weaponLevel;
        break;
      case 'weaponCount':
        for (const weapon of w.weapons) {
          if (weapon.def.kind === 'orbit' || weapon.def.kind === 'projectile' || weapon.def.kind === 'homing') weapon.count += effect.amount;
        }
        w.weaponCount += effect.amount;
        rebuildOrbiters(w);
        break;
      case 'heal':
        w.player.hp = clamp(w.player.hp + effect.amount, 0, w.player.maxHp);
        w.popups.push({
          x: w.player.x, y: w.player.y + 26, text: `+${effect.amount}`,
          color: '#7dffb2', bornAt: w.now, vy: 30,
        });
        break;
      case 'ultimateCooldown':
        w.ultCooldownMult *= effect.mult;
        break;
  }
}

function gainXp(w: World, amount: number) {
  w.xp += amount;
  while (w.xp >= w.xpToNext) {
    w.xp -= w.xpToNext;
    w.level += 1;
    w.xpToNext = xpForLevel(w.level);
    w.pendingLevelUps += 1;
  }
}

/* ------------------------------------------------------------------ */
/* Movement                                                            */
/* ------------------------------------------------------------------ */

function clampToArena(w: World, actor: Actor) {
  if (w.area.endless) {
    if (w.endless?.inDungeon || w.endless?.inBuilding) {
      const e = w.endless;
      const hw = e.dungeonBounds.w / 2;
      const hh = e.dungeonBounds.h / 2;
      actor.x = clamp(actor.x, e.dungeonCenterX - hw + actor.radius, e.dungeonCenterX + hw - actor.radius);
      actor.y = clamp(actor.y, e.dungeonCenterY - hh + actor.radius, e.dungeonCenterY + hh - actor.radius);
    }
    // On the open streets: no walls at all.
    return;
  }
  const halfW = w.bounds.w / 2;
  const halfH = w.bounds.h / 2;
  actor.x = clamp(actor.x, -halfW + actor.radius, halfW - actor.radius);
  actor.y = clamp(actor.y, -halfH + actor.radius, halfH - actor.radius);
}

function collideObstacles(w: World, actor: Actor) {
  for (const box of w.obstacles) {
    // Cheap reject before the precise test.
    if (Math.abs(actor.x - box.x) > box.w / 2 + actor.radius + 4) continue;
    if (Math.abs(actor.y - box.y) > box.h / 2 + actor.radius + 4) continue;
    resolveCircleBox(actor, actor.radius, box);
  }
}

function damageBreakable(w: World, x: number, y: number, radius: number, amount: number) {
  for (const b of w.breakables) {
    if (b.broken || Math.abs(x - b.x) > b.w / 2 + radius || Math.abs(y - b.y) > b.h / 2 + radius) continue;
    b.hp -= Math.max(1, amount);
    if (b.hp > 0) {
      if (b.hp <= b.maxHp * 0.5) spawnParticles(w, b.x, b.y, b.kind === 'barrel' ? '#ff9f43' : '#ffe08a', 2, 35);
      continue;
    }
    b.broken = true;
    b.brokenAt = w.now;
    const count = b.kind === 'barrel' ? 16 : b.kind === 'neon-sign' ? 6 : 10;
    spawnParticles(w, b.x, b.y, b.kind === 'neon-sign' ? '#4de1ff' : b.kind === 'barrel' ? '#f0760a' : '#c99055', count, 130);
    if (b.kind === 'barrel') {
      forEachNearby(w, b.x, b.y, 100, (enemy) => {
        if (dist2(enemy.x, enemy.y, b.x, b.y) <= (80 + enemy.radius) ** 2) {
          damageEnemy(w, enemy, 18 * w.stats.power, 3, b.x, b.y);
        }
      });
    }
    if (b.kind === 'crate' || b.kind === 'crate-breakable' || b.kind === 'barrel') {
      w.pickups.push({ uid: uid(w), kind: 'xp', x: b.x, y: b.y, vx: 0, vy: 0, value: b.kind === 'barrel' ? 12 : 6, bornAt: w.now });
      if (b.kind === 'crate-breakable' && w.rng() > 0.45) {
        w.pickups.push({
          uid: uid(w),
          kind: w.rng() > 0.5 ? 'cred' : 'health',
          x: b.x + randRange(w.rng, -10, 10),
          y: b.y + randRange(w.rng, -10, 10),
          vx: 0,
          vy: 0,
          value: w.rng() > 0.5 ? 8 : 10,
          bornAt: w.now,
        });
      }
    }
    if (b.kind === 'street-lamp') {
      b.hazardUntil = w.now + 5200;
      b.hazardNextTickAt = w.now;
      b.fallAngle = (w.rng() > 0.5 ? 1 : -1) * (Math.PI / 2);
      pushAlert(w, 'LIVE WIRE — KEEP CLEAR');
    }
  }
  w.obstacles = w.breakables.filter((b) => !b.broken).map(({ x: bx, y: by, w: bw, h: bh }) => ({ x: bx, y: by, w: bw, h: bh }));
}

/** Resolve a projectile against the two combat-specific obstacle types. */
function collideProjectileObstacle(w: World, proj: Projectile): boolean {
  for (const b of w.breakables) {
    if (b.broken || !PROJECTILE_BLOCKING_KINDS.has(b.kind)) continue;
    if (proj.obstacleUids?.has(b.uid)) continue;
    if (Math.abs(proj.x - b.x) > b.w / 2 + proj.radius || Math.abs(proj.y - b.y) > b.h / 2 + proj.radius) continue;

    const dx = proj.x - b.x;
    const dy = proj.y - b.y;
    const horizontal = Math.abs(dx) / (b.w / 2 + proj.radius);
    const vertical = Math.abs(dy) / (b.h / 2 + proj.radius);
    const hitX = horizontal > vertical;
    const nx = hitX ? (dx < 0 ? -1 : 1) : 0;
    const ny = hitX ? 0 : (dy < 0 ? -1 : 1);
    if (b.kind === 'reflective-surface' && proj.fromPlayer && proj.obstacleInteraction === 'reflect') {
      (proj.obstacleUids ??= new Set()).add(b.uid);
      if (hitX) proj.vx *= -1;
      else proj.vy *= -1;
      // Move clear of the face so a reflected shot cannot immediately collide again.
      proj.x = b.x + nx * (b.w / 2 + proj.radius + 1);
      proj.y = b.y + ny * (b.h / 2 + proj.radius + 1);
      spawnParticles(w, proj.x, proj.y, '#d8b4fe', 5, 70);
      pushAlert(w, 'Ricochet');
      continue;
    }
    if (b.kind === 'reflective-surface') {
      spawnParticles(w, proj.x, proj.y, '#d8b4fe', 3, 45);
      return true;
    }
    if (b.kind === 'cover' || b.kind === 'crate-breakable' || b.kind === 'crate' || b.kind === 'barrel' || b.kind === 'street-lamp') {
      damageBreakable(w, proj.x, proj.y, proj.radius, proj.damage * 0.35);
      spawnParticles(w, proj.x, proj.y, b.kind === 'barrel' ? '#f0760a' : '#fbbf24', 4, 55);
      return true;
    }
  }
  return false;
}

function updateBreakables(w: World, dt: number) {
  for (const b of w.breakables) {
    if (b.broken) {
      if (b.kind === 'street-lamp' && b.hazardUntil && w.now < b.hazardUntil && w.now >= (b.hazardNextTickAt ?? 0)) {
        b.hazardNextTickAt = w.now + 260;
        const radius = 92;
        if (dist2(w.player.x, w.player.y, b.x, b.y) <= (radius + w.player.radius) ** 2) {
          damagePlayer(w, 9, b.x, b.y);
        }
        for (const enemy of w.enemies) {
          if (!enemy.dying && dist2(enemy.x, enemy.y, b.x, b.y) <= (radius + enemy.radius) ** 2) {
            damageEnemy(w, enemy, 14 * w.stats.power, 0.5, b.x, b.y);
          }
        }
      }
      continue;
    }
    if (b.vx || b.vy) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.vx *= Math.pow(0.88, dt * 60); b.vy *= Math.pow(0.88, dt * 60);
      collideObstacles(w, { ...w.player, x: b.x, y: b.y, radius: Math.max(b.w, b.h) / 2 });
    }
  }
  // Project live positions to the collision list, preserving all props.
  w.obstacles = w.breakables.filter((b) => !b.broken).map(({ x, y, w: bw, h: bh }) => ({ x, y, w: bw, h: bh }));
}

function applyKnockback(actor: Actor, dt: number) {
  actor.x += actor.kx * dt;
  actor.y += actor.ky * dt;
  const decay = Math.pow(0.0009, dt);
  actor.kx *= decay;
  actor.ky *= decay;
  if (Math.abs(actor.kx) < 1) actor.kx = 0;
  if (Math.abs(actor.ky) < 1) actor.ky = 0;
}

function updatePlayer(w: World, dt: number, moveX: number, moveY: number) {
  const p = w.player;
  const speed = w.stats.speed * speedMult(w);
  const len = Math.hypot(moveX, moveY);
  const nx = len > 1 ? moveX / len : moveX;
  const ny = len > 1 ? moveY / len : moveY;

  p.vx = nx * speed;
  p.vy = ny * speed;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  applyKnockback(p, dt);

  if (Math.abs(nx) > 0.05) p.facing = nx > 0 ? 1 : -1;

  collideObstacles(w, p);
  clampToArena(w, p);
  for (const b of w.breakables) {
    if (b.broken || !PUSHABLE_KINDS.has(b.kind)) continue;
    if (Math.abs(p.x - b.x) < b.w / 2 + p.radius && Math.abs(p.y - b.y) < b.h / 2 + p.radius) {
      b.contacts += 1;
      if (b.kind === 'car-wreck' && b.contacts < 3) continue;
      const dx = b.x - p.x; const dy = b.y - p.y; const len = Math.hypot(dx, dy) || 1;
       const force = b.kind === 'car-wreck' ? 24 : b.kind === 'cover' ? 55 : 48;
      b.vx += (dx / len) * force / (b.kind === 'car-wreck' ? 3 : 1);
      b.vy += (dy / len) * force / (b.kind === 'car-wreck' ? 3 : 1);
    }
  }

  // Animation state resolution: attack and hurt clips play out first.
  const elapsed = w.now - p.animStartedAt;
  if (p.anim === 'death') return;
  if (p.anim === 'attack' && elapsed < 280) return;
  if (p.anim === 'hurt' && elapsed < 160) return;
  const moving = len > 0.08;
  const nextAnim: AnimState = moving ? 'walk' : 'idle';
  if (p.anim !== nextAnim) {
    p.anim = nextAnim;
    p.animStartedAt = w.now;
  }
}

function updateEnemies(w: World, dt: number) {
  const p = w.player;

  for (const enemy of w.enemies) {
    if (enemy.dying) continue;

    if (enemy.convertedUntil > w.now) {
      const allyTarget = nearestEnemy(w, enemy.x, enemy.y, 180, new Set([enemy.uid]));
      if (allyTarget && w.now >= enemy.convertedAttackReadyAt) {
        enemy.convertedAttackReadyAt = w.now + 650;
        damageEnemy(w, allyTarget, Math.max(1, Math.round(enemy.damage * 0.8)), 2, enemy.x, enemy.y);
        const attackAngle = Math.atan2(allyTarget.y - enemy.y, allyTarget.x - enemy.x);
        const attackDistance = Math.hypot(allyTarget.x - enemy.x, allyTarget.y - enemy.y);
        w.effects.push({
          uid: uid(w), kind: 'laser', x: enemy.x, y: enemy.y, radius: attackDistance, angle: attackAngle, spread: 0,
          bornAt: w.now, expiresAt: w.now + 180, color: '#65f6d1', damage: 0, knockback: 0,
          hitUids: new Set(), followPlayer: false,
        });
      }
      continue;
    }

    const traits = enemy.def.traits;
    if (traits?.teleportMs && w.now >= enemy.specialReadyAt) {
      const side = w.rng() > 0.5 ? 1 : -1;
      enemy.x = p.x - (p.x - enemy.x) * 0.35 + side * 180;
      enemy.y = p.y - (p.y - enemy.y) * 0.35 - side * 120;
      enemy.specialReadyAt = w.now + traits.teleportMs;
      spawnParticles(w, enemy.x, enemy.y, enemy.def.palette.accent, 8, 80);
    }
    if (traits?.ghostMs && w.now >= enemy.specialReadyAt) {
      enemy.ghostUntil = w.now + traits.ghostMs;
      enemy.specialReadyAt = w.now + traits.ghostMs + 1800;
      spawnParticles(w, enemy.x, enemy.y, enemy.def.palette.glow, 5, 45);
    }
    if (traits?.shiftMs && w.now >= enemy.fireReadyAt) {
      enemy.fireReadyAt = w.now + traits.shiftMs;
      enemy.radius = enemy.radius === enemy.baseRadius
        ? enemy.baseRadius * (traits.shiftScale ?? 1.45)
        : enemy.baseRadius;
      spawnParticles(w, enemy.x, enemy.y, enemy.def.palette.accent, 4, 35);
    }

    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const dirX = dx / distance;
    const dirY = dy / distance;
    enemy.facing = dirX >= 0 ? 1 : -1;

    let speed = enemy.speed * statusSpeedMultiplier(enemy);
    if (w.now < enemy.burstUntil) speed *= traits?.burstSpeed ?? 1;
    if (traits?.burstSpeed && w.now >= enemy.burstUntil && w.now >= enemy.chargeReadyAt) {
      enemy.burstUntil = w.now + 360;
      enemy.chargeReadyAt = w.now + 2200;
    }

    switch (enemy.def.behavior) {
      case 'charger': {
        if (w.now < enemy.chargeUntil) {
          speed = enemy.speed * 2.6;
        } else if (w.now >= enemy.chargeReadyAt && distance < 260) {
          enemy.chargeUntil = w.now + 520;
          enemy.chargeReadyAt = w.now + randRange(w.rng, 2200, 3800);
          enemy.anim = 'attack';
          enemy.animStartedAt = w.now;
        }
        break;
      }
      case 'spitter': {
        // Hold at range and lob projectiles.
        if (distance < 190) speed = -enemy.speed * 0.55;
        else if (distance < 260) speed = 0;
        if (w.now >= enemy.fireReadyAt && distance < 420) {
          const ranged = enemy.def.ranged;
          if (ranged) {
            enemy.fireReadyAt = w.now + ranged.cooldownMs * randRange(w.rng, 0.85, 1.2);
            w.projectiles.push({
              uid: uid(w),
              x: enemy.x,
              y: enemy.y + 8,
              vx: dirX * ranged.projectileSpeed,
              vy: dirY * ranged.projectileSpeed,
              radius: 7,
              damage: ranged.damage,
              knockback: 0,
              fromPlayer: false,
              expiresAt: w.now + 3200,
              targetUid: null,
              turnRate: 0,
              color: enemy.def.palette.accent,
              trail: [],
              pierce: 0,
              hitUids: new Set(),
            });
            enemy.anim = 'attack';
            enemy.animStartedAt = w.now;
          }
        }
        break;
      }
      case 'drifter': {
        enemy.weave += dt * 3.4;
        break;
      }
      case 'flanker': {
        enemy.weave += dt * 2.8;
        break;
      }
      case 'prowler': {
        enemy.weave += dt * 4.6;
        // The prowler briefly cuts across the player's path instead of
        // taking the shortest route every time.
        if (w.now >= enemy.fireReadyAt) {
          enemy.fireReadyAt = w.now + randRange(w.rng, 1700, 2800);
          enemy.kx += -dirY * 75;
          enemy.ky += dirX * 75;
        }
        break;
      }
      case 'lookout': {
        enemy.weave += dt * 1.8;
        if (w.now >= enemy.fireReadyAt && distance < 480) {
          const ranged = enemy.def.ranged;
          if (ranged) {
            enemy.fireReadyAt = w.now + ranged.cooldownMs * randRange(w.rng, 0.85, 1.15);
            w.projectiles.push({
              uid: uid(w), x: enemy.x, y: enemy.y + 8,
              vx: dirX * ranged.projectileSpeed, vy: dirY * ranged.projectileSpeed,
              radius: 7, damage: ranged.damage, knockback: 0, fromPlayer: false,
              expiresAt: w.now + 3200, targetUid: null, turnRate: 0,
              color: enemy.def.palette.accent, trail: [], pierce: 0, hitUids: new Set(),
            });
            enemy.anim = 'attack';
            enemy.animStartedAt = w.now;
            enemy.kx -= dirX * 42;
            enemy.ky -= dirY * 42;
          }
        }
        break;
      }
      case 'shockwave':
      case 'current': {
        const radius = enemy.def.behavior === 'current' ? 142 : 118;
        enemy.specialRadius = radius;
        if (enemy.telegraphUntil === 0 && w.now >= enemy.specialReadyAt && distance < radius + 100) {
          enemy.telegraphUntil = w.now + 680;
          enemy.specialKind = enemy.def.behavior === 'current' ? 'current' : 'shockwave';
          enemy.anim = 'attack';
          enemy.animStartedAt = w.now;
          pushAlert(w, enemy.def.behavior === 'current' ? 'RIVER CURRENT' : 'BASS DROP');
        }
        if (enemy.telegraphUntil > 0 && w.now >= enemy.telegraphUntil) {
          enemy.telegraphUntil = 0;
          enemy.specialUntil = w.now + 360;
          enemy.specialReadyAt = w.now + randRange(w.rng, 2800, 4200);
          if (distance <= radius) {
            damagePlayer(w, enemy.damage, enemy.x, enemy.y);
            if (enemy.def.behavior === 'current') {
              const push = (190 * Math.max(0, 1 - distance / radius));
              p.kx += dirX * push;
              p.ky += dirY * push;
            }
          }
          w.effects.push({
            uid: uid(w), kind: 'ring', x: enemy.x, y: enemy.y, radius,
            angle: 0, spread: Math.PI * 2, bornAt: w.now, expiresAt: w.now + 360,
            color: enemy.def.palette.accent, damage: 0, knockback: 0,
            hitUids: new Set(), followPlayer: false,
          });
        }
        break;
      }
      case 'chase':
      default:
        break;
    }

    let moveX = dirX;
    let moveY = dirY;
    if (enemy.def.behavior === 'drifter') {
      // Weave perpendicular to the approach for a swarming feel.
      const wobble = Math.sin(enemy.weave) * 0.65;
      moveX = dirX + -dirY * wobble;
      moveY = dirY + dirX * wobble;
      const l = Math.hypot(moveX, moveY) || 1;
      moveX /= l;
      moveY /= l;
    }
    if (enemy.def.behavior === 'flanker' || enemy.def.behavior === 'prowler' || enemy.def.behavior === 'lookout') {
      const wobble = Math.sin(enemy.weave) * (enemy.def.behavior === 'lookout' ? 0.85 : 1.15);
      moveX = dirX + -dirY * wobble;
      moveY = dirY + dirX * wobble;
      if (enemy.def.behavior === 'lookout' && distance < 270) {
        moveX = -dirX + -dirY * 0.35;
        moveY = -dirY + dirX * 0.35;
      }
      const l = Math.hypot(moveX, moveY) || 1;
      moveX /= l;
      moveY /= l;
    }

    enemy.x += moveX * speed * dt;
    enemy.y += moveY * speed * dt;
    applyKnockback(enemy, dt);
    collideObstacles(w, enemy);
    clampToArena(w, enemy);

    // Contact damage.
    const contact = enemy.radius + p.radius;
    if (enemy.ghostUntil <= w.now && distance <= contact && w.now >= enemy.contactReadyAt) {
      enemy.contactReadyAt = w.now + 520;
      damagePlayer(w, enemy.damage, enemy.x, enemy.y);
    }
    for (const b of w.breakables) {
       if (b.broken || !PUSHABLE_KINDS.has(b.kind)) continue;
      if (Math.abs(enemy.x - b.x) < b.w / 2 + enemy.radius && Math.abs(enemy.y - b.y) < b.h / 2 + enemy.radius) {
        b.contacts += 1;
        if (b.kind === 'car-wreck' && b.contacts < 3) continue;
        const dx = b.x - enemy.x; const dy = b.y - enemy.y; const len = Math.hypot(dx, dy) || 1;
        const force = b.kind === 'car-wreck' ? 18 : 30;
        b.vx += (dx / len) * force / (b.kind === 'car-wreck' ? 3 : 1);
        b.vy += (dy / len) * force / (b.kind === 'car-wreck' ? 3 : 1);
      }
    }

    const elapsed = w.now - enemy.animStartedAt;
    if (enemy.anim === 'attack' && elapsed < 260) continue;
    if (enemy.anim !== 'walk') {
      enemy.anim = 'walk';
      enemy.animStartedAt = w.now;
    }
  }

  // Separation so enemies form a crowd instead of a single stacked sprite.
  rebuildGrid(w);
  for (const enemy of w.enemies) {
    if (enemy.dying) continue;
    forEachNearby(w, enemy.x, enemy.y, enemy.radius * 2, (other) => {
      if (other === enemy) return;
      const dx = other.x - enemy.x;
      const dy = other.y - enemy.y;
      const minDist = enemy.radius + other.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minDist * minDist || d2 < 1e-4) return;
      const d = Math.sqrt(d2);
      const overlap = (minDist - d) * 0.5;
      const ox = (dx / d) * overlap;
      const oy = (dy / d) * overlap;
      const total = enemy.mass + other.mass;
      enemy.x -= ox * (other.mass / total) * 2;
      enemy.y -= oy * (other.mass / total) * 2;
      other.x += ox * (enemy.mass / total) * 2;
      other.y += oy * (enemy.mass / total) * 2;
    });
  }

  // Retire finished death animations.
  for (let i = w.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = w.enemies[i]!;
    if (enemy.dying && w.now - enemy.deathAt > 560) {
      w.enemies.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Projectiles, effects, pickups                                       */
/* ------------------------------------------------------------------ */

function updateProjectiles(w: World, dt: number) {
  const p = w.player;

  for (let i = w.projectiles.length - 1; i >= 0; i -= 1) {
    const proj = w.projectiles[i]!;

    if (proj.targetUid !== null) {
      const target = w.enemies.find((e) => e.uid === proj.targetUid && !e.dying);
      if (target) {
        const desired = Math.atan2(target.y - proj.y, target.x - proj.x);
        const current = Math.atan2(proj.vy, proj.vx);
        let diff = desired - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = clamp(diff, -proj.turnRate * dt, proj.turnRate * dt);
        const speed = Math.hypot(proj.vx, proj.vy);
        const angle = current + turn;
        proj.vx = Math.cos(angle) * speed;
        proj.vy = Math.sin(angle) * speed;
      } else {
        const next = nearestEnemy(w, proj.x, proj.y, 260, proj.hitUids);
        proj.targetUid = next?.uid ?? null;
      }
    }

    proj.trail.push({ x: proj.x, y: proj.y });
    if (proj.trail.length > 6) proj.trail.shift();

    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    let remove = w.now > proj.expiresAt;

    // Cover absorbs shots; reflective surfaces redirect player projectiles.
    // This runs before actor hits so a wall cannot be shot through.
    if (!remove && collideProjectileObstacle(w, proj)) remove = true;

    if (!remove) {
      if (w.area.endless) {
        // In endless mode, cull by distance from player rather than fixed arena walls.
        if (dist2(proj.x, proj.y, w.player.x, w.player.y) > 900 * 900) remove = true;
      } else {
        const halfW = w.bounds.w / 2;
        const halfH = w.bounds.h / 2;
        if (proj.x < -halfW || proj.x > halfW || proj.y < -halfH || proj.y > halfH) remove = true;
      }
    }

    if (!remove && proj.fromPlayer) {
      forEachNearby(w, proj.x, proj.y, 30, (enemy) => {
        if (remove || enemy.dying || proj.hitUids.has(enemy.uid)) return;
        const reach = proj.radius + enemy.radius;
        if (dist2(enemy.x, enemy.y, proj.x, proj.y) <= reach * reach) {
          proj.hitUids.add(enemy.uid);
          if (proj.explosionRadius) {
            showLokPetBurst(
              w,
              proj.x,
              proj.y,
              proj.explosionRadius,
              proj.explosionDamage ?? proj.damage,
              proj.color,
              proj.statusEffectId,
              true,
            );
          } else {
            damageEnemy(w, enemy, proj.damage, proj.knockback, proj.x, proj.y, proj.statusEffectId);
          }
          damageBreakable(w, proj.x, proj.y, proj.radius, proj.damage);
          spawnParticles(w, proj.x, proj.y, proj.color, 3, 60);
          if (proj.pierce > 0) proj.pierce -= 1;
          else remove = true;
        }
      });
    } else if (!remove) {
      const reach = proj.radius + p.radius;
      if (dist2(p.x, p.y, proj.x, proj.y) <= reach * reach) {
        damagePlayer(w, proj.damage, proj.x, proj.y);
        remove = true;
      }
    }

    if (remove) w.projectiles.splice(i, 1);
  }
}

function updateEffects(w: World) {
  const p = w.player;

  for (let i = w.effects.length - 1; i >= 0; i -= 1) {
    const effect = w.effects[i]!;
    if (effect.followPlayer) {
      effect.x = p.x;
      effect.y = p.y;
    }

    const active = w.now >= effect.bornAt;
    if (active && (effect.kind === 'slash' || effect.kind === 'wave' || effect.kind === 'laser') && effect.damage > 0) {
      forEachNearby(w, effect.x, effect.y, effect.radius + 30, (enemy) => {
        if (enemy.dying || effect.hitUids.has(enemy.uid)) return;
        const reach = effect.radius + enemy.radius;
        if (dist2(enemy.x, enemy.y, effect.x, effect.y) > reach * reach) return;
        const angleTo = Math.atan2(enemy.y - effect.y, enemy.x - effect.x);
        let diff = Math.abs(angleTo - effect.angle);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
        if (diff > effect.spread) return;
        effect.hitUids.add(enemy.uid);
        damageEnemy(w, enemy, effect.damage, effect.knockback, effect.x, effect.y);
      });
      damageBreakable(w, effect.x, effect.y, effect.radius, effect.damage);
    }

    if (active && effect.kind === 'hazard' && effect.damage > 0 && w.now >= (effect.nextTickAt ?? effect.bornAt)) {
      effect.nextTickAt = w.now + 520;
      effect.hitUids.clear();
      forEachNearby(w, effect.x, effect.y, effect.radius + 30, (enemy) => {
        if (enemy.dying || effect.hitUids.has(enemy.uid)) return;
        const reach = effect.radius + enemy.radius;
        if (dist2(enemy.x, enemy.y, effect.x, effect.y) > reach * reach) return;
        effect.hitUids.add(enemy.uid);
        damageEnemy(w, enemy, effect.damage, 0, effect.x, effect.y, effect.color.includes('b8ff') ? 'acid' : 'burning');
      });
      if (effect.hurtsPlayer && dist2(p.x, p.y, effect.x, effect.y) <= (effect.radius + p.radius) ** 2) {
        damagePlayer(w, Math.max(1, Math.round(effect.damage * 0.45)), effect.x, effect.y);
      }
    }

    if (w.now > effect.expiresAt) w.effects.splice(i, 1);
  }
}

function updatePickups(w: World, dt: number) {
  const p = w.player;
  const magnet = w.stats.magnet;

  for (let i = w.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = w.pickups[i]!;
    const dx = p.x - pickup.x;
    const dy = p.y - pickup.y;
    const distance = Math.hypot(dx, dy) || 1;

    // Loot boxes don't magnet — player must walk over them.
    if (pickup.kind !== 'loot-box' && distance < magnet) {
      // Accelerate toward the player once inside the magnet radius.
      const pull = 260 + (magnet - distance) * 5;
      pickup.vx += (dx / distance) * pull * dt;
      pickup.vy += (dy / distance) * pull * dt;
    }

    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    pickup.vx *= Math.pow(0.02, dt);
    pickup.vy *= Math.pow(0.02, dt);

    if (distance < p.radius + (pickup.kind === 'loot-box' ? 18 : 10)) {
      switch (pickup.kind) {
        case 'xp':
          gainXp(w, pickup.value);
          break;
        case 'health':
          w.player.hp = clamp(w.player.hp + pickup.value, 0, w.player.maxHp);
          w.popups.push({ x: p.x, y: p.y + 26, text: `+${pickup.value}`, color: '#7dffb2', bornAt: w.now, vy: 30 });
          break;
        case 'cred':
          w.cred += pickup.value;
          break;
        case 'loot-box': {
          // Roll and apply the prize immediately (safe even if run ends during reel).
          const prize = rollPrize(w.rng);
          applyLootPrize(w, prize);
          w.lootBoxesOpened += 1;
          w.openedPrizes.push(prize.label);
          // Queue for the reel overlay in RunScreen.
          w.pendingReel.push(prize);
          spawnParticles(w, p.x, p.y + 10, '#3b82f6', 14, 120);
          w.shake = Math.max(w.shake, 8);
          pushAlert(w, `Box — ${prize.label}`);
          break;
        }
        case 'sweep': {
          // A street sweep: everything on screen takes a hit.
          novaDamage(w, p.x, p.y, 320 * areaMult(w), 45 * w.stats.power, 6);
          w.effects.push({
            uid: uid(w), kind: 'ring', x: p.x, y: p.y, radius: 320 * areaMult(w),
            angle: 0, spread: 0, bornAt: w.now, expiresAt: w.now + 480,
            color: '#ffffff', damage: 0, knockback: 0, hitUids: new Set(), followPlayer: false,
          });
          w.shake = Math.max(w.shake, 10);
          pushAlert(w, 'Street sweep');
          break;
        }
      }
      w.pickups.splice(i, 1);
    }
  }
}

function updateObjectives(w: World) {
  const e = w.endless;
  const freshlyCompleted: RunObjective[] = [];

  for (const obj of w.objectives) {
    if (obj.completed) continue;

    switch (obj.def.kind) {
      case 'kill-any': {
        const base = obj.baseKills ?? 0;
        obj.progress = Math.min(obj.def.targetCount, w.kills - base);
        break;
      }
      case 'kill-enemy': {
        const base = obj.baseEnemyKills ?? 0;
        const total = w.killsByEnemy[obj.def.enemyId ?? ''] ?? 0;
        obj.progress = Math.min(obj.def.targetCount, total - base);
        break;
      }
      case 'survive-sec': {
        const base = obj.baseTime ?? w.time;
        if (obj.baseTime === undefined) obj.baseTime = w.time;
        obj.progress = Math.min(obj.def.targetCount, w.time - base);
        break;
      }
      case 'walk-blocks': {
        if (!e) break;
        if (obj.baseDistancePx === undefined) obj.baseDistancePx = e.maxDistancePx;
        const blocksWalked = Math.round((e.maxDistancePx - obj.baseDistancePx) / CHUNK_SIZE);
        obj.progress = Math.min(obj.def.targetCount, blocksWalked);
        break;
      }
    }

    if (obj.progress >= obj.def.targetCount) {
      obj.completed = true;
      freshlyCompleted.push(obj);
    }
  }

  for (const obj of freshlyCompleted) {
    // Pay out rewards.
    w.cred += obj.def.rewardCred;
    w.lootTokensGained += obj.def.rewardTokens;
    w.completedObjectives.push({
      id: obj.def.id,
      label: obj.def.label,
      rewardCred: obj.def.rewardCred,
      rewardTokens: obj.def.rewardTokens,
    });
    pushAlert(w, `Objective done — ${obj.def.label}`);
    spawnParticles(w, w.player.x, w.player.y - 20, '#f59e0b', 12, 100);

    // Cycle to a new objective.
    const next = rollNextObjective(w.rng, w.objectives, w.completedObjectives, !!w.area.endless);
    if (next) {
      // Snapshot baselines when assigned.
      if (next.def.kind === 'kill-any') next.baseKills = w.kills;
      if (next.def.kind === 'kill-enemy') {
        next.baseEnemyKills = w.killsByEnemy[next.def.enemyId ?? ''] ?? 0;
      }
      if (next.def.kind === 'survive-sec') next.baseTime = w.time;
      if (next.def.kind === 'walk-blocks') next.baseDistancePx = w.endless?.maxDistancePx ?? 0;
      const idx = w.objectives.indexOf(obj);
      w.objectives[idx] = next;
    } else {
      w.objectives = w.objectives.filter((o) => o !== obj);
    }
  }
}

function updateParticles(w: World, dt: number) {
  for (let i = w.particles.length - 1; i >= 0; i -= 1) {
    const particle = w.particles[i]!;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.pow(0.05, dt);
    particle.vy *= Math.pow(0.05, dt);
    if (w.now - particle.bornAt > particle.lifeMs) w.particles.splice(i, 1);
  }
  for (let i = w.popups.length - 1; i >= 0; i -= 1) {
    const popup = w.popups[i]!;
    popup.y += popup.vy * dt;
    popup.vy *= Math.pow(0.25, dt);
    if (w.now - popup.bornAt > 700) w.popups.splice(i, 1);
  }
  for (let i = w.alerts.length - 1; i >= 0; i -= 1) {
    if (w.now - w.alerts[i]!.bornAt > 2600) w.alerts.splice(i, 1);
  }
}

/* ------------------------------------------------------------------ */
/* Rescue objective                                                    */
/* ------------------------------------------------------------------ */

function updateRescue(w: World, dt: number) {
  const rescue = w.rescue;
  if (rescue.status === 'freed') return;

  if (rescue.status === 'pending') {
    if (w.time < rescue.appearAtSec) return;
    const halfW = w.bounds.w / 2 - 60;
    const halfH = w.bounds.h / 2 - 60;
    // Place them away from the player so it is a trip, not a freebie.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const x = randRange(w.rng, -halfW, halfW);
      const y = randRange(w.rng, -halfH, halfH);
      const clearOfScenery = w.obstacles.every(
        (box) => Math.abs(x - box.x) > box.w / 2 + 40 || Math.abs(y - box.y) > box.h / 2 + 40,
      );
      if (clearOfScenery && dist2(x, y, w.player.x, w.player.y) > 260 * 260) {
        rescue.x = x;
        rescue.y = y;
        break;
      }
    }
    rescue.status = 'available';
    pushAlert(w, 'Someone is trapped nearby');
    return;
  }

  const distance = Math.hypot(w.player.x - rescue.x, w.player.y - rescue.y);
  if (distance < 46) {
    rescue.status = 'freeing';
    rescue.progress = clamp(rescue.progress + dt / 2.4, 0, 1);
    if (rescue.progress >= 1) {
      rescue.status = 'freed';
      pushAlert(w, 'Rescued — get them home');
      spawnParticles(w, rescue.x, rescue.y + 12, '#ffe08a', 22, 130);
      w.cred += 25;
    }
  } else {
    rescue.status = 'available';
    rescue.progress = Math.max(0, rescue.progress - dt * 0.3);
  }
}

/* ------------------------------------------------------------------ */
/* Endless mode                                                        */
/* ------------------------------------------------------------------ */

function endlessDiffTier(e: EndlessState): number {
  return Math.floor(e.maxDistancePx / 800) + Math.floor(e.dungeonDepth / 2);
}

function updateEndlessChunks(w: World) {
  const e = w.endless!;
  if (e.inDungeon || e.inBuilding) return;

  // Track farthest distance for difficulty.
  const px = w.player.x;
  const py = w.player.y;
  const dist = Math.hypot(px, py);
  if (dist > e.maxDistancePx) e.maxDistancePx = dist;

  const VIEW_RADIUS = 2;
  const { cx: playerCx, cy: playerCy } = worldToChunkCoords(px, py);

  const needed = new Set<string>();
  for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx += 1) {
    for (let dy = -VIEW_RADIUS; dy <= VIEW_RADIUS; dy += 1) {
      needed.add(chunkKey(playerCx + dx, playerCy + dy));
    }
  }

  let changed = false;

  // Unload distant chunks.
  for (const key of e.chunkObstacles.keys()) {
    if (!needed.has(key)) {
      e.chunkObstacles.delete(key);
      e.dungeonEntrances = e.dungeonEntrances.filter((en) => en.chunkKey !== key);
      e.cityBlocks = e.cityBlocks.filter((block) => block.key !== key);
      e.riverSegments = e.riverSegments.filter((segment) => !(
        Math.abs(segment.x - (parseInt(key.split(',')[0]!, 10) * CHUNK_SIZE)) < CHUNK_SIZE &&
        Math.abs(segment.y - (parseInt(key.split(',')[1]!, 10) * CHUNK_SIZE)) < CHUNK_SIZE
      ));
      e.buildingEntrances = e.buildingEntrances.filter((door) => {
        const cx = parseInt(key.split(',')[0]!, 10);
        const cy = parseInt(key.split(',')[1]!, 10);
        return Math.abs(door.x - cx * CHUNK_SIZE) >= CHUNK_SIZE || Math.abs(door.y - cy * CHUNK_SIZE) >= CHUNK_SIZE;
      });
      changed = true;
    }
  }

  // Generate and load nearby chunks.
  for (const key of needed) {
    if (e.chunkObstacles.has(key)) continue;
    const [cxStr, cyStr] = key.split(',');
    const cx = parseInt(cxStr!, 10);
    const cy = parseInt(cyStr!, 10);
    const chunk = generateChunk(cx, cy, e.rngSeed);
    const origin = chunkOrigin(cx, cy);
    const cwx = origin.x + CHUNK_SIZE / 2;
    const cwy = origin.y + CHUNK_SIZE / 2;

    const worldObs = chunk.obstacles.map((obs) => ({
      x: cwx + obs.x,
      y: cwy + obs.y,
      w: obs.w,
      h: obs.h,
      kind: obs.kind,
    }));
    e.chunkObstacles.set(key, worldObs);
    e.cityBlocks.push({
      key,
      cx,
      cy,
      kind: chunk.blockKind,
      x: cwx,
      y: cwy,
      w: CHUNK_SIZE,
      h: CHUNK_SIZE,
      river: chunk.hasRiver,
      crossing: chunk.hasRiver,
    });
    if (chunk.hasRiver) {
      e.riverSegments.push({
        x: cwx,
        y: cwy,
        w: CHUNK_SIZE,
        h: 126,
        crossingX: cwx + chunk.riverCrossingX,
      });
    }
    for (const door of chunk.buildingEntrances) {
      e.buildingEntrances.push({
        x: cwx + door.x,
        y: cwy + door.y,
        w: 34,
        h: 28,
        label: door.label,
        returnX: cwx + door.x,
        returnY: cwy + door.y + 48,
      });
    }

    if (chunk.hasDungeonEntrance && !e.consumedEntranceChunks.has(key)) {
      e.dungeonEntrances.push({
        x: cwx + chunk.entranceLocalX,
        y: cwy + chunk.entranceLocalY,
        w: 56,
        h: 16,
        chunkKey: key,
      });
    }
    changed = true;
  }

  if (changed) {
    w.obstacles = [];
     w.obstacles = [];
     w.breakables = [];
     for (const obsArr of e.chunkObstacles.values()) {
       for (const o of obsArr) {
         w.obstacles.push(o);
         const hp = BREAKABLE_HP[o.kind ?? 'crate'] ?? 999999;
         w.breakables.push({ ...o, uid: uid(w), kind: o.kind ?? 'crate', hp, maxHp: hp, vx: 0, vy: 0, broken: false, brokenAt: 0, contacts: 0 });
       }
     }
  }
}

function loadDungeonRoom(w: World, room: number, transition: 'enter' | 'exit' = 'exit') {
  const e = w.endless!;
  const p = w.player;
  e.dungeonRoom = room;
  const era = DUNGEON_ERAS[e.dungeonEraIndex]!;
  e.dungeonBounds = { ...era.bounds };

  // Place dungeon obstacles in world space, centred on the entry point.
   w.obstacles = era.obstacles.map((obs) => ({
    x: p.x + obs.x,
    y: p.y + obs.y,
    w: obs.w,
    h: obs.h,
  }));
  w.breakables = era.obstacles.map((obs) => {
    const hp = BREAKABLE_HP[obs.kind] ?? 999999;
    return { x: p.x + obs.x, y: p.y + obs.y, w: obs.w, h: obs.h, uid: uid(w), kind: obs.kind, hp, maxHp: hp, vx: 0, vy: 0, broken: false, brokenAt: 0, contacts: 0 };
  });

  // Exit doorway on the far side of the room.
  e.exitZone = {
    x: p.x + era.bounds.w / 2 - 40,
    y: p.y,
    w: 44,
    h: 64,
  };

  w.enemies = w.enemies.filter((en) => en.dying);
  w.pickups = [];
  w.projectiles = [];

  if (room === 3) {
    const boss = getEnemy('the-sire');
    spawnEnemy(w, boss, (1000 / boss.hp) * w.level, { x: p.x + 30, y: p.y });
    e.dungeonChest = { x: p.x + era.bounds.w / 2 - 92, y: p.y, unlocked: false, opened: false };
    pushAlert(w, `FINAL ROOM — ${boss.name} level ${w.level}`);
  } else {
    pushAlert(w, `${era.name} — room ${room} of 3`);
  }
  e.pendingTransition = transition;
  w.shake = Math.max(w.shake, 10);
}

function enterDungeon(w: World) {
  const e = w.endless!;
  e.streetReturnX = w.player.x;
  e.streetReturnY = w.player.y;
  e.dungeonCenterX = w.player.x;
  e.dungeonCenterY = w.player.y;
  e.dungeonDepth += 1;
  e.dungeonRoom = 1;
  e.dungeonBossDefeated = false;
  e.dungeonChest = null;
  e.dungeonEraIndex = (e.dungeonEraIndex + 1) % DUNGEON_ERAS.length;
  e.inDungeon = true;
  loadDungeonRoom(w, 1, 'enter');
}

function enterBuilding(w: World, door: EndlessState['buildingEntrances'][number]) {
  const e = w.endless!;
  e.buildingReturnX = door.returnX;
  e.buildingReturnY = door.returnY;
  e.dungeonCenterX = door.x;
  e.dungeonCenterY = door.y;
  e.buildingLabel = door.label;
  e.inBuilding = true;
  e.dungeonBounds = { w: 420, h: 320 };
  e.exitZone = { x: door.x, y: door.y + 125, w: 52, h: 42 };
  w.obstacles = [
    { x: door.x - 140, y: door.y - 120, w: 28, h: 240 },
    { x: door.x + 140, y: door.y - 120, w: 28, h: 240 },
    { x: door.x, y: door.y - 145, w: 260, h: 28 },
  ];
  w.breakables = w.obstacles.map((obs) => ({
    ...obs,
    uid: uid(w),
    kind: 'building' as const,
    hp: 999999,
    maxHp: 999999,
    vx: 0,
    vy: 0,
    broken: false,
    brokenAt: 0,
    contacts: 0,
  }));
  w.enemies = w.enemies.filter((en) => en.dying);
  w.pickups = [];
  w.projectiles = [];
  e.pendingTransition = 'enter';
  pushAlert(w, `${door.label} — inside`);
}

function exitDungeon(w: World) {
  const e = w.endless!;

  if (e.inBuilding) {
    w.player.x = e.buildingReturnX;
    w.player.y = e.buildingReturnY;
    w.player.vx = 0;
    w.player.vy = 0;
    e.inBuilding = false;
    e.exitZone = null;
    restoreStreetObstacles(w);
    e.pendingTransition = 'exit';
    pushAlert(w, 'Back on the block');
    return;
  }

  if (e.dungeonRoom < 3) {
    loadDungeonRoom(w, e.dungeonRoom + 1);
    return;
  }

  // Return player to just past the entry point so they won't re-trigger.
  w.player.x = e.streetReturnX - 90;
  w.player.y = e.streetReturnY;
  w.player.vx = 0;
  w.player.vy = 0;

  restoreStreetObstacles(w);

  e.inDungeon = false;
  e.dungeonRoom = 0;
  e.dungeonChest = null;
  e.exitZone = null;
  w.enemies = w.enemies.filter((en) => en.dying);
  w.pickups = [];
  w.projectiles = [];
  e.pendingTransition = 'exit';
  pushAlert(w, 'Back on the block');
  w.shake = Math.max(w.shake, 8);
}

function restoreStreetObstacles(w: World) {
  const e = w.endless!;
  w.obstacles = [];
  w.breakables = [];
  for (const obsArr of e.chunkObstacles.values()) {
    for (const o of obsArr) {
      w.obstacles.push(o);
      const hp = BREAKABLE_HP[o.kind ?? 'crate'] ?? 999999;
      w.breakables.push({
        ...o,
        uid: uid(w),
        kind: o.kind ?? 'crate',
        hp,
        maxHp: hp,
        vx: 0,
        vy: 0,
        broken: false,
        brokenAt: 0,
        contacts: 0,
      });
    }
  }
}

function updateEndlessDungeon(w: World) {
  const e = w.endless!;
  const p = w.player;

  if (!e.inDungeon && !e.inBuilding) {
    for (const door of e.buildingEntrances) {
      if (
        Math.abs(p.x - door.x) < door.w / 2 + p.radius &&
        Math.abs(p.y - door.y) < door.h / 2 + p.radius
      ) {
        enterBuilding(w, door);
        return;
      }
    }
    for (const entrance of e.dungeonEntrances) {
      const hw = entrance.w / 2;
      const hh = entrance.h / 2;
      if (
        Math.abs(p.x - entrance.x) < hw + p.radius &&
        Math.abs(p.y - entrance.y) < hh + p.radius
      ) {
        e.consumedEntranceChunks.add(entrance.chunkKey);
        e.dungeonEntrances = e.dungeonEntrances.filter((en) => en !== entrance);
        enterDungeon(w);
        return;
      }
    }
  } else {
    const exit = e.exitZone;
    if (exit) {
      const hw = exit.w / 2;
      const hh = exit.h / 2;
      if (
        Math.abs(p.x - exit.x) < hw + p.radius &&
        Math.abs(p.y - exit.y) < hh + p.radius
      ) {
        exitDungeon(w);
        return;
      }
    }
    const chest = e.dungeonChest;
    if (e.inDungeon && chest?.unlocked && !chest.opened &&
      Math.hypot(p.x - chest.x, p.y - chest.y) < 34 + p.radius) {
      chest.opened = true;
      for (let i = 0; i < 3; i += 1) {
        const prize = rollPrize(w.rng);
        applyLootPrize(w, prize);
        w.openedPrizes.push(prize.label);
      }
      w.lootBoxesOpened += 1;
      pushAlert(w, 'Chest opened — 3 rewards secured');
      spawnParticles(w, chest.x, chest.y, '#ffd166', 24, 150);
    }
  }
}

const ENDLESS_ENEMY_POOLS: string[][] = [
  ['nightcrawler'],
  ['nightcrawler', 'neon-leech'],
  ['nightcrawler', 'neon-leech', 'ash-wisp'],
  ['neon-leech', 'ash-wisp', 'bloodhound'],
  ['ash-wisp', 'bloodhound', 'crypt-spitter'],
  ['bloodhound', 'crypt-spitter', 'belfry-bat'],
  ['crypt-spitter', 'belfry-bat', 'corner-cutter', 'bridge-lookout'],
  ['belfry-bat', 'crypt-bouncer', 'lightless-prowler', 'river-wraith'],
  ['bass-bruiser', 'bridge-lookout', 'river-wraith', 'lightless-prowler'],
];

function updateEndlessSpawning(w: World, dt: number) {
  const e = w.endless!;
  const tier = endlessDiffTier(e);
  const spawnRate = Math.min(3.2, 0.8 + tier * 0.14);
  const hpMult = Math.min(1.7, 1 + tier * 0.07);

  const pool = ENDLESS_ENEMY_POOLS[Math.min(tier, ENDLESS_ENEMY_POOLS.length - 1)]!;

  e.spawnBudget += spawnRate * dt;
  while (e.spawnBudget >= 1) {
    e.spawnBudget -= 1;
    const enemyId = pool[Math.floor(w.rng() * pool.length)]!;
    spawnEnemy(w, getEnemy(enemyId), hpMult);
  }

  // Periodic elite wave at higher tiers.
  if (tier >= 5) {
    const bossCycle = Math.max(30, 60 - tier * 2);
    if (w.time > 0 && Math.floor((w.time - dt) / bossCycle) < Math.floor(w.time / bossCycle)) {
      spawnEnemy(w, getEnemy('crypt-bouncer'), hpMult * 1.4);
      pushAlert(w, 'Elite incoming');
    }
  }
}

/* ------------------------------------------------------------------ */
/* Main step                                                           */
/* ------------------------------------------------------------------ */

export interface StepInput {
  moveX: number;
  moveY: number;
  ultimate: boolean;
}

export function stepWorld(w: World, dtSeconds: number, input: StepInput) {
  if (w.outcome !== 'running') return;

  const dt = Math.min(dtSeconds, 1 / 30);
  w.time += dt;
  w.now += dt * 1000;

  if (input.ultimate) activateUltimate(w);

  updatePlayer(w, dt, input.moveX, input.moveY);

  if (w.area.endless && w.endless) {
    updateEndlessChunks(w);
    updateEndlessDungeon(w);
    updateEndlessSpawning(w, dt);
  } else {
    updateSpawning(w, dt);
  }

  updateStatusEffects(w);
  updateLokPets(w, dt);
  updateFollowers(w, dt);
  updateEnemies(w, dt);
  updateBreakables(w, dt);

  // Weapon cadence.
  updateOrbiters(w, dt);
  for (const weapon of w.weapons) {
    if (weapon.def.kind === 'orbit') continue;
    if (w.now >= weapon.readyAt) {
      fireWeapon(w, weapon);
      weapon.readyAt = w.now + Math.max(70, weapon.def.cooldownMs * cooldownMult(w));
    }
  }

  updateProjectiles(w, dt);
  updateEffects(w);
  updatePickups(w, dt);
  updateObjectives(w);
  updateParticles(w, dt);
  updateRescue(w, dt);

  // Camera lags slightly behind and leads the direction of travel.
  const targetX = w.player.x + w.player.vx * 0.12;
  const targetY = w.player.y + w.player.vy * 0.12;
  const follow = 1 - Math.pow(0.0001, dt);
  w.camera.x += (targetX - w.camera.x) * follow;
  w.camera.y += (targetY - w.camera.y) * follow;
  w.shake *= Math.pow(0.02, dt);
  if (w.shake < 0.2) w.shake = 0;

  // Time-based clear (timed areas only — endless runs end via "head home").
  if (!w.area.endless && w.time >= w.area.durationSec && w.outcome === 'running') {
    w.outcome = 'cleared';
  }
}

/* ------------------------------------------------------------------ */
/* Read models                                                         */
/* ------------------------------------------------------------------ */

export function hudSnapshot(w: World): HudSnapshot {
  const ultRemaining = Math.max(0, w.ultReadyAt - w.now);
  const ultTotal = w.character.ultimate.cooldownMs * w.ultCooldownMult;
  const e = w.endless;
  const effectCounts = new Map<string, number>();
  for (const enemy of w.enemies) {
    for (const effect of enemy.activeEffects) {
      effectCounts.set(effect.id, (effectCounts.get(effect.id) ?? 0) + 1);
    }
  }
  return {
    hp: Math.max(0, Math.round(w.player.hp)),
    maxHp: Math.round(w.player.maxHp),
    level: w.level,
    xp: Math.round(w.xp),
    xpToNext: Math.round(w.xpToNext),
    elapsedSec: w.time,
    durationSec: w.area.durationSec,
    kills: w.kills,
    cred: w.cred,
    ultimateReadyPct: ultTotal <= 0 ? 100 : clamp(100 - (ultRemaining / ultTotal) * 100, 0, 100),
    ultimateActive: w.now < w.ultActiveUntil,
    weaponLevel: w.weaponLevel,
    loadout: {
      weapons: w.weapons.map((weapon) => ({ id: weapon.def.id, name: weapon.def.name, level: weapon.level, color: weapon.def.color })),
      passives: w.passives.map((passive) => ({ id: passive.def.id, name: passive.def.name, stacks: passive.stacks })),
    },
    alerts: w.alerts.map((a) => a.text),
    rescueAvailable: w.rescue.status === 'available' || w.rescue.status === 'freeing',
    rescueProgressPct: Math.round(w.rescue.progress * 100),
    lootBoxesOpened: w.lootBoxesOpened,
    lokPets: w.lokPets.map((pet) => ({
      uid: pet.uid,
      name: pet.name,
      family: pet.family,
      silhouette: pet.silhouette,
      rarity: pet.rarity,
      attackKind: pet.attackKind,
      element: pet.element,
      traitLabel: pet.traitLabel,
      health: pet.stats.health,
      damage: Math.round(pet.stats.damage),
      cooldownMs: pet.stats.cooldownMs,
      range: pet.stats.range,
      ghost: pet.ghost,
      ghostPct: pet.ghost ? 100 : clamp((w.now - pet.bornAt) / Math.max(1, pet.ghostAt - pet.bornAt) * 100, 0, 100),
      expiresInSec: Math.max(0, Math.ceil((pet.expiresAt - w.now) / 1000)),
      color: LOKPET_ELEMENT_COLORS[pet.element],
    })),
    activeEffects: [...effectCounts.entries()].map(([id, count]) => ({
      id,
      name: STATUS_EFFECTS_BY_ID[id]?.name ?? id,
      color: STATUS_EFFECTS_BY_ID[id]?.color ?? '#fff',
      count,
    })),
    objectives: w.objectives.map((o) => ({
      label: o.def.label,
      progress: Math.min(o.def.targetCount, Math.round(o.progress)),
      target: o.def.targetCount,
      completed: o.completed,
    })),
    endless: e
      ? {
          blocksWalked: Math.round(e.maxDistancePx / CHUNK_SIZE),
          dungeonDepth: e.dungeonDepth,
          inDungeon: e.inDungeon,
          dungeonRoom: e.dungeonRoom,
          dungeonBossDefeated: e.dungeonBossDefeated,
          dungeonChestUnlocked: Boolean(e.dungeonChest?.unlocked),
          dungeonChestOpened: Boolean(e.dungeonChest?.opened),
          dungeonEraName: e.dungeonEraIndex >= 0 && e.inDungeon
            ? (DUNGEON_ERAS[e.dungeonEraIndex]?.name ?? 'Unknown')
            : '',
          currentBlock: e.cityBlocks.find((block) => block.key === chunkKey(
            worldToChunkCoords(w.player.x, w.player.y).cx,
            worldToChunkCoords(w.player.x, w.player.y).cy,
          ))?.kind ?? 'street',
          playerX: w.player.x,
          playerY: w.player.y,
          cityBlocks: e.cityBlocks.map(({ x, y, w: width, h: height, kind, river, crossing }) => ({
            x, y, w: width, h: height, kind, river, crossing,
          })),
          riverSegments: [...e.riverSegments],
          buildingEntrances: e.buildingEntrances.map(({ x, y, label }) => ({ x, y, label })),
        }
      : undefined,
  };
}

export function buildResult(w: World): RunResult {
  const cleared = w.outcome === 'cleared';
  const survival = w.area.endless ? w.time : Math.min(w.time, w.area.durationSec);
  const bonus = cleared ? 120 : 0;
  const e = w.endless;
  return {
    areaId: w.area.id,
    characterId: w.character.id,
    cleared,
    survivedSec: survival,
    kills: w.kills,
    level: w.level,
    cred: w.cred + bonus + Math.floor(survival / 4),
    killsByEnemy: { ...w.killsByEnemy },
    rescuedAllyId: w.rescue.status === 'freed' ? w.rescue.allyId : undefined,
    discoveryId: w.area.discoveryId,
    newlyUnlockedCharacterIds: [],
    loadout: {
      weapons: w.weapons.map((weapon) => ({ id: weapon.def.id, name: weapon.def.name, level: weapon.level })),
      passives: w.passives.map((passive) => ({ id: passive.def.id, name: passive.def.name, stacks: passive.stacks })),
    },
    lootBoxesOpened: w.lootBoxesOpened,
    openedPrizes: [...w.openedPrizes],
    lokPets: w.lokPetHistory.map((pet) => ({
      name: pet.name,
      family: pet.family,
      rarity: pet.rarity,
      attackKind: pet.attackKind,
      element: pet.element,
      health: pet.stats.health,
      damage: Math.round(pet.stats.damage),
      cooldownMs: pet.stats.cooldownMs,
      range: pet.stats.range,
      ghosted: pet.ghost,
    })),
    lootTokensGained: w.lootTokensGained,
    completedObjectives: [...w.completedObjectives],
    endless: e
      ? {
          maxDistancePx: e.maxDistancePx,
          dungeonDepth: e.dungeonDepth,
          blocksWalked: Math.round(e.maxDistancePx / CHUNK_SIZE),
        }
      : undefined,
  };
}
