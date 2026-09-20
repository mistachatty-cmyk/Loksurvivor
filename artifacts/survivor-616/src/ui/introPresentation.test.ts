import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { introPhysicsForTheme, pickIntroEvent } from './introPresentation';

describe('intro presentation', () => {
  it('keeps random events rare and deterministic at the boundaries', () => {
    assert.equal(pickIntroEvent(0), 'blackout');
    assert.equal(pickIntroEvent(0.03), 'chromatic-drift');
    assert.equal(pickIntroEvent(0.06), 'low-gravity');
    assert.equal(pickIntroEvent(0.08), 'static-bloom');
    assert.equal(pickIntroEvent(0.5), 'none');
  });

  it('lets the selected theme and event tune motion without changing layout', () => {
    assert.equal(introPhysicsForTheme('arcade', 'none').restitution, 0.82);
    assert.equal(introPhysicsForTheme('house', 'low-gravity').gravity, 72);
  });
});
