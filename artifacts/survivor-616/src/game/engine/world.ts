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
import { AMBIENT_KINDS } from '@/game/data/ambient';
import { DUNGEON_ERAS } from '@/game/data/dungeonEras';
import { EVOLUTIONS, EVOLUTIONS_BY_ID } from '@/game/data/evolutions';
import { PASSIVES, PASSIVES_BY_ID } from '@/game/data/passives';
import { UPGRADES, ALLIES_BY_ID } from '@/game/data/progression';
import { WEAPONS_BY_ID } from '@/game/data/weapons';
import { rollPrize } from '@/game/data/prizes';
import { LOKPET_ELEMENT_COLORS, rollLokPet } from '@/game/data/lokPets';
import { OBJECTIVES } from '@/game/data/objectives';
import { STATUS_EFFECTS_BY_ID } from '@/game/data/statusEffects';
import { getCrewRumor } from '@/game/data/crewRumors';
import { getFirstNightChapter } from '@/game/data/firstNight';
import { RELIC_RECIPES, RELIC_RECIPES_BY_ID } from '@/game/data/relics';
import { chooseDistrictIncursion, DISTRICT_INCURSIONS_BY_ID } from '@/game/data/incursions';
import { ENDLESS_BANDS, ENDLESS_BANDS_BY_ID, getEndlessBand } from '@/game/data/endlessBands';
import { SILENT_FRAME, msFromNearestBeat, type AudioFrame } from '@/game/audio/beatBus';
import { reactionMultiplier, type BeatReaction, type ReactionTarget } from '@/game/data/reactivity';
import type {
  ActiveCrewRumor,
  AreaDef,
  BaseStats,
  CharacterEpisodeDef,
  ChallengeContractDef,
  CharacterDef,
  CompletedObjective,
  DistrictIncursionState,
  EnemyDef,
  EndlessState,
  EvolutionBehavior,
  EvolutionDef,
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
  ImpactIntensity,
  PotholeTrigger,
  PropVariant,
  RelicRecipeDef,
} from '@/game/types';

import {
  clamp,
  createRng,
  dist2,
  randRange,
  resolveCircleBox,
  type Aabb,
} from './math';
import {
  BUILDING_PREFABS,
  CHUNK_SIZE,
  buildingWallObstacles,
  chunkKey,
  chunkOrigin,
  generateChunk,
  getBuildingPrefab,
  worldToChunkCoords,
  type BuildingPrefabId,
} from './chunks';

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
  /** Set for the readable fall beat before a lethal pothole resolves. */
  falling: boolean;
  fallStartedAt: number;
}

export interface PlayerActor extends Actor {
  invulnUntil: number;
  lastDamageAt: number;
  dashDirectionX: number;
  dashDirectionY: number;
  dashUntil: number;
  dashReadyAt: number;
  dashStartedAt: number;
  dashHitUids: Set<number>;
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
  impactIntensity: ImpactIntensity;
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
  /** Ground-impact tag forwarded to pothole activation. */
  impactTrigger?: PotholeTrigger;
  /** Pet shots can detonate into a second area hit on contact. */
  explosionRadius?: number;
  explosionDamage?: number;
  evolutionBehavior?: EvolutionBehavior;
}

export type EffectKind = 'slash' | 'nova' | 'aura' | 'spark' | 'ring' | 'wave' | 'laser' | 'hazard' | 'teleport' | 'impact';

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
  impactIntensity: ImpactIntensity;
  impactTrigger?: PotholeTrigger;
  hitUids: Set<number>;
  followPlayer: boolean;
  nextTickAt?: number;
  hurtsPlayer?: boolean;
  statusEffectId?: string;
  evolutionBehavior?: EvolutionBehavior;
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

/**
 * Background city life (civilians, cats). Cosmetic only: never added to the
 * enemy grid, never collided with, never damaged. Driven by its own RNG
 * stream so adding or tuning ambient life can't shift gameplay rolls.
 */
export interface AmbientActor {
  uid: number;
  kindId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  anim: AnimState;
  animStartedAt: number;
  /** Current wander destination. */
  targetX: number;
  targetY: number;
  /** Timestamp at which a new wander destination is picked. */
  nextWanderAt: number;
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
  propVariant: PropVariant | undefined;
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  mass: number;
  friction: number;
  breakable: boolean;
  movable: boolean;
  impactIntensity: ImpactIntensity;
  nextImpactDamageAt: number;
  broken: boolean;
  brokenAt: number;
  contacts: number;
  /** The most recent direction this prop was hit from by the player. */
  lastPlayerImpactX: number;
  lastPlayerImpactY: number;
  /** A click primes the next player hit for a boosted reverse launch. */
  clickPrimed: boolean;
  clickPrimedAt: number;
  impactVelocityMultiplier: number;
  /** Enemy-prop impact chain state. */
  chainActive: boolean;
  chainCycles: number;
  chainVelocityBudget: number;
  chainBoostPending: boolean;
  /** Enemies that have already provided the launch beat for this chain. */
  chainContactUids: Set<number>;
  chainHitUids: Set<number>;
  nextEnemyImpactAt: number;
  landedHeatActive: boolean;
  heatNextTickAt: number;
  /** Falling light-pole state. */
  fallAngle?: number;
  hazardUntil?: number;
  hazardNextTickAt?: number;
}

export type PotholeState = 'dormant' | 'opening' | 'open' | 'resolved';

export interface PotholeObstacle extends Aabb {
  uid: number;
  state: PotholeState;
  trigger: PotholeTrigger;
  warningMs: number;
  openingMs: number;
  lethalRadius: number;
  openingStartedAt: number;
  openedAt: number;
  resolvedAt: number;
}

interface ObstacleWeightProfile {
  /** Physics bucket -- also drives mass/friction/movability in propProfile(). */
  variant: PropVariant;
  /** Hit points before the obstacle breaks; omitted means indestructible. */
  hp?: number;
}

/**
 * Single source of truth for how tough an obstacle kind is and how heavy it
 * is once pushed or launched. HP and mass used to live in two separate
 * lookups (a flat HP table plus an ad hoc kind-matching chain for physics
 * variant) that could disagree -- e.g. `cover` had the highest HP of any
 * breakable but the same mass as a `car`. Heavier variants (higher mass)
 * already travel less/slower per hit via resolveImpactTravel(); HP values
 * here are scaled up from the original table so props survive more hits
 * and more being thrown around, while keeping the same relative toughness
 * order (crate breaks fastest, cover/car-wreck are toughest).
 */
const OBSTACLE_WEIGHT_PROFILES: Partial<Record<ObstacleDef['kind'], ObstacleWeightProfile>> = {
  crate: { variant: 'light-breakable', hp: 60 },
  'crate-breakable': { variant: 'light-breakable', hp: 60 },
  'street-lamp': { variant: 'light-breakable', hp: 85 },
  'neon-sign': { variant: 'light-breakable', hp: 90 },
  barrel: { variant: 'light-breakable', hp: 120 },
  'fuse-box': { variant: 'light-breakable', hp: 150 },
  dumpster: { variant: 'medium-movable', hp: 135 },
  car: { variant: 'medium-movable', hp: 180 },
  'car-wreck': { variant: 'medium-movable', hp: 225 },
  cover: { variant: 'medium-movable', hp: 270 },
  'metal-box': { variant: 'heavy-metal' },
  bench: { variant: 'fixed-bench' },
};
const PROJECTILE_BLOCKING_KINDS = new Set<ObstacleDef['kind']>([
  'crate-breakable', 'crate', 'barrel', 'street-lamp', 'cover', 'reflective-surface', 'metal-box', 'bench',
]);

interface PropPhysicsProfile {
  variant: PropVariant;
  mass: number;
  friction: number;
  breakable: boolean;
  movable: boolean;
}

function propProfile(obstacle: Pick<ObstacleDef, 'kind' | 'propVariant'>): PropPhysicsProfile {
  const entry = OBSTACLE_WEIGHT_PROFILES[obstacle.kind];
  const variant = obstacle.propVariant ?? entry?.variant ?? 'fixed-bench';
  const breakable = entry?.hp !== undefined;
  if (variant === 'light-breakable') {
    return { variant, mass: 0.8, friction: 0.82, breakable, movable: true };
  }
  if (variant === 'medium-movable') {
    return { variant, mass: 2.6, friction: 0.88, breakable, movable: true };
  }
  if (variant === 'heavy-metal') {
    return { variant, mass: 8, friction: 0.94, breakable, movable: true };
  }
  return { variant, mass: Number.POSITIVE_INFINITY, friction: 1, breakable: false, movable: false };
}

export const LANDED_HEAT_RADIUS = 116;

const PROP_CHAIN_MIN_CYCLES = 3;
const PROP_CHAIN_MAX_SPEED = 1800;
const PROP_CHAIN_STOP_SPEED = 24;
const PROP_CHAIN_CONTACT_COOLDOWN_MS = 180;
const PROP_CHAIN_FIRST_HIT_DELAY_MS = 180;
const PROP_CHAIN_HIT_COOLDOWN_MS = 120;
const PROP_CHAIN_FRICTION = 0.975;
const PROP_HEAT_TICK_MS = 360;
const PROP_HEAT_DAMAGE = 11;

/** Convert authored impact into travel speed after mass and resistance. */
export function resolveImpactTravel(intensity: number, mass: number, resistance = 0): number {
  if (intensity <= 0 || !Number.isFinite(mass)) return 0;
  const resistanceFactor = 1 + clamp(resistance, 0, 0.8);
  return (intensity * 78) / Math.max(0.35, mass) / resistanceFactor;
}

function enemyImpactResistance(enemy: EnemyActor): number {
  // Heavy enemies still feel hits when they omit authored resistance, but
  // their mass provides a gentle fallback rather than a second mass penalty.
  return enemy.def.impactResistance ?? clamp((enemy.mass - 1) * 0.06, 0, 0.32);
}

function weaponImpact(weapon: Pick<WeaponDef, 'impactIntensity'>): ImpactIntensity {
  return weapon.impactIntensity ?? 1;
}

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
  /** Account-wide signature evolution active for the selected character. */
  activeEvolution?: EvolutionDef;
  /** Relic knowledge carried into this run; recipes are still earned in-run. */
  knownRelicIds: string[];
  /** One relic recipe can be applied per run through a level-up card. */
  activeRelicRecipe?: RelicRecipeDef;
  appliedRelicRecipeIds: Set<string>;
  passives: RunPassive[];
  pickups: Pickup[];
  popups: Popup[];
  particles: Particle[];
  followers: Follower[];
  /** Cosmetic background life; never collided with or damaged. */
  ambient: AmbientActor[];
  lokPets: LokPetInstance[];
  /** All LokPets generated this run, including companions that have expired. */
  lokPetHistory: LokPetInstance[];

  obstacles: Aabb[];
  breakables: BreakableObstacle[];
  potholes: PotholeObstacle[];
  bounds: { w: number; h: number };

  camera: { x: number; y: number };
  shake: number;

  /**
   * What the music is doing this frame. Set once at the top of `stepWorld`
   * from the value the run loop read off `beatBus`; never read the bus from
   * inside the simulation, or catch-up substeps would each see a different
   * frame and double-trigger beat reactions.
   */
  audio: AudioFrame;
  /** 1 -> 0 envelopes retriggered on each beat / downbeat / transient. */
  beatPulse: number;
  downbeatPulse: number;
  onsetPulse: number;
  /** Last integer beat the world has already reacted to. */
  lastBeatIndex: number;
  /** Hits landed inside the on-beat window this run, for the summary screen. */
  onBeatHits: number;

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
  deathCause?: RunResult['deathCause'];

  upgradeStacks: Record<string, number>;
  spawnCredit: number[];
  nextUid: number;
  rng: () => number;
  /**
   * Separate stream for cosmetic ambiance. Kept apart from `rng` so tuning
   * background life never shifts wave/objective/loot rolls for a given seed.
   */
  ambientRng: () => number;
  /** Rebuilt every frame for enemy separation. */
  grid: Map<number, EnemyActor[]>;

  /** Seed used to create rng; also forwarded to endless chunk generation. */
  rngSeed: number;
  /** Present only when area.endless === true. */
  endless?: EndlessState;
  /** Whether pointer clicks can prime movable props during this run. */
  physicsObjectClicksEnabled: boolean;
  /** When false, birds and fireflies stay visible through rain/fog instead of sheltering. */
  wildlifeSheltersInRain: boolean;
  /** Optional difficulty contracts selected before the run. */
  challenges: ChallengeContractDef[];
  /** One bounded hideout rumor carried into this run. */
  activeCrewRumor: ActiveCrewRumor | null;
  /** Whether the carried rumor has fired its gameplay effect yet. */
  rumorTriggered: boolean;
  /** Human-readable outcome used by the run HUD and summary. */
  rumorOutcome: string;
  rumorSpeedUntil: number;
  rumorPantryAvailable: boolean;
  rumorBroadcastAvailable: boolean;
  rumorMagnetNextAt: number;
  /** Authored opening-campaign cue for this area, when one exists. */
  firstNightChapter?: ReturnType<typeof getFirstNightChapter>;
  firstNightBeatTriggered: boolean;
  /** Optional, short landmark encounter selected for this run. */
  districtIncursion?: DistrictIncursionState;

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
  /** Active character episode and its persisted starting progress. */
  episode?: {
    def: CharacterEpisodeDef;
    startingProgress: number;
  };
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
  challenges: ChallengeContractDef[] = [],
  startingWeaponLevel = 1,
  physicsObjectClicksEnabled = true,
  activeCrewRumor: ActiveCrewRumor | null = null,
  setup: {
    unlockedEvolutionIds?: string[];
    knownRelicIds?: string[];
    episode?: CharacterEpisodeDef;
    episodeProgress?: number;
    districtIncursionId?: string;
    wildlifeSheltersInRain?: boolean;
  } = {},
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
    falling: false,
    fallStartedAt: 0,
    invulnUntil: 0,
    lastDamageAt: -9999,
    dashDirectionX: 0,
    dashDirectionY: 0,
    dashUntil: 0,
    dashReadyAt: 0,
    dashStartedAt: 0,
    dashHitUids: new Set(),
  };

  const rng = createRng(seed);
  const selectedIncursion = chooseDistrictIncursion(area.id, rng, setup.districtIncursionId);
  const evolved = EVOLUTIONS.find((candidate) =>
    candidate.characterId === character.id &&
    candidate.baseWeaponId === character.weapon.id &&
    setup.unlockedEvolutionIds?.includes(candidate.id),
  );
  const signatureWeapon = evolved?.result ?? character.weapon;

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
    weapons: [{ def: signatureWeapon, level: startingWeaponLevel, count: signatureWeapon.count ?? 1, readyAt: 400 }],
    activeEvolution: evolved,
    knownRelicIds: [...new Set(setup.knownRelicIds ?? [])],
    activeRelicRecipe: undefined,
    appliedRelicRecipeIds: new Set(),
    passives: [],
    pickups: [],
    popups: [],
    particles: [],
    followers: [],
    ambient: [],
    lokPets: [],
    lokPetHistory: [],
    obstacles: area.obstacles
      .filter((o) => o.kind !== 'pothole')
      .map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h })),
    breakables: [],
    potholes: [],
    bounds: area.bounds,
    camera: { x: 0, y: 0 },
    shake: 0,
    audio: SILENT_FRAME,
    beatPulse: 0,
    downbeatPulse: 0,
    onsetPulse: 0,
    lastBeatIndex: 0,
    onBeatHits: 0,
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    pendingLevelUps: 0,
    weaponLevel: startingWeaponLevel,
    weaponCount: signatureWeapon.count ?? 1,
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
    ambientRng: createRng(seed + 0x5eed),
    grid: new Map(),
    rngSeed: seed,
    endless: undefined,
    physicsObjectClicksEnabled,
    wildlifeSheltersInRain: setup.wildlifeSheltersInRain !== false,
    challenges: [...challenges],
    activeCrewRumor: activeCrewRumor ? { ...activeCrewRumor } : null,
    rumorTriggered: activeCrewRumor?.rumorId === 'painted-shortcut',
    rumorOutcome: activeCrewRumor?.rumorId === 'painted-shortcut'
      ? 'Painted Shortcut boosted movement at run start.'
      : activeCrewRumor
        ? 'Rumor waiting for its first opening.'
        : '',
    rumorSpeedUntil: activeCrewRumor?.rumorId === 'painted-shortcut' ? 6500 : 0,
    rumorPantryAvailable: activeCrewRumor?.rumorId === 'pantry-surge',
    rumorBroadcastAvailable: activeCrewRumor?.rumorId === 'basement-broadcast',
    rumorMagnetNextAt: activeCrewRumor?.rumorId === 'magnet-parade' ? 8500 : Number.POSITIVE_INFINITY,
    firstNightChapter: getFirstNightChapter(area.id),
    firstNightBeatTriggered: false,
    districtIncursion: selectedIncursion
      ? {
          id: selectedIncursion.id,
          kind: selectedIncursion.kind,
          title: selectedIncursion.title,
          landmark: selectedIncursion.landmark,
          objectiveLabel: selectedIncursion.objectiveLabel,
          phase: 'pending',
          progress: 0,
          target: selectedIncursion.target,
          accent: selectedIncursion.accent,
          startedAt: 0,
          endsAt: 0,
          cycle: -1,
          nextPulseAt: 0,
          nextHazardTickAt: 0,
          outsideSafeSince: 0,
          startingKills: 0,
          rewardCred: selectedIncursion.rewardCred,
          rewardTokens: selectedIncursion.rewardTokens,
          rewardGranted: false,
          propUids: [],
        }
      : undefined,
    lootBoxMilestonesHit: new Set(),
    pendingReel: [],
    lootBoxesOpened: 0,
    openedPrizes: [],
    lootTokensGained: 0,
    objectives: rollStartingObjectives(rng, !!area.endless),
    completedObjectives: [],
    episode: setup.episode && setup.episode.characterId === character.id && setup.episode.areaId === area.id
      ? {
          def: setup.episode,
          startingProgress: Math.min(
            setup.episode.objective.targetCount,
            Math.max(0, Math.floor(setup.episodeProgress ?? 0)),
          ),
        }
      : undefined,
  };

  world.breakables = area.obstacles.filter((o) => o.kind !== 'pothole').map((o) => createBreakable(world, o));
  world.potholes = area.obstacles.filter((o) => o.kind === 'pothole').map((o) => createPothole(world, o));

  if (area.endless) {
    world.endless = {
      maxDistancePx: 0,
      currentBandId: 'core',
      discoveredBandIds: new Set(['core']),
      discoveredRouteEventIds: new Set(),
      routeEvent: null,
      hazardNextAt: 0,
      dungeonDepth: 0,
      inDungeon: false,
      inBuilding: false,
      buildingLabel: '',
      buildingPrefabId: null,
      buildingCenterX: 0,
      buildingCenterY: 0,
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
      lastLandmarkKey: null,
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
      buildings: [],
    };
    // The endless area bounds sentinel won't be used for clamping, but the
    // rescue system reads durationSec.  Keep rescue disabled in endless mode.
    world.rescue.status = 'freed';
  }

  if (signatureWeapon.kind === 'orbit') {
    rebuildOrbiters(world);
  }
  if (signatureWeapon.follower?.lifetimeMs === 0) spawnFollowers(world, signatureWeapon);
  return world;
}

function uid(w: World): number {
  w.nextUid += 1;
  return w.nextUid;
}

function createBreakable(w: World, obstacle: ObstacleDef): BreakableObstacle {
  const profile = propProfile(obstacle);
  const hp = profile.breakable ? (OBSTACLE_WEIGHT_PROFILES[obstacle.kind]?.hp ?? 60) : Number.POSITIVE_INFINITY;
  return {
    ...obstacle,
    uid: uid(w),
    kind: obstacle.kind,
    propVariant: profile.variant,
    hp,
    maxHp: hp,
    vx: 0,
    vy: 0,
    mass: profile.mass,
    friction: profile.friction,
    breakable: profile.breakable,
    movable: profile.movable,
    impactIntensity: 0,
    nextImpactDamageAt: 0,
    broken: false,
    brokenAt: 0,
    contacts: 0,
    lastPlayerImpactX: 0,
    lastPlayerImpactY: 0,
    clickPrimed: false,
    clickPrimedAt: 0,
    impactVelocityMultiplier: 1,
    chainActive: false,
    chainCycles: 0,
    chainVelocityBudget: 0,
    chainBoostPending: false,
    chainContactUids: new Set(),
    chainHitUids: new Set(),
    nextEnemyImpactAt: 0,
    landedHeatActive: false,
    heatNextTickAt: 0,
  };
}

function createPothole(w: World, obstacle: ObstacleDef): PotholeObstacle {
  const config = obstacle.pothole;
  return {
    x: obstacle.x,
    y: obstacle.y,
    w: obstacle.w,
    h: obstacle.h,
    uid: uid(w),
    state: 'dormant',
    trigger: config?.trigger ?? 'stomp',
    warningMs: config?.warningMs ?? 760,
    openingMs: config?.openingMs ?? 520,
    lethalRadius: config?.lethalRadius ?? Math.min(obstacle.w, obstacle.h) * 0.42,
    openingStartedAt: 0,
    openedAt: 0,
    resolvedAt: 0,
  };
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

function weaponEvolutionBehavior(w: World, weapon: WeaponDef): EvolutionBehavior | undefined {
  if (w.activeEvolution?.result.id === weapon.id) return w.activeEvolution.behavior;
  if (w.activeRelicRecipe?.result.id === weapon.id) return w.activeRelicRecipe.behavior;
  return undefined;
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

  const hp = def.hp * hpMult * w.challenges.reduce((multiplier, challenge) => multiplier * challenge.enemyHealthMultiplier, 1);
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
    damage: def.damage * w.challenges.reduce((multiplier, challenge) => multiplier * challenge.enemyDamageMultiplier, 1),
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
    falling: false,
    fallStartedAt: 0,
  };
  w.enemies.push(enemy);

  if (
    w.activeCrewRumor?.rumorId === 'basement-broadcast' &&
    w.rumorBroadcastAvailable &&
    (def.family === 'Elite' || def.family === 'Boss')
  ) {
    w.rumorBroadcastAvailable = false;
    w.rumorTriggered = true;
    w.rumorOutcome = `Basement Broadcast warned about ${def.name} before the arrival.`;
    pushAlert(w, `RUMOR — ${def.name} on the air`);
  }

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
    const spawnMultiplier = w.challenges.reduce((multiplier, challenge) => multiplier * challenge.enemySpawnMultiplier, 1);
    w.spawnCredit[i] = (w.spawnCredit[i] ?? 0) + wave.ratePerSec * spawnMultiplier * dt;
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
/* District setpiece incursions                                        */
/* ------------------------------------------------------------------ */

function incursionEffect(
  w: World,
  x: number,
  y: number,
  radius: number,
  color: string,
  lifetimeMs = 760,
) {
  w.effects.push({
    uid: uid(w),
    kind: 'hazard',
    x,
    y,
    radius,
    angle: 0,
    spread: Math.PI,
    bornAt: w.now,
    expiresAt: w.now + lifetimeMs,
    color,
    damage: 0,
    impactIntensity: 0,
    hitUids: new Set(),
    followPlayer: false,
  });
}

function incursionAnchor() {
  return { x: 0, y: -150 };
}

function startDistrictIncursion(w: World, state: DistrictIncursionState) {
  const def = DISTRICT_INCURSIONS_BY_ID[state.id];
  if (!def || state.phase !== 'warning') return;

  state.phase = 'active';
  state.startedAt = w.now;
  state.endsAt = w.now + def.durationSec * 1000;
  state.startingKills = w.kills;
  state.nextPulseAt = w.now;
  state.nextHazardTickAt = w.now;
  state.outsideSafeSince = 0;
  state.cycle = -1;
  pushAlert(w, `${def.title} — ${def.activeText}`);
  spawnParticles(w, 0, -150, def.accent, 22, 150);
  w.shake = Math.max(w.shake, 8);

  const anchor = incursionAnchor();
  if (state.kind === 'flood-surge') {
    for (const offset of [-260, -120, 120, 260]) {
      spawnEnemy(w, getEnemy('river-wraith'), 1.08, { x: anchor.x + offset, y: anchor.y + 40 });
    }
  } else if (state.kind === 'market-bell') {
    const crowd = [
      ['belfry-bat', -210, -50],
      ['belfry-bat', -120, 40],
      ['corner-cutter', -250, 90],
      ['corner-cutter', 210, 90],
      ['belfry-bat', 120, 40],
      ['belfry-bat', 210, -50],
      ['bloodhound', -70, 110],
      ['bloodhound', 70, 110],
    ] as const;
    for (const [enemyId, x, y] of crowd) {
      spawnEnemy(w, getEnemy(enemyId), 1.12, { x: anchor.x + x, y: anchor.y + y });
    }
  } else if (state.kind === 'freight-arrival') {
    for (const [enemyId, x, y] of [
      ['lightless-prowler', -250, -120],
      ['bloodhound', 250, -120],
      ['river-wraith', -260, 120],
      ['crypt-bouncer', 250, 120],
    ] as const) {
      spawnEnemy(w, getEnemy(enemyId), enemyId === 'crypt-bouncer' ? 0.78 : 1.08, {
        x: anchor.x + x,
        y: anchor.y + y,
      });
    }
    for (const [index, x] of [-230, 0, 230].entries()) {
      const freight = createBreakable(w, {
        x,
        y: anchor.y + (index - 1) * 72,
        w: 156,
        h: 46,
        kind: 'car-wreck',
        propVariant: 'medium-movable',
      });
      freight.vx = index % 2 === 0 ? 130 : -130;
      state.propUids.push(freight.uid);
      w.breakables.push(freight);
    }
    syncObstacleAabbs(w);
  } else if (state.kind === 'fountain-ritual') {
    for (const [enemyId, x, y] of [
      ['ring-scribe', -250, -80],
      ['ring-scribe', 250, -80],
      ['ash-wisp', -220, 120],
      ['ash-wisp', 220, 120],
      ['corner-cutter', 0, 190],
    ] as const) {
      spawnEnemy(w, getEnemy(enemyId), 1.1, { x: anchor.x + x, y: anchor.y + y });
    }
    // Reuse plaza planters as the ritual's rearranging cover. If an authored
    // layout has fewer than four, supplement it with the same live prop type.
    const existing = w.breakables.filter((prop) => prop.kind === 'planter').slice(0, 4);
    state.propUids.push(...existing.map((prop) => prop.uid));
    for (let i = existing.length; i < 4; i += 1) {
      const planter = createBreakable(w, {
        x: 0,
        y: -150,
        w: 52,
        h: 52,
        kind: 'planter',
        propVariant: 'fixed-bench',
      });
      state.propUids.push(planter.uid);
      w.breakables.push(planter);
    }
    syncObstacleAabbs(w);
  }
}

function finishDistrictIncursion(w: World, completed: boolean) {
  const state = w.districtIncursion;
  if (!state || (state.phase !== 'active' && state.phase !== 'warning')) return;
  const def = DISTRICT_INCURSIONS_BY_ID[state.id];
  if (!def) return;

  state.phase = completed ? 'complete' : 'failed';
  if (completed && !state.rewardGranted) {
    state.rewardGranted = true;
    w.cred += state.rewardCred;
    w.lootTokensGained += state.rewardTokens;
    pushAlert(w, def.completeText);
    spawnParticles(w, 0, -150, def.accent, 18, 120);
  } else if (!completed) {
    pushAlert(w, def.failureText);
  }
  if (state.kind === 'freight-arrival') {
    for (const prop of w.breakables) {
      if (state.propUids.includes(prop.uid)) {
        prop.vx = 0;
        prop.vy = 0;
      }
    }
  }
}

function incursionSafeLane(state: DistrictIncursionState): number {
  return ((state.cycle + 1) % 3 - 1) * 180;
}

function incursionSafeSector(state: DistrictIncursionState): number {
  return Math.PI / 2 + (state.cycle % 4) * (Math.PI / 2);
}

function inSafeSector(w: World, state: DistrictIncursionState): boolean {
  const anchor = incursionAnchor();
  const dx = w.player.x - anchor.x;
  const dy = w.player.y - anchor.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 330) return false;
  const angle = Math.atan2(dy, dx);
  let diff = angle - incursionSafeSector(state);
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= 0.88;
}

function updateDistrictIncursion(w: World, dt: number) {
  const state = w.districtIncursion;
  if (!state) return;
  const def = DISTRICT_INCURSIONS_BY_ID[state.id];
  if (!def) return;

  if (state.phase === 'pending' && w.time >= def.triggerAtSec - def.warningLeadSec) {
    state.phase = 'warning';
    pushAlert(w, `${def.title} — ${def.warningText}`);
    spawnParticles(w, 0, -150, def.accent, 10, 80);
  }
  if (state.phase === 'warning' && w.time >= def.triggerAtSec) startDistrictIncursion(w, state);
  if (state.phase !== 'active') return;

  const elapsed = Math.max(0, (w.now - state.startedAt) / 1000);
  state.cycle = Math.floor(elapsed / (state.kind === 'fountain-ritual' ? 3.6 : state.kind === 'flood-surge' ? 4 : 5));

  if (state.kind === 'market-bell') {
    state.progress = Math.min(state.target, Math.max(0, w.kills - state.startingKills));
    if (w.now >= state.nextPulseAt) {
      state.nextPulseAt = w.now + 3000;
      const anchor = incursionAnchor();
      incursionEffect(w, anchor.x, anchor.y, 160, state.accent, 580);
      for (const enemy of w.enemies) {
        if (enemy.dying) continue;
        const dx = enemy.x - anchor.x;
        const dy = enemy.y - anchor.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 220) continue;
        const length = distance || 1;
        const force = 180 * Math.max(0.25, 1 - distance / 220);
        enemy.kx += (dx / length) * force;
        enemy.ky += (dy / length) * force;
      }
      spawnParticles(w, anchor.x, anchor.y, state.accent, 8, 90);
      pushAlert(w, 'BELL PULSE — crowd pushed back');
    }
  } else if (state.kind === 'freight-arrival') {
    for (const [index, prop] of state.propUids.map((uid) => w.breakables.find((candidate) => candidate.uid === uid)).entries()) {
      if (!prop || prop.broken) continue;
      const direction = state.cycle % 2 === 0 ? 1 : -1;
      prop.vx = direction * (120 + index * 18);
      prop.vy = 0;
      if (prop.x > w.bounds.w / 2 - 110 || prop.x < -w.bounds.w / 2 + 110) prop.vx *= -1;
    }
    const covered = state.propUids.some((propUid) => {
      const prop = w.breakables.find((candidate) => candidate.uid === propUid);
      return prop && !prop.broken && dist2(w.player.x, w.player.y, prop.x, prop.y) < 125 * 125;
    });
    if (covered) state.progress = Math.min(state.target, state.progress + dt);
  } else {
    const safe = state.kind === 'flood-surge'
      ? Math.abs(w.player.x - incursionSafeLane(state)) <= 92
      : inSafeSector(w, state);
    if (safe) {
      state.progress = Math.min(state.target, state.progress + dt);
      state.outsideSafeSince = 0;
    } else {
      if (state.outsideSafeSince === 0) state.outsideSafeSince = w.now;
      if (w.now >= state.nextHazardTickAt) {
        state.nextHazardTickAt = w.now + 760;
        damagePlayer(w, state.kind === 'flood-surge' ? 5 : 4, w.player.x + (w.player.x >= 0 ? 90 : -90), w.player.y);
      }
      if (w.now - state.outsideSafeSince > 4600) {
        finishDistrictIncursion(w, false);
        return;
      }
    }
    if (w.now >= state.nextPulseAt) {
      state.nextPulseAt = w.now + (state.kind === 'flood-surge' ? 4000 : 3600);
      const anchor = incursionAnchor();
      incursionEffect(w, state.kind === 'flood-surge' ? incursionSafeLane(state) : anchor.x, anchor.y, 125, state.accent, 900);
      spawnParticles(w, anchor.x, anchor.y, state.accent, 7, 90);
    }
  }

  if (state.progress >= state.target) {
    finishDistrictIncursion(w, true);
  } else if (w.now >= state.endsAt) {
    finishDistrictIncursion(w, false);
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
  novaDamage(w, x, y, radius, damage, explosive ? 4 : 2, statusEffectId);
  damageBreakable(w, x, y, radius, damage, explosive ? 4 : 2, x, y);
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
    impactIntensity: 0,
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
    impactIntensity: pet.attackKind === 'heavy-shot' ? 4 : 1,
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
        damageEnemy(w, target, follower.damage * damageMult(w), WEAPONS_BY_ID[follower.weaponId]?.impactIntensity ?? 1, follower.x, follower.y);
        spawnParticles(w, follower.x, follower.y, follower.color, 3, 55);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Ambient background life                                             */
/* ------------------------------------------------------------------ */

/** Background actors kept alive at once -- enough to feel lived-in, cheap to step. */
const AMBIENT_POPULATION = 7;
/** Endless mode recycles anyone this far from the player back into view. */
const AMBIENT_RECYCLE_DISTANCE = 1100;
/** Ambient actors never spawn closer than this to the player. */
const AMBIENT_SPAWN_CLEARANCE = 150;

function ambientRange(w: World, min: number, max: number): number {
  return min + w.ambientRng() * (max - min);
}

/** No street life under a roof: authored interiors, dungeon rooms, buildings. */
function ambientSuppressed(w: World): boolean {
  return w.area.sky === 'roofed' || Boolean(w.endless?.inDungeon || w.endless?.inBuilding);
}

/**
 * A spot clear of props and away from the player. Ambient actors are never
 * collided with, so this only keeps them from *starting* inside a wall --
 * it is placement, not physics.
 */
function pickAmbientSpot(w: World): { x: number; y: number } {
  let fallbackX = w.player.x;
  let fallbackY = w.player.y;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    let x: number;
    let y: number;
    if (w.area.endless) {
      const angle = w.ambientRng() * Math.PI * 2;
      const radius = ambientRange(w, 430, 780);
      x = w.player.x + Math.cos(angle) * radius;
      y = w.player.y + Math.sin(angle) * radius;
    } else {
      const halfW = Math.max(20, w.bounds.w / 2 - 44);
      const halfH = Math.max(20, w.bounds.h / 2 - 44);
      x = ambientRange(w, -halfW, halfW);
      y = ambientRange(w, -halfH, halfH);
    }
    fallbackX = x;
    fallbackY = y;
    if (dist2(x, y, w.player.x, w.player.y) < AMBIENT_SPAWN_CLEARANCE ** 2) continue;
    const insideProp = w.obstacles.some(
      (box) => Math.abs(x - box.x) < box.w / 2 + 14 && Math.abs(y - box.y) < box.h / 2 + 14,
    );
    if (!insideProp) return { x, y };
  }
  return { x: fallbackX, y: fallbackY };
}

function spawnAmbientActor(w: World): AmbientActor {
  const kind = AMBIENT_KINDS[Math.floor(w.ambientRng() * AMBIENT_KINDS.length)] ?? AMBIENT_KINDS[0]!;
  const spot = pickAmbientSpot(w);
  const target = pickAmbientSpot(w);
  return {
    uid: w.nextUid++,
    kindId: kind.id,
    x: spot.x,
    y: spot.y,
    vx: 0,
    vy: 0,
    facing: w.ambientRng() < 0.5 ? -1 : 1,
    anim: 'idle',
    animStartedAt: w.now,
    targetX: target.x,
    targetY: target.y,
    nextWanderAt: w.now + ambientRange(w, 900, 4200),
  };
}

/**
 * Civilians and cats wander until the player gets close, then bolt away.
 * Deliberately outside every collision/damage path: they are scenery that
 * happens to move.
 */
function updateAmbient(w: World, dt: number) {
  if (ambientSuppressed(w)) return;

  while (w.ambient.length < AMBIENT_POPULATION) {
    w.ambient.push(spawnAmbientActor(w));
  }

  const halfW = w.bounds.w / 2;
  const halfH = w.bounds.h / 2;

  for (const actor of w.ambient) {
    const kind = AMBIENT_KINDS.find((k) => k.id === actor.kindId) ?? AMBIENT_KINDS[0]!;
    const toPlayerX = actor.x - w.player.x;
    const toPlayerY = actor.y - w.player.y;
    const playerDistance = Math.hypot(toPlayerX, toPlayerY);

    // Endless streams outward forever, so anyone left far behind is reused.
    if (w.area.endless && playerDistance > AMBIENT_RECYCLE_DISTANCE) {
      Object.assign(actor, spawnAmbientActor(w), { uid: actor.uid });
      continue;
    }

    let dirX: number;
    let dirY: number;
    let speed: number;
    const fleeing = playerDistance < kind.fleeRadius;
    if (fleeing) {
      const len = playerDistance || 1;
      dirX = toPlayerX / len;
      dirY = toPlayerY / len;
      speed = kind.speed * kind.fleeSpeedMult;
    } else {
      if (w.now >= actor.nextWanderAt) {
        const next = pickAmbientSpot(w);
        actor.targetX = next.x;
        actor.targetY = next.y;
        actor.nextWanderAt = w.now + ambientRange(w, 900, 4200);
      }
      const dx = actor.targetX - actor.x;
      const dy = actor.targetY - actor.y;
      const len = Math.hypot(dx, dy);
      if (len < 12) {
        actor.vx = 0;
        actor.vy = 0;
        if (actor.anim !== 'idle') {
          actor.anim = 'idle';
          actor.animStartedAt = w.now;
        }
        continue;
      }
      dirX = dx / len;
      dirY = dy / len;
      speed = kind.speed;
    }

    actor.vx = dirX * speed;
    actor.vy = dirY * speed;
    actor.x += actor.vx * dt;
    actor.y += actor.vy * dt;

    if (!w.area.endless) {
      actor.x = clamp(actor.x, -halfW + 10, halfW - 10);
      actor.y = clamp(actor.y, -halfH + 10, halfH - 10);
    }

    if (Math.abs(dirX) > 0.05) actor.facing = dirX > 0 ? 1 : -1;
    if (actor.anim !== 'walk') {
      actor.anim = 'walk';
      actor.animStartedAt = w.now;
    }
  }
}

function emitEnemyImpactBurst(
  w: World,
  source: EnemyActor,
  amount: number,
  color: string,
) {
  const radius = 58;
  const burstDamage = Math.max(1, Math.round(amount * 0.22));
  forEachNearby(w, source.x, source.y, radius + 30, (enemy) => {
    if (enemy === source || enemy.dying) return;
    const reach = radius + enemy.radius;
    if (dist2(enemy.x, enemy.y, source.x, source.y) > reach * reach) return;
    // Secondary hits deliberately use a shove, not the burst threshold, so
    // one impact cannot recursively duplicate its own reward chain.
    damageEnemy(w, enemy, burstDamage, 1, source.x, source.y, undefined, 1);
  });
  w.effects.push({
    uid: uid(w),
    kind: 'nova',
    x: source.x,
    y: source.y,
    radius,
    angle: 0,
    spread: 0,
    bornAt: w.now,
    expiresAt: w.now + 240,
    color,
    damage: 0,
    impactIntensity: 0,
    hitUids: new Set(),
    followPlayer: false,
  });
  spawnParticles(w, source.x, source.y, color, 12, 150);
  w.popups.push({
    x: source.x,
    y: source.y + source.radius + 14,
    text: 'BURST',
    color: '#fff1a8',
    bornAt: w.now,
    vy: 30,
  });
  w.shake = Math.max(w.shake, 6);
}

function damageEnemy(
  w: World,
  enemy: EnemyActor,
  amount: number,
  impactIntensity: ImpactIntensity,
  fromX: number,
  fromY: number,
  statusEffectId?: string,
  burstDepth = 0,
) {
  if (enemy.dying) return;
  if (statusEffectId) applyStatusEffect(w, enemy, statusEffectId);
  const isCrit = burstDepth === 0 && w.rng() < w.stats.crit;
  // Landing a hit on the beat is its own bonus, stacking with a rolled crit.
  const onBeat = burstDepth === 0 && isOnBeat(w);
  const beatBonus = onBeat ? ON_BEAT_CRIT_MULT : 1;
  const dealt = Math.max(1, Math.round((isCrit ? amount * 2 : amount) * beatBonus));
  if (onBeat) w.onBeatHits += 1;
  enemy.hp -= dealt;
  enemy.hitFlashUntil = w.now + 90;

  if (w.stats.lifesteal > 0 && burstDepth === 0) {
    w.player.hp = clamp(w.player.hp + dealt * w.stats.lifesteal, 0, w.player.maxHp);
  }

  if (impactIntensity > 0) {
    const dx = enemy.x - fromX;
    const dy = enemy.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const impulse = resolveImpactTravel(impactIntensity, enemy.mass, enemyImpactResistance(enemy));
    enemy.kx += (dx / len) * impulse;
    enemy.ky += (dy / len) * impulse;
  }

  w.popups.push({
    x: enemy.x + randRange(w.rng, -5, 5),
    y: enemy.y + enemy.radius + 10,
    text: isCrit ? `${dealt}!` : String(dealt),
    color: isCrit ? '#ff5c5c' : '#ffe8a3',
    bornAt: w.now,
    vy: isCrit ? 34 : 26,
  });
  if (w.popups.length > 40) w.popups.shift();

  if (impactIntensity >= 5 && burstDepth === 0) {
    emitEnemyImpactBurst(w, enemy, dealt, '#fff1a8');
  }

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
  if (enemy.dying) return;
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

function triggerBellShock(w: World) {
  if (w.activeCrewRumor?.rumorId !== 'bell-shock' || w.rumorTriggered) return;
  w.rumorTriggered = true;
  w.rumorOutcome = 'Bell Shock shoved nearby threats away on first contact.';
  const radius = 132;
  for (const enemy of w.enemies) {
    if (enemy.dying) continue;
    const dx = enemy.x - w.player.x;
    const dy = enemy.y - w.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > radius + enemy.radius) continue;
    const length = distance || 1;
    const force = 260 * Math.max(0.35, 1 - distance / (radius + enemy.radius));
    enemy.kx += (dx / length) * force;
    enemy.ky += (dy / length) * force;
  }
  w.effects.push({
    uid: uid(w),
    kind: 'nova',
    x: w.player.x,
    y: w.player.y,
    radius,
    angle: 0,
    spread: 0,
    bornAt: w.now,
    expiresAt: w.now + 260,
    color: '#fbbf24',
    damage: 0,
    impactIntensity: 0,
    hitUids: new Set(),
    followPlayer: false,
  });
  spawnParticles(w, w.player.x, w.player.y, '#fbbf24', 16, 150);
  w.shake = Math.max(w.shake, 9);
  pushAlert(w, 'RUMOR — BELL SHOCK');
}

function damagePlayer(
  w: World,
  amount: number,
  fromX: number,
  fromY: number,
  source: 'contact' | 'hazard' = 'hazard',
) {
  const p = w.player;
  if (p.falling || w.outcome !== 'running') return;
  if (w.now < p.invulnUntil) return;
  if (ultActive(w) && w.character.ultimate.effect.invulnerable) return;

  if (source === 'contact') triggerBellShock(w);
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
    w.deathCause = 'ordinary-hazard';
    p.anim = 'death';
    p.animStartedAt = w.now;
  }
}

/** Damage every enemy inside a circle once. */
function novaDamage(w: World, x: number, y: number, radius: number, damage: number, impactIntensity: ImpactIntensity, statusEffectId?: string) {
  forEachNearby(w, x, y, radius + 40, (enemy) => {
    if (enemy.dying) return;
    const reach = radius + enemy.radius;
    if (dist2(enemy.x, enemy.y, x, y) <= reach * reach) {
      damageEnemy(w, enemy, damage, impactIntensity, x, y, statusEffectId);
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

function triggerEvolutionHit(
  w: World,
  behavior: EvolutionBehavior | undefined,
  x: number,
  y: number,
  damage: number,
  color: string,
  impactIntensity: ImpactIntensity,
  statusEffectId?: string,
  excludeUid?: number,
) {
  if (!behavior) return;
  const radius = behavior.radius ?? 64;
  if (behavior.kind === 'chain') {
    const target = nearestEnemy(w, x, y, radius + 90, excludeUid ? new Set([excludeUid]) : undefined);
    if (target) {
      damageEnemy(w, target, damage * 0.55, 0, x, y, statusEffectId);
      spawnParticles(w, target.x, target.y, color, 4, 55);
    }
  } else if (behavior.kind === 'status-spread') {
    novaDamage(w, x, y, radius, damage * 0.45, 0, behavior.statusEffectId ?? statusEffectId);
  } else if (behavior.kind === 'field') {
    w.effects.push({
      uid: uid(w),
      kind: 'hazard',
      x,
      y,
      radius,
      angle: 0,
      spread: Math.PI * 2,
      bornAt: w.now,
      expiresAt: w.now + 1250,
      color,
      damage: damage * 0.42,
      impactIntensity: Math.min(2, impactIntensity) as ImpactIntensity,
      hitUids: new Set(),
      followPlayer: false,
      nextTickAt: w.now,
      hurtsPlayer: false,
      statusEffectId: behavior.statusEffectId ?? statusEffectId,
    });
    spawnParticles(w, x, y, color, 8, 70);
  }
}

function fireWeapon(w: World, runWeapon: RunWeapon) {
  const weapon = runWeapon.def;
  const p = w.player;
  const damage = runWeaponDamage(w, runWeapon);
  const reach = weapon.range * areaMult(w);
  const palette = w.character.palette;
  const behavior = weaponEvolutionBehavior(w, weapon);

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
        impactIntensity: weaponImpact(weapon),
        impactTrigger: weapon.impactTrigger,
        hitUids: new Set(),
        followPlayer: true,
        evolutionBehavior: behavior,
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
        impactIntensity: weaponImpact(weapon),
        impactTrigger: weapon.impactTrigger,
        hitUids: new Set(),
        followPlayer: false,
        evolutionBehavior: behavior,
      });
      novaDamage(w, p.x, p.y, reach, damage, weaponImpact(weapon), weapon.statusEffectId);
      if (behavior?.kind === 'field') {
        triggerEvolutionHit(w, behavior, p.x, p.y, damage, weapon.color ?? palette.accent, weaponImpact(weapon), weapon.statusEffectId);
      }
      damageBreakable(w, p.x, p.y, reach, damage, weaponImpact(weapon), p.x, p.y, weapon.impactTrigger);
      p.anim = 'attack';
      p.animStartedAt = w.now;
      w.shake = Math.max(w.shake, 3);
      break;
    }

    case 'aura': {
      // The aura is permanent; each activation is a damage tick.
      novaDamage(w, p.x, p.y, reach, damage, weaponImpact(weapon));
      damageBreakable(w, p.x, p.y, reach, damage, weaponImpact(weapon), p.x, p.y, weapon.impactTrigger);
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
          color: weapon.color ?? palette.accent, damage, impactIntensity: weaponImpact(weapon), impactTrigger: weapon.impactTrigger, hitUids: new Set(), followPlayer: false,
          evolutionBehavior: behavior,
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
         damage, impactIntensity: weaponImpact(weapon), impactTrigger: weapon.impactTrigger, hitUids: new Set(), followPlayer: false,
        evolutionBehavior: behavior,
      });
      p.anim = 'attack'; p.animStartedAt = w.now;
      break;
    }

    case 'hazard': {
      w.effects.push({
        uid: uid(w), kind: 'hazard', x: p.x, y: p.y, radius: reach, angle: 0, spread: Math.PI * 2,
        bornAt: w.now, expiresAt: w.now + (weapon.durationMs ?? 5000), color: weapon.color ?? palette.accent,
        damage, impactIntensity: weaponImpact(weapon), hitUids: new Set(), followPlayer: false, nextTickAt: w.now,
        hurtsPlayer: true,
        statusEffectId: weapon.statusEffectId,
        evolutionBehavior: behavior,
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
        novaDamage(w, p.x, p.y, 42, damage, weaponImpact(weapon), weapon.statusEffectId);
        damageBreakable(w, p.x, p.y, 42, damage, weaponImpact(weapon), p.x, p.y, weapon.impactTrigger);
        w.effects.push({ uid: uid(w), kind: 'teleport', x: p.x, y: p.y, radius: 42, angle: 0, spread: 0,
          bornAt: w.now, expiresAt: w.now + 420, color: weapon.color ?? palette.accent, damage: 0, impactIntensity: 0,
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
      const ix = target ? target.x : p.x + Math.cos(angle) * reach * 0.6;
      const iy = target ? target.y : p.y + Math.sin(angle) * reach * 0.6;
      w.effects.push({ uid: uid(w), kind: 'impact', x: ix, y: iy, radius: reach, angle, spread: Math.PI,
        bornAt: w.now, expiresAt: w.now + (weapon.durationMs ?? 420), color: weapon.color ?? palette.accent,
        damage, impactIntensity: weaponImpact(weapon), impactTrigger: weapon.impactTrigger, hitUids: new Set(), followPlayer: false });
      spawnParticles(w, ix, iy, weapon.color ?? palette.accent, 14, 130);
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
          impactIntensity: weaponImpact(weapon),
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
          impactTrigger: weapon.impactTrigger,
          evolutionBehavior: behavior,
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
        uid: uid(w), x, y, vx, vy: 0, radius: 24, damage, impactIntensity: weaponImpact(weapon),
        fromPlayer: true, expiresAt: w.now + (weapon.lifetimeMs ?? 1200), targetUid: null,
        turnRate: 0, color: weapon.color ?? palette.accent, trail: [], pierce: 999,
        hitUids: new Set(),
        obstacleUids: new Set(),
        impactTrigger: weapon.impactTrigger,
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
        damageEnemy(w, enemy, damage, weaponImpact(weapon), ox, oy);
        const behavior = weaponEvolutionBehavior(w, weapon);
        if (behavior?.kind === 'orbit-burst') {
          const burstRadius = behavior.radius ?? 56;
          novaDamage(w, ox, oy, burstRadius, damage * 0.35, 0, behavior.statusEffectId);
          w.effects.push({
            uid: uid(w),
            kind: 'ring',
            x: ox,
            y: oy,
            radius: burstRadius,
            angle: 0,
            spread: 0,
            bornAt: w.now,
            expiresAt: w.now + 220,
            color: weapon.color ?? w.character.palette.accent,
            damage: 0,
            impactIntensity: 0,
            hitUids: new Set(),
            followPlayer: false,
          });
        }
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
    novaDamage(w, w.player.x, w.player.y, radius, ult.effect.novaDamage * w.stats.power, 4);
    damageBreakable(w, w.player.x, w.player.y, radius, ult.effect.novaDamage * w.stats.power, 4, w.player.x, w.player.y);
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
      impactIntensity: 0,
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

export function relicRecipeEligibility(
  w: Pick<World, 'knownRelicIds' | 'appliedRelicRecipeIds' | 'weapons' | 'activeEvolution'>,
  recipe: RelicRecipeDef,
): { eligible: boolean; reason: string } {
  if (!w.knownRelicIds.includes(recipe.relicId)) {
    return { eligible: false, reason: 'Find its city relic knowledge first.' };
  }
  if (w.appliedRelicRecipeIds.has(recipe.id)) {
    return { eligible: false, reason: 'Already applied during this run.' };
  }
  const weapon = w.weapons.find((entry) => entry.def.id === recipe.baseWeaponId);
  if (!weapon) {
    if (w.activeEvolution?.baseWeaponId === recipe.baseWeaponId) {
      return { eligible: false, reason: 'The signature evolution is active; this relic recipe stays separate.' };
    }
    return { eligible: false, reason: `Bring ${recipe.baseWeaponId} into the run first.` };
  }
  if (weapon.def.id === recipe.result.id) {
    return { eligible: false, reason: 'This weapon already carries the relic treatment.' };
  }
  if (weapon.level < recipe.minWeaponLevel) {
    return { eligible: false, reason: `Level the base weapon to Lv ${recipe.minWeaponLevel}.` };
  }
  return { eligible: true, reason: recipe.triggerLabel };
}

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
  for (const recipe of RELIC_RECIPES) {
    const eligibility = relicRecipeEligibility(w, recipe);
    if (eligibility.eligible) {
      pool.push({
        id: `relic-${recipe.id}`,
        name: recipe.name,
        description: recipe.description,
        weight: 12,
        maxStacks: 1,
        effects: [],
        cardKind: 'relic-evolution',
        relicRecipeId: recipe.id,
      });
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
  if (upgrade.cardKind === 'relic-evolution' && upgrade.relicRecipeId) {
    const recipe = RELIC_RECIPES_BY_ID[upgrade.relicRecipeId];
    if (!recipe || !relicRecipeEligibility(w, recipe).eligible) return;
  }
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
  if (upgrade.cardKind === 'relic-evolution' && upgrade.relicRecipeId) {
    const recipe = RELIC_RECIPES_BY_ID[upgrade.relicRecipeId];
    const eligibility = recipe ? relicRecipeEligibility(w, recipe) : undefined;
    const weapon = recipe && w.weapons.find((entry) => entry.def.id === recipe.baseWeaponId);
    if (recipe && eligibility?.eligible && weapon) {
      weapon.def = recipe.result;
      weapon.level = Math.min(8, weapon.level + 1);
      w.activeRelicRecipe = recipe;
      w.appliedRelicRecipeIds.add(recipe.id);
      if (weapon.def.kind === 'orbit') rebuildOrbiters(w, weapon);
      pushAlert(w, `${recipe.name} evolved · relic recipe`);
      w.popups.push({
        x: w.player.x,
        y: w.player.y + 30,
        text: `RELIC · ${recipe.name}`,
        color: recipe.color,
        bornAt: w.now,
        vy: 30,
      });
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

function activatePotholes(w: World, x: number, y: number, radius: number, trigger?: PotholeTrigger) {
  if (!trigger) return;
  for (const pothole of w.potholes) {
    if (pothole.state !== 'dormant' || pothole.trigger !== trigger) continue;
    if (Math.abs(x - pothole.x) > pothole.w / 2 + radius || Math.abs(y - pothole.y) > pothole.h / 2 + radius) continue;
    pothole.state = 'opening';
    pothole.openingStartedAt = w.now;
    spawnParticles(w, pothole.x, pothole.y, '#f97316', 12, 100);
    w.shake = Math.max(w.shake, 5);
    pushAlert(w, 'GROUND BREAK — POTHOLE OPENING');
    w.popups.push({ x: pothole.x, y: pothole.y - pothole.h / 2 - 12, text: 'MOVE', color: '#ffb347', bornAt: w.now, vy: 26 });
  }
}

/** Prime the nearest movable prop for a single, boosted reverse launch. */
export function primePhysicsObject(w: World, x: number, y: number): BreakableObstacle | null {
  if (!w.physicsObjectClicksEnabled) return null;
  const target = w.breakables
    .filter((b) => !b.broken && b.movable)
    .filter((b) => Math.abs(x - b.x) <= b.w / 2 + 12 && Math.abs(y - b.y) <= b.h / 2 + 12)
    .sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2))[0];
  if (!target) return null;
  target.clickPrimed = true;
  target.clickPrimedAt = w.now;
  w.popups.push({ x: target.x, y: target.y - target.h / 2 - 14, text: 'NEXT HIT: REVERSE LAUNCH', color: '#7dd3fc', bornAt: w.now, vy: 20 });
  return target;
}

function resetPropChain(prop: BreakableObstacle, active = false) {
  prop.chainActive = active;
  prop.chainCycles = 0;
  prop.chainVelocityBudget = active ? PROP_CHAIN_MAX_SPEED : 0;
  prop.chainBoostPending = false;
  prop.chainContactUids.clear();
  prop.chainHitUids.clear();
  prop.landedHeatActive = false;
  prop.heatNextTickAt = 0;
}

function startEnemyPropChain(w: World, prop: BreakableObstacle, enemy: EnemyActor) {
  if (prop.landedHeatActive) resetPropChain(prop);
  if (prop.chainActive && prop.chainContactUids.has(enemy.uid)) return;
  if (!prop.chainActive) {
    resetPropChain(prop, true);
    w.popups.push({
      x: prop.x,
      y: prop.y - prop.h / 2 - 12,
      text: 'IMPACT CHAIN',
      color: '#ffb347',
      bornAt: w.now,
      vy: 24,
    });
  }
  prop.chainContactUids.add(enemy.uid);

  let dx = prop.x - enemy.x;
  let dy = prop.y - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  dx /= length;
  dy /= length;
  const isHeavy = prop.propVariant === 'heavy-metal';
  const intensity = isHeavy ? 4 : prop.propVariant === 'light-breakable' ? 2 : 3;
  const launchSpeed = resolveImpactTravel(
    intensity,
    prop.mass,
    isHeavy ? 0.15 : 0,
  );
  const enemyMomentum = Math.max(80, enemy.speed * 0.7) / Math.max(1, prop.mass);
  // Heavy props need a slow, deliberate shove that still reaches the moving
  // damage threshold; the other profiles keep their quick arcade response.
  const launchScale = isHeavy ? 1.8 : 0.78;
  prop.vx += dx * (launchSpeed * launchScale + enemyMomentum);
  prop.vy += dy * (launchSpeed * launchScale + enemyMomentum);
  prop.impactIntensity = Math.max(prop.impactIntensity, intensity) as ImpactIntensity;
  prop.nextEnemyImpactAt = w.now + (prop.chainCycles === 0 ? PROP_CHAIN_FIRST_HIT_DELAY_MS : PROP_CHAIN_CONTACT_COOLDOWN_MS);
  spawnParticles(w, prop.x, prop.y, '#ffb347', 5, 80);
  w.shake = Math.max(w.shake, 3);
}

function activateLandedHeat(w: World, prop: BreakableObstacle) {
  if (prop.landedHeatActive) return;
  prop.vx = 0;
  prop.vy = 0;
  prop.landedHeatActive = true;
  prop.heatNextTickAt = w.now;
  w.popups.push({
    x: prop.x,
    y: prop.y - prop.h / 2 - 12,
    text: 'SUPERHEATED',
    color: '#ff4d5e',
    bornAt: w.now,
    vy: 22,
  });
  spawnParticles(w, prop.x, prop.y, '#ff4d5e', 12, 120);
  w.shake = Math.max(w.shake, 4);
}

function updateLandedHeat(w: World, prop: BreakableObstacle) {
  if (!prop.landedHeatActive || w.now < prop.heatNextTickAt) return;
  prop.heatNextTickAt = w.now + PROP_HEAT_TICK_MS;
  if (dist2(w.player.x, w.player.y, prop.x, prop.y) <= (LANDED_HEAT_RADIUS + w.player.radius) ** 2) {
    damagePlayer(w, PROP_HEAT_DAMAGE, prop.x, prop.y);
  }
  for (const enemy of w.enemies) {
    if (enemy.dying || dist2(enemy.x, enemy.y, prop.x, prop.y) > (LANDED_HEAT_RADIUS + enemy.radius) ** 2) continue;
    damageEnemy(w, enemy, PROP_HEAT_DAMAGE * w.stats.power, 0, prop.x, prop.y, 'burning');
  }
  spawnParticles(w, prop.x, prop.y, '#ff4d5e', 3, 55);
}

function applyPropImpact(
  w: World,
  x: number,
  y: number,
  radius: number,
  intensity: ImpactIntensity,
  fromX = x,
  fromY = y,
  impactTrigger?: PotholeTrigger,
  fromPlayer = true,
) {
  if (intensity <= 0) return;
  activatePotholes(w, x, y, radius, impactTrigger);
  for (const b of w.breakables) {
    if (b.broken || !b.movable || Math.abs(x - b.x) > b.w / 2 + radius || Math.abs(y - b.y) > b.h / 2 + radius) continue;
    const requiredIntensity = b.propVariant === 'heavy-metal' ? 4 : b.propVariant === 'medium-movable' ? 2 : 1;
    let dx = b.x - fromX;
    let dy = b.y - fromY;
    let length = Math.hypot(dx, dy);
    if (length < 0.01) {
      dx = b.x - w.player.x;
      dy = b.y - w.player.y;
      length = Math.hypot(dx, dy);
    }
    if (length < 0.01) {
      dx = 1;
      dy = 0;
      length = 1;
    }
    dx /= length;
    dy /= length;
    if (fromPlayer) {
      b.lastPlayerImpactX = dx;
      b.lastPlayerImpactY = dy;
    }
    if (intensity < requiredIntensity) continue;
    if (b.landedHeatActive) resetPropChain(b);
    const reverseLaunch = fromPlayer && b.clickPrimed;
    const launchDirectionX = reverseLaunch ? -b.lastPlayerImpactX : dx;
    const launchDirectionY = reverseLaunch ? -b.lastPlayerImpactY : dy;
    const velocityMultiplier = reverseLaunch ? 4 : 1;
    if (reverseLaunch) b.clickPrimed = false;
    b.impactVelocityMultiplier = velocityMultiplier;
    const launchSpeed = resolveImpactTravel(intensity, b.mass, b.propVariant === 'heavy-metal' ? 0.15 : 0) * velocityMultiplier;
    const pushScale = b.propVariant === 'heavy-metal' ? 0.62 : 0.78;
    b.vx += launchDirectionX * launchSpeed * pushScale;
    b.vy += launchDirectionY * launchSpeed * pushScale;
    b.impactIntensity = intensity > b.impactIntensity ? intensity : b.impactIntensity;
    if (intensity >= 3) {
      spawnParticles(w, b.x, b.y, b.propVariant === 'heavy-metal' ? '#cbd5e1' : '#ffd166', 4, 65);
      w.shake = Math.max(w.shake, intensity >= 4 ? 4 : 2);
    }
  }
}

function syncObstacleAabbs(w: World) {
  w.obstacles = w.breakables
    .filter((b) => !b.broken)
    .map(({ x, y, w: bw, h: bh }) => ({ x, y, w: bw, h: bh }));
}

function damageBreakable(
  w: World,
  x: number,
  y: number,
  radius: number,
  amount: number,
  impactIntensity: ImpactIntensity = 0,
  fromX = x,
  fromY = y,
  impactTrigger?: PotholeTrigger,
  fromPlayer = true,
) {
  applyPropImpact(w, x, y, radius, impactIntensity, fromX, fromY, impactTrigger, fromPlayer);
  for (const b of w.breakables) {
    if (b.broken || Math.abs(x - b.x) > b.w / 2 + radius || Math.abs(y - b.y) > b.h / 2 + radius) continue;
    if (!b.breakable) continue;
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
  syncObstacleAabbs(w);
}

function potholeContains(pothole: PotholeObstacle, actor: Actor): boolean {
  const dx = Math.max(Math.abs(actor.x - pothole.x) - pothole.w / 2, 0);
  const dy = Math.max(Math.abs(actor.y - pothole.y) - pothole.h / 2, 0);
  return dx * dx + dy * dy <= actor.radius * actor.radius + pothole.lethalRadius * pothole.lethalRadius * 0.35;
}

function startPotholeFall(w: World, actor: Actor, pothole: PotholeObstacle) {
  if (actor.falling) return;
  actor.falling = true;
  actor.fallStartedAt = w.now;
  actor.kx = 0;
  actor.ky = 0;
  actor.vx = 0;
  actor.vy = 0;
  actor.anim = 'death';
  actor.animStartedAt = w.now;
  spawnParticles(w, actor.x, actor.y + actor.radius, '#2a1720', 8, 70);
  w.shake = Math.max(w.shake, actor === w.player ? 12 : 4);
  if (actor === w.player) {
    w.player.hp = 0;
    w.player.invulnUntil = Number.POSITIVE_INFINITY;
    w.player.lastDamageAt = w.now;
    w.deathCause = 'lethal-pothole';
    w.outcome = 'dead';
    pushAlert(w, 'LETHAL POTHOLE — OPERATIVE LOST');
    w.popups.push({ x: actor.x, y: actor.y - actor.radius - 16, text: 'FELL THROUGH', color: '#ff6b6b', bornAt: w.now, vy: 24 });
  } else {
    killEnemy(w, actor as EnemyActor);
  }
  pothole.resolvedAt = w.now;
}

function updatePotholes(w: World) {
  for (const pothole of w.potholes) {
    if (pothole.state === 'opening' && w.now - pothole.openingStartedAt >= pothole.openingMs) {
      pothole.state = 'open';
      pothole.openedAt = w.now;
      spawnParticles(w, pothole.x, pothole.y, '#ef4444', 16, 120);
      w.shake = Math.max(w.shake, 7);
      pushAlert(w, 'POTHOLE OPEN — KEEP CLEAR');
    }
    if (pothole.state !== 'open') continue;

    if (!w.player.falling && potholeContains(pothole, w.player)) {
      startPotholeFall(w, w.player, pothole);
    }
    for (const enemy of w.enemies) {
      if (!enemy.dying && !enemy.falling && potholeContains(pothole, enemy)) {
        startPotholeFall(w, enemy, pothole);
      }
    }
  }
}

function resolvePotholes(w: World) {
  for (const pothole of w.potholes) {
    pothole.state = 'resolved';
    pothole.resolvedAt = w.now;
  }
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
    if (b.kind === 'cover' || b.kind === 'crate-breakable' || b.kind === 'crate' || b.kind === 'barrel' || b.kind === 'street-lamp' || b.kind === 'metal-box' || b.kind === 'bench') {
      damageBreakable(w, proj.x, proj.y, proj.radius, proj.damage * 0.35, proj.impactIntensity, proj.x - proj.vx * 0.02, proj.y - proj.vy * 0.02, proj.impactTrigger, proj.fromPlayer);
      spawnParticles(w, proj.x, proj.y, b.kind === 'barrel' ? '#f0760a' : '#fbbf24', 4, 55);
      return true;
    }
  }
  return false;
}

function resolveMovingPropCollisions(w: World, prop: BreakableObstacle) {
  for (const other of w.breakables) {
    if (other === prop || other.broken) continue;
    const overlapX = prop.w / 2 + other.w / 2 - Math.abs(prop.x - other.x);
    const overlapY = prop.h / 2 + other.h / 2 - Math.abs(prop.y - other.y);
    if (overlapX <= 0 || overlapY <= 0) continue;
    if (overlapX < overlapY) {
      prop.x += (prop.x >= other.x ? overlapX : -overlapX);
      prop.vx *= -0.28;
    } else {
      prop.y += (prop.y >= other.y ? overlapY : -overlapY);
      prop.vy *= -0.28;
    }
  }
}

/**
 * Same bounded-space test clampToArena uses for the player/enemies -- a
 * walled story arena, or a dungeon/building room while in endless mode.
 * Open endless streets have no walls at all.
 */
function arenaWallBounds(w: World): { halfW: number; halfH: number; centerX: number; centerY: number } | null {
  if (w.area.endless) {
    if (w.endless?.inDungeon || w.endless?.inBuilding) {
      const e = w.endless;
      return { halfW: e.dungeonBounds.w / 2, halfH: e.dungeonBounds.h / 2, centerX: e.dungeonCenterX, centerY: e.dungeonCenterY };
    }
    return null;
  }
  return { halfW: w.bounds.w / 2, halfH: w.bounds.h / 2, centerX: 0, centerY: 0 };
}

/** Launched props bounce off the arena walls instead of flying through them. */
function resolvePropArenaWalls(w: World, prop: BreakableObstacle) {
  const bounds = arenaWallBounds(w);
  if (!bounds) return;
  const minX = bounds.centerX - bounds.halfW + prop.w / 2;
  const maxX = bounds.centerX + bounds.halfW - prop.w / 2;
  const minY = bounds.centerY - bounds.halfH + prop.h / 2;
  const maxY = bounds.centerY + bounds.halfH - prop.h / 2;
  if (prop.x < minX) {
    prop.x = minX;
    prop.vx *= -0.28;
  } else if (prop.x > maxX) {
    prop.x = maxX;
    prop.vx *= -0.28;
  }
  if (prop.y < minY) {
    prop.y = minY;
    prop.vy *= -0.28;
  } else if (prop.y > maxY) {
    prop.y = maxY;
    prop.vy *= -0.28;
  }
}

function pointToSegmentDistanceSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 0.0001) return (px - ax) ** 2 + (py - ay) ** 2;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
  const closestX = ax + dx * t;
  const closestY = ay + dy * t;
  return (px - closestX) ** 2 + (py - closestY) ** 2;
}

function damageEnemiesFromMovingProp(w: World, prop: BreakableObstacle, previousX: number, previousY: number) {
  const speed = Math.hypot(prop.vx, prop.vy);
  if (speed < 52 || prop.impactIntensity < 2 || w.now < prop.nextImpactDamageAt) return;
  prop.nextImpactDamageAt = w.now + (prop.chainActive ? PROP_CHAIN_HIT_COOLDOWN_MS : 260);
  forEachNearby(w, prop.x, prop.y, Math.max(prop.w, prop.h) + 40, (enemy) => {
    if (enemy.dying || (prop.chainActive && prop.chainHitUids.has(enemy.uid))) return;
    const hitRadius = Math.max(prop.w, prop.h) / 2 + enemy.radius;
    if (pointToSegmentDistanceSq(enemy.x, enemy.y, previousX, previousY, prop.x, prop.y) > hitRadius * hitRadius) return;
    const clickBoosted = prop.impactVelocityMultiplier > 1;
    const chainBoosted = prop.chainBoostPending;
    if (prop.chainActive) prop.chainHitUids.add(enemy.uid);
    const trajectoryScale = clamp(speed / 180, 0.65, 3);
    const impactIntensity = Math.min(
      4,
      Math.max(2, Math.round(trajectoryScale)) + (clickBoosted || chainBoosted ? 1 : 0),
    ) as ImpactIntensity;
    const damageScale = clickBoosted ? 0.2 : chainBoosted ? 0.14 : prop.chainActive ? 0.1 : 0.08;
    const rawDamage = speed * prop.impactIntensity * damageScale;
    const eliteDamageCap = enemy.def.family === 'Boss'
      ? enemy.maxHp * 0.22
      : enemy.def.family === 'Elite'
        ? enemy.maxHp * 0.35
        : Number.POSITIVE_INFINITY;
    const wasDying = enemy.dying;
    damageEnemy(
      w,
      enemy,
      Math.max(1, Math.round(Math.min(rawDamage, eliteDamageCap))),
      impactIntensity,
      prop.x,
      prop.y,
    );
    if (prop.chainActive) {
      prop.chainCycles = Math.min(999, prop.chainCycles + 1);
      prop.chainBoostPending = false;
      if (!wasDying && enemy.dying) {
        const speedBeforeBoost = Math.hypot(prop.vx, prop.vy);
        const directionLength = speedBeforeBoost || 1;
        prop.chainVelocityBudget = Math.max(0, prop.chainVelocityBudget * 0.9);
        const nextSpeed = Math.min(
          PROP_CHAIN_MAX_SPEED,
          speedBeforeBoost * 2,
          prop.chainVelocityBudget,
        );
        if (nextSpeed >= PROP_CHAIN_STOP_SPEED) {
          prop.vx = (prop.vx / directionLength) * nextSpeed;
          prop.vy = (prop.vy / directionLength) * nextSpeed;
          prop.chainBoostPending = true;
        } else {
          prop.vx = 0;
          prop.vy = 0;
        }
        w.popups.push({
          x: enemy.x,
          y: enemy.y - enemy.radius - 10,
          text: 'CHAIN x2',
          color: '#ff4d5e',
          bornAt: w.now,
          vy: 28,
        });
        spawnParticles(w, enemy.x, enemy.y, '#ff4d5e', 10, 150);
        w.shake = Math.max(w.shake, 7);
      }
    }
    spawnParticles(w, enemy.x, enemy.y, '#ffd166', 3, 55);
  });
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
            damageEnemy(w, enemy, 14 * w.stats.power, 1, b.x, b.y);
          }
        }
      }
      continue;
    }
    if (b.landedHeatActive) {
      updateLandedHeat(w, b);
      continue;
    }
    if (b.vx || b.vy) {
      const previousX = b.x;
      const previousY = b.y;
      const speedBeforeMove = Math.hypot(b.vx, b.vy);
      b.x += b.vx * dt; b.y += b.vy * dt;
      resolveMovingPropCollisions(w, b);
      resolvePropArenaWalls(w, b);
      damageEnemiesFromMovingProp(w, b, previousX, previousY);
      const friction = b.chainActive ? Math.max(b.friction, PROP_CHAIN_FRICTION) : b.friction;
      b.vx *= Math.pow(friction, dt * 60);
      b.vy *= Math.pow(friction, dt * 60);
      if (Math.hypot(b.vx, b.vy) < PROP_CHAIN_STOP_SPEED) {
        b.vx = 0;
        b.vy = 0;
        if (b.chainActive && b.chainCycles >= PROP_CHAIN_MIN_CYCLES) {
          activateLandedHeat(w, b);
        } else if (b.chainActive) {
          resetPropChain(b);
        }
      } else if (speedBeforeMove > PROP_CHAIN_STOP_SPEED && b.chainActive && b.chainVelocityBudget <= 0) {
        b.vx = 0;
        b.vy = 0;
      }
    } else if (b.chainActive) {
      if (b.chainCycles >= PROP_CHAIN_MIN_CYCLES) activateLandedHeat(w, b);
      else resetPropChain(b);
    }
  }
  // Project live positions to the collision list, preserving all props.
  syncObstacleAabbs(w);
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

function knockEnemiesAlongDash(w: World, previousX: number, previousY: number) {
  const p = w.player;
  for (const enemy of w.enemies) {
    if (enemy.dying || p.dashHitUids.has(enemy.uid)) continue;
    const hitRadius = p.radius + enemy.radius + 8;
    if (pointToSegmentDistanceSq(enemy.x, enemy.y, previousX, previousY, p.x, p.y) > hitRadius * hitRadius) continue;
    p.dashHitUids.add(enemy.uid);
    const resistance = enemyImpactResistance(enemy);
    const impulse = resolveImpactTravel(5, enemy.mass, resistance) * DASH_KNOCKBACK_MULTIPLIER;
    enemy.kx += p.dashDirectionX * impulse;
    enemy.ky += p.dashDirectionY * impulse;
    enemy.hitFlashUntil = Math.max(enemy.hitFlashUntil, w.now + 140);
    if (enemy.anim !== 'death') {
      enemy.anim = 'hurt';
      enemy.animStartedAt = w.now;
    }
    spawnParticles(w, enemy.x, enemy.y, '#fef08a', 5, 80);
  }
}

function updatePlayer(w: World, dt: number, moveX: number, moveY: number) {
  const p = w.player;
  const rumorSpeed = w.now < w.rumorSpeedUntil ? 44 : 0;
  const speed = (w.stats.speed + rumorSpeed) * speedMult(w);
  const len = Math.hypot(moveX, moveY);
  const nx = len > 1 ? moveX / len : moveX;
  const ny = len > 1 ? moveY / len : moveY;

  const dashing = p.dashUntil > w.now;
  if (dashing) {
    p.vx = p.dashDirectionX * DASH_SPEED;
    p.vy = p.dashDirectionY * DASH_SPEED;
  } else {
    p.vx = nx * speed;
    p.vy = ny * speed;
  }
  const previousX = p.x;
  const previousY = p.y;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (!dashing) applyKnockback(p, dt);

  if (dashing) {
    p.facing = p.dashDirectionX < -0.05 ? -1 : p.dashDirectionX > 0.05 ? 1 : p.facing;
  } else if (Math.abs(nx) > 0.05) {
    p.facing = nx > 0 ? 1 : -1;
  }

  collideObstacles(w, p);
  clampToArena(w, p);
  if (dashing) knockEnemiesAlongDash(w, previousX, previousY);
  for (const b of w.breakables) {
    if (b.broken || !b.movable) continue;
    if (Math.abs(p.x - b.x) < b.w / 2 + p.radius && Math.abs(p.y - b.y) < b.h / 2 + p.radius) {
      b.contacts += 1;
      if (b.kind === 'car-wreck' && b.contacts < 3) continue;
      const dx = b.x - p.x; const dy = b.y - p.y; const len = Math.hypot(dx, dy) || 1;
      const force = b.propVariant === 'heavy-metal' ? 8 : b.propVariant === 'medium-movable' ? 24 : 42;
      b.vx += (dx / len) * force / Math.max(1, b.mass);
      b.vy += (dy / len) * force / Math.max(1, b.mass);
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

const DASH_SPEED = 760;
const DASH_DURATION_MS = 180;
const DASH_COOLDOWN_MS = 820;
const DASH_KNOCKBACK_MULTIPLIER = 1.8;

export function dashPlayer(w: World, directionX: number, directionY: number): boolean {
  if (
    w.outcome !== 'running' ||
    w.player.falling ||
    w.endless?.pendingTransition ||
    w.now < w.player.dashReadyAt ||
    w.player.dashUntil > w.now
  ) {
    return false;
  }
  const length = Math.hypot(directionX, directionY);
  if (length < 0.15) return false;

  w.player.dashDirectionX = directionX / length;
  w.player.dashDirectionY = directionY / length;
  w.player.dashUntil = w.now + DASH_DURATION_MS;
  w.player.dashReadyAt = w.now + DASH_COOLDOWN_MS;
  w.player.dashStartedAt = w.now;
  w.player.dashHitUids.clear();
  w.player.vx = w.player.dashDirectionX * DASH_SPEED;
  w.player.vy = w.player.dashDirectionY * DASH_SPEED;
  w.shake = Math.max(w.shake, 9);
  spawnParticles(w, w.player.x, w.player.y, w.character.palette.accentBright, 12, 150);
  w.popups.push({
    x: w.player.x,
    y: w.player.y - 28,
    text: 'DASH!',
    color: w.character.palette.accentBright,
    bornAt: w.now,
    vy: 34,
  });
  return true;
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
          bornAt: w.now, expiresAt: w.now + 180, color: '#65f6d1', damage: 0, impactIntensity: 0,
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
    speed *= musicMultiplier(w, enemy.def.react, 'speed');
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
          impactIntensity: 0,
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
              radius: 7, damage: ranged.damage, impactIntensity: 0, fromPlayer: false,
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
            color: enemy.def.palette.accent, damage: 0, impactIntensity: 0,
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
    for (const b of w.breakables) {
      if (b.broken || !b.movable || w.now < b.nextEnemyImpactAt) continue;
      if (Math.abs(enemy.x - b.x) < b.w / 2 + enemy.radius && Math.abs(enemy.y - b.y) < b.h / 2 + enemy.radius) {
        b.contacts += 1;
        if (b.kind === 'car-wreck' && b.contacts < 3) continue;
        startEnemyPropChain(w, b, enemy);
      }
    }
    collideObstacles(w, enemy);
    clampToArena(w, enemy);

    // Contact damage.
    const contact = enemy.radius + p.radius;
    if (enemy.ghostUntil <= w.now && distance <= contact && w.now >= enemy.contactReadyAt) {
      enemy.contactReadyAt = w.now + 520;
      damagePlayer(w, enemy.damage, enemy.x, enemy.y, 'contact');
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
            damageEnemy(w, enemy, proj.damage, proj.impactIntensity, proj.x, proj.y, proj.statusEffectId);
          }
          triggerEvolutionHit(
            w,
            proj.evolutionBehavior,
            proj.x,
            proj.y,
            proj.damage,
            proj.color,
            proj.impactIntensity,
            proj.statusEffectId,
            enemy.uid,
          );
          if (proj.evolutionBehavior?.kind === 'split') {
            const baseAngle = Math.atan2(proj.vy, proj.vx);
            const splitCount = Math.max(2, proj.evolutionBehavior.count ?? 2);
            for (let splitIndex = 0; splitIndex < splitCount; splitIndex += 1) {
              const offset = (splitIndex - (splitCount - 1) / 2) * 0.34;
              const splitAngle = baseAngle + offset;
              w.projectiles.push({
                uid: uid(w),
                x: proj.x,
                y: proj.y,
                vx: Math.cos(splitAngle) * Math.max(150, Math.hypot(proj.vx, proj.vy) * 0.82),
                vy: Math.sin(splitAngle) * Math.max(150, Math.hypot(proj.vx, proj.vy) * 0.82),
                radius: 4,
                damage: proj.damage * 0.42,
                impactIntensity: Math.min(2, proj.impactIntensity) as ImpactIntensity,
                fromPlayer: true,
                expiresAt: w.now + 560,
                targetUid: null,
                turnRate: 0,
                color: proj.color,
                trail: [],
                pierce: 0,
                hitUids: new Set([enemy.uid]),
                obstacleUids: new Set(),
                obstacleInteraction: proj.obstacleInteraction,
                statusEffectId: proj.statusEffectId,
              });
            }
            proj.evolutionBehavior = undefined;
            pushAlert(w, 'SIGNATURE SPLIT');
          }
            damageBreakable(w, proj.x, proj.y, proj.radius, proj.damage, proj.impactIntensity, proj.x - proj.vx * 0.02, proj.y - proj.vy * 0.02, proj.impactTrigger, proj.fromPlayer);
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
    if (active && (effect.kind === 'slash' || effect.kind === 'wave' || effect.kind === 'laser' || effect.kind === 'impact') && effect.damage > 0) {
      forEachNearby(w, effect.x, effect.y, effect.radius + 30, (enemy) => {
        if (enemy.dying || effect.hitUids.has(enemy.uid)) return;
        const reach = effect.radius + enemy.radius;
        if (dist2(enemy.x, enemy.y, effect.x, effect.y) > reach * reach) return;
        const angleTo = Math.atan2(enemy.y - effect.y, enemy.x - effect.x);
        let diff = Math.abs(angleTo - effect.angle);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
        if (diff > effect.spread) return;
        effect.hitUids.add(enemy.uid);
        damageEnemy(w, enemy, effect.damage, effect.impactIntensity, effect.x, effect.y, effect.statusEffectId);
        triggerEvolutionHit(
          w,
          effect.evolutionBehavior,
          enemy.x,
          enemy.y,
          effect.damage,
          effect.color,
          effect.impactIntensity,
          effect.statusEffectId,
          enemy.uid,
        );
      });
        damageBreakable(w, effect.x, effect.y, effect.radius, effect.damage, effect.impactIntensity, effect.x, effect.y, effect.impactTrigger);
    }

    if (active && effect.kind === 'hazard' && effect.damage > 0 && w.now >= (effect.nextTickAt ?? effect.bornAt)) {
      effect.nextTickAt = w.now + 520;
      effect.hitUids.clear();
      forEachNearby(w, effect.x, effect.y, effect.radius + 30, (enemy) => {
        if (enemy.dying || effect.hitUids.has(enemy.uid)) return;
        const reach = effect.radius + enemy.radius;
        if (dist2(enemy.x, enemy.y, effect.x, effect.y) > reach * reach) return;
        effect.hitUids.add(enemy.uid);
        damageEnemy(w, enemy, effect.damage, 0, effect.x, effect.y, effect.statusEffectId ?? (effect.color.includes('b8ff') ? 'acid' : 'burning'));
      });
      if (effect.hurtsPlayer && dist2(p.x, p.y, effect.x, effect.y) <= (effect.radius + p.radius) ** 2) {
        damagePlayer(w, Math.max(1, Math.round(effect.damage * 0.45)), effect.x, effect.y);
      }
    }

    if (w.now > effect.expiresAt) {
      if (effect.evolutionBehavior?.kind === 'delayed-burst') {
        const burstRadius = effect.radius * (effect.evolutionBehavior.radius ?? 0.82);
        const burstDamage = effect.damage * 0.55;
        novaDamage(w, effect.x, effect.y, burstRadius, burstDamage, 0, effect.evolutionBehavior.statusEffectId ?? effect.statusEffectId);
        w.effects.push({
          uid: uid(w),
          kind: 'ring',
          x: effect.x,
          y: effect.y,
          radius: burstRadius,
          angle: 0,
          spread: 0,
          bornAt: w.now,
          expiresAt: w.now + 260,
          color: effect.color,
          damage: 0,
          impactIntensity: 0,
          hitUids: new Set(),
          followPlayer: false,
        });
        spawnParticles(w, effect.x, effect.y, effect.color, 8, 85);
      }
      w.effects.splice(i, 1);
    }
  }
}

export function claimRumorEmergencyHeal(w: World): boolean {
  if (w.activeCrewRumor?.rumorId !== 'pantry-surge' || !w.rumorPantryAvailable) return false;
  w.rumorPantryAvailable = false;
  w.rumorTriggered = true;
  const amount = Math.max(12, Math.round(w.player.maxHp * 0.18));
  w.player.hp = clamp(w.player.hp + amount, 0, w.player.maxHp);
  w.rumorOutcome = `Pantry Surge restored ${amount} HP at the first level-up.`;
  w.popups.push({
    x: w.player.x,
    y: w.player.y + 26,
    text: `+${amount} EMERGENCY`,
    color: '#86efac',
    bornAt: w.now,
    vy: 30,
  });
  pushAlert(w, 'RUMOR — PANTRY SURGE');
  return true;
}

function updateRumorPulses(w: World) {
  if (
    w.activeCrewRumor?.rumorId !== 'magnet-parade' ||
    w.now < w.rumorMagnetNextAt
  ) return;

  w.rumorTriggered = true;
  w.rumorOutcome = 'Magnet Parade pulled experience and cred toward the operative.';
  const radius = 280;
  for (const pickup of w.pickups) {
    if (pickup.kind !== 'xp' && pickup.kind !== 'cred') continue;
    const dx = w.player.x - pickup.x;
    const dy = w.player.y - pickup.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance > radius) continue;
    pickup.vx += (dx / distance) * 520;
    pickup.vy += (dy / distance) * 520;
  }
  w.effects.push({
    uid: uid(w),
    kind: 'nova',
    x: w.player.x,
    y: w.player.y,
    radius,
    angle: 0,
    spread: 0,
    bornAt: w.now,
    expiresAt: w.now + 300,
    color: '#c4b5fd',
    damage: 0,
    impactIntensity: 0,
    hitUids: new Set(),
    followPlayer: false,
  });
  spawnParticles(w, w.player.x, w.player.y, '#c4b5fd', 12, 110);
  pushAlert(w, 'RUMOR — MAGNET PARADE');
  w.rumorMagnetNextAt += 8500;
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
          novaDamage(w, p.x, p.y, 320 * areaMult(w), 45 * w.stats.power, 5);
          damageBreakable(w, p.x, p.y, 320 * areaMult(w), 45 * w.stats.power, 5, p.x, p.y);
          w.effects.push({
            uid: uid(w), kind: 'ring', x: p.x, y: p.y, radius: 320 * areaMult(w),
            angle: 0, spread: 0, bornAt: w.now, expiresAt: w.now + 480,
            color: '#ffffff', damage: 0, impactIntensity: 0, hitUids: new Set(), followPlayer: false,
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

export function episodeSnapshot(w: World): NonNullable<HudSnapshot['episode']> | undefined {
  if (!w.episode) return undefined;
  const { def, startingProgress } = w.episode;
  let progress = startingProgress;
  switch (def.objective.kind) {
    case 'kill-any':
      progress += w.kills;
      break;
    case 'kill-enemy':
      progress += w.killsByEnemy[def.objective.enemyId ?? ''] ?? 0;
      break;
    case 'survive-sec':
      progress += w.time;
      break;
    case 'walk-blocks':
      progress += w.endless ? Math.round(w.endless.maxDistancePx / CHUNK_SIZE) : 0;
      break;
    case 'rescue-ally':
      if (w.rescue.status === 'freed' && w.rescue.allyId === def.objective.allyId) progress += 1;
      break;
    case 'discover':
      if (w.outcome === 'cleared' && w.area.discoveryId === def.objective.discoveryId) progress += 1;
      break;
    case 'clear-area':
      if (w.outcome === 'cleared' && w.area.id === (def.objective.areaId ?? def.areaId)) progress += 1;
      break;
  }
  const target = def.objective.targetCount;
  return {
    id: def.id,
    title: def.title,
    label: def.objective.label,
    progress: Math.min(target, Math.max(0, Math.floor(progress))),
    target,
    completed: progress >= target,
  };
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
    const ally = rescue.allyId ? ALLIES_BY_ID[rescue.allyId] : undefined;
    pushAlert(w, ally ? `${ally.name} is trapped nearby` : 'Someone is trapped nearby');
    return;
  }

  const distance = Math.hypot(w.player.x - rescue.x, w.player.y - rescue.y);
  if (distance < 46) {
    rescue.status = 'freeing';
    rescue.progress = clamp(rescue.progress + dt / 2.4, 0, 1);
    if (rescue.progress >= 1) {
      rescue.status = 'freed';
      const ally = rescue.allyId ? ALLIES_BY_ID[rescue.allyId] : undefined;
      pushAlert(w, ally ? `${ally.name} is rescued — get them home` : 'Rescued — get them home');
      spawnParticles(w, rescue.x, rescue.y + 12, ally?.palette.glow ?? '#ffe08a', 22, 130);
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
  return Math.min(12, Math.floor(e.maxDistancePx / 800) + Math.floor(e.dungeonDepth / 2));
}

function updateEndlessRoute(w: World) {
  const e = w.endless!;
  if (e.inDungeon || e.inBuilding) return;

  const distance = Math.hypot(w.player.x, w.player.y);
  const band = getEndlessBand(distance);
  if (band.id !== e.currentBandId) {
    e.currentBandId = band.id;
    const firstBandVisit = !e.discoveredBandIds.has(band.id);
    if (firstBandVisit) {
      e.discoveredBandIds.add(band.id);
      pushAlert(w, `${band.label} — ${band.riskLabel}`);
    }
    const eventId = `beacon:${band.id}`;
    if (firstBandVisit && band.id !== 'core' && !e.discoveredRouteEventIds.has(eventId)) {
      e.routeEvent = {
        id: eventId,
        bandId: band.id,
        title: band.eventTitle,
        description: band.eventDescription,
        x: w.player.x + 150,
        y: w.player.y,
        phase: 'available',
        rewardCred: 35 + ENDLESS_BANDS.findIndex((candidate) => candidate.id === band.id) * 15,
        rewardTokens: 1 + Math.floor(ENDLESS_BANDS.findIndex((candidate) => candidate.id === band.id) / 3),
      };
      pushAlert(w, `OPTIONAL ROUTE — ${band.eventTitle}`);
    }
  }

  const event = e.routeEvent;
  if (event?.phase === 'available' && Math.hypot(w.player.x - event.x, w.player.y - event.y) < 48) {
    event.phase = 'claimed';
    e.discoveredRouteEventIds.add(event.id);
    w.cred += event.rewardCred;
    w.lootTokensGained += event.rewardTokens;
    pushAlert(w, `${event.title} secured +${event.rewardCred} cred`);
    spawnParticles(w, event.x, event.y, band.accent, 26, 170);
  }
}

function updateEndlessBandHazard(w: World) {
  const e = w.endless!;
  if (e.inBuilding || w.now < e.hazardNextAt) return;
  if (e.inDungeon) {
    if (e.dungeonDepth < 2) return;
    const era = DUNGEON_ERAS[e.dungeonEraIndex];
    e.hazardNextAt = w.now + 3600;
    const hazardX = w.player.x + (e.dungeonRoom === 3 ? 0 : 76);
    const hazardY = w.player.y + Math.sin(w.now / 900) * 96;
    incursionEffect(w, hazardX, hazardY, 44, era?.ground.glow ?? '#b58cff', 520);
    if (e.dungeonRoom === 3) damagePlayer(w, 2, hazardX, hazardY, 'hazard');
    return;
  }
  const band = ENDLESS_BANDS_BY_ID[e.currentBandId];
  if (!band || band.id === 'core') return;

  e.hazardNextAt = w.now + (band.id === 'outer-threshold' ? 2400 : 3100);
  const radius = band.id === 'floodwall' ? 70 : band.id === 'rail-shadow' ? 56 : 48;
  const hazardX = w.player.x + (w.player.vx === 0 ? 80 : Math.sign(w.player.vx) * 90);
  const hazardY = w.player.y + (w.player.vy === 0 ? -40 : Math.sign(w.player.vy) * 90);
  incursionEffect(w, hazardX, hazardY, radius, band.accent, 520);
  if (band.id === 'outer-threshold') {
    damagePlayer(w, 3, hazardX, hazardY, 'hazard');
  } else if (band.id === 'industrial-fringe' || band.id === 'rail-shadow') {
    damagePlayer(w, 2, hazardX, hazardY, 'hazard');
  }
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
      e.buildings = e.buildings.filter((building) => !building.id.startsWith(`${key}:`));
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
      propVariant: obs.propVariant,
        pothole: obs.pothole,
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
      crossing: chunk.riverCrossingX !== null,
      streetAxis: chunk.streetAxis,
      district: chunk.district,
      districtAccent: chunk.districtAccent,
      band: chunk.band,
      bandAccent: chunk.bandAccent,
      landmark: chunk.landmark,
    });
    for (const building of chunk.buildings) {
      e.buildings.push({
        id: building.id,
        prefabId: building.prefabId,
        name: building.name,
        sign: building.sign,
        accent: building.accent,
        x: cwx + building.x,
        y: cwy + building.y,
        w: building.w,
        h: building.h,
        doorSide: building.doorSide,
      });
    }
    if (chunk.hasRiver) {
      e.riverSegments.push({
        x: cwx,
        y: cwy,
        w: CHUNK_SIZE,
        h: 126,
        crossingX: chunk.riverCrossingX === null ? null : cwx + chunk.riverCrossingX,
      });
    }
    for (const door of chunk.buildingEntrances) {
      const building = chunk.buildings.find((candidate) => candidate.id === door.buildingId);
      if (!building) continue;
      e.buildingEntrances.push({
        x: cwx + door.x,
        y: cwy + door.y,
        w: 34,
        h: 28,
        label: door.label,
        returnX: cwx + door.x + (door.doorSide === 'west' ? -48 : door.doorSide === 'east' ? 48 : 0),
        returnY: cwy + door.y + (door.doorSide === 'north' ? -48 : door.doorSide === 'south' ? 48 : 0),
        buildingId: door.buildingId,
        prefabId: door.prefabId,
        doorSide: door.doorSide,
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
    resolvePotholes(w);
    w.obstacles = [];
    w.breakables = [];
    w.potholes = [];
    for (const obsArr of e.chunkObstacles.values()) {
      for (const o of obsArr) {
        if (o.kind === 'pothole') {
          w.potholes.push(createPothole(w, { ...o, kind: 'pothole' }));
        } else {
          w.obstacles.push(o);
          w.breakables.push(createBreakable(w, { ...o, kind: o.kind ?? 'crate' }));
        }
      }
    }
  }
}

function updateEndlessLandmarkCue(w: World) {
  const e = w.endless!;
  if (e.inDungeon || e.inBuilding) return;

  const { cx, cy } = worldToChunkCoords(w.player.x, w.player.y);
  const key = chunkKey(cx, cy);
  const block = e.cityBlocks.find((candidate) => candidate.key === key);
  if (e.lastLandmarkKey === key) return;

  e.lastLandmarkKey = key;
  if (!block?.landmark) return;

  const cue = block.landmark.kind === 'bridge'
    ? `${block.landmark.name} — crossing ahead`
    : `Entering ${block.landmark.name}`;
  pushAlert(w, cue);
}

function loadDungeonRoom(w: World, room: number, transition: 'enter' | 'exit' = 'exit') {
  const e = w.endless!;
  const p = w.player;
  resolvePotholes(w);
  e.dungeonRoom = room;
  const era = DUNGEON_ERAS[e.dungeonEraIndex]!;
  e.dungeonBounds = { ...era.bounds };

  // Place dungeon obstacles in world space, centred on the entry point.
   w.obstacles = era.obstacles.filter((obs) => obs.kind !== 'pothole').map((obs) => ({
    x: p.x + obs.x,
    y: p.y + obs.y,
    w: obs.w,
    h: obs.h,
  }));
   w.breakables = era.obstacles.filter((obs) => obs.kind !== 'pothole').map((obs) => createBreakable(w, {
    ...obs,
    x: p.x + obs.x,
    y: p.y + obs.y,
   }));
   w.potholes = era.obstacles.filter((obs) => obs.kind === 'pothole').map((obs) => createPothole(w, {
     ...obs,
     x: p.x + obs.x,
     y: p.y + obs.y,
   }));

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
  const bandIndex = ENDLESS_BANDS.findIndex((band) => band.id === e.currentBandId);
  e.dungeonEraIndex = (e.dungeonDepth - 1 + Math.max(0, bandIndex) * 2) % DUNGEON_ERAS.length;
  e.inDungeon = true;
  loadDungeonRoom(w, 1, 'enter');
}

function enterBuilding(w: World, door: EndlessState['buildingEntrances'][number]) {
  const e = w.endless!;
  const building = e.buildings.find((candidate) => candidate.id === door.buildingId);
  const prefab = getBuildingPrefab(door.prefabId as BuildingPrefabId);
  if (!building) return;

  resolvePotholes(w);
  e.buildingReturnX = door.returnX;
  e.buildingReturnY = door.returnY;
  e.buildingCenterX = building.x;
  e.buildingCenterY = building.y;
  e.dungeonCenterX = building.x;
  e.dungeonCenterY = building.y;
  e.buildingLabel = prefab.name;
  e.buildingPrefabId = prefab.id;
  e.inBuilding = true;
  e.dungeonBounds = { ...prefab.interiorBounds };

  const exitOffset = Math.max(22, Math.min(prefab.interiorBounds.w, prefab.interiorBounds.h) / 2 - 24);
  const exitX = building.x + (door.doorSide === 'west' ? -exitOffset : door.doorSide === 'east' ? exitOffset : 0);
  const exitY = building.y + (door.doorSide === 'north' ? -exitOffset : door.doorSide === 'south' ? exitOffset : 0);
  e.exitZone = { x: exitX, y: exitY, w: 52, h: 42 };

  const interiorShell = buildingWallObstacles({
    x: building.x,
    y: building.y,
    w: prefab.interiorBounds.w,
    h: prefab.interiorBounds.h,
    doorX: building.x,
    doorY: building.y,
    doorSide: door.doorSide,
  });
  const interiorProps = prefab.interiorProps.map((obs) => ({
    ...obs,
    x: building.x + obs.x,
    y: building.y + obs.y,
  }));
  w.obstacles = [...interiorShell, ...interiorProps];
  w.breakables = [...interiorShell, ...interiorProps].map((obs) => createBreakable(w, { ...obs, kind: obs.kind }));
  w.potholes = [];
  w.enemies = w.enemies.filter((en) => en.dying);
  w.pickups = [];
  w.projectiles = [];
  w.player.x = exitX + (door.doorSide === 'west' ? 28 : door.doorSide === 'east' ? -28 : 0);
  w.player.y = exitY + (door.doorSide === 'north' ? 28 : door.doorSide === 'south' ? -28 : 0);
  w.player.vx = 0;
  w.player.vy = 0;
  e.pendingTransition = 'enter';
  pushAlert(w, `${prefab.name} — inside`);
}

function exitDungeon(w: World) {
  const e = w.endless!;

  if (e.inBuilding) {
    w.player.x = e.buildingReturnX;
    w.player.y = e.buildingReturnY;
    w.player.vx = 0;
    w.player.vy = 0;
    e.inBuilding = false;
    e.buildingPrefabId = null;
    e.buildingLabel = '';
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
  resolvePotholes(w);
  w.obstacles = [];
  w.breakables = [];
  w.potholes = [];
  for (const obsArr of e.chunkObstacles.values()) {
    for (const o of obsArr) {
      if (o.kind === 'pothole') w.potholes.push(createPothole(w, { ...o, kind: 'pothole' }));
      else {
        w.obstacles.push(o);
        w.breakables.push(createBreakable(w, { ...o, kind: o.kind ?? 'crate' }));
      }
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
      const depthBonus = 10 + e.dungeonDepth * 8;
      w.cred += depthBonus;
      pushAlert(w, 'Chest opened — 3 rewards secured');
      pushAlert(w, `Depth bonus +${depthBonus} cred`);
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
  const contractSpawnMultiplier = w.challenges.reduce((multiplier, challenge) => multiplier * challenge.enemySpawnMultiplier, 1);
  const spawnRate = Math.min(3.2, (0.8 + tier * 0.14) * contractSpawnMultiplier);
  const hpMult = Math.min(1.7, 1 + tier * 0.07);

  const bandPool = ENDLESS_BANDS_BY_ID[e.currentBandId]?.enemyPool;
  const pool = bandPool?.length
    ? bandPool
    : ENDLESS_ENEMY_POOLS[Math.min(tier, ENDLESS_ENEMY_POOLS.length - 1)]!;

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
/* Music reactivity                                                    */
/* ------------------------------------------------------------------ */

/** Below this confidence the detected grid is too shaky to drive gameplay. */
export const BEAT_TRUST_THRESHOLD = 0.35;
/** Half-width of the on-beat crit window, in milliseconds. */
export const ON_BEAT_WINDOW_MS = 90;
/** Damage multiplier granted for landing a hit on the beat. */
export const ON_BEAT_CRIT_MULT = 1.5;

/**
 * Advances the decaying envelopes the reaction system reads. Edge-triggered
 * sources retrigger here, once per rendered frame, so a frame that runs
 * several fixed substeps still only fires one pulse.
 */
function updateAudioState(w: World, frame: AudioFrame, dt: number) {
  w.audio = frame;

  if (frame.beatIndex > w.lastBeatIndex) {
    w.beatPulse = 1;
    if (frame.downbeat) w.downbeatPulse = 1;
    w.lastBeatIndex = frame.beatIndex;
  } else if (frame.beatIndex < w.lastBeatIndex) {
    // The source restarted (new track, transport rewind).
    w.lastBeatIndex = frame.beatIndex;
  }
  if (frame.onset) w.onsetPulse = 1;

  // ~200ms to fall away; fast enough to read as a hit, slow enough to see.
  const decay = Math.exp(-dt / 0.2);
  w.beatPulse *= decay;
  w.downbeatPulse *= decay;
  w.onsetPulse *= decay;
}

/** The envelope bundle the reaction helpers take. */
function audioPulses(w: World) {
  return { beat: w.beatPulse, downbeat: w.downbeatPulse, onset: w.onsetPulse };
}

/**
 * Multiplier a def's `react` list applies to one target right now. Content
 * declares the reaction; this is the only place the loop consults it.
 */
export function musicMultiplier(
  w: World,
  reactions: readonly BeatReaction[] | undefined,
  target: ReactionTarget,
): number {
  if (!reactions || w.audio.source === 'none') return 1;
  return reactionMultiplier(reactions, target, w.audio, audioPulses(w));
}

/**
 * True when the world clock sits inside the on-beat window. Used for the crit
 * bonus. When the tempo estimate is not trustworthy this returns false and the
 * caller falls back to the normal crit roll, so a badly analysed track never
 * silently penalises the player.
 */
export function isOnBeat(w: World): boolean {
  if (w.audio.source === 'none' || w.audio.confidence < BEAT_TRUST_THRESHOLD) return false;
  return msFromNearestBeat(w.audio) <= ON_BEAT_WINDOW_MS;
}

/* ------------------------------------------------------------------ */
/* Main step                                                           */
/* ------------------------------------------------------------------ */

export interface StepInput {
  moveX: number;
  moveY: number;
  ultimate: boolean;
  /**
   * The music frame for this rendered frame. Optional so tests and any caller
   * that does not care about audio can omit it and get silence.
   */
  audio?: AudioFrame;
}

export function stepWorld(w: World, dtSeconds: number, input: StepInput) {
  if (w.outcome !== 'running') return;

  const dt = Math.min(dtSeconds, 1 / 30);
  w.time += dt;
  w.now += dt * 1000;

  updateAudioState(w, input.audio ?? SILENT_FRAME, dt);

  if (
    w.firstNightChapter &&
    !w.firstNightBeatTriggered &&
    w.time >= w.firstNightChapter.beatAtSec
  ) {
    w.firstNightBeatTriggered = true;
    pushAlert(w, `${w.firstNightChapter.beatTitle} — ${w.firstNightChapter.beatText}`);
  }

  if (input.ultimate) activateUltimate(w);

  updatePlayer(w, dt, input.moveX, input.moveY);
  updateDistrictIncursion(w, dt);

  if (w.area.endless && w.endless) {
    updateEndlessChunks(w);
    updateEndlessRoute(w);
    updateEndlessBandHazard(w);
    updateEndlessLandmarkCue(w);
    updateEndlessDungeon(w);
    updateEndlessSpawning(w, dt);
  } else {
    updateSpawning(w, dt);
  }

  updateStatusEffects(w);
  updateAmbient(w, dt);
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
  updatePotholes(w);
  updateRumorPulses(w);
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
    rescueAllyName: w.rescue.allyId ? ALLIES_BY_ID[w.rescue.allyId]?.name : undefined,
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
    episode: (() => {
      const snapshot = episodeSnapshot(w);
      return snapshot
        ? {
            id: snapshot.id,
            title: snapshot.title,
            label: snapshot.label,
            progress: snapshot.progress,
            target: snapshot.target,
            completed: snapshot.completed,
          }
        : undefined;
    })(),
    evolution: w.activeEvolution
      ? {
          id: w.activeEvolution.id,
          name: w.activeEvolution.name,
          identity: w.activeEvolution.identity,
          color: w.activeEvolution.color,
        }
      : undefined,
    relicWorkshop: {
      knownRelicIds: [...w.knownRelicIds],
      readyRecipeIds: RELIC_RECIPES
        .filter((recipe) => relicRecipeEligibility(w, recipe).eligible)
        .map((recipe) => recipe.id),
      activeRecipe: w.activeRelicRecipe
        ? {
            id: w.activeRelicRecipe.id,
            name: w.activeRelicRecipe.name,
            identity: w.activeRelicRecipe.identity,
            color: w.activeRelicRecipe.color,
          }
        : undefined,
    },
    crewRumor: w.activeCrewRumor
      ? (() => {
          const rumor = getCrewRumor(w.activeCrewRumor.rumorId);
          if (!rumor) return undefined;
          return {
            rumorId: rumor.id,
            name: rumor.name,
            icon: rumor.icon,
            effectLabel: rumor.effectLabel,
            triggered: w.rumorTriggered,
            ready: w.rumorPantryAvailable,
            outcome: w.rumorOutcome,
          };
        })()
      : undefined,
    firstNightBeat: w.firstNightChapter && w.firstNightBeatTriggered
      ? {
          chapter: w.firstNightChapter.chapter,
          title: w.firstNightChapter.beatTitle,
          text: w.firstNightChapter.beatText,
        }
      : undefined,
    districtIncursion: w.districtIncursion
      ? {
          id: w.districtIncursion.id,
          title: w.districtIncursion.title,
          landmark: w.districtIncursion.landmark,
          objectiveLabel: w.districtIncursion.objectiveLabel,
          phase: w.districtIncursion.phase,
          progress: Math.min(w.districtIncursion.target, Math.floor(w.districtIncursion.progress)),
          target: w.districtIncursion.target,
          accent: w.districtIncursion.accent,
          remainingSec: w.districtIncursion.phase === 'active'
            ? Math.max(0, Math.ceil((w.districtIncursion.endsAt - w.now) / 1000))
            : 0,
        }
      : undefined,
    objectives: w.objectives.map((o) => ({
      label: o.def.label,
      progress: Math.min(o.def.targetCount, Math.round(o.progress)),
      target: o.def.targetCount,
      completed: o.completed,
    })),
    endless: e
      ? {
          blocksWalked: Math.round(e.maxDistancePx / CHUNK_SIZE),
          distancePx: Math.round(e.maxDistancePx),
          dungeonDepth: e.dungeonDepth,
          inDungeon: e.inDungeon,
          dungeonRoom: e.dungeonRoom,
          dungeonBossDefeated: e.dungeonBossDefeated,
          dungeonChestUnlocked: Boolean(e.dungeonChest?.unlocked),
          dungeonChestOpened: Boolean(e.dungeonChest?.opened),
          dungeonEraName: e.dungeonEraIndex >= 0 && e.inDungeon
            ? (DUNGEON_ERAS[e.dungeonEraIndex]?.name ?? 'Unknown')
            : '',
          currentBandId: e.currentBandId,
          currentBandLabel: ENDLESS_BANDS_BY_ID[e.currentBandId]?.label ?? 'Unknown edge',
          currentBandAccent: ENDLESS_BANDS_BY_ID[e.currentBandId]?.accent ?? '#fff',
          riskLabel: ENDLESS_BANDS_BY_ID[e.currentBandId]?.riskLabel ?? '',
          hazardLabel: ENDLESS_BANDS_BY_ID[e.currentBandId]?.hazardLabel ?? '',
          routeEvent: e.routeEvent
            ? { ...e.routeEvent }
            : undefined,
          currentBlock: e.cityBlocks.find((block) => block.key === chunkKey(
            worldToChunkCoords(w.player.x, w.player.y).cx,
            worldToChunkCoords(w.player.x, w.player.y).cy,
          ))?.kind ?? 'street',
          currentDistrict: e.cityBlocks.find((block) => block.key === chunkKey(
            worldToChunkCoords(w.player.x, w.player.y).cx,
            worldToChunkCoords(w.player.x, w.player.y).cy,
          ))?.district ?? 'Unmapped district',
          inBuilding: e.inBuilding,
          buildingLabel: e.buildingLabel,
          playerX: w.player.x,
          playerY: w.player.y,
          cityBlocks: e.cityBlocks.map(({ x, y, w: width, h: height, kind, river, crossing, streetAxis, district, districtAccent, band, bandAccent, landmark }) => ({
            x, y, w: width, h: height, kind, river, crossing, streetAxis, district, districtAccent, band, bandAccent, landmark,
          })),
          riverSegments: [...e.riverSegments],
          buildingEntrances: e.buildingEntrances.map(({ x, y, label, prefabId, doorSide }) => ({ x, y, label, prefabId, doorSide })),
          buildings: e.buildings.map(({ id, prefabId, name, sign, accent, x, y, w: width, h: height, doorSide }) => ({
            id, prefabId, name, sign, accent, x, y, w: width, h: height, doorSide,
          })),
        }
      : undefined,
  };
}

export function buildResult(w: World, utilityRewardMultiplier = 1): RunResult {
  const cleared = w.outcome === 'cleared';
  const survival = w.area.endless ? w.time : Math.min(w.time, w.area.durationSec);
  const bonus = cleared ? 120 : 0;
  const e = w.endless;
  const baseCred = w.cred + bonus + Math.floor(survival / 4);
  const challengeMultiplier = w.challenges.reduce((multiplier, challenge) => multiplier * challenge.rewardMultiplier, 1);
  const finalCred = Math.floor(baseCred * challengeMultiplier * utilityRewardMultiplier);
  return {
    areaId: w.area.id,
    characterId: w.character.id,
    cleared,
    survivedSec: survival,
    kills: w.kills,
    level: w.level,
    cred: finalCred,
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
      variantId: pet.variantId,
      family: pet.family,
      silhouette: pet.silhouette,
      palette: pet.palette,
      rarity: pet.rarity,
      rarityLabel: pet.rarityLabel,
      attackKind: pet.attackKind,
      element: pet.element,
      elementLabel: pet.elementLabel,
      traitLabel: pet.traitLabel,
      health: pet.stats.health,
      damage: Math.round(pet.stats.damage),
      cooldownMs: pet.stats.cooldownMs,
      range: pet.stats.range,
      ghosted: pet.ghost,
    })),
    lokPetDiscoveries: [],
    lootTokensGained: w.lootTokensGained,
    completedObjectives: [...w.completedObjectives],
    episode: (() => {
      const snapshot = episodeSnapshot(w);
      return snapshot
        ? {
            id: snapshot.id,
            title: snapshot.title,
            objectiveLabel: snapshot.label,
            progress: snapshot.progress,
            target: snapshot.target,
            completed: snapshot.completed,
            completedThisRun: snapshot.completed && (w.episode?.startingProgress ?? 0) < snapshot.target,
          }
        : undefined;
    })(),
    evolution: w.activeEvolution
      ? {
          id: w.activeEvolution.id,
          name: w.activeEvolution.name,
          identity: w.activeEvolution.identity,
        }
      : undefined,
    relicRecipe: w.activeRelicRecipe
      ? {
          id: w.activeRelicRecipe.id,
          name: w.activeRelicRecipe.name,
          identity: w.activeRelicRecipe.identity,
        }
      : undefined,
    crewRumor: w.activeCrewRumor
      ? (() => {
          const rumor = getCrewRumor(w.activeCrewRumor.rumorId);
          return rumor
            ? {
                rumorId: rumor.id,
                rumorName: rumor.name,
                icon: rumor.icon,
                allyId: w.activeCrewRumor.allyId,
                effectLabel: rumor.effectLabel,
                triggered: w.rumorTriggered,
                outcome: w.rumorTriggered
                  ? w.rumorOutcome
                  : `${rumor.name} was carried through the run without firing.`,
              }
            : undefined;
        })()
      : undefined,
    firstNight: w.firstNightChapter
      ? {
          chapter: w.firstNightChapter.chapter,
          label: w.firstNightChapter.label,
          goal: w.firstNightChapter.goal,
          consequence: w.firstNightChapter.consequence,
          beatTitle: w.firstNightChapter.beatTitle,
          beatTriggered: w.firstNightBeatTriggered,
          thread: w.firstNightChapter.thread,
        }
      : undefined,
    districtIncursion: w.districtIncursion
      ? {
          id: w.districtIncursion.id,
          title: w.districtIncursion.title,
          landmark: w.districtIncursion.landmark,
          phase: w.districtIncursion.phase,
          progress: Math.min(w.districtIncursion.target, Math.floor(w.districtIncursion.progress)),
          target: w.districtIncursion.target,
          rewardCred: w.districtIncursion.rewardCred,
          rewardTokens: w.districtIncursion.rewardTokens,
        }
      : undefined,
    challenges: w.challenges.map((challenge) => ({
      id: challenge.id,
      name: challenge.name,
      rewardMultiplier: challenge.rewardMultiplier,
      bonusCred: Math.max(0, Math.floor(baseCred * challengeMultiplier) - baseCred),
    })),
    endless: e
      ? {
          maxDistancePx: e.maxDistancePx,
          dungeonDepth: e.dungeonDepth,
          blocksWalked: Math.round(e.maxDistancePx / CHUNK_SIZE),
          currentBandId: e.currentBandId,
          discoveredBandIds: [...e.discoveredBandIds],
          discoveredRouteEventIds: [...e.discoveredRouteEventIds],
        }
      : undefined,
  };
}
