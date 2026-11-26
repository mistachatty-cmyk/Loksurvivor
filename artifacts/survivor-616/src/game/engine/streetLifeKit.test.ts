import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { STREET_PIECES, streetLifeForChunk } from '@/game/data/streetLife';
import { BLOCK_MILESTONES, MILESTONE_STATS, milestoneForBlockCount } from '@/game/data/streetLife/milestones';
import { definePiece, trackBuilder } from '@/game/data/streetLife/pieceKit';
import { createWorld, stepWorld } from '@/game/engine/world';

const idle = { moveX: 0, moveY: 0, ultimate: false };

test('every street piece is valid, unique and fits the chunk', () => {
  const ids = new Set<string>();
  let share = 0;
  for (const piece of STREET_PIECES) {
    assert.ok(!ids.has(piece.id), `${piece.id} is unique`);
    ids.add(piece.id);
    share += piece.chance;
  }
  assert.ok(share <= 0.6, 'pieces together stay a minority of chunks');
  const seen = new Set<string>();
  for (let cx = -20; cx <= 20; cx += 1) {
    for (let cy = -20; cy <= 20; cy += 1) {
      for (const axis of ['horizontal', 'vertical'] as const) {
        const out = streetLifeForChunk(cx, cy, 31337, axis);
        if (out.pieceId) seen.add(out.pieceId);
        const points = [...out.free, ...(out.track?.gates ?? []), ...(out.track?.coins ?? [])];
        for (const p of points) {
          assert.ok(Math.abs(p.x) <= 330 && Math.abs(p.y) <= 330, `${out.pieceId} stays inside its chunk`);
        }
      }
    }
  }
  for (const piece of STREET_PIECES) assert.ok(seen.has(piece.id), `${piece.id} shows up somewhere`);
});

test('definePiece rejects bad records and trackBuilder is reusable', () => {
  assert.throws(() => definePiece({ id: 'Bad Id', name: 'x', chance: 0.1, build: () => ({}) }));
  assert.throws(() => definePiece({ id: 'ok', name: 'x', chance: 0, build: () => ({}) }));
  const mini = definePiece({ id: 'mini-run', name: 'Mini', chance: 0.5, build: trackBuilder({ gates: [4, 4], length: 200, sway: [10, 10], salt: 900 }) });
  assert.equal(mini.id, 'mini-run');
});

test('block milestones come every 5 blocks and the grand one every 25', () => {
  assert.equal(milestoneForBlockCount(4), null);
  assert.equal(milestoneForBlockCount(5)?.id, 'minor');
  assert.equal(milestoneForBlockCount(25)?.id, 'grand');
  assert.equal(milestoneForBlockCount(30)?.id, 'minor');
  assert.ok(BLOCK_MILESTONES.length >= 2 && MILESTONE_STATS.length >= 5);
});

test('crossing five new blocks raises exactly one stat', () => {
  const area = AREAS.find((a) => a.endless)!;
  const w = createWorld(area, CHARACTERS[0]!, { ...CHARACTERS[0]!.stats }, 2026);
  const total = (s: typeof w.stats) => s.power + s.area + s.speed + s.magnet + s.maxHp + s.armor + s.crit;
  stepWorld(w, 1 / 30, idle);
  const before = total(w.stats);
  for (let i = 1; i <= 5; i += 1) {
    w.player.x = i * 640 + 10;
    w.player.y = 10;
    stepWorld(w, 1 / 30, idle);
  }
  assert.equal(w.blocksCrossed, 5);
  assert.ok(total(w.stats) > before, 'a stat went up');
  assert.ok(w.alerts.some((a) => a.text.startsWith('BLOCK 5')));
  // Going back over blocks you have already crossed pays nothing.
  for (let i = 4; i >= 1; i -= 1) {
    w.player.x = i * 640 + 10;
    stepWorld(w, 1 / 30, idle);
  }
  assert.equal(w.blocksCrossed, 5);
});
