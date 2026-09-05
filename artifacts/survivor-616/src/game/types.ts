/**
 * Core type contracts for the 616 Survivor prototype.
 *
 * Everything the game shows is described by data in `src/game/data`.
 * Adding a character, enemy, area, ally or upgrade means adding a record --
 * never editing the simulation loop.
 */

import type { BeatReaction } from '@/game/data/reactivity';

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
  kind: 'cred' | 'token' | 'heal' | 'stat' | 'weapon' | 'lokpet';
  amount?: number;
  label: string;
  /** Stat key when kind === 'stat'. */
  stat?: keyof BaseStats;
  /** Additive amount when kind === 'stat'. */
  add?: number;
  /** Generated companion payload when kind === 'lokpet'. */
  lokPet?: LokPetRoll;
}

export type LokPetFamily = 'animal' | 'ghoul' | 'bat' | 'mote' | 'blob' | 'mechanical';
export type LokPetSilhouette = 'pouncer' | 'skull' | 'winglet' | 'spark' | 'jelly' | 'clockwork';
export type LokPetAttackKind = 'shot' | 'rapid-shot' | 'heavy-shot' | 'pulse' | 'explosion';
export type LokPetElement = 'none' | 'fire' | 'freeze' | 'slow';
export type LokPetRarity = 'common' | 'charged' | 'rare' | 'mythic';

/** Compact palette for original, vector-drawn companion variants. */
export interface LokPetPalette {
  body: string;
  bodyDark: string;
  accent: string;
  glow: string;
  eye: string;
}

/** The visual “variant sheet” entry used by the deterministic pet generator. */
export interface LokPetVariantDef {
  id: string;
  name: string;
  family: LokPetFamily;
  silhouette: LokPetSilhouette;
  palette: LokPetPalette;
  description: string;
}

/** Rarity-tuned stat sheet used when a chest generates a LokPet. */
export interface LokPetStatSheet {
  rarity: LokPetRarity;
  label: string;
  powerMultiplier: number;
  health: number;
  moveSpeed: number;
  damage: number;
  cooldownMs: number;
  range: number;
  projectileSpeed: number;
  explosionRadius: number;
  pulseRadius: number;
  lifetimeMs: number;
  weight: number;
}

/** A generated chest payload; it becomes a live LokPet when applied to a world. */
export interface LokPetRoll {
  name: string;
  variantId: string;
  family: LokPetFamily;
  silhouette: LokPetSilhouette;
  palette: LokPetPalette;
  rarity: LokPetRarity;
  rarityLabel: string;
  attackKind: LokPetAttackKind;
  element: LokPetElement;
  elementLabel: string;
  description: string;
  stats: Omit<LokPetStatSheet, 'rarity' | 'label' | 'weight' | 'powerMultiplier'>;
  traitLabel: string;
}

/** A captured, repeatable LokPet blueprint stored in the player's kennel. */
export interface SavedLokPet {
  id: string;
  roll: LokPetRoll;
  /** One charge is spent when the pet joins a run; elixirs restore it. */
  stamina: number;
}

/** A run-independent record of a LokPet variant seen in any run. */
export interface LokPetCatalogTrait {
  attackKind: LokPetAttackKind;
  element: LokPetElement;
  elementLabel: string;
  label: string;
}

export interface LokPetCatalogEntry {
  variantId: string;
  family: LokPetFamily;
  silhouette: LokPetSilhouette;
  palette: LokPetPalette;
  /** Rarities observed for this variant across all runs. */
  rarities: LokPetRarity[];
  /** Distinct combat traits observed for this variant across all runs. */
  traits: LokPetCatalogTrait[];
  sightings: number;
}

/** Catalog progress made by one run, compared with the permanent catalog before it. */
export interface LokPetRunDiscovery {
  variantId: string;
  /** Number of sightings of this variant in the run. */
  sightings: number;
  /** Total sightings after this run is recorded. */
  totalSightings: number;
  /** True only the first time this variant is seen across all runs. */
  newVariant: boolean;
  /** Rarities observed in this run that were not already catalogued. */
  newRarities: LokPetRarity[];
  /** Combat traits observed in this run that were not already catalogued. */
  newTraits: LokPetCatalogTrait[];
}

/** A persisted, per-run snapshot of LokPet catalog progress. */
export interface LokPetDiscoveryHistoryEntry {
  runNumber: number;
  recordedAt: number;
  areaId: string;
  characterId: string;
  cleared: boolean;
  discoveries: LokPetRunDiscovery[];
}

/** A generated LokPet currently orbiting the player in a run. */
export interface LokPetInstance extends LokPetRoll {
  /** Whether this companion came from a chest this run or the saved loadout. */
  origin: 'chest' | 'loadout';
  uid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  orbitAngle: number;
  orbitRadius: number;
  bornAt: number;
  ghostAt: number;
  expiresAt: number;
  ghost: boolean;
  readyAt: number;
  nextPulseAt: number;
  hp: number;
  maxHp: number;
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

export type DailyContractKind = 'clear-area' | 'kill-any' | 'survive-sec';

export interface DailyContractDef {
  id: string;
  name: string;
  description: string;
  kind: DailyContractKind;
  targetCount: number;
  rewardCred: number;
  rewardTokens: number;
}

export interface DailyContractStatus extends DailyContractDef {
  progress: number;
  completed: boolean;
}

export interface CompletedDailyContract {
  id: string;
  name: string;
  rewardCred: number;
  rewardTokens: number;
}

export type EpisodeObjectiveKind =
  | 'kill-any'
  | 'kill-enemy'
  | 'survive-sec'
  | 'walk-blocks'
  | 'rescue-ally'
  | 'discover'
  | 'clear-area';

export interface EpisodeObjectiveDef {
  id: string;
  label: string;
  kind: EpisodeObjectiveKind;
  targetCount: number;
  enemyId?: string;
  allyId?: string;
  discoveryId?: string;
  areaId?: string;
}

export interface CharacterEpisodeDef {
  id: string;
  characterId: string;
  title: string;
  teaser: string;
  cityLocation: string;
  areaId: string;
  crewAllyId: string;
  unlock: UnlockRule;
  objective: EpisodeObjectiveDef;
  completionText: string;
  evolutionId: string;
}

export type RelicRecipeTrigger = 'level-up';

export interface CityRelicDef {
  id: string;
  name: string;
  description: string;
  sourceAreaId: string;
  sourceDiscoveryId: string;
  sourceLabel: string;
  color: string;
}

export type EvolutionBehaviorKind =
  | 'chain'
  | 'split'
  | 'field'
  | 'orbit-burst'
  | 'status-spread'
  | 'delayed-burst';

export interface EvolutionBehavior {
  kind: EvolutionBehaviorKind;
  /** Optional secondary effect radius for behavior-specific follow-up damage. */
  radius?: number;
  /** Optional number of follow-up instances. */
  count?: number;
  /** Optional status effect propagated by the evolved attack. */
  statusEffectId?: string;
}

export type WeaponKind =
  | 'orbit'
  | 'projectile'
  | 'aura'
  | 'melee'
  | 'homing'
  | 'nova'
  | 'sweep'
  | 'wave'
  | 'laser'
  | 'hazard'
  | 'teleport'
  | 'convert'
  | 'punch'
  | 'follower'
  /** Telegraphs a ground reticle on a nearby enemy, then a comet drops from
   *  off-screen and strikes it. See run-presentation.md. */
  | 'meteor';

/**
 * Shared physical-impact spectrum for authored attacks.
 *
 * 0 = no physical response, 1 = tap, 2 = shove, 3 = heavy hit,
 * 4 = launch, 5 = contained burst.  This is intentionally separate from
 * damage: a low-damage attack can still move a prop, and vice versa.
 */
export type ImpactIntensity = 0 | 1 | 2 | 3 | 4 | 5;

export type PotholeTrigger = 'stomp' | 'ground-shock';

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
  /** Authored physical force on the shared 0–5 impact spectrum. */
  impactIntensity: ImpactIntensity;
  /** Only explicitly tagged ground attacks can open lethal potholes. */
  impactTrigger?: PotholeTrigger;
  /** Optional tint used when this weapon is not a character signature. */
  color?: string;
  /** How this projectile behaves when it meets reflective cover. */
  obstacleInteraction?: 'block' | 'reflect';
  /** Optional crowd-control effect applied by this weapon's hits. */
  statusEffectId?: string;
  /** Optional staged field or conversion lifetime. */
  durationMs?: number;
  /** Follower behavior metadata for swarm-style signature weapons. */
  follower?: { speed: number; radius: number; count: number; growAfterMs?: number; maxRadius?: number; lifetimeMs?: number };
  /** Number of additional enemies a projectile can pass through after its first hit. */
  pierce?: number;
  /**
   * Projectile/homing weapons only: before firing, slam an AoE nova (radius
   * `range`) at the player that stuns and knocks back everything caught in
   * it. Used for ground-impact attack styles like Needle Drop & Scratch.
   */
  groundSlam?: boolean;
  /** Hazard-kind weapons only: the character who takes no self-damage from
   *  this weapon's own puddle/field by default. Any other character
   *  wielding it (e.g. picked up as a loot weapon) still takes self-damage
   *  from it, unless the "Let Me Hold This" Quartermaster ability is
   *  unlocked. */
  nativeCharacterId?: string;
  /**
   * Elemental synergy: this weapon's slash/wave/laser/impact hits deal
   * `bonusVsStatusMult`x damage against a target that already carries
   * `bonusVsStatusId`. E.g. an electric weapon hitting a target already
   * `wet`. See run-presentation.md.
   */
  bonusVsStatusId?: string;
  bonusVsStatusMult?: number;
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
  /** Damage-dealt multiplier while active (used by enemy-empowering hazards). */
  damageMultiplier?: number;
}

/** A status effect currently affecting an actor. */
export interface StatusEffectInstance {
  id: string;
  stacks: number;
  appliedAt: number;
  expiresAt: number;
  nextTickAt?: number;
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
  /** Legacy passive gate retained for compatibility with the original three cards. */
  requiredPassiveId?: string;
  characterId?: string;
  episodeId?: string;
  identity: string;
  color: string;
  behavior?: EvolutionBehavior;
  result: WeaponDef;
}

export interface RelicRecipeDef {
  id: string;
  name: string;
  description: string;
  identity: string;
  relicId: string;
  baseWeaponId: string;
  minWeaponLevel: number;
  trigger: RelicRecipeTrigger;
  triggerLabel: string;
  color: string;
  behavior?: EvolutionBehavior;
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

/**
 * An always-on passive tied to a character's signature weapon that the dash
 * button also triggers or empowers -- the first of a family of "dash skills".
 */
export type DashSkillDef =
  | {
      kind: 'pulse-shield';
      /** Damage each directional pulse deals to enemies it catches. */
      pulseDamage: number;
      /** World-unit reach of one pulse. */
      pulseRadius: number;
      /** Angular width of one pulse wedge, in radians. */
      pulseArc: number;
      /** Music beats between pulses on a single direction slot. */
      beatsPerPulse: number;
      /** Weapon levels needed to unlock one more simultaneous direction. */
      levelsPerDirection: number;
      /** Hard cap on simultaneous pulse directions. */
      maxDirections: number;
      /** Damage multiplier for the all-direction burst a dash triggers. */
      dashBurstMult: number;
    }
  | {
      kind: 'directional-wall';
      /** Passive tick damage dealt to anything touching the wall. */
      wallDamage: number;
      /** How far the wall stands off from the player. */
      wallRange: number;
      /** Angular width of the wall arc, in radians. */
      wallArc: number;
      /** Milliseconds between passive wall damage ticks. */
      wallTickMs: number;
      /** Damage multiplier applied when a dash pushes the wall outward. */
      dashPushMult: number;
      /** Delay after a dash-pushed enemy lands before it detonates, in ms. */
      landExplodeDelayMs: number;
      /** Damage dealt by the delayed landing explosion. */
      landExplodeDamage: number;
      /** Radius of the delayed landing explosion. */
      landExplodeRadius: number;
    };

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
  /** Chance (0..1) that a hit is a critical, dealing 2x damage. */
  crit: number;
  /** Fraction (0..1) of damage dealt returned to the player as healing. */
  lifesteal: number;
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
  /** Optional always-on ability the dash button also triggers or empowers. */
  dashSkill?: DashSkillDef;
  /** Path to the reference art the rig was built from, if any. */
  referenceArt?: string;
  /** How this character moves to the music. See `data/reactivity.ts`. */
  react?: BeatReaction[];
  /**
   * Grants a draggable elemental cloud companion (Storm Chaser). Optional --
   * any future character could opt in the same way. See run-presentation.md.
   */
  stormCloud?: StormCloudConfig;
}

/**
 * Storm Chaser's cloud: floats near the player by default, or the player
 * can drag it anywhere on screen for precision play. Cycles automatically
 * through its elemental modes on a timer by default -- not by tap count, so
 * it behaves identically on touch, mouse, and keyboard-only input -- but a
 * HUD control lets the player pick a mode directly, which hands over full
 * manual control (see `setStormCloudMode` in `engine/world.ts`). Whatever
 * mode is active also paints a matching ground `FluidTile` wherever the
 * cloud lingers -- fire/acid/frost stains that keep affecting anything that
 * walks over them after the cloud moves on, and `rain` paints water, which
 * washes those stains (and their status effects) off the ground and off
 * enemies standing in it. See run-presentation.md.
 */
export interface StormCloudConfig {
  /** Hit-test radius for grabbing the cloud with a pointer, in world units. */
  grabRadius: number;
  /** Damage/status application radius. */
  effectRadius: number;
  /** How often each mode ticks damage/status to anything underneath. */
  tickMs: number;
  /** How long each mode lasts before cycling to the next, while auto-cycling. */
  cycleMs: number;
  rainDamage: number;
  fireRainDamage: number;
  acidRainDamage: number;
  frostRainDamage: number;
}

/** The weather-cloud's current elemental mode. See `StormCloudConfig`. */
export type StormCloudMode = 'rain' | 'fire-rain' | 'acid-rain' | 'frost-rain';

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
  | 'current'
  | 'teleporter'
  | 'ghost'
  | 'shifter'
  | 'orbit'
  /** Continuously circles the player at `traits.swayRadius`; no special reveal gate. */
  | 'ringer'
  /** Invisible and unhurtable for `traits.revealMs`, then circles the player firing
   *  ranged shots and periodically teleports to a new angle. See oddity-arenas.md. */
  | 'wraith';

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
  /** Optional authored resistance to physical impact, 0 = none, 0.8 = stout. */
  impactResistance?: number;
  palette: SpritePalette;
  rig: SpriteRig;
  lore: string;
  /** Spitter-only tuning. */
  ranged?: { cooldownMs: number; projectileSpeed: number; damage: number };
  faction?: string;
  role?: 'anchor' | 'flanker' | 'sniper' | 'carrier' | 'swarm' | 'disruptor';
  /**
   * Visual scale tier, independent of `radius` (which still drives collision).
   * Feeds a render-time size multiplier -- see `SIZE_CLASS_SCALE` in draw.ts.
   * Omitted reads as 'standard' except that a literal `family === 'Boss'`
   * still gets the old giant bump for pre-existing content that never set
   * this. See run-presentation.md.
   */
  sizeClass?: 'mini' | 'standard' | 'elite' | 'giant';
  traits?: {
    teleportMs?: number;
    ghostMs?: number;
    shiftMs?: number;
    shiftScale?: number;
    burstSpeed?: number;
    /** wraith/ringer: orbit radius around the player, in world units. */
    swayRadius?: number;
    /** wraith: how long each circling phase lasts before it teleports to a new angle. */
    swayMs?: number;
    /** wraith: invisible and undamageable window from spawn, in ms. */
    revealMs?: number;
  };
  /** How this enemy moves to the music. See `data/reactivity.ts`. */
  react?: BeatReaction[];
  /**
   * Excluded from the Bestiary's "caught / total" ratio and its own catalogue
   * entry. For enemies (like the Choir Wraith) whose HP is intentionally far
   * beyond what a run can realistically deal -- without this, 100% Bestiary
   * completion becomes permanently unreachable. See oddity-arenas.md.
   */
  excludeFromBestiary?: true;
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
  formation?: 'ring' | 'wedge' | 'wall' | 'escort' | 'pincer' | 'file' | 'bait';
  faction?: string;
}

export interface ObstacleDef {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'dumpster' | 'car' | 'crate' | 'planter' | 'barrier' | 'ac-unit'
    | 'neon-sign' | 'barrel' | 'fuse-box' | 'street-lamp' | 'car-wreck'
    | 'crate-breakable' | 'security-camera' | 'cover' | 'reflective-surface' | 'flora'
     | 'building' | 'river' | 'metal-box' | 'bench' | 'pothole'
     | 'trash-can' | 'mailbox' | 'fire-hydrant' | 'parking-meter'
     /** A heavy, wonky sentry block: zaps the player with a short-range bolt on a cadence. See oddity-arenas.md. */
     | 'attack-block';
  /** Optional authored prop physics profile; omitted props use kind defaults. */
  propVariant?: PropVariant;
  /** Lethal pothole tuning; present only when kind === 'pothole'. */
  pothole?: {
    trigger: PotholeTrigger;
    warningMs?: number;
    openingMs?: number;
    lethalRadius?: number;
  };
}

export type PropVariant = 'light-breakable' | 'medium-movable' | 'heavy-metal' | 'fixed-bench';

/**
 * Overhead conditions for an area. Drives clouds, rain, fog and lightning.
 * `roofed` means there is no sky at all (cellars, interiors) -- every sky
 * effect is suppressed rather than dimmed.
 */
export type AreaSky = 'clear' | 'overcast' | 'rain' | 'fog' | 'roofed';

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
  /** Overhead conditions; defaults to 'clear' when omitted. */
  sky?: AreaSky;
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
  /**
   * When set, pickups spawn at random points in the arena on a cadence,
   * independent of kills or breakables. See oddity-arenas.md.
   */
  randomDrops?: { intervalMs: number };
}

export type CustomMapAssetCategory = 'ground' | 'structure' | 'hazard' | 'landmark' | 'enemy' | 'encounter';

export interface CustomMapPlacement {
  id: string;
  assetId: string;
  category: Exclude<CustomMapAssetCategory, 'ground'>;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CustomMap {
  id: string;
  name: string;
  bounds: { w: number; h: number };
  groundAssetId: string;
  landmarkAssetId: string | null;
  placements: CustomMapPlacement[];
  durationSec: number;
  threat: AreaDef['threat'];
  backdrop: string;
  updatedAt: number;
}

export interface CustomMapAsset {
  id: string;
  category: CustomMapAssetCategory;
  name: string;
  description: string;
  color: string;
  w?: number;
  h?: number;
  areaId?: string;
  enemyId?: string;
  wave?: WaveDef;
}

export type DistrictIncursionKind = 'flood-surge' | 'market-bell' | 'freight-arrival' | 'fountain-ritual';
export type DistrictIncursionPhase = 'pending' | 'warning' | 'active' | 'complete' | 'failed';

/** A short, optional landmark encounter that interrupts a normal district run. */
export interface DistrictIncursionDef {
  id: string;
  areaId: string;
  kind: DistrictIncursionKind;
  title: string;
  landmark: string;
  warningText: string;
  activeText: string;
  objectiveLabel: string;
  completeText: string;
  failureText: string;
  triggerAtSec: number;
  warningLeadSec: number;
  durationSec: number;
  target: number;
  rewardCred: number;
  rewardTokens: number;
  accent: string;
}

export interface DistrictIncursionState {
  id: string;
  kind: DistrictIncursionKind;
  title: string;
  landmark: string;
  objectiveLabel: string;
  phase: DistrictIncursionPhase;
  progress: number;
  target: number;
  accent: string;
  startedAt: number;
  endsAt: number;
  /** w.now at which the incursion left 'active'/'warning' for a terminal phase; 0 while still live. */
  endedAt: number;
  cycle: number;
  nextPulseAt: number;
  nextHazardTickAt: number;
  outsideSafeSince: number;
  startingKills: number;
  rewardCred: number;
  rewardTokens: number;
  rewardGranted: boolean;
  propUids: number[];
}

/** Authored story layer for the opening city thread. */
export interface FirstNightChapter {
  areaId: string;
  chapter: number;
  label: string;
  goal: string;
  worldVerb: string;
  beatAtSec: number;
  beatTitle: string;
  beatText: string;
  consequence: string;
  thread: string;
  nextAreaId?: string;
  sireSignal?: string;
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

export type EndlessBandId = 'core' | 'floodwall' | 'rail-shadow' | 'industrial-fringe' | 'outer-threshold';

export interface EndlessBandDef {
  id: EndlessBandId;
  label: string;
  shortLabel: string;
  thresholdPx: number;
  accent: string;
  ground: { base: string; tile: string; seam: string; glow: string };
  riskLabel: string;
  hazardLabel: string;
  enemyPool: string[];
  eventTitle: string;
  eventDescription: string;
}

export interface EndlessRouteEventState {
  id: string;
  bandId: EndlessBandId;
  title: string;
  description: string;
  x: number;
  y: number;
  phase: 'available' | 'claimed' | 'missed';
  rewardCred: number;
  rewardTokens: number;
}

/** Live state kept on the World while running in endless mode. */
export interface EndlessState {
  /** World-space distance from origin — drives difficulty. */
  maxDistancePx: number;
  currentBandId: EndlessBandId;
  /** Bands identified during this run; copied into MetaState at run end. */
  discoveredBandIds: Set<EndlessBandId>;
  discoveredRouteEventIds: Set<string>;
  routeEvent: EndlessRouteEventState | null;
  hazardNextAt: number;
  /** Number of dungeon rooms the player has entered. */
  dungeonDepth: number;
  /** Whether the player is currently inside a dungeon room. */
  inDungeon: boolean;
  /** Whether the player is exploring an enterable city building. */
  inBuilding: boolean;
  buildingLabel: string;
  buildingPrefabId: string | null;
  buildingCenterX: number;
  buildingCenterY: number;
  buildingReturnX: number;
  buildingReturnY: number;
  /** Current room in the active dungeon visit (1–3). */
  dungeonRoom: number;
  /** Whether the final-room boss has been defeated for this visit. */
  dungeonBossDefeated: boolean;
  /** Whether the final-room multi-reward chest is available/opened. */
  dungeonChest: { x: number; y: number; unlocked: boolean; opened: boolean } | null;
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
  /** Last city block used for the one-shot landmark entry cue. */
  lastLandmarkKey: string | null;
  /** Exit trigger zone in world coords. */
  exitZone: { x: number; y: number; w: number; h: number } | null;
  /** Active dungeon entrance markers (world-space). */
  dungeonEntrances: Array<{ x: number; y: number; w: number; h: number; chunkKey: string }>;
  /** Entrance chunk keys whose entrance has already been used once. */
  consumedEntranceChunks: Set<string>;
  /** Map from chunkKey to the flat Aabb list that chunk contributed to w.obstacles. */
  chunkObstacles: Map<string, Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    kind?: ObstacleDef['kind'];
    propVariant?: PropVariant;
    pothole?: ObstacleDef['pothole'];
  }>>;
  /** Fractional enemy spawn budget (accumulates over time). */
  spawnBudget: number;
  /** The run seed, forwarded here so chunk generation stays deterministic. */
  rngSeed: number;
  /** Pending transition the RunScreen should animate before resuming. */
  pendingTransition: 'enter' | 'exit' | null;
  /** Deterministic block summaries used by rendering and the minimap. */
  cityBlocks: Array<{
    key: string;
    cx: number;
    cy: number;
    kind: string;
    x: number;
    y: number;
    w: number;
    h: number;
    river: boolean;
    crossing: boolean;
    streetAxis: 'horizontal' | 'vertical';
    district: string;
    districtAccent: string;
    band: EndlessBandId;
    bandAccent: string;
    landmark?: { name: string; kind: string; accent: string };
  }>;
  /** River bands currently loaded around the player. */
  riverSegments: Array<{ x: number; y: number; w: number; h: number; crossingX: number | null }>;
  /** Enterable building doors currently loaded around the player. */
  buildingEntrances: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    returnX: number;
    returnY: number;
    buildingId: string;
    prefabId: string;
    doorSide: 'north' | 'south' | 'east' | 'west';
  }>;
  /** Exterior footprints used to draw a consistent city facade layer. */
  buildings: Array<{
    id: string;
    prefabId: string;
    name: string;
    sign: string;
    accent: string;
    x: number;
    y: number;
    w: number;
    h: number;
    doorSide: 'north' | 'south' | 'east' | 'west';
  }>;
}

/* ------------------------------------------------------------------ */
/* Allies, hub rooms, discoveries, upgrades                            */
/* ------------------------------------------------------------------ */

export type CrewActivityId =
  | 'field-rations'
  | 'fortify-doors'
  | 'sort-supplies'
  | 'scout-routes'
  | 'mark-approach-lanes'
  | 'tune-the-rig'
  | 'study-anomalies'
  // Main floor
  | 'spin-the-jukebox'
  | 'polish-the-bar'
  | 'count-the-register'
  // Rooftop perch
  | 'trade-war-stories'
  | 'watch-the-skyline'
  | 'stretch-before-dawn'
  // The cellar
  | 'press-new-records'
  | 'brew-something-strong'
  | 'catalog-the-vinyl'
  // The alley annex (previously had no activities at all)
  | 'weld-a-brace'
  | 'sharpen-the-edges'
  | 'run-the-numbers'
  | 'paint-a-mural'
  // The storefront (previously had no activities at all)
  | 'file-the-ledgers'
  | 'walk-the-block'
  | 'keep-the-lookbook'
  | 'mind-the-register';

export type CrewActivityIcon =
  | 'utensils'
  | 'shield'
  | 'package'
  | 'compass'
  | 'map'
  | 'radio'
  | 'sparkles'
  | 'music'
  | 'droplet'
  | 'coffee'
  | 'heart'
  | 'camera'
  | 'sunrise'
  | 'disc'
  | 'flame'
  | 'book'
  | 'wrench'
  | 'zap'
  | 'calculator'
  | 'paintbrush'
  | 'scroll'
  | 'footprints'
  | 'shopping-bag'
  | 'book-open';

export interface CrewActivityEffect {
  stat: keyof BaseStats;
  add?: number;
  mult?: number;
}

export interface CrewActivityDef {
  id: CrewActivityId;
  roomId: string;
  name: string;
  description: string;
  benefitLabel: string;
  icon: CrewActivityIcon;
  effects: CrewActivityEffect[];
}

export type CrewRumorId =
  | 'bell-shock'
  | 'painted-shortcut'
  | 'pantry-surge'
  | 'basement-broadcast'
  | 'magnet-parade';

export type CrewRumorIcon = 'bell' | 'spray-can' | 'utensils' | 'radio' | 'magnet';

export interface CrewRumorDef {
  id: CrewRumorId;
  name: string;
  icon: CrewRumorIcon;
  accent: string;
  activityAffinities: CrewActivityId[];
  story: string;
  effectLabel: string;
  effectDescription: string;
}

export interface ActiveCrewRumor {
  rumorId: CrewRumorId;
  allyId: string;
  generatedAtSeed: number;
}

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
  /** Room activities this ally enjoys choosing between autonomously. */
  preferredActivityIds: CrewActivityId[];
  palette: SpritePalette;
  /**
   * Optional silhouette flourish for `allyRig()` -- without one, an ally's
   * rig is auto-derived purely from `id.length`, which gives little real
   * variety. See crew-feature.md.
   */
  rigHint?: 'seated' | 'hood' | 'cap' | 'bulk' | 'hunched' | 'wings' | 'staff' | 'puffs' | 'halo' | 'cloudHair' | 'flarePants';
}

/** Non-combat background life (civilians, cats) -- cosmetic, never touched by collision/damage code. */
export interface AmbientKindDef {
  id: string;
  name: string;
  palette: SpritePalette;
  rig: SpriteRig;
  /** World units per second, idle wander speed. */
  speed: number;
  /** Speed multiplier while fleeing the player. */
  fleeSpeedMult: number;
  /** Distance from the player at which this actor starts fleeing. */
  fleeRadius: number;
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
  features: Array<'runs' | 'roster' | 'bestiary' | 'music' | 'unlocks' | 'allies' | 'recovery' | 'vendor' | 'workshop' | 'settings' | 'palette-store' | 'account' | 'feedback'>;
}

export type HideoutBiome = 'sanctum' | 'rooftop' | 'cellar' | 'alley' | 'archive';

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

export type VendorItemCategory = 'stat' | 'utility' | 'challenge' | 'relic' | 'ability';

export type VendorEffect =
  | { kind: 'stat'; stat: keyof BaseStats; add?: number; mult?: number; cap?: number }
  | { kind: 'utility'; utility: 'starting-weapon-level' | 'reward-cred-mult'; amount: number };

export interface VendorItemDef {
  id: string;
  name: string;
  description: string;
  category: VendorItemCategory;
  cost: number;
  maxStacks: number;
  effects?: VendorEffect[];
  challengeId?: string;
  /** Currency this item is priced in. Omitted means 'cred', the original default. */
  currency?: 'cred' | 'skeletonKeys';
  /**
   * Another vendor item's id that must own at least one stack first. Used to
   * chain "ability" category items into a purchase tree (e.g. minimap tiers,
   * the ghost cloak line) without a generic prerequisite-graph system.
   */
  requires?: string;
}

/** Derived from Ghost Cloak + its upgrade-tree stacks; null when the base unlock isn't owned. */
export interface StealthAbilityConfig {
  durationMs: number;
  cooldownMs: number;
  /** True once Full Invisibility is owned: cloak also blocks contact damage entirely. */
  fullInvisible: boolean;
  /** Extra damage dealt (e.g. 0.05 = +5%) while cloaked. */
  damageBonusPct: number;
}

export interface ChallengeContractDef {
  id: string;
  name: string;
  description: string;
  rewardMultiplier: number;
  enemySpawnMultiplier: number;
  enemyHealthMultiplier: number;
  enemyDamageMultiplier: number;
}

/** Whether a detail panel (shop item, character) sits fixed beside its grid or expands under the selected row. */
export type UIPanelLayout = 'rail' | 'slideout';

export interface UIThemeSwatchDef {
  id: string;
  name: string;
  /** HSL triplet in the same "H S% L%" format as the --primary custom property, e.g. "156 100% 62%". */
  primaryHsl: string;
}

export interface UIThemeDef {
  id: string;
  name: string;
  description: string;
  /** Cred cost to unlock. 0 = always owned. */
  cost: number;
  /** Selectable accent recolors within this theme. Themes without swatches use their own fixed palette. */
  swatches?: UIThemeSwatchDef[];
}

export type CosmeticTier = 'standard' | 'uncommon' | 'rare' | 'legendary';
export type PaletteEffectKind = 'glow' | 'pulse' | 'prism' | 'flicker' | 'wave';

export interface PaletteEffectDef {
  kind: PaletteEffectKind;
  label: string;
  /** Animation cycles per second. */
  speed: number;
  /** Normalized visual strength from 0 to 1. */
  intensity: number;
}

export interface ThemedPaletteDef {
  id: string;
  name: string;
  description: string;
  /** Loot token cost to unlock. 0 = always owned. */
  cost: number;
  /** When true, this palette is included in default owned set. */
  owned?: boolean;
  tier?: CosmeticTier;
  /** Optional procedural glow/animation applied around the player. */
  effect?: PaletteEffectDef;
  /** Color palette to apply to sprites and world when active. */
  palette: SpritePalette;
}

/** Procedural player aura rendered during runs. These styles are visual only. */
export type RunAuraStyle =
  | 'street-halo'
  | 'radar-sweep'
  | 'ember-orbit'
  | 'rain-signal'
  | 'glitch-echo'
  | 'mothlight';

export interface RunAuraDef {
  id: string;
  name: string;
  description: string;
  /** Loot token cost to unlock. 0 = always owned. */
  cost: number;
  tier: CosmeticTier;
  style: RunAuraStyle;
}

/** Floating headwear is deliberately presentation-only and does not change collision. */
export type HatStyle = 'none' | 'top-hat' | 'halo' | 'crown' | 'satellite' | 'rain-cloud' | 'cone' | 'orbital-eye' | 'moth-cap';
export interface HatDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  tier: CosmeticTier;
  style: HatStyle;
}

/** A separate, short reward-reveal effect—not an aura. */
export type CelebrationStyle = 'paper-stars' | 'coin-burst' | 'signal-hearts' | 'confetti-rain' | 'moth-swarm';
export interface CelebrationDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  tier: CosmeticTier;
  style: CelebrationStyle;
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
  cardKind?: 'upgrade' | 'weapon' | 'passive' | 'evolution' | 'relic-evolution';
  weaponId?: string;
  passiveId?: string;
  evolutionId?: string;
  relicRecipeId?: string;
}

/* ------------------------------------------------------------------ */
/* Persistent meta progression                                         */
/* ------------------------------------------------------------------ */

export interface MetaState {
  version: number;
  /** Four-tap gate has been completed, revealing persistent Dev Mode controls. */
  devModeAccessUnlocked: boolean;
  /** Settings toggle for exposing every unlockable surface regardless of progress. */
  devModeAllUnlocks: boolean;
  /** Enables tapping/clicking a movable prop to prime its next player impact. */
  physicsObjectClicksEnabled: boolean;
  /** When true, level-up choices pause the run; when false, the run keeps moving. */
  levelUpPausesEnabled: boolean;
  /** Master preset that keeps reward and menu interactions from pausing simulation. */
  liveModeEnabled: boolean;
  /** How unopened loot reveals are presented after their reward is applied. */
  lootPresentation: 'auto-pause' | 'queue';
  /** How level-up rewards are selected and presented. */
  levelUpPresentation: 'pause-focus' | 'compact-live' | 'random-live';
  /** Show the tactical map by default in the pause dashboard. */
  pauseMapVisible: boolean;
  /** When true, birds and fireflies hide during rain/fog instead of staying visible. */
  wildlifeSheltersInRain: boolean;
  /** Whether the endless minimap is rendered during a run. */
  minimapVisible: boolean;
  /** Whether the endless minimap shows its full map details. */
  minimapExpanded: boolean;
  /** Normalized top-left position of the endless minimap within the viewport. */
  minimapPosition: { x: number; y: number };
  /** Cheat-code toggle from the Quartermaster's "Flip the Script" unlock: rotates the whole run 180°. Requires owning that vendor item. */
  worldInvertEnabled: boolean;
  /** Cheat-code toggle from the Quartermaster's "Negative Exposure" unlock: inverts the run's color palette. Requires owning that vendor item. */
  paletteInvertEnabled: boolean;
  /** 'grid' shows list-heavy hub panels as multi-column card grids; 'list' is the original single-column layout. */
  uiDensity: 'grid' | 'list';
  /** Whether the game reacts to the soundtrack (beat pulses, on-beat crits). */
  musicReactiveEnabled: boolean;
  /** Allows animated palette flourishes independently from the selected colors. */
  paletteAnimationsEnabled: boolean;
  /** Blends the global Artisan world palette over each character's personal skin. */
  worldPaletteBlendEnabled: boolean;
  /** Whether device tilt steers the player on supported hardware. */
  gyroEnabled: boolean;
  /** Tilt sensitivity, 0.5 (gentle) .. 2 (twitchy). */
  gyroSensitivity: number;
  /** Flips the forward/back tilt axis. */
  gyroInvertY: boolean;
  /**
   * Whether the studio may load third-party audio plugins. Off by default:
   * a plugin runs code fetched from another origin, which nothing else in the
   * game does, so it is enabled deliberately or not at all.
   */
  studioPluginsEnabled: boolean;
  selectedCharacterId: string;
  /** Character id -> selected personal four-color skin id. */
  characterSkinByCharacterId: Record<string, string>;
  unlockedCharacterIds: string[];
  clearedAreaIds: string[];
  rescuedAllyIds: string[];
  discoveryIds: string[];
  /** Variant discoveries recorded from generated LokPets between runs. */
  lokPetCatalog: LokPetCatalogEntry[];
  /** Chronological LokPet catalog progress, grouped by run. */
  lokPetHistory: LokPetDiscoveryHistoryEntry[];
  /** Individually saved chest companions; duplicates are intentional and stack. */
  savedLokPets: SavedLokPet[];
  /** Up to three saved companions selected for the next run. */
  selectedLokPetIds: string[];
  /** Recovery currency, regenerated in groups of three every twenty minutes. */
  petElixirs: number;
  petElixirUpdatedAt: number;
  /** enemyId -> total defeats, drives the bestiary. */
  bestiary: Record<string, number>;
  totalKills: number;
  totalRuns: number;
  bestSurvivalSec: number;
  /** Soft currency earned per run. */
  cred: number;
  /** Loot tokens spendable in the hideout. */
  lootTokens: number;
  /** Rare currency found by breaking street props, weighted toward endless mode. Spendable in the hideout vendor's relic category. */
  skeletonKeys: number;
  /** Whether the player has seen the intro briefing. */
  onboarded: boolean;
  /** Farthest endless distance ever reached (world units). */
  endlessRecordDistancePx: number;
  /** Deepest dungeon depth ever reached in endless mode. */
  endlessRecordDepth: number;
  /** Endless bands and route beacons found across all runs. */
  endlessDiscoveryIds: string[];
  /** Character id -> current fatigue penalty percentage, capped at 5. */
  fatigueByCharacter: Record<string, number>;
  /** The active recovery session, if anyone is resting. */
  recovery: RecoverySession;
  /** Highest hideout facility purchased by the player. */
  facilityTier: FacilityTier;
  /** Field recovery huts discovered in explored areas. */
  discoveredHutIds: string[];
  /** Hideout vendor purchases, keyed by curated catalog id. */
  vendorPurchases: Record<string, number>;
  /** Current autonomous room activity chosen by each rescued ally. */
  crewActivityByAlly: Record<string, CrewActivityId>;
  /** Persisted seed incremented whenever the player returns to the hideout. */
  crewActivitySeed: number;
  /** One autonomous crew rumor held for the next completed run. */
  activeCrewRumor: ActiveCrewRumor | null;
  /** Episodes completed account-wide. */
  completedEpisodeIds: string[];
  /** Signature evolutions earned account-wide. */
  unlockedEvolutionIds: string[];
  /** Persisted progress toward each character episode objective. */
  episodeProgressById: Record<string, number>;
  /** Permanent city relic knowledge found during cleared district runs. */
  knownRelicIds: string[];
  /** Player-authored maps; these never modify the authored area catalog. */
  customMaps: CustomMap[];
  /** Whether the Quartermaster and Roster detail panel sits in a fixed rail or slides out under the selected row. */
  uiPanelLayout: UIPanelLayout;
  /** Purchased UI theme ids. The free 'house' theme is always included. */
  ownedUiThemeIds: string[];
  /** Currently equipped UI theme id. */
  uiTheme: string;
  /** Selected accent swatch id per theme, for themes that offer swatches. */
  uiThemeSwatchByTheme: Record<string, string>;
  /** Purchased themed palette ids. The 'default' palette is always included. */
  ownedPaletteIds: string[];
  /** Currently active character/world color palette id. */
  activePaletteId: string;
  /** Purchased procedural run aura ids. The street halo is always included. */
  ownedRunAuraIds: string[];
  /** Currently equipped procedural run aura id. */
  activeRunAuraId: string;
  /** Owned floating hats for the player character. */
  ownedHatIds: string[];
  activeHatId: string;
  /** Reward celebrations are selected independently from auras. */
  ownedCelebrationIds: string[];
  activeCelebrationId: string;
  /** Local-date key for the currently active Broadcast contract board. */
  dailyContractDayKey: string;
  /** Progress accumulated against today's Broadcast contracts. */
  dailyContractProgressById: Record<string, number>;
  /** Contracts already paid out for today's Broadcast board. */
  completedDailyContractIds: string[];
}

/* ------------------------------------------------------------------ */
/* Run results and HUD snapshots                                       */
/* ------------------------------------------------------------------ */

export interface RunResult {
  areaId: string;
  characterId: string;
  cleared: boolean;
  /** Present for a failed run; distinguishes lethal environmental deaths. */
  deathCause?: 'lethal-pothole' | 'ordinary-hazard';
  survivedSec: number;
  kills: number;
  level: number;
  cred: number;
  killsByEnemy: Record<string, number>;
  rescuedAllyId?: string;
  discoveryId?: string;
  newlyUnlockedCharacterIds: string[];
  loadout: {
    weapons: Array<{ id: string; name: string; level: number; kind: WeaponKind; color?: string }>;
    passives: Array<{ id: string; name: string; stacks: number }>;
  };
  /** Loot boxes opened this run. */
  lootBoxesOpened: number;
  /** Prize labels collected from loot boxes. */
  openedPrizes: string[];
  /** LokPets generated from chest rewards during this run. */
  lokPets: Array<{
    origin: 'chest' | 'loadout';
    roll: LokPetRoll;
    name: string;
    variantId: string;
    family: LokPetFamily;
    silhouette: LokPetSilhouette;
    palette: LokPetPalette;
    rarity: LokPetRarity;
    rarityLabel: string;
    attackKind: LokPetAttackKind;
    element: LokPetElement;
    elementLabel: string;
    traitLabel: string;
    health: number;
    damage: number;
    cooldownMs: number;
    range: number;
    ghosted: boolean;
  }>;
  /** New catalog variants, rarities, and traits discovered during this run. */
  lokPetDiscoveries?: LokPetRunDiscovery[];
  /** Loot tokens earned this run. */
  lootTokensGained: number;
  /** Rare currency (skeleton keys) earned this run. */
  skeletonKeysGained: number;
  /** Fatigue applied to the operative after this run. */
  fatigueAddedPct?: number;
  /** Operative's fatigue after this run, before recovery begins. */
  fatigueAfterPct?: number;
  /** Objectives completed this run. */
  completedObjectives: CompletedObjective[];
  /** Broadcast contracts completed by this run. */
  completedDailyContracts?: CompletedDailyContract[];
  /** Active character episode progress, when this run was on its episode route. */
  episode?: {
    id: string;
    title: string;
    objectiveLabel: string;
    progress: number;
    target: number;
    completed: boolean;
    completedThisRun: boolean;
  };
  /** Account-wide signature evolution active in this run, if any. */
  evolution?: {
    id: string;
    name: string;
    identity: string;
  };
  /** City relic knowledge found by clearing a district for the first time. */
  newlyDiscoveredRelicIds?: string[];
  /** Optional district setpiece encounter state from this run. */
  districtIncursion?: {
    id: string;
    title: string;
    landmark: string;
    phase: DistrictIncursionPhase;
    progress: number;
    target: number;
    rewardCred: number;
    rewardTokens: number;
  };
  /** Relic recipe applied during the run, if one was chosen at level-up. */
  relicRecipe?: {
    id: string;
    name: string;
    identity: string;
  };
  /** The bounded hideout rumor carried into this run, if any. */
  crewRumor?: {
    rumorId: CrewRumorId;
    rumorName: string;
    icon: CrewRumorIcon;
    allyId: string;
    effectLabel: string;
    triggered: boolean;
    outcome: string;
  };
  /** Authored First Night chapter state for this run. */
  firstNight?: {
    chapter: number;
    label: string;
    goal: string;
    consequence: string;
    beatTitle: string;
    beatTriggered: boolean;
    thread: string;
  };
  /** Optional difficulty contracts selected before this run. */
  challenges?: Array<{
    id: string;
    name: string;
    rewardMultiplier: number;
    bonusCred: number;
  }>;
  /** Endless-mode stats (undefined for timed runs). */
  endless?: {
    maxDistancePx: number;
    dungeonDepth: number;
    /** "Blocks walked" — rounded distance in city-block units for display. */
    blocksWalked: number;
    currentBandId: EndlessBandId;
    discoveredBandIds: EndlessBandId[];
    discoveredRouteEventIds: string[];
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
  /** Storm Chaser only: the weather cloud's current mode and whether the player has taken manual control of it. */
  stormCloud?: { mode: StormCloudMode; autoCycle: boolean };
  /** True once "Let Me Hold This" is unlocked -- hazard weapons never hurt whoever's holding them. */
  hazardImmune: boolean;
  loadout: {
    weapons: Array<{ id: string; name: string; level: number; kind: WeaponKind; color?: string }>;
    passives: Array<{ id: string; name: string; stacks: number }>;
  };
  alerts: string[];
  rescueAvailable: boolean;
  rescueProgressPct: number;
  /** The trapped ally's name, when known, so the HUD banner can name them. */
  rescueAllyName?: string;
  lootBoxesOpened: number;
  /** Generated companions currently following the player. */
  lokPets: Array<{
    uid: number;
    name: string;
    family: LokPetFamily;
    silhouette: LokPetSilhouette;
    rarity: LokPetRarity;
    attackKind: LokPetAttackKind;
    element: LokPetElement;
    traitLabel: string;
    health: number;
    damage: number;
    cooldownMs: number;
    range: number;
    ghost: boolean;
    ghostPct: number;
    expiresInSec: number;
    color: string;
  }>;
  /** Effects currently active on the player's enemies, grouped for HUD display. */
  activeEffects: Array<{ id: string; name: string; color: string; count: number }>;
  /** One-run hideout rumor currently carried by this run. */
  crewRumor?: {
    rumorId: CrewRumorId;
    name: string;
    icon: CrewRumorIcon;
    effectLabel: string;
    triggered: boolean;
    ready: boolean;
    outcome: string;
  };
  /** The current chapter cue once its mid-run beat has fired. */
  firstNightBeat?: {
    chapter: number;
    title: string;
    text: string;
  };
  districtIncursion?: {
    id: string;
    title: string;
    landmark: string;
    objectiveLabel: string;
    phase: DistrictIncursionPhase;
    progress: number;
    target: number;
    accent: string;
    remainingSec: number;
  };
  episode?: {
    id: string;
    title: string;
    label: string;
    progress: number;
    target: number;
    completed: boolean;
  };
  relicWorkshop: {
    knownRelicIds: string[];
    readyRecipeIds: string[];
    activeRecipe?: { id: string; name: string; identity: string; color: string };
  };
  evolution?: {
    id: string;
    name: string;
    identity: string;
    color: string;
  };
  objectives: Array<{
    label: string;
    progress: number;
    target: number;
    completed: boolean;
  }>;
  /** Set when running in endless mode. */
  endless?: {
    blocksWalked: number;
    distancePx: number;
    dungeonDepth: number;
    inDungeon: boolean;
    dungeonEraName: string;
    currentBandId: EndlessBandId;
    currentBandLabel: string;
    currentBandAccent: string;
    riskLabel: string;
    hazardLabel: string;
    routeEvent?: {
      id: string;
      title: string;
      description: string;
      phase: 'available' | 'claimed' | 'missed';
      rewardCred: number;
      rewardTokens: number;
      x: number;
      y: number;
    };
    dungeonRoom: number;
    dungeonBossDefeated: boolean;
    dungeonChestUnlocked: boolean;
    dungeonChestOpened: boolean;
    currentBlock: string;
    currentDistrict: string;
    inBuilding: boolean;
    buildingLabel: string;
    playerX: number;
    playerY: number;
    cityBlocks: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      kind: string;
      river: boolean;
      crossing: boolean;
      streetAxis: 'horizontal' | 'vertical';
      district: string;
      districtAccent: string;
      band: EndlessBandId;
      bandAccent: string;
      landmark?: { name: string; kind: string; accent: string };
    }>;
    riverSegments: Array<{ x: number; y: number; w: number; h: number; crossingX: number | null }>;
    buildingEntrances: Array<{ x: number; y: number; label: string; prefabId: string; doorSide: 'north' | 'south' | 'east' | 'west' }>;
    buildings: Array<{ id: string; prefabId: string; name: string; sign: string; accent: string; x: number; y: number; w: number; h: number; doorSide: 'north' | 'south' | 'east' | 'west' }>;
    /** Quartermaster "Street Ears" unlock: live enemy positions. Empty when not owned. */
    nearbyEnemies: Array<{ x: number; y: number }>;
    /** Quartermaster "Loot Sense" unlock: non-XP pickup positions (cred, health, loot boxes). Empty when not owned. */
    nearbyPickups: Array<{ x: number; y: number; kind: string }>;
    /** Quartermaster "Hazard Sense" unlock: telegraphed enemy attack radii. Empty when not owned. */
    nearbyHazards: Array<{ x: number; y: number; radius: number }>;
  };
}

export type RunPhase = 'countdown' | 'playing' | 'levelup' | 'paused' | 'reel' | 'over';
