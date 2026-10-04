import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRng } from '@/game/engine/math';
import { rollLokPet } from '@/game/data/lokPets';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, ACHIEVEMENTS_BY_ID } from '@/game/data/achievements';
import { AREAS } from '@/game/data/areas';
import { calculateBattleRewards, chooseEnemyMove, createBattle, executeEnemyAi, getExpForLevel } from '@/game/engine/lokPetBattle';
import {
  BOND_DAILY_CAP,
  BOND_RANKS,
  PET_EXP_SCALE,
  PET_NAME_SLOTS,
  applyBond,
  applyPetExp,
  bondRankFor,
  growPartyPets,
  growPet,
  growthHeadlines,
  isNameSlotUnlocked,
  petBattleName,
  petMaxLevel,
  petNameplate,
  runPetExp,
  runPetExpBase,
  sanitizePetName,
  setPetName,
} from '@/game/engine/petGrowth';
import { createInitialMeta, normalizeMeta, reducer } from '@/game/state/metaStore';
import type { RunResult, SavedLokPet } from '@/game/types';

const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');
const DAY = 24 * 60 * 60 * 1000;
const NOON = new Date(2026, 5, 1, 12, 0, 0).getTime();

function pet(over: Partial<SavedLokPet> = {}): SavedLokPet {
  return {
    id: over.id ?? 'pet-a',
    roll: rollLokPet(createRng(7), { fixedVariantId: 'gyro-sentry' }),
    stamina: 3,
    level: 1,
    exp: 0,
    battlesWon: 0,
    battlesFought: 0,
    ...over,
  };
}

function runResult(over: Partial<RunResult> = {}): RunResult {
  return {
    areaId: AREAS[0]!.id,
    characterId: 'queenbee',
    cleared: true,
    survivedSec: 600,
    kills: 500,
    level: 5,
    cred: 10,
    killsByEnemy: {},
    newlyUnlockedCharacterIds: [],
    loadout: { weapons: [], passives: [] },
    lootBoxesOpened: 0,
    openedPrizes: [],
    lokPets: [],
    lokPetDiscoveries: [],
    lootTokensGained: 0,
    skeletonKeysGained: 0,
    completedObjectives: [],
    ...over,
  };
}

describe('pet XP and levels', () => {
  it('keeps the level thresholds exactly as they were', () => {
    assert.equal(getExpForLevel(1), 50);
    assert.equal(getExpForLevel(10), Math.floor(50 * Math.pow(10, 1.4)));
  });

  it('rolls the remainder into the next level and clamps at the cap', () => {
    const need = getExpForLevel(1);
    const r = applyPetExp({ level: 1, exp: 0 }, need + 7);
    assert.deepEqual([r.level, r.exp, r.levelsGained], [2, 7, 1]);
    const capped = applyPetExp({ level: 50, exp: 0 }, 10_000_000);
    assert.equal(capped.level, 50);
    assert.equal(capped.capped, true);
    assert.ok(capped.exp < getExpForLevel(50));
    assert.equal(petMaxLevel(true), 99);
    assert.equal(applyPetExp({ level: 99, exp: 0, starter: true }, 5_000_000).level, 99);
  });

  it('never moves an existing level when no XP is gained', () => {
    const r = applyPetExp({ level: 33, exp: 10 }, 0);
    assert.deepEqual([r.level, r.exp, r.levelsGained], [33, 10, 0]);
  });

  it('pays the starter in full and other pets 60% of run XP', () => {
    const base = runPetExpBase({ survivedSec: 600, kills: 500, cleared: true });
    assert.equal(base, 40 + 20 + 20 + 60);
    assert.equal(runPetExp({ starter: true }, base), base * PET_EXP_SCALE);
    assert.equal(runPetExp({ starter: false }, base), Math.round(base * 0.6 * PET_EXP_SCALE));
  });

  it('paces levels sensibly: a casual daily player reaches level 30 in weeks, not hours or years', () => {
    // A casual day: 3 runs (10 min, 400 kills, half cleared) + 2 travel wins + 1 battle win.
    const daily = 3 * runPetExp({ starter: true }, runPetExpBase({ survivedSec: 600, kills: 400, cleared: false }))
      + 2 * runPetExp({ starter: true }, 30)
      + 1 * runPetExp({ starter: true }, 150 * 1);
    let level = 1;
    let exp = 0;
    let days = 0;
    while (level < 30 && days < 1000) {
      const r = applyPetExp({ level, exp, starter: true }, daily);
      level = r.level;
      exp = r.exp;
      days += 1;
    }
    assert.ok(days >= 7 && days <= 60, `level 30 took ${days} days`);
  });
});

describe('bond', () => {
  it('has five ranks that rise with points', () => {
    assert.deepEqual(BOND_RANKS.map((r) => r.id), ['stranger', 'familiar', 'friend', 'partner', 'soulbound']);
    assert.equal(bondRankFor(0).id, 'stranger');
    assert.equal(bondRankFor(15).id, 'familiar');
    assert.equal(bondRankFor(49).id, 'familiar');
    assert.equal(bondRankFor(250).id, 'soulbound');
  });

  it('caps bond per local day and resets the next day', () => {
    let p = pet();
    let total = 0;
    for (let i = 0; i < 20; i += 1) {
      const b = applyBond(p, 'run', NOON);
      total += b.gained;
      p = { ...p, bond: b.bond, bondDay: b.bondDay, bondToday: b.bondToday };
    }
    assert.equal(total, BOND_DAILY_CAP);
    assert.equal(applyBond(p, 'run', NOON).gained, 0);
    assert.ok(applyBond(p, 'run', NOON + DAY).gained > 0);
  });

  it('never decreases bond', () => {
    const p = pet({ bond: 40, bondDay: '2020-01-01', bondToday: 3 });
    assert.ok(applyBond(p, 'travel', NOON).bond >= 40);
  });
});

describe('name slots', () => {
  it('strips control characters, collapses space and bounds length', () => {
    assert.equal(sanitizePetName('  Ma\u0000ple\u0007   Jr  '), 'Maple Jr');
    assert.equal(sanitizePetName('x'.repeat(80)).length, 24);
    assert.equal(sanitizePetName(undefined), '');
  });

  it('opens each slot at its bond rank, and the starter call name immediately', () => {
    const fresh = pet();
    assert.equal(isNameSlotUnlocked(fresh, 'call'), false);
    assert.equal(isNameSlotUnlocked(pet({ starter: true }), 'call'), true);
    assert.equal(isNameSlotUnlocked(pet({ starter: true }), 'battle'), false);
    assert.equal(isNameSlotUnlocked(pet({ bond: 15 }), 'call'), true);
    assert.equal(isNameSlotUnlocked(pet({ bond: 50 }), 'battle'), true);
    assert.equal(isNameSlotUnlocked(pet({ bond: 50 }), 'epithet'), false);
    assert.equal(isNameSlotUnlocked(pet({ bond: 120 }), 'epithet'), true);
    assert.equal(isNameSlotUnlocked(pet({ bond: 120 }), 'trueName'), false);
    assert.equal(isNameSlotUnlocked(pet({ bond: 250 }), 'trueName'), true);
    assert.equal(PET_NAME_SLOTS.length, 5);
  });

  it('refuses locked slots, keeps existing names editable, and builds the nameplate', () => {
    const locked = pet();
    assert.equal(setPetName(locked, 'battle', 'Torch'), locked);
    const legacy = pet({ name: 'Old Name' });
    assert.equal(setPetName(legacy, 'call', 'New Name').name, 'New Name');
    let p = pet({ bond: 250, name: 'Maple' });
    p = setPetName(p, 'battle', 'Torch');
    p = setPetName(p, 'epithet', 'the Unbothered');
    assert.equal(petBattleName(p), 'Torch');
    assert.equal(petNameplate(p), 'Maple, the Unbothered');
    p = setPetName(p, 'battle', '');
    assert.equal(petBattleName(p), 'Maple');
  });
});

describe('growing a party', () => {
  it('grows the starter always and loadout pets only when out', () => {
    const starter = pet({ id: 'starter', starter: true });
    const out = pet({ id: 'out' });
    const kennel = pet({ id: 'kennel' });
    const g = growPartyPets([starter, out, kennel], ['out'], 100, 'run', NOON);
    assert.equal(g.entries.length, 2);
    assert.ok((g.pets[0]!.bond ?? 0) > 0);
    assert.equal(g.pets[2], kennel);
    assert.ok(runPetExp(starter, 100) > runPetExp(out, 100));
  });

  it('reports level-ups and new bond ranks as headlines', () => {
    const p = pet({ bond: 14 });
    const { entry } = growPet(p, { exp: getExpForLevel(1) * 3, bondSource: 'run', now: NOON });
    assert.ok(entry);
    const lines = growthHeadlines([entry!]);
    assert.ok(lines.some((l) => /reached level/.test(l)));
    assert.ok(lines.some((l) => /now Familiar/.test(l)));
    assert.equal(growPet(p, { now: NOON }).entry, null);
  });
});

describe('reducers', () => {
  const base = () => {
    const meta = createInitialMeta();
    const starter = pet({ id: 'starter', starter: true, level: 4, exp: 5 });
    return { meta: { ...meta, savedLokPets: [starter, pet({ id: 'other' })], selectedLokPetIds: [] }, lastRun: null, lastCardPackReveal: null };
  };

  it('completeRun trains the starter, fills a Growth Recap and never touches the kennel', () => {
    const next = reducer(base(), { type: 'completeRun', result: runResult() });
    const starter = next.meta.savedLokPets.find((p) => p.id === 'starter')!;
    assert.ok(starter.level! > 4 || starter.exp! > 5);
    assert.ok((starter.bond ?? 0) > 0);
    const other = next.meta.savedLokPets.find((p) => p.id === 'other')!;
    assert.equal(other.level, 1);
    assert.equal(other.bond, undefined);
    const recap = next.lastRun?.petGrowth ?? [];
    assert.equal(recap.length, 1);
    assert.equal(recap[0]!.petId, 'starter');
  });

  it('persists the battle XP remainder (it used to be dropped)', () => {
    const state = base();
    const battle = createBattle({ gameMode: 'sparring', playerPets: [state.meta.savedLokPets[0]!] });
    battle.enemyTeam.forEach((p) => { p.hp = 0; p.fainted = true; });
    const rewards = calculateBattleRewards(battle);
    const result = rewards.petResults[0]!;
    const next = reducer(state, { type: 'recordLokPetBattleResult', rewards, winningPetIds: ['starter'] });
    const saved = next.meta.savedLokPets.find((p) => p.id === 'starter')!;
    assert.equal(saved.level, result.level);
    assert.equal(saved.exp, result.exp);
    assert.ok(saved.exp! > 0 || saved.level! > 4);
  });

  it('treats feed XP and bond and respect the cap', () => {
    const state = { ...base(), meta: { ...base().meta, lokPetTreats: 2 } };
    const next = reducer(state, { type: 'feedLokPetTreat', id: 'starter' });
    const starter = next.meta.savedLokPets.find((p) => p.id === 'starter')!;
    assert.equal(next.meta.lokPetTreats, 1);
    assert.ok(starter.level! >= 4);
    assert.ok((starter.bond ?? 0) > 0);
  });

  it('setLokPetName follows unlock rules; renameLokPet is the call name', () => {
    const state = base();
    const refused = reducer(state, { type: 'setLokPetName', id: 'other', slot: 'battle', name: 'Torch' });
    assert.equal(refused, state);
    const refusedCall = reducer(state, { type: 'renameLokPet', id: 'other', name: 'Maple' });
    assert.equal(refusedCall.meta.savedLokPets.find((p) => p.id === 'other')!.name, undefined);
    const ok = reducer(state, { type: 'renameLokPet', id: 'starter', name: '  Maple  ' });
    assert.equal(ok.meta.savedLokPets.find((p) => p.id === 'starter')!.name, 'Maple');
  });

  it('lets the starter encounter set an optional call name', () => {
    const initial = { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };
    const named = reducer(initial, { type: 'completeStarterLokPetOnboarding', variantId: 'lil-llama', characterId: 'queenbee', now: 616, callName: ' Biscuit ' });
    assert.equal(named.meta.savedLokPets.find((p) => p.starter)?.name, 'Biscuit');
    const unnamed = reducer(initial, { type: 'completeStarterLokPetOnboarding', variantId: 'lil-llama', characterId: 'queenbee', now: 616 });
    assert.equal(unnamed.meta.savedLokPets.find((p) => p.starter)?.name, undefined);
  });
});

describe('arena status faints', () => {
  it('ends the fight when a burn tick drops the last enemy to 0 HP', () => {
    const battle = createBattle({ gameMode: 'sparring', playerPets: [pet({ level: 20 })] });
    const enemy = battle.enemyTeam[battle.activeEnemyIndex]!;
    enemy.hp = 1;
    enemy.statusEffects = [{ type: 'burn', duration: 2, value: 5, sourcePetName: 'test' }];
    battle.currentTurnActor = 'enemy';
    assert.ok(chooseEnemyMove(battle));
    const next = executeEnemyAi(battle);
    const after = next.enemyTeam[next.activeEnemyIndex]!;
    assert.equal(after.hp <= 0, true);
    assert.equal(after.fainted, true);
    assert.equal(next.phase, 'victory');
    assert.ok(next.rewards);
  });
});

describe('achievements', () => {
  it('gives every achievement a known category', () => {
    const ids = new Set(ACHIEVEMENT_CATEGORIES.map((c) => c.id));
    for (const a of ACHIEVEMENTS) assert.ok(ids.has(a.category), a.id);
    assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  });

  it('completes bond and name achievements from pet data', () => {
    const meta = { ...createInitialMeta(), savedLokPets: [pet({ bond: 250, level: 50, name: 'A', names: { battle: 'B', callsYou: 'C', epithet: 'D', trueName: 'E' } })] };
    for (const id of ['familiar-face', 'friend-for-life', 'soulbound', 'five-names', 'pet-level-20', 'pet-level-50']) {
      assert.equal(ACHIEVEMENTS_BY_ID[id]!.isComplete(meta), true, id);
    }
    assert.equal(ACHIEVEMENTS_BY_ID['five-names']!.isComplete({ ...meta, savedLokPets: [pet({ bond: 250 })] }), false);
  });

  it('toasts only on a fresh completion and not on a whole-save swap', () => {
    const state = { meta: { ...createInitialMeta(), savedLokPets: [pet({ id: 'p', starter: true, bond: 14 })] }, lastRun: null, lastCardPackReveal: null };
    const next = reducer(state, { type: 'completeRun', result: runResult() });
    assert.ok(next.meta.pendingNotifications.some((n) => n.id === 'achievement-familiar-face'));
    // Replaying a state that already completed it does not announce again.
    const again = reducer(next, { type: 'completeRun', result: runResult() });
    assert.equal(again.meta.pendingNotifications.filter((n) => n.id === 'achievement-familiar-face').length, 1);
    const swapped = reducer(state, { type: 'replaceMeta', meta: { ...next.meta, pendingNotifications: [] } } as never);
    assert.ok(!swapped.meta.pendingNotifications.some((n) => n.id.startsWith('achievement-')));
  });
});

describe('growth data hygiene', () => {
  it('avoids the banned word', () => {
    assert.ok(!BANNED.test(JSON.stringify([BOND_RANKS, PET_NAME_SLOTS, ACHIEVEMENTS.map((a) => [a.id, a.name, a.description])])));
  });
});

describe('save normalization', () => {
  const load = (savedLokPets: unknown[]) => normalizeMeta({ ...createInitialMeta(), savedLokPets } as never).savedLokPets;

  it('loads a v21 pet (no bond or names) exactly as before', () => {
    const old = pet({ id: 'old', level: 12, exp: 33, name: 'Maple', favorite: true });
    const [loaded] = load([old]);
    assert.equal(loaded!.level, 12);
    assert.equal(loaded!.exp, 33);
    assert.equal(loaded!.name, 'Maple');
    assert.equal(loaded!.bond, undefined);
    assert.equal(loaded!.names, undefined);
  });

  it('keeps good bond and names and cleans bad ones', () => {
    const [good] = load([{ ...pet({ id: 'g' }), bond: 77.9, bondDay: '2026-06-01', bondToday: 4, names: { battle: ' Torch ', epithet: 'x'.repeat(60), callsYou: 12, trueName: '' } }]);
    assert.equal(good!.bond, 77);
    assert.equal(good!.bondDay, '2026-06-01');
    assert.equal(good!.names?.battle, 'Torch');
    assert.equal(good!.names?.epithet?.length, 24);
    assert.equal(good!.names?.callsYou, undefined);
    assert.equal(good!.names?.trueName, undefined);
    const [bad] = load([{ ...pet({ id: 'b' }), bond: -5, bondDay: 'yesterday', bondToday: 'lots', names: 'nope' }]);
    assert.equal(bad!.bond, undefined);
    assert.equal(bad!.bondDay, undefined);
    assert.equal(bad!.bondToday, undefined);
    assert.equal(bad!.names, undefined);
  });
});
