/**
 * Core type contracts for the 616 Survivor prototype.
 *
 * Everything the game shows is described by data in `src/game/data`.
 * Adding a character, enemy, area, ally or upgrade means adding a record --
 * never editing the simulation loop.
 */

import type { BeatReaction } from '@/game/data/reactivity';
import type { MusicSpawnEvent } from '@/game/data/musicEvents';
import type { RunHighlight } from '@/game/data/runHighlights';
import type { SfxStyleDef } from '@/game/audio/sfxCues';
import type { ChangelogKind } from '@/game/data/changelogKinds';

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

/** Small part sets an evolved LokPet can wear on top of its base rig (see data/lokPetEvolutions.ts). */
export type EvolutionOverlayId =
  | 'halo' | 'horns' | 'wings' | 'plates' | 'mane' | 'crown' | 'antennae' | 'spikes' | 'visor' | 'tail-flame';

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
  kind: 'cred' | 'token' | 'heal' | 'stat' | 'weapon' | 'lokpet' | 'card-pack';
  amount?: number;
  label: string;
  /** Stat key when kind === 'stat'. */
  stat?: keyof BaseStats;
  /** Additive amount when kind === 'stat'. */
  add?: number;
  /** Generated companion payload when kind === 'lokpet'. */
  lokPet?: LokPetRoll;
  cardPackId?: CardPackId;
}

export type CardPackId = 'penny-sleeve' | 'street' | 'operative' | 'scenario' | 'lokpet' | 'collector' | 'cipher' | 'prism-lokpack' | 'elemental-pack' | 'operative-elite' | 'apex-binder' | 'mega-vault' | 'quantum-vault' | 'shinies-cache' | 'apex-dominion';
export type CardVariant = 'standard' | 'foil' | 'neon' | 'glitch' | 'holo';
export interface OwnedCardRecord {
  cardId: string;
  copies: number;
  variants: Partial<Record<CardVariant, number>>;
  bestVariant: CardVariant;
  totalValue: number;
}

export type LokPetFamily = 'animal' | 'ghoul' | 'bat' | 'mote' | 'blob' | 'mechanical';
export type LokPetSilhouette = 'pouncer' | 'skull' | 'winglet' | 'spark' | 'jelly' | 'clockwork'
  | 'prism-moth' | 'void-pup' | 'ember-koi' | 'clock-beetle'
  | 'solar-owl' | 'shadow-mantis' | 'glitch-fox' | 'magnet-ursa'
  | 'cyber-hydra' | 'plasma-kitsune' | 'nano-phoenix' | 'titan-colossus'
  | 'chrono-hare' | 'byte-serpent' | 'cosmic-axolotl' | 'storm-griffin'
  | 'k9-hound' | 'wolf' | 'digi-wolf'
  | 'terra-gargoyle' | 'aero-raptor' | 'photon-lynx' | 'null-abyss'
  | 'cyber-pangolin' | 'ion-pegasus' | 'glitch-dragon'
  | 'apex-chimera' | 'cyber-leviathan' | 'solar-seraph' | 'chrono-valkyrie'
  | 'abyss-behemoth' | 'quantum-kirin'
  | 'dust-mite' | 'data-sloth' | 'circuit-frog' | 'pixel-bird';
export type LokPetAttackKind = 'shot' | 'rapid-shot' | 'heavy-shot' | 'pulse' | 'explosion';
export type LokPetElement = 'none' | 'fire' | 'freeze' | 'slow' | 'volt' | 'glitch' | 'terra' | 'aero' | 'light' | 'dark';
export type LokPetRarity = 'common' | 'charged' | 'rare' | 'mythic';
export type LokPetSpecialAbility = 'prism-collect' | 'void-fetch' | 'ember-rescue' | 'clock-pause'
  | 'solar-flare' | 'mantis-slice' | 'phase-dash' | 'polar-pull'
  | 'tri-laser' | 'plasma-orbit' | 'rebirth-burst' | 'seismic-slam'
  | 'time-warp' | 'glitch-strike' | 'starlight-heal' | 'thunder-claw'
  | 'cutify-getaway' | 'null-consume' | 'buzbee-pollen' | 'digi-fang'
  | 'silicon-shield' | 'vector-slice' | 'refract-beam' | 'singularity-drain'
  | 'firewall-curl' | 'sonic-boom' | 'byte-breath'
  | 'chimera-fusion' | 'leviathan-surge' | 'seraph-radiance' | 'valkyrie-lance'
  | 'abyss-crush' | 'kirin-thunder'
  | 'mite-swarm' | 'sloth-dilation' | 'frog-shockwave' | 'bird-talon';

/** Compact palette for original, vector-drawn companion variants. */
export interface LokPetPalette {
  ink?: string;
  body: string;
  bodyDark: string;
  accent: string;
  accentBright?: string;
  skin?: string;
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
  /** Relative in-run render scale; authored pets deliberately do not all occupy one size. */
  sizeScale?: number;
  legendary?: boolean;
  specialAbility?: LokPetSpecialAbility;
  /** First-arrival companion, chosen during the digital-bush encounter. */
  starter?: boolean;
  /** Variant-roll weight. Legendary companions are deliberately scarce. */
  weight?: number;
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
  sizeScale?: number;
  legendary?: boolean;
  specialAbility?: LokPetSpecialAbility;
  /** Persistent companion level copied into a run for scaled starter behavior. */
  level?: number;
  /** Evolution branch the player chose, copied into a run from the saved pet (see data/lokPetEvolutions.ts). */
  evolutionBranchId?: string;
}

/** A captured, repeatable LokPet blueprint stored in the player's kennel. */
export interface SavedLokPet {
  id: string;
  roll: LokPetRoll;
  /** One charge is spent when the pet joins a run; elixirs restore it. */
  stamina: number;
  /** Current battle level (starter partners cap at 99; other companions cap at 50). */
  level?: number;
  /** Current battle experience points. */
  exp?: number;
  /** Lifetime battle victories in sparring, league, and gauntlet. */
  battlesWon?: number;
  /** Total battles fought. */
  battlesFought?: number;
  /** Pinned favorite in kennel and battle party selector. */
  favorite?: boolean;
  /** Equipped battle trinket/tag. */
  equippedTrinket?: string;
  /** Marks the one partner chosen during the first trip to the hideout. */
  starter?: boolean;
  /** Last hourly free full-health/stamina refresh boundary. */
  lastFreeRefreshAt?: number;
  /** Player-given call name (name slot 1); falls back to the rolled variant's name when unset. */
  name?: string;
  /** Name slots 2 to 5, each unlocked by bond rank (see engine/petGrowth.ts). */
  names?: { battle?: string; callsYou?: string; epithet?: string; trueName?: string };
  /** Bond points. Never decreases; earned from runs, travel wins, treats and battles with a daily cap. */
  bond?: number;
  /** Local day key (YYYY-MM-DD) that `bondToday` counts for. */
  bondDay?: string;
  /** Local day key of the last hideout petting that counted (one counts per day). */
  careDay?: string;
  /** Hideout events this pet has played: event id -> last time (ms). Drives cooldowns and once-only events. */
  hideoutEvents?: Record<string, number>;
  /** Bond earned on `bondDay`, against the daily cap. */
  bondToday?: number;
  /**
   * The evolution branch the player picked for this pet, and when. Absent means the pet
   * follows its natural level-based form exactly as before. Everything else about its
   * evolution is derived from this plus level, so old saves keep working.
   */
  evolutionPath?: { branchId: string; chosenAt: number };
}

/** One pet's line in the Growth Recap shown after a run (not persisted). */
export interface PetGrowthEntry {
  petId: string;
  name: string;
  expGained: number;
  oldLevel: number;
  newLevel: number;
  bondGained: number;
  oldBondRank: 'stranger' | 'familiar' | 'friend' | 'partner' | 'soulbound';
  newBondRank: 'stranger' | 'familiar' | 'friend' | 'partner' | 'soulbound';
}

/**
 * A collectible card imported from another G-Six game via the shared
 * `lok.card-exchange` protocol (see src/lib/lokCardExchange.ts). This is a
 * display-only Archive record, never a `SavedLokPet` -- it cannot be
 * selected for a run and never grants combat stats, since nothing on the
 * receiving side can trust another game's numbers for balance.
 */
export interface VisitingLokCard {
  /** From the export's `owned.instanceId`; used to de-duplicate re-imports. */
  instanceId: string;
  assetId: string;
  name: string;
  description?: string;
  rarity: string;
  sourceGame: string;
  tags: string[];
  importedAt: number;
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
  specialReadyAt: number;
  /** Clockwork Beetle accelerates its clock face while this timestamp is active. */
  specialActiveUntil: number;
  hp: number;
  maxHp: number;
  /** Overlay parts an evolved companion wears (set at spawn from its chosen branch). */
  evolutionOverlays?: EvolutionOverlayId[];
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

export type DailyContractKind =
  | 'clear-area'
  | 'kill-any'
  | 'survive-sec'
  /** Defeat `targetCount` of the enemy named by `targetId`, across runs. */
  | 'kill-enemy'
  /** Reach level `targetCount` within a single run. */
  | 'reach-level'
  /** Open `targetCount` loot boxes across runs. */
  | 'open-chests'
  /** Earn `targetCount` Cred in runs (before contract pay). */
  | 'earn-cred'
  /** Clear the district named by `targetId`. */
  | 'clear-district'
  /** Find `targetCount` map finds across runs. */
  | 'map-finds'
  /** Gather `targetCount` relic crafting materials across runs. */
  | 'scrap-haul';

export interface DailyContractDef {
  id: string;
  name: string;
  description: string;
  kind: DailyContractKind;
  targetCount: number;
  /** Enemy id (`kill-enemy`) or area id (`clear-district`) the job is about. */
  targetId?: string;
  rewardCred: number;
  rewardTokens: number;
  /** Rare-currency payout; 0 for the three standard jobs, nonzero for the optional wildcard. */
  rewardKeys: number;
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
  rewardKeys: number;
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

export interface RelicCraftRecipe {
  materials: Record<string, number>;
  description: string;
  perkLabel: string;
}

export interface CityRelicDef {
  id: string;
  name: string;
  description: string;
  sourceAreaId: string;
  sourceDiscoveryId: string;
  sourceLabel: string;
  color: string;
  craftRecipe?: RelicCraftRecipe;
  activePerk?: string;
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
  | 'meteor'
  /** 4th-wall breaking / system error attack: drags selection marquees, blue-screens, and corrupts memory. */
  | 'glitch'
  /** Easter egg weapon: classic DVD bouncing screensaver icon that ricochets and explodes on corner hits. */
  | 'dvd-bounce'
  | 'arc-tether';

/**
 * Shared physical-impact spectrum for authored attacks.
 *
 * 0 = no physical response, 1 = tap, 2 = shove, 3 = heavy hit,
 * 4 = launch, 5 = contained burst.  This is intentionally separate from
 * damage: a low-damage attack can still move a prop, and vice versa.
 */
export type ImpactIntensity = 0 | 1 | 2 | 3 | 4 | 5;

export type PotholeTrigger = 'stomp' | 'ground-shock';

export type LegendaryWeaponPattern =
  | 'resonance-return'
  | 'grind-charge'
  | 'ghostlight-network'
  | 'steam-harpoon'
  | 'origami-decoys'
  | 'event-horizon'
  | 'root-network'
  | 'royal-command'
  | 'zero-split'
  | 'tidal-memory';

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
  /** Discovery required before a map-find weapon joins normal level-up rolls. */
  lootUnlockDiscoveryId?: string;
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
  /** Character progression gate for adding this weapon to normal level-up
   *  loot. Signature loadouts and authored rewards ignore this gate. */
  lootUnlockCharacterId?: string;
  /**
   * Elemental synergy: this weapon's slash/wave/laser/impact hits deal
   * `bonusVsStatusMult`x damage against a target that already carries
   * `bonusVsStatusId`. E.g. an electric weapon hitting a target already
   * `wet`. See run-presentation.md.
   */
  bonusVsStatusId?: string;
  bonusVsStatusMult?: number;
  /** Focused mechanics for the 2026-09-09 legendary roster. */
  legendaryPattern?: LegendaryWeaponPattern;
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
  /** Can be offered only when the earned Victory Lap evolution switch is on. */
  endgameOnly?: boolean;
  /** Evolution partner weapon requirement: requires owning this weapon maxed (level 8). */
  requiredWeaponId?: string;
  requiredWeaponLevel?: number;
  requiredBaseLevel?: number;
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
  | { kind: 'kills'; count: number }
  | { kind: 'lokPetCards'; count: number }
  | { kind: 'lokCollector'; runs: number; lokPets: number };

export interface CharacterCrewIdentity {
  id: string;
  name: string;
  role: string;
}

export type LokPetCollectorRank =
  | 'LokPet Collector'
  | 'LokMaster'
  | 'LokCaster'
  | 'LokLegendary'
  | 'LokSupreme'
  | 'LokArchivist'
  | 'LokApex';

export interface LokPetCollectorConfig {
  rank: LokPetCollectorRank;
  /** Added to the normal three LokPet loadout slots, from one through seven. */
  extraTeamSlots: number;
  /** Chance after a non-boss kill to drop an extra LokPack on the floor. */
  floorPackChance: number;
  /** Multiplies the LokPet prize weight inside every opened pack. */
  lokPetPrizeWeightMultiplier: number;
  /** Added to the base Card Credit reward for every blue loot box opened. */
  bonusCardCreditsPerLootBox: number;
}

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
  rarity?: 'legendary';
  /** Two locked identity hooks surfaced in the roster without changing older characters. */
  signatureTraits?: readonly [string, string];
  /** Optional group identity shown on the roster. */
  crew?: CharacterCrewIdentity;
  /** Marks this operative as part of the separately-listed LokPet Collector class. */
  lokPetCollector?: LokPetCollectorConfig;
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
  /**
   * Zero Day's freeze-then-throw ability: a directional cast that petrifies
   * a handful of enemies in front of the player, which can then be
   * drag-selected RTS-style and thrown at other enemies. Optional -- any
   * future character could opt in the same way `stormCloud` does. See
   * zero-day-freeze-throw.md.
   */
  freezeThrow?: FreezeThrowConfig;
  /**
   * Artiste's freeform draw-to-dodge weapon. The player arms the brush,
   * draws a bounded polyline, then dodges to its endpoint while the stroke
   * damages crossed enemies. Optional and inert for every other character.
   */
  artisteDraw?: ArtisteDrawConfig;
}

export interface ArtisteDrawConfig {
  /** Maximum accumulated route length in world units. */
  maxPathLength: number;
  /** Maximum sampled vertices retained for one route. */
  maxPoints: number;
  /** Minimum distance between sampled vertices and minimum valid route length. */
  minPointDistance: number;
  /** Cooldown consumed only by a successfully committed route. */
  cooldownMs: number;
  /** Damage dealt once to each enemy crossed by the polyline. */
  damage: number;
  /** Half-width of the damaging painted trail. */
  trailRadius: number;
  /** Brief safety window after committing the dodge. */
  invulnerabilityMs: number;
}

export interface FreezeThrowConfig {
  /** How far in front of the player the freeze cone reaches, in world units. */
  coneRangeUnits: number;
  /** Full cone angle, in degrees (split evenly around the facing direction). */
  coneAngleDeg: number;
  /** Maximum enemies frozen per cast, nearest-first. */
  maxFreezeTargets: number;
  /** How long a frozen enemy stays "stone" before thawing if never thrown. */
  freezeDurationMs: number;
  /** Cooldown between casts. */
  castCooldownMs: number;
  /** Damage a thrown enemy deals to whatever it hits. */
  throwDamage: number;
  /** Travel speed of a thrown enemy, in world units/sec. */
  throwSpeed: number;
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
  /** Close-range wrestler that yanks the player toward its body before a slam. */
  | 'grappler'
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
  | 'wraith'
  /** Slow patrol that sweeps a facing cone (`traits.coneDetect`); spotting the
   *  player's *true* position inside it -- even through stealth -- ends the
   *  player's active stealth for every enemy, not just this one. */
  | 'sentry'
  /** Locks its cone onto the player's *true* position (`traits.lockCone`) and
   *  holds it there while in range; the cone narrows the whole time it stays
   *  locked and detonates for a chunk of the player's max HP the moment it
   *  closes to a line. Breaking the lock (leaving range) lets it reopen. */
  | 'tracker'
  /** Sweeps a color-coded cone (`traits.colorCone`); standing in it applies
   *  whichever effect that color carries -- pull, slow, or an elemental
   *  damage-over-time -- for as long as you stay inside. `kinds.length > 1`
   *  flickers through every color/effect on `flickerMs`, for the "uses all
   *  versions" prism and boss tiers. */
  | 'beacon'
  /** Doesn't hunt directly: on spawn it releases `traits.commander.droneCount`
   *  free-roaming detector circles (`World.roamingDetectors`) that wander the
   *  arena on their own paths. Any one that touches the player's real
   *  position marks them with the drone's effect for `stickyMs` -- it
   *  "sticks" regardless of range afterward -- and pings every drone's
   *  cooldown independently. Drones despawn when the commander dies. */
  | 'commander'
  /** Coordinated flank attack from opposing angles. */
  | 'pincer'
  /** Gravitational singularity that draws player, projectiles, and pickups. */
  | 'singularity'
  /** Armored vanguard that heavily resists frontal damage. */
  | 'phalanx'
  /** Photonic prism that reflects player shots into splitting laser needles. */
  | 'prism'
  /** Quantum tether that links to nearby allies with a hazardous beam. */
  | 'weaver'
  /** Cybernetic tree that roots into the ground and erupts branching thorn fissures. */
  | 'root-trapper'
  /** Camouflaged tree mimic that ambushes the player at close quarters. */
  | 'mimic-tree'
  /** Floating spore node that mortars digital lingering mist clouds. */
  | 'spore-mortar'
  /** Lev Syndicate: heavy anchor that gravitationally pulls the player in close, then detonates a radial kinetic ring. */
  | 'vortex-crusher'
  /** Lev Syndicate: agile flanker that periodically phase-blinks to a flanking angle behind the player. */
  | 'nanite-swarm'
  /** Lev Syndicate: mobile high-voltage station that bridges a directional electric arc at range. */
  | 'arc-conductor'
  /** Firefly Wranglers: subterranean spiker that launches sequential underground pulses. */
  | 'firefly-spiker'
  /** Firefly Wranglers: heavy siege mortar shooting charged firefly balls with screen flash. */
  | 'firefly-cannon'
  /** Firefly Wranglers: dual-wielding boss firing twin incendiary streams that leave fire trails. */
  | 'firefly-pyro-duelist'
  /** Sub-Terra / Digiverse: disguised mimic chest that attacks when approached. */
  | 'mimic-chest'
  /** Gen Fitters: circle-strafes at mid range, telegraphs, then lunges in a slash. */
  | 'strafe-duelist'
  /** Gen Fitters: marks the player's spot, leaps there and lands in a shockwave ring. */
  | 'pouncer'
  /** Gen Fitters: plants itself and spins a wheel of short beams around it. */
  | 'beam-wheel'
  /** Gen Fitters: zigzags toward the player, stitching a trail of lingering mines. */
  | 'mine-stitcher'
  /** Gen Fitters: kites at range and fires five-way projectile fans. */
  | 'fan-sampler'
  /** Gen Fitters: saves its position, then rewinds to it with a burst at both ends. */
  | 'rewinder';

export interface EnemyDrop {
  kind: 'health' | 'cred' | 'phosphor-ore' | 'silicon-alloy' | 'cyber-resin' | 'prism-quartz' | 'rootglass-cell' | 'glitch-cache';
  /** 0..1 chance per defeat. */
  chance: number;
  value?: number;
}

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
  /**
   * Authored resource drops, rolled independently on defeat on top of the
   * standard XP / health / cred rolls. `value` only matters for health and cred.
   */
  drops?: EnemyDrop[];
  /** A delayed ring that detonates where this enemy fell. */
  deathBurst?: { radius: number; damage: number };
  /** Spitter-only tuning. */
  ranged?: { cooldownMs: number; projectileSpeed: number; damage: number };
  faction?: string;
  role?: 'anchor' | 'flanker' | 'sniper' | 'carrier' | 'swarm' | 'disruptor' | 'skirmisher' | 'spitter' | 'heavy' | 'boss';
  /**
   * Visual scale tier, independent of `radius` (which still drives collision).
   * Feeds a render-time size multiplier -- see `SIZE_CLASS_SCALE` in draw.ts.
   * Omitted reads as 'standard' except that a literal `family === 'Boss'`
   * still gets the old giant bump for pre-existing content that never set
   * this. See run-presentation.md.
   */
  sizeClass?: 'mini' | 'standard' | 'elite' | 'giant' | 'boss';
  /** Ambient bioluminescent light radius in darkness or fog. */
  glowRadius?: number;
  traits?: {
    /** Once at or below `belowHpPct` of max HP it moves faster, shortens its
     *  attack cooldowns (Gen Fitters styles) and flares. */
    enrage?: { belowHpPct: number; speedMult: number; cooldownMult: number };
    teleportMs?: number;
    ghostMs?: number;
    shiftMs?: number;
    shiftScale?: number;
    burstSpeed?: number;
    /** A periodic lateral wobble/dance motion layered on top of whatever
     *  `behavior` the enemy has -- the same "applies regardless of behavior"
     *  contract as `teleportMs`/`ghostMs`/`shiftMs`. See the pre-switch trait
     *  block in `updateEnemyAI` (`engine/world.ts`) for the sine-wave offset
     *  this drives, using `EnemyActor.wobblePhase` as its per-instance seed. */
    wobbleMs?: number;
    /** World-unit amplitude of the `wobbleMs` sine offset. Defaults to 6. */
    wobbleAmp?: number;
    /** Purely visual: continuously rotates this enemy's palette hue over
     *  `hueShiftMs` -- no simulation/gameplay effect. Applied at draw time
     *  (see `resolveEnemyPalette`/`hueShiftPalette` in `render/draw.ts`),
     *  never by mutating the static `SpritePalette` object, and offset per
     *  instance by `EnemyActor.uid` so multiple copies don't shift in lockstep. */
    hueShiftMs?: number;
    /** wraith/ringer: orbit radius around the player, in world units. */
    swayRadius?: number;
    /** wraith: how long each circling phase lasts before it teleports to a new angle. */
    swayMs?: number;
    /** wraith: invisible and undamageable window from spawn, in ms. */
    revealMs?: number;
    /** sentry: a swept detection cone that sees the player's real position
     *  (bypassing stealth's frozen-anchor tracking) and, on a hit, ends
     *  the player's active stealth for every enemy in the run. */
    coneDetect?: { range: number; halfAngleDeg: number; sweepSpeed?: number };
    /** tracker: a cone that locks onto the player's real position and narrows
     *  from `startHalfAngleDeg` to `minHalfAngleDeg` over `closeMs` while
     *  locked; closing to a line deals `explodeDamagePct` of the player's
     *  max HP and reopens after `resetMs` (default 1800). */
    lockCone?: {
      range: number;
      startHalfAngleDeg: number;
      minHalfAngleDeg: number;
      closeMs: number;
      explodeDamagePct: number;
      resetMs?: number;
    };
    /** beacon: a color-coded cone. `kinds` lists which effect(s) it cycles
     *  through -- one entry for a single-color enemy, several for a "prism"
     *  tier that flickers between them every `flickerMs`. 'pull' drags the
     *  player toward the enemy at `pullForce`; 'slow'/'chill' cut move speed
     *  by `slowPct` (`chill` hits harder) while standing in the beam;
     *  'burn'/'shock' tick `tickDamagePerSec` while standing in the beam.
     *  Setting `stickyMs` changes slow/chill/burn/shock from "while standing
     *  in the beam" to "marked for a flat duration on first contact, then on
     *  cooldown" -- the mark rides the player and keeps applying even after
     *  they leave the cone. */
    colorCone?: {
      range: number;
      halfAngleDeg: number;
      sweepSpeed?: number;
      kinds: Array<'pull' | 'slow' | 'chill' | 'burn' | 'shock'>;
      flickerMs?: number;
      pullForce?: number;
      slowPct?: number;
      tickDamagePerSec?: number;
      stickyMs?: number;
    };
    /** commander: spawns roaming detector circles instead of hunting itself. */
    commander?: {
      droneCount: number;
      droneRadius: number;
      droneSpeed: number;
      effectKind: 'pull' | 'slow' | 'chill' | 'burn' | 'shock';
      /** How long a drone's mark rides the player once it makes contact. */
      stickyMs: number;
      slowPct?: number;
      tickDamagePerSec?: number;
      /**
       * The commander's own lock/shield cycle (separate from its drones):
       * starts shielded and "searching," undamageable, for `shieldMs`
       * (default 30000). Getting within `relockRange` (default 260) of the
       * player's *true* position ends the shield early and locks on; while
       * locked (`lockDurationMs`, default 14000) it applies the `irradiated`
       * buff (speed + damage) to every ally within `allyBuffRadius` (default
       * 220) each frame they stay close. When the locked window elapses it
       * deliberately drops lock and re-shields, repeating forever. If the
       * shield window runs out without relocking, it just re-arms and keeps
       * searching.
       */
      shieldMs?: number;
      relockRange?: number;
      lockDurationMs?: number;
      allyBuffRadius?: number;
    };
    /** Data Goblins seek exposed world props before the player and chew
     * raw-data breakage into real structural damage. */
    dataChew?: {
      targetRange: number;
      chewDamage: number;
      biteMs: number;
      playerDamage: number;
    };
  };
  /**
   * If set, `spawnEnemy()` builds a per-instance def for this enemy by
   * merging a random subset of trait fragments and picking a random
   * palette, so no two spawned instances look or act quite the same. The
   * base `traits`/`palette` on this `EnemyDef` still apply as its fixed
   * identity (e.g. a baseline `lockCone`); the randomizer only adds to
   * `traits` and swaps `palette` wholesale, per spawn, on a cloned def --
   * `ENEMIES`/the original `EnemyDef` are never mutated. See CLAUDE.md.
   */
  traitRandomizer?: {
    /** Each fragment is merged into a copy of the base `traits`; 1-3 are picked per spawn. */
    traitPool: NonNullable<EnemyDef['traits']>[];
    /** A random one of these replaces the base `palette` per spawn. */
    paletteVariants: SpritePalette[];
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
  formation?: 'ring' | 'wedge' | 'wall' | 'escort' | 'pincer' | 'file' | 'bait' | 'spiral' | 'phalanx' | 'crossfire' | 'vortex';
  faction?: string;
  /** Authored finite-map entry; omitted waves keep their usual spawn ring. */
  spawnAt?: { x: number; y: number };
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
     | 'attack-block'
     /** Null Sector only: a tall breakable server cabinet that overloads into a small AoE burst when destroyed. */
     | 'server-rack'
     /** Tree Null map: real cybernetic digital tree with dense foliage and data trunk. */
     | 'tree-digital'
     /** Tree Null map: holographic decoy tree that flickers and permits projectile/player pass-through. */
     | 'tree-fake'
     /** Lev Syndicate Spire only: multi-story monolith with lit cyber-window matrices and a rooftop hazard beacon. */
     | 'skyscraper'
     /** Lev Syndicate Spire only: industrial electrical transformer with caution striping and crackling micro-sparks. */
     | 'transformer-station'
     /** Lev Syndicate Spire only: illuminated suspension skyway deck. */
     | 'skyline-bridge'
     /** Lev Syndicate Spire only: communication lattice mast emitting broadcast wave pulses. */
     | 'beacon-tower'
     /** Lev Syndicate Spire only: reinforced blast barrier with a pulsing security laser tripwire. */
     | 'security-gate'
     /** Lev Syndicate Spire only: street-embedded blast shelter hatch. */
     | 'bunker-hatch'
     /** Rapid pressure wing: exposed maintenance conduit Data-Gobs can eat through. */
     | 'data-pipe'
     /** Rapid pressure wing: the failed teleport arch keeping the faction cut off. */
     | 'digi-arch'
     /** Rapid pressure wing: reinforced emergency-pressure room seal. */
     | 'pressure-door'
     /** Page overlay only: a DOM element on a live web page, standing in as a fixed, breakable block. */
     | 'page-block' | 'map-prop';
  /** Detailed map-pack artwork shared by the editor and live renderer. */
  artAssetId?: string;
  /** Optional authored prop physics profile; omitted props use kind defaults. */
  propVariant?: PropVariant;
  /** Per-instance hit points; overrides the kind's table value (page overlay blocks scale with element area). */
  hp?: number;
  /** Page overlay only: opaque handle the host maps back to its DOM element. The engine never reads it. */
  domId?: number;
  /** Solid to the player but not to enemies (nor to the player mid-dash). See `Aabb.soft`. */
  soft?: boolean;
  /** Lethal pothole tuning; present only when kind === 'pothole'. */
  pothole?: {
    trigger: PotholeTrigger;
    warningMs?: number;
    openingMs?: number;
    lethalRadius?: number;
  };
}

/** `fixed-breakable` is immovable like `fixed-bench` but still takes damage when its kind has hp. */
export type PropVariant = 'light-breakable' | 'medium-movable' | 'heavy-metal' | 'fixed-bench' | 'fixed-breakable';

/**
 * Overhead conditions for an area. Drives clouds, rain, fog and lightning.
 * `roofed` means there is no sky at all (cellars, interiors) -- every sky
 * effect is suppressed rather than dimmed.
 */
export type AreaSky = 'clear' | 'overcast' | 'rain' | 'fog' | 'roofed'
  /** Lev Syndicate Spire: electric storm — ion sparks, ground discharges, violet distant lightning. */
  | 'cyber-storm'
  /** Reserved for a future Lev-themed area: dense industrial smog with bioluminescent spore motes. */
  | 'toxic-haze'
  /** Reserved for a future Lev-themed area: scorching radiation front with rising heat motes. */
  | 'solar-flare';

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
  /** Optional player-authored ground patches drawn over the base street grid. */
  authoredGroundTiles?: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    base: string;
    tile: string;
    seam: string;
    glow: string;
  }>;
  /** Art-only objects do not enter the collision or damage simulation. */
  decorations?: ObstacleDef[];
  /** Authored finite-map entry locations. */
  playerStart?: { x: number; y: number };
  hostileEntries?: Array<{ x: number; y: number }>;
  /** Placed supplies and interactive set pieces. */
  mapPickups?: Array<{ id: string; kind: string; x: number; y: number; value?: number }>;
  mapInteractables?: Array<{ id: string; kind: 'relay' | 'root-anchor' | 'cache' | 'plate' | 'coil'; x: number; y: number; w: number; h: number }>;
  mapFeature?: 'fractured-616' | 'glassroot-shrine';
  /** Overhead conditions; defaults to 'clear' when omitted. */
  sky?: AreaSky;
  obstacles: ObstacleDef[];
  /** A readable set piece drawn into the arena as a visual story cue. */
  landmark?: {
    name: string;
    description: string;
    kind: 'market' | 'rail-yard' | 'plaza' | 'floodgate' | 'pressure-rooms';
    accent: string;
    position?: { x: number; y: number };
  };
  /** Slow environmental corruption that Data-Gobs accelerate by chewing. */
  rawDataBreakage?: {
    ambientPerSec: number;
    damageVulnerability: number;
  };
  /** Whether the map is in extreme pitch-black darkness requiring light sources. */
  extremeDark?: boolean;
  /** Seconds the player must survive to clear the area. */
  durationSec: number;
  waves: WaveDef[];
  /** Optional music-reactive gameplay events; empty/absent for most areas. */
  musicEvents?: MusicSpawnEvent[];
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
   * Procedural theme key for endless maps that determines chunk generation,
   * building prefabs, hazard profiles, and distance band progressions.
   */
  endlessTheme?: EndlessThemeId;
  /**
   * When set, pickups spawn at random points in the arena on a cadence,
   * independent of kills or breakables. See oddity-arenas.md.
   */
  randomDrops?: { intervalMs: number };
}

export type EndlessThemeId =
  | 'streets'
  | 'rooftops'
  | 'catacombs'
  | 'alleys'
  | 'null-sector'
  | 'docks'
  | 'wasteland';

export type CustomMapAssetCategory =
  | 'ground'
  | 'tile'
  | 'beacon'
  | 'structure'
  | 'hazard'
  | 'landmark'
  | 'enemy'
  | 'encounter'
  /** Where the player (or a Sector Command faction) enters the map. */
  | 'spawn-point'
  /** A named point a mission objective can reference (hold, escort, destroy). */
  | 'objective-marker'
  | 'pickup'
  | 'interactable'
  | 'ambiance';

export interface CustomMapPlacement {
  id: string;
  assetId: string;
  category: Exclude<CustomMapAssetCategory, 'ground'>;
  x: number;
  y: number;
  w: number;
  h: number;
  mode?: 'permanent' | 'breakable' | 'cosmetic';
  groupId?: string;
  fromSec?: number;
  toSec?: number;
  ratePerSec?: number;
  burst?: number;
}

export interface CustomMap {
  mapFeature?: 'fractured-616' | 'glassroot-shrine';
  version?: 2;
  id: string;
  name: string;
  bounds: { w: number; h: number };
  groundAssetId: string;
  landmarkAssetId: string | null;
  landmarkPosition?: { x: number; y: number };
  placements: CustomMapPlacement[];
  durationSec: number;
  threat: AreaDef['threat'];
  backdrop: string;
  sky?: AreaSky;
  ambiance?: 'street-rain' | 'null-spores' | 'breach' | 'clear';
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
  /** tile only: the complete source ground treatment to paint into this cell. */
  groundStyle?: AreaDef['ground'];
  enemyId?: string;
  wave?: WaveDef;
  /** spawn-point only: which side enters here. 'player' is the run's start position. */
  spawnSide?: 'player' | 'hostile';
  /** objective-marker only: what a mission objective can do with this point. */
  markerRole?: 'hold' | 'destroy' | 'escort' | 'extract';
  /** beacon only: which `SectorStructureDef` this placement builds. */
  beaconId?: string;
  /** Map pack props use one physics kind and choose artwork by this id. */
  artAssetId?: string;
  pickupKind?: string;
  interactableKind?: 'relay' | 'root-anchor' | 'cache' | 'plate' | 'coil';
  defaultMode?: CustomMapPlacement['mode'];
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

/**
 * Player-chosen run-wide toggles, picked on the Roster screen before launch
 * and carried into `createWorld`'s `setup.modifiers`. Every field is
 * additive/independent so any combination can be enabled together -- see
 * `modifierHpMult`/`modifierSpawnMult`/`speedMult` in `engine/world.ts`.
 */
export interface RunModifiers {
  /** Doubles enemy spawn rate and applies a flat 1.5x hp bump, stacking with everything else. */
  doubleMode?: boolean;
  /** Quadruples normal wave spawn rate. Overrides doubleMode's spawn portion when both are enabled. */
  quadSpawnMode?: boolean;
  /** Raises the live-enemy cap to 1,000 and uses an optimized 8x spawn cadence. */
  unleashedMode?: boolean;
  /** Represents millions of enemies through a bounded live simulation plus an aggregated crowd layer. */
  millionHordeMode?: boolean;
  /** Mirrors the area's obstacle layout left-to-right at run start. */
  invertedMap?: boolean;
  /** Raises player and enemy movement speed. */
  speedMode?: boolean;
  /** Enemy hp scales up with the player's current level, capped. */
  scalerMode?: boolean;
  /** The area's timer never ends the run; the final wave repeats and escalates instead. */
  infiniteMode?: boolean;
  /** Enables the periodic HordeSpin wheel event. */
  hordeSpinEnabled?: boolean;
  /**
   * Raises the odds the Director (see `data/directors.ts`) crashes the run
   * with an unscripted squad once eligible. Unlocked permanently in
   * `MetaState.directorModeUnlocked` after the player first defeats the
   * Director's boss; the Director can still trigger at its base chance
   * before that unlock, since the toggle only exists once there's an
   * encounter on record to want more of.
   */
  directorModeEnabled?: boolean;
  /**
   * Bathes the area's ground/lighting in a cycling disco palette for the
   * whole run -- a pure rendering effect (see `drawGround` in
   * `render/draw.ts`), never touching spawn rate, hp, or collision.
   * Thematically paired with the Digital Disco bonus area, but works on
   * any area like `invertedMap`/`speedMode`.
   */
  discoMode?: boolean;
  /** Bionic Cluck Protocol: Transmutes fallen enemies into friendly Chicken-Bots that lay restorative eggs. */
  bionicCluckProtocol?: boolean;
}

export type GraphicsQuality = 'high' | 'balanced' | 'performance';
import type { DamageNumberStyle } from './data/damageNumbers';
export type { DamageNumberStyle };
export type CompanionRevealStyle = 'ambush' | 'classic';
export type RuntimePerformanceTier = 'constrained-mobile' | 'standard-mobile' | 'high-mobile' | 'desktop';

/* ------------------------------------------------------------------ */
/* Director events                                                     */
/* ------------------------------------------------------------------ */

/**
 * A scripted, low-probability mid-run escalation: a named "Director" cuts
 * in with its own unique squad (see `data/factions.ts`), built from the
 * existing `WaveDef`/`squadWave` machinery rather than bespoke sim code.
 * Content lives in `data/directors.ts`; the engine only re-rolls the timer
 * and spawns the roster -- see `updateDirector` in `engine/world.ts`.
 */
export interface DirectorDef {
  id: string;
  name: string;
  /** Seconds into the run before the Director may trigger at all. */
  triggerAfterSec: number;
  /** Seconds between eligibility re-rolls once past `triggerAfterSec`. */
  rerollIntervalSec: number;
  /** Chance (0..1) the Director fires on each re-roll. */
  chance: number;
  /** Multiplier applied to `chance` when `RunModifiers.directorModeEnabled` is on. */
  directorModeChanceMult: number;
  /** Faction registered in `data/factions.ts` whose whole roster arrives together. */
  factionId: string;
  /** Enemy id (must be in the faction roster) whose defeat clears the encounter. */
  bossEnemyId: string;
  hpMult: number;
  formation?: WaveDef['formation'];
  warningText: string;
  victoryText: string;
  /** Meta unlock id recorded permanently once this Director's boss is defeated. */
  unlockId: string;
  /** Label shown on the Roster screen's Director Mode toggle once unlocked. */
  toggleLabel: string;
  toggleDescription: string;
  /**
   * Shown in the Digital Archive terminal once this personality is
   * unlocked (`MetaState.defeatedDirectorIds`) -- distinct from the in-run
   * `warningText`/`victoryText` banners. Locked cards show only a mystery
   * placeholder, never this text.
   */
  codexLore: string;
  /**
   * How selecting this personality (`MetaState.activeDirectorPersonalityId`)
   * changes the rest of a run, beyond which faction/boss spawns. A small,
   * bounded set of knobs, composed the same way every other automatic/
   * environmental multiplier in this codebase already composes -- never
   * stacked outside existing difficulty caps.
   */
  effect: DirectorPersonalityEffect;
}

export type DirectorPersonalityEffect =
  | { kind: 'none' }
  | { kind: 'spawnBias'; spawnRateMult: number; hpMult: number }
  | { kind: 'factionFavor'; favoredFactionId: string; spawnRateMult: number };

/** Live per-run state for the (at most one, currently) active Director encounter. */
export interface DirectorRunState {
  phase: 'pending' | 'active' | 'resolved';
  /** w.now the next eligibility roll happens. */
  nextRollAt: number;
  activeDirectorId: string | null;
  /** uid of the spawned boss enemy for the active encounter, if any. */
  bossUid: number | null;
  /** True once the active/most recent encounter's boss was defeated. */
  victorious: boolean;
}

/** A one-shot meta-progression announcement, drained and shown by the hub on return. See `MetaState.pendingNotifications`. */
/** A hideout panel a room tile or prop can open. */
export type HubPanel = 'runs' | 'roster' | 'bestiary' | 'music' | 'studio' | 'unlocks' | 'recovery' | 'vendor' | 'kennel' | 'workshop' | 'card-shop' | 'weapon-bans' | 'grpd-armory' | 'settings' | 'palette-store' | 'sound-booth' | 'account' | 'feedback' | 'threat-matrix' | 'director-terminal' | 'dust-mite-rancher' | 'frog-ranch' | 'lok-shop';

/** Today's hideout payouts (local day), see `engine/hideoutRewards.ts`. */
export interface HideoutLedger {
  day: string;
  granted: Partial<Record<'cred' | 'cardCredits' | 'lokPetTreats' | 'petElixirs' | 'skeletonKeys' | 'petExp', number>>;
  events: number;
  rare: number;
}

export interface PendingNotification {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

export type HordeSpinTierId = '1x' | '2x' | '3x' | '4x' | '5x5' | '666';
export type HordeSpinPhase = 'idle' | 'spinning' | 'result' | 'active';

/** One weighted outcome on the HordeSpin wheel. Content lives in `data/hordeSpin.ts`. */
export interface HordeSpinTierDef {
  id: HordeSpinTierId;
  label: string;
  /** Relative odds; the pool doesn't need to sum to 100. */
  weight: number;
  /** Base horde size multiplier (base cluster size is fixed in the engine). */
  spawnMultiplier: number;
  hpMult: number;
  rewardCred: number;
  rare?: boolean;
  /** 666 only: screen hue-shifts while the horde is active. */
  colorFluctuation?: boolean;
  /** Grants a guaranteed LokPet roll when the horde is cleared. */
  grantsPet?: boolean;
  celebration: 'mild' | 'big' | 'legendary';
}

/** Runtime state for the periodic HordeSpin wheel event. Null unless `RunModifiers.hordeSpinEnabled`. */
export interface WheelSpinState {
  phase: HordeSpinPhase;
  /** w.now the wheel is next allowed to spin again (only meaningful while idle). */
  nextSpinAt: number;
  spinStartedAt: number;
  resultAt: number;
  resultTierId?: HordeSpinTierId;
  activeEndsAt: number;
  rewardGranted: boolean;
  spinsThisRun: number;
  colorFluctuation: boolean;
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

export type EndlessBandId =
  | 'core'
  | 'floodwall'
  | 'rail-shadow'
  | 'industrial-fringe'
  | 'outer-threshold'
  | (string & {});

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

export type BuildingSupplyKind = 'health' | 'cred' | 'water-flask' | 'phosphor-ore' | 'silicon-alloy' | 'cyber-resin';

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
  /** The original room transition remains available as a device setting. */
  buildingEntryStyle: 'seamless' | 'classic';
  /** Building occupied in walk-in mode; the street simulation continues. */
  walkInBuildingId: string | null;
  /** Supply caches claimed during this run, including unloaded blocks. */
  claimedBuildingSupplies: Set<string>;
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
    supplyKind: BuildingSupplyKind | null;
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
  | 'mind-the-register'
  // The back room
  | 'rewire-the-cabinets'
  | 'run-the-high-score-board'
  // GRPD Station
  | 'run-the-drills'
  | 'cook-the-last-feast' | 'count-the-sheep' | 'chart-the-horde'
  | 'raise-the-palings' | 'tune-the-moon' | 'mix-the-elixir'
  | 'forge-the-banners' | 'repair-the-cabinets' | 'cycle-the-air'
  | 'seal-the-hatches' | 'relay-the-pressure' | 'inspect-the-lockers';

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

/**
 * Where a room sits relative to the hideout. `hideout` rooms are part of the
 * safe base and never trigger a travel ambush; `travel` rooms are out in the
 * city, so walking there can pull the player into a travel encounter (see
 * `TRAVEL_ENCOUNTER_TRIGGERS`).
 */
export type HubRoomKind = 'hideout' | 'travel';

export interface HubRoomDef {
  id: string;
  name: string;
  /** Hideout rooms are safe; travel rooms can be ambushed on arrival. */
  kind: HubRoomKind;
  subtitle: string;
  description: string;
  backdrop: string;
  /** Visual identity used by the hideout atmosphere layer. */
  biome?: HideoutBiome;
  unlock: UnlockRule;
  /** Feature keys surfaced in this room. */
  features: Array<'runs' | 'roster' | 'bestiary' | 'music' | 'studio' | 'unlocks' | 'allies' | 'recovery' | 'vendor' | 'kennel' | 'workshop' | 'card-shop' | 'weapon-bans' | 'settings' | 'palette-store' | 'sound-booth' | 'account' | 'feedback' | 'director-terminal'>;
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

export type FacilityTier = 'tub' | 'shower' | 'hot-tub' | 'sauna' | 'rooftop-hot-tub' | 'swat-sauna';

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

export type VendorItemCategory = 'stat' | 'utility' | 'challenge' | 'relic' | 'ability' | 'lokpet';

export type VendorEffect =
  | { kind: 'stat'; stat: keyof BaseStats; add?: number; mult?: number; cap?: number }
  | { kind: 'utility'; utility: 'starting-weapon-level' | 'reward-cred-mult' | 'extra-life' | 'threat-matrix' | 'universal-incursion' | 'corner-magnet' | 'tidal-anchor' | 'static-inverter'; amount: number };

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
  /**
   * `category: 'lokpet'` items grant a `SavedLokPet` rolled from this
   * variant straight into the kennel on purchase, instead of a permanent
   * stat effect -- see `buyVendorItem` in `state/metaStore.tsx`. Rapid
   * Guard's police-dog counter (`data/vendor.ts`) is the first user.
   */
  grantsLokPetVariantId?: string;
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
  /** Visual progression label. Starter themes are always available. */
  tier?: 'starter' | CosmeticTier;
  /** Included in the always-available intro theme carousel. */
  starter?: boolean;
  /** Secret until earned through a rare reload takeover or Dev Mode. */
  hidden?: boolean;
  /** Reward from an authored in-world find, excluded from random cold-open reveals. */
  findOnly?: true;
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

/**
 * A purchasable gameplay-SFX reskin sold in the Sound Booth. Mirrors
 * `ThemedPaletteDef`'s shape exactly, one currency (`lootTokens`), one
 * catalog pattern (`ownedSoundPackIds`/`activeSoundPackId`). `style` is the
 * small set of synthesis knobs from `audio/sfxCues.ts` that reskins every
 * cue uniformly -- a pack never redefines individual cues.
 */
export interface SoundPackDef {
  id: string;
  name: string;
  description: string;
  /** Loot token cost to unlock. 0 = always owned. */
  cost: number;
  /** When true, this pack is included in the default owned set. */
  owned?: boolean;
  tier?: CosmeticTier;
  style: SfxStyleDef;
}

/** Procedural player aura rendered during runs. These styles are visual only. */
export type RunAuraStyle =
  | 'street-halo'
  | 'radar-sweep'
  | 'ember-orbit'
  | 'rain-signal'
  | 'glitch-echo'
  | 'mothlight'
  | 'tile-bloom'
  | 'comet-trail';

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
export type HatStyle = 'none' | 'top-hat' | 'halo' | 'crown' | 'satellite' | 'rain-cloud' | 'cone' | 'orbital-eye' | 'moth-cap' | 'antenna' | 'vinyl-disc' | 'paper-visor';
export interface HatDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  tier: CosmeticTier;
  style: HatStyle;
}

/** A separate, short reward-reveal effect—not an aura. */
export type CelebrationStyle = 'paper-stars' | 'coin-burst' | 'signal-hearts' | 'confetti-rain' | 'moth-swarm' | 'spark-shower';
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
  /**
   * 'high' (default) matches every run's current, unchanged behavior --
   * nothing about how the game looks changes unless the player opts into a
   * lower tier. 'balanced'/'performance' trim decorative density (particle
   * counts, damage popups, enemy outlines/shadows) starting at progressively
   * lower enemy counts, useful on a slower device or a very dense swarm run.
   */
  graphicsQuality: GraphicsQuality;
  /** How hit numbers look. 'classic' (default) is the original popup; see `data/damageNumbers.ts`. */
  damageNumberStyle: DamageNumberStyle;
  /**
   * How the starter LokPet encounter reveals your first companion.
   * 'ambush' (default) has the companion leap in and strike alongside you
   * mid-fight. 'classic' keeps the original tap-the-bush "Digital rustle"
   * reveal. Purely presentational -- never affects which companion you get
   * or its stats.
   */
  companionRevealStyle: CompanionRevealStyle;
  /**
   * Render pacing preference. The simulation remains fixed at 60 Hz, while
   * 120 Hz redraws input and presentation between simulation updates on
   * capable displays. The renderer automatically reduces its backing scale
   * when a device cannot keep the requested cadence.
   */
  frameRateMode: 60 | 120;
  /** Lifetime objective completions, used to reveal the ordered game soundtrack. */
  soundtrackObjectiveCompletions: number;
  /** Environmental atmospheric fog ambiance mode. */
  fogAmbianceMode: 'auto' | 'dark-maps' | 'always' | 'off';
  /** Glowing eyes in distant fog: 'lil', 'mid', 'lot', or 'off'. */
  glowingEyesIntensity: 'lil' | 'mid' | 'lot' | 'off';
  /** Automatic camera zoom-out when the screen has many enemies/action. */
  crowdAutoZoomEnabled: boolean;
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
  /** Cheat-code toggle from the Quartermaster's "Wrong Side of the Street" unlock: mirrors the run left-to-right. Requires owning that vendor item. */
  mirrorModeEnabled: boolean;
  /** 'grid' shows list-heavy hub panels as multi-column card grids; 'list' is the original single-column layout. */
  uiDensity: 'grid' | 'list';
  /** Cosmetic presentation for LokPet portraits and cards. Never changes a companion's stats. */
  lokPetArtStyle: 'pixel-core' | 'neon-signal' | 'holo-card';
  /** Shared chrome shape for menu cards and controls. */
  uiBorderStyle: 'square' | 'soft' | 'round';
  /** Independent frame shape for collectible LokPet portraits. */
  lokPetBorderStyle: 'square' | 'soft' | 'round';
  /** Independent frame shape for playable-character portraits. */
  characterBorderStyle: 'square' | 'soft' | 'round';
  /** Whether the game reacts to the soundtrack (beat pulses, on-beat crits). */
  musicReactiveEnabled: boolean;
  /** Optional procedural room ambience in the hideout (rain, pipe hum, cellar drips). Off by default. */
  hideoutAmbienceEnabled: boolean;
  /** Shows a brief "arriving outside in the rain, then step inside" scene once per session before the hideout menu. On by default. */
  hideoutArrivalEnabled: boolean;
  /** Visual hideout weather -- clouds, fliers, and the per-room particle layer. On by default (silent CSS decoration, unlike the audio ambience above). */
  hideoutWeatherEnabled: boolean;
  /** The bot-piloted background simulation on the title screen (see AttractMode.tsx). On by default. */
  attractModeEnabled: boolean;
  /** Whether the Hideout's generators/scene-links/rumor/First Night+Contract sections start collapsed. Off by default. */
  hideoutSectionsCollapsedByDefault: boolean;
  /** The animated walking-rig hero at the top of the Hideout screen. On by default; off reverts to the classic static layout. */
  hideoutPreviewEnabled: boolean;
  /** Which pets walk the Hideout strip: all selected pets and the partner, only the partner, or none. */
  hideoutPets: 'all' | 'companion' | 'off';
  /** How often small pet events play in the Hideout: normal, rarely, or never. */
  hideoutEvents: 'on' | 'quiet' | 'off';
  /** Walk the operator with taps or arrow keys and use the props around each room. On by default. */
  hideoutInteractive: boolean;
  /** The pet play bar (scratch, fetch, nap together...) under the Hideout strip. On by default. */
  hideoutPetPlay: boolean;
  /** How often a choice event offers itself while you move around: normal, rarely, or never. */
  hideoutChoiceEvents: 'on' | 'quiet' | 'off';
  /** When each prop, choice event or rare find last paid out (ms), keyed `prop.<id>`, `event.<id>`, `rare.<item>`. */
  hideoutClaims: Record<string, number>;
  /** What the hideout has handed out today, so small rewards stay small. */
  hideoutLedger: HideoutLedger;
  /** Crew-wide morale that follows how runs end (`data/morale.ts`); negative shrinks crew boosts. */
  crewMorale: number;
  /** Runs won in a row right now, and the longest such run ever (`data/morale.ts`). */
  runStreak: number;
  /** A started sky boost from the spyglass (`data/skyEvents.ts`). */
  /** Whether the player owns the hideout Ball (sold in the LokShop; `data/hideoutBall.ts`). */
  ownsBall: boolean;
  /** The buff a hideout event left behind (`data/eventBuffs.ts`). */
  eventBuff: { buffId: string; until: number } | null;
  /** Places revealed by following a Light Spur in the spyglass (`data/lightSpurs.ts`). */
  spurAreaIds: string[];
  skyBoost: { eventId: string; until: number; window: number } | null;
  bestRunStreak: number;
  /** The fixed mobile-only "Head out" button pinned to the bottom of the Hideout screen. On by default. */
  hideoutStickyHeadOutEnabled: boolean;
  /** The rotating Minecraft-style splash blurb on the title screen. On by default. */
  splashTextEnabled: boolean;
  /** Shows the cleaner signature title lockup instead of the classic stacked two-line title. Off by default. */
  oneLineTitleEnabled: boolean;
  /** Lets the two title pieces be dragged with a gentle release momentum on the opening screen. On by default. */
  introTitlePhysicsEnabled: boolean;
  /** Seconds of inactivity before the intro pieces magnetically return home. */
  introTitleReturnDelaySec: number;
  /** Popup travel-encounter minigame on select hideout/run-launch triggers. On by default. See game/travelEncounter.ts. */
  travelEncountersEnabled: boolean;
  /** Allows animated palette flourishes independently from the selected colors. */
  paletteAnimationsEnabled: boolean;
  /** Blends the global Artisan world palette over each character's personal skin. */
  worldPaletteBlendEnabled: boolean;
  /** Extends the active world palette to recolor enemies and environment accents too, not just the player. Off by default to preserve the original look. */
  worldColorFullRecolorEnabled: boolean;
  /** Sector Command missions cleared at least once. */
  completedSectorMissionIds: string[];
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
  /**
   * Studio layout: 'auto' follows the device's own viewport (mobile-width
   * devices get the tabbed touch layout, everything else gets the full
   * multi-panel one); 'mobile'/'desktop' force one regardless of viewport.
   */
  studioLayout: 'auto' | 'mobile' | 'desktop';
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
  /** Cards imported from other G-Six games. Display-only; see VisitingLokCard. */
  visitingLokCards: VisitingLokCard[];
  /** Recovery currency, regenerated in groups of three every twenty minutes. */
  petElixirs: number;
  petElixirUpdatedAt: number;
  /** enemyId -> total defeats, drives the bestiary. */
  bestiary: Record<string, number>;
  totalKills: number;
  /** Lifetime kills of enemies carrying each random quirk, by quirk id. */
  quirkKills: Record<string, number>;
  /** Runs started with at least one quirk set to Everywhere / Take it on. */
  quirkEverywhereRuns: number;
  quirkTakenRuns: number;
  /** Quirk Surges the player has outlasted. */
  quirkSurgesSurvived: number;
  /** Director beats (supply drops, stampedes) finished, lifetime, by beat id. */
  runEventsSurvived: Record<string, number>;
  /** Crew call-ins used, lifetime. */
  callInsUsed: number;
  /** GRPD evidence seals are earned every 1,000 lifetime kills; this is the spent amount. */
  grpdSpentSeals: number;
  /** Completed field prototypes fabricated at the GRPD Armory. */
  grpdUnlockedWeaponIds: string[];
  /** Fabricated prototypes explicitly enabled for future runs. */
  grpdActiveWeaponIds: string[];
  /** Purchased offer-weight tier for each fabricated prototype, from 1 to 5. */
  grpdSpawnTierByWeaponId: Record<string, number>;
  /** Whether lifetime kills raise archived weapon offer weight. */
  grpdAutoIncreaseEnabled: boolean;
  /** The Luvitnot keeper can move the Armory between these two safe entrances. */
  grpdArmoryAnchor: 'station' | 'hideout';
  totalRuns: number;
  bestSurvivalSec: number;
  /** Every level-up across every run, ever -- never resets. Feeds the persistent player level. */
  totalLevelUps: number;
  /** Soft currency earned per run. */
  cred: number;
  /** Loot tokens spendable in the hideout. */
  lootTokens: number;
  /** Currency earned from blue loot boxes and spent at the LokPet card shop. */
  cardCredits: number;
  cardCollection: OwnedCardRecord[];
  /** Owned booster cards. Each adds its units to a stat for every run, the way crew boosts do. */
  boosterCards: BoosterCardRecord[];
  /** Purchased or found packs not yet opened, keyed by pack id. Opened via `openStoredCardPack`. */
  unopenedCardPacks: Partial<Record<CardPackId, number>>;
  /** When true (default), buying or finding a pack opens it immediately. When false, packs are stored sealed in `unopenedCardPacks` for the player to open later. */
  autoOpenPacksEnabled: boolean;
  activePassiveCardIds: string[];
  /** Up to BATTLE_DECK_SLOTS owned card ids equipped for the travel-encounter minigame's Attack action. Empty deck falls back to an unarmed punch -- never blocks the player. See data/travelEncounters.ts. */
  battleDeckCardIds: string[];
  /** Legacy compatibility flag for players who previously owned Salvage Protocol. */
  cardSalvageUnlocked: boolean;
  /** Permanent companion-shop device. It keeps thrown cards in the binder and records companion details in Archives. */
  handheldDigiScopeOwned: boolean;
  /** Heavy-duty mining headlamp. Pierces dark underground maps and illuminates shadowed areas. */
  miningHelmetOwned: boolean;
  /** Ultrasonic Digi-Rangler whistle. Enhances minion command and swarm radius. */
  rancherWhistleOwned: boolean;
  /** Eclipse Solar Monocle. Reveals hidden byte-cache rifts and solar flare events. */
  eclipseMonocleOwned: boolean;
  /** Purchased and unlocked custom card frames / sleeves. */
  cardFrameSleeves: string[];
  /** Currently equipped card frame style. */
  selectedCardFrame: string;
  /** Purchased card backs (see data/cardCosmetics.ts). `back-default` is always owned. */
  ownedCardBackIds: string[];
  /** Card back shown face-down while a pack is opened. */
  selectedCardBack: string;
  /** Purchased pack skins. `pack-classic` is always owned. */
  ownedPackSkinIds: string[];
  /** How the shop's pack tiles are drawn. */
  selectedPackSkin: string;
  /** How much the pack and card cosmetics move: tilt and shimmer (`full`), hover only (`subtle`) or still (`off`). */
  cardMotion: 'full' | 'subtle' | 'off';
  /** Completed runs made with any LokPet Collector; unlocks higher collector ranks. */
  lokCollectorRuns: number;
  /** Chest-origin LokPets caught during collector runs. */
  lokCollectorPetsFound: number;
  /** Sanctum LokPet League tier reached (0: unranked, 1-5: champion tiers). */
  lokPetLeagueTier: number;
  /** Total LokPet arena battles won. */
  lokPetBattleWins: number;
  /** Badges and crests earned from defeating league syndicate masters. */
  lokPetBattleBadges: string[];
  /** Treats available to feed and level up companions in the Lit Corner. */
  lokPetTreats: number;
  /** Rare currency found by breaking street props, weighted toward endless mode. Spendable in the hideout vendor's relic category. */
  skeletonKeys: number;
  /** Rentable/buildable passive cred generators the player owns. See `data/generators.ts`. */
  ownedGeneratorIds: string[];
  /** Wall-clock ms of the last time owned generators' income was settled into `cred`. */
  generatorAccrualAt: number;
  /** Run-wide toggles picked on the Roster screen before launch. See `RunModifiers`. */
  runModifiers: RunModifiers;
  /** Whether the player has seen the intro briefing. */
  onboarded: boolean;
  /** The one-time first-arrival LokPet rescue has been completed. */
  starterLokPetOnboardingComplete: boolean;
  /** Species chosen during the first-arrival encounter. */
  starterLokPetVariantId: string | null;
  /** Farthest endless distance ever reached (world units). */
  endlessRecordDistancePx: number;
  /** Deepest dungeon depth ever reached in endless mode. */
  endlessRecordDepth: number;
  /** Endless bands and route beacons found across all runs. */
  endlessDiscoveryIds: string[];
  /** Character id -> current fatigue penalty percentage, capped at 5. */
  fatigueByCharacter: Record<string, number>;
  /** Character id -> lifetime level-ups earned while playing that character specifically -- never resets. Feeds each character's own persistent mastery level. */
  characterLevelUps: Record<string, number>;
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
  /** Total number of times the player has returned to the hideout; drives the Artisan Valor Prime takeover cadence. */
  hideoutVisitCount: number;
  /** Hideout visits (including the current one) left in an active Prime takeover; 0 when none is running this way. */
  primeTakeoverVisitsRemaining: number;
  /** Timestamp (ms) an active timed Prime takeover ends at; 0 when none is running this way. */
  primeTakeoverUntil: number;
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
  /** Core Master upgrade: expands cycling beyond the starter theme set. */
  themeCycleMastered: boolean;
  /** Which collection the Core Master cycles through after it is unlocked. */
  themeCycleCollection: 'starter' | 'owned';
  /** Purchased themed palette ids. The 'default' palette is always included. */
  ownedPaletteIds: string[];
  /** Currently active character/world color palette id. */
  activePaletteId: string;
  /** Purchased sound pack ids, bought from the Sound Booth. The free 'house-pa' pack is always included. */
  ownedSoundPackIds: string[];
  /** Currently equipped gameplay-SFX sound pack id. */
  activeSoundPackId: string;
  /** Master on/off for gameplay sound effects (hits, pickups, UI...). Independent of music/ambience. */
  sfxEnabled: boolean;
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
  /** Drop art packs (render-only). The free Potato Pack is the original look. */
  ownedDropPackIds: string[];
  activeDropPackId: string;
  /** LokToken purchase (Lok Shop): unlocks the LokPet field guide in Character Select. */
  lokPetFieldGuideUnlocked: boolean;
  /** LokToken purchase (Lok Shop): required to select any LokPet Collector character, in addition to that character's own progress-based unlock. */
  lokPetCollectorAccessUnlocked: boolean;
  /** Local-date key for the currently active Broadcast contract board. */
  dailyContractDayKey: string;
  /** Progress accumulated against today's Broadcast contracts. */
  dailyContractProgressById: Record<string, number>;
  /** Contracts already paid out for today's Broadcast board. */
  completedDailyContractIds: string[];
  /** Local-date key of the last day a login-streak bonus was claimed. */
  lastLoginStreakDayKey: string;
  /** Consecutive days claimed, including today once claimed. Resets to 1 on a missed day. */
  loginStreakCount: number;
  /** Achievement ids whose one-time currency reward has already been paid out. See `data/achievements.ts`. */
  claimedAchievementIds: string[];
  /** Director ids whose boss has been permanently defeated at least once. See `data/directors.ts`. */
  defeatedDirectorIds: string[];
  /** True once any Director has been defeated, unlocking the Director Mode run toggle. */
  directorModeUnlocked: boolean;
  /**
   * Which Director personality's squad/boss actually spawns for the Director
   * encounter (see `updateDirector` in `engine/world.ts`). Only selectable
   * from the Digital Archive terminal among ids already in
   * `defeatedDirectorIds`; null/unset falls back to `DIRECTORS[0]`.
   */
  activeDirectorPersonalityId: string | null;
  /**
   * Set by the SWAT Sauna's "reach through the hole" hub action
   * (`data/recovery.ts`'s `SAUNA_HOLE_REWARDS`); the referenced weapon is
   * added to the very next run's loadout and this is cleared once that run
   * ends, win or lose. Null when nothing is queued.
   */
  pendingSaunaReward: { weaponId: string } | null;
  /** Whether the Threat Matrix quarantine terminal is unlocked with lootkeys. */
  threatMatrixUnlocked: boolean;
  /** Bestiary enemy IDs contained/disabled from spawning in runs. */
  disabledEnemyIds: string[];
  /** Weapons quarantined / disabled from level-up rolls and loot chests. */
  disabledWeaponIds: string[];
  /** Passives quarantined / disabled from level-up rolls and loot chests. */
  disabledPassiveIds: string[];
  /** Threat Matrix sector calibrations (mass, hp, density, wave angles, special events). */
  threatCalibrations: ThreatCalibrations;
  /** Toggled reality upgrades in the Threat Matrix (e.g. universal-incursion, tidal-anchor). */
  threatUpgrades: Record<string, boolean>;
  /** Easter egg weapon unlocked status (DVD Bouncing Logo). */
  dvdEasterEggUnlocked: boolean;
  /** Generic queue of unlock/achievement announcements, drained by the hub screen on return. */
  pendingNotifications: PendingNotification[];
  /** Highest changelog version (see `data/changelog.ts`) the player has acknowledged via the update popup. */
  lastSeenChangelogVersion: string;
  /** Which update categories may open an automatic notice on the hub. */
  updatePopupKinds: Record<ChangelogKind, boolean>;
  /** Relic crafting materials gathered from runs, chests, and deep mines. */
  relicMaterials: Record<string, number>;
  /** Real relics crafted at the Workshop Forge that grant permanent/toggled run perks. */
  craftedRelicIds: string[];
  /** Key items in inventory (e.g. mining-helmet, firefly-lantern, phosphor-crown, bag-of-water, digiscope). */
  ownedKeyItemIds: string[];
  /** Card customization frames and foil overlays unlocked. */
  unlockedCardCustomizations: string[];
  /** Card-specific customizations applied (frame, overlay, companion seal). */
  cardCustomizationsByCardId: Record<string, { frame?: string; overlay?: string; companionSeal?: string }>;
}

export type ThreatAngleMode = 'standard' | 'pincer' | 'cardinal' | 'spiral' | 'corners';
export type ThreatEventId = 'emp-storm' | 'gravity-anomaly' | 'glitch-surge' | 'solar-flare' | 'blood-overclock' | 'swarm-frenzy';

export interface ThreatCalibrations {
  /** Multiplier on enemy maximum health, 0.5x to 3.0x. Default 1.0 */
  hpMult: number;
  /** Multiplier on enemy physics mass and collision scale, 0.5x to 2.5x. Default 1.0 */
  massMult: number;
  /** Multiplier on enemy wave spawn rates and pack density, 0.5x to 2.5x. Default 1.0 */
  densityMult: number;
  /** Wave incursion angle vector mode. Default 'standard' */
  angleMode: ThreatAngleMode;
  /** Special events active during the run. */
  activeEvents: ThreatEventId[];
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
  /** Sector Command: which mission this run was, if any. */
  missionId?: string;
  /**
   * Sector Command: whether the mission's required objectives were all met.
   * Campaign credit follows this, never `cleared` -- surviving the clock ends
   * the run but does not complete the mission.
   */
  missionComplete?: boolean;
  survivedSec: number;
  kills: number;
  level: number;
  cred: number;
  killsByEnemy: Record<string, number>;
  /** Kills of quirked enemies this run, by quirk id. */
  killsByQuirk?: Record<string, number>;
  /** This run used a quirk's Everywhere option / Take it on option. */
  quirkEverywhereRun?: boolean;
  quirkTakenRun?: boolean;
  /** This run outlasted its Quirk Surge. */
  quirkSurgeSurvived?: boolean;
  /** Director beats this run finished (survived the whole beat). */
  runEventsSurvived?: string[];
  /** Crew call-ins used this run. */
  callInsUsed?: number;
  /** Growth Recap: XP, level and bond changes for pets that were out. Filled when the run is recorded. */
  petGrowth?: PetGrowthEntry[];
  rescuedAllyId?: string;
  discoveryId?: string;
  /** Finds are kept even when the player falls before the area clear. */
  mapFindIds?: string[];
  newlyUnlockedCharacterIds: string[];
  loadout: {
    weapons: Array<{ id: string; name: string; level: number; kind: WeaponKind; color?: string }>;
    passives: Array<{ id: string; name: string; stacks: number }>;
  };
  /** Loot boxes opened this run. */
  lootBoxesOpened: number;
  /** Prize labels collected from loot boxes. */
  openedPrizes: string[];
  cardPacksFound?: CardPackId[];
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
  /** Relic crafting materials collected during this run. */
  craftingMaterialsCollected?: Record<string, number>;
  /** Fatigue applied to the operative after this run. */
  fatigueAddedPct?: number;
  /** Operative's fatigue after this run, before recovery begins. */
  fatigueAfterPct?: number;
  /** Director id that triggered during this run, if any. See `data/directors.ts`. */
  directorEncounterId?: string;
  /** True if this run's Director boss was defeated. */
  directorDefeated?: boolean;
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
  /** Bounded, capped list of notable moments captured during the run. See `game/data/runHighlights.ts`. */
  highlights?: RunHighlight[];
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
  /** Level-up rerolls left this run (see `consumeReroll`). */
  rerollsRemaining: number;
  /** Million Horde only: total represented population and its bounded live subset. */
  millionHorde?: { population: number; peakPopulation: number; defeatedPopulation: number; liveActors: number };
  cred: number;
  ultimateReadyPct: number;
  /** 0 to 100: how far the dash cooldown has recovered (100 = ready). */
  dashReadyPct?: number;
  /** The next crew call-in: who it is and how far the shared cooldown has recovered. */
  callIn?: { name: string; label: string; readyPct: number };
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
  /** Pressure-room-only integrity readout for exposed Digi-Arch systems. */
  pressureRescue?: {
    integrityPct: number;
    exposedSystems: number;
    criticalSystems: number;
  };
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
  /** Present only when `RunModifiers.hordeSpinEnabled` was on at run start. */
  wheelSpin?: {
    phase: HordeSpinPhase;
    resultTierId?: HordeSpinTierId;
    resultLabel?: string;
    rewardCred: number;
    rare: boolean;
    celebration: 'mild' | 'big' | 'legendary';
    secondsToNextSpin: number;
    activeRemainingSec: number;
    colorFluctuation: boolean;
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

/* ------------------------------------------------------------------ */
/* Sector Command (RTS/campaign mode)                                  */
/* ------------------------------------------------------------------ */

/**
 * How a mission gets its army. Only 'stolen' is implemented; the other two
 * are declared now so missions can be authored against them and the runtime
 * can fail loudly rather than silently mis-handling an unbuilt tier.
 * See .agents/memory/sector-command-design.md.
 */
export type SectorEconomyTier =
  /** Tier 1 (built): no production. Every unit is an enemy you captured. */
  | 'stolen'
  /** Tier 2 (reserved): a placeable beacon trickles basic units. */
  | 'beacon'
  /** Tier 3 (reserved): real build queue against a resource. */
  | 'production';

/** What a captured enemy becomes once it is fighting for you. */
export interface SectorUnitDef {
  /** The `EnemyDef` id this unit is captured from. */
  enemyId: string;
  name: string;
  /** Cost against the mission's `squadCap`; elites cost more than swarm units. */
  squadCost: number;
  /** Applied to the captured enemy's stats when it changes sides. */
  hpMult: number;
  damageMult: number;
  speedMult: number;
  /** Capture only becomes available at or below this fraction of max HP. */
  captureHpFraction: number;
  role: 'line' | 'skirmisher' | 'siege' | 'support';
  blurb: string;
}

export type MissionObjectiveKind =
  | 'kill-any'
  | 'kill-enemy'
  | 'survive-sec'
  | 'capture-units'
  | 'hold-marker'
  | 'reach-marker'
  | 'destroy-marker';

export interface MissionObjectiveDef {
  id: string;
  label: string;
  kind: MissionObjectiveKind;
  targetCount: number;
  enemyId?: string;
  /** For marker kinds: the `objective-marker:*` asset id placed on the map. */
  markerAssetId?: string;
  /** Bonus objectives never block completion; they upgrade the mission grade. */
  optional?: boolean;
}

/**
 * A scripted mid-mission beat. Modelled on `DistrictIncursionDef`'s proven
 * phase machine, but a mission may hold several and they can fire off
 * objective progress rather than only elapsed time. `line`/`speakerAllyId`
 * are the seam where authored story (and later, cutscenes) plug in.
 */
export type MissionBeatTrigger =
  | { kind: 'at-sec'; sec: number }
  | { kind: 'objective-complete'; objectiveId: string }
  | { kind: 'squad-wiped' };

export interface MissionBeatDef {
  id: string;
  trigger: MissionBeatTrigger;
  line: string;
  speakerAllyId?: string;
  /** Optional extra pressure the beat drops in when it fires. */
  spawnWave?: WaveDef;
}

export interface SectorMissionDef {
  id: string;
  name: string;
  /** Checked against the `FACTIONS` registry by `sectorMissions.test.ts`. */
  factionId: string;
  /** Must be an ally the player has actually rescued -- the campaign consumes base-game progression. */
  commanderAllyId: string;
  /** Id of an authored map in `data/sectorMaps.ts`. */
  mapId: string;
  economyTier: SectorEconomyTier;
  /**
   * Hides unscouted ground. Presentation and targeting only -- enemy AI is
   * unchanged, so the fog never lies about what the simulation knows.
   */
  fogOfWar?: boolean;
  durationSec: number;
  /** Max total `squadCost` the player may command at once. Keep low for touch. */
  squadCap: number;
  briefing: string;
  debrief: string;
  objectives: MissionObjectiveDef[];
  beats: MissionBeatDef[];
  /** Standard gate (kills/clearArea/etc). Mission-to-mission order uses `requiresMissionIds`. */
  unlock: UnlockRule;
  requiresMissionIds?: string[];
}

/* Reserved for tiers 2-3 -- authored against, not yet consumed by the engine. */
export interface SectorStructureDef {
  id: string;
  name: string;
  description: string;
  /** Seconds between unit trickles. */
  spawnIntervalSec: number;
  /** Enemy id the structure produces. */
  unitEnemyId: string;
  hp: number;
}

export interface SectorResourceDef {
  id: string;
  name: string;
  description: string;
  /** Gained per enemy killed while the tier is active. */
  perKill: number;
}

/** Who a booster card's stat applies to. Character, operatives and crew all feed the played character's stats. */
export type BoosterGroup = 'character' | 'operatives' | 'crew' | 'lokpets' | 'enemies';
export type BoosterStat = 'maxHp' | 'speed' | 'power' | 'area' | 'haste' | 'magnet' | 'armor' | 'lokPetDamage' | 'lokPetHaste' | 'enemyHp';
export interface BoosterCardRecord {
  id: string;
  group: BoosterGroup;
  stat: BoosterStat;
  /** Whole units, 1 or more. What one unit means per stat lives in data/boosterCards.ts. */
  units: number;
  /** The character drawn as a ghosted copy on the card. */
  characterId: string;
  productId: string;
  acquiredAt: number;
}
