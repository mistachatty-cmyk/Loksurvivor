import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createOperatorWalk, type OperatorWalk } from '@/game/engine/hideoutPets';
import {
  AUTO_RESUME_MS,
  OPERATOR_MANUAL_SPEED,
  createOperatorControl,
  nearestProp,
  nudgeOperator,
  setGoal,
  standingSpot,
  stepOperatorControl,
} from '@/game/engine/hideoutWalk';

const RANGE = { min: 100, max: 500 };
const NONE = { left: false, right: false };
const rng = () => 0.5;

function fresh(): { op: OperatorWalk; ctl: ReturnType<typeof createOperatorControl> } {
  const op = createOperatorWalk(RANGE, 0);
  op.x = 300;
  return { op, ctl: createOperatorControl() };
}

describe('hideout operator control', () => {
  it('walks to a tapped spot, arrives once and rests there', () => {
    const { op, ctl } = fresh();
    setGoal(op, ctl, 400, 0, RANGE);
    let arrivals = 0;
    let now = 0;
    for (let i = 0; i < 400 && ctl.mode === 'goto'; i += 1) {
      now += 16;
      if (stepOperatorControl(op, ctl, NONE, 16, now, RANGE, rng).arrived) arrivals += 1;
    }
    assert.equal(arrivals, 1);
    assert.equal(op.x, 400);
    assert.equal(op.mode, 'rest');
    assert.equal(ctl.mode, 'hold');
    assert.ok(ctl.strollPx >= 100 - 1);
  });

  it('faces the way it walks', () => {
    const { op, ctl } = fresh();
    setGoal(op, ctl, 150, 0, RANGE);
    assert.equal(op.dir, -1);
    setGoal(op, ctl, 480, 0, RANGE);
    assert.equal(op.dir, 1);
  });

  it('clamps a tap outside the walking range', () => {
    const { op, ctl } = fresh();
    setGoal(op, ctl, 9999, 0, RANGE);
    assert.equal(ctl.goalX, RANGE.max);
    setGoal(op, ctl, -50, 0, RANGE);
    assert.equal(ctl.goalX, RANGE.min);
  });

  it('moves with held keys at the manual speed and stays in range', () => {
    const { op, ctl } = fresh();
    const result = stepOperatorControl(op, ctl, { left: false, right: true }, 100, 100, RANGE, rng);
    assert.ok(Math.abs(op.x - (300 + OPERATOR_MANUAL_SPEED * 100)) < 1e-9);
    assert.equal(op.mode, 'walk');
    assert.equal(op.dir, 1);
    assert.ok(result.moved > 0);
    for (let i = 0; i < 100; i += 1) stepOperatorControl(op, ctl, { left: false, right: true }, 50, 200 + i * 50, RANGE, rng);
    assert.equal(op.x, RANGE.max);
  });

  it('does nothing when both directions are held', () => {
    const { op, ctl } = fresh();
    stepOperatorControl(op, ctl, { left: true, right: true }, 100, 100, RANGE, rng);
    assert.equal(op.x, 300);
  });

  it('stands still after a key is released, then goes back to wandering', () => {
    const { op, ctl } = fresh();
    stepOperatorControl(op, ctl, { left: false, right: true }, 100, 100, RANGE, rng);
    stepOperatorControl(op, ctl, NONE, 16, 120, RANGE, rng);
    assert.equal(ctl.mode, 'hold');
    assert.equal(op.mode, 'rest');
    const stillAt = op.x;
    stepOperatorControl(op, ctl, NONE, 16, 120 + AUTO_RESUME_MS - 100, RANGE, rng);
    assert.equal(op.x, stillAt);
    stepOperatorControl(op, ctl, NONE, 16, 120 + AUTO_RESUME_MS + 50, RANGE, rng);
    assert.equal(ctl.mode, 'auto');
    assert.equal(op.mode, 'walk');
  });

  it('snaps in reduced motion, and a nudge is one discrete step', () => {
    const { op, ctl } = fresh();
    setGoal(op, ctl, 420, 0, RANGE, true);
    assert.equal(op.x, 420);
    assert.equal(op.mode, 'rest');
    nudgeOperator(op, ctl, -1, 40, 10, RANGE);
    assert.equal(op.x, 380);
    nudgeOperator(op, ctl, -1, 4000, 20, RANGE);
    assert.equal(op.x, RANGE.min);
    assert.equal(ctl.mode, 'hold');
  });

  it('finds the nearest prop within reach and picks the standing spot beside it', () => {
    const props = [{ id: 'a', x: 150 }, { id: 'b', x: 320 }, { id: 'c', x: 340 }];
    assert.equal(nearestProp(325, props, 30)?.id, 'b');
    assert.equal(nearestProp(335, props, 30)?.id, 'c');
    assert.equal(nearestProp(330, props, 5), null);
    assert.equal(nearestProp(150, props, 30)?.id, 'a');
    assert.equal(standingSpot(400, 300, 30), 330);
    assert.equal(standingSpot(200, 300, 30), 270);
  });
});
