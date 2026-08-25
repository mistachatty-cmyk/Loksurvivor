import type { PassiveDef } from '@/game/types';

export const PASSIVES: PassiveDef[] = [
  { id: 'gold-chain', name: 'Gold Chain', description: '+12% damage. Evolves Freestyle Mic into Gold Mic.', weight: 7, maxStacks: 1, effects: [{ kind: 'stat', stat: 'power', mult: 1.12 }] },
  { id: 'subwoofer', name: 'Subwoofer', description: '+18% area. Evolves Boombox into Block Party.', weight: 7, maxStacks: 1, effects: [{ kind: 'stat', stat: 'area', mult: 1.18 }] },
  { id: 'vinyl-record', name: 'Vinyl Record', description: 'Attacks come out 12% faster. Evolves Turntable into Double Deck.', weight: 7, maxStacks: 1, effects: [{ kind: 'stat', stat: 'haste', mult: 0.88 }] },
  { id: 'street-map', name: 'Street Map', description: 'Pickups reach you from 45 units further out.', weight: 6, maxStacks: 3, effects: [{ kind: 'stat', stat: 'magnet', add: 45 }] },
  { id: 'steel-toe', name: 'Steel Toe', description: '+20 max HP and 4% damage resistance.', weight: 5, maxStacks: 4, effects: [{ kind: 'stat', stat: 'maxHp', add: 20 }, { kind: 'stat', stat: 'armor', add: 0.04 }] },
  { id: 'torn-page', name: 'Torn Page', description: '+15% damage. Evolves Ledger Page into Full Ledger.', weight: 7, maxStacks: 1, effects: [{ kind: 'stat', stat: 'power', mult: 1.15 }] },
  { id: 'master-key', name: 'Master Key', description: '+16% area. Evolves House Key into Master Key.', weight: 7, maxStacks: 1, effects: [{ kind: 'stat', stat: 'area', mult: 1.16 }] },
];

export const PASSIVES_BY_ID: Record<string, PassiveDef> = Object.fromEntries(PASSIVES.map((passive) => [passive.id, passive]));