import type {
  LeagueTierDef,
  LokPetBattleMove,
  LokPetTrinketDef,
} from '@/game/engine/lokPetBattleTypes';
import type { LokPetElement } from '@/game/types';

/** Standard & ultimate moves available to LokPets in turn-based arena battles. */
export const BATTLE_MOVES: Record<string, LokPetBattleMove> = {
  // --- Universal Basic Strikes (0 SP, build 15 SP) ---
  'tackle': {
    id: 'tackle',
    name: 'Tackle',
    element: 'none',
    energyCost: 0,
    power: 1.0,
    kind: 'strike',
    description: 'A swift physical charge into the opponent.',
    accuracy: 0.98,
    animation: 'strike',
  },
  'quick-claw': {
    id: 'quick-claw',
    name: 'Quick Claw',
    element: 'none',
    energyCost: 0,
    power: 1.15,
    kind: 'strike',
    description: 'Fast slash with heightened critical chance.',
    accuracy: 0.95,
    animation: 'claw',
  },

  // --- Fire Moves ---
  'ember-spit': {
    id: 'ember-spit',
    name: 'Ember Spit',
    element: 'fire',
    energyCost: 25,
    power: 1.5,
    kind: 'skill',
    description: 'Spits a cluster of hot embers that may burn.',
    accuracy: 0.92,
    statusEffect: { type: 'burn', duration: 3, value: 8, chance: 0.45 },
    animation: 'burst',
  },
  'inferno-pillar': {
    id: 'inferno-pillar',
    name: 'Inferno Pillar',
    element: 'fire',
    energyCost: 80,
    power: 2.8,
    kind: 'ultimate',
    description: 'Summons an erupting column of searing fire, heavily burning the target.',
    accuracy: 0.95,
    statusEffect: { type: 'burn', duration: 4, value: 14, chance: 0.85 },
    animation: 'meteor',
  },

  // --- Freeze / Frost Moves ---
  'frost-shard': {
    id: 'frost-shard',
    name: 'Frost Shard',
    element: 'freeze',
    energyCost: 25,
    power: 1.45,
    kind: 'skill',
    description: 'Hurls razor ice icicles that chill and slow the target.',
    accuracy: 0.94,
    statusEffect: { type: 'freeze', duration: 2, value: 10, chance: 0.4 },
    animation: 'beam',
  },
  'blizzard-burst': {
    id: 'blizzard-burst',
    name: 'Absolute Zero',
    element: 'freeze',
    energyCost: 80,
    power: 2.7,
    kind: 'ultimate',
    description: 'Flash-freezes the arena, inflicting deep frostbite and temporary stun.',
    accuracy: 0.95,
    statusEffect: { type: 'stun', duration: 1, value: 0, chance: 0.65 },
    animation: 'burst',
  },

  // --- Slow / Chrono Moves ---
  'chrono-dampener': {
    id: 'chrono-dampener',
    name: 'Chrono Pulse',
    element: 'slow',
    energyCost: 25,
    power: 1.4,
    kind: 'skill',
    description: 'Distorts target flow of time, reducing their speed and defense.',
    accuracy: 0.95,
    statusEffect: { type: 'slow', duration: 3, value: 15, chance: 0.75 },
    animation: 'pulse',
  },
  'time-dilation': {
    id: 'time-dilation',
    name: 'Temporal Collapse',
    element: 'slow',
    energyCost: 85,
    power: 2.9,
    kind: 'ultimate',
    description: 'Rips apart the timeline around the opponent, dealing massive delayed damage.',
    accuracy: 0.92,
    statusEffect: { type: 'slow', duration: 4, value: 25, chance: 0.9 },
    animation: 'shadow',
  },

  // --- Kinetic / Neutral Special Moves ---
  'kinetic-cannon': {
    id: 'kinetic-cannon',
    name: 'Kinetic Cannon',
    element: 'none',
    energyCost: 30,
    power: 1.6,
    kind: 'skill',
    description: 'Compresses air into a concussive shockwave.',
    accuracy: 0.95,
    animation: 'blast',
  },
  'hyper-beam': {
    id: 'hyper-beam',
    name: 'Hyper Nova Beam',
    element: 'none',
    energyCost: 90,
    power: 3.1,
    kind: 'ultimate',
    description: 'Fires an apocalyptic prismatic laser straight through defenses.',
    accuracy: 0.90,
    animation: 'beam',
  },

  // --- Defensive / Support Moves ---
  'barrier-shield': {
    id: 'barrier-shield',
    name: 'Prism Barrier',
    element: 'none',
    energyCost: 35,
    power: 0,
    kind: 'guard',
    description: 'Deploys a hard-light reflective dome that absorbs incoming blows.',
    accuracy: 1.0,
    statusEffect: { type: 'shield', duration: 2, value: 45, chance: 1.0 },
    animation: 'pulse',
  },
  'starlight-remedy': {
    id: 'starlight-remedy',
    name: 'Starlight Dew',
    element: 'none',
    energyCost: 40,
    power: 0,
    kind: 'skill',
    description: 'Bathes in gentle stellar mist, healing 40% of max HP and cleansing ailments.',
    accuracy: 1.0,
    animation: 'heal',
  },

  // --- Unique Legendary Signature Moves ---
  'tri-laser-salvo': {
    id: 'tri-laser-salvo',
    name: 'Tri-Laser Salvo',
    element: 'none',
    energyCost: 85,
    power: 3.3,
    kind: 'ultimate',
    description: 'Locks on with all three cybernetic heads to unleash an inescapable grid of death.',
    accuracy: 0.98,
    animation: 'beam',
  },
  'plasma-foxfire': {
    id: 'plasma-foxfire',
    name: 'Dancing Foxfire',
    element: 'fire',
    energyCost: 85,
    power: 3.0,
    kind: 'ultimate',
    description: 'Sends nine swirling blue-hot orbs spinning into the enemy flank.',
    accuracy: 0.95,
    statusEffect: { type: 'burn', duration: 4, value: 18, chance: 1.0 },
    animation: 'burst',
  },
  'nanite-rebirth': {
    id: 'nanite-rebirth',
    name: 'Nanite Cataclysm',
    element: 'fire',
    energyCost: 90,
    power: 3.2,
    kind: 'ultimate',
    description: 'Detonates a microscopic fission explosion and restores self HP.',
    accuracy: 0.92,
    animation: 'meteor',
  },
  'seismic-fissure': {
    id: 'seismic-fissure',
    name: 'Tectonic Rift',
    element: 'none',
    energyCost: 85,
    power: 3.2,
    kind: 'ultimate',
    description: 'Slams titanium fists to shatter bedrock and stun the foe.',
    accuracy: 0.90,
    statusEffect: { type: 'stun', duration: 1, value: 0, chance: 0.7 },
    animation: 'meteor',
  },
  'glitch-byte-decay': {
    id: 'glitch-byte-decay',
    name: 'Null-Pointer Nullifier',
    element: 'freeze',
    energyCost: 80,
    power: 2.85,
    kind: 'ultimate',
    description: 'Corrupts the opponent bytecode, inflicting frostbite and leeching health.',
    accuracy: 0.94,
    statusEffect: { type: 'leech', duration: 3, value: 12, chance: 0.9 },
    animation: 'shadow',
  },
  'thunder-dive': {
    id: 'thunder-dive',
    name: 'Tempest Dive',
    element: 'none',
    energyCost: 85,
    power: 3.1,
    kind: 'ultimate',
    description: 'Hurls down from the ionosphere wrapped in crackling lightning.',
    accuracy: 0.95,
    statusEffect: { type: 'stun', duration: 1, value: 0, chance: 0.5 },
    animation: 'lightning',
  },
};

/** Elemental weakness / resistance matrix (Attacker -> Defender) */
export function getElementalMultiplier(attackElement: LokPetElement, defenderElement: LokPetElement): { multiplier: number; label?: string } {
  if (attackElement === 'none' || defenderElement === 'none') {
    return { multiplier: 1.0 };
  }
  // Fire melts freeze
  if (attackElement === 'fire' && defenderElement === 'freeze') {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }
  // Freeze chills slow / chrono
  if (attackElement === 'freeze' && defenderElement === 'slow') {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }
  // Slow dilutes fire
  if (attackElement === 'slow' && defenderElement === 'fire') {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }

  // Resistances
  if (attackElement === 'freeze' && defenderElement === 'fire') {
    return { multiplier: 0.65, label: 'Resisted...' };
  }
  if (attackElement === 'slow' && defenderElement === 'freeze') {
    return { multiplier: 0.65, label: 'Resisted...' };
  }
  if (attackElement === 'fire' && defenderElement === 'slow') {
    return { multiplier: 0.65, label: 'Resisted...' };
  }

  return { multiplier: 1.0 };
}

/** Trinkets that can be equipped onto pets in the kennel / arena preparation. */
export const BATTLE_TRINKETS: LokPetTrinketDef[] = [
  {
    id: 'trinket-brass-spurs',
    name: 'Alloy Spurs',
    icon: '⚡',
    description: '+15 Speed, +5% Crit Rate. Lets your companion strike first more reliably.',
    statBonus: { speed: 15, critRate: 0.05 },
  },
  {
    id: 'trinket-amber-prism',
    name: 'Amber Prism',
    icon: '💎',
    description: '+25 Max HP, starts battle with 25 initial Energy.',
    statBonus: { hp: 25, initialEnergy: 25 },
  },
  {
    id: 'trinket-spiked-collar',
    name: 'Spiked Collar',
    icon: '⚔️',
    description: '+18 Attack Power, boosting all standard and elemental strikes.',
    statBonus: { attack: 18 },
  },
  {
    id: 'trinket-nanite-shield',
    name: 'Nanite Aegis',
    icon: '🛡️',
    description: '+16 Defense, reducing incoming damage from all physical and special strikes.',
    statBonus: { defense: 16 },
  },
  {
    id: 'trinket-overclock-chip',
    name: 'Overclock Core',
    icon: '🔋',
    description: '+12 Attack, +10 Speed, starts with 40 initial Energy for quick ultimates.',
    statBonus: { attack: 12, speed: 10, initialEnergy: 40 },
  },
];

/**
 * 5 Authored Sanctum LokPet League Tiers.
 * Each has dedicated syndicate trainers, dialogue, varied teams, and rich rewards!
 */
export const LEAGUE_TIERS: LeagueTierDef[] = [
  {
    id: 'tier-1-copper',
    tierNumber: 1,
    title: 'Copper Circuit',
    trainerName: 'Jax "Scraps"',
    trainerTitle: 'Back-Alley Tinkerer',
    flavorQuote: 'Think your little alley runner has teeth? Let’s see how it handles my clockwork swarm!',
    trainerPalette: { body: '#78716c', accent: '#f59e0b' },
    team: [
      { variantId: 'tin-cricket', name: 'Rattler', level: 5 },
      { variantId: 'rain-jelly', name: 'Puddle', level: 6 },
    ],
    rewards: {
      cred: 250,
      cardCredits: 40,
      treats: 2,
      badgeId: 'badge-copper-sprocket',
      badgeName: 'Copper Sprocket Badge',
    },
  },
  {
    id: 'tier-2-neon',
    tierNumber: 2,
    title: 'Neon Underground',
    trainerName: 'Lyra Flash',
    trainerTitle: 'Night-Shift Courier',
    flavorQuote: 'Speed is everything on Michigan Street after midnight. Blink and you miss the knockout!',
    trainerPalette: { body: '#0284c7', accent: '#38bdf8' },
    team: [
      { variantId: 'volt-wing', name: 'Zapper', level: 10 },
      { variantId: 'glitch-fox', name: 'FrameDrop', level: 12 },
    ],
    rewards: {
      cred: 500,
      cardCredits: 80,
      treats: 3,
      badgeId: 'badge-neon-arc',
      badgeName: 'Neon Arc Badge',
    },
  },
  {
    id: 'tier-3-specter',
    tierNumber: 3,
    title: 'Hollow Sanctum',
    trainerName: 'Morton Graves',
    trainerTitle: 'Cemetery Watcher',
    flavorQuote: 'The spectral chill out here silences even the rowdiest companions. Prepare yourself.',
    trainerPalette: { body: '#581c87', accent: '#a855f7' },
    team: [
      { variantId: 'echo-skull', name: 'Resonance', level: 16 },
      { variantId: 'shadow-mantis', name: 'Sever', level: 18 },
      { variantId: 'void-pup', name: 'Eclipse', level: 19 },
    ],
    rewards: {
      cred: 900,
      cardCredits: 140,
      treats: 4,
      badgeId: 'badge-shadow-crest',
      badgeName: 'Shadow Crest Badge',
    },
  },
  {
    id: 'tier-4-infernal',
    tierNumber: 4,
    title: 'Forge Crucible',
    trainerName: 'Vera Ember',
    trainerTitle: 'Industrial Smelter Master',
    flavorQuote: 'Can your team survive the foundry heat? We temper champions into steel!',
    trainerPalette: { body: '#991b1b', accent: '#f97316' },
    team: [
      { variantId: 'cinder-pouncer', name: 'Blaze', level: 24 },
      { variantId: 'ember-koi', name: 'Pyre', level: 26 },
      { variantId: 'plasma-kitsune', name: 'NineSparks', level: 28 },
    ],
    rewards: {
      cred: 1500,
      cardCredits: 220,
      treats: 5,
      badgeId: 'badge-forge-flame',
      badgeName: 'Foundry Ember Badge',
    },
  },
  {
    id: 'tier-5-apex',
    tierNumber: 5,
    title: 'Apex Grand Championship',
    trainerName: 'Grandmaster Orion',
    trainerTitle: 'Master of the 616 Sanctum',
    flavorQuote: 'You have conquered the streets. Now witness the pinnacle of LokPet synergy and power!',
    trainerPalette: { body: '#1e1b4b', accent: '#facc15' },
    team: [
      { variantId: 'solar-owl', name: 'Daybreak', level: 32 },
      { variantId: 'cyber-hydra', name: 'Trident-3', level: 35 },
      { variantId: 'titan-colossus', name: 'Aegis-One', level: 38 },
    ],
    rewards: {
      cred: 3000,
      cardCredits: 500,
      treats: 8,
      badgeId: 'badge-sanctum-champion',
      badgeName: 'Grandmaster Apex Star',
    },
  },
];

/** Sparring Dummy presets for the Lit Corner Test Dojo */
export const SPARRING_DUMMIES = [
  {
    id: 'dummy-wood',
    name: 'Training Wood Dummy',
    variantId: 'gyro-sentry',
    level: 5,
    description: 'Low-defense target dummy. Great for checking basic damage and combo sequences.',
  },
  {
    id: 'dummy-steel',
    name: 'Armored Steel Drone',
    variantId: 'titan-colossus',
    level: 15,
    description: 'High defense and HP. Test whether your special moves can punch through armor.',
  },
  {
    id: 'dummy-elemental',
    name: 'Elemental Chimera',
    variantId: 'plasma-kitsune',
    level: 25,
    description: 'Active combatant with burning and freezing attacks. Test counter-element tactics.',
  },
  {
    id: 'dummy-boss',
    name: 'Overclocked Cyber Hydra',
    variantId: 'cyber-hydra',
    level: 40,
    description: 'Supreme challenge dummy with maximum stats and lethal laser ultimates.',
  },
];
