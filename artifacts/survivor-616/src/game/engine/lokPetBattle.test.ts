import assert from 'node:assert/strict';
import test from 'node:test';
import { createBattle, executeMove } from './lokPetBattle';
import type { BattlePet, LokPetBattleMove } from './lokPetBattleTypes';

/** Zero-power, always-hit move: every call deals exactly 1 damage (the engine's own floor), so
 * assertions can isolate the status-effect/passive mechanics under test from move randomness. */
const NOOP_STRIKE: LokPetBattleMove = {
  id: 'test-noop-strike',
  name: 'Test Strike',
  element: 'none',
  energyCost: 0,
  power: 0,
  kind: 'strike',
  description: 'test fixture',
  accuracy: 1,
  animation: 'strike',
};

function freshBattle() {
  return createBattle({ gameMode: 'test-sparring', playerPets: [], dummyLevel: 10 });
}

function pinMoves(pet: BattlePet): void {
  pet.moves = [NOOP_STRIKE];
}

test('stun skips the attacker\'s move and clears itself', () => {
  const state = freshBattle();
  pinMoves(state.playerTeam[0]);
  pinMoves(state.enemyTeam[0]);
  const attacker = state.playerTeam[0];
  const defenderHpBefore = state.enemyTeam[0].hp;
  attacker.statusEffects.push({ type: 'stun', duration: 1, value: 0, sourcePetName: 'Tester' });

  const next = executeMove(state, NOOP_STRIKE.id, 'player');

  assert.equal(next.enemyTeam[0].hp, defenderHpBefore, 'a stunned attacker should never land its move');
  assert.equal(next.currentTurnActor, 'enemy', 'turn should flip even though the attacker was stunned');
  assert.ok(!next.playerTeam[0].statusEffects.some((e) => e.type === 'stun'), 'stun should clear after consuming the turn');
  assert.ok(next.combatLog[0].text.includes('stunned'));
});

test('empower scales with the afflicting move\'s own value, not a flat multiplier', () => {
  const low = freshBattle();
  pinMoves(low.playerTeam[0]);
  pinMoves(low.enemyTeam[0]);
  low.playerTeam[0].statusEffects.push({ type: 'empower', duration: 2, value: 10, sourcePetName: 'Tester' });
  low.playerTeam[0].moves = [{ ...NOOP_STRIKE, power: 1 }];
  const lowHpBefore = low.enemyTeam[0].hp;
  const lowResult = executeMove(low, NOOP_STRIKE.id, 'player');
  const lowDamage = lowHpBefore - lowResult.enemyTeam[0].hp;

  const high = freshBattle();
  pinMoves(high.playerTeam[0]);
  pinMoves(high.enemyTeam[0]);
  high.playerTeam[0].statusEffects.push({ type: 'empower', duration: 2, value: 80, sourcePetName: 'Tester' });
  high.playerTeam[0].moves = [{ ...NOOP_STRIKE, power: 1 }];
  const highHpBefore = high.enemyTeam[0].hp;
  const highResult = executeMove(high, NOOP_STRIKE.id, 'player');
  const highDamage = highHpBefore - highResult.enemyTeam[0].hp;

  assert.ok(highDamage > lowDamage, `an 80-value empower (${highDamage}) should hit harder than a 10-value one (${lowDamage})`);
});

test('a leech status effect drains the afflicted pet and heals its source at end of turn', () => {
  const state = freshBattle();
  pinMoves(state.playerTeam[0]);
  pinMoves(state.enemyTeam[0]);
  const enemy = state.enemyTeam[0];
  const player = state.playerTeam[0];
  player.hp = Math.max(1, player.maxHp - 50);
  enemy.statusEffects.push({ type: 'leech', duration: 2, value: 10, sourcePetName: player.name });

  // Player's move flips the turn to the enemy without triggering the end-of-turn tick yet.
  const afterPlayerMove = executeMove(state, NOOP_STRIKE.id, 'player');
  assert.equal(afterPlayerMove.currentTurnActor, 'enemy');

  const enemyHpBeforeTick = afterPlayerMove.enemyTeam[0].hp;
  const playerHpBeforeTick = afterPlayerMove.playerTeam[0].hp;
  const expectedLeechDmg = Math.max(2, Math.floor(enemy.maxHp * 0.1));

  // Enemy's move completes the round (dealing its own guaranteed 1 damage to the player),
  // then runs the end-of-turn leech tick.
  const afterEnemyMove = executeMove(afterPlayerMove, NOOP_STRIKE.id, 'enemy');

  assert.equal(afterEnemyMove.enemyTeam[0].hp, enemyHpBeforeTick - expectedLeechDmg, 'the leeched pet should lose HP equal to the effect value');
  assert.equal(
    afterEnemyMove.playerTeam[0].hp,
    Math.min(afterEnemyMove.playerTeam[0].maxHp, playerHpBeforeTick - 1 + expectedLeechDmg),
    'the leech source should be healed by the same amount (after taking the enemy\'s own hit), capped at its own max HP',
  );
});

test('freeze and slow reduce effective speed, which can let the faster side act again', () => {
  const state = freshBattle();
  pinMoves(state.playerTeam[0]);
  pinMoves(state.enemyTeam[0]);
  state.playerTeam[0].speed = 100;
  state.enemyTeam[0].speed = 100;
  state.currentTurnActor = 'player';
  // Slow the enemy enough that the player becomes dramatically faster (ratio well past the 1.15x threshold).
  state.enemyTeam[0].statusEffects.push({ type: 'slow', duration: 3, value: 60, sourcePetName: 'Tester' });

  const originalRandom = Math.random;
  try {
    Math.random = () => 0; // guarantees the capped extra-turn roll succeeds when the chance is > 0
    const next = executeMove(state, NOOP_STRIKE.id, 'player');
    assert.equal(next.currentTurnActor, 'player', 'a dramatically faster attacker should get to act again instead of the turn flipping');
  } finally {
    Math.random = originalRandom;
  }
});

test('an even speed matchup always flips the turn, regardless of random rolls', () => {
  const state = freshBattle();
  pinMoves(state.playerTeam[0]);
  pinMoves(state.enemyTeam[0]);
  state.playerTeam[0].speed = 100;
  state.enemyTeam[0].speed = 100;
  state.currentTurnActor = 'player';

  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const next = executeMove(state, NOOP_STRIKE.id, 'player');
    assert.equal(next.currentTurnActor, 'enemy', 'equal speed should never trigger the extra-turn mechanic');
  } finally {
    Math.random = originalRandom;
  }
});

test('leech-on-hit specialAbility heals the attacker on every hit it lands', () => {
  const state = freshBattle();
  pinMoves(state.playerTeam[0]);
  pinMoves(state.enemyTeam[0]);
  const attacker = state.playerTeam[0];
  attacker.specialAbility = 'null-consume';
  attacker.hp = Math.max(1, attacker.maxHp - 50);
  attacker.moves = [{ ...NOOP_STRIKE, power: 2 }];

  const hpBefore = attacker.hp;
  const next = executeMove(state, NOOP_STRIKE.id, 'player');

  assert.ok(next.playerTeam[0].hp > hpBefore, 'the attacker should heal some HP back from its leech-on-hit passive');
  assert.ok(next.combatLog.some((entry) => entry.text.includes('null-consume')));
});

test('empower-on-crit specialAbility only fires on an actual critical hit', () => {
  const state = freshBattle();
  pinMoves(state.playerTeam[0]);
  pinMoves(state.enemyTeam[0]);
  const attacker = state.playerTeam[0];
  attacker.specialAbility = 'tri-laser';
  attacker.critRate = 1; // guarantee every hit is a crit

  const originalRandom = Math.random;
  try {
    Math.random = () => 0; // Math.random() < critRate (1) is always true -> crit
    const next = executeMove(state, NOOP_STRIKE.id, 'player');
    assert.ok(next.playerTeam[0].statusEffects.some((e) => e.type === 'empower'), 'a crit should grant the empower-on-crit passive its buff');
  } finally {
    Math.random = originalRandom;
  }
});

test('shield-on-low-hp specialAbility triggers once the defender drops below its threshold', () => {
  const state = freshBattle();
  pinMoves(state.playerTeam[0]);
  pinMoves(state.enemyTeam[0]);
  const defender = state.enemyTeam[0];
  defender.specialAbility = 'silicon-shield';
  // Land the defender just above the 30% threshold so this hit's guaranteed 1 damage (power: 0) crosses it.
  defender.hp = Math.floor(defender.maxHp * 0.3) + 1;
  state.playerTeam[0].moves = [{ ...NOOP_STRIKE, power: 0 }];

  const next = executeMove(state, NOOP_STRIKE.id, 'player');

  assert.ok(next.enemyTeam[0].statusEffects.some((e) => e.type === 'shield'), 'dropping below the threshold should raise the shield');
});
