import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStoredVolume, positionFromPointer, sliderToVolume, volumeToSlider, DEFAULT_VOLUME } from './volumeCurve';

test('slider curve round-trips and keeps the ends fixed', () => {
  assert.equal(sliderToVolume(0), 0);
  assert.equal(sliderToVolume(1), 1);
  assert.ok(Math.abs(volumeToSlider(sliderToVolume(0.37)) - 0.37) < 1e-9);
  assert.ok(sliderToVolume(0.5) < 0.5);
});

test('slider curve clamps junk input', () => {
  assert.equal(sliderToVolume(-3), 0);
  assert.equal(sliderToVolume(9), 1);
  assert.equal(sliderToVolume(Number.NaN), 0);
});

test('pointer position is clamped to the track', () => {
  assert.equal(positionFromPointer(50, 100, 200), 0);
  assert.equal(positionFromPointer(200, 100, 200), 0.5);
  assert.equal(positionFromPointer(999, 100, 200), 1);
  assert.equal(positionFromPointer(10, 0, 0), 0);
});

test('stored volume falls back to the default for bad data', () => {
  assert.deepEqual(parseStoredVolume(null), DEFAULT_VOLUME);
  assert.deepEqual(parseStoredVolume('nope'), DEFAULT_VOLUME);
  assert.deepEqual(parseStoredVolume('{"volume":"x"}'), DEFAULT_VOLUME);
  assert.deepEqual(parseStoredVolume('{"volume":2,"muted":true}'), { volume: 1, muted: true });
});
