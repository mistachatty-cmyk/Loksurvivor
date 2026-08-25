import type { WeaponDef } from '@/game/types';

export const WEAPONS: WeaponDef[] = [
  { id: 'freestyle-mic', name: 'Freestyle Mic', kind: 'melee', description: 'A close-range shockwave with a heavy downbeat.', damage: 18, cooldownMs: 720, range: 78, levelDamageScale: 0.22, color: '#ffb000' },
  { id: 'boombox', name: 'Boombox', kind: 'aura', description: 'Bass rattles every enemy in your personal block.', damage: 8, cooldownMs: 850, range: 92, levelDamageScale: 0.18, color: '#ff5f6d' },
  { id: 'turntable', name: 'Turntable', kind: 'orbit', description: 'Vinyl blades orbit you and punish anyone who gets close.', damage: 12, cooldownMs: 0, range: 58, speed: 2.8, count: 2, levelDamageScale: 0.2, color: '#6ee7ff' },
  { id: 'chain-whip', name: 'Chain Whip', kind: 'projectile', description: 'A long chain tears through the first target it finds.', damage: 22, cooldownMs: 980, range: 360, speed: 420, lifetimeMs: 900, levelDamageScale: 0.2, color: '#ffe08a' },
  { id: 'spray-can', name: 'Spray Can', kind: 'nova', description: 'A paint burst clears a wide circle around you.', damage: 14, cooldownMs: 1250, range: 105, levelDamageScale: 0.2, color: '#7dffb2' },
  { id: 'the-bus', name: 'The Bus', kind: 'sweep', description: 'Every few seconds, a whole city bus crosses the screen.', damage: 42, cooldownMs: 4200, range: 520, speed: 480, lifetimeMs: 1200, levelDamageScale: 0.24, color: '#f59e0b' },
];

export const WEAPONS_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((weapon) => [weapon.id, weapon]));