import assert from 'node:assert/strict';
import test from 'node:test';
import { createRng } from '@/game/engine/math';
import { createInitialMeta, reducer } from '@/game/state/metaStore';
import { ENEMIES_BY_ID } from '@/game/data/enemies';
import { CARD_MANIFESTS, type LokDeckCardMetadata } from '@/game/data/cards';
import { HUB_ROOMS } from '@/game/data/progression';
import type { LokAssetManifest } from '@/game/lok/types';
import {
  ALLY_CARD_HEAL,
  BASE_CARD_THROW_DAMAGE,
  CARD_RARITY_DAMAGE_MULT,
  CARD_SALVAGE_COST,
  CARD_SALVAGE_EARN_RUNS,
  CARD_SUBJECT_DAMAGE_MULT,
  CARD_VARIANT_DAMAGE_MULT,
  LOKPET_CARD_TYPE_BONUS_MULT,
  TRAVEL_ENCOUNTER_OPPONENTS,
  TRAVEL_ENCOUNTER_REWARD,
  TRAVEL_ENCOUNTER_TRIGGERS,
  UNARMED_PUNCH_DAMAGE,
  cardThrowDamage,
  cardThrowOutcome,
} from './data/travelEncounters';

function findCardBySubject(subjectType: LokDeckCardMetadata['subjectType']): LokAssetManifest<LokDeckCardMetadata> {
  const card = CARD_MANIFESTS.find((candidate) => (candidate.metadata as LokDeckCardMetadata | undefined)?.subjectType === subjectType);
  if (!card) throw new Error(`no card found with subjectType ${subjectType}`);
  return card as LokAssetManifest<LokDeckCardMetadata>;
}
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

test('cardThrowDamage applies the subject-type multiplier on top of rarity/variant', () => {
  const characterCard = findCardBySubject('character');
  const record = { cardId: characterCard.id, copies: 1, variants: { standard: 1 } as const, bestVariant: 'standard' as const, totalValue: 1 };
  const expected = Math.round(BASE_CARD_THROW_DAMAGE * CARD_RARITY_DAMAGE_MULT[characterCard.rarity] * CARD_VARIANT_DAMAGE_MULT.standard * CARD_SUBJECT_DAMAGE_MULT.character);
  assert.equal(cardThrowDamage(record), expected);
  // A passiveCards.ts-backed id has no subjectType, so its multiplier stays 1 -- unaffected by this pass.
  const passiveRecord = { cardId: 'lok.survivor-616.card.scenario-rubber-district', copies: 1, variants: { standard: 1 } as const, bestVariant: 'standard' as const, totalValue: 1 };
  assert.equal(cardThrowDamage(passiveRecord), Math.round(BASE_CARD_THROW_DAMAGE * CARD_RARITY_DAMAGE_MULT.common * CARD_VARIANT_DAMAGE_MULT.standard));
});

test('cardThrowOutcome heals on an ally card and adds no bonus against a non-lokpet opponent', () => {
  const allyCard = findCardBySubject('ally');
  const record = { cardId: allyCard.id, copies: 1, variants: { standard: 1 } as const, bestVariant: 'standard' as const, totalValue: 1 };
  const outcome = cardThrowOutcome(record, 'enemy');
  assert.equal(outcome.heal, ALLY_CARD_HEAL);
  assert.equal(outcome.damage, cardThrowDamage(record));
});

test('cardThrowOutcome adds the type-match bonus only when a lokpet card is thrown at a lokpet opponent', () => {
  const lokpetCard = findCardBySubject('lokpet');
  const record = { cardId: lokpetCard.id, copies: 1, variants: { standard: 1 } as const, bestVariant: 'standard' as const, totalValue: 1 };
  const vsEnemy = cardThrowOutcome(record, 'enemy');
  const vsLokpet = cardThrowOutcome(record, 'lokpet');
  assert.equal(vsEnemy.damage, cardThrowDamage(record));
  assert.equal(vsLokpet.damage, Math.round(cardThrowDamage(record) * LOKPET_CARD_TYPE_BONUS_MULT));
  assert.ok(vsLokpet.damage > vsEnemy.damage);
});

test('consumeThrownCard removes one copy and drops the record/battle-deck slot at zero, but is a no-op once Salvage Protocol is unlocked', () => {
  const characterCard = findCardBySubject('character');
  const base = createInitialMeta();
  const meta = {
    ...base,
    cardCollection: [{ cardId: characterCard.id, copies: 2, variants: { standard: 2 }, bestVariant: 'standard' as const, totalValue: 2 }],
    battleDeckCardIds: [characterCard.id],
  };
  const state = { meta, lastRun: null, lastCardPackReveal: null };

  const afterFirstThrow = reducer(state, { type: 'consumeThrownCard', cardId: characterCard.id });
  assert.equal(afterFirstThrow.meta.cardCollection[0]!.copies, 1);
  assert.deepEqual(afterFirstThrow.meta.battleDeckCardIds, [characterCard.id]);

  const afterSecondThrow = reducer(afterFirstThrow, { type: 'consumeThrownCard', cardId: characterCard.id });
  assert.equal(afterSecondThrow.meta.cardCollection.length, 0);
  assert.deepEqual(afterSecondThrow.meta.battleDeckCardIds, []);

  const unlockedState = { meta: { ...meta, cardSalvageUnlocked: true }, lastRun: null, lastCardPackReveal: null };
  assert.equal(reducer(unlockedState, { type: 'consumeThrownCard', cardId: characterCard.id }), unlockedState);
});

test('buyCardSalvageProtocol requires both the earned run count and the CC cost, and only unlocks once', () => {
  const base = createInitialMeta();
  const tooFewRuns = { meta: { ...base, totalRuns: CARD_SALVAGE_EARN_RUNS - 1, cardCredits: CARD_SALVAGE_COST }, lastRun: null, lastCardPackReveal: null };
  assert.equal(reducer(tooFewRuns, { type: 'buyCardSalvageProtocol' }), tooFewRuns);

  const tooPoor = { meta: { ...base, totalRuns: CARD_SALVAGE_EARN_RUNS, cardCredits: CARD_SALVAGE_COST - 1 }, lastRun: null, lastCardPackReveal: null };
  assert.equal(reducer(tooPoor, { type: 'buyCardSalvageProtocol' }), tooPoor);

  const ready = { meta: { ...base, totalRuns: CARD_SALVAGE_EARN_RUNS, cardCredits: CARD_SALVAGE_COST }, lastRun: null, lastCardPackReveal: null };
  const unlocked = reducer(ready, { type: 'buyCardSalvageProtocol' });
  assert.equal(unlocked.meta.cardSalvageUnlocked, true);
  assert.equal(unlocked.meta.cardCredits, 0);

  assert.equal(reducer(unlocked, { type: 'buyCardSalvageProtocol' }), unlocked);
});
