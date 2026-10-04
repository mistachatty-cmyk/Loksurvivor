import assert from 'node:assert/strict';
import test from 'node:test';
import { CHARACTERS, CHARACTERS_BY_ID } from './data/characters';
import { FACTIONS } from './data/factions';
import { FORGE_KIT_BLOCKLIST, buildForgedCharacter, isForgeKit, registerForgedOperators } from './data/forgedOperators';
import {
  BODY_BUILDS, CORE_SPECIES, FACTION_SPECIES, FORGE_CATEGORIES, FORGE_ID_PREFIX, HEIGHT_RANGE, OPERATOR_FLAVORS_LIST, OPERATOR_LEAN, PALETTE_SCHEMES,
  SKIN_TONES, SPECIES, WIDTH_RANGE, bodyFromBuild, buildOperatorRig, exportForgedOperator, generateForgedOperator,
  generateOperatorDesign, generateOperatorIdentity, generatePalette, importForgedOperator, lookDifference,
  normalizeDesign, normalizeForgedOperator, rerollDesign, type ForgedOperator,
} from './data/operatorForge';
import { OPERATOR_FEATURE_COUNT, readOperatorGeo } from './sprites/operatorDetail';
import { humanoidRig } from './sprites/rigs';

// The project's banned word (see CLAUDE.md), assembled so it never appears literally in source.
const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');
const NONE = new Set<string>();
const SEEDS = Array.from({ length: 80 }, (_, i) => `seed-${i}`);

test('the Forge offers a deep bank of options', () => {
  assert.ok(OPERATOR_FEATURE_COUNT >= 170, `only ${OPERATOR_FEATURE_COUNT} features`);
  assert.ok(BODY_BUILDS.length >= 9);
  assert.ok(CORE_SPECIES.length >= 10);
  assert.ok(FACTION_SPECIES.length >= 18);
  assert.ok(SPECIES.length >= 28);
  assert.ok(OPERATOR_FEATURE_COUNT >= 200, `only ${OPERATOR_FEATURE_COUNT} features`);
  assert.ok(PALETTE_SCHEMES.length >= 9);
  assert.ok(SKIN_TONES.length >= 20);
  assert.ok(SKIN_TONES.some((s) => s.fantasy));
});

test('every category, lean list and species only names features that exist', () => {
  const byField = new Map(FORGE_CATEGORIES.map((c) => [c.field, c]));
  for (const cat of FORGE_CATEGORIES) {
    if (cat.none) assert.ok(cat.ids.includes(cat.none), `${cat.field} has no "${cat.none}"`);
  }
  for (const flavor of OPERATOR_FLAVORS_LIST) {
    for (const [field, list] of Object.entries(OPERATOR_LEAN[flavor])) {
      for (const id of list ?? []) assert.ok(byField.get(field as never)!.ids.includes(id), `${flavor}.${field} leans on unknown "${id}"`);
    }
  }
  for (const species of SPECIES) {
    assert.ok(species.skins.length > 0 && species.schemes.length > 0);
    for (const build of species.builds) assert.ok(BODY_BUILDS.some((b) => b.id === build), `${species.id} unknown build ${build}`);
    for (const [field, list] of Object.entries(species.lean)) {
      for (const id of list ?? []) assert.ok(byField.get(field as never)!.ids.includes(id), `${species.id}.${field} leans on unknown "${id}"`);
    }
  }
});

test('generation is deterministic and varied', () => {
  const a = generateOperatorDesign('alpha');
  assert.deepEqual(a, generateOperatorDesign('alpha'));
  assert.notDeepEqual(a, generateOperatorDesign('beta'));
  const looks = SEEDS.map((s) => generateOperatorDesign(s).look);
  let worst = Infinity;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < looks.length; i += 1) {
    for (let j = i + 1; j < looks.length; j += 1) {
      const d = lookDifference(looks[i]!, looks[j]!);
      worst = Math.min(worst, d);
      total += d;
      pairs += 1;
    }
  }
  assert.ok(total / pairs >= 9, `average difference only ${(total / pairs).toFixed(1)}`);
  assert.ok(worst >= 2, `two generated operators differ in only ${worst} features`);
  assert.ok(new Set(SEEDS.map((s) => generateOperatorDesign(s).species)).size >= 6, 'species should vary');
});

test('every build, species and seed makes a valid, in-bounds rig', () => {
  const designs = [
    ...SEEDS.map((s) => generateOperatorDesign(s)),
    ...BODY_BUILDS.map((b) => ({ ...generateOperatorDesign(`build-${b.id}`), body: bodyFromBuild(b.id) })),
    ...BODY_BUILDS.flatMap((b) => [
      { ...generateOperatorDesign(`min-${b.id}`), body: { build: b.id, height: HEIGHT_RANGE.min, width: WIDTH_RANGE.min } },
      { ...generateOperatorDesign(`max-${b.id}`), body: { build: b.id, height: HEIGHT_RANGE.max, width: WIDTH_RANGE.max } },
    ]),
  ];
  for (const design of designs) {
    const rig = buildOperatorRig(design);
    const geo = readOperatorGeo(rig);
    assert.ok(geo, 'rig stays a readable humanoid');
    assert.ok(rig.parts.length > 12, 'detail parts were added');
    for (const part of rig.parts) {
      assert.ok(part.w >= 1 && part.h >= 1, 'no empty parts');
      assert.ok(Number.isFinite(part.x) && Number.isFinite(part.y), 'finite coordinates');
    }
    const base = humanoidRig({ height: design.body.height, width: design.body.width });
    assert.equal(rig.pixelHeight, base.pixelHeight, 'height is unchanged by details');
    assert.deepEqual(Object.keys(rig.anims), Object.keys(base.anims), 'animations are kept');
  }
});

test('every single feature renders on every build without breaking', () => {
  for (const build of BODY_BUILDS) {
    const design = { ...generateOperatorDesign('every'), body: bodyFromBuild(build.id) };
    for (const cat of FORGE_CATEGORIES) {
      for (const id of cat.ids) {
        const rig = buildOperatorRig({ ...design, look: { ...design.look, [cat.field]: id } });
        for (const part of rig.parts) {
          assert.ok(part.w >= 1 && part.h >= 1 && part.y >= -1, `${build.id}/${cat.field}/${id}: bad part`);
        }
      }
    }
  }
});

test('palettes are valid and the scheme changes the colors', () => {
  const colors = /^#[0-9a-f]{6}$/;
  for (const scheme of PALETTE_SCHEMES) {
    for (const hue of [0, 90, 200, 300]) {
      const p = generatePalette({ scheme, hue, shade: 0.5, skin: '#cf9a69' });
      for (const value of Object.values(p)) assert.match(value, colors);
    }
  }
  const a = generatePalette({ scheme: 'analogous', hue: 200, shade: 0.5, skin: '#cf9a69' });
  const b = generatePalette({ scheme: 'complementary', hue: 200, shade: 0.5, skin: '#cf9a69' });
  assert.notEqual(a.accent, b.accent);
  assert.equal(a.body, b.body);
});

test('rerolling one category leaves everything else alone', () => {
  const design = generateOperatorDesign('reroll');
  const next = rerollDesign(design, 'hair', 'x1');
  assert.deepEqual(next.body, design.body);
  assert.deepEqual(next.palette, design.palette);
  for (const cat of FORGE_CATEGORIES) {
    if (cat.field === 'hair') continue;
    assert.equal(next.look[cat.field], design.look[cat.field]);
  }
  assert.notDeepEqual(rerollDesign(design, 'palette', 'p1').palette, design.palette);
  assert.deepEqual(rerollDesign(design, 'palette', 'p1').look.hair, design.look.hair);
});

test('identities are readable and never use the banned word', () => {
  for (const seed of SEEDS) {
    const design = generateOperatorDesign(seed);
    const id = generateOperatorIdentity(seed, design);
    assert.ok(id.name.length > 3 && id.handle.length > 2 && id.tagline.length > 10 && id.bio.length > 20);
    assert.ok(!BANNED.test(`${id.name} ${id.handle} ${id.tagline} ${id.bio}`));
  }
});

test('untrusted designs are coerced instead of crashing', () => {
  const messy = normalizeDesign({
    species: 'nope', flavor: 'x', body: { build: 'zzz', height: 9999, width: -4 }, palette: { body: 'red', ink: '#123456' },
    look: { hair: 'does-not-exist', hairColor: 'neon', top: 42 },
  });
  assert.equal(messy.species, 'human');
  assert.ok(messy.body.height <= HEIGHT_RANGE.max && messy.body.width >= WIDTH_RANGE.min);
  assert.equal(messy.palette.ink, '#123456');
  assert.match(messy.palette.body, /^#[0-9a-f]{6}$/);
  for (const cat of FORGE_CATEGORIES) assert.ok(cat.ids.includes(messy.look[cat.field]));
  assert.ok(buildOperatorRig(messy).parts.length >= humanoidRig().parts.length);
  assert.equal(normalizeForgedOperator({ id: 'not-forged', kitId: 'a' }), null);
  assert.equal(normalizeForgedOperator(null), null);
});

test('share codes round-trip and reject junk', () => {
  const op = generateForgedOperator('share', 'static-nomad', NONE, 1000);
  const code = exportForgedOperator(op);
  const back = importForgedOperator(code, new Set([op.id]), 2000)!;
  assert.ok(back);
  assert.notEqual(back.id, op.id);
  assert.ok(back.id.startsWith(FORGE_ID_PREFIX));
  assert.deepEqual(back.design, op.design);
  assert.equal(back.name, op.name);
  assert.equal(importForgedOperator('hello', NONE, 1), null);
  assert.equal(importForgedOperator('FORGE1:!!!notbase64', NONE, 1), null);
});

function firstKit() {
  const kit = CHARACTERS.find((c) => isForgeKit(c) && c.unlock.kind === 'default');
  assert.ok(kit);
  return kit;
}

test('forged operators are added to a roster without touching the originals', () => {
  const originals = [...CHARACTERS];
  const snapshot = JSON.stringify(originals);
  const kit = firstKit();
  const ops: ForgedOperator[] = [0, 1, 2].map((n) => generateForgedOperator(`reg-${n}`, kit.id, new Set(), n + 1));
  const roster = [...CHARACTERS];
  const byId = { ...CHARACTERS_BY_ID };
  const added = registerForgedOperators(roster, byId, ops);
  assert.equal(added.length, 3);
  assert.equal(roster.length, originals.length + 3);
  // Every authored operator is the very same object, in the same order, unchanged.
  originals.forEach((c, i) => assert.equal(roster[i], c));
  assert.equal(JSON.stringify(originals), snapshot);
  for (const forged of added) {
    assert.ok(forged.id.startsWith(FORGE_ID_PREFIX));
    assert.equal(byId[forged.id], forged);
    assert.equal(forged.unlock.kind, 'default');
    assert.equal(forged.stats.maxHp, kit.stats.maxHp);
    assert.equal(forged.weapon, kit.weapon);
    assert.notEqual(forged.rig, kit.rig);
    assert.equal(forged.referenceArt, undefined);
    assert.equal(forged.rarity, undefined);
  }
  // Registering again is a no-op.
  assert.equal(registerForgedOperators(roster, byId, ops).length, 0);
});

test('forged operators with a missing or blocked kit are skipped, not crashed on', () => {
  const roster = [...CHARACTERS];
  const byId = { ...CHARACTERS_BY_ID };
  const orphan = generateForgedOperator('orphan', 'no-such-kit', new Set(), 1);
  const blockedKitId = [...FORGE_KIT_BLOCKLIST].find((id) => byId[id]);
  const ops = [orphan];
  if (blockedKitId) ops.push(generateForgedOperator('blocked', blockedKitId, new Set([orphan.id]), 2));
  assert.equal(registerForgedOperators(roster, byId, ops).length, 0);
  assert.equal(roster.length, CHARACTERS.length);
});

test('legendary and engine-keyed kits cannot be borrowed', () => {
  for (const id of FORGE_KIT_BLOCKLIST) {
    const c = CHARACTERS_BY_ID[id];
    if (c) assert.equal(isForgeKit(c), false);
  }
  for (const c of CHARACTERS) if (c.rarity === 'legendary') assert.equal(isForgeKit(c), false);
  assert.ok(CHARACTERS.filter(isForgeKit).length >= 30, 'plenty of kits to choose from');
});

test('with nothing saved the live roster is exactly the authored roster', () => {
  assert.ok(CHARACTERS.every((c) => !c.id.startsWith(FORGE_ID_PREFIX)));
  assert.equal(CHARACTERS.length, Object.keys(CHARACTERS_BY_ID).length);
});

test('a forged character copy keeps its own palette and does not share the kit rig', () => {
  const kit = firstKit();
  const op = generateForgedOperator('copy', kit.id, new Set(), 5);
  const forged = buildForgedCharacter(op, kit);
  assert.deepEqual(forged.palette, op.design.palette);
  assert.notEqual(forged.palette, kit.palette);
  assert.notEqual(forged.id, kit.id);
});

test('faction races point at real factions, are unique, and make valid operators', () => {
  const factionIds = new Set(FACTIONS.map((f) => f.id));
  const raceIds = new Set<string>();
  for (const race of SPECIES) {
    assert.ok(!raceIds.has(race.id), `duplicate race id ${race.id}`);
    raceIds.add(race.id);
  }
  const factions = new Set<string>();
  for (const race of FACTION_SPECIES) {
    assert.ok(race.faction && factionIds.has(race.faction), `${race.id} names unknown faction ${race.faction}`);
    assert.ok(race.lore && race.lore.length > 20, `${race.id} needs a lore line`);
    assert.ok(!BANNED.test(`${race.label} ${race.blurb} ${race.lore}`));
    factions.add(race.faction!);
  }
  assert.ok(factions.size >= 18, 'faction races should cover many different factions');
  for (const race of SPECIES) {
    for (let i = 0; i < 6; i += 1) {
      const design = generateOperatorDesign(`${race.id}-${i}`, { species: race.id });
      assert.equal(design.species, race.id);
      assert.ok(race.builds.includes(design.body.build));
      assert.ok(readOperatorGeo(buildOperatorRig(design)));
    }
  }
});

test('a faction race leans toward its own look', () => {
  const lean = (raceId: string, field: 'headwear' | 'back', id: string) => {
    let hits = 0;
    for (let i = 0; i < 120; i += 1) if (generateOperatorDesign(`lean-${i}`, { species: raceId }).look[field] === id) hits += 1;
    return hits;
  };
  const baseline = (field: 'headwear' | 'back', id: string) => {
    let hits = 0;
    for (let i = 0; i < 120; i += 1) if (generateOperatorDesign(`lean-${i}`, { species: 'human' }).look[field] === id) hits += 1;
    return hits;
  };
  assert.ok(lean('antlerkin', 'headwear', 'antlers') > baseline('headwear', 'antlers') + 10);
  assert.ok(lean('nullborn', 'back', 'cables') > baseline('back', 'cables') + 10);
  assert.ok(lean('bubblenaught', 'headwear', 'bubblehelm') > baseline('headwear', 'bubblehelm') + 10);
});
