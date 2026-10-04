import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AXES, AXIS_BY_ID, AXIS_GROUPS, BODY_PLANS, BODY_PLAN_BY_ID, FINDABILITY, QUIRKS, QUIRK_BY_ID, THEMES, TIERS,
  definingTraits, feelLabel, rollCreature,
} from '@/game/data/creatureTraits';
import { FACTIONS } from '@/game/data/factions';

const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');

describe('creature trait data', () => {
  it('has a deep axis set with unique ids in every group', () => {
    assert.ok(AXES.length >= 45);
    assert.equal(new Set(AXES.map((a) => a.id)).size, AXES.length);
    for (const group of AXIS_GROUPS) assert.ok(AXES.filter((a) => a.group === group).length >= 5, group);
    assert.ok(AXIS_BY_ID.cute && AXIS_BY_ID.dread);
  });

  it('only references things that exist', () => {
    for (const quirk of QUIRKS) for (const id of Object.keys(quirk.shift)) assert.ok(AXIS_BY_ID[id], `${quirk.id} -> ${id}`);
    for (const theme of THEMES) {
      for (const [id, [lo, hi]] of Object.entries(theme.bias)) {
        assert.ok(AXIS_BY_ID[id], `${theme.id} axis ${id}`);
        assert.ok(lo >= 0 && hi <= 5 && lo <= hi, `${theme.id} range ${id}`);
      }
      for (const q of theme.quirks) assert.ok(QUIRK_BY_ID[q], `${theme.id} quirk ${q}`);
      for (const p of theme.plans) assert.ok(BODY_PLAN_BY_ID[p], `${theme.id} plan ${p}`);
      assert.ok(theme.words.length >= 3, theme.id);
      if (theme.faction) assert.ok(FACTIONS.some((f) => f.id === theme.faction), `${theme.id} faction ${theme.faction}`);
    }
    assert.ok(THEMES.some((t) => t.faction), 'some themes come from factions');
  });

  it('keeps ids unique and the banned word out of all text', () => {
    for (const list of [QUIRKS, BODY_PLANS, THEMES, TIERS, FINDABILITY]) {
      assert.equal(new Set(list.map((x) => x.id)).size, list.length);
    }
    const text = JSON.stringify([AXES, QUIRKS, BODY_PLANS, THEMES, TIERS, FINDABILITY]);
    assert.ok(!BANNED.test(text));
  });

  it('has findability and tier as two separate ladders', () => {
    assert.ok(FINDABILITY.length >= 6 && TIERS.length >= 5);
    assert.ok(TIERS.every((t, i) => i === 0 || t.extremes >= TIERS[i - 1]!.extremes), 'higher tiers are more extreme');
    const top = TIERS[TIERS.length - 1]!;
    assert.equal(top.maxPerSave, 1);
    assert.equal(top.transferable, false);
  });
});

describe('creature generation', () => {
  it('is deterministic: the seed is the creature', () => {
    assert.deepEqual(rollCreature('grand-rapids'), rollCreature('grand-rapids'));
    assert.notDeepEqual(rollCreature('grand-rapids'), rollCreature('grand-rapids-2'));
  });

  it('keeps every trait on 0 to 5 and every reference valid', () => {
    for (let i = 0; i < 1500; i += 1) {
      const c = rollCreature(`range-${i}`);
      for (const a of AXES) {
        const v = c.traits[a.id]!;
        assert.ok(Number.isInteger(v) && v >= 0 && v <= 5, `${a.id}=${v}`);
      }
      assert.ok(BODY_PLAN_BY_ID[c.plan]);
      if (c.partsFrom) assert.notEqual(c.partsFrom, c.plan);
      for (const q of c.quirks) assert.ok(QUIRK_BY_ID[q]);
      assert.ok(!BANNED.test(c.name));
    }
  });

  it('is effectively infinite: thousands of seeds give almost no repeats', () => {
    const keys = new Set<string>();
    const names = new Set<string>();
    for (let i = 0; i < 10000; i += 1) {
      const c = rollCreature(`infinite-${i}`);
      keys.add(JSON.stringify([c.plan, c.partsFrom, c.themes, c.tier, c.traits, c.quirks]));
      names.add(c.name);
    }
    assert.ok(keys.size >= 9900, `distinct creatures ${keys.size}`);
    assert.ok(names.size >= 2500, `distinct names ${names.size}`);
  });

  it('makes higher tiers more extreme with more quirks', () => {
    const extremeCount = (tier: string) => {
      let total = 0;
      let quirks = 0;
      for (let i = 0; i < 300; i += 1) {
        const c = rollCreature(`tier-${tier}-${i}`, { tier });
        total += AXES.filter((a) => c.traits[a.id] === 0 || c.traits[a.id] === 5).length;
        quirks += c.quirks.length;
      }
      return { total, quirks };
    };
    const wild = extremeCount('wild');
    const mythic = extremeCount('mythic');
    assert.ok(mythic.total > wild.total, 'mythic creatures have more extreme traits');
    assert.ok(mythic.quirks > wild.quirks, 'mythic creatures have more quirks');
  });

  it('keeps findability independent of tier', () => {
    const pair = new Set<string>();
    for (let i = 0; i < 20000; i += 1) {
      const c = rollCreature(`rarity-${i}`);
      pair.add(`${c.tier}|${c.findability}`);
    }
    assert.ok(pair.has('wild|hidden') || pair.has('wild|elusive'), 'a plain creature can be hard to find');
    assert.ok(pair.has('mythic|ubiquitous') || pair.has('mythic|common'), 'a mythic creature can be easy to find');
    assert.equal(rollCreature('x', { tier: 'mythic', findability: 'common' }).findability, 'common');
    assert.equal(rollCreature('x', { tier: 'mythic', findability: 'common' }).tier, 'mythic');
  });

  it('can be both adorable and terrifying, or only one', () => {
    const feels = new Set<string>();
    for (let i = 0; i < 4000; i += 1) feels.add(feelLabel(rollCreature(`feel-${i}`).traits));
    for (const label of ['Adorably terrifying', 'Adorable', 'Terrifying']) assert.ok(feels.has(label), label);
  });

  it('honors theme, plan and hybrid options and describes a creature by its strongest traits', () => {
    const c = rollCreature('opts', { themes: [THEMES[0]!.id], plan: 'owl', hybridChance: 1 });
    assert.deepEqual(c.themes, [THEMES[0]!.id]);
    assert.equal(c.plan, 'owl');
    const defining = definingTraits(c.traits, 3);
    assert.equal(defining.length, 3);
    assert.ok(Math.abs(defining[0]!.value - 2.5) >= Math.abs(defining[2]!.value - 2.5));
  });
});
