import assert from 'node:assert/strict';
import test from 'node:test';
import { createRng } from '@/game/engine/math';
import { createInitialMeta, reducer } from '@/game/state/metaStore';
import { ENEMIES_BY_ID } from '@/game/data/enemies';
import { CARD_MANIFESTS } from '@/game/data/cards';
import { HUB_ROOMS } from '@/game/data/progression';
import {
  BASE_CARD_THROW_DAMAGE,
  TRAVEL_ENCOUNTER_OPPONENTS,
  TRAVEL_ENCOUNTER_REWARD,
  TRAVEL_ENCOUNTER_TRIGGERS,
  UNARMED_PUNCH_DAMAGE,
  cardThrowDamage,
} from './data/travelEncounters';
import {
  applyFlee,
  applyOpponentAttack,
  applyPlayerAttack,
  buildTravelEncounterResult,
  createTravelEncounterState,
  pickTravelEncounterOpponent,
  resolveTravelEncounterOpponent,
  type TravelEncounterResult,
} from './travelEncounter';

test('same seed resolves the same opponent every time', () => {
  const a = resolveTravelEncounterOpponent(pickTravelEncounterOpponent(createRng(616)), createRng(616));
  const b = resolveTravelEncounterOpponent(pickTravelEncounterOpponent(createRng(616)), createRng(616));
  assert.equal(a.kind, b.kind);
  assert.equal(a.name, b.name);
});

test('every curated enemy id resolves and every lokpet roll is populated', () => {
  for (const entry of TRAVEL_ENCOUNTER_OPPONENTS) {
    if (entry.opponent.kind === 'enemy') assert.ok(ENEMIES_BY_ID[entry.opponent.enemyId], `missing enemy id: ${entry.opponent.enemyId}`);
  }
  const resolved = resolveTravelEncounterOpponent({ kind: 'lokpet' }, createRng(1));
  assert.ok(resolved.lokPetRoll);
  assert.ok(resolved.hp > 0);
});

test('every hub-room trigger points at a real HubRoomDef id', () => {
  const hubRoomIds = new Set(HUB_ROOMS.map((room) => room.id));
  for (const trigger of TRAVEL_ENCOUNTER_TRIGGERS) {
    if (trigger.source === 'hub-room') assert.ok(trigger.roomId && hubRoomIds.has(trigger.roomId), `missing hub room id: ${trigger.roomId}`);
  }
});

test('a scripted attack sequence drives status to won with exact hp/round', () => {
  let state = createTravelEncounterState({ name: 'Player', maxHp: 20, hp: 20 }, { name: 'Foe', maxHp: 15, hp: 15 });
  state = applyPlayerAttack(state, 10);
  assert.equal(state.status, 'active');
  assert.equal(state.opponent.hp, 5);
  state = applyOpponentAttack(state, 4);
  assert.equal(state.round, 2);
  assert.equal(state.player.hp, 16);
  state = applyPlayerAttack(state, 5);
  assert.equal(state.status, 'won');
  assert.equal(state.opponent.hp, 0);
});

test('a scripted attack sequence drives status to lost with exact hp/round', () => {
  let state = createTravelEncounterState({ name: 'Player', maxHp: 10, hp: 10 }, { name: 'Foe', maxHp: 50, hp: 50 });
  state = applyPlayerAttack(state, 1);
  state = applyOpponentAttack(state, 10);
  assert.equal(state.status, 'lost');
  assert.equal(state.player.hp, 0);
  assert.equal(state.round, 1);
});

test('every apply* call is a no-op once the fight is over', () => {
  let state = createTravelEncounterState({ name: 'Player', maxHp: 10, hp: 10 }, { name: 'Foe', maxHp: 5, hp: 5 });
  state = applyPlayerAttack(state, 100);
  assert.equal(state.status, 'won');
  assert.equal(applyPlayerAttack(state, 5), state);
  assert.equal(applyOpponentAttack(state, 5), state);
  assert.equal(applyFlee(state), state);
});

test('flee ends the fight immediately with no damage exchanged and no reward', () => {
  const state = createTravelEncounterState({ name: 'Player', maxHp: 20, hp: 20 }, { name: 'Foe', maxHp: 20, hp: 20 });
  const fled = applyFlee(state);
  assert.equal(fled.status, 'fled');
  assert.equal(fled.player.hp, 20);
  assert.equal(fled.opponent.hp, 20);
  const opponent = resolveTravelEncounterOpponent({ kind: 'lokpet' }, createRng(2));
  // rng() => 0 would always "catch" if the fled/lost path ran the catch roll -- it must not.
  const result = buildTravelEncounterResult(fled, opponent, () => 0);
  assert.equal(result.outcome, 'fled');
  assert.equal(result.rewardCred, 0);
  assert.equal(result.rewardCardCredits, 0);
  assert.equal(result.caughtLokPet, false);
});

test('a lost fight also yields zero reward regardless of rng', () => {
  const state = createTravelEncounterState({ name: 'Player', maxHp: 5, hp: 0 }, { name: 'Foe', maxHp: 5, hp: 5 });
  const lost = { ...state, status: 'lost' as const };
  const opponent = resolveTravelEncounterOpponent({ kind: 'lokpet' }, createRng(3));
  const result = buildTravelEncounterResult(lost, opponent, () => 0);
  assert.equal(result.rewardCred, 0);
  assert.equal(result.caughtLokPet, false);
});

test('unarmed punch damage is always positive and enough to finish a fight with no battle deck', () => {
  assert.ok(UNARMED_PUNCH_DAMAGE > 0);
  let state = createTravelEncounterState({ name: 'Player', maxHp: 30, hp: 30 }, { name: 'Foe', maxHp: 20, hp: 20 });
  let rounds = 0;
  while (state.status === 'active' && rounds < 50) {
    state = applyPlayerAttack(state, UNARMED_PUNCH_DAMAGE);
    if (state.status === 'active') state = applyOpponentAttack(state, 3);
    rounds += 1;
  }
  assert.equal(state.status, 'won');
});

test('cardThrowDamage scales with rarity and variant, staying within a small multiple of the base', () => {
  const common = cardThrowDamage({ cardId: 'lok.survivor-616.card.scenario-rubber-district', copies: 1, variants: { standard: 1 }, bestVariant: 'standard', totalValue: 1 });
  const holo = cardThrowDamage({ cardId: 'lok.survivor-616.card.scenario-rubber-district', copies: 1, variants: { holo: 1 }, bestVariant: 'holo', totalValue: 1 });
  assert.ok(holo > common);
  assert.ok(holo <= BASE_CARD_THROW_DAMAGE * 3);
  const legendaryCard = CARD_MANIFESTS.find((card) => card.rarity === 'legendary')!;
  const legendary = cardThrowDamage({ cardId: legendaryCard.id, copies: 1, variants: { standard: 1 }, bestVariant: 'standard', totalValue: 1 });
  assert.ok(legendary > common);
});

test('completeTravelEncounter pays out cred/cardCredits and catches a LokPet on a win', () => {
  const state = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
  const lokPetRoll = resolveTravelEncounterOpponent({ kind: 'lokpet' }, createRng(5)).lokPetRoll!;
  const result: TravelEncounterResult = {
    outcome: 'won',
    opponentKind: 'lokpet',
    lokPetRoll,
    caughtLokPet: true,
    rewardCred: TRAVEL_ENCOUNTER_REWARD.cred,
    rewardCardCredits: TRAVEL_ENCOUNTER_REWARD.cardCredits,
  };
  const next = reducer(state, { type: 'completeTravelEncounter', result });
  assert.equal(next.meta.cred, state.meta.cred + TRAVEL_ENCOUNTER_REWARD.cred);
  assert.equal(next.meta.cardCredits, state.meta.cardCredits + TRAVEL_ENCOUNTER_REWARD.cardCredits);
  assert.equal(next.meta.savedLokPets.length, 1);
  assert.equal(next.meta.savedLokPets[0]!.roll.variantId, lokPetRoll.variantId);
});

test('completeTravelEncounter is a no-op on loss or flee', () => {
  const state = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
  const lostResult: TravelEncounterResult = { outcome: 'lost', opponentKind: 'enemy', enemyId: 'nightcrawler', caughtLokPet: false, rewardCred: 0, rewardCardCredits: 0 };
  assert.equal(reducer(state, { type: 'completeTravelEncounter', result: lostResult }), state);
  const fledResult: TravelEncounterResult = { ...lostResult, outcome: 'fled' };
  assert.equal(reducer(state, { type: 'completeTravelEncounter', result: fledResult }), state);
});

test('a win against an enemy counts toward the same Bestiary tally a real run would', () => {
  const state = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
  const wonResult: TravelEncounterResult = { outcome: 'won', opponentKind: 'enemy', enemyId: 'nightcrawler', caughtLokPet: false, rewardCred: TRAVEL_ENCOUNTER_REWARD.cred, rewardCardCredits: TRAVEL_ENCOUNTER_REWARD.cardCredits };
  const next = reducer(state, { type: 'completeTravelEncounter', result: wonResult });
  assert.equal(next.meta.bestiary.nightcrawler, 1);
  const again = reducer(next, { type: 'completeTravelEncounter', result: wonResult });
  assert.equal(again.meta.bestiary.nightcrawler, 2);
});
