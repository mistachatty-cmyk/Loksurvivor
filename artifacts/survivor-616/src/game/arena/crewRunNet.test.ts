import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { SupabaseClient } from '@workspace/lok-client';

import { seatJoiner, type HeldSeat } from '@/lib/social/crewRun';
import { openCrewRunGuest, openCrewRunHost, type CrewRunRoster, type CrewRunTick } from './crewRunNet';

/** A tiny in-memory stand-in for Realtime broadcast: everyone on a topic hears everyone else (self: false). */
function fakeHub() {
  const channels = new Map<string, Set<FakeChannel>>();
  class FakeChannel {
    handlers: Array<{ event: string; cb: (message: { payload: unknown }) => void }> = [];
    constructor(readonly topic: string) {}
    on(_type: string, filter: { event: string }, cb: (message: { payload: unknown }) => void) { this.handlers.push({ event: filter.event, cb }); return this; }
    subscribe(cb?: (status: string) => void) {
      (channels.get(this.topic) ?? channels.set(this.topic, new Set()).get(this.topic)!).add(this);
      queueMicrotask(() => cb?.('SUBSCRIBED'));
      return this;
    }
    send(message: { event: string; payload: unknown }) {
      for (const other of channels.get(this.topic) ?? []) {
        if (other === this) continue;
        const payload = JSON.parse(JSON.stringify(message.payload));
        queueMicrotask(() => other.handlers.filter((h) => h.event === message.event).forEach((h) => h.cb({ payload })));
      }
      return Promise.resolve('ok');
    }
  }
  const client = {
    channel: (topic: string) => new FakeChannel(topic),
    removeChannel: (channel: FakeChannel) => { channels.get(channel.topic)?.delete(channel); return Promise.resolve('ok'); },
  } as unknown as SupabaseClient;
  return client;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test('a guest drops in, hears the host, and the room turns away a fifth player', async () => {
  const client = fakeHub();
  const host = openCrewRunHost(client, 'crew-1');
  let seats: HeldSeat[] = [];
  const base: Omit<CrewRunRoster, 'seats'> = { areaId: 'a', seed: 7 };
  const rosterOf = (): CrewRunRoster => ({ ...base, seats: [{ id: 'host', userId: 'h', name: 'Host', characterId: 'c' }, ...seats.map(({ lastHeardAt: _t, ...s }) => s)] });
  const heard: Array<[string, { moveX: number; moveY: number }]> = [];
  host.setHandlers({
    onJoin: (request) => {
      const result = seatJoiner(seats, request, 0);
      if (result === 'full') { host.sendFull(request.requestId); return; }
      seats = result.seats;
      host.sendJoined(request.requestId, result.seatId, rosterOf(), 42);
    },
    onInput: (seatId, move) => heard.push([seatId, move]),
  });

  const guests = [1, 2, 3, 4].map((n) => openCrewRunGuest(client, 'crew-1'));
  const outcomes: string[] = [];
  const ticks: CrewRunTick[] = [];
  guests.forEach((guest, i) => {
    guest.setHandlers({
      onJoined: (seatId, roster, time) => outcomes.push(`${i}:${seatId}:${roster.seats.length}:${time}`),
      onFull: () => outcomes.push(`${i}:full`),
      onTick: (t) => { if (i === 0) ticks.push(t); },
    });
  });
  await tick();
  for (const [i, guest] of guests.entries()) { guest.requestJoin({ userId: `u${i}`, name: `P${i}`, characterId: 'c' }); await tick(); }
  await tick();
  assert.deepEqual(outcomes.sort(), ['0:p2:2:42', '1:p3:3:42', '2:p4:4:42', '3:full']);

  guests[0]!.sendInput('p2', { moveX: 1, moveY: -0.5 });
  await tick();
  assert.deepEqual(heard, [['p2', { moveX: 1, moveY: -0.5 }]]);

  host.sendTick({ inputs: { host: { moveX: 0, moveY: 1 }, p2: { moveX: 5, moveY: 0 } }, time: 12.5, kills: 3, guestKills: { p2: 2 }, outcome: 'running' });
  await tick();
  assert.equal(ticks.length, 1);
  assert.equal(ticks[0]!.time, 12.5);
  assert.equal(ticks[0]!.inputs.p2!.moveX, 1, 'out-of-range movement from the wire is clamped');
});

test('a guest ignores another guest\'s join answer and hears the end of the run', async () => {
  const client = fakeHub();
  const host = openCrewRunHost(client, 'crew-2');
  host.setHandlers({ onJoin: (request) => host.sendJoined(request.requestId, 'p2', { areaId: 'a', seed: 1, seats: [{ id: 'host', userId: 'h', name: 'Host', characterId: 'c' }] }, 0) });
  const a = openCrewRunGuest(client, 'crew-2');
  const b = openCrewRunGuest(client, 'crew-2');
  const joined: string[] = [];
  let ended = '';
  a.setHandlers({ onJoined: () => joined.push('a'), onEnd: (o) => { ended = o; } });
  b.setHandlers({ onJoined: () => joined.push('b') });
  await tick();
  a.requestJoin({ userId: 'ua', name: 'A', characterId: 'c' });
  await tick();
  assert.deepEqual(joined, ['a']);
  host.sendEnd('dead');
  await tick();
  assert.equal(ended, 'dead');
});

test('malformed ticks are dropped', async () => {
  const client = fakeHub();
  const host = openCrewRunHost(client, 'crew-3');
  const guest = openCrewRunGuest(client, 'crew-3');
  let count = 0;
  guest.setHandlers({ onTick: () => { count += 1; } });
  await tick();
  host.sendTick({ time: 'x' } as unknown as CrewRunTick);
  await tick();
  assert.equal(count, 0);
});
