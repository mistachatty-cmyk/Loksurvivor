import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_FORMATS, LOK_SUBMISSIONS_RECIPIENT, isMountedAt } from '@lok/artist-submit';
import en from '../locales/en.json';
import { ARTIST_SUBMIT_CONFIG, ARTIST_SUBMIT_FEATURE } from './lokFeatures';

const messages = en as Record<string, string>;

test('616 Survivor opts in to artist submissions on the Music panel only', () => {
  assert.equal(ARTIST_SUBMIT_FEATURE.enabled, true);
  assert.equal(isMountedAt(ARTIST_SUBMIT_FEATURE, 'music'), true);
  assert.equal(isMountedAt(ARTIST_SUBMIT_FEATURE, 'hub'), false);
});

test('submissions go to the Lok and GSix owner account and name this app', () => {
  assert.ok(ARTIST_SUBMIT_CONFIG, 'the settings must build');
  assert.equal(ARTIST_SUBMIT_CONFIG!.recipient, LOK_SUBMISSIONS_RECIPIENT);
  assert.equal(ARTIST_SUBMIT_CONFIG!.appKey, 'survivor616');
  assert.equal(ARTIST_SUBMIT_CONFIG!.appLabel, '616 Survivor');
});

test('every accepted file type has translated copy', () => {
  for (const format of DEFAULT_FORMATS) {
    assert.ok(messages[`artistSubmit.format.${format.id}`], `missing artistSubmit.format.${format.id}`);
  }
});

test('every error code and every literal artistSubmit key used by the component exists in en.json', () => {
  for (const code of ['required', 'invalidEmail']) {
    assert.ok(messages[`artistSubmit.error.${code}`], `missing artistSubmit.error.${code}`);
  }
  const source = readFileSync(new URL('../ui/ArtistSubmitCta.tsx', import.meta.url), 'utf8');
  const used = new Set([...source.matchAll(/'(artistSubmit\.[A-Za-z0-9.]+)'/g)].map((match) => match[1]!));
  assert.ok(used.size > 15, 'expected the component to use many keys');
  for (const key of used) assert.ok(messages[key], `missing ${key}`);
});

test('the size note keeps its placeholder', () => {
  assert.match(messages['artistSubmit.step1.size']!, /\{\{mb\}\}/);
});
