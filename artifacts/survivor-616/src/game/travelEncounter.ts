/**
 * Pure turn-based combat logic for the hub-side "travel encounter" minigame.
 * Deliberately isolated from engine/world.ts/stepWorld -- this never touches
 * the real-time simulation. See .agents/memory/travel-encounters.md.
 */
import type { LokPetRoll, SpritePalette, SpriteRig } from '@/game/types';
import { ENEMIES_BY_ID } from './data/enemies';
import { lokPetRig, lokPetSpritePalette, rollLokPet } from './data/lokPets';
import {
  TRAVEL_ENCOUNTER_OPPONENTS,
  TRAVEL_ENCOUNTER_REWARD,
  type TravelEncounterOpponent,
} from './data/travelEncounters';

export interface TravelEncounterCombatant {
  name: string;
  maxHp: number;
  hp: number;
}

export type TravelEncounterStatus = 'active' | 'won' | 'lost' | 'fled';

export interface TravelEncounterTurnLogEntry {
  round: number;
  actor: 'player' | 'opponent';
  damage: number;
  /** Human-readable action description ("Threw Rubber District", "Sent Biscuit", "Threw a punch") for the on-screen log line. */
  label?: string;
}

export interface TravelEncounterState {
  status: TravelEncounterStatus;
  round: number;
  player: TravelEncounterCombatant;
  opponent: TravelEncounterCombatant;
  log: TravelEncounterTurnLogEntry[];
}

export interface ResolvedTravelEncounterOpponent {
  kind: 'enemy' | 'lokpet';
  name: string;
  hp: number;
  damage: number;
  rig: SpriteRig;
  palette: SpritePalette;
  enemyId?: string;
  lokPetRoll?: LokPetRoll;
}

export interface TravelEncounterResult {
  outcome: 'won' | 'lost' | 'fled';
  opponentKind: 'enemy' | 'lokpet';
  enemyId?: string;
  lokPetRoll?: LokPetRoll;
  caughtLokPet: boolean;
  rewardCred: number;
  rewardCardCredits: number;
}

export function pickTravelEncounterOpponent(rng: () => number): TravelEncounterOpponent {
  const total = TRAVEL_ENCOUNTER_OPPONENTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of TRAVEL_ENCOUNTER_OPPONENTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.opponent;
  }
  return TRAVEL_ENCOUNTER_OPPONENTS[0]!.opponent;
}

export function resolveTravelEncounterOpponent(opponent: TravelEncounterOpponent, rng: () => number): ResolvedTravelEncounterOpponent {
  if (opponent.kind === 'lokpet') {
    const roll = rollLokPet(rng);
    return {
      kind: 'lokpet',
      name: roll.name,
      hp: roll.stats.health,
      damage: roll.stats.damage,
      rig: lokPetRig(roll.silhouette),
      palette: lokPetSpritePalette(roll.palette),
      lokPetRoll: roll,
    };
  }
  const enemy = ENEMIES_BY_ID[opponent.enemyId];
  if (!enemy) throw new Error(`Unknown travel encounter enemy id: ${opponent.enemyId}`);
  return {
    kind: 'enemy',
    name: enemy.name,
    hp: enemy.hp,
    damage: enemy.damage,
    rig: enemy.rig,
    palette: enemy.palette,
    enemyId: enemy.id,
  };
}

export function createTravelEncounterState(player: TravelEncounterCombatant, opponent: TravelEncounterCombatant): TravelEncounterState {
  return { status: 'active', round: 1, player: { ...player }, opponent: { ...opponent }, log: [] };
}

/** First half of a round: the player's throw/punch/pet-send lands on the opponent. Round doesn't advance here -- see applyOpponentAttack. */
export function applyPlayerAttack(state: TravelEncounterState, damage: number, label?: string): TravelEncounterState {
  if (state.status !== 'active') return state;
  const hp = Math.max(0, state.opponent.hp - damage);
  const log = [...state.log, { round: state.round, actor: 'player' as const, damage, label }];
  if (hp <= 0) return { ...state, opponent: { ...state.opponent, hp }, status: 'won', log };
  return { ...state, opponent: { ...state.opponent, hp }, log };
}

/** Second half of a round: the opponent retaliates and the round advances. */
export function applyOpponentAttack(state: TravelEncounterState, damage: number): TravelEncounterState {
  if (state.status !== 'active') return state;
  const hp = Math.max(0, state.player.hp - damage);
  const log = [...state.log, { round: state.round, actor: 'opponent' as const, damage }];
  if (hp <= 0) return { ...state, player: { ...state.player, hp }, status: 'lost', log };
  return { ...state, player: { ...state.player, hp }, round: state.round + 1, log };
}

/** Ends the encounter immediately -- no damage exchanged either way, and no penalty. */
export function applyFlee(state: TravelEncounterState): TravelEncounterState {
  if (state.status !== 'active') return state;
  return { ...state, status: 'fled' };
}

export function buildTravelEncounterResult(
  state: TravelEncounterState,
  opponent: ResolvedTravelEncounterOpponent,
  rng: () => number,
): TravelEncounterResult {
  const outcome = state.status === 'won' ? 'won' : state.status === 'lost' ? 'lost' : 'fled';
  const caughtLokPet = outcome === 'won' && opponent.kind === 'lokpet' && rng() < TRAVEL_ENCOUNTER_REWARD.catchChance;
  return {
    outcome,
    opponentKind: opponent.kind,
    enemyId: opponent.enemyId,
    lokPetRoll: opponent.lokPetRoll,
    caughtLokPet,
    rewardCred: outcome === 'won' ? TRAVEL_ENCOUNTER_REWARD.cred : 0,
    rewardCardCredits: outcome === 'won' ? TRAVEL_ENCOUNTER_REWARD.cardCredits : 0,
  };
}
