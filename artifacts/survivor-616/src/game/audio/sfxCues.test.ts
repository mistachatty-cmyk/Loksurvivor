import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SFX_STYLE,
  MAX_CONCURRENT_VOICES,
  MIN_RETRIGGER_MS,
  SFX_CUE_BASE,
  resolveSfxParams,
  shouldPlayCue,
  type SfxCueId,
} from './sfxCues';
import { SOUND_PACKS } from '@/game/data/soundPacks';

const ALL_CUE_IDS = Object.keys(SFX_CUE_BASE) as SfxCueId[];

test('every SfxCueId has an authored SFX_CUE_BASE entry', () => {
  for (const cueId of ALL_CUE_IDS) {
    const base = SFX_CUE_BASE[cueId];
    assert.ok(base, `${cueId} is missing a base cue definition`);
    assert.ok(base.durationMs > 0, `${cueId}.durationMs must be positive`);
    assert.ok(base.gain > 0 && base.gain <= 1, `${cueId}.gain must be in (0, 1]`);
    assert.ok(base.freqStart > 0, `${cueId}.freqStart must be positive`);
  }
});

test('every SOUND_PACKS entry resolves cleanly for every cue', () => {
  for (const pack of SOUND_PACKS) {
    for (const cueId of ALL_CUE_IDS) {
      const resolved = resolveSfxParams(cueId, pack.style);
      assert.ok(resolved.durationMs > 0, `${pack.id}/${cueId} resolved to a non-positive duration`);
      assert.ok(resolved.gain >= 0 && resolved.gain <= 1, `${pack.id}/${cueId} resolved gain out of 0..1`);
      assert.ok(resolved.freqStart > 0, `${pack.id}/${cueId} resolved to a non-positive frequency`);
      if (resolved.noiseMix !== undefined) {
        assert.ok(resolved.noiseMix >= 0 && resolved.noiseMix <= 1, `${pack.id}/${cueId} resolved noiseMix out of 0..1`);
      }
    }
  }
});

test('resolveSfxParams merges base content with a pack style', () => {
  const style = { pitchMult: 2, brightnessMult: 0.5, noiseMult: 0, decayMult: 1.5, waveOverride: 'square' as const };
  const resolved = resolveSfxParams('hit', style);
  const base = SFX_CUE_BASE.hit;
  assert.equal(resolved.wave, 'square');
  assert.equal(resolved.freqStart, base.freqStart * 2);
  assert.equal(resolved.freqEnd, (base.freqEnd ?? base.freqStart) * 2);
  assert.equal(resolved.durationMs, base.durationMs * 1.5);
  assert.equal(resolved.gain, base.gain * 0.5);
  assert.equal(resolved.noiseMix, 0);
});

test('resolveSfxParams with DEFAULT_SFX_STYLE reproduces the base cue exactly', () => {
  for (const cueId of ALL_CUE_IDS) {
    const resolved = resolveSfxParams(cueId, DEFAULT_SFX_STYLE);
    const base = SFX_CUE_BASE[cueId];
    assert.equal(resolved.wave, base.wave);
    assert.equal(resolved.freqStart, base.freqStart);
    assert.equal(resolved.freqEnd, base.freqEnd ?? base.freqStart);
    assert.equal(resolved.durationMs, base.durationMs);
    assert.equal(resolved.gain, base.gain);
  }
});

test('shouldPlayCue allows an unthrottled cue every time', () => {
  assert.ok(!MIN_RETRIGGER_MS.levelUp, 'levelUp is expected to be unthrottled for this test to be meaningful');
  assert.equal(shouldPlayCue('levelUp', 1000, 999, 0), true);
  assert.equal(shouldPlayCue('levelUp', 1000, 1000, 0), true);
});

test('shouldPlayCue enforces the per-cue minimum retrigger interval', () => {
  const minInterval = MIN_RETRIGGER_MS.hit!;
  assert.equal(shouldPlayCue('hit', 1000, 1000 - minInterval + 1, 0), false);
  assert.equal(shouldPlayCue('hit', 1000, 1000 - minInterval, 0), true);
  assert.equal(shouldPlayCue('hit', 1000, undefined, 0), true, 'a cue never played before should always be allowed');
});

test('shouldPlayCue enforces the concurrent-voice ceiling regardless of throttling', () => {
  assert.equal(shouldPlayCue('levelUp', 1000, undefined, MAX_CONCURRENT_VOICES), false);
  assert.equal(shouldPlayCue('levelUp', 1000, undefined, MAX_CONCURRENT_VOICES - 1), true);
});
