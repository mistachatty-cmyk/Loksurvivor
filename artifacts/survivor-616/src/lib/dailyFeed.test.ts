import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseDailyFeed, pickNote } from './dailyFeed';

const here = path.dirname(fileURLToPath(import.meta.url));

const note = (over: Record<string, unknown> = {}) => ({ id: 'a', from: '2026-10-01', until: '2026-10-31', title: 'T', line: 'L', ...over });

test('only well-formed notes survive parsing', () => {
  const parsed = parseDailyFeed({ notes: [note(), note({ id: '' }), note({ from: 'soon' }), note({ from: '2026-11-01', until: '2026-10-01' }), note({ line: 'x'.repeat(300) }), 'junk', null] });
  assert.equal(parsed.length, 1);
  assert.deepEqual(parseDailyFeed(null), []);
  assert.deepEqual(parseDailyFeed({ notes: 'no' }), []);
});

test('pickNote respects dates and never repeats a seen note', () => {
  const notes = parseDailyFeed({ notes: [note({ id: 'old', from: '2026-10-01', until: '2026-10-10' }), note({ id: 'new', from: '2026-10-20', until: '2026-11-01' })] });
  assert.equal(pickNote(notes, '2026-10-05', [])?.id, 'old');
  assert.equal(pickNote(notes, '2026-10-24', [])?.id, 'new');
  assert.equal(pickNote(notes, '2026-10-24', ['new']), null);
  assert.equal(pickNote(notes, '2026-12-01', []), null);
});

test('the shipped public/lok-daily.json is valid and every note in it parses', () => {
  const raw = JSON.parse(readFileSync(path.resolve(here, '../../public/lok-daily.json'), 'utf8')) as { notes: unknown[] };
  assert.ok(raw.notes.length > 0);
  assert.equal(parseDailyFeed(raw).length, raw.notes.length, 'a note in lok-daily.json is malformed or past the five-note limit');
});
