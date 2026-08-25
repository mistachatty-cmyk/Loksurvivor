/**
 * Core type contracts for the 616 Survivor prototype.
 *
 * Everything the game shows is described by data in `src/game/data`.
 * Adding a character, enemy, area, ally or upgrade means adding a record --
 * never editing the simulation loop.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ */
/* Palettes and sprite rigs                                            */
/* ------------------------------------------------------------------ */

/** Named colors a sprite rig can reference. */
export interface SpritePalette {
  ink: string;
  body: string;
  bodyDark: string;
  accent: string;
  accentBright: string;
  skin: string;
  glow: string;
}

export type PartKey =
  | 'shadow'
  | 'legL'
  | 'legR'
  | 'torso'
  | 'armL'
  | 'armR'
  | 'head'
  | 'face'
  | 'crest'
  | 'aura';

/** A rectangle in the sprite's local pixel grid (origin = feet center). */
export interface SpritePart {
  key: PartKey;
  /** Pixel offset from the sprite origin. +x right, +y up. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Palette color name used to fill this part. */
  color: keyof SpritePalette;
  /** Draw order; higher renders later. */
  z?: number;
}

/** Per-frame deltas applied to the base rig, keyed by part. */
export type FrameDelta = Partial<
  Record<PartKey, { dx?: number; dy?: number; dw?: number; dh?: number }>
>;

export type AnimName = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

export interface AnimClip {
  /** Milliseconds each frame is held. */
  frameMs: number;
  frames: FrameDelta[];
  /** When false the clip holds on its final frame. */
  loop?: boolean;
}

export interface SpriteRig {
  /** Height of the rig in sprite pixels; used to scale to world units. */
  pixelHeight: number;
  parts: SpritePart[];
  anims: Record<AnimName, AnimClip>;
}

/* ------------------------------------------------------------------ */
/* Characters                                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Loot prizes and objectives                                          */
/* ------------------------------------------------------------------ */

export interface LootPrizeDef {
  kind: 'cred' | 'token' | 'heal' | 'stat' | 'weapon';
  amount?: number;
  label: string;
  /** Stat key when kind === 'stat'. */
  stat?: keyof BaseStats;
  /** Additive amount when kind === 'stat'. */
  add?: number;
}

export type ObjectiveKind = 'kill-any' | 'kill-enemy' | 'survive-sec' | 'walk-blocks';

export interface ObjectiveDef {
  id: string;
  label: string;
  kind: ObjectiveKind;
  /** Enemy id for kill-enemy objectives. */
  enemyId?: string;
  targetCount: number;
  rewardCred: number;
  rewardTokens: number;
}

export interface RunObjective {
  def: ObjectiveDef;
  progress: number;
  completed: boolean;
  /** Snapshot of kills when objective started (for kill-any/kill-enemy). */
  baseKills?: number;
  baseEnemyKills?: number;
  /** World time when timing/distance objective started. */
  baseTime?: number;
  /** Endless distance when distance objective started. */
  baseDistancePx?: number;
}

export interface CompletedObjective {
  id: string;
  label: string;
  rewardCred: number;
  rewardTokens: number;
}

export type WeaponKind =
  | 'orbit'
  | 'projectile'
  | 'aura'
  | 'melee'
  | 'homing'
  | 'nova'
  | 'sweep';

export interface WeaponDef {
  id: string;
  name: string;
  kind: WeaponKind;
  description: string;
  /** Damage per hit at weapon level 1. */
  damage: number;
  /** Milliseconds between activations at level 1. */
  cooldownMs: number;
  /** World units. Meaning depends on kind (radius, reach, orbit distance). */
  range: number;
  /** Projectile / orbit speed in world units per second. */
  speed?: number;
  /** Number of instances spawned per activation. */
  count?: number;
  /** Lifetime for spawned entities, in ms. */
  lifetimeMs?: number;
  /** Damage multiplier gained for each weapon level above 1. */
  levelDamageScale: number;
  /** Optional tint used when this weapon is not a character signature. */
  color?: string;
  /** How this projectile behaves when it meets reflective cover. */
  obstacleInteraction?: 'block' | 'reflect';
  /** Optional crowd-control effect applied by this weapon's hits. */
  statusEffectId?: string;
}

/** Designer-facing metadata for a combat status effect. */
export interface StatusEffectDef {
  id: string;
  name: string;
  description: string;
  color: string;
  durationMs: number;
  maxStacks: number;
  /** Movement multiplier while active (0 completely stops movement). */
  speedMultiplier?: number;
}

/** A status effect currently affecting an actor. */
export interface StatusEffectInstance {
  id: string;
  stacks: number;
  appliedAt: number;
  expiresAt: number;
}

export interface RunWeapon {
  def: WeaponDef;
  level: number;
  count: number;
  readyAt: number;
}

export interface PassiveDef {
  id: string;
  name: string;
  description: string;
  weight: number;
  maxStacks: number;
  effects: UpgradeEffect[];
}

export interface RunPassive {
  def: PassiveDef;
  stacks: number;
}

export interface EvolutionDef {
  id: string;
  name: string;
  description: string;
  baseWeaponId: string;
  requiredPassiveId: string;
  result: WeaponDef;
}

export interface UltimateDef {
  id: string;
  name: string;
  description: string;
  cooldownMs: number;
  durationMs: number;
  /** Multipliers applied while the ultimate is active. */
  effect: {
    damageMult?: number;
    speedMult?: number;
    cooldownMult?: number;
    invulnerable?: boolean;
    novaDamage?: number;
    novaRadius?: number;
  };
}

export interface BaseStats {
  maxHp: number;
  /** World units per second. */
  speed: number;
  /** Global damage multiplier. */
  power: number;
  /** Global area multiplier. */
  area: number;
  /** Global cooldown multiplier (lower is faster). */
  haste: number;
  /** Pickup magnet radius in world units. */
  magnet: number;
  /** Contact damage resistance, 0..0.6 */
  armor: number;
}

export type UnlockRule =
  | { kind: 'default' }
  | { kind: 'rescue'; allyId: string }
  | { kind: 'clearArea'; areaId: string }
  | { kind: 'discovery'; discoveryId: string }
  | { kind: 'kills'; count: number };

export interface CharacterDef {
  id: string;
  name: string;
  handle: string;
  tagline: string;
  bio: string;
  palette: SpritePalette;
  rig: SpriteRig;
  stats: BaseStats;
  weapon: WeaponDef;
  ultimate: UltimateDef;
  unlock: UnlockRule;
  /** Path to the reference art the rig was built from, if any. */
  referenceArt?: string;
}

/* ------------------------------------------------------------------ */
/* Enemies                                                             */
/* ------------------------------------------------------------------ */

export type EnemyBehavior =
  | 'chase'
  | 'charger'
  | 'spitter'
  | 'drifter'
  | 'flanker'
  | 'shockwave'
  | 'prowler'
  | 'lookout'
  | 'current';

export interface EnemyDef {
  id: string;
  name: string;
  family: string;
  behavior: EnemyBehavior;
  hp: number;
  speed: number;
  /** Contact damage per hit. */
  damage: number;
  /** Collision radius in world units. */
  radius: number;
  /** Experience granted on defeat. */
  xp: number;
  /** Mass affects how far knockback pushes it. */
  mass: number;
  palette: SpritePalette;
  rig: SpriteRig;
  lore: string;
  /** Spitter-only tuning. */
  ranged?: { cooldownMs: number; projectileSpeed: number; damage: number };
}

/* ------------------------------------------------------------------ */
/* Areas and waves                                                     */
/* ------------------------------------------------------------------ */

export interface WaveDef {
  /** Seconds into the run when this wave starts contributing. */
  fromSec: number;
  /** Seconds into the run when it stops. */
  toSec: number;
  enemyId: string;
  /** Enemies spawned per second across the whole wave. */
  ratePerSec: number;
  /** Enemies released together per spawn tick. */
  burst: number;
  /** Additional enemy ids released with each burst to form a mixed group. */
  group?: string[];
  /** Multiplier applied to enemy hp for this wave. */
  hpMult?: number;
}

export interface ObstacleDef {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'dumpster' | 'car' | 'crate' | 'planter' | 'barrier' | 'ac-unit'
    | 'neon-sign' | 'barrel' | 'fuse-box' | 'street-lamp' | 'car-wreck'
    | 'crate-breakable' | 'security-camera' | 'cover' | 'reflective-surface' | 'flora';
}

export interface AreaDef {
  id: string;
  name: string;
  district: string;
  description: string;
  /** Public path to the reference backdrop shown in menus. */
  backdrop: string;
  /** Arena half-extents in world units. */
  bounds: { w: number; h: number };
  ground: {
    base: string;
    tile: string;
    seam: string;
    glow: string;
  };
  obstacles: ObstacleDef[];
  /** A readable set piece drawn into the arena as a visual story cue. */
  landmark?: {
    name: string;
    description: string;
    kind: 'market' | 'rail-yard' | 'plaza' | 'floodgate';
    accent: string;
  };
  /** Seconds the player must survive to clear the area. */
  durationSec: number;
  waves: WaveDef[];
  unlock: UnlockRule;
  /** Ally that can be rescued here (spawns a rescue cage mid-run). */
  rescueAllyId?: string;
  /** Discovery granted when the area is cleared for the first time. */
  discoveryId?: string;
  /** Difficulty label shown in menus. */
  threat: 'low' | 'rising' | 'high' | 'severe';
  /**
   * When true the run has no arena walls and no time limit.
   * The world streams outward; the player ends by dying or heading home.
   */
  endless?: true;
}

/* ------------------------------------------------------------------ */
/* Endless world                                                       */
/* ------------------------------------------------------------------ */

/** Visual style for a dungeon era (70s basement, 90s back room, etc.). */
export interface DungeonEra {
  name: string;
  ground: { base: string; tile: string; seam: string; glow: string };
  obstacles: ObstacleDef[];
  bounds: { w: number; h: number };
}

/** Live state kept on the World while running in endless mode. */
export interface EndlessState {
  /** World-space distance from origin — drives difficulty. */
  maxDistancePx: number;
  /** Number of dungeon rooms the player has entered. */
  dungeonDepth: number;
  /** Whether the player is currently inside a dungeon room. */
  inDungeon: boolean;
  /** Index into DUNGEON_ERAS for the current room. */
  dungeonEraIndex: number;
  /** Bounds used inside a dungeon room. */
  dungeonBounds: { w: number; h: number };
  /** Player world position on the streets (to return here after dungeon). */
  streetReturnX: number;
  streetReturnY: number;
  /** World-space position the dungeon room is centred on. */
  dungeonCenterX: number;
  dungeonCenterY: number;
  /** Exit trigger zone in world coords. */
  exitZone: { x: number; y: number; w: number; h: number } | null;
  /** Active dungeon entrance markers (world-space). */
  dungeonEntrances: Array<{ x: number; y: number; w: number; h: number; chunkKey: string }>;
  /** Entrance chunk keys whose entrance has already been used once. */
  consumedEntranceChunks: Set<string>;
  /** Map from chunkKey to the flat Aabb list that chunk contributed to w.obstacles. */
  chunkObstacles: Map<string, Array<{ x: number; y: number; w: number; h: number; kind?: ObstacleDef['kind'] }>>;
  /** Fractional enemy spawn budget (accumulates over time). */
  spawnBudget: number;
  /** The run seed, forwarded here so chunk generation stays deterministic. */
  rngSeed: number;
  /** Pending transition the RunScreen should animate before resuming. */
  pendingTransition: 'enter' | 'exit' | null;
}

/* ------------------------------------------------------------------ */
/* Allies, hub rooms, discoveries, upgrades                            */
/* ------------------------------------------------------------------ */

export interface AllyDef {
  id: string;
  name: string;
  role: string;
  blurb: string;
  /** Hub room this ally hangs out in once rescued. */
  room: string;
  /** Permanent stat boost applied to every character. */
  boost: Partial<BaseStats>;
  boostLabel: string;
  palette: SpritePalette;
}

export interface HubRoomDef {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  backdrop: string;
  /** Visual identity used by the hideout atmosphere layer. */
  biome?: HideoutBiome;
  unlock: UnlockRule;
  /** Feature keys surfaced in this room. */
  features: Array<'runs' | 'roster' | 'bestiary' | 'music' | 'unlocks' | 'allies' | 'recovery'>;
}

export type HideoutBiome = 'sanctum' | 'rooftop' | 'cellar';

export type HideoutWeather = 'clear' | 'rain' | 'fog' | 'snow' | 'heat';

export interface HideoutSceneDef {
  biome: HideoutBiome;
  weather: HideoutWeather;
  weatherLabel: string;
  weatherDescription: string;
  homeName: string;
  homeDescription: string;
  homeAccent: string;
  skyAccent: string;
  motionKind: 'birds' | 'drones' | 'motes';
  flavorLines: string[];
}

export type FacilityTier = 'tub' | 'shower' | 'hot-tub' | 'sauna' | 'rooftop-hot-tub';

export interface RecoveryFacilityDef {
  id: FacilityTier;
  name: string;
  description: string;
  recoveryPctPerMinute: number;
  socialCapacity: number;
  cost: number;
  unlockText: string;
}

export interface RecoveryHutDef {
  id: string;
  name: string;
  areaId: string;
  description: string;
  facility: FacilityTier;
  unlock: UnlockRule;
}

export interface RecoverySession {
  characterId: string | null;
  locationId: string;
  startedAt: number | null;
  lastUpdatedAt: number;
}

export interface DiscoveryDef {
  id: string;
  name: string;
  blurb: string;
}

export type UpgradeEffect =
  | { kind: 'stat'; stat: keyof BaseStats; add?: number; mult?: number }
  | { kind: 'weaponLevel'; amount: number }
  | { kind: 'weaponCount'; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'ultimateCooldown'; mult: number };

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  /** Higher weight appears more often in the level-up draw. */
  weight: number;
  maxStacks: number;
  effects: UpgradeEffect[];
  /** Restrict this upgrade to specific weapon kinds. */
  weaponKinds?: WeaponKind[];
  /** Level-up cards can grant a new item or evolve an existing one. */
  cardKind?: 'upgrade' | 'weapon' | 'passive' | 'evolution';
  weaponId?: string;
  passiveId?: string;
  evolutionId?: string;
}

/* ------------------------------------------------------------------ */
/* Persistent meta progression                                         */
/* ------------------------------------------------------------------ */

export interface MetaState {
  version: number;
  /** Development-only switch for exposing every unlockable surface. */
  devModeAllUnlocks: boolean;
  selectedCharacterId: string;
  unlockedCharacterIds: string[];
  clearedAreaIds: string[];
  rescuedAllyIds: string[];
  discoveryIds: string[];
  /** enemyId -> total defeats, drives the bestiary. */
  bestiary: Record<string, number>;
  totalKills: number;
  totalRuns: number;
  bestSurvivalSec: number;
  /** Soft currency earned per run. */
  cred: number;
  /** Loot tokens spendable in the hideout. */
  lootTokens: number;
  /** Whether the player has seen the intro briefing. */
  onboarded: boolean;
  /** Farthest endless distance ever reached (world units). */
  endlessRecordDistancePx: number;
  /** Deepest dungeon depth ever reached in endless mode. */
  endlessRecordDepth: number;
  /** Character id -> current fatigue penalty percentage, capped at 5. */
  fatigueByCharacter: Record<string, number>;
  /** The active recovery session, if anyone is resting. */
  recovery: RecoverySession;
  /** Highest hideout facility purchased by the player. */
  facilityTier: FacilityTier;
  /** Field recovery huts discovered in explored areas. */
  discoveredHutIds: string[];
}

/* ------------------------------------------------------------------ */
/* Run results and HUD snapshots                                       */
/* ------------------------------------------------------------------ */

export interface RunResult {
  areaId: string;
  characterId: string;
  cleared: boolean;
  survivedSec: number;
  kills: number;
  level: number;
  cred: number;
  killsByEnemy: Record<string, number>;
  rescuedAllyId?: string;
  discoveryId?: string;
  newlyUnlockedCharacterIds: string[];
  loadout: {
    weapons: Array<{ id: string; name: string; level: number }>;
    passives: Array<{ id: string; name: string; stacks: number }>;
  };
  /** Loot boxes opened this run. */
  lootBoxesOpened: number;
  /** Prize labels collected from loot boxes. */
  openedPrizes: string[];
  /** Loot tokens earned this run. */
  lootTokensGained: number;
  /** Fatigue applied to the operative after this run. */
  fatigueAddedPct?: number;
  /** Operative's fatigue after this run, before recovery begins. */
  fatigueAfterPct?: number;
  /** Objectives completed this run. */
  completedObjectives: CompletedObjective[];
  /** Endless-mode stats (undefined for timed runs). */
  endless?: {
    maxDistancePx: number;
    dungeonDepth: number;
    /** "Blocks walked" — rounded distance in city-block units for display. */
    blocksWalked: number;
  };
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  elapsedSec: number;
  durationSec: number;
  kills: number;
  cred: number;
  ultimateReadyPct: number;
  ultimateActive: boolean;
  weaponLevel: number;
  loadout: {
    weapons: Array<{ id: string; name: string; level: number; color?: string }>;
    passives: Array<{ id: string; name: string; stacks: number }>;
  };
  alerts: string[];
  rescueAvailable: boolean;
  rescueProgressPct: number;
  lootBoxesOpened: number;
  /** Effects currently active on the player's enemies, grouped for HUD display. */
  activeEffects: Array<{ id: string; name: string; color: string; count: number }>;
  objectives: Array<{
    label: string;
    progress: number;
    target: number;
    completed: boolean;
  }>;
  /** Set when running in endless mode. */
  endless?: {
    blocksWalked: number;
    dungeonDepth: number;
    inDungeon: boolean;
    dungeonEraName: string;
  };
}

export type RunPhase = 'countdown' | 'playing' | 'levelup' | 'paused' | 'reel' | 'over';
