import type {
  LokPetAttackKind,
  LokPetElement,
  LokPetPalette,
  LokPetRoll,
  LokPetRarity,
  LokPetSilhouette,
  LokPetStatSheet,
  LokPetVariantDef,
  SpritePalette,
  SpriteRig,
} from '@/game/types';
import { arachnidRig, blobRig, quadrupedRig, serpentRig } from '@/game/sprites/rigs';

/** Original silhouette and palette sheets for the temporary LokPet family. */
export const LOKPET_VARIANTS: LokPetVariantDef[] = [
  { id: 'lil-llama', name: 'Lil Llamà', family: 'animal', silhouette: 'pouncer', palette: { body: '#f4ead8', bodyDark: '#493d49', accent: '#ff7ab8', glow: '#67e8f9', eye: '#1f2937' }, description: 'A tiny, fearless llama whose charm can turn a rush of enemies into a heart-eyed escort.', sizeScale: 0.78, legendary: true, starter: true, specialAbility: 'cutify-getaway', weight: 0 },
  { id: 'static-null', name: 'Static Null', family: 'mote', silhouette: 'spark', palette: { body: '#1a1630', bodyDark: '#05030b', accent: '#8b5cf6', glow: '#22d3ee', eye: '#f5f3ff' }, description: 'A friendly-looking data mote that grows by eating hostile code—and quietly takes a little from its partner.', sizeScale: 0.7, legendary: true, starter: true, specialAbility: 'null-consume', weight: 0 },
  { id: 'lil-buzbee', name: 'Lil Buzbèè', family: 'bat', silhouette: 'winglet', palette: { body: '#facc15', bodyDark: '#3f2a05', accent: '#fff7a8', glow: '#f59e0b', eye: '#111827' }, description: 'The runt of the hive: a high-energy scout that gathers drops and leaves restorative speed pollen.', sizeScale: 0.64, legendary: true, starter: true, specialAbility: 'buzbee-pollen', weight: 0 },
  { id: 'moss-pouncer', name: 'Moss Pouncer', family: 'animal', silhouette: 'pouncer', palette: { body: '#54734c', bodyDark: '#26392c', accent: '#b8ff5c', glow: '#7dffb2', eye: '#fff1a8' }, description: 'A spring-loaded alley creature with leaf-bright eyes.' },
  { id: 'cinder-pouncer', name: 'Cinder Pouncer', family: 'animal', silhouette: 'pouncer', palette: { body: '#a94f45', bodyDark: '#42252c', accent: '#ffb86b', glow: '#ff6b35', eye: '#ffe08a' }, description: 'A warm little runner that smells faintly of rain and sparks.' },
  { id: 'chalk-grin', name: 'Chalk Grin', family: 'ghoul', silhouette: 'skull', palette: { body: '#b9c2b0', bodyDark: '#394348', accent: '#d6a8ff', glow: '#a78bfa', eye: '#fef3c7' }, description: 'A tiny graveyard grin with a soft spot for loud noises.' },
  { id: 'violet-husk', name: 'Violet Husk', family: 'ghoul', silhouette: 'skull', palette: { body: '#69547e', bodyDark: '#271f3b', accent: '#ff7ab8', glow: '#e879f9', eye: '#f5d0fe' }, description: 'A hollow-faced helper that leaves a lavender afterimage.' },
  { id: 'ink-wing', name: 'Ink Wing', family: 'bat', silhouette: 'winglet', palette: { body: '#2e365e', bodyDark: '#12152c', accent: '#67e8f9', glow: '#4de1ff', eye: '#fef08a' }, description: 'A pocket night-bat folded from storm-colored shadow.' },
  { id: 'copper-wing', name: 'Copper Wing', family: 'bat', silhouette: 'winglet', palette: { body: '#8a5540', bodyDark: '#38262d', accent: '#ffd166', glow: '#ff9f43', eye: '#fff7ed' }, description: 'A bright-eared flier that zigzags through crowded streets.' },
  { id: 'signal-mote', name: 'Street Mote', family: 'mote', silhouette: 'spark', palette: { body: '#75a7b8', bodyDark: '#1d3f50', accent: '#b8ff5c', glow: '#6ee7ff', eye: '#ffffff' }, description: 'A floating street light that hums when danger gets close.' },
  { id: 'pink-static', name: 'Pink Static', family: 'mote', silhouette: 'spark', palette: { body: '#a64f83', bodyDark: '#3b1d43', accent: '#ff7ab8', glow: '#f0abfc', eye: '#fff1f2' }, description: 'A jittering spark that refuses to occupy the same pixel twice.' },
  { id: 'rain-jelly', name: 'Rain Jelly', family: 'blob', silhouette: 'jelly', palette: { body: '#3d8b87', bodyDark: '#173c42', accent: '#67e8f9', glow: '#35d0bb', eye: '#d9f99d' }, description: 'A cheerful puddle-shape with excellent crowd control instincts.' },
  { id: 'plum-jelly', name: 'Plum Jelly', family: 'blob', silhouette: 'jelly', palette: { body: '#87529a', bodyDark: '#33214c', accent: '#f0abfc', glow: '#c084fc', eye: '#fef3c7' }, description: 'A buoyant little lump that pulses in time with the city lights.' },
  { id: 'tin-cricket', name: 'Tin Cricket', family: 'mechanical', silhouette: 'clockwork', palette: { body: '#788b99', bodyDark: '#273440', accent: '#fbbf24', glow: '#f59e0b', eye: '#fef08a' }, description: 'A clockwork chirper assembled from three harmless loose parts.' },
  { id: 'neon-gear', name: 'Neon Gear', family: 'mechanical', silhouette: 'clockwork', palette: { body: '#43677a', bodyDark: '#142a3a', accent: '#4de1ff', glow: '#22d3ee', eye: '#ffffff' }, description: 'A spinning pocket machine with a very small emergency siren.' },
  { id: 'prism-moth', name: 'Prism Moth', family: 'bat', silhouette: 'prism-moth', palette: { body: '#b993ff', bodyDark: '#352058', accent: '#69eaff', glow: '#ff84da', eye: '#fffef2' }, description: 'A tiny diamond body carried by enormous crystalline wings.', sizeScale: 0.68, legendary: true, specialAbility: 'prism-collect', weight: 1 },
  { id: 'void-pup', name: 'Void Pup', family: 'animal', silhouette: 'void-pup', palette: { body: '#22205b', bodyDark: '#070814', accent: '#712fc2', glow: '#2d9dff', eye: '#e8f4ff' }, description: 'A medium star-filled wolf with smoke in place of paws.', sizeScale: 0.92, legendary: true, specialAbility: 'void-fetch', weight: 1 },
  { id: 'ember-koi', name: 'Ember Koi', family: 'animal', silhouette: 'ember-koi', palette: { body: '#ff792b', bodyDark: '#ad2134', accent: '#f3c347', glow: '#25c9ba', eye: '#fff8d8' }, description: 'A large ribbon-bodied koi with oversized fins and a long flame tail.', sizeScale: 1.28, legendary: true, specialAbility: 'ember-rescue', weight: 1 },
  { id: 'clockwork-beetle', name: 'Clockwork Beetle', family: 'mechanical', silhouette: 'clock-beetle', palette: { body: '#b08235', bodyDark: '#5b321f', accent: '#177c78', glow: '#b9e339', eye: '#efffb0' }, description: 'A tiny six-legged beetle built around a clock-face shell whose hands never stop.', sizeScale: 0.76, legendary: true, specialAbility: 'clock-pause', weight: 1 },
  { id: 'solar-owl', name: 'Solar Owl', family: 'bat', silhouette: 'solar-owl', palette: { body: '#d97706', bodyDark: '#78350f', accent: '#fef08a', glow: '#fde047', eye: '#ffffff' }, description: 'A winged solar watcher that radiates a blinding dawn sunburst.', sizeScale: 0.95, legendary: true, specialAbility: 'solar-flare', weight: 1 },
  { id: 'shadow-mantis', name: 'Shadow Mantis', family: 'mechanical', silhouette: 'shadow-mantis', palette: { body: '#0f172a', bodyDark: '#020617', accent: '#38bdf8', glow: '#818cf8', eye: '#e0f2fe' }, description: 'A sleek insectoid unit wielding razor scythes that carve through armor.', sizeScale: 0.88, legendary: true, specialAbility: 'mantis-slice', weight: 1 },
  { id: 'glitch-fox', name: 'Glitch Fox', family: 'animal', silhouette: 'glitch-fox', palette: { body: '#1e1b4b', bodyDark: '#0f0e26', accent: '#ec4899', glow: '#06b6d4', eye: '#fdf2f8' }, description: 'A quick-stepping runner flickering between frames of reality.', sizeScale: 0.92, legendary: true, specialAbility: 'phase-dash', weight: 1 },
  { id: 'magnet-ursa', name: 'Magnet Ursa', family: 'animal', silhouette: 'magnet-ursa', palette: { body: '#334155', bodyDark: '#1e293b', accent: '#a855f7', glow: '#38bdf8', eye: '#f8fafc' }, description: 'A heavy celestial beast whose core generates crushing magnetic gravitational wells.', sizeScale: 1.18, legendary: true, specialAbility: 'polar-pull', weight: 1 },
  { id: 'cyber-hydra', name: 'Cyber Hydra', family: 'mechanical', silhouette: 'cyber-hydra', palette: { body: '#0284c7', bodyDark: '#082f49', accent: '#38bdf8', glow: '#06b6d4', eye: '#e0f2fe' }, description: 'A three-headed neural network serpent that projects synchronised laser volleys.', sizeScale: 1.15, legendary: true, specialAbility: 'tri-laser', weight: 1 },
  { id: 'plasma-kitsune', name: 'Plasma Kitsune', family: 'animal', silhouette: 'plasma-kitsune', palette: { body: '#ea580c', bodyDark: '#431407', accent: '#f59e0b', glow: '#fbbf24', eye: '#fffbeb' }, description: 'A mystic nine-tailed fox dancing with orbiting plasma beads.', sizeScale: 0.96, legendary: true, specialAbility: 'plasma-orbit', weight: 1 },
  { id: 'nano-phoenix', name: 'Nano Phoenix', family: 'bat', silhouette: 'nano-phoenix', palette: { body: '#f43f5e', bodyDark: '#4c0519', accent: '#fb7185', glow: '#fda4af', eye: '#fff1f2' }, description: 'A miniature reborn avatar of nanite flames that triggers emergency bursts upon danger.', sizeScale: 0.94, legendary: true, specialAbility: 'rebirth-burst', weight: 1 },
  { id: 'titan-colossus', name: 'Titan Colossus', family: 'mechanical', silhouette: 'titan-colossus', palette: { body: '#475569', bodyDark: '#0f172a', accent: '#94a3b8', glow: '#cbd5e1', eye: '#f8fafc' }, description: 'A miniature steel juggernaut that cracks asphalt with thunderous seismic shockwaves.', sizeScale: 1.35, legendary: true, specialAbility: 'seismic-slam', weight: 1 },
  { id: 'chrono-hare', name: 'Chrono Hare', family: 'animal', silhouette: 'chrono-hare', palette: { body: '#8b5cf6', bodyDark: '#2e1065', accent: '#c084fc', glow: '#e9d5ff', eye: '#faf5ff' }, description: 'A temporal sprinter that bends local spacetime to dodge lethal fire.', sizeScale: 0.85, legendary: true, specialAbility: 'time-warp', weight: 1 },
  { id: 'byte-serpent', name: 'Byte Serpent', family: 'blob', silhouette: 'byte-serpent', palette: { body: '#10b981', bodyDark: '#022c22', accent: '#34d399', glow: '#6ee7b7', eye: '#ecfdf5' }, description: 'A segmented cybernetic viper that infects targets with code corruption.', sizeScale: 1.20, legendary: true, specialAbility: 'glitch-strike', weight: 1 },
  { id: 'cosmic-axolotl', name: 'Cosmic Axolotl', family: 'animal', silhouette: 'cosmic-axolotl', palette: { body: '#ec4899', bodyDark: '#500724', accent: '#a855f7', glow: '#f472b6', eye: '#fdf2f8' }, description: 'An ethereal deep-space axolotl radiating gentle starlight regenerative waves.', sizeScale: 0.90, legendary: true, specialAbility: 'starlight-heal', weight: 1 },
  { id: 'storm-griffin', name: 'Storm Griffin', family: 'bat', silhouette: 'storm-griffin', palette: { body: '#0284c7', bodyDark: '#0c4a6e', accent: '#facc15', glow: '#38bdf8', eye: '#fef08a' }, description: 'An electrified raptor with crackling talons and thunderous wingbeats.', sizeScale: 1.10, legendary: true, specialAbility: 'thunder-claw', weight: 1 },
  // Never rolled from a chest (weight: 0, same as the starters) -- only
  // reachable by defeating the rare Digi-Wolf event enemy, see killEnemy's
  // digi-wolf branch in engine/world.ts.
  { id: 'digi-wolf', name: 'Digi-Wolf', family: 'animal', silhouette: 'digi-wolf', palette: { body: '#0e7490', bodyDark: '#083344', accent: '#22d3ee', glow: '#67e8f9', eye: '#ecfeff' }, description: 'A wolf rendered half out of code, still hunting, now hunting for you.', sizeScale: 1.05, legendary: true, specialAbility: 'digi-fang', weight: 0 },
  { id: 'dusk-pouncer', name: 'Dusk Pouncer', family: 'animal', silhouette: 'pouncer', palette: { body: '#312e81', bodyDark: '#1e1b4b', accent: '#a855f7', glow: '#c084fc', eye: '#fae8ff' }, description: 'An agile alley stalker that thrives when city neon flickers low.' },
  { id: 'echo-skull', name: 'Echo Skull', family: 'ghoul', silhouette: 'skull', palette: { body: '#475569', bodyDark: '#1e293b', accent: '#34d399', glow: '#10b981', eye: '#ecfdf5' }, description: 'A curious specter that vibrates in resonance with distant sirens.' },
  { id: 'volt-wing', name: 'Volt Wing', family: 'bat', silhouette: 'winglet', palette: { body: '#1e3a5f', bodyDark: '#0b192c', accent: '#facc15', glow: '#38bdf8', eye: '#ffffff' }, description: 'A high-voltage bat that discharges static arcs upon contact.' },
  { id: 'nova-mote', name: 'Nova Mote', family: 'mote', silhouette: 'spark', palette: { body: '#ea580c', bodyDark: '#7c2d12', accent: '#fde047', glow: '#f97316', eye: '#fffbeb' }, description: 'A miniature star fragment burning with unharnessed fusion energy.' },
  { id: 'tar-jelly', name: 'Tar Jelly', family: 'blob', silhouette: 'jelly', palette: { body: '#18181b', bodyDark: '#09090b', accent: '#e11d48', glow: '#fb7185', eye: '#ffe4e6' }, description: 'A viscous droplet that adheres to enemy footsteps to slow momentum.' },
  { id: 'gyro-sentry', name: 'Gyro Sentry', family: 'mechanical', silhouette: 'clockwork', palette: { body: '#52525b', bodyDark: '#27272a', accent: '#22c55e', glow: '#4ade80', eye: '#f0fdf4' }, description: 'A dual-axis stabilizer drone patrolling alongside its operative.' },
  // GRPD Station K9 Unit -- Rapid Guard's counter. Ordinary variants (no
  // SPECIAL_LOKPET_LOADOUTS entry) so they roll the full common/charged/
  // rare/mythic spread like any other pet, per the "rarities" ask.
  { id: 'k9-greyhound', name: 'K9 Greyhound', family: 'animal', silhouette: 'k9-hound', palette: { body: '#94a3b8', bodyDark: '#334155', accent: '#1d4ed8', glow: '#60a5fa', eye: '#0f172a' }, description: 'A lean patrol dog in a stitched-up police vest, still faster than anything else on four legs.' },
  { id: 'k9-shepherd', name: 'K9 Shepherd', family: 'animal', silhouette: 'k9-hound', palette: { body: '#5b3a21', bodyDark: '#2b1a0f', accent: '#1d4ed8', glow: '#93c5fd', eye: '#1c1917' }, description: 'A retired precinct shepherd, badge clipped to its vest, that never quite stopped working the beat.' },
  { id: 'blue-616', name: 'Blue 616', family: 'animal', silhouette: 'k9-hound', palette: { body: '#1e3a5f', bodyDark: '#08111f', accent: '#facc15', glow: '#60a5fa', eye: '#e0f2fe' }, description: 'The GRPD vault guardian. Blue held the last watch alone and still answers the old 616 call sign.', sizeScale: 1.1, legendary: true, weight: 0 },
  { id: 'wolf', name: 'Alley Wolf', family: 'animal', silhouette: 'wolf', palette: { body: '#44403c', bodyDark: '#1c1917', accent: '#a8a29e', glow: '#38bdf8', eye: '#fef3c7' }, description: 'A real wolf that wandered into the city and decided the streets were just a bigger forest.', weight: 3 },

  // GRPD Station K9 Unit -- broader dog-breed pool, merged in from the
  // dogBreedsDraft.ts review file. `weight` here is breed-pool weight (how
  // often this breed is picked at all), separate from the common/charged/
  // rare/mythic *stat* rarity these still roll independently, per
  // pickWeightedVariant/LOKPET_STAT_SHEETS above.
  { id: 'junkyard-cur', name: 'Junkyard Cur', family: 'animal', silhouette: 'k9-hound', palette: { body: '#78716c', bodyDark: '#292524', accent: '#a3a3a3', glow: '#d6d3d1', eye: '#1c1917' }, description: 'Grew up between two chain-link fences and a dumpster. Barks first, asks never.', weight: 12 },
  { id: 'alley-mutt', name: 'Alley Mutt', family: 'animal', silhouette: 'k9-hound', palette: { body: '#92764f', bodyDark: '#3f2f1c', accent: '#d9c9a3', glow: '#f5deb3', eye: '#2b1d0e' }, description: "No two people agree what breeds went into this one. It doesn't care either.", weight: 11 },
  { id: 'corner-stray', name: 'Corner Stray', family: 'animal', silhouette: 'wolf', palette: { body: '#57534e', bodyDark: '#1c1917', accent: '#a8a29e', glow: '#78716c', eye: '#fef3c7' }, description: 'Owns exactly one street corner and has never lost an argument about it.', weight: 10 },
  { id: 'rust-belt-terrier', name: 'Rust Belt Terrier', family: 'animal', silhouette: 'k9-hound', palette: { body: '#8a5a3c', bodyDark: '#3d2717', accent: '#e8b04b', glow: '#f4c78a', eye: '#1a1208' }, description: 'Small, wiry, and personally offended by every rat in a four-block radius.', weight: 7 },
  { id: 'frostline-husky', name: 'Frostline Husky', family: 'animal', silhouette: 'k9-hound', palette: { body: '#cbd5e1', bodyDark: '#475569', accent: '#38bdf8', glow: '#bae6fd', eye: '#0c4a6e' }, description: 'Built for a colder city than this one. Makes do, loudly, at 3am.', weight: 6 },
  { id: 'onyx-doberman', name: 'Onyx Doberman', family: 'animal', silhouette: 'wolf', palette: { body: '#18181b', bodyDark: '#09090b', accent: '#b91c1c', glow: '#f87171', eye: '#fafafa' }, description: 'Moves like it already knows how this ends. Usually does.', weight: 3 },
  { id: 'ridge-runner', name: 'Ridge Runner', family: 'animal', silhouette: 'wolf', palette: { body: '#c2703d', bodyDark: '#5c2f16', accent: '#78350f', glow: '#fdba74', eye: '#292524' }, description: 'A stripe of stiff hair down its spine that stands up before it does. Bred for something bigger than this city has left.', weight: 2 },
  { id: 'palace-borzoi', name: 'Palace Borzoi', family: 'animal', silhouette: 'wolf', palette: { body: '#f5f5f4', bodyDark: '#a8a29e', accent: '#d4af37', glow: '#fef3c7', eye: '#44403c' }, description: 'Ran with royalty once, or its owner says so. Carries itself like the claim is true.', weight: 1 },
  { id: 'imperial-akita', name: 'Imperial Akita', family: 'animal', silhouette: 'k9-hound', palette: { body: '#ea9c3d', bodyDark: '#78430f', accent: '#fef3c7', glow: '#fde68a', eye: '#1c1917' }, description: 'Composed, watchful, and unmistakably certain that it, personally, is the reason nothing bad has happened yet.', weight: 1 },
  { id: 'velvet-saluki', name: 'Velvet Saluki', family: 'animal', silhouette: 'wolf', palette: { body: '#3f3245', bodyDark: '#1a1423', accent: '#c084fc', glow: '#e9d5ff', eye: '#faf5ff' }, description: 'Feathered, silent, and faster than anything this build implies. A hunting line with nothing left to hunt but time.', weight: 1 },
  // Digi-Thematic Elemental Variations
  { id: 'terra-gargoyle', name: 'Terra Gargoyle', family: 'mechanical', silhouette: 'terra-gargoyle', palette: { body: '#78716c', bodyDark: '#292524', accent: '#f59e0b', glow: '#fbbf24', eye: '#fef08a' }, description: 'A gargoyle sculpted from hardened silicon server chassis that shields comrades behind stone firewalls.', sizeScale: 1.15, legendary: true, specialAbility: 'silicon-shield', weight: 1 },
  { id: 'aero-raptor', name: 'Aero Raptor', family: 'bat', silhouette: 'aero-raptor', palette: { body: '#0d9488', bodyDark: '#134e4a', accent: '#2dd4bf', glow: '#99f6e4', eye: '#f0fdfa' }, description: 'A high-frequency vector raptor slicing through sonic barrier lines.', sizeScale: 0.95, legendary: true, specialAbility: 'vector-slice', weight: 1 },
  { id: 'photon-lynx', name: 'Photon Lynx', family: 'animal', silhouette: 'photon-lynx', palette: { body: '#eab308', bodyDark: '#713f12', accent: '#facc15', glow: '#fef08a', eye: '#ffffff' }, description: 'A shimmering feline woven from optical fiber light channels.', sizeScale: 0.92, legendary: true, specialAbility: 'refract-beam', weight: 1 },
  { id: 'null-abyss', name: 'Null Abyss', family: 'mote', silhouette: 'null-abyss', palette: { body: '#312e81', bodyDark: '#0f172a', accent: '#818cf8', glow: '#c7d2fe', eye: '#ede9fe' }, description: 'A collapsed void anomaly that generates localized black holes.', sizeScale: 0.96, legendary: true, specialAbility: 'singularity-drain', weight: 1 },
  { id: 'cyber-pangolin', name: 'Cyber Pangolin', family: 'animal', silhouette: 'cyber-pangolin', palette: { body: '#854d0e', bodyDark: '#451a03', accent: '#ca8a04', glow: '#fde047', eye: '#fef9c3' }, description: 'An armored cyber-pangolin with plated firewall scales.', sizeScale: 0.88, legendary: true, specialAbility: 'firewall-curl', weight: 1 },
  { id: 'ion-pegasus', name: 'Ion Pegasus', family: 'bat', silhouette: 'ion-pegasus', palette: { body: '#0284c7', bodyDark: '#075985', accent: '#38bdf8', glow: '#7dd3fc', eye: '#f0f9ff' }, description: 'A soaring cyber-steed powered by ion propulsion wings.', sizeScale: 1.12, legendary: true, specialAbility: 'sonic-boom', weight: 1 },
  { id: 'glitch-dragon', name: 'Glitch Dragon', family: 'blob', silhouette: 'glitch-dragon', palette: { body: '#831843', bodyDark: '#500724', accent: '#f43f5e', glow: '#fda4af', eye: '#fff1f2' }, description: 'A mythic dragon entity forged from unstable quantum data streams.', sizeScale: 1.25, legendary: true, specialAbility: 'byte-breath', weight: 1 },
  { id: 'apex-chimera', name: 'Apex Chimera', family: 'animal', silhouette: 'apex-chimera', palette: { body: '#701a75', bodyDark: '#2e1065', accent: '#f59e0b', glow: '#38bdf8', eye: '#fef08a' }, description: 'A supreme multi-affinity chimera carrying draconian crests and tri-elemental fury.', sizeScale: 1.30, legendary: true, specialAbility: 'chimera-fusion', weight: 1 },
  { id: 'cyber-leviathan', name: 'Cyber Leviathan', family: 'blob', silhouette: 'cyber-leviathan', palette: { body: '#0f766e', bodyDark: '#042f2e', accent: '#06b6d4', glow: '#67e8f9', eye: '#ecfeff' }, description: 'A colossal cybernetic sea dragon commanding frozen sub-zero tides.', sizeScale: 1.35, legendary: true, specialAbility: 'leviathan-surge', weight: 1 },
  { id: 'solar-seraph', name: 'Solar Seraph', family: 'bat', silhouette: 'solar-seraph', palette: { body: '#f59e0b', bodyDark: '#78350f', accent: '#fde047', glow: '#ffffff', eye: '#fffbeb' }, description: 'A six-winged angelic light avatar that cleanses darkness with radiant dawn bursts.', sizeScale: 1.22, legendary: true, specialAbility: 'seraph-radiance', weight: 1 },
  { id: 'chrono-valkyrie', name: 'Chrono Valkyrie', family: 'mechanical', silhouette: 'chrono-valkyrie', palette: { body: '#6366f1', bodyDark: '#1e1b4b', accent: '#a855f7', glow: '#c084fc', eye: '#fdf4ff' }, description: 'A tachyon-powered mechanized valkyrie piercing temporal horizons with chrono lances.', sizeScale: 1.18, legendary: true, specialAbility: 'valkyrie-lance', weight: 1 },
  { id: 'abyss-behemoth', name: 'Abyss Behemoth', family: 'mechanical', silhouette: 'abyss-behemoth', palette: { body: '#18181b', bodyDark: '#020617', accent: '#7c3aed', glow: '#a855f7', eye: '#ede9fe' }, description: 'An obsidian armored behemoth housing an active gravitational singularity.', sizeScale: 1.40, legendary: true, specialAbility: 'abyss-crush', weight: 1 },
  { id: 'quantum-kirin', name: 'Quantum Kirin', family: 'animal', silhouette: 'quantum-kirin', palette: { body: '#0284c7', bodyDark: '#082f49', accent: '#eab308', glow: '#fde047', eye: '#fefce8' }, description: 'A celestial thunder kirin stepping through quantum phase barriers with spark hooves.', sizeScale: 1.16, legendary: true, specialAbility: 'kirin-thunder', weight: 1 },

  // Pure Synthetic Data-Pets compiled post-Eclipse (Dust Mites, Sloths, Frogs, Birds)
  // 100% Synthetic Data Animals -- Zero Organic Tissue
  { id: 'byte-dust-mite', name: 'Byte Dust-Mite', family: 'mechanical', silhouette: 'dust-mite', palette: { body: '#38bdf8', bodyDark: '#082f49', accent: '#a855f7', glow: '#67e8f9', eye: '#f0f9ff' }, description: 'A scurrying synthetic data mite compiled from loose cache packets after the Great Eclipse. Zero organic tissue; purely executable bytecode.', sizeScale: 0.72, legendary: false, specialAbility: 'mite-swarm', weight: 4 },
  { id: 'neon-dust-roller', name: 'Neon Dust-Roller', family: 'mechanical', silhouette: 'dust-mite', palette: { body: '#f59e0b', bodyDark: '#451a03', accent: '#fbbf24', glow: '#fde047', eye: '#ffffff' }, description: 'A high-friction synthetic mite that compresses into a kinetic spinning orb to crush incoming malicious loops.', sizeScale: 0.75, legendary: false, specialAbility: 'mite-swarm', weight: 3 },
  { id: 'amber-dust-mite', name: 'Amber Dust-Mite', family: 'mechanical', silhouette: 'dust-mite', palette: { body: '#d97706', bodyDark: '#78350f', accent: '#fbbf24', glow: '#f59e0b', eye: '#fffbeb' }, description: 'Encapsulated in crystallized firewall resin, this data mite projects impenetrable defensive shields for its handler.', sizeScale: 0.74, legendary: true, specialAbility: 'silicon-shield', weight: 2 },
  { id: 'void-dust-mite', name: 'Void Dust-Mite', family: 'mote', silhouette: 'dust-mite', palette: { body: '#1e1b4b', bodyDark: '#020617', accent: '#7c3aed', glow: '#a855f7', eye: '#ede9fe' }, description: 'A deep-cache vacuum anomaly that swallows orphaned heap memory and hostile projectiles.', sizeScale: 0.78, legendary: true, specialAbility: 'null-consume', weight: 2 },

  { id: 'chrono-sloth', name: 'Chrono Sloth', family: 'animal', silhouette: 'data-sloth', palette: { body: '#6366f1', bodyDark: '#1e1b4b', accent: '#818cf8', glow: '#c7d2fe', eye: '#ede9fe' }, description: 'A wonderfully calm data sloth constructed from suspended animation subroutines. Radiates a local spacetime lag field.', sizeScale: 0.88, legendary: false, specialAbility: 'sloth-dilation', weight: 3 },
  { id: 'chill-byte-sloth', name: 'Chill-Byte Sloth', family: 'animal', silhouette: 'data-sloth', palette: { body: '#0284c7', bodyDark: '#0c4a6e', accent: '#38bdf8', glow: '#7dd3fc', eye: '#f0f9ff' }, description: 'Perched in memory rafters, this sub-zero synthetic sloth pulses waves of cryo-compression across the arena.', sizeScale: 0.85, legendary: false, specialAbility: 'clock-pause', weight: 3 },
  { id: 'quantum-sloth', name: 'Quantum Sloth', family: 'animal', silhouette: 'data-sloth', palette: { body: '#7e22ce', bodyDark: '#2e1065', accent: '#c084fc', glow: '#f472b6', eye: '#faf5ff' }, description: 'Appears sluggish until threatened, at which point it phases across multiple quantum states simultaneously.', sizeScale: 0.90, legendary: true, specialAbility: 'time-warp', weight: 2 },

  { id: 'circuit-frog', name: 'Circuit Frog', family: 'animal', silhouette: 'circuit-frog', palette: { body: '#10b981', bodyDark: '#064e3b', accent: '#34d399', glow: '#6ee7b7', eye: '#fef08a' }, description: 'An agile cybernetic amphibian with gold-plated conductive legs that discharge electric thunder-croaks.', sizeScale: 0.82, legendary: false, specialAbility: 'frog-shockwave', weight: 4 },
  { id: 'toxic-data-toad', name: 'Toxic Data-Toad', family: 'blob', silhouette: 'circuit-frog', palette: { body: '#84cc16', bodyDark: '#365314', accent: '#a3e635', glow: '#bef264', eye: '#ffffff' }, description: 'Secretes corrupted memory pointers that dissolve hostile armor and poison digital cores.', sizeScale: 0.86, legendary: false, specialAbility: 'glitch-strike', weight: 3 },
  { id: 'neon-bullfrog', name: 'Neon Bullfrog', family: 'animal', silhouette: 'circuit-frog', palette: { body: '#06b6d4', bodyDark: '#164e63', accent: '#22d3ee', glow: '#67e8f9', eye: '#fff1f2' }, description: 'Possesses an amplified sub-woofer throat pouch that produces concussive shockwaves flattening swarms.', sizeScale: 0.92, legendary: true, specialAbility: 'seismic-slam', weight: 2 },

  { id: 'bit-raven', name: 'Bit-Raven', family: 'bat', silhouette: 'pixel-bird', palette: { body: '#1e293b', bodyDark: '#020617', accent: '#38bdf8', glow: '#94a3b8', eye: '#f8fafc' }, description: 'A sharp vector-winged scavenger that patrols the digital thermals, diving with talon micro-missiles.', sizeScale: 0.84, legendary: false, specialAbility: 'bird-talon', weight: 4 },
  { id: 'cyber-falcon', name: 'Cyber-Falcon', family: 'bat', silhouette: 'pixel-bird', palette: { body: '#0284c7', bodyDark: '#082f49', accent: '#f59e0b', glow: '#fde047', eye: '#ffffff' }, description: 'An ultra-fast pursuit drone bird that accelerates past Mach 2 vectors to cleave targets with hardlight wingtips.', sizeScale: 0.88, legendary: true, specialAbility: 'vector-slice', weight: 2 },
  { id: 'pixel-sparrow', name: 'Pixel-Sparrow', family: 'bat', silhouette: 'pixel-bird', palette: { body: '#f43f5e', bodyDark: '#4c0519', accent: '#fb7185', glow: '#fda4af', eye: '#fff1f2' }, description: 'A swift, sociable flock sprite that flits around its partner operative, leaving trails of static fireworks.', sizeScale: 0.78, legendary: false, specialAbility: 'thunder-claw', weight: 4 },
];

export const LOKPET_STAT_SHEETS: LokPetStatSheet[] = [
  { rarity: 'common', label: 'Common', powerMultiplier: 0.84, health: 34, moveSpeed: 112, damage: 7, cooldownMs: 1100, range: 220, projectileSpeed: 250, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 90000, weight: 46 },
  { rarity: 'charged', label: 'Charged', powerMultiplier: 1.0, health: 48, moveSpeed: 125, damage: 11, cooldownMs: 900, range: 250, projectileSpeed: 285, explosionRadius: 0, pulseRadius: 74, lifetimeMs: 96000, weight: 32 },
  { rarity: 'rare', label: 'Rare', powerMultiplier: 1.2, health: 68, moveSpeed: 140, damage: 16, cooldownMs: 720, range: 285, projectileSpeed: 330, explosionRadius: 52, pulseRadius: 92, lifetimeMs: 102000, weight: 17 },
  { rarity: 'mythic', label: 'Mythic', powerMultiplier: 1.46, health: 96, moveSpeed: 158, damage: 23, cooldownMs: 560, range: 325, projectileSpeed: 390, explosionRadius: 68, pulseRadius: 116, lifetimeMs: 108000, weight: 5 },
];

const ATTACKS: Array<{ kind: LokPetAttackKind; label: string }> = [
  { kind: 'shot', label: 'single shot' },
  { kind: 'rapid-shot', label: 'rapid fire' },
  { kind: 'heavy-shot', label: 'heavy shot' },
  { kind: 'pulse', label: 'pulsating field' },
  { kind: 'explosion', label: 'burst explosion' },
];

const PET_NAMES = [
  'Biscuit', 'Cricket', 'Flicker', 'Glim', 'Hush', 'Kip', 'Lumen', 'Mallow',
  'Nix', 'Pip', 'Rook', 'Soot', 'Tumble', 'Vex', 'Wisp', 'Zig',
];

const ELEMENTS: Array<{ element: LokPetElement; label: string }> = [
  { element: 'none', label: 'raw kinetic' },
  { element: 'fire', label: 'pyro-bit fire' },
  { element: 'freeze', label: 'cryo-byte freeze' },
  { element: 'slow', label: 'chrono-lag slow' },
  { element: 'volt', label: 'volt-surge electric' },
  { element: 'glitch', label: 'null-glitch corrupted' },
  { element: 'terra', label: 'solid-core terra' },
  { element: 'aero', label: 'gale-packet aero' },
  { element: 'light', label: 'photon-array light' },
  { element: 'dark', label: 'void-sector dark' },
];

function pick<T>(rng: () => number, values: T[]): T {
  return values[Math.floor(rng() * values.length)]!;
}

function pickWeightedSheet(rng: () => number): LokPetStatSheet {
  const total = LOKPET_STAT_SHEETS.reduce((sum, sheet) => sum + sheet.weight, 0);
  let roll = rng() * total;
  for (const sheet of LOKPET_STAT_SHEETS) {
    roll -= sheet.weight;
    if (roll <= 0) return sheet;
  }
  return LOKPET_STAT_SHEETS[0]!;
}

function pickWeightedVariant(rng: () => number): LokPetVariantDef {
  const total = LOKPET_VARIANTS.reduce((sum, variant) => sum + (variant.weight ?? 8), 0);
  let roll = rng() * total;
  for (const variant of LOKPET_VARIANTS) {
    roll -= variant.weight ?? 8;
    if (roll <= 0) return variant;
  }
  return LOKPET_VARIANTS[0]!;
}

const SPECIAL_LOKPET_LOADOUTS: Record<string, {
  attackKind: LokPetAttackKind;
  element: LokPetElement;
  elementLabel: string;
  traitLabel: string;
  stats: LokPetRoll['stats'];
}> = {
  'lil-llama': { attackKind: 'pulse', element: 'slow', elementLabel: 'heartbound', traitLabel: 'Cutify · Getaway', stats: { health: 110, moveSpeed: 168, damage: 17, cooldownMs: 780, range: 300, projectileSpeed: 390, explosionRadius: 0, pulseRadius: 118, lifetimeMs: 120000 } },
  'static-null': { attackKind: 'explosion', element: 'freeze', elementLabel: 'null code', traitLabel: 'Data Feast · Quiet Tithe', stats: { health: 104, moveSpeed: 154, damage: 23, cooldownMs: 820, range: 320, projectileSpeed: 420, explosionRadius: 72, pulseRadius: 0, lifetimeMs: 120000 } },
  'lil-buzbee': { attackKind: 'rapid-shot', element: 'none', elementLabel: 'pollen kinetic', traitLabel: 'Item Scout · Boost Pollen', stats: { health: 86, moveSpeed: 205, damage: 14, cooldownMs: 520, range: 350, projectileSpeed: 500, explosionRadius: 0, pulseRadius: 94, lifetimeMs: 120000 } },
  'prism-moth': { attackKind: 'rapid-shot', element: 'none', elementLabel: 'prismatic', traitLabel: 'Spectrum Sweep · split collector', stats: { health: 76, moveSpeed: 178, damage: 13, cooldownMs: 620, range: 330, projectileSpeed: 430, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 108000 } },
  'void-pup': { attackKind: 'pulse', element: 'slow', elementLabel: 'void slow', traitLabel: 'Eventide Fetch · hollow howl', stats: { health: 98, moveSpeed: 150, damage: 17, cooldownMs: 980, range: 300, projectileSpeed: 360, explosionRadius: 0, pulseRadius: 112, lifetimeMs: 108000 } },
  'ember-koi': { attackKind: 'explosion', element: 'fire', elementLabel: 'restorative fire', traitLabel: 'Cinder Current · last catch', stats: { health: 126, moveSpeed: 136, damage: 21, cooldownMs: 820, range: 320, projectileSpeed: 360, explosionRadius: 72, pulseRadius: 0, lifetimeMs: 108000 } },
  'clockwork-beetle': { attackKind: 'heavy-shot', element: 'slow', elementLabel: 'time slow', traitLabel: 'Overclock Chime · borrowed moment', stats: { health: 112, moveSpeed: 118, damage: 24, cooldownMs: 940, range: 285, projectileSpeed: 320, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 108000 } },
  'solar-owl': { attackKind: 'pulse', element: 'fire', elementLabel: 'radiant sunfire', traitLabel: 'Solar Flare · morning ward', stats: { health: 88, moveSpeed: 165, damage: 19, cooldownMs: 720, range: 340, projectileSpeed: 380, explosionRadius: 0, pulseRadius: 120, lifetimeMs: 112000 } },
  'shadow-mantis': { attackKind: 'rapid-shot', element: 'freeze', elementLabel: 'chilled alloy', traitLabel: 'Scythe Dance · razor pierce', stats: { health: 105, moveSpeed: 185, damage: 18, cooldownMs: 540, range: 290, projectileSpeed: 440, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 110000 } },
  'glitch-fox': { attackKind: 'heavy-shot', element: 'slow', elementLabel: 'phase kinetic', traitLabel: 'Glitch Step · shockwave flicker', stats: { health: 115, moveSpeed: 172, damage: 26, cooldownMs: 820, range: 310, projectileSpeed: 410, explosionRadius: 58, pulseRadius: 0, lifetimeMs: 115000 } },
  'magnet-ursa': { attackKind: 'explosion', element: 'none', elementLabel: 'graviton crush', traitLabel: 'Polar Core · vacuum crush', stats: { health: 140, moveSpeed: 124, damage: 28, cooldownMs: 880, range: 310, projectileSpeed: 340, explosionRadius: 84, pulseRadius: 90, lifetimeMs: 120000 } },
  'cyber-hydra': { attackKind: 'rapid-shot', element: 'none', elementLabel: 'tri-laser barrage', traitLabel: 'Tri-Core Beam · piercing grid', stats: { health: 120, moveSpeed: 160, damage: 24, cooldownMs: 500, range: 360, projectileSpeed: 480, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 115000 } },
  'plasma-kitsune': { attackKind: 'pulse', element: 'fire', elementLabel: 'plasma orbit', traitLabel: 'Foxfire Halo · swirling burn', stats: { health: 110, moveSpeed: 175, damage: 22, cooldownMs: 650, range: 310, projectileSpeed: 390, explosionRadius: 0, pulseRadius: 130, lifetimeMs: 112000 } },
  'nano-phoenix': { attackKind: 'explosion', element: 'fire', elementLabel: 'reborn flame', traitLabel: 'Nanite Surge · cleansing ashes', stats: { health: 100, moveSpeed: 180, damage: 26, cooldownMs: 780, range: 330, projectileSpeed: 400, explosionRadius: 80, pulseRadius: 0, lifetimeMs: 110000 } },
  'titan-colossus': { attackKind: 'explosion', element: 'none', elementLabel: 'seismic crush', traitLabel: 'Tectonic Force · shock rupture', stats: { health: 165, moveSpeed: 115, damage: 32, cooldownMs: 920, range: 280, projectileSpeed: 300, explosionRadius: 95, pulseRadius: 100, lifetimeMs: 125000 } },
  'chrono-hare': { attackKind: 'rapid-shot', element: 'slow', elementLabel: 'chrono dilation', traitLabel: 'Second Hand · time stutter', stats: { health: 90, moveSpeed: 210, damage: 18, cooldownMs: 440, range: 300, projectileSpeed: 500, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 105000 } },
  'byte-serpent': { attackKind: 'heavy-shot', element: 'freeze', elementLabel: 'glitch cipher', traitLabel: 'Byte Byte · null pointer shock', stats: { health: 130, moveSpeed: 155, damage: 27, cooldownMs: 760, range: 320, projectileSpeed: 420, explosionRadius: 60, pulseRadius: 0, lifetimeMs: 118000 } },
  'cosmic-axolotl': { attackKind: 'pulse', element: 'slow', elementLabel: 'starlight pulse', traitLabel: 'Astral Dew · serene lullaby', stats: { health: 115, moveSpeed: 145, damage: 20, cooldownMs: 680, range: 350, projectileSpeed: 360, explosionRadius: 0, pulseRadius: 125, lifetimeMs: 120000 } },
  'storm-griffin': { attackKind: 'heavy-shot', element: 'none', elementLabel: 'volt storm', traitLabel: 'Tempest Arc · thunder talon', stats: { health: 125, moveSpeed: 185, damage: 29, cooldownMs: 700, range: 340, projectileSpeed: 460, explosionRadius: 65, pulseRadius: 0, lifetimeMs: 115000 } },
  'digi-wolf': { attackKind: 'rapid-shot', element: 'freeze', elementLabel: 'corrupted frost', traitLabel: 'Digi-Fang · packet bite', stats: { health: 118, moveSpeed: 190, damage: 25, cooldownMs: 560, range: 320, projectileSpeed: 440, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 115000 } },
  'blue-616': { attackKind: 'heavy-shot', element: 'freeze', elementLabel: 'blue-line frost', traitLabel: 'Last Watch · vault guardian', stats: { health: 150, moveSpeed: 160, damage: 29, cooldownMs: 680, range: 340, projectileSpeed: 440, explosionRadius: 58, pulseRadius: 100, lifetimeMs: 120000 } },
  'terra-gargoyle': { attackKind: 'heavy-shot', element: 'terra', elementLabel: 'solid-core terra', traitLabel: 'Silicon Fortress · seismic firewall', stats: { health: 155, moveSpeed: 120, damage: 28, cooldownMs: 850, range: 300, projectileSpeed: 340, explosionRadius: 75, pulseRadius: 90, lifetimeMs: 120000 } },
  'aero-raptor': { attackKind: 'rapid-shot', element: 'aero', elementLabel: 'gale-packet aero', traitLabel: 'Sonic Vector · tempest slice', stats: { health: 95, moveSpeed: 215, damage: 22, cooldownMs: 480, range: 340, projectileSpeed: 520, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 110000 } },
  'photon-lynx': { attackKind: 'pulse', element: 'light', elementLabel: 'photon-array light', traitLabel: 'Optic Flash · radiant sweep', stats: { health: 105, moveSpeed: 180, damage: 24, cooldownMs: 640, range: 320, projectileSpeed: 420, explosionRadius: 0, pulseRadius: 135, lifetimeMs: 115000 } },
  'null-abyss': { attackKind: 'explosion', element: 'dark', elementLabel: 'void-sector dark', traitLabel: 'Singularity Well · event horizon', stats: { health: 135, moveSpeed: 135, damage: 30, cooldownMs: 820, range: 330, projectileSpeed: 370, explosionRadius: 88, pulseRadius: 95, lifetimeMs: 120000 } },
  'cyber-pangolin': { attackKind: 'pulse', element: 'terra', elementLabel: 'solid-core terra', traitLabel: 'Firewall Curl · iron deflection', stats: { health: 160, moveSpeed: 125, damage: 25, cooldownMs: 750, range: 270, projectileSpeed: 320, explosionRadius: 0, pulseRadius: 125, lifetimeMs: 120000 } },
  'ion-pegasus': { attackKind: 'heavy-shot', element: 'aero', elementLabel: 'gale-packet aero', traitLabel: 'Ion Slipstream · thunder galewing', stats: { health: 115, moveSpeed: 195, damage: 27, cooldownMs: 680, range: 360, projectileSpeed: 460, explosionRadius: 60, pulseRadius: 0, lifetimeMs: 115000 } },
  'glitch-dragon': { attackKind: 'explosion', element: 'glitch', elementLabel: 'null-glitch corrupt', traitLabel: 'Matrix Breath · quantum rupture', stats: { health: 145, moveSpeed: 170, damage: 33, cooldownMs: 780, range: 350, projectileSpeed: 450, explosionRadius: 90, pulseRadius: 105, lifetimeMs: 125000 } },
  'apex-chimera': { attackKind: 'explosion', element: 'glitch', elementLabel: 'null-glitch corrupt', traitLabel: 'Chimera Quantum Core · tri-elemental fury', stats: { health: 170, moveSpeed: 180, damage: 35, cooldownMs: 720, range: 360, projectileSpeed: 480, explosionRadius: 95, pulseRadius: 110, lifetimeMs: 130000 } },
  'cyber-leviathan': { attackKind: 'pulse', element: 'freeze', elementLabel: 'cryo-byte freeze', traitLabel: 'Sub-Zero Tidal Surge · absolute zero pulse', stats: { health: 185, moveSpeed: 150, damage: 32, cooldownMs: 800, range: 370, projectileSpeed: 400, explosionRadius: 0, pulseRadius: 140, lifetimeMs: 135000 } },
  'solar-seraph': { attackKind: 'heavy-shot', element: 'light', elementLabel: 'photon-array light', traitLabel: 'Radiant Dawn Sunburst · six-wing flare', stats: { health: 140, moveSpeed: 190, damage: 36, cooldownMs: 650, range: 380, projectileSpeed: 520, explosionRadius: 75, pulseRadius: 0, lifetimeMs: 125000 } },
  'chrono-valkyrie': { attackKind: 'rapid-shot', element: 'slow', elementLabel: 'chrono-lag slow', traitLabel: 'Tachyon Lance · stasis horizon pierce', stats: { health: 145, moveSpeed: 210, damage: 30, cooldownMs: 440, range: 350, projectileSpeed: 540, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 120000 } },
  'abyss-behemoth': { attackKind: 'explosion', element: 'dark', elementLabel: 'void-sector dark', traitLabel: 'Event Horizon Collapse · dark matter crush', stats: { health: 210, moveSpeed: 115, damage: 38, cooldownMs: 900, range: 320, projectileSpeed: 340, explosionRadius: 105, pulseRadius: 120, lifetimeMs: 140000 } },
  'quantum-kirin': { attackKind: 'rapid-shot', element: 'volt', elementLabel: 'volt-surge electric', traitLabel: 'Quantum Arc Discharge · phase thunder', stats: { health: 135, moveSpeed: 225, damage: 31, cooldownMs: 460, range: 360, projectileSpeed: 550, explosionRadius: 0, pulseRadius: 0, lifetimeMs: 120000 } },
};

function pickElement(rng: () => number, attackKind: LokPetAttackKind): { element: LokPetElement; label: string } {
  // Balanced elemental weighting across attack kinds
  const options = attackKind === 'pulse'
    ? ELEMENTS.filter((entry) => entry.element !== 'none')
    : attackKind === 'explosion'
      ? ELEMENTS.filter((entry) => entry.element === 'none' || entry.element === 'fire' || entry.element === 'terra' || entry.element === 'dark' || entry.element === 'slow')
      : ELEMENTS;
  return pick(rng, options);
}

/** Generate one deterministic, chest-ready LokPet blueprint. */
export function rollLokPet(
  rng: () => number,
  options?: { fixedVariantId?: string },
): LokPetRoll {
  const variant = options?.fixedVariantId
    ? LOKPET_VARIANTS.find((v) => v.id === options.fixedVariantId) ?? pickWeightedVariant(rng)
    : pickWeightedVariant(rng);
  const special = options?.fixedVariantId ? SPECIAL_LOKPET_LOADOUTS[variant.id] : undefined;
  if (special) {
    return {
      name: variant.name,
      variantId: variant.id,
      family: variant.family,
      silhouette: variant.silhouette,
      palette: variant.palette,
      rarity: 'mythic',
      rarityLabel: 'Legendary',
      attackKind: special.attackKind,
      element: special.element,
      elementLabel: special.elementLabel,
      description: `${variant.description} ${special.traitLabel}.`,
      stats: special.stats,
      traitLabel: special.traitLabel,
      sizeScale: variant.sizeScale,
      legendary: true,
      specialAbility: variant.specialAbility,
    };
  }
  const sheet = pickWeightedSheet(rng);
  const attack = pick(rng, ATTACKS);
  const element = pickElement(rng, attack.kind);
  const name = `${pick(rng, PET_NAMES)} · ${variant.name}`;
  const jitter = 0.92 + rng() * 0.16;
  const cooldownJitter = 0.94 + rng() * 0.12;
  const stats = {
    health: Math.max(18, Math.round(sheet.health * jitter)),
    moveSpeed: Math.round(sheet.moveSpeed * jitter),
    damage: Math.max(1, Math.round(sheet.damage * sheet.powerMultiplier * jitter)),
    cooldownMs: Math.round(sheet.cooldownMs * cooldownJitter),
    range: Math.round(sheet.range * (0.94 + rng() * 0.12)),
    projectileSpeed: Math.round(sheet.projectileSpeed * (0.94 + rng() * 0.12)),
    explosionRadius: sheet.explosionRadius ? Math.round(sheet.explosionRadius * jitter) : 0,
    pulseRadius: sheet.pulseRadius ? Math.round(sheet.pulseRadius * jitter) : 0,
    lifetimeMs: sheet.lifetimeMs,
  };
  const attackLabel = ATTACKS.find((entry) => entry.kind === attack.kind)!.label;
  const traitLabel = element.element === 'none' ? attackLabel : `${attackLabel} · ${element.label}`;

  return {
    name,
    variantId: variant.id,
    family: variant.family,
    silhouette: variant.silhouette,
    palette: variant.palette,
    rarity: sheet.rarity,
    rarityLabel: sheet.label,
    attackKind: attack.kind,
    element: element.element,
    elementLabel: element.label,
    description: `${variant.description} Rolls ${traitLabel}.`,
    stats,
    traitLabel,
  };
}

export const LOKPET_VARIANTS_BY_ID: Record<string, LokPetVariantDef> =
  Object.fromEntries(LOKPET_VARIANTS.map((variant) => [variant.id, variant]));

export const STARTER_LOKPET_IDS = ['lil-llama', 'static-null', 'lil-buzbee'] as const;
export type StarterLokPetId = typeof STARTER_LOKPET_IDS[number];

export function isStarterLokPetId(value: string): value is StarterLokPetId {
  return (STARTER_LOKPET_IDS as readonly string[]).includes(value);
}

/** Three model phases shared by cards, kennel, and the live run renderer. */
export function starterLokPetEvolutionStage(level = 1): 1 | 2 | 3 {
  return level >= 66 ? 3 : level >= 33 ? 2 : 1;
}

/** Evolution stage for any companion based on level */
export function getLokPetEvolutionStage(level = 1, isStarter = false): 1 | 2 | 3 {
  if (isStarter) {
    return starterLokPetEvolutionStage(level);
  }
  // Standard companions cap at 50; evolve at 15 and 30
  return level >= 30 ? 3 : level >= 15 ? 2 : 1;
}

/** Digi-thematic evolution title for companion variants */
export function getLokPetEvolutionTitle(variantId: string, stage: 1 | 2 | 3): string {
  const TITLES: Record<string, [string, string, string]> = {
    'lil-llama': ['Cria Llama', 'Street Llama', 'Heartguard Llama'],
    'static-null': ['Data Mote', 'Null Familiar', 'Nomad-Eater Echo'],
    'lil-buzbee': ['Runt Bee', 'Courier Bee', 'Royal Buzbèè'],
    'cinder-pouncer': ['Cinder Pup', 'Flame Pouncer', 'Ignis Apex Pouncer'],
    'moss-pouncer': ['Moss Kit', 'Bramble Stalker', 'Primeval Overgrowth'],
    'volt-wing': ['Spark Wing', 'Volt Bat', 'Ion Tempest Wyvern'],
    'byte-serpent': ['Bit Viper', 'Byte Serpent', 'Overclocked Megabyte Drake'],
    'cyber-hydra': ['Data Python', 'Dual-Laser Hydra', 'Tri-Core Apex Dragon'],
    'plasma-kitsune': ['Plasma Kit', 'Six-Tail Spark', 'Nine-Tail Sun Fox'],
    'titan-colossus': ['Steel Construct', 'Rampart Colossus', 'Aegis Dreadnought'],
    'chrono-hare': ['Swift Runner', 'Chrono Jumper', 'Infinite Tachyon Hare'],
    'storm-griffin': ['Volt Chick', 'Thunder Talon', 'Tempest Storm Sovereign'],
    'digi-wolf': ['Code Pup', 'Digi-Wolf', 'Cyberfenrir Alpha'],
    'glitch-fox': ['Phase Vixen', 'Glitch Fox', 'Quantum Warp Fox'],
    'terra-gargoyle': ['Silicon Imp', 'Granite Sentinel', 'Obsidian Bastion Titan'],
    'aero-raptor': ['Vector Chick', 'Aero Raptor', 'Sonic Tempest Falcon'],
    'photon-lynx': ['Fiber Kit', 'Photon Lynx', 'Radiant Prism Panther'],
    'null-abyss': ['Void Fragment', 'Null Abyss', 'Singularity Devourer'],
    'cyber-pangolin': ['Iron Armadillo', 'Cyber Pangolin', 'Aegis Dread-Scale'],
    'ion-pegasus': ['Electro Foal', 'Ion Pegasus', 'Superluminal Sky Sovereign'],
    'glitch-dragon': ['Data Wyrm', 'Glitch Dragon', 'Zero-Day Void Emperor'],
    'apex-chimera': ['Quantum Manticore', 'Apex Chimera', 'Omni-Genesis Celestial Sovereign'],
    'cyber-leviathan': ['Abyssal Serpent', 'Cyber Leviathan', 'Tidal World-Eater Drake'],
    'solar-seraph': ['Aura Cherub', 'Solar Seraph', 'Archangel of the Pure Light'],
    'chrono-valkyrie': ['Gear Maiden', 'Chrono Valkyrie', 'Eternal Paradox Valkyrie'],
    'abyss-behemoth': ['Void Golem', 'Abyss Behemoth', 'Singularity World-Crusher Titan'],
    'quantum-kirin': ['Thunder Colt', 'Quantum Kirin', 'Superposition Lightning Sovereign'],
    'k9-shepherd': ['Patrol Pup', 'Precinct K9', 'Chief Sentinel Dog'],
    'frostline-husky': ['Snow Pup', 'Frostline Husky', 'Boreal Blizzard Howler'],
  };
  const list = TITLES[variantId];
  if (list) return list[stage - 1];
  if (stage === 3) return 'Omega Digiform';
  if (stage === 2) return 'Overclocked Form';
  return 'Base Form';
}

export const LOKPET_RARITY_COLORS: Record<LokPetRarity, string> = {
  common: '#94a3b8',
  charged: '#6ee7ff',
  rare: '#c084fc',
  mythic: '#ffd166',
};

export const LOKPET_ELEMENT_COLORS: Record<LokPetElement, string> = {
  none: '#e2e8f0',
  fire: '#ff5533',
  freeze: '#38bdf8',
  slow: '#c084fc',
  volt: '#facc15',
  glitch: '#ff2fd0',
  terra: '#ca8a04',
  aero: '#14b8a6',
  light: '#fef08a',
  dark: '#818cf8',
};

export const LOKPET_SILHOUETTE_LABELS: Record<LokPetSilhouette, string> = {
  pouncer: 'Pouncer',
  skull: 'Ghoul',
  winglet: 'Bat',
  spark: 'Mote',
  jelly: 'Blob',
  clockwork: 'Clockwork',
  'prism-moth': 'Prism Moth',
  'void-pup': 'Void Pup',
  'ember-koi': 'Ember Koi',
  'clock-beetle': 'Clock Beetle',
  'solar-owl': 'Solar Owl',
  'shadow-mantis': 'Shadow Mantis',
  'glitch-fox': 'Glitch Fox',
  'magnet-ursa': 'Magnet Ursa',
  'cyber-hydra': 'Cyber Hydra',
  'plasma-kitsune': 'Plasma Kitsune',
  'nano-phoenix': 'Nano Phoenix',
  'titan-colossus': 'Titan Colossus',
  'chrono-hare': 'Chrono Hare',
  'byte-serpent': 'Byte Serpent',
  'cosmic-axolotl': 'Cosmic Axolotl',
  'storm-griffin': 'Storm Griffin',
  'k9-hound': 'K9 Hound',
  wolf: 'Wolf',
  'digi-wolf': 'Digi-Wolf',
  'terra-gargoyle': 'Terra Gargoyle',
  'aero-raptor': 'Aero Raptor',
  'photon-lynx': 'Photon Lynx',
  'null-abyss': 'Null Abyss',
  'cyber-pangolin': 'Cyber Pangolin',
  'ion-pegasus': 'Ion Pegasus',
  'glitch-dragon': 'Glitch Dragon',
  'apex-chimera': 'Apex Chimera',
  'cyber-leviathan': 'Cyber Leviathan',
  'solar-seraph': 'Solar Seraph',
  'chrono-valkyrie': 'Chrono Valkyrie',
  'abyss-behemoth': 'Abyss Behemoth',
  'quantum-kirin': 'Quantum Kirin',
  'dust-mite': 'Dust Mite',
  'data-sloth': 'Data Sloth',
  'circuit-frog': 'Circuit Frog',
  'pixel-bird': 'Pixel Bird',
};

/**
 * Real procedural rigs for each LokPet silhouette, reusing blobRig instead of
 * the one-off ctx.beginPath shapes the renderer and UI used to draw by hand.
 * Each family gets a distinct flag combination so they read apart even
 * before palette is applied: pouncer (legs), skull (spiked ridge), winglet
 * (wings), spark (smallest, plain), jelly (biggest, plain), clockwork
 * (spiked + legged).
 */
function prismMothRig(): SpriteRig {
  const rig = blobRig({ height: 8, width: 7, wings: true });
  rig.parts.push(
    { key: 'aura', x: -12, y: 3, w: 8, h: 11, color: 'glow', z: 0 },
    { key: 'aura', x: 4, y: 3, w: 8, h: 11, color: 'accent', z: 0 },
    { key: 'crest', x: -2, y: 12, w: 4, h: 4, color: 'accentBright', z: 8 },
  );
  rig.pixelHeight = 16;
  return rig;
}

function voidPupRig(): SpriteRig {
  const rig = quadrupedRig({ height: 14, length: 17, ears: true });
  rig.parts.push(
    { key: 'aura', x: -10, y: -1, w: 4, h: 3, color: 'glow', z: 0 },
    { key: 'aura', x: -3, y: -2, w: 5, h: 3, color: 'accent', z: 0 },
    { key: 'crest', x: -6, y: 8, w: 2, h: 2, color: 'accentBright', z: 7 },
  );
  return rig;
}

function emberKoiRig(): SpriteRig {
  const rig = serpentRig({ length: 34, segments: 7 });
  rig.parts.push(
    { key: 'aura', x: -21, y: 2, w: 7, h: 8, color: 'glow', z: 0 },
    { key: 'crest', x: 5, y: 9, w: 8, h: 5, color: 'accent', z: 8 },
    { key: 'crest', x: -4, y: 8, w: 7, h: 4, color: 'accentBright', z: 7 },
  );
  rig.pixelHeight = 16;
  return rig;
}

function clockBeetleRig(): SpriteRig {
  const rig = arachnidRig({ height: 8, span: 12, legPairs: 3 });
  rig.parts.push(
    { key: 'torso', x: -7, y: 3, w: 14, h: 10, color: 'body', z: 6 },
    { key: 'face', x: -4, y: 6, w: 8, h: 6, color: 'accentBright', z: 7 },
    { key: 'crest', x: -1, y: 7, w: 2, h: 5, color: 'bodyDark', z: 8 },
  );
  rig.pixelHeight = 15;
  return rig;
}

function solarOwlRig(): SpriteRig {
  const rig = blobRig({ height: 13, width: 14, wings: true, spikes: true });
  rig.parts.push(
    { key: 'aura', x: -14, y: 4, w: 28, h: 6, color: 'glow', z: 0 },
    { key: 'crest', x: -6, y: 13, w: 12, h: 4, color: 'accentBright', z: 8 },
    { key: 'face', x: -5, y: 7, w: 10, h: 4, color: 'skin', z: 9 },
  );
  rig.pixelHeight = 18;
  return rig;
}

function shadowMantisRig(): SpriteRig {
  const rig = arachnidRig({ height: 12, span: 14, legPairs: 2 });
  rig.parts.push(
    { key: 'crest', x: -11, y: 8, w: 4, h: 10, color: 'accent', z: 8 },
    { key: 'crest', x: 7, y: 8, w: 4, h: 10, color: 'accent', z: 8 },
    { key: 'aura', x: -8, y: 2, w: 16, h: 4, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 19;
  return rig;
}

function glitchFoxRig(): SpriteRig {
  const rig = quadrupedRig({ height: 13, length: 18, ears: true });
  rig.parts.push(
    { key: 'aura', x: -14, y: 5, w: 8, h: 11, color: 'glow', z: 0 },
    { key: 'crest', x: 6, y: 10, w: 3, h: 4, color: 'accentBright', z: 8 },
    { key: 'aura', x: -4, y: 1, w: 8, h: 3, color: 'accent', z: 0 },
  );
  rig.pixelHeight = 17;
  return rig;
}

function magnetUrsaRig(): SpriteRig {
  const rig = quadrupedRig({ height: 16, length: 20, ears: true });
  rig.parts.push(
    { key: 'aura', x: -12, y: 7, w: 24, h: 8, color: 'glow', z: 0 },
    { key: 'crest', x: -5, y: 14, w: 10, h: 5, color: 'accentBright', z: 8 },
    { key: 'torso', x: -6, y: 4, w: 12, h: 8, color: 'bodyDark', z: 6 },
  );
  rig.pixelHeight = 20;
  return rig;
}

function cyberHydraRig(): SpriteRig {
  const rig = serpentRig({ segments: 4, thickness: 12 });
  rig.parts.push(
    { key: 'crest', x: -8, y: 12, w: 4, h: 6, color: 'accent', z: 9 },
    { key: 'crest', x: 0, y: 15, w: 5, h: 7, color: 'accentBright', z: 9 },
    { key: 'crest', x: 8, y: 12, w: 4, h: 6, color: 'accent', z: 9 },
    { key: 'aura', x: -10, y: 3, w: 20, h: 5, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 22;
  return rig;
}

function plasmaKitsuneRig(): SpriteRig {
  const rig = quadrupedRig({ height: 14, length: 18, ears: true });
  rig.parts.push(
    { key: 'aura', x: -16, y: 6, w: 10, h: 12, color: 'glow', z: 0 },
    { key: 'aura', x: -12, y: 10, w: 8, h: 10, color: 'accentBright', z: 0 },
    { key: 'crest', x: 5, y: 11, w: 4, h: 5, color: 'accent', z: 8 },
  );
  rig.pixelHeight = 19;
  return rig;
}

function nanoPhoenixRig(): SpriteRig {
  const rig = blobRig({ height: 14, width: 15, wings: true, spikes: true });
  rig.parts.push(
    { key: 'aura', x: -15, y: 2, w: 30, h: 8, color: 'glow', z: 0 },
    { key: 'crest', x: -5, y: 14, w: 10, h: 6, color: 'accentBright', z: 8 },
    { key: 'face', x: -4, y: 8, w: 8, h: 4, color: 'skin', z: 9 },
  );
  rig.pixelHeight = 20;
  return rig;
}

function titanColossusRig(): SpriteRig {
  const rig = blobRig({ height: 18, width: 18, spikes: true, tendrils: true });
  rig.parts.push(
    { key: 'torso', x: -9, y: 4, w: 18, h: 12, color: 'bodyDark', z: 5 },
    { key: 'crest', x: -7, y: 15, w: 14, h: 6, color: 'accentBright', z: 9 },
    { key: 'aura', x: -12, y: 1, w: 24, h: 4, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 23;
  return rig;
}

function chronoHareRig(): SpriteRig {
  const rig = quadrupedRig({ height: 15, length: 15, ears: true });
  rig.parts.push(
    { key: 'crest', x: 3, y: 15, w: 3, h: 8, color: 'accentBright', z: 9 },
    { key: 'crest', x: 6, y: 15, w: 3, h: 8, color: 'accentBright', z: 9 },
    { key: 'aura', x: -8, y: 3, w: 18, h: 5, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 21;
  return rig;
}

function byteSerpentRig(): SpriteRig {
  const rig = serpentRig({ segments: 5, thickness: 11 });
  rig.parts.push(
    { key: 'crest', x: 4, y: 11, w: 5, h: 5, color: 'accentBright', z: 9 },
    { key: 'aura', x: -12, y: 3, w: 22, h: 5, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 18;
  return rig;
}

function cosmicAxolotlRig(): SpriteRig {
  const rig = quadrupedRig({ height: 12, length: 17, ears: true });
  rig.parts.push(
    { key: 'crest', x: 5, y: 8, w: 6, h: 8, color: 'accentBright', z: 9 },
    { key: 'crest', x: -3, y: 8, w: 4, h: 7, color: 'accent', z: 8 },
    { key: 'aura', x: -14, y: 4, w: 26, h: 6, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 18;
  return rig;
}

function stormGriffinRig(): SpriteRig {
  const rig = blobRig({ height: 15, width: 16, wings: true, spikes: true });
  rig.parts.push(
    { key: 'crest', x: 4, y: 14, w: 6, h: 6, color: 'accentBright', z: 9 },
    { key: 'aura', x: -14, y: 3, w: 28, h: 6, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 21;
  return rig;
}

function k9HoundRig(): SpriteRig {
  const rig = quadrupedRig({ height: 15, length: 18, ears: true });
  rig.parts.push(
    // Uniform "vest" band across the torso reads as police gear at this scale.
    { key: 'torso', x: -6, y: 5, w: 12, h: 3, color: 'accent', z: 3 },
    { key: 'crest', x: -1, y: 12, w: 2, h: 2, color: 'accentBright', z: 8 },
  );
  return rig;
}

function wolfRig(): SpriteRig {
  const rig = quadrupedRig({ height: 17, length: 20, ears: true });
  rig.parts.push(
    { key: 'crest', x: 6, y: 13, w: 3, h: 3, color: 'bodyDark', z: 8 },
    { key: 'aura', x: -12, y: 2, w: 6, h: 4, color: 'glow', z: 0 },
  );
  return rig;
}

function digiWolfRig(): SpriteRig {
  const rig = quadrupedRig({ height: 17, length: 20, ears: true });
  rig.parts.push(
    { key: 'aura', x: -13, y: 1, w: 8, h: 5, color: 'glow', z: 0 },
    { key: 'aura', x: 5, y: 2, w: 7, h: 4, color: 'accent', z: 0 },
    { key: 'crest', x: 6, y: 13, w: 3, h: 3, color: 'accentBright', z: 8 },
  );
  rig.pixelHeight = 20;
  return rig;
}

function terraGargoyleRig(): SpriteRig {
  const rig = blobRig({ height: 16, width: 15, wings: true, spikes: true });
  rig.parts.push(
    { key: 'torso', x: -8, y: 3, w: 16, h: 10, color: 'bodyDark', z: 5 },
    { key: 'crest', x: -5, y: 14, w: 10, h: 5, color: 'accentBright', z: 8 },
    { key: 'aura', x: -10, y: 1, w: 20, h: 4, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 21;
  return rig;
}

function aeroRaptorRig(): SpriteRig {
  const rig = blobRig({ height: 14, width: 17, wings: true, spikes: true });
  rig.parts.push(
    { key: 'crest', x: 3, y: 13, w: 7, h: 5, color: 'accentBright', z: 9 },
    { key: 'aura', x: -15, y: 3, w: 30, h: 5, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 19;
  return rig;
}

function photonLynxRig(): SpriteRig {
  const rig = quadrupedRig({ height: 14, length: 17, ears: true });
  rig.parts.push(
    { key: 'crest', x: 5, y: 12, w: 4, h: 4, color: 'accentBright', z: 8 },
    { key: 'aura', x: -10, y: 2, w: 20, h: 6, color: 'glow', z: 0 },
    { key: 'aura', x: -4, y: 6, w: 8, h: 8, color: 'accent', z: 0 },
  );
  rig.pixelHeight = 18;
  return rig;
}

function nullAbyssRig(): SpriteRig {
  const rig = blobRig({ height: 16, width: 16, tendrils: true });
  rig.parts.push(
    { key: 'torso', x: -6, y: 4, w: 12, h: 10, color: 'bodyDark', z: 4 },
    { key: 'aura', x: -12, y: 2, w: 24, h: 8, color: 'glow', z: 0 },
    { key: 'crest', x: -3, y: 12, w: 6, h: 6, color: 'accentBright', z: 8 },
  );
  rig.pixelHeight = 20;
  return rig;
}

function cyberPangolinRig(): SpriteRig {
  const rig = quadrupedRig({ height: 13, length: 18 });
  rig.parts.push(
    { key: 'torso', x: -8, y: 4, w: 16, h: 9, color: 'accent', z: 6 },
    { key: 'crest', x: -6, y: 11, w: 12, h: 4, color: 'accentBright', z: 8 },
    { key: 'aura', x: -8, y: 1, w: 16, h: 3, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 17;
  return rig;
}

function ionPegasusRig(): SpriteRig {
  const rig = quadrupedRig({ height: 16, length: 19, ears: true });
  rig.parts.push(
    { key: 'aura', x: -12, y: 6, w: 12, h: 12, color: 'glow', z: 0 },
    { key: 'crest', x: 2, y: 12, w: 6, h: 8, color: 'accentBright', z: 8 },
    { key: 'aura', x: -14, y: 2, w: 28, h: 4, color: 'accent', z: 0 },
  );
  rig.pixelHeight = 22;
  return rig;
}

function glitchDragonRig(): SpriteRig {
  const rig = serpentRig({ segments: 6, thickness: 13 });
  rig.parts.push(
    { key: 'crest', x: 5, y: 13, w: 6, h: 6, color: 'accentBright', z: 9 },
    { key: 'crest', x: -4, y: 12, w: 4, h: 5, color: 'accent', z: 9 },
    { key: 'aura', x: -14, y: 2, w: 28, h: 6, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 22;
  return rig;
}

function apexChimeraRig(): SpriteRig {
  const rig = quadrupedRig({ height: 18, length: 22, ears: true });
  rig.parts.push(
    { key: 'crest', x: -2, y: 15, w: 6, h: 7, color: 'accentBright', z: 9 },
    { key: 'crest', x: 4, y: 13, w: 5, h: 5, color: 'accent', z: 8 },
    { key: 'aura', x: -16, y: 4, w: 12, h: 14, color: 'glow', z: 0 },
    { key: 'aura', x: 4, y: 4, w: 12, h: 14, color: 'accentBright', z: 0 },
  );
  rig.pixelHeight = 24;
  return rig;
}

function cyberLeviathanRig(): SpriteRig {
  const rig = serpentRig({ segments: 8, thickness: 15 });
  rig.parts.push(
    { key: 'crest', x: 6, y: 14, w: 8, h: 7, color: 'accentBright', z: 9 },
    { key: 'crest', x: -6, y: 11, w: 7, h: 5, color: 'accent', z: 8 },
    { key: 'aura', x: -18, y: 2, w: 36, h: 8, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 25;
  return rig;
}

function solarSeraphRig(): SpriteRig {
  const rig = blobRig({ height: 16, width: 14, wings: true, spikes: true });
  rig.parts.push(
    { key: 'crest', x: -4, y: 16, w: 8, h: 6, color: 'accentBright', z: 9 },
    { key: 'aura', x: -18, y: 4, w: 36, h: 12, color: 'glow', z: 0 },
    { key: 'aura', x: -10, y: 8, w: 20, h: 8, color: 'accent', z: 1 },
  );
  rig.pixelHeight = 24;
  return rig;
}

function chronoValkyrieRig(): SpriteRig {
  const rig = blobRig({ height: 17, width: 13, wings: true, spikes: true });
  rig.parts.push(
    { key: 'crest', x: -2, y: 15, w: 4, h: 8, color: 'accentBright', z: 9 },
    { key: 'torso', x: -7, y: 4, w: 14, h: 11, color: 'bodyDark', z: 5 },
    { key: 'aura', x: -12, y: 2, w: 24, h: 6, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 23;
  return rig;
}

function abyssBehemothRig(): SpriteRig {
  const rig = quadrupedRig({ height: 20, length: 24, ears: true });
  rig.parts.push(
    { key: 'torso', x: -10, y: 5, w: 20, h: 14, color: 'bodyDark', z: 5 },
    { key: 'crest', x: -6, y: 16, w: 12, h: 6, color: 'accentBright', z: 8 },
    { key: 'aura', x: -14, y: 2, w: 28, h: 10, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 26;
  return rig;
}

function quantumKirinRig(): SpriteRig {
  const rig = quadrupedRig({ height: 17, length: 20, ears: true });
  rig.parts.push(
    { key: 'crest', x: 2, y: 16, w: 4, h: 9, color: 'accentBright', z: 9 },
    { key: 'aura', x: -14, y: 3, w: 28, h: 8, color: 'glow', z: 0 },
    { key: 'crest', x: -10, y: 6, w: 6, h: 8, color: 'accent', z: 7 },
  );
  rig.pixelHeight = 23;
  return rig;
}

function dustMiteRig(): SpriteRig {
  const rig = blobRig({ height: 11, width: 13, tendrils: true });
  rig.parts.push(
    { key: 'legL', x: -8, y: 1, w: 3, h: 2, color: 'accent', z: 0 },
    { key: 'legL', x: -7, y: 5, w: 3, h: 2, color: 'accent', z: 0 },
    { key: 'legL', x: -6, y: 9, w: 3, h: 2, color: 'accent', z: 0 },
    { key: 'legR', x: 5, y: 1, w: 3, h: 2, color: 'accent', z: 0 },
    { key: 'legR', x: 4, y: 5, w: 3, h: 2, color: 'accent', z: 0 },
    { key: 'legR', x: 3, y: 9, w: 3, h: 2, color: 'accent', z: 0 },
    { key: 'crest', x: -3, y: 12, w: 6, h: 3, color: 'accentBright', z: 8 },
    { key: 'aura', x: -4, y: 3, w: 8, h: 6, color: 'glow', z: 1 },
  );
  rig.pixelHeight = 16;
  return rig;
}

function dataSlothRig(): SpriteRig {
  const rig = quadrupedRig({ height: 14, length: 18, ears: true });
  rig.parts.push(
    { key: 'crest', x: -8, y: 12, w: 4, h: 6, color: 'accent', z: 8 },
    { key: 'armL', x: -10, y: 2, w: 5, h: 3, color: 'accentBright', z: 7 },
    { key: 'armR', x: 5, y: 2, w: 5, h: 3, color: 'accentBright', z: 7 },
    { key: 'aura', x: -6, y: 4, w: 12, h: 4, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 18;
  return rig;
}

function circuitFrogRig(): SpriteRig {
  const rig = blobRig({ height: 13, width: 15, spikes: false });
  rig.parts.push(
    { key: 'legL', x: -10, y: 1, w: 4, h: 4, color: 'accent', z: 0 },
    { key: 'legR', x: 6, y: 1, w: 4, h: 4, color: 'accent', z: 0 },
    { key: 'crest', x: -5, y: 11, w: 3, h: 3, color: 'glow', z: 9 },
    { key: 'crest', x: 2, y: 11, w: 3, h: 3, color: 'glow', z: 9 },
    { key: 'aura', x: -3, y: 4, w: 6, h: 5, color: 'accentBright', z: 8 },
  );
  rig.pixelHeight = 16;
  return rig;
}

function pixelBirdRig(): SpriteRig {
  const rig = blobRig({ height: 13, width: 14, wings: true });
  rig.parts.push(
    { key: 'crest', x: -2, y: 13, w: 4, h: 3, color: 'accentBright', z: 9 },
    { key: 'armL', x: -12, y: 4, w: 7, h: 4, color: 'accent', z: 7 },
    { key: 'armR', x: 5, y: 4, w: 7, h: 4, color: 'accent', z: 7 },
    { key: 'aura', x: -4, y: -2, w: 8, h: 4, color: 'glow', z: 0 },
  );
  rig.pixelHeight = 18;
  return rig;
}

const LOKPET_RIGS: Record<LokPetSilhouette, SpriteRig> = {
  pouncer: blobRig({ height: 15, width: 12, tendrils: true }),
  skull: blobRig({ height: 14, width: 11, spikes: true }),
  winglet: blobRig({ height: 13, width: 12, wings: true }),
  spark: blobRig({ height: 10, width: 9 }),
  jelly: blobRig({ height: 17, width: 15 }),
  clockwork: blobRig({ height: 14, width: 12, spikes: true, tendrils: true }),
  'prism-moth': prismMothRig(),
  'void-pup': voidPupRig(),
  'ember-koi': emberKoiRig(),
  'clock-beetle': clockBeetleRig(),
  'solar-owl': solarOwlRig(),
  'shadow-mantis': shadowMantisRig(),
  'glitch-fox': glitchFoxRig(),
  'magnet-ursa': magnetUrsaRig(),
  'cyber-hydra': cyberHydraRig(),
  'plasma-kitsune': plasmaKitsuneRig(),
  'nano-phoenix': nanoPhoenixRig(),
  'titan-colossus': titanColossusRig(),
  'chrono-hare': chronoHareRig(),
  'byte-serpent': byteSerpentRig(),
  'cosmic-axolotl': cosmicAxolotlRig(),
  'storm-griffin': stormGriffinRig(),
  'k9-hound': k9HoundRig(),
  wolf: wolfRig(),
  'digi-wolf': digiWolfRig(),
  'terra-gargoyle': terraGargoyleRig(),
  'aero-raptor': aeroRaptorRig(),
  'photon-lynx': photonLynxRig(),
  'null-abyss': nullAbyssRig(),
  'cyber-pangolin': cyberPangolinRig(),
  'ion-pegasus': ionPegasusRig(),
  'glitch-dragon': glitchDragonRig(),
  'apex-chimera': apexChimeraRig(),
  'cyber-leviathan': cyberLeviathanRig(),
  'solar-seraph': solarSeraphRig(),
  'chrono-valkyrie': chronoValkyrieRig(),
  'abyss-behemoth': abyssBehemothRig(),
  'quantum-kirin': quantumKirinRig(),
  'dust-mite': dustMiteRig(),
  'data-sloth': dataSlothRig(),
  'circuit-frog': circuitFrogRig(),
  'pixel-bird': pixelBirdRig(),
};

export function lokPetRig(silhouette: LokPetSilhouette): SpriteRig {
  return LOKPET_RIGS[silhouette];
}

/** Adapts a LokPet's compact 5-color palette to the rig renderer's shape. */
export function lokPetSpritePalette(palette: LokPetPalette): SpritePalette {
  return {
    ink: palette.bodyDark,
    body: palette.body,
    bodyDark: palette.bodyDark,
    accent: palette.accent,
    accentBright: palette.glow,
    skin: palette.eye,
    glow: palette.glow,
  };
}
