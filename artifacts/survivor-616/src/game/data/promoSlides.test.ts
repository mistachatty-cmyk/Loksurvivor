import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CHANGELOG } from '@/game/data/changelog';
import { PINNED_PROMOS, buildPromoSlides } from '@/game/data/promoSlides';

const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');

describe('promo slides', () => {
  it('posts pinned items first, then the newest updates, newest first', () => {
    const slides = buildPromoSlides(CHANGELOG);
    assert.deepEqual(slides.slice(0, PINNED_PROMOS.length).map((s) => s.id), PINNED_PROMOS.map((s) => s.id));
    const updates = slides.filter((s) => s.art === 'update');
    assert.equal(updates.length, 3);
    assert.deepEqual(updates[0]!.target, { screen: 'update', version: CHANGELOG[CHANGELOG.length - 1]!.version });
  });

  it('has unique ids, clipped blurbs and kid-safe text', () => {
    const slides = buildPromoSlides(CHANGELOG);
    assert.equal(new Set(slides.map((s) => s.id)).size, slides.length);
    for (const slide of slides) {
      assert.ok(slide.blurb.length <= 110, slide.id);
      assert.doesNotMatch(`${slide.title} ${slide.blurb}`, BANNED);
    }
  });

  it('every update link points at a real changelog version', () => {
    const versions = new Set(CHANGELOG.map((e) => e.version));
    for (const slide of buildPromoSlides(CHANGELOG)) if (slide.target.screen === 'update') assert.ok(versions.has(slide.target.version));
  });
});
