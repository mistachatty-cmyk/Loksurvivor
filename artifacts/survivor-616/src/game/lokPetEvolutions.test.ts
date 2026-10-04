import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EVOLUTION_BRANCHES,
  EVOLUTION_OVERLAYS,
  EVOLUTION_OVERLAY_IDS,
  EVOLUTION_OVERLAY_LABELS,
} from '@/game/data/lokPetEvolutions';
import {
  LOKPET_VARIANTS,
  STARTER_LOKPET_IDS,
  getLokPetEvolutionStage,
  getLokPetEvolutionTitle,
  lokPetRig,
  rollLokPet,
} from '@/game/data/lokPets';
import { createRng } from '@/game/engine/math';
import {
  EVOLUTION_UNDO_WINDOW_MS,
  branchStatus,
  branchStatuses,
  branchesForPet,
  branchesForVariant,
  canUndoBranch,
  chooseBranch,
  chosenBranch,
  evolutionLevelFor,
  evolvedLook,
  evolvedRig,
  hasBranchToChoose,
  mixHex,
  normalizeEvolutionPath,
  petEvolvedLook,
  undoBranch,
  undoTimeLeftMs,
} from '@/game/engine/petEvolution';
import { convertSavedPetToBattlePet, calculateBattleRewards, createBattle } from '@/game/engine/lokPetBattle';
import { createInitialMeta, normalizeMeta, reducer } from '@/game/state/metaStore';
import type { LokPetFamily, SavedLokPet, SpritePalette } from '@/game/types';

const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');
const HEX6 = /^#[0-9a-f]{6}$/i;
const FAMILIES: LokPetFamily[] = ['animal', 'ghoul', 'bat', 'mote', 'blob', 'mechanical'];
const PALETTE_KEYS: Array<keyof SpritePalette> = ['ink', 'body', 'bodyDark', 'accent', 'accentBright', 'skin', 'glow'];
const NOW = new Date(2026, 5, 1, 12, 0, 0).getTime();

function pet(variantId: string, over: Partial<SavedLokPet> = {}): SavedLokPet {
  return {
    id: over.id ?? `pet-${variantId}`,
    roll: rollLokPet(createRng(7), { fixedVariantId: variantId }),
    stamina: 3,
    level: 1,
    exp: 0,
    battlesWon: 0,
    battlesFought: 0,
    ...over,
  };
}

/** A pet that meets every requirement of every branch (stage 2 level, Soulbound, plenty of battles). */
function maxed(variantId: string, over: Partial<SavedLokPet> = {}): SavedLokPet {
  const starter = (STARTER_LOKPET_IDS as readonly string[]).includes(variantId);
  return pet(variantId, { starter, level: evolutionLevelFor(2, starter), bond: 250, battlesWon: 10, battlesFought: 12, ...over });
}

describe('evolution branch data', () => {
  it('has unique ids and clean copy', () => {
    const ids = new Set<string>();
    for (const branch of EVOLUTION_BRANCHES) {
      assert.ok(!ids.has(branch.id), `duplicate branch id ${branch.id}`);
      ids.add(branch.id);
      for (const text of [branch.id, branch.label, branch.blurb, branch.stage2.title, branch.stage3.title]) {
        assert.ok(text.trim().length > 0);
        assert.ok(!BANNED.test(text), `banned word in ${branch.id}`);
      }
      assert.notEqual(branch.stage2.title, branch.stage3.title);
    }
  });

  it('points only at real variants and families, and every row has a target', () => {
    const variantIds = new Set(LOKPET_VARIANTS.map((v) => v.id));
    for (const branch of EVOLUTION_BRANCHES) {
      const { variantIds: ids, family } = branch.appliesTo;
      assert.ok(ids || family, `${branch.id} applies to nothing`);
      for (const id of ids ?? []) assert.ok(variantIds.has(id), `${branch.id}: unknown variant ${id}`);
      if (family) assert.ok(FAMILIES.includes(family), `${branch.id}: unknown family ${family}`);
    }
  });

  it('gives each starter two branches and each family one generic branch', () => {
    for (const id of STARTER_LOKPET_IDS) {
      const variant = LOKPET_VARIANTS.find((v) => v.id === id)!;
      assert.equal(branchesForVariant(id, variant.family).length, 2, `${id} should have two branches`);
    }
    for (const family of FAMILIES) {
      const generic = EVOLUTION_BRANCHES.filter((b) => !b.appliesTo.variantIds && b.appliesTo.family === family);
      assert.equal(generic.length, 1, `${family} should have exactly one generic branch`);
      assert.ok(generic[0]!.stage2.title.includes('{name}') && generic[0]!.stage3.title.includes('{name}'));
    }
  });

  it('gives every pet in the roster at least one branch', () => {
    for (const variant of LOKPET_VARIANTS) {
      assert.ok(branchesForVariant(variant.id, variant.family).length >= 1, `${variant.id} has no branch`);
    }
  });

  it('uses valid overlay ids, colors, mixes and scales', () => {
    for (const branch of EVOLUTION_BRANCHES) {
      for (const form of [branch.stage2, branch.stage3]) {
        for (const id of form.visual.overlays ?? []) assert.ok(EVOLUTION_OVERLAY_IDS.includes(id), `${branch.id}: unknown overlay ${id}`);
        for (const color of Object.values(form.visual.palette ?? {})) assert.match(color, HEX6);
        if (form.visual.mix) {
          assert.match(form.visual.mix.color, HEX6);
          assert.ok(form.visual.mix.amount >= 0 && form.visual.mix.amount <= 1);
        }
        const scale = form.visual.scale ?? 1;
        assert.ok(scale >= 1 && scale <= 1.3, `${branch.id}: scale ${scale}`);
      }
    }
  });

  it('keeps stage 3 at least as dressed as stage 2', () => {
    for (const branch of EVOLUTION_BRANCHES) {
      assert.ok((branch.stage3.visual.overlays ?? []).length >= (branch.stage2.visual.overlays ?? []).length, branch.id);
    }
  });
});

describe('overlay recipes', () => {
  it('has a label and a recipe for every overlay id', () => {
    for (const id of EVOLUTION_OVERLAY_IDS) {
      assert.ok(EVOLUTION_OVERLAY_LABELS[id], `${id} has no label`);
      assert.ok(!BANNED.test(EVOLUTION_OVERLAY_LABELS[id]));
    }
  });

  it('builds whole-pixel parts that sit near every rig', () => {
    for (const top of [12, 16, 20, 26]) {
      for (const id of EVOLUTION_OVERLAY_IDS) {
        const parts = EVOLUTION_OVERLAYS[id](top);
        assert.ok(parts.length > 0, id);
        for (const part of parts) {
          for (const value of [part.x, part.y, part.w, part.h]) assert.ok(Number.isInteger(value), `${id}: non-integer part value`);
          assert.ok(part.w >= 1 && part.h >= 1);
          assert.ok(part.y >= 0 && part.y + part.h <= top + 6, `${id} at top ${top}: y ${part.y}+${part.h}`);
          assert.ok(Math.abs(part.x) <= 12 && Math.abs(part.x + part.w) <= 12, `${id}: x out of range`);
          assert.ok(PALETTE_KEYS.includes(part.color), `${id}: bad color key ${part.color}`);
        }
      }
    }
  });
});

describe('eligibility', () => {
  it('opens branches at the natural stage 2 level and not before', () => {
    const starterLevel = evolutionLevelFor(2, true);
    const otherLevel = evolutionLevelFor(2, false);
    assert.equal(starterLevel, 33);
    assert.equal(otherLevel, 15);
    const early = maxed('lil-llama', { level: starterLevel - 1 });
    assert.ok(branchStatuses(early).every((s) => !s.ready));
    const ready = maxed('lil-llama');
    assert.ok(branchStatuses(ready).every((s) => s.ready));
  });

  it('checks bond and battle requirements per branch', () => {
    const base = maxed('lil-llama', { bond: 0, battlesWon: 0 });
    const [heart, street] = branchesForPet(base);
    assert.equal(heart!.id, 'llama-heart');
    assert.equal(street!.id, 'llama-street');
    assert.equal(branchStatus(base, heart!).ready, false);
    assert.equal(branchStatus({ ...base, bond: 50 }, heart!).ready, true);
    assert.equal(branchStatus(base, street!).ready, false);
    assert.equal(branchStatus({ ...base, battlesWon: 3 }, street!).ready, true);
    const lines = branchStatus(base, heart!).lines.map((l) => l.label);
    assert.deepEqual(lines, ['Level 33', 'Bond: Friend']);
  });

  it('flags a pet with a ready, unchosen branch', () => {
    assert.equal(hasBranchToChoose(maxed('moss-pouncer')), true);
    assert.equal(hasBranchToChoose(pet('moss-pouncer')), false);
    assert.equal(hasBranchToChoose(maxed('moss-pouncer', { evolutionPath: { branchId: 'family-animal', chosenAt: NOW } })), false);
  });
});

describe('choose and undo', () => {
  it('chooses a ready branch and records when', () => {
    const result = chooseBranch(maxed('lil-llama'), 'llama-heart', NOW);
    assert.equal(result.ok, true);
    assert.deepEqual(result.pet.evolutionPath, { branchId: 'llama-heart', chosenAt: NOW });
    assert.equal(chosenBranch(result.pet)?.label, 'Heart path');
  });

  it('refuses unknown, wrong-pet, unready and repeat choices without touching the pet', () => {
    const llama = maxed('lil-llama');
    assert.equal(chooseBranch(llama, 'nope', NOW).reason, 'not-available');
    assert.equal(chooseBranch(llama, 'null-quiet', NOW).reason, 'not-available');
    assert.equal(chooseBranch({ ...llama, bond: 0 }, 'llama-heart', NOW).reason, 'requirements');
    const chosen = chooseBranch(llama, 'llama-heart', NOW).pet;
    const again = chooseBranch(chosen, 'llama-street', NOW + 1000);
    assert.equal(again.ok, false);
    assert.equal(again.reason, 'already-chosen');
    assert.equal(again.pet, chosen);
  });

  it('undoes for free within 24 hours, then locks', () => {
    const chosen = chooseBranch(maxed('lil-llama'), 'llama-heart', NOW).pet;
    assert.equal(canUndoBranch(chosen, NOW + 60_000), true);
    assert.equal(undoTimeLeftMs(chosen, NOW), EVOLUTION_UNDO_WINDOW_MS);
    assert.equal(canUndoBranch(chosen, NOW + EVOLUTION_UNDO_WINDOW_MS), true);
    assert.equal(canUndoBranch(chosen, NOW + EVOLUTION_UNDO_WINDOW_MS + 1), false);
    const undone = undoBranch(chosen, NOW + 60_000);
    assert.equal(undone.ok, true);
    assert.equal(undone.pet.evolutionPath, undefined);
    assert.equal(undone.pet.level, chosen.level);
    const late = undoBranch(chosen, NOW + EVOLUTION_UNDO_WINDOW_MS + 1);
    assert.equal(late.ok, false);
    assert.equal(late.reason, 'window-passed');
    assert.equal(late.pet, chosen);
    assert.equal(undoBranch(maxed('lil-llama'), NOW).reason, 'nothing-to-undo');
  });

  it('lets the player pick a different branch after an undo', () => {
    const chosen = chooseBranch(maxed('lil-llama'), 'llama-heart', NOW).pet;
    const undone = undoBranch(chosen, NOW + 1000).pet;
    const second = chooseBranch(undone, 'llama-street', NOW + 2000);
    assert.equal(second.ok, true);
    assert.equal(second.pet.evolutionPath?.branchId, 'llama-street');
  });

  it('drops a malformed or stale path', () => {
    const good = maxed('lil-llama', { evolutionPath: { branchId: 'llama-heart', chosenAt: NOW } });
    assert.equal(normalizeEvolutionPath(good), good);
    assert.equal(normalizeEvolutionPath({ ...good, evolutionPath: { branchId: 'ghost', chosenAt: NOW } }).evolutionPath, undefined);
    assert.equal(normalizeEvolutionPath({ ...good, evolutionPath: { branchId: 'null-quiet', chosenAt: NOW } }).evolutionPath, undefined);
    assert.equal(normalizeEvolutionPath({ ...good, evolutionPath: { branchId: 'llama-heart', chosenAt: Number.NaN } }).evolutionPath, undefined);
    assert.equal(normalizeEvolutionPath({ ...good, evolutionPath: 'llama-heart' as never }).evolutionPath, undefined);
  });
});

describe('the evolved look', () => {
  it('leaves natural forms exactly as before', () => {
    for (const variant of LOKPET_VARIANTS) {
      const starter = variant.starter === true;
      for (const level of [1, 14, 15, 32, 33, 50, 66, 99]) {
        const look = evolvedLook({ variantId: variant.id, family: variant.family, name: variant.name, palette: variant.palette, level, starter });
        const stage = getLokPetEvolutionStage(level, starter);
        assert.equal(look.stage, stage);
        assert.equal(look.title, getLokPetEvolutionTitle(variant.id, stage));
        assert.equal(look.palette, variant.palette);
        assert.deepEqual(look.overlays, []);
        assert.equal(look.scale, 1);
      }
    }
  });

  it('ignores a branch at stage 1, or one that does not apply to the pet', () => {
    const llama = LOKPET_VARIANTS.find((v) => v.id === 'lil-llama')!;
    const input = { variantId: llama.id, family: llama.family, name: llama.name, palette: llama.palette, starter: true };
    assert.equal(evolvedLook({ ...input, level: 10, branchId: 'llama-heart' }).branch, undefined);
    assert.equal(evolvedLook({ ...input, level: 40, branchId: 'null-quiet' }).branch, undefined);
    assert.equal(evolvedLook({ ...input, level: 40, branchId: 'does-not-exist' }).title, getLokPetEvolutionTitle('lil-llama', 2));
  });

  it('renames and re-dresses stage 2 and stage 3 forms', () => {
    const llama = LOKPET_VARIANTS.find((v) => v.id === 'lil-llama')!;
    const input = { variantId: llama.id, family: llama.family, name: llama.name, palette: llama.palette, starter: true, branchId: 'llama-heart' };
    const two = evolvedLook({ ...input, level: 33 });
    assert.equal(two.stage, 2);
    assert.equal(two.title, 'Charm Llama');
    assert.deepEqual(two.overlays, ['halo']);
    assert.equal(two.palette.accent, '#ff9ccc');
    assert.equal(two.palette.body, llama.palette.body);
    const three = evolvedLook({ ...input, level: 66 });
    assert.equal(three.title, 'Heartstring Matriarch');
    assert.deepEqual(three.overlays, ['halo', 'mane']);
    assert.ok(three.scale > 1);
  });

  it('fills the species name into generic titles and blends instead of replacing colors', () => {
    const moss = maxed('moss-pouncer', { level: 15, evolutionPath: { branchId: 'family-animal', chosenAt: NOW } });
    const look = petEvolvedLook(moss);
    assert.equal(look.title, 'Alpha Moss Pouncer');
    assert.notEqual(look.palette.accent, moss.roll.palette.accent);
    assert.equal(look.palette.body, moss.roll.palette.body);
    assert.equal(petEvolvedLook({ ...moss, level: 30 }).title, 'Apex Moss Pouncer');
  });

  it('mixes colors, and leaves a non-hex color alone', () => {
    assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
    assert.equal(mixHex('#112233', '#ffffff', 0), '#112233');
    assert.equal(mixHex('#112233', '#ffffff', 1), '#ffffff');
    assert.equal(mixHex('red', '#ffffff', 0.5), 'red');
    assert.equal(mixHex('#112233', 'blue', 0.5), '#112233');
  });

  it('caches the evolved rig, adds parts and never touches the base rig', () => {
    const base = lokPetRig('pouncer');
    const before = base.parts.length;
    assert.equal(evolvedRig('pouncer', undefined), base);
    assert.equal(evolvedRig('pouncer', []), base);
    const a = evolvedRig('pouncer', ['halo', 'mane']);
    const b = evolvedRig('pouncer', ['halo', 'mane']);
    assert.equal(a, b);
    assert.ok(a.parts.length > before);
    assert.equal(lokPetRig('pouncer').parts.length, before);
    assert.notEqual(evolvedRig('pouncer', ['halo']), a);
    assert.equal(a.pixelHeight, base.pixelHeight);
  });
});

describe('where evolution shows up', () => {
  it('carries the branch look and title into a battle pet, and keeps stats on the stage only', () => {
    const plain = maxed('lil-llama');
    const chosen = chooseBranch(plain, 'llama-heart', NOW).pet;
    const a = convertSavedPetToBattlePet(plain);
    const b = convertSavedPetToBattlePet(chosen);
    assert.equal(a.evolutionTitle, getLokPetEvolutionTitle('lil-llama', 2));
    assert.equal(b.evolutionTitle, 'Charm Llama');
    assert.deepEqual(b.evolutionOverlays, ['halo']);
    assert.equal(a.evolutionOverlays, undefined);
    assert.equal(b.evolutionBranchId, 'llama-heart');
    assert.equal(a.maxHp, b.maxHp);
    assert.equal(a.attack, b.attack);
  });

  it('keeps the branch title when a battle win evolves the pet to stage 3', () => {
    const nearly = chooseBranch(maxed('lil-llama', { level: 65, exp: 0 }), 'llama-heart', NOW).pet;
    const state = createBattle({ gameMode: 'test-sparring', playerPets: [nearly] });
    const player = state.playerTeam[0]!;
    player.exp = player.expToNext - 1;
    state.phase = 'victory';
    const rewards = calculateBattleRewards(state);
    const up = rewards.levelUps.find((entry) => entry.petId === player.id);
    assert.ok(up?.evolved, 'level 65 to 66 should evolve a starter');
    assert.equal(up!.newTitle, 'Heartstring Matriarch');
  });
});

describe('store', () => {
  const base = (pets: SavedLokPet[]) => ({
    meta: { ...createInitialMeta(), savedLokPets: pets, selectedLokPetIds: [] },
    lastRun: null,
    lastCardPackReveal: null,
  });

  it('chooses and undoes through the reducer, and ignores bad requests', () => {
    const llama = maxed('lil-llama', { id: 'p1' });
    const s0 = base([llama]);
    const chosen = reducer(s0, { type: 'chooseLokPetBranch', id: 'p1', branchId: 'llama-heart', now: NOW });
    assert.equal(chosen.meta.savedLokPets[0]!.evolutionPath?.branchId, 'llama-heart');
    assert.equal(reducer(s0, { type: 'chooseLokPetBranch', id: 'p1', branchId: 'null-quiet', now: NOW }), s0);
    assert.equal(reducer(s0, { type: 'chooseLokPetBranch', id: 'missing', branchId: 'llama-heart', now: NOW }), s0);
    assert.equal(reducer({ ...s0, meta: { ...s0.meta, savedLokPets: [{ ...llama, bond: 0 }] } }, { type: 'chooseLokPetBranch', id: 'p1', branchId: 'llama-heart', now: NOW }).meta.savedLokPets[0]!.evolutionPath, undefined);
    const undone = reducer(chosen, { type: 'undoLokPetBranch', id: 'p1', now: NOW + 1000 });
    assert.equal(undone.meta.savedLokPets[0]!.evolutionPath, undefined);
    const late = reducer(chosen, { type: 'undoLokPetBranch', id: 'p1', now: NOW + EVOLUTION_UNDO_WINDOW_MS + 5 });
    assert.equal(late, chosen);
  });

  it('keeps a saved path through a save and load, and drops a bad one', () => {
    const load = (savedLokPets: unknown[]) => normalizeMeta({ ...createInitialMeta(), savedLokPets } as never).savedLokPets;
    const chosen = chooseBranch(maxed('lil-llama', { id: 'p1' }), 'llama-street', NOW).pet;
    const [kept] = load([chosen]);
    assert.deepEqual(kept!.evolutionPath, { branchId: 'llama-street', chosenAt: NOW });
    const [dropped] = load([{ ...chosen, evolutionPath: { branchId: 'gone', chosenAt: NOW } }]);
    assert.equal(dropped!.evolutionPath, undefined);
    const [old] = load([maxed('lil-llama', { id: 'p2' })]);
    assert.equal(old!.evolutionPath, undefined);
    assert.equal(old!.level, evolutionLevelFor(2, true));
  });
});
