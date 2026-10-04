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

  // --- Volt / Electric Moves ---
  'volt-arc': {
    id: 'volt-arc',
    name: 'Volt Arc',
    element: 'volt',
    energyCost: 25,
    power: 1.5,
    kind: 'skill',
    description: 'Discharges high-voltage cyber-lightning that shocks the target.',
    accuracy: 0.95,
    statusEffect: { type: 'shock', duration: 2, value: 12, chance: 0.55 },
    animation: 'lightning',
  },
  'ion-overload': {
    id: 'ion-overload',
    name: 'Ion Overload',
    element: 'volt',
    energyCost: 80,
    power: 3.0,
    kind: 'ultimate',
    description: 'Channels city power grid into a catastrophic thunderclap with heavy shock.',
    accuracy: 0.93,
    statusEffect: { type: 'shock', duration: 3, value: 22, chance: 0.8 },
    animation: 'lightning',
  },

  // --- Glitch / Corrupt Code Moves ---
  'glitch-spike': {
    id: 'glitch-spike',
    name: 'Glitch Spike',
    element: 'glitch',
    energyCost: 25,
    power: 1.55,
    kind: 'skill',
    description: 'Fires corrupted packet shards that destabilize enemy code.',
    accuracy: 0.92,
    statusEffect: { type: 'corrupt', duration: 2, value: 15, chance: 0.5 },
    animation: 'shadow',
  },
  'null-overflow': {
    id: 'null-overflow',
    name: 'Null Overflow',
    element: 'glitch',
    energyCost: 85,
    power: 3.1,
    kind: 'ultimate',
    description: 'Executes a zero-day vulnerability in the foe, draining energy and leeching integrity.',
    accuracy: 0.94,
    statusEffect: { type: 'leech', duration: 3, value: 18, chance: 0.85 },
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

  // --- Solid-Core / Terra Moves ---
  'silicon-shard': {
    id: 'silicon-shard',
    name: 'Silicon Shard',
    element: 'terra',
    energyCost: 25,
    power: 1.5,
    kind: 'skill',
    description: 'Hurls dense semiconductor shards that reinforce defensive plating.',
    accuracy: 0.94,
    statusEffect: { type: 'shield', duration: 2, value: 25, chance: 0.65 },
    animation: 'strike',
  },
  'tectonic-firewall': {
    id: 'tectonic-firewall',
    name: 'Tectonic Firewall',
    element: 'terra',
    energyCost: 35,
    power: 0,
    kind: 'guard',
    description: 'Raises impenetrable granite firewall panels that absorb oncoming blows.',
    accuracy: 1.0,
    statusEffect: { type: 'shield', duration: 3, value: 55, chance: 1.0 },
    animation: 'pulse',
  },
  'terra-monolith-crush': {
    id: 'terra-monolith-crush',
    name: 'Terra Monolith Crush',
    element: 'terra',
    energyCost: 85,
    power: 3.15,
    kind: 'ultimate',
    description: 'Drops a towering solid-state server monolith, crushing and stunning the foe.',
    accuracy: 0.92,
    statusEffect: { type: 'stun', duration: 1, value: 0, chance: 0.75 },
    animation: 'meteor',
  },

  // --- Gale-Packet / Aero Moves ---
  'vector-cutter': {
    id: 'vector-cutter',
    name: 'Vector Cutter',
    element: 'aero',
    energyCost: 25,
    power: 1.55,
    kind: 'skill',
    description: 'Slices through bandwidth barriers with high-speed pressurized air blades.',
    accuracy: 0.96,
    animation: 'claw',
  },
  'sonic-slipstream': {
    id: 'sonic-slipstream',
    name: 'Sonic Slipstream',
    element: 'aero',
    energyCost: 30,
    power: 1.25,
    kind: 'skill',
    description: 'Surfs high-frequency packet drafts, granting an agility empower buff.',
    accuracy: 0.95,
    statusEffect: { type: 'empower', duration: 3, value: 20, chance: 0.8 },
    animation: 'pulse',
  },
  'aero-tempest-dive': {
    id: 'aero-tempest-dive',
    name: 'Supersonic Tempest',
    element: 'aero',
    energyCost: 85,
    power: 3.2,
    kind: 'ultimate',
    description: 'Breaks Mach 5 in a vortex dive that slices through target defenses.',
    accuracy: 0.95,
    statusEffect: { type: 'empower', duration: 3, value: 25, chance: 0.9 },
    animation: 'beam',
  },

  // --- Photon-Array / Light Moves ---
  'photon-beam': {
    id: 'photon-beam',
    name: 'Photon Beam',
    element: 'light',
    energyCost: 25,
    power: 1.55,
    kind: 'skill',
    description: 'Focuses coherent laser light through optical prism lenses.',
    accuracy: 0.95,
    animation: 'beam',
  },
  'radiant-refract': {
    id: 'radiant-refract',
    name: 'Radiant Refraction',
    element: 'light',
    energyCost: 35,
    power: 0,
    kind: 'skill',
    description: 'Splits radiant frequencies to restore 35% HP and erect hardlight shielding.',
    accuracy: 1.0,
    statusEffect: { type: 'shield', duration: 2, value: 30, chance: 1.0 },
    animation: 'heal',
  },
  'prism-supernova': {
    id: 'prism-supernova',
    name: 'Prism Supernova',
    element: 'light',
    energyCost: 85,
    power: 3.25,
    kind: 'ultimate',
    description: 'Blinds the arena in a brilliant solar burst, heavily burning the target.',
    accuracy: 0.95,
    statusEffect: { type: 'burn', duration: 4, value: 16, chance: 0.85 },
    animation: 'meteor',
  },

  // --- Void-Sector / Dark Moves ---
  'void-entropy': {
    id: 'void-entropy',
    name: 'Void Entropy',
    element: 'dark',
    energyCost: 25,
    power: 1.5,
    kind: 'skill',
    description: 'Opens a micro-tear in space that drains opponent vitality.',
    accuracy: 0.93,
    statusEffect: { type: 'leech', duration: 2, value: 14, chance: 0.65 },
    animation: 'shadow',
  },
  'singularity-drain': {
    id: 'singularity-drain',
    name: 'Singularity Drain',
    element: 'dark',
    energyCost: 40,
    power: 1.3,
    kind: 'skill',
    description: 'Siphons life essence through a localized black hole gravitational well.',
    accuracy: 0.95,
    statusEffect: { type: 'leech', duration: 3, value: 18, chance: 0.85 },
    animation: 'shadow',
  },
  'dark-singularity-rift': {
    id: 'dark-singularity-rift',
    name: 'Event Horizon Rift',
    element: 'dark',
    energyCost: 85,
    power: 3.2,
    kind: 'ultimate',
    description: 'Collapses reality into an all-consuming singularity that corrupts and leeches.',
    accuracy: 0.92,
    statusEffect: { type: 'corrupt', duration: 3, value: 20, chance: 0.9 },
    animation: 'shadow',
  },

  // --- Intermediate & Advanced Level-Up Skills ---
  'pyro-burst': {
    id: 'pyro-burst',
    name: 'Pyro Cluster Bomb',
    element: 'fire',
    energyCost: 35,
    power: 1.75,
    kind: 'skill',
    description: 'Detonates cluster thermal warheads that scorch the opponent.',
    accuracy: 0.92,
    statusEffect: { type: 'burn', duration: 3, value: 12, chance: 0.6 },
    animation: 'burst',
  },
  'frost-lock': {
    id: 'frost-lock',
    name: 'Cryo Subzero Surge',
    element: 'freeze',
    energyCost: 35,
    power: 1.7,
    kind: 'skill',
    description: 'Encases the enemy in diamond frostbite ice crystals.',
    accuracy: 0.93,
    statusEffect: { type: 'freeze', duration: 2, value: 14, chance: 0.55 },
    animation: 'beam',
  },
  'volt-overdrive': {
    id: 'volt-overdrive',
    name: 'Volt Overdrive',
    element: 'volt',
    energyCost: 35,
    power: 1.8,
    kind: 'skill',
    description: 'Pumps lethal megawatt current into target circuits.',
    accuracy: 0.94,
    statusEffect: { type: 'shock', duration: 3, value: 16, chance: 0.7 },
    animation: 'lightning',
  },
  'zero-day-worm': {
    id: 'zero-day-worm',
    name: 'Zero-Day Glitch Worm',
    element: 'glitch',
    energyCost: 35,
    power: 1.85,
    kind: 'skill',
    description: 'Injects predatory malware into enemy routines, corrupting integrity.',
    accuracy: 0.92,
    statusEffect: { type: 'corrupt', duration: 3, value: 18, chance: 0.7 },
    animation: 'shadow',
  },
  'chrono-stasis': {
    id: 'chrono-stasis',
    name: 'Chrono Stasis Field',
    element: 'slow',
    energyCost: 35,
    power: 1.65,
    kind: 'skill',
    description: 'Anchors target local timeline into near-absolute freeze.',
    accuracy: 0.95,
    statusEffect: { type: 'slow', duration: 3, value: 20, chance: 0.8 },
    animation: 'pulse',
  },

  // --- Signature New Variant Ultimates ---
  'granite-avalanche': {
    id: 'granite-avalanche',
    name: 'Silicon Rampart Avalanche',
    element: 'terra',
    energyCost: 85,
    power: 3.2,
    kind: 'ultimate',
    description: 'Unleashes an avalanche of silicon boulders backed by hard stone barriers.',
    accuracy: 0.93,
    statusEffect: { type: 'shield', duration: 3, value: 40, chance: 0.9 },
    animation: 'meteor',
  },
  'aero-razor-storm': {
    id: 'aero-razor-storm',
    name: 'Vector Talon Razor Storm',
    element: 'aero',
    energyCost: 85,
    power: 3.25,
    kind: 'ultimate',
    description: 'Dozens of sonic wind scythes shred through target defenses.',
    accuracy: 0.96,
    animation: 'claw',
  },
  'optics-purification': {
    id: 'optics-purification',
    name: 'Luminescent Fiber Burst',
    element: 'light',
    energyCost: 85,
    power: 3.15,
    kind: 'ultimate',
    description: 'Blasts blinding optical photons that heal self and burn target code.',
    accuracy: 0.95,
    statusEffect: { type: 'burn', duration: 3, value: 15, chance: 0.85 },
    animation: 'beam',
  },
  'singularity-collapse': {
    id: 'singularity-collapse',
    name: 'Event Horizon Implosion',
    element: 'dark',
    energyCost: 85,
    power: 3.3,
    kind: 'ultimate',
    description: 'Crushes space-time into a vortex, stealing immense life integrity.',
    accuracy: 0.92,
    statusEffect: { type: 'leech', duration: 3, value: 22, chance: 0.9 },
    animation: 'shadow',
  },
  'firewall-fortress': {
    id: 'firewall-fortress',
    name: 'Armored Firewall Nova',
    element: 'terra',
    energyCost: 85,
    power: 3.1,
    kind: 'ultimate',
    description: 'Rolls into a diamond shell and erupts into a protective shockwave.',
    accuracy: 0.95,
    statusEffect: { type: 'shield', duration: 3, value: 50, chance: 1.0 },
    animation: 'pulse',
  },
  'sonic-hyperdrive': {
    id: 'sonic-hyperdrive',
    name: 'Ion Hyperdrive Thunder',
    element: 'aero',
    energyCost: 85,
    power: 3.2,
    kind: 'ultimate',
    description: 'Blasts supersonic jet streams crackling with ion static.',
    accuracy: 0.95,
    statusEffect: { type: 'stun', duration: 1, value: 0, chance: 0.65 },
    animation: 'lightning',
  },
  'matrix-overload-breath': {
    id: 'matrix-overload-breath',
    name: 'Quantum Matrix Breath',
    element: 'glitch',
    energyCost: 90,
    power: 3.35,
    kind: 'ultimate',
    description: 'Breathes uncompiled quantum code that destabilizes the foe completely.',
    accuracy: 0.93,
    statusEffect: { type: 'corrupt', duration: 3, value: 24, chance: 0.9 },
    animation: 'shadow',
  },
  'pack-hunting-frenzy': {
    id: 'pack-hunting-frenzy',
    name: 'Alpha Cyber-Pack Strike',
    element: 'freeze',
    energyCost: 85,
    power: 3.15,
    kind: 'ultimate',
    description: 'Calls upon the pack code to execute a synchronized tearing bite.',
    accuracy: 0.96,
    statusEffect: { type: 'freeze', duration: 2, value: 16, chance: 0.8 },
    animation: 'claw',
  },

  // --- Synthetic Data-Pet Archetype Moves (Mites, Sloths, Frogs, Birds) ---
  'mite-swarm-shield': {
    id: 'mite-swarm-shield',
    name: 'Byte-Mite Cache Wall',
    element: 'glitch',
    energyCost: 35,
    power: 0,
    kind: 'guard',
    description: 'Compacts thousands of micro dust-mites into a dense kinetic barricade that reflects incoming damage.',
    accuracy: 1.0,
    statusEffect: { type: 'shield', duration: 3, value: 50, chance: 1.0 },
    animation: 'pulse',
  },
  'byte-mite-avalanche': {
    id: 'byte-mite-avalanche',
    name: 'Swarm Byte-Mite Stampede',
    element: 'glitch',
    energyCost: 85,
    power: 3.25,
    kind: 'ultimate',
    description: 'Releases a voracious digital swarm of hungry bytecode mites that gnaw away target shields and hp.',
    accuracy: 0.95,
    statusEffect: { type: 'leech', duration: 3, value: 20, chance: 0.85 },
    animation: 'burst',
  },
  'sloth-dilation-wave': {
    id: 'sloth-dilation-wave',
    name: 'Chrono-Sloth Lag Field',
    element: 'slow',
    energyCost: 35,
    power: 1.35,
    kind: 'skill',
    description: 'Projects suspended-animation packet lag, drastically reducing target reaction speed and haste.',
    accuracy: 0.96,
    statusEffect: { type: 'slow', duration: 3, value: 25, chance: 0.85 },
    animation: 'pulse',
  },
  'absolute-lag-stasis': {
    id: 'absolute-lag-stasis',
    name: 'Zero-Clock Sloth Stasis',
    element: 'slow',
    energyCost: 85,
    power: 3.1,
    kind: 'ultimate',
    description: 'Freezes local memory bus cycles, leaving the opponent completely paralyzed in stasis.',
    accuracy: 0.94,
    statusEffect: { type: 'stun', duration: 1, value: 0, chance: 0.75 },
    animation: 'shadow',
  },
  'concussive-croak': {
    id: 'concussive-croak',
    name: 'Conductive Electric Croak',
    element: 'volt',
    energyCost: 30,
    power: 1.55,
    kind: 'skill',
    description: 'Gold-plated throat coils discharge an expanding acoustic spark that shocks the foe.',
    accuracy: 0.95,
    statusEffect: { type: 'stun', duration: 1, value: 0, chance: 0.35 },
    animation: 'lightning',
  },
  'seismic-bass-shockwave': {
    id: 'seismic-bass-shockwave',
    name: 'Sub-Woofer Bass Rupture',
    element: 'volt',
    energyCost: 85,
    power: 3.2,
    kind: 'ultimate',
    description: 'Throat sac amplifies a devastating low-frequency sonic shockwave that crushes arena ground.',
    accuracy: 0.95,
    statusEffect: { type: 'empower', duration: 3, value: 25, chance: 0.9 },
    animation: 'burst',
  },
  'dive-talon-strike': {
    id: 'dive-talon-strike',
    name: 'Mach-Vector Talon Dive',
    element: 'aero',
    energyCost: 30,
    power: 1.65,
    kind: 'skill',
    description: 'Sharp hardlight bird talons dive from digital thermals with pinpoint accuracy.',
    accuracy: 0.98,
    animation: 'claw',
  },
  'mach-vector-cyclone': {
    id: 'mach-vector-cyclone',
    name: 'Aero-Vector Falcon Cyclone',
    element: 'aero',
    energyCost: 85,
    power: 3.3,
    kind: 'ultimate',
    description: 'Carves high-speed geometric vector rings around the opponent before striking with lethal velocity.',
    accuracy: 0.96,
    statusEffect: { type: 'empower', duration: 3, value: 30, chance: 0.95 },
    animation: 'beam',
  },
};

/** Elemental weakness / resistance matrix (Attacker -> Defender) with full digital affinities */
export function getElementalMultiplier(attackElement: LokPetElement, defenderElement: LokPetElement): { multiplier: number; label?: string } {
  if (attackElement === 'none' || defenderElement === 'none') {
    return { multiplier: 1.0 };
  }
  // Super effective pairings (1.75x)
  // Fire melts Freeze & crushes Terra
  if (attackElement === 'fire' && (defenderElement === 'freeze' || defenderElement === 'terra')) {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }
  // Freeze chills Chrono/Slow & freezes Aero vectors
  if (attackElement === 'freeze' && (defenderElement === 'slow' || defenderElement === 'aero')) {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }
  // Slow dilutes Fire & dampens Volt current
  if (attackElement === 'slow' && (defenderElement === 'fire' || defenderElement === 'volt')) {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }
  // Volt short-circuits Freeze & grounds Aero draft
  if (attackElement === 'volt' && (defenderElement === 'freeze' || defenderElement === 'aero')) {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }
  // Glitch corrupts Volt systems & blinds Light fiber
  if (attackElement === 'glitch' && (defenderElement === 'volt' || defenderElement === 'light')) {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }
  // Terra grounds Volt current & crushes Glitch data servers
  if (attackElement === 'terra' && (defenderElement === 'volt' || defenderElement === 'glitch')) {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }
  // Aero weathers Terra stone & disperses Chrono lag
  if (attackElement === 'aero' && (defenderElement === 'terra' || defenderElement === 'slow')) {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }
  // Light purifies Glitch errors & cleanses Dark voids
  if (attackElement === 'light' && (defenderElement === 'glitch' || defenderElement === 'dark')) {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }
  // Dark swallows Light photons
  if (attackElement === 'dark' && defenderElement === 'light') {
    return { multiplier: 1.75, label: 'SUPER EFFECTIVE!' };
  }

  // Resistances (0.65x)
  if (attackElement === 'fire' && (defenderElement === 'slow' || defenderElement === 'aero' || defenderElement === 'dark')) {
    return { multiplier: 0.65, label: 'Resisted...' };
  }
  if (attackElement === 'freeze' && (defenderElement === 'fire' || defenderElement === 'terra')) {
    return { multiplier: 0.65, label: 'Resisted...' };
  }
  if (attackElement === 'slow' && (defenderElement === 'freeze' || defenderElement === 'aero')) {
    return { multiplier: 0.65, label: 'Resisted...' };
  }
  if (attackElement === 'volt' && (defenderElement === 'terra' || defenderElement === 'slow' || defenderElement === 'volt')) {
    return { multiplier: 0.65, label: 'Resisted...' };
  }
  if (attackElement === 'glitch' && (defenderElement === 'terra' || defenderElement === 'dark' || defenderElement === 'glitch')) {
    return { multiplier: 0.65, label: 'Resisted...' };
  }
  if (attackElement === 'terra' && (defenderElement === 'aero' || defenderElement === 'fire')) {
    return { multiplier: 0.65, label: 'Resisted...' };
  }
  if (attackElement === 'aero' && (defenderElement === 'volt' || defenderElement === 'freeze')) {
    return { multiplier: 0.65, label: 'Resisted...' };
  }
  if (attackElement === 'light' && (defenderElement === 'glitch' || defenderElement === 'terra')) {
    return { multiplier: 0.65, label: 'Resisted...' };
  }
  if (attackElement === 'dark' && (defenderElement === 'glitch' || defenderElement === 'light')) {
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
    id: 'tier-5-silicon',
    tierNumber: 5,
    title: 'Silicon Monolith Bastion',
    trainerName: 'Krag "The Mason"',
    trainerTitle: 'Solid-State Architect',
    flavorQuote: 'Hardened silicon and impenetrable firewalls. You will break your claws against my monoliths!',
    trainerPalette: { body: '#78716c', accent: '#ca8a04' },
    team: [
      { variantId: 'cyber-pangolin', name: 'Aegis-Curl', level: 30 },
      { variantId: 'terra-gargoyle', name: 'Gargantua', level: 32 },
    ],
    rewards: {
      cred: 1800,
      cardCredits: 280,
      treats: 6,
      badgeId: 'badge-silicon-core',
      badgeName: 'Solid-Core Silicon Badge',
    },
  },
  {
    id: 'tier-6-aerodrome',
    tierNumber: 6,
    title: 'Sky-Vector Aerodrome',
    trainerName: 'Captain Zephyr',
    trainerTitle: 'Rooftop Gale-Rider',
    flavorQuote: 'Up in the high-frequency drafts, ground tactics mean nothing. Try keeping pace with the tempest!',
    trainerPalette: { body: '#0d9488', accent: '#2dd4bf' },
    team: [
      { variantId: 'aero-raptor', name: 'Mach-Viper', level: 34 },
      { variantId: 'ion-pegasus', name: 'Thunder-Strider', level: 36 },
      { variantId: 'storm-griffin', name: 'Sky-Sovereign', level: 38 },
    ],
    rewards: {
      cred: 2400,
      cardCredits: 360,
      treats: 7,
      badgeId: 'badge-gale-vector',
      badgeName: 'Gale-Vector Wing Badge',
    },
  },
  {
    id: 'tier-7-nullvoid',
    tierNumber: 7,
    title: 'Corrupted Undergrid',
    trainerName: 'Hacker Cipher-Zero',
    trainerTitle: 'Null-Sector Anomaly',
    flavorQuote: 'Your clean code is about to meet predatory matrix decay. 0xDEADBEEF awaits.',
    trainerPalette: { body: '#831843', accent: '#ec4899' },
    team: [
      { variantId: 'null-abyss', name: 'EventHorizon', level: 40 },
      { variantId: 'glitch-dragon', name: 'MatrixTerror', level: 42 },
      { variantId: 'byte-serpent', name: 'ZeroDay', level: 44 },
    ],
    rewards: {
      cred: 3200,
      cardCredits: 480,
      treats: 8,
      badgeId: 'badge-null-glitch',
      badgeName: 'Null-Glitch Singularity Badge',
    },
  },
  {
    id: 'tier-8-apex',
    tierNumber: 8,
    title: 'Apex Grand Championship',
    trainerName: 'Grandmaster Orion',
    trainerTitle: 'Master of the 616 Sanctum',
    flavorQuote: 'You have conquered the streets and mastered every digital element. Now witness true Omega synergy!',
    trainerPalette: { body: '#1e1b4b', accent: '#facc15' },
    team: [
      { variantId: 'photon-lynx', name: 'Radiant-Prism', level: 45 },
      { variantId: 'cyber-hydra', name: 'Trident-3', level: 48 },
      { variantId: 'titan-colossus', name: 'Aegis-One', level: 50 },
    ],
    rewards: {
      cred: 4500,
      cardCredits: 750,
      treats: 12,
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
    id: 'dummy-terra',
    name: 'Silicon Terra Bastion',
    variantId: 'terra-gargoyle',
    level: 30,
    description: 'Solid-Core Terra dummy with heavy stone armor and earthquake shockwaves.',
  },
  {
    id: 'dummy-aero',
    name: 'Sonic Aero Raptor',
    variantId: 'aero-raptor',
    level: 35,
    description: 'High speed and evasion. Test accuracy and quick strike counters.',
  },
  {
    id: 'dummy-boss',
    name: 'Overclocked Glitch Dragon',
    variantId: 'glitch-dragon',
    level: 45,
    description: 'Supreme challenge dummy with maximum stats and lethal matrix glitch breath.',
  },
  {
    id: 'dummy-dust-mite',
    name: "Barnaby's Dust Mite Cadet",
    variantId: 'byte-dust-mite',
    level: 20,
    description: 'A nimble, high-speed bytecode swarm sparring dummy trained by the Rancher.',
  },
  {
    id: 'dummy-data-sloth',
    name: 'Chrono-Sloth Lag Dummy',
    variantId: 'chrono-sloth',
    level: 28,
    description: 'Generates intense time-dilation lag fields. Test your patience and timing against heavy armor.',
  },
];
