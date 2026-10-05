import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MUSIC_APP_KEY, musicObjectives } from './lokMusicProgress';

test('objectives are a whole, non-negative number whatever the save holds', () => {
  assert.equal(musicObjectives({ soundtrackObjectiveCompletions: 7 }), 7);
  assert.equal(musicObjectives({ soundtrackObjectiveCompletions: 3.9 }), 3);
  assert.equal(musicObjectives({ soundtrackObjectiveCompletions: -2 }), 0);
  assert.equal(musicObjectives({ soundtrackObjectiveCompletions: Number.NaN }), 0);
  assert.equal(musicObjectives({}), 0);
});

test('the catalog gates use the same app key this game publishes under', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const catalog = JSON.parse(readFileSync(path.join(here, '../../public/lok-soundtrack.json'), 'utf8'));
  for (const track of catalog.tracks) assert.equal(track.gate.app, MUSIC_APP_KEY);
});
