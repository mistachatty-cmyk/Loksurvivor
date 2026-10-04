import assert from 'node:assert/strict';
import test from 'node:test';
import { BATTLE_MOVES } from './data/lokPetBattles';
import { rollLokPet } from './data/lokPets';
import { ENEMIES_BY_ID } from './data/enemies';
import { moveMatchup, statusChips, describeIntent } from './engine/battleClarity';
import {
  ASSIST_SCALE,
  DEEP_TURN_CAP,
  QUICK_MAX_MOVES,
  cheerQuickFight,
  QUICK_TURN_CAP,
  createQuickFight,
  quickFightOutcome,
  stepQuickFight,
  trimQuickMoves,
} from './engine/quickFight';
import { buildTravelEncounterResultFromOutcome, type ResolvedTravelEncounterOpponent } from './travelEncounter';
import { lokPetRig, lokPetSpritePalette } from './data/lokPets';

function enemyOpponent(): ResolvedTravelEncounterOpponent {
  const enemy = Object.values(ENEMIES_BY_ID)[0]!;
  return { kind: 'enemy', name: enemy.name, hp: enemy.hp, damage: enemy.damage, rig: enemy.rig, palette: enemy.palette, enemyId: enemy.id };
}

function petOpponent(): ResolvedTravelEncounterOpponent {
  const roll = rollLokPet(() => 0.3);
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

test('move matchup follows the element chart and treats guards as support', () => {
  assert.equal(moveMatchup(BATTLE_MOVES['ember-spit']!, 'terra'), 'strong');
  assert.equal(moveMatchup(BATTLE_MOVES['ember-spit']!, 'slow'), 'weak');
  assert.equal(moveMatchup(BATTLE_MOVES['tackle']!, 'fire'), 'normal');
  const guard = Object.values(BATTLE_MOVES).find((move) => move.kind === 'guard');
  assert.ok(guard);
  assert.equal(moveMatchup(guard, 'fire'), 'support');
});

test('status chips merge by type and keep the longest timer', () => {
  const chips = statusChips({
    statusEffects: [
      { type: 'burn', duration: 1, value: 1, sourcePetName: 'a' },
      { type: 'burn', duration: 3, value: 1, sourcePetName: 'b' },
      { type: 'shield', duration: 2, value: 1, sourcePetName: 'c' },
    ],
  });
  assert.equal(chips.length, 2);
  assert.equal(chips.find((chip) => chip.type === 'burn')?.turns, 3);
  assert.equal(chips.find((chip) => chip.type === 'shield')?.tone, 'good');
});

test('intent text names the move and flags a bad matchup for the player', () => {
  assert.match(describeIntent(BATTLE_MOVES['ember-spit']!, 'terra'), /Ember Spit.*strong against you/);
});

test('a quick fight is one pet a side with at most three moves and no finishers', () => {
  for (const opponent of [enemyOpponent(), petOpponent()]) {
    const qf = createQuickFight({ opponent });
    assert.equal(qf.battle.gameMode, 'quick-fight');
    assert.equal(qf.battle.playerTeam.length, 1);
    assert.equal(qf.battle.enemyTeam.length, 1);
    assert.equal(qf.battle.phase, 'select-action');
    assert.equal(qf.battle.turn, 1);
    for (const pet of [qf.battle.playerTeam[0]!, qf.battle.enemyTeam[0]!]) {
      assert.ok(pet.moves.length >= 1 && pet.moves.length <= QUICK_MAX_MOVES);
      assert.ok(pet.moves.every((move) => move.kind !== 'ultimate'));
      assert.ok(pet.moves.some((move) => move.energyCost === 0));
    }
    assert.ok(qf.intent, 'the opponent telegraphs a move');
  }
});

test('trimQuickMoves keeps a free strike even when the list has none', () => {
  const trimmed = trimQuickMoves([BATTLE_MOVES['ember-spit']!, BATTLE_MOVES['frost-shard']!, BATTLE_MOVES['volt-arc']!]);
  assert.ok(trimmed.length <= QUICK_MAX_MOVES);
  assert.ok(trimmed.some((move) => move.energyCost === 0));
});

test('stepping a quick fight leaves the previous state untouched', () => {
  const qf = createQuickFight({ opponent: enemyOpponent() });
  const snapshot = JSON.stringify(qf);
  const next = stepQuickFight(qf, qf.battle.playerTeam[0]!.moves[0]!.id);
  assert.equal(JSON.stringify(qf), snapshot);
  assert.notEqual(next, qf);
  assert.ok(next.lastRoundLog.length > 0);
});

test('the opponent plays the move it telegraphed', () => {
  for (let i = 0; i < 20; i += 1) {
    const qf = createQuickFight({ opponent: enemyOpponent() });
    const intent = qf.intent!;
    const next = stepQuickFight(qf, qf.battle.playerTeam[0]!.moves[0]!.id);
    if (quickFightOutcome(next) === 'won') continue; // player finished it before the opponent moved
    assert.ok(next.lastRoundLog.some((line) => line.includes(intent.name)), `round log mentions ${intent.name}`);
  }
});

test('every quick fight ends within the turn cap', () => {
  for (let i = 0; i < 40; i += 1) {
    let qf = createQuickFight({ opponent: i % 2 === 0 ? enemyOpponent() : petOpponent() });
    let rounds = 0;
    while (quickFightOutcome(qf) === 'active') {
      // Always the free strike: the slowest way to make progress.
      const strike = qf.battle.playerTeam[0]!.moves.find((move) => move.energyCost === 0)!;
      qf = stepQuickFight(qf, strike.id);
      rounds += 1;
      assert.ok(rounds <= QUICK_TURN_CAP + 1, 'fight ran past the cap');
    }
    assert.notEqual(quickFightOutcome(qf), 'active');
    assert.equal(qf.intent, null);
  }
});

test('stepping a finished fight does nothing', () => {
  let qf = createQuickFight({ opponent: enemyOpponent() });
  while (quickFightOutcome(qf) === 'active') qf = stepQuickFight(qf, qf.battle.playerTeam[0]!.moves[0]!.id);
  assert.equal(stepQuickFight(qf, qf.battle.playerTeam[0]!.moves[0]!.id), qf);
});

test('outcome rewards match the classic encounter rules', () => {
  const pet = petOpponent();
  const won = buildTravelEncounterResultFromOutcome('won', pet, () => 0);
  assert.equal(won.caughtLokPet, true);
  assert.ok(won.rewardCred > 0);
  const fled = buildTravelEncounterResultFromOutcome('fled', pet, () => 0);
  assert.equal(fled.caughtLokPet, false);
  assert.equal(fled.rewardCred, 0);
  const lost = buildTravelEncounterResultFromOutcome('lost', enemyOpponent(), () => 0);
  assert.equal(lost.rewardCardCredits, 0);
});

test('the opponent opener can never end the fight before the player acts', () => {
  const realRandom = Math.random;
  // Worst case for the opener: every hit lands, crits, and rolls its status.
  Math.random = () => 0;
  try {
    for (let i = 0; i < 60; i += 1) {
      const roll = rollLokPet(() => (i % 20) / 20 + 0.01);
      const opponent: ResolvedTravelEncounterOpponent = {
        kind: 'lokpet',
        name: roll.name,
        hp: roll.stats.health * 3,
        damage: roll.stats.damage * 3,
        rig: lokPetRig(roll.silhouette),
        palette: lokPetSpritePalette(roll.palette),
        lokPetRoll: roll,
      };
      const qf = createQuickFight({ opponent });
      assert.equal(quickFightOutcome(qf), 'active');
      assert.ok(qf.battle.playerTeam[0]!.hp > 0);
      assert.ok(qf.intent);
    }
  } finally {
    Math.random = realRandom;
  }
});

test('the deep depth keeps finishers, cheer and the longer cap', () => {
  const qf = createQuickFight({ opponent: petOpponent(), depth: 'deep' });
  assert.equal(qf.depth, 'deep');
  assert.equal(qf.turnCap, DEEP_TURN_CAP);
  assert.equal(qf.battle.cheerAvailable, true);
  assert.ok(qf.battle.playerTeam[0]!.moves.some((move) => move.kind === 'ultimate'), 'player keeps the finisher');
  assert.equal(createQuickFight({ opponent: petOpponent() }).turnCap, QUICK_TURN_CAP);
});

test('cheer is free, heals, and can only be used once', () => {
  const qf = createQuickFight({ opponent: petOpponent(), depth: 'deep' });
  const hurt = structuredClone(qf);
  hurt.battle.playerTeam[0]!.hp = 10;
  const turnBefore = hurt.battle.turn;
  const cheered = cheerQuickFight(hurt);
  assert.ok(cheered.battle.playerTeam[0]!.hp > 10);
  assert.equal(cheered.battle.turn, turnBefore);
  assert.equal(cheered.battle.cheerAvailable, false);
  assert.equal(cheerQuickFight(cheered), cheered);
  // Quick fights have no cheer.
  const quick = createQuickFight({ opponent: petOpponent() });
  assert.equal(cheerQuickFight(quick), quick);
});

test('an operator punch lands before the pet moves and is scaled', () => {
  const qf = createQuickFight({ opponent: enemyOpponent(), depth: 'quick' });
  const start = qf.battle.enemyTeam[0]!.hp;
  const strike = qf.battle.playerTeam[0]!.moves.find((move) => move.energyCost === 0)!;
  const next = stepQuickFight(qf, strike.id, Math.random, { kind: 'punch', label: 'Punch', damage: 6 });
  assert.ok(next.lastRoundLog.some((line) => line.includes('Punch hits')));
  assert.ok(next.lastRoundLog.findIndex((line) => line.includes('Punch hits')) < next.lastRoundLog.findIndex((line) => line.includes(strike.name)) || !next.lastRoundLog.some((line) => line.includes(strike.name)));
  assert.ok(next.battle.enemyTeam[0]!.hp <= start - Math.round(6 * ASSIST_SCALE));
});

test('an assist that finishes the opponent wins the fight before anyone else moves', () => {
  const qf = createQuickFight({ opponent: enemyOpponent() });
  const hpBefore = qf.battle.playerTeam[0]!.hp;
  const strike = qf.battle.playerTeam[0]!.moves.find((move) => move.energyCost === 0)!;
  const next = stepQuickFight(qf, strike.id, Math.random, { kind: 'card', label: 'Big Card', damage: 100000 });
  assert.equal(quickFightOutcome(next), 'won');
  assert.equal(next.battle.playerTeam[0]!.hp, hpBefore, 'the opponent never got its move');
});

test('cover shields the pet once per fight', () => {
  const qf = createQuickFight({ opponent: enemyOpponent() });
  const strike = qf.battle.playerTeam[0]!.moves.find((move) => move.energyCost === 0)!;
  const cover = { kind: 'cover' as const, label: 'Cover', damage: 0 };
  const first = stepQuickFight(qf, strike.id, Math.random, cover);
  assert.equal(first.coverUsed, true);
  assert.ok(first.battle.playerTeam[0]!.statusEffects.some((effect) => effect.type === 'shield'));
  if (quickFightOutcome(first) === 'active') {
    assert.equal(stepQuickFight(first, strike.id, Math.random, cover), first, 'second cover is refused');
  }
});

test('a heal assist restores the pet', () => {
  const qf = createQuickFight({ opponent: enemyOpponent() });
  qf.battle.playerTeam[0]!.hp = 20;
  const strike = qf.battle.playerTeam[0]!.moves.find((move) => move.energyCost === 0)!;
  const next = stepQuickFight(qf, strike.id, Math.random, { kind: 'card', label: 'Ally Card', damage: 0, heal: 6 });
  assert.ok(next.lastRoundLog.some((line) => line.includes('patches')));
});
