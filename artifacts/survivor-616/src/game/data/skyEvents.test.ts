import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  SKY_BOOST_MS,
  SKY_EVENTS,
  SKY_WINDOW_MS,
  activeSkyBoost,
  normalizeSkyBoost,
  skyAt,
  skyForWindow,
  skyXpMultiplier,
  startSkyBoost,
} from '@/game/data/skyEvents';

const EN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'locales', 'en.json'), 'utf8')) as Record<string, string>;

/** A time inside the first window whose sky holds something. */
function busyTime(): number {
  for (let w = 1; w < 500; w += 1) if (skyForWindow(w).statBonus > 0 || skyForWindow(w).xpBonus > 0) return w * SKY_WINDOW_MS + 1000;
  throw new Error('no busy window');
}

describe('sky events', () => {
  it('has a locale string for every event', () => {
    for (const event of SKY_EVENTS) {
      assert.ok(EN[event.titleKey], event.titleKey);
      assert.ok(EN[event.lineKey], event.lineKey);
    }
  });

  it('rolls the same sky for the same window and shows every event over time', () => {
    assert.equal(skyForWindow(42).id, skyForWindow(42).id);
    const seen = new Set<string>();
    for (let w = 0; w < 400; w += 1) seen.add(skyForWindow(w).id);
    assert.equal(seen.size, SKY_EVENTS.length);
  });

  it('combines eclipse and glyphs into the 15% stat, 5% experience event', () => {
    const both = SKY_EVENTS.find((event) => event.id === 'eclipse-glyphs')!;
    assert.equal(both.statBonus, 0.15);
    assert.equal(both.xpBonus, 0.05);
  });

  it('starts one boost per window and lets it run for an hour', () => {
    const now = busyTime();
    const boost = startSkyBoost(null, now)!;
    assert.equal(boost.until, now + SKY_BOOST_MS);
    assert.equal(startSkyBoost(boost, now + 5000), null);
    assert.ok(activeSkyBoost(boost, now + SKY_BOOST_MS - 1));
    assert.equal(activeSkyBoost(boost, now + SKY_BOOST_MS), null);
    assert.equal(skyAt(now).id, boost.eventId);
  });

  it('scales experience only while a boost runs', () => {
    const now = busyTime();
    const boost = startSkyBoost(null, now)!;
    assert.equal(skyXpMultiplier(boost, now + SKY_BOOST_MS + 1), 1);
    assert.ok(skyXpMultiplier(boost, now) >= 1);
  });

  it('cleans saved values', () => {
    assert.equal(normalizeSkyBoost('x'), null);
    assert.equal(normalizeSkyBoost({ eventId: 'nope', until: 1, window: 1 }), null);
    assert.deepEqual(normalizeSkyBoost({ eventId: 'glyphs', until: 5, window: 2.9 }), { eventId: 'glyphs', until: 5, window: 2 });
  });
});
