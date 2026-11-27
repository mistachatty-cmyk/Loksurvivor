import { describe, it } from 'node:test';
import { expect } from './expectShim';
import { stepMover, startVelocity, pickBounceVerse, SPEED_PX } from './bounce';
import { nextDelay, clampStay } from './bounceRuntime';
const F = { w: 400, h: 600, size: 70, top: 80 };
describe('bouncing Bible', () => {
  it('reflects off every wall and stays inside', () => {
    let m = { x: 300, y: 300, vx: 120, vy: 90 };
    for (let i = 0; i < 4000; i++) { m = stepMover(m, F, 0.016); expect(m.x).toBeGreaterThanOrEqual(0); expect(m.x).toBeLessThanOrEqual(F.w - F.size); expect(m.y).toBeGreaterThanOrEqual(F.top); expect(m.y).toBeLessThanOrEqual(F.h - F.size); }
  });
  it('flips direction at a wall', () => {
    expect(stepMover({ x: 328, y: 200, vx: 100, vy: 0 }, F, 0.1).vx).toBeLessThan(0);
    expect(stepMover({ x: 2, y: 200, vx: -100, vy: 0 }, F, 0.1).vx).toBeGreaterThan(0);
    expect(stepMover({ x: 100, y: 82, vx: 0, vy: -100 }, F, 0.1).vy).toBeGreaterThan(0);
  });
  it('start velocity has the requested speed and is never axis-aligned', () => {
    for (const r of [0, 0.25, 0.5, 0.99]) { const v = startVelocity(80, r); expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(80, 3); expect(Math.min(Math.abs(v.vx), Math.abs(v.vy))).toBeGreaterThan(10); }
    expect(SPEED_PX.slow).toBeLessThan(SPEED_PX.fast);
  });
  it('picks a saved verse when asked, else a seed verse', () => {
    const names = ['Genesis', 'Exodus'];
    const look = (r: string) => ({ ref: r, text: 't', tr: 'kjv' as const });
    expect(pickBounceVerse('saved', 0, ['2:3:4'], look, names)?.ref).toBe('Exodus 3:4');
    expect(pickBounceVerse('saved', 0, [], look, names)).not.toBeNull();
  });
  it('schedules by interval and retries soon when busy', () => {
    expect(nextDelay(10, false)).toBe(600_000); expect(nextDelay(10, true)).toBe(60_000); expect(nextDelay(7, false)).toBe(900_000);
    expect(clampStay(0)).toBe(0); expect(clampStay(99)).toBe(30);
  });
});
