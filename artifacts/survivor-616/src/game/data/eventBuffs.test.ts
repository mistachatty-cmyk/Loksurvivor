import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { CHOICE_EVENTS } from '@/game/data/choiceEvents';
import {
  EVENT_BUFFS,
  EVENT_BUFFS_BY_ID,
  EVENT_BUFF_MS,
  activeEventBuff,
  applyEventBuff,
  describePercent,
  normalizeEventBuff,
  startEventBuff,
} from '@/game/data/eventBuffs';
import { applyChoice } from '@/game/engine/choiceEvents';
import { createInitialMeta } from '@/game/state/metaStore';

const EN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'locales', 'en.json'), 'utf8')) as Record<string, string>;
const NOON = new Date(2026, 9, 6, 12, 0, 0).getTime();

describe('event buffs', () => {
  it('pairs every boost with a real cost, and has text for each', () => {
    for (const buff of EVENT_BUFFS) {
      assert.notEqual(buff.boost.stat, buff.cost.stat, buff.id);
      assert.ok(describePercent(buff.boost) > 0, `${buff.id} boost helps`);
      assert.ok(describePercent(buff.cost) < 0, `${buff.id} cost hurts`);
      assert.ok(EN[`eventbuff.${buff.id}.name`], buff.id);
    }
  });

  it('is pointed at by real buffs only, and there are several story outcomes using them', () => {
    let used = 0;
    for (const event of CHOICE_EVENTS) for (const choice of event.choices) for (const outcome of choice.outcomes) {
      if (outcome.buffId) { used += 1; assert.ok(EVENT_BUFFS_BY_ID[outcome.buffId], `${event.id}/${outcome.id}`); }
    }
    assert.ok(used >= 8);
  });

  it('applies the boost and the cost for an hour, then stops', () => {
    const buff = startEventBuff('warm-heart', NOON)!;
    assert.equal(buff.until, NOON + EVENT_BUFF_MS);
    const stats = { maxHp: 100, speed: 100, power: 100, area: 1, haste: 1, magnet: 1, armor: 0.1, crit: 0, lifesteal: 0 };
    applyEventBuff(stats, activeEventBuff(buff, NOON + 1000));
    assert.equal(Math.round(stats.speed), 108);
    assert.equal(Math.round(stats.power), 95);
    assert.equal(activeEventBuff(buff, NOON + EVENT_BUFF_MS), null);
    assert.equal(startEventBuff('nope', NOON), null);
  });

  it('is started by a choice that rolls a buff outcome, and replaces an older one', () => {
    let found: { eventId: string; choiceId: string; buffId: string } | null = null;
    for (const event of CHOICE_EVENTS) for (const choice of event.choices) {
      if (!found && !choice.requires && choice.outcomes.length === 1 && choice.outcomes[0]!.buffId) found = { eventId: event.id, choiceId: choice.id, buffId: choice.outcomes[0]!.buffId };
    }
    if (!found) {
      // Fall back to any buff outcome reachable with a seed sweep.
      for (const event of CHOICE_EVENTS) for (const choice of event.choices) {
        if (found || choice.requires) continue;
        for (let seed = 1; seed < 200 && !found; seed += 1) {
          const result = applyChoice(createInitialMeta(), event.id, choice.id, seed, { now: NOON, elixirCap: 3 });
          if (result.ok && result.outcome?.buffId) found = { eventId: event.id, choiceId: choice.id, buffId: result.outcome.buffId };
        }
      }
    }
    assert.ok(found);
    const old = { ...createInitialMeta(), eventBuff: { buffId: 'thick-skin', until: NOON + 5000 } };
    for (let seed = 1; seed < 400; seed += 1) {
      const result = applyChoice(old, found.eventId, found.choiceId, seed, { now: NOON, elixirCap: 3 });
      if (result.ok && result.outcome?.buffId) {
        assert.equal(result.meta.eventBuff?.buffId, result.outcome.buffId);
        assert.equal(result.meta.eventBuff?.until, NOON + EVENT_BUFF_MS);
        return;
      }
    }
    assert.fail('no buff outcome rolled');
  });

  it('cleans saved values', () => {
    assert.equal(normalizeEventBuff('x'), null);
    assert.equal(normalizeEventBuff({ buffId: 'nope', until: 5 }), null);
    assert.deepEqual(normalizeEventBuff({ buffId: 'thick-skin', until: 9 }), { buffId: 'thick-skin', until: 9 });
  });
});
