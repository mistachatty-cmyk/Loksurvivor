/**
 * Quick fight: a short version of the arena battle for the scraps you run
 * into while travelling. It runs on the same engine as the arena (same moves,
 * elements, status effects and enemy AI) but trims it down: one LokPet per
 * side, at most three moves, no trinkets, no finishers, and a hard turn cap so
 * a fight never drags. The opponent's next move is shown before you pick, so
 * every choice is readable.
 *
 * `quick` stays one LokPet a side; Duo and Arena can bring the selected team and
 * swap the active pet mid-fight (see `switchQuickFight`).
 *
 * Two depths share this file. `quick` is the trimmed version above. `deep`
 * is the full arena treatment (all moves including the finisher, trinkets,
 * Cheer, a 20-round cap) for the Arena fight style. Either depth can also take
 * an operator assist each round (the Duo style), see `OperatorAssist`.
 *
 * Pure logic only -- no React, no storage. `stepQuickFight` never mutates the
 * state it is given.
 */
import { BATTLE_MOVES } from '@/game/data/lokPetBattles';
import {
  assignBattleMoves,
  chooseEnemyMove,
  createBattle,
  executeCheer,
  executeMove,
  executeSwitch,
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
export const DEEP_TURN_CAP = 20;
/**
 * Operator assists were tuned for the classic popup's 50 HP scrap. Pets here
 * carry a few hundred HP, so assist numbers are scaled up to stay worth a turn.
 */
export const ASSIST_SCALE = 3.5;

export type FightDepth = 'quick' | 'deep';

/** What the operator does alongside the pet's move in the Duo style. */
export interface OperatorAssist {
  kind: 'punch' | 'card' | 'cover';
  label: string;
  /** Classic-popup damage units; scaled by ASSIST_SCALE before it lands. */
  damage: number;
  /** Classic-popup heal units for the pet, scaled the same way. */
  heal?: number;
}

const RARITY_LEVEL_BUMP: Record<LokPetRarity, number> = { common: -1, charged: 0, rare: 1, mythic: 2 };

export interface QuickFightState {
  battle: BattleState;
  depth: FightDepth;
  /** Rounds before the fight is judged on remaining HP. */
  turnCap: number;
  /** Cover (the operator's shield) can be called once per fight. */
  coverUsed: boolean;
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
  depth: FightDepth = 'quick',
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

  if (depth === 'quick') pet.moves = trimQuickMoves(pet.moves);
  if (pet.moves.length < 2) {
    const quickClaw = BATTLE_MOVES['quick-claw']!;
    if (!pet.moves.some((move) => move.id === quickClaw.id)) pet.moves.push(quickClaw);
  }
  pet.energy = Math.max(pet.energy, QUICK_START_ENERGY);
  return pet;
}

export function createQuickFight(options: {
  /** One lead pet. Kept for callers that never bring a team. */
  playerPet?: SavedLokPet;
  /** The selected team, lead first. Only used when `maxTeam` is above 1. */
  playerPets?: SavedLokPet[];
  /** How many pets the player may bring (Duo and Arena pass the loadout size). Defaults to 1. */
  maxTeam?: number;
  opponent: ResolvedTravelEncounterOpponent;
  enemyElement?: LokPetElement;
  depth?: FightDepth;
  rand?: () => number;
}): QuickFightState {
  const rand = options.rand ?? Math.random;
  const depth = options.depth ?? 'quick';
  const roster = options.playerPets ?? (options.playerPet ? [options.playerPet] : []);
  // createBattle supplies the starter companion when the kennel is empty.
  const base = createBattle({
    gameMode: 'quick-fight',
    playerPets: roster.slice(0, Math.max(1, options.maxTeam ?? 1)),
  });
  for (const member of base.playerTeam) {
    member.energy = Math.max(member.energy, QUICK_START_ENERGY);
    if (depth === 'quick') {
      member.moves = trimQuickMoves(member.moves);
      // Trinket stats stay baked into the pet; only the label goes.
      member.equippedTrinket = undefined;
    }
  }
  const player = base.playerTeam[0]!;

  const enemy = buildQuickOpponent(options.opponent, player.level, options.enemyElement, depth);
  const enemyGoesFirst = enemy.speed > player.speed;

  let battle: BattleState = {
    ...base,
    playerTeam: base.playerTeam,
    activePlayerIndex: 0,
    enemyTeam: [enemy],
    activeEnemyIndex: 0,
    turn: 1,
    currentTurnActor: 'player',
    phase: 'select-action',
    cheerAvailable: depth === 'deep',
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
  return {
    battle,
    depth,
    turnCap: depth === 'deep' ? DEEP_TURN_CAP : QUICK_TURN_CAP,
    coverUsed: false,
    intent,
    lastRoundLog: [],
  };
}

/**
 * Ends the fight when a side is out of pets. The engine already sends in the
 * next teammate when the active pet faints in a move or a status tick; this
 * catches an operator assist that drops an enemy and an active pet left at 0 HP.
 */
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
    const nextIndex = state.playerTeam.findIndex((member) => !member.fainted);
    if (nextIndex === -1) return { ...state, phase: 'defeat' };
    state.combatLog.unshift({
      id: `log-switch-quick-${Date.now()}`,
      text: `Go, ${state.playerTeam[nextIndex]!.name}!`,
      type: 'switch',
      timestamp: Date.now(),
    });
    return { ...state, activePlayerIndex: nextIndex };
  }
  return state;
}

/** At the turn cap the pet with the larger share of its HP left wins; a dead heat goes to the player. */
function judgeAtCap(state: BattleState): BattleState {
  const player = state.playerTeam[state.activePlayerIndex]!;
  const enemy = state.enemyTeam[state.activeEnemyIndex]!;
  // The whole team's HP counts, so a swapped-in reserve is not punished for the lead's damage.
  const playerShare = state.playerTeam.reduce((sum, pet) => sum + Math.max(0, pet.hp), 0)
    / state.playerTeam.reduce((sum, pet) => sum + pet.maxHp, 0);
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

/** Applies the operator's half of the round to a cloned battle. Returns true when it ended the fight. */
function applyAssist(battle: BattleState, assist: OperatorAssist): BattleState {
  const player = battle.playerTeam[battle.activePlayerIndex]!;
  const enemy = battle.enemyTeam[battle.activeEnemyIndex]!;
  const log = (text: string) =>
    battle.combatLog.unshift({ id: `log-assist-${Date.now()}-${Math.random()}`, text, type: 'action', timestamp: Date.now() });

  if (assist.kind === 'cover') {
    player.statusEffects.push({ type: 'shield', duration: 2, value: player.defense, sourcePetName: 'Operator' });
    log(`Your operator covers ${player.name}: damage halved for two rounds.`);
  }
  if (assist.heal && assist.heal > 0) {
    const healed = Math.round(assist.heal * ASSIST_SCALE);
    player.hp = Math.min(player.maxHp, player.hp + healed);
    log(`Your operator patches ${player.name} up for ${healed} HP.`);
  }
  if (assist.damage > 0) {
    const dealt = Math.max(1, Math.round(assist.damage * ASSIST_SCALE));
    enemy.hp = Math.max(0, enemy.hp - dealt);
    log(`${assist.label} hits ${enemy.name} for ${dealt} damage.`);
  }
  return settle(battle);
}

/** Plays one full round: the operator's assist (Duo), the chosen player move, then the opponent's telegraphed move. */
export function stepQuickFight(
  state: QuickFightState,
  moveId: string,
  rand: () => number = Math.random,
  assist?: OperatorAssist,
): QuickFightState {
  if (state.battle.phase !== 'select-action') return state;
  if (assist?.kind === 'cover' && state.coverUsed) return state;
  const before = state.battle.combatLog.length;
  let battle = structuredClone(state.battle);
  if (assist) battle = applyAssist(battle, assist);

  if (battle.phase === 'select-action') {
    battle = executeMove(battle, moveId, 'player');
    if (battle.phase === 'select-action') {
      const move = state.intent ?? chooseEnemyMove(battle, rand);
      if (move) battle = executeMove(battle, move.id, 'enemy');
    }
  }
  return closeRound(state, battle, before, rand, assist?.kind === 'cover');
}

/** Judges the round just played and recomputes the recap and the opponent's next telegraph. */
function closeRound(
  state: QuickFightState,
  played: BattleState,
  logLengthBefore: number,
  rand: () => number,
  coverCalled: boolean,
): QuickFightState {
  let battle = settle(played);
  if (battle.phase === 'select-action' && battle.turn > state.turnCap) battle = judgeAtCap(battle);

  const added = battle.combatLog.length - logLengthBefore;
  const lastRoundLog = battle.combatLog.slice(0, Math.max(0, added)).map((entry) => entry.text).reverse();
  const intent = battle.phase === 'select-action' ? chooseEnemyMove(battle, rand) ?? null : null;
  return {
    ...state,
    battle,
    intent,
    lastRoundLog,
    coverUsed: state.coverUsed || coverCalled,
  };
}

/** Pets the player could still swap to: alive and not already out. */
export function switchTargets(state: QuickFightState): number[] {
  return state.battle.playerTeam
    .map((pet, index) => (pet.fainted || index === state.battle.activePlayerIndex ? -1 : index))
    .filter((index) => index >= 0);
}

/**
 * Swaps the active LokPet. It costs the player's turn, so the opponent still
 * plays the move it telegraphed -- now against the pet that just came in.
 */
export function switchQuickFight(
  state: QuickFightState,
  targetIndex: number,
  rand: () => number = Math.random,
): QuickFightState {
  if (state.battle.phase !== 'select-action') return state;
  if (!switchTargets(state).includes(targetIndex)) return state;
  const before = state.battle.combatLog.length;
  let battle = executeSwitch(structuredClone(state.battle), targetIndex);
  const move = state.intent ?? chooseEnemyMove(battle, rand);
  if (move) battle = executeMove(battle, move.id, 'enemy');
  return closeRound(state, battle, before, rand, false);
}

/** Arena style only: the handler's once-per-fight Cheer. It is free, so the round does not advance. */
export function cheerQuickFight(state: QuickFightState): QuickFightState {
  if (state.battle.phase !== 'select-action' || !state.battle.cheerAvailable) return state;
  const before = state.battle.combatLog.length;
  const battle = executeCheer(structuredClone(state.battle));
  const added = battle.combatLog.length - before;
  return { ...state, battle, lastRoundLog: battle.combatLog.slice(0, Math.max(0, added)).map((e) => e.text).reverse() };
}
