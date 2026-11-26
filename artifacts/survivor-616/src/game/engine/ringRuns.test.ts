import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { BURST_TOKENS, rollBurstToken, burstTokenCount } from '@/game/data/ringRuns';
import { streetLifeForChunk } from '@/game/data/streetLife';
import { createWorld, stepWorld, type LiveTrack } from '@/game/engine/world';

const idle = { moveX: 0, moveY: 0, ultimate: false };

test('ring layouts are deterministic, rare and leave the origin clear', () => {
  assert.deepEqual(streetLifeForChunk(0, 0, 77, 'horizontal'), { free: [], track: null, pieceId: null });
  let tracks = 0;
  let fields = 0;
  let chunks = 0;
  for (let cx = -12; cx <= 12; cx += 1) {
    for (let cy = -12; cy <= 12; cy += 1) {
      const a = streetLifeForChunk(cx, cy, 99, 'vertical');
      const b = streetLifeForChunk(cx, cy, 99, 'vertical');
      assert.deepEqual(a, b);
      chunks += 1;
      if (a.track) {
        tracks += 1;
        assert.ok(a.track.gates.length >= 5 && a.track.gates.length <= 14);
        assert.ok(a.track.coins.length > a.track.gates.length);
      }
      if (a.free.length >= 5) fields += 1;
    }
  }
  assert.ok(tracks > 0 && tracks / chunks < 0.14, 'tracks exist but stay rare');
  assert.ok(fields > 0, 'ring fields exist');
});

test('token roll covers every kind and luck shifts weight away from gold', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 400; i += 1) seen.add(rollBurstToken(i / 400, 0));
  assert.equal(seen.size, BURST_TOKENS.length);
  let goldLow = 0;
  let goldHigh = 0;
  for (let i = 0; i < 400; i += 1) {
    if (rollBurstToken(i / 400, 0) === 'gold') goldLow += 1;
    if (rollBurstToken(i / 400, 1) === 'gold') goldHigh += 1;
  }
  assert.ok(goldHigh < goldLow);
  assert.ok(burstTokenCount(1) > burstTokenCount(2) && burstTokenCount(2) > burstTokenCount(3));
});

test('running a whole Ring Run in order finishes it, pays out and explodes into tokens', () => {
  const area = AREAS.find((a) => a.endless)!;
  const w = createWorld(area, CHARACTERS[0]!, CHARACTERS[0]!.stats, 616);
  const gates = Array.from({ length: 6 }, (_, i) => ({ x: 4000 + i * 60, y: 4000, kind: 'coin' as const }));
  const cum = [0];
  for (let i = 1; i < gates.length; i += 1) cum.push(cum[i - 1]! + 60);
  const track: LiveTrack = {
    id: 'test:track', chunkKey: 'test', gates, coins: [], cum, length: cum[cum.length - 1]!, state: 'ready', next: 0,
    startedAt: 0, gateDeadline: 0, failedAt: 0, mult: 1, earned: 0, place: 0,
    rivals: [
      { name: 'Cyan', color: '#46e6ff', speedMult: 0.01, dist: 0, x: 4000, y: 4000, trail: [], nextTrailAt: 0, lastDamageAt: 0, finished: false },
      { name: 'Magenta', color: '#ff4fd8', speedMult: 0.01, dist: 0, x: 4000, y: 4000, trail: [], nextTrailAt: 0, lastDamageAt: 0, finished: false },
    ],
  };
  w.ringTracks.push(track);
  const before = w.cred;
  for (const g of gates) {
    w.player.x = g.x;
    w.player.y = g.y;
    stepWorld(w, 1 / 30, idle);
  }
  assert.equal(track.state, 'done');
  assert.equal(track.place, 1, 'slow rivals lose');
  assert.ok(w.cred > before, 'the finish pays cred');
  assert.ok(w.burstTokens.length >= burstTokenCount(1), 'first place explodes into tokens');
});

test('missing a gate fails the run and it can be retried from the start ring', () => {
  const area = AREAS.find((a) => a.endless)!;
  const w = createWorld(area, CHARACTERS[0]!, CHARACTERS[0]!.stats, 617);
  const gates = Array.from({ length: 4 }, (_, i) => ({ x: 5000 + i * 60, y: 5000, kind: 'coin' as const }));
  const track: LiveTrack = {
    id: 'test:track2', chunkKey: 'test', gates, coins: [], cum: [0, 60, 120, 180], length: 180, state: 'ready', next: 0,
    startedAt: 0, gateDeadline: 0, failedAt: 0, mult: 1, earned: 0, place: 0, rivals: [],
  };
  w.ringTracks.push(track);
  w.player.x = gates[0]!.x; w.player.y = gates[0]!.y;
  stepWorld(w, 1 / 30, idle);
  assert.equal(track.state, 'running');
  w.player.x = 5000; w.player.y = 5900;
  for (let i = 0; i < 30 * 8; i += 1) stepWorld(w, 1 / 30, idle);
  assert.equal(track.state, 'failed');
  for (let i = 0; i < 30 * 6; i += 1) stepWorld(w, 1 / 30, idle);
  w.player.x = gates[0]!.x; w.player.y = gates[0]!.y;
  stepWorld(w, 1 / 30, idle);
  assert.equal(track.state, 'running', 'stepping back in restarts it');
});
