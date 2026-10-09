import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { AMBIENT_PICKUPS, AMBIENT_TIMING, AMBIENT_VISITORS } from '@/game/data/hideoutAmbient';
import { HIDEOUT_EMOTES, HIDEOUT_MOVES, HIDEOUT_TEMPERAMENTS } from '@/game/data/hideoutEvents';
import {
  nextVisitorAt,
  petsToReact,
  pickVisitor,
  pickupExpired,
  pickupWithinReach,
  spawnPickup,
  spawnVisitor,
  squashActor,
  squashProgress,
  stepActor,
} from '@/game/engine/hideoutAmbient';
import { PER_GRANT_MAX } from '@/game/engine/hideoutRewards';
import { createRng } from '@/game/engine/math';

const EN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'locales', 'en.json'), 'utf8')) as Record<string, string>;
const range = { min: 100, max: 700 };

describe('hideout ambient life', () => {
  it('has a line, a reaction for every temperament, and real emotes and moves', () => {
    for (const v of AMBIENT_VISITORS) {
      assert.ok(EN[v.lineKey], v.lineKey);
      for (const t of HIDEOUT_TEMPERAMENTS) {
        const r = v.reactions[t.id];
        assert.ok(r && HIDEOUT_EMOTES.includes(r.emote) && HIDEOUT_MOVES.includes(r.move), `${v.id}/${t.id}`);
      }
    }
    assert.ok(AMBIENT_VISITORS.some((v) => v.reactions.bouncy.emote === 'adore'));
  });

  it('keeps pickups within the per-grant limits', () => {
    for (const p of AMBIENT_PICKUPS) {
      for (const [k, n] of Object.entries(p.reward)) assert.ok((n as number) <= PER_GRANT_MAX[k as keyof typeof PER_GRANT_MAX], `${p.id}.${k}`);
    }
  });

  it('sends a crossing visitor across the whole strip and then drops it', () => {
    const llama = AMBIENT_VISITORS.find((v) => v.id === 'llama')!;
    const actor = spawnVisitor(1, llama, range, createRng(3), 0);
    let now = 0;
    let done = false;
    let sawMiddle = false;
    for (let i = 0; i < 4000 && !done; i += 1) {
      now += 16;
      done = stepActor(actor, 16, now, range);
      if (actor.x > 300 && actor.x < 500) sawMiddle = true;
    }
    assert.ok(done && sawMiddle);
  });

  it('lets a mite wander, be squashed once, play the squash and then be dropped', () => {
    const mite = AMBIENT_VISITORS.find((v) => v.id === 'digi-mite')!;
    const actor = spawnVisitor(2, mite, range, createRng(5), 0);
    assert.ok(actor.leaveAt > 0);
    actor.x = 400;
    assert.ok(squashActor(actor, 1000));
    assert.equal(squashActor(actor, 1100), false);
    assert.equal(squashProgress(actor, 1000 + AMBIENT_TIMING.squashMs / 2), 0.5);
    assert.equal(stepActor(actor, 16, 1100, range), false);
    assert.equal(stepActor(actor, 16, 1000 + AMBIENT_TIMING.squashMs + 500, range), true);
    const llama = spawnVisitor(3, AMBIENT_VISITORS.find((v) => v.id === 'llama')!, range, createRng(1), 0);
    assert.equal(squashActor(llama, 10), false);
  });

  it('makes each nearby pet react once', () => {
    const llama = spawnVisitor(1, AMBIENT_VISITORS[0]!, range, createRng(1), 0);
    llama.x = 300;
    const pets = [{ id: 'a', x: 310 }, { id: 'b', x: 600 }];
    assert.deepEqual(petsToReact(llama, pets, 80), ['a']);
    assert.deepEqual(petsToReact(llama, pets, 80), []);
    llama.x = 590;
    assert.deepEqual(petsToReact(llama, pets, 80), ['b']);
  });

  it('picks varied visitors, never the same one twice running, and times the next one later', () => {
    const rng = createRng(9);
    let last: string | null = null;
    const seen = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      const v = pickVisitor(rng, last);
      assert.notEqual(v.id, last);
      seen.add(v.id);
      last = v.id;
    }
    assert.equal(seen.size, AMBIENT_VISITORS.length);
    assert.ok(nextVisitorAt(1000, createRng(1)) > 1000 + AMBIENT_TIMING.visitorGapMs[0] - 1);
  });

  it('spawns pickups inside the strip, finds the nearest in reach, and expires them', () => {
    const rng = createRng(4);
    const p = spawnPickup(1, range, rng, 0);
    assert.ok(p.x >= range.min && p.x <= range.max);
    assert.equal(pickupWithinReach([p], p.x + 2, 80)?.uid, 1);
    assert.equal(pickupWithinReach([p], p.x + 500, 80), undefined);
    assert.equal(pickupExpired(p, AMBIENT_TIMING.pickupLifeMs - 1), false);
    assert.equal(pickupExpired(p, AMBIENT_TIMING.pickupLifeMs + 1), true);
  });
});
