Warning: truncated output (original token count: 51822)
Total output lines: 5841

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
  DashSkillDef,
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
  RunAuraStyle,
  RunPassive,
  RunWeapon,
  StatusEffectInstance,
  UpgradeDef,
  WeaponDef,
  ObstacleDef,
  ImpactIntensity,
  PotholeTrigger,
  PaletteEffectDef,
  PropVariant,
  RelicRecipeDef,
  StealthAbilityConfig,
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

/** An enemy queued to detonate a beat after a dash-pushed hit sends it flying. */
export interface PendingLandExplosion {
  /** Enemy uid to re-check for a fresher position; falls back to x/y if it died first. */
  uid: number;
  x: number;
  y: number;
  readyAt: number;
  damage: number;
  radius: number;
}

/** Per-run bookkeeping for a character's `dashSkill`. */
export interface DashSkillRuntime {
  def: DashSkillDef;
  /** pulse-shield: next-ready timestamp for each currently unlocked direction slot. */
  slotReadyAt: number[];
  /** directional-wall: next-ready timestamp for the passive wall tick. */
  wallReadyAt: number;
  /** directional-wall: dash-pushed enemies waiting to detonate after landing. */
  pendingLandings: PendingLandExplosion[];
}

function createDashSkillRuntime(def: DashSkillDef | undefined): DashSkillRuntime | null {
  if (!def) return null;
  return { def, slotReadyAt: [0], wallReadyAt: 0, pendingLandings: [] };
}

export type PickupKind = 'xp' | 'health' | 'cred' | 'sweep' | 'loot-box' | 'coin';

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

/** Ground-hazard liquids spawned by breaking certain obstacles. Never solid — always kept out of `w.obstacles`. */
export type FluidKind = 'water' | 'oil' | 'burning-oil' | 'coolant' | 'runoff';

export interface FluidTile {
  uid: number;
  kind: FluidKind;
  x: number;
  y: number;
  /** Current footprint; grows from a fraction of maxRadius toward it after spawning. */
  radius: number;
  maxRadius: number;
  spawnedAt: number;
  expiresAt: number;
  nextTickAt: number;
  sourceUid?: number;
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
  'trash-can': { variant: 'light-breakable', hp: 40 },
  mailbox: { variant: 'light-breakable', hp: 70 },
  'fire-hydrant': { variant: 'light-breakable', hp: 95 },
  'parking-meter': { variant: 'light-breakable', hp: 55 },
  /** Promoted from indestructible-by-omission so it can emit coolant on break. */
  'ac-unit': { variant: 'light-breakable', hp: 100 },
};
const PROJECTILE_BLOCKING_KINDS = new Set<ObstacleDef['kind']>([
  'crate-breakable', 'crate', 'barrel', 'street-lamp', 'cover', 'reflective-surface', 'metal-box', 'bench',
]);

/** Small street-flavor breakables: bonus drops and rare-currency odds are scoped to just these four. */
const NEW_STREET_PROP_KINDS = new Set<ObstacleDef['kind']>(['trash-can', 'mailbox', 'fire-hydrant', 'parking-meter']);
const NEW_PROP_BONUS_DROP_CHANCE = 0.35;
const NEW_PROP_BONUS_DROP_ENDLESS_MULT = 1.6;
const RARE_CURRENCY_BASE_CHANCE = 0.02;
const RARE_CURRENCY_ENDLESS_MULT = 3;

const FLUID_SPAWN_GROW_MS = 900;
const FLUID_TICK_MS = 420;
const FLUID_LIFETIMES: Record<FluidKind, number> = {
  water: 9000,
  oil: 11000,
  'burning-oil': 5000,
  coolant: 8000,
  runoff: 10000,
};
const FLUID_MAX_RADIUS: Record<FluidKind, number> = {
  water: 84,
  oil: 78,
  'burning-oil': 78,
  coolant: 70,
  runoff: 82,
};
/** Immediate, position-based speed multiplier per fluid kind. Omitted kinds (runoff) don't change speed directly. */
const FLUID_SPEED_MULTIPLIERS: Partial<Record<FluidKind, number>> = {
  water: 0.85,
  oil: 1.12,
  'burning-oil': 1.12,
  coolant: 0.4,
};

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
  /** Runtime bookkeeping for the character's dash skill, when it has one. */
  dashSkill: DashSkillRuntime | null;
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
  /** Ground-hazard fluids spawned by breaking certain obstacles (fire hydrant, car-wreck, ac-unit, dumpster). */
  fluids: FluidTile[];
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
  /** Extra world units added to the physics-object click/tap radius, from Grabby Hands stacks. */
  physicsObjectClickRadiusBonus: number;
  /** 2 once Colossus Frame is owned; scales the player's collision radius and sprite. */
  playerSizeMult: number;
  /** Resolved Ghost Cloak config from the vendor tree, or null when the ability isn't owned. */
  stealthConfig: StealthAbilityConfig | null;
  /** "Let Me Hold This" owned: hazard weapons never hurt whoever's holding them, native character or not. */
  hazardImmune: boolean;
  /** Timestamp (w.now) the current cloak activation ends; 0 or in the past when not cloaked. */
  stealthUntil: number;
  /** Timestamp (w.now) the cloak is next allowed to activate. */
  stealthReadyAt: number;
  /** Player position frozen at cloak activation -- enemies chase this instead of the live position while cloaked. */
  stealthAnchorX: number;
  stealthAnchorY: number;
  /** Quartermaster minimap recon tiers, resolved once at run start. */
  minimapEnemyRadar: boolean;
  minimapLootSense: boolean;
  minimapHazardSense: boolean;
  /** When false, birds and fireflies stay visible through rain/fog instead of sheltering. */
  wildlifeSheltersInRain: boolean;
  /** Procedural player aura selected in the hideout; visual only. */
  runAuraStyle: RunAuraStyle;
  /** Optional animated flourish supplied by the active palette; visual only. */
  paletteEffect?: PaletteEffectDef;
  /** Optional difficulty contracts selected before the run. */
  challenges: ChallengeContractDef[];
  /** One bounded hideout rumor carried into this run. */
  activeCrewRumor: ActiveCrewRumor | null;
  /** Whether the carried rumor has fired its gameplay effect yet. */
  rumorTriggered: boolean;
  /** w.now at which rumorTriggered flipped true; used to fade the HUD banner after firing. */
  rumorTriggeredAt: number;
  /** Human-readable outcome used by the run HUD and summary. */
  rumorOutcome: string;
  rumorSpeedUntil: number;
  rumorPantryAvailable: boolean;
  rumorBroadcastAvailable: boolean;
  rumorMagnetNextAt: number;
  /** Authored opening-campaign cue for this area, when one exists. */
  firstNightChapter?: ReturnType<typeof getFirstNightChapter>;
  firstNightBeatTriggered: boolean;
  /** w.now at which firstNightBeatTriggered flipped true; used to fade the HUD banner after it fires. */
  firstNightBeatTriggeredAt: number;
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
  /** Rare currency (skeleton keys) earned this run, found by breaking street props. */
  skeletonKeysGained: number;

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
    physicsObjectClickRadiusBonus?: number;
    sizeMult?: number;
    stealth?: StealthAbilityConfig | null;
    hazardImmune?: boolean;
    minimapEnemyRadar?: boolean;
    minimapLootSense?: boolean;
    minimapHazardSense?: boolean;
    runAuraStyle?: RunAuraStyle;
    paletteEffect?: PaletteEffectDef;
    /** Progression-aware rescue selected by the meta layer. Undefined means this route is complete. */
    rescueAllyId?: string | undefined;
  } = {},
): World {
  const sizeMult = setup.sizeMult ?? 1;
  const player: PlayerActor = {
    uid: 1,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    radius: 12 * sizeMult,
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
    dashSkill: createDashSkillRuntime(character.dashSkill),
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
    fluids: [],
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
      status: ('rescueAllyId' in setup ? setup.rescueAllyId : area.rescueAllyId) ? 'pending' : 'freed',
      x: 0,
      y: 0,
      progress: 0,
      appearAtSec: Math.round(area.durationSec * 0.35),
      allyId: 'rescueAllyId' in setup ? setup.rescueAllyId : area.rescueAllyId,
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
    physicsObjectClickRadiusBonus: setup.physicsObjectClickRadiusBonus ?? 0,
    playerSizeMult: sizeMult,
    stealthConfig: setup.stealth ?? null,
    hazardImmune: setup.hazardImmune ?? false,
    stealthUntil: 0,
    stealthReadyAt: setup.stealth ? 4000 : Number.POSITIVE_INFINITY,
    stealthAnchorX: 0,
    stealthAnchorY: 0,
    minimapEnemyRadar: setup.minimapEnemyRadar ?? false,
    minimapLootSense: setup.minimapLootSense ?? false,
    minimapHazardSense: setup.minimapHazardSense ?? false,
    wildlifeSheltersInRain: setup.wildlifeSheltersInRain !== false,
    runAuraStyle: setup.runAuraStyle ?? 'street-halo',
    paletteEffect: setup.paletteEffect,
    challenges: [...challenges],
    activeCrewRumor: activeCrewRumor ? { ...activeCrewRumor } : null,
    rumorTriggered: activeCrewRumor?.rumorId === 'painted-shortcut',
    rumorTriggeredAt: activeCrewRumor?.rumorId === 'painted-shortcut' ? 0 : Number.POSITIVE_INFINITY,
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
    firstNightBeatTriggeredAt: Number.POSITIVE_INFINITY,
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
          endedAt: 0,
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
    skeletonKeysGained: 0,
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

/**
 * How long a one-shot story/event banner (first night beat, a fired rumor,
 * a finished district incursion) stays on the HUD before it fades. Past
 * this window the outcome is history, not something the player still needs
 * on screen — keeping it up forever crowds out live gameplay HUD elements.
 */
const HUD_STORY_BEAT_MS = 6000;

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
    wea…31822 tokens truncated…utcome === 'cleared' && w.area.discoveryId === def.objective.discoveryId) progress += 1;
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
    w.fluids = [];
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
  w.fluids = [];

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
  w.fluids = [];
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
  w.fluids = [];
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
    w.firstNightBeatTriggeredAt = w.now;
    pushAlert(w, `${w.firstNightChapter.beatTitle} — ${w.firstNightChapter.beatText}`);
  }

  if (input.ultimate) activateUltimate(w);

  updatePlayer(w, dt, input.moveX, input.moveY);
  updateStealth(w);
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
  updateFluids(w);

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
  updateDashSkill(w);
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
      weapons: w.weapons.map((weapon) => ({ id: weapon.def.id, name: weapon.def.name, level: weapon.level, kind: weapon.def.kind, color: weapon.def.color })),
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
    crewRumor: w.activeCrewRumor &&
      (!w.rumorTriggered || w.rumorPantryAvailable || w.now - w.rumorTriggeredAt < HUD_STORY_BEAT_MS)
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
    // Shown only for a short window after it fires -- the same beat is
    // already announced transiently via `alerts`, so leaving this up for
    // the rest of the run would just duplicate that text permanently.
    firstNightBeat: w.firstNightChapter && w.firstNightBeatTriggered &&
      w.now - w.firstNightBeatTriggeredAt < HUD_STORY_BEAT_MS
      ? {
          chapter: w.firstNightChapter.chapter,
          title: w.firstNightChapter.beatTitle,
          text: w.firstNightChapter.beatText,
        }
      : undefined,
    // Live states (pending/warning/active) always show; a finished incursion
    // (complete/failed) is only shown briefly -- its outcome text already
    // went out via `alerts`, and "FAILED" sitting on screen for the rest of
    // the run reads as an ongoing problem rather than a resolved event.
    districtIncursion: w.districtIncursion &&
      (w.districtIncursion.phase !== 'complete' && w.districtIncursion.phase !== 'failed'
        || w.now - w.districtIncursion.endedAt < HUD_STORY_BEAT_MS)
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
          nearbyEnemies: w.minimapEnemyRadar
            ? w.enemies.filter((enemy) => !enemy.dying).map((enemy) => ({ x: enemy.x, y: enemy.y }))
            : [],
          nearbyPickups: w.minimapLootSense
            ? w.pickups
                .filter((pickup) => pickup.kind !== 'xp' && pickup.kind !== 'sweep')
                .map((pickup) => ({ x: pickup.x, y: pickup.y, kind: pickup.kind }))
            : [],
          nearbyHazards: w.minimapHazardSense
            ? w.enemies
                .filter((enemy) => !enemy.dying && (enemy.telegraphUntil > w.now || enemy.specialUntil > w.now))
                .map((enemy) => ({ x: enemy.x, y: enemy.y, radius: enemy.specialRadius || enemy.radius * 3 }))
            : [],
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
      weapons: w.weapons.map((weapon) => ({ id: weapon.def.id, name: weapon.def.name, level: weapon.level, kind: weapon.def.kind, color: weapon.def.color })),
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
    skeletonKeysGained: w.skeletonKeysGained,
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
