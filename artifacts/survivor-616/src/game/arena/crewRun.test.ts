import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AREAS } from '../data/areas';
import { CHARACTERS } from '../data/characters';
import { stepWorld } from '../engine/world';
import type { CrewRunRoster } from './crewRunNet';
import { buildCrewRunWorld, reconcileGuests } from './crewRunWorld';

const seat = (id: string, name: string, characterId = CHARACTERS[0]!.id) => ({ id, userId: `u-${id}`, name, characterId });
const roster = (...guests: string[]): CrewRunRoster => ({
  areaId: AREAS[0]!.id,
  seed: 616,
  seats: [seat('host', 'Host'), ...guests.map((id) => seat(id, id))],
});
const idle = { moveX: 0, moveY: 0 };

test('a crew run world starts with the roster and shares its seed', () => {
  const a = buildCrewRunWorld(roster('p2'))!;
  const b = buildCrewRunWorld(roster('p2'))!;
  assert.equal(a.world.guests.length, 1);
  assert.equal(a.world.arenaMode, true);
  for (let i = 0; i < 120; i += 1) {
    stepWorld(a.world, 1 / 60, { ...idle, ultimate: false, guestInputs: [idle] });
    stepWorld(b.world, 1 / 60, { ...idle, ultimate: false, guestInputs: [idle] });
  }
  assert.equal(a.world.enemies.length, b.world.enemies.length, 'same seed, same start');
});

test('players can drop in and out while the run keeps going', () => {
  const { world } = buildCrewRunWorld(roster())!;
  assert.equal(world.guests.length, 0);
  const second = reconcileGuests(world, roster('p2', 'p3').seats);
  assert.deepEqual(second.joined.map((s) => s.id), ['p2', 'p3']);
  assert.equal(world.guests.length, 2);
  for (let i = 0; i < 60; i += 1) stepWorld(world, 1 / 60, { ...idle, ultimate: false, guestInputs: world.guests.map(() => idle) });
  const dropped = reconcileGuests(world, roster('p3').seats);
  assert.deepEqual(dropped.left, ['p2']);
  assert.deepEqual(world.guests.map((g) => g.id), ['p3']);
  // Reconciling again changes nothing.
  const again = reconcileGuests(world, roster('p3').seats);
  assert.equal(again.joined.length + again.left.length, 0);
  for (let i = 0; i < 60; i += 1) stepWorld(world, 1 / 60, { ...idle, ultimate: false, guestInputs: [idle] });
  assert.equal(world.outcome === 'running' || world.outcome === 'dead' || world.outcome === 'cleared', true);
});

test('a late joiner lands in the right wave window', () => {
  const { world } = buildCrewRunWorld(roster('p2'))!;
  world.time = 90;
  for (let i = 0; i < 180; i += 1) stepWorld(world, 1 / 60, { ...idle, ultimate: false, guestInputs: [idle] });
  assert.ok(world.time >= 92);
});

test('an unknown area cannot be joined', () => {
  assert.equal(buildCrewRunWorld({ ...roster(), areaId: 'no-such-area' }), null);
});
