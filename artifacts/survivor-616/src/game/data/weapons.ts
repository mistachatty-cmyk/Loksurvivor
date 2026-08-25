import type { WeaponDef } from '@/game/types';

export const WEAPONS: WeaponDef[] = [
  { id: 'freestyle-mic', name: 'Freestyle Mic', kind: 'melee', description: 'A close-range shockwave with a heavy downbeat.', damage: 18, cooldownMs: 720, range: 78, levelDamageScale: 0.22, color: '#ffb000' },
  { id: 'boombox', name: 'Boombox', kind: 'aura', description: 'Bass rattles every enemy in your personal block.', damage: 8, cooldownMs: 850, range: 92, levelDamageScale: 0.18, color: '#ff5f6d' },
  { id: 'turntable', name: 'Turntable', kind: 'orbit', description: 'Vinyl blades orbit you and punish anyone who gets close.', damage: 12, cooldownMs: 0, range: 58, speed: 2.8, count: 2, levelDamageScale: 0.2, color: '#6ee7ff' },
  { id: 'chain-whip', name: 'Chain Whip', kind: 'projectile', description: 'A long chain tears through the first target it finds.', damage: 22, cooldownMs: 980, range: 360, speed: 420, lifetimeMs: 900, levelDamageScale: 0.2, color: '#ffe08a' },
  { id: 'spray-can', name: 'Spray Can', kind: 'nova', description: 'A paint burst clears a wide circle around you and freezes what it hits.', damage: 14, cooldownMs: 1250, range: 105, levelDamageScale: 0.2, color: '#7dffb2', statusEffectId: 'freeze' },
  { id: 'the-bus', name: 'The Bus', kind: 'sweep', description: 'Every few seconds, a whole city bus crosses the screen.', damage: 42, cooldownMs: 4200, range: 520, speed: 480, lifetimeMs: 1200, levelDamageScale: 0.24, color: '#f59e0b' },
  { id: 'riot-disc', name: 'Riot Disc', kind: 'projectile', description: 'A hard-light disc that rebounds off reflective surfaces and keeps hunting.', damage: 16, cooldownMs: 820, range: 430, speed: 360, lifetimeMs: 1800, levelDamageScale: 0.2, color: '#a78bfa', obstacleInteraction: 'reflect' },
  { id: 'glassline', name: 'Glassline', kind: 'projectile', description: 'A piercing glass bolt that stops cold behind heavy cover.', damage: 30, cooldownMs: 1100, range: 500, speed: 540, lifetimeMs: 1100, levelDamageScale: 0.24, color: '#67e8f9', obstacleInteraction: 'block' },
  { id: 'glacier-staff', name: 'Glacier Staff', kind: 'projectile', description: 'Launches a cold star that freezes the first thing it strikes.', damage: 18, cooldownMs: 780, range: 390, speed: 330, lifetimeMs: 1800, levelDamageScale: 0.24, color: '#8be9ff', obstacleInteraction: 'block', statusEffectId: 'freeze' },
  { id: 'rift-arc', name: 'Rift Arc', kind: 'projectile', description: 'Throws twin hot-pink tears through the dark, one for each side of the street.', damage: 15, cooldownMs: 760, range: 360, speed: 380, count: 2, lifetimeMs: 1300, levelDamageScale: 0.26, color: '#ff4fa3', obstacleInteraction: 'reflect' },
];

export const WEAPONS_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((weapon) => [weapon.id, weapon]));