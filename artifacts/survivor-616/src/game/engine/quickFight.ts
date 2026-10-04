/**
 * Quick fight: a short version of the arena battle for the scraps you run
 * into while travelling. It runs on the same engine as the arena (same moves,
 * elements, status effects and enemy AI) but trims it down: one LokPet per
 * side, at most three moves, no trinkets, no finishers, and a hard turn cap so
 * a fight never drags. The opponent's next move is shown before you pick, so
 * every choice is readable.
 *
 * Pure logic only -- no React, no storage. `stepQuickFight` never mutates the
 * state it is given.
 */
import { BATTLE_MOVES } from '@/game/data/lokPetBattles';
import {
  assignBattleMoves,
  chooseEnemyMove,
  createBattle,
  executeMove,
  generateOpponentPet,
} from '@/game/engine/lokPetBattle';
import type { BattlePet, BattleState, LokPetBattleMove } from '@/game/engine/lokPetBattleTypes';
import type { ResolvedTravelEncounterOpponent } from '@/game/travelEncounter';
import type { LokPetElement, LokPetRarity, SavedLokPet } from '@/game/types';

/** Rounds a quick fight can last before it is judged on remaining HP. */
export const QUICK_TURN_CAP = 8;
export const QUICK_MAX_MOVES = 3;
/** Both sides start with enough SP for one skill so the first choice has some bite. */
export const QUICK_START_ENERGY = 30;

const RARITY_LEVEL_BUMP: Record<LokPetRarity, number> = { common: -1, charged: 0, rare: 1, mythic: 2 };

export interface QuickFightState {
  battle: BattleState;
  /** The move the opponent will use after the player picks. Null once the fight is over. */
  intent: LokPetBattleMove | null;
  /** What happened in the last round, oldest line first, for the on-screen recap. */
  lastRoundLog: string[];
}

export type QuickFightOutcome = 'active' | 'won' | 'lost';

export function quickFightOutcome(state: QuickFightState): QuickFightOutcome {
  if (state.battle.phase === 'victory') return 'won';
  if (state.battle.phase === 'defeat') return 'lost';
  return 'active';
}

/** Up to three non-finisher moves, always including a free strike so nobody is stuck waiting on SP. */
export function trimQuickMoves(moves: LokPetBattleMove[]): LokPetBattleMove[] {
  const trimmed = moves.filter((move) => move.kind !== 'ultimate').slice(0, QUICK_MAX_MOVES);
  if (!trimmed.some((move) => move.energyCost === 0)) {
    trimmed.splice(0, trimmed.length, BATTLE_MOVES['tackle']!, ...trimmed.slice(0, QUICK_MAX_MOVES - 1));
  }
  return trimmed;
}

/**
 * Turns a travel-encounter opponent (a street enemy or a wild LokPet) into a
 * battle pet at roughly the player's level. Enemies have no element of their
 * own, so the caller passes the one the card system gives them.
 */
export function buildQuickOpponent(
  opponent: ResolvedTravelEncounterOpponent,
  playerLevel: number,
  enemyElement: LokPetElement = 'none',
): BattlePet {
  const isPet = opponent.kind === 'lokpet' && Boolean(opponent.lokPetRoll);
  const roll = opponent.lokPetRoll;
  const level = Math.max(1, playerLevel + (isPet && roll ? RARITY_LEVEL_BUMP[roll.rarity] : 0));
  const pet = generateOpponentPet(roll?.variantId ?? 'gyro-sentry', level, opponent.name);

  // Same stat curve the arena uses, fed by the opponent's own health and damage.
  pet.maxHp = Math.floor((opponent.hp + 60) * (1 + level * 0.08));
  pet.hp = pet.maxHp;
  pet.attack = Math.floor((opponent.damage + 12) * (1 + level * 0.07));

  if (isPet && roll) {
    pet.silhouette = roll.silhouette;
    pet.palette = roll.palette;
    pet.family = roll.family;
    pet.element = roll.element;
    pet.elementLabel = roll.elementLabel;
    pet.rarity = roll.rarity;
    pet.moves = assignBattleMoves(roll.variantId, roll.element, level, pet.evolutionStage ?? 1);
  } else {
    pet.element = enemyElement;
    pet.elementLabel = enemyElement === 'none' ? 'Street' : enemyElement;
    pet.moves = assignBattleMoves('street-enemy', enemyElement, level, 1);
  }

  pet.moves = trimQuickMoves(pet.moves);
  if (pet.moves.length < 2) {
    const quickClaw = BATTLE_MOVES['quick-claw']!;
    if (!pet.moves.some((move) => move.id === quickClaw.id)) pet.moves.push(quickClaw);
  }
  pet.energy = Math.max(pet.energy, QUICK_START_ENERGY);
  return pet;
}

export function createQuickFight(options: {
  playerPet?: SavedLokPet;
  opponent: ResolvedTravelEncounterOpponent;
  enemyElement?: LokPetElement;
  rand?: () => number;
}): QuickFightState {
  const rand = options.rand ?? Math.random;
  // createBattle supplies the starter companion when the kennel is empty.
  const base = createBattle({
    gameMode: 'quick-fight',
    playerPets: options.playerPet ? [options.playerPet] : [],
  });
  const player = base.playerTeam[0]!;
  player.moves = trimQuickMoves(player.moves);
  player.energy = Math.max(player.energy, QUICK_START_ENERGY);
  player.equippedTrinket = undefined;

  const enemy = buildQuickOpponent(options.opponent, player.level, options.enemyElement);
  const enemyGoesFirst = enemy.speed > player.speed;

  let battle: BattleState = {
    ...base,
    playerTeam: [player],
    activePlayerIndex: 0,
    enemyTeam: [enemy],
    activeEnemyIndex: 0,
    turn: 1,
    currentTurnActor: 'player',
    phase: 'select-action',
    cheerAvailable: false,
    combatLog: [
      {
        id: `log-quick-start-${Date.now()}`,
        text: `${player.name} squares up against ${enemy.name}.`,
        type: 'system',
        timestamp: Date.now(),
      },
    ],
  };

  if (enemyGoesFirst) {
    const opener = chooseEnemyMove(battle, rand);
    if (opener) {
      const opened = settle(executeMove(structuredClone(battle), opener.id, 'enemy'));
      // A free first move is fine, but nobody should lose before they have acted:
      // if it would end the fight, the opponent skips it and the player goes first.
      if (opened.phase === 'select-action') {
        battle = opened;
        // The opener is free, so the round counter starts fresh.
        battle.turn = 1;
      }
    }
  }

  const intent = battle.phase === 'select-action' ? chooseEnemyMove(battle, rand) ?? null : null;
  return { battle, intent, lastRoundLog: [] };
}

/** Marks a pet that burned or shocked down to 0 HP as out, and ends the fight. */
function settle(state: BattleState): BattleState {
  if (state.phase === 'victory' || state.phase === 'defeat') return state;
  const player = state.playerTeam[state.activePlayerIndex]!;
  const enemy = state.enemyTeam[state.activeEnemyIndex]!;
  // If both drop on the same tick the player gets the win.
  if (enemy.hp <= 0) {
    enemy.fainted = true;
    return { ...state, phase: 'victory' };
  }
  if (player.hp <= 0) {
    player.fainted = true;
    return { ...state, phase: 'defeat' };
  }
  return state;
}

/** At the turn cap the pet with the larger share of its HP left wins; a dead heat goes to the player. */
function judgeAtCap(state: BattleState): BattleState {
  const player = state.playerTeam[state.activePlayerIndex]!;
  const enemy = state.enemyTeam[state.activeEnemyIndex]!;
  const playerShare = player.hp / player.maxHp;
  const enemyShare = enemy.hp / enemy.maxHp;
  const won = playerShare >= enemyShare;
  const log = [
    {
      id: `log-quick-cap-${Date.now()}`,
      text: `Turn limit reached. ${won ? player.name : enemy.name} has more HP left and takes it.`,
      type: 'system' as const,
      timestamp: Date.now(),
    },
    ...state.combatLog,
  ];
  return { ...state, combatLog: log, phase: won ? 'victory' : 'defeat' };
}

/** Plays one full round: the chosen player move, then the opponent's telegraphed move. */
export function stepQuickFight(state: QuickFightState, moveId: string, rand: () => number = Math.random): QuickFightState {
  if (state.battle.phase !== 'select-action') return state;
  const before = state.battle.combatLog.length;
  let battle = executeMove(structuredClone(state.battle), moveId, 'player');

  if (battle.phase === 'select-action') {
    const move = state.intent ?? chooseEnemyMove(battle, rand);
    if (move) battle = executeMove(battle, move.id, 'enemy');
  }
  battle = settle(battle);
  if (battle.phase === 'select-action' && battle.turn > QUICK_TURN_CAP) battle = judgeAtCap(battle);

  const added = battle.combatLog.length - before;
  const lastRoundLog = battle.combatLog.slice(0, Math.max(0, added)).map((entry) => entry.text).reverse();
  const intent = battle.phase === 'select-action' ? chooseEnemyMove(battle, rand) ?? null : null;
  return { battle, intent, lastRoundLog };
}
