import assert from 'node:assert/strict';
import test from 'node:test';

import { prefersReducedMotion } from '../motion';

/**
 * The contract worth testing here isn't "does it animate" -- it's that a player
 * with reduced motion on still sees the content. A skipped animation that
 * leaves elements at opacity 0 is a blank HUD, and that failure is silent.
 */

type MatchMedia = (query: string) => MediaQueryList;
type FakeWindow = { matchMedia?: MatchMedia };

// This test runs under plain node:test (no jsdom), so `window` doesn't exist
// at all until a test defines it -- `prefersReducedMotion` reads
// `window.matchMedia`, not a bare global `matchMedia`.
const setReducedMotion = (matches: boolean) => {
  (globalThis as { window?: FakeWindow }).window = {
    matchMedia: ((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as MatchMedia,
  };
};

const clearMatchMedia = () => {
  delete (globalThis as { window?: FakeWindow }).window;
};

test('prefersReducedMotion reports true when the media query matches', () => {
  setReducedMotion(true);
  assert.equal(prefersReducedMotion(), true);
  clearMatchMedia();
});

test('prefersReducedMotion reports false when it does not', () => {
  setReducedMotion(false);
  assert.equal(prefersReducedMotion(), false);
  clearMatchMedia();
});

test('prefersReducedMotion reads the media query on every call, so a mid-session toggle takes effect', () => {
  setReducedMotion(false);
  assert.equal(prefersReducedMotion(), false);
  setReducedMotion(true);
  assert.equal(prefersReducedMotion(), true);
  clearMatchMedia();
});

test('prefersReducedMotion does not throw where matchMedia is unavailable', () => {
  clearMatchMedia();
  assert.doesNotThrow(() => prefersReducedMotion());
  assert.equal(prefersReducedMotion(), false);
});
