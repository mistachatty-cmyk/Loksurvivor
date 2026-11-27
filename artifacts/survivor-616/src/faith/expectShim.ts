// A tiny vitest-style expect over node:assert, so the faith tests ported from Queens N Kings run unchanged here.
import assert from 'node:assert/strict';

type M = {
  toBe(x: unknown): void;
  toEqual(x: unknown): void;
  toBeNull(): void;
  toBeCloseTo(x: number, digits?: number): void;
  toBeGreaterThan(x: number): void;
  toBeGreaterThanOrEqual(x: number): void;
  toBeLessThan(x: number): void;
  toBeLessThanOrEqual(x: number): void;
  toContain(x: unknown): void;
};
export function expect(v: unknown): M & { not: M } {
  const m: M = {
    toBe: (x) => assert.equal(v, x),
    toEqual: (x) => assert.deepEqual(v, x),
    toBeNull: () => assert.equal(v, null),
    toBeCloseTo: (x, d = 2) => assert.ok(Math.abs((v as number) - x) < 10 ** -d / 2, `${v} not close to ${x}`),
    toBeGreaterThan: (x) => assert.ok((v as number) > x, `${v} > ${x}`),
    toBeGreaterThanOrEqual: (x) => assert.ok((v as number) >= x, `${v} >= ${x}`),
    toBeLessThan: (x) => assert.ok((v as number) < x, `${v} < ${x}`),
    toBeLessThanOrEqual: (x) => assert.ok((v as number) <= x, `${v} <= ${x}`),
    toContain: (x) => assert.ok((v as { includes(y: unknown): boolean }).includes(x), `missing ${String(x)}`),
  };
  const not: M = {
    toBe: (x) => assert.notEqual(v, x),
    toEqual: (x) => assert.notDeepEqual(v, x),
    toBeNull: () => assert.notEqual(v, null),
    toBeCloseTo: () => assert.fail('not.toBeCloseTo unsupported'),
    toBeGreaterThan: (x) => assert.ok(!((v as number) > x)),
    toBeGreaterThanOrEqual: (x) => assert.ok(!((v as number) >= x)),
    toBeLessThan: (x) => assert.ok(!((v as number) < x)),
    toBeLessThanOrEqual: (x) => assert.ok(!((v as number) <= x)),
    toContain: (x) => assert.ok(!(v as { includes(y: unknown): boolean }).includes(x)),
  };
  return { ...m, not };
}
