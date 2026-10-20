import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BALL_JOIN_THRESHOLD, THROW_FEELS, WINNER_STEPS } from '@/game/data/hideoutBall';
import {
  ballInterest,
  carryBall,
  celebrationStage,
  createBall,
  finishCelebration,
  isBallShy,
  pickRacers,
  startFetch,
  stepFetch,
  stepFlight,
  stepRacer,
  throwBall,
  throwFeelFor,
  type Racer,
} from '@/game/engine/hideoutBall';

const range = { min: 0, max: 600 };
const racer = (id: string, x: number, interest = 1, speed = 1): Racer => ({ id, x, speed, bondOrder: 0, interest });

function fly(ball: ReturnType<typeof createBall>, racers: Racer[]) {
  const feel = THROW_FEELS[0]!;
  for (let i = 0; i < 4000 && ball.phase === 'flying'; i += 1) stepFlight(ball, 16, feel, range, racers);
}

describe('hideout ball', () => {
  it('walks the ground, fetch, carried, flying, racing life', () => {
    const ball = createBall(300);
    assert.equal(throwBall(ball, 1, 1, THROW_FEELS[0]!), false);
    assert.ok(startFetch(ball));
    assert.equal(stepFetch(ball, 100), false);
    assert.ok(stepFetch(ball, 296));
    carryBall(ball, 296);
    assert.equal(ball.x, 296);
    assert.ok(throwBall(ball, 1, 1, THROW_FEELS[0]!));
    fly(ball, [racer('a', 10)]);
    assert.equal(ball.phase, 'racing');
    assert.deepEqual(ball.racers, ['a']);
    assert.ok(ball.x > 296 && ball.x <= range.max);
  });

  it('rests on the ground when nobody wants it', () => {
    const ball = createBall(100);
    startFetch(ball); stepFetch(ball, 100); throwBall(ball, 1, 0.5, THROW_FEELS[0]!);
    fly(ball, [racer('shy', 0, 0.2)]);
    assert.equal(ball.phase, 'ground');
  });

  it('throws farther for a stronger throw and a stronger feel', () => {
    const land = (power: number, feelIndex: number) => {
      const ball = createBall(0); ball.phase = 'carried';
      throwBall(ball, 1, power, THROW_FEELS[feelIndex]!);
      fly(ball, []);
      return ball.x;
    };
    assert.ok(land(1, 0) > land(0.3, 0));
    const rocket = THROW_FEELS.findIndex((f) => f.id === 'rocket');
    assert.ok(land(0.6, rocket) > land(0.6, 0));
  });

  it('gives a theme the same feel every time', () => {
    assert.equal(throwFeelFor('neon-night').id, throwFeelFor('neon-night').id);
    const seen = new Set(Array.from({ length: 80 }, (_, i) => throwFeelFor(`theme-${i}`).id));
    assert.equal(seen.size, THROW_FEELS.length);
  });

  it('lets the fastest pet win and then plays the routine in order', () => {
    const ball = createBall(300); ball.phase = 'racing'; ball.x = 300;
    let fast = racer('fast', 0, 1, 1.4);
    let slow = racer('slow', 0, 1, 0.8);
    let now = 0;
    for (let i = 0; i < 2000 && ball.phase === 'racing'; i += 1) {
      now += 16;
      fast = { ...fast, x: stepRacer(ball, fast, 16, now) };
      slow = { ...slow, x: stepRacer(ball, slow, 16, now) };
    }
    assert.equal(ball.phase, 'celebrating');
    assert.equal(ball.winnerId, 'fast');
    const order: string[] = [];
    for (let t = ball.celebrationStart; t < ball.celebrationStart + 5000; t += 50) {
      const stage = celebrationStage(ball, t);
      if (order[order.length - 1] !== stage.step) order.push(stage.step);
      if (stage.done) break;
    }
    assert.deepEqual(order, WINNER_STEPS.map((s) => s.id));
    finishCelebration(ball, 250);
    assert.equal(ball.phase, 'ground');
    assert.equal(ball.winnerId, null);
  });

  it('keeps most pets keen, a few ball-shy, and lets bond and play win the shy ones over', () => {
    const ids = Array.from({ length: 400 }, (_, i) => `pet-${i}`);
    const shy = ids.filter(isBallShy);
    assert.ok(shy.length > 40 && shy.length < 130);
    const plain = ids.find((id) => !isBallShy(id))!;
    assert.ok(ballInterest({ petId: plain, bondOrder: 0, playedToday: false }) >= BALL_JOIN_THRESHOLD);
    const s = shy[0]!;
    assert.ok(ballInterest({ petId: s, bondOrder: 0, playedToday: false }) < BALL_JOIN_THRESHOLD);
    assert.ok(ballInterest({ petId: s, bondOrder: 0, playedToday: true }) > ballInterest({ petId: s, bondOrder: 0, playedToday: false }));
    assert.ok(ballInterest({ petId: s, bondOrder: 4, playedToday: true }) >= BALL_JOIN_THRESHOLD);
  });

  it('picks only interested racers, most keen first', () => {
    const field = pickRacers([racer('b', 0, 0.6), racer('a', 0, 0.9), racer('c', 0, 0.2)]);
    assert.deepEqual(field.map((r) => r.id), ['a', 'b']);
  });
});
