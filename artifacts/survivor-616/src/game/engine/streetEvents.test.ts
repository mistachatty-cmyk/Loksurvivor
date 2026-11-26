import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { STREET_EVENTS, STREET_EVENT_FIRST_MS, defineStreetEvent, streetEventDelayMs, streetEventFor } from '@/game/data/streetLife/events';
import { createWorld, stepWorld, streetMod } from '@/game/engine/world';

const idle = { moveX: 0, moveY: 0, ultimate: false };

test('street events are valid, unique and seeded', () => {
  const ids = new Set(STREET_EVENTS.map((e) => e.id));
  assert.equal(ids.size, STREET_EVENTS.length);
  assert.throws(() => defineStreetEvent({ ...STREET_EVENTS[0]!, id: 'Bad Id' }));
  assert.throws(() => defineStreetEvent({ ...STREET_EVENTS[0]!, durationMs: 0 }));
  const seen = new Set<string>();
  for (let i = 0; i < 200; i += 1) {
    assert.equal(streetEventFor(55, i).id, streetEventFor(55, i).id);
    seen.add(streetEventFor(55, i).id);
    assert.ok(streetEventDelayMs(55, i) > 0);
  }
  assert.equal(seen.size, STREET_EVENTS.length, 'every event can be picked');
  assert.ok(streetEventDelayMs(55, 0) >= STREET_EVENT_FIRST_MS);
});

test('an event starts on time, applies its effect, and ends cleanly', () => {
  const area = AREAS.find((a) => a.endless)!;
  const w = createWorld(area, CHARACTERS[0]!, { ...CHARACTERS[0]!.stats }, 4242);
  const first = streetEventFor(w.endless!.rngSeed, 0);
  assert.equal(w.streetEvent, null);
  assert.equal(streetMod(w, 'damageMult'), 1);
  w.now = w.nextStreetEventAt;
  stepWorld(w, 1 / 30, idle);
  assert.equal(w.streetEvent?.id, first.id);
  assert.ok(w.alerts.some((a) => a.text === first.startText));
  for (const [key, value] of Object.entries(first.mods ?? {})) assert.equal(streetMod(w, key as 'damageMult'), value);
  w.now = w.streetEvent!.endsAt + 1;
  stepWorld(w, 1 / 30, idle);
  assert.equal(w.streetEvent, null);
  assert.equal(streetMod(w, 'damageMult'), 1);
  assert.ok(w.nextStreetEventAt > w.now, 'the next one is scheduled later');
});
