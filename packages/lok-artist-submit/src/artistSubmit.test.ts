import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_FORMATS,
  LOK_SUBMISSIONS_RECIPIENT,
  buildEmailText,
  buildMailtoUrl,
  buildSubmissionEmail,
  cleanField,
  createArtistSubmitConfig,
  isMountedAt,
  parseArtistSubmitFeature,
  validateSubmission,
} from './index';

const config = createArtistSubmitConfig({ appKey: 'survivor616', appLabel: '616 Survivor' });

test('the default recipient is the Lok and GSix owner account', () => {
  assert.equal(LOK_SUBMISSIONS_RECIPIENT, 'mistachatty@gmail.com');
  assert.equal(config.recipient, 'mistachatty@gmail.com');
});

test('default formats are unique and exactly one is preferred', () => {
  assert.equal(new Set(DEFAULT_FORMATS.map((format) => format.id)).size, DEFAULT_FORMATS.length);
  assert.equal(DEFAULT_FORMATS.filter((format) => format.preferred).length, 1);
});

test('a config that could never work is refused', () => {
  assert.throws(() => createArtistSubmitConfig({ appKey: '', appLabel: 'x' }));
  assert.throws(() => createArtistSubmitConfig({ appKey: 'x', appLabel: '' }));
  assert.throws(() => createArtistSubmitConfig({ appKey: 'x', appLabel: 'x', recipient: 'nope' }));
  assert.throws(() => createArtistSubmitConfig({ appKey: 'x', appLabel: 'x', formats: [] }));
  assert.throws(() => createArtistSubmitConfig({ appKey: 'x', appLabel: 'x', maxAttachmentMb: 0 }));
  assert.throws(() =>
    createArtistSubmitConfig({
      appKey: 'x',
      appLabel: 'x',
      formats: [{ id: 'a', ext: 'a', preferred: true }, { id: 'a', ext: 'b', preferred: false }],
    }),
  );
});

test('validation asks for all three fields and checks the email shape', () => {
  const empty = validateSubmission({ creatorName: ' ', creatorEmail: '', workTitle: '' });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.deepEqual(empty.errors, { creatorName: 'required', creatorEmail: 'required', workTitle: 'required' });

  const bad = validateSubmission({ creatorName: 'A', creatorEmail: 'not-an-email', workTitle: 'Song' });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.deepEqual(bad.errors, { creatorEmail: 'invalidEmail' });

  const good = validateSubmission({ creatorName: '  Ada   Lovelace ', creatorEmail: 'ada@example.com', workTitle: 'Night  Shift' });
  assert.equal(good.ok, true);
  if (good.ok) assert.deepEqual(good.value, { creatorName: 'Ada Lovelace', creatorEmail: 'ada@example.com', workTitle: 'Night Shift' });
});

test('line breaks and control characters cannot smuggle in extra mail headers', () => {
  const cleaned = cleanField('Ada\r\nBcc: evil@example.com\u0000');
  assert.ok(!/[\r\n\u0000]/.test(cleaned));

  const result = validateSubmission({
    creatorName: 'Ada\r\nBcc: evil@example.com',
    creatorEmail: 'ada@example.com',
    workTitle: 'Song\nCc: evil@example.com',
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const url = buildMailtoUrl(buildSubmissionEmail(result.value, config));
  const subject = decodeURIComponent(new URLSearchParams(url.split('?')[1]).get('subject')!);
  assert.ok(!/[\r\n]/.test(subject), 'subject stays on one line');
  assert.ok(url.startsWith('mailto:mistachatty@gmail.com?'));
});

test('long values are capped', () => {
  assert.equal(cleanField('x'.repeat(500)).length, 120);
  const result = validateSubmission({ creatorName: 'n'.repeat(400), creatorEmail: 'a@b.co', workTitle: 't'.repeat(400) });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.creatorName.length, 120);
    assert.equal(result.value.workTitle.length, 120);
  }
});

test('the email carries the three fields, the app, and a reminder to attach the file', () => {
  const email = buildSubmissionEmail(
    { creatorName: 'Ada Lovelace', creatorEmail: 'ada@example.com', workTitle: 'Night Shift' },
    config,
  );
  assert.equal(email.to, 'mistachatty@gmail.com');
  assert.match(email.subject, /Night Shift/);
  assert.match(email.subject, /Ada Lovelace/);
  assert.match(email.subject, /616 Survivor/);
  assert.match(email.body, /Creator name: Ada Lovelace/);
  assert.match(email.body, /Contact email: ada@example\.com/);
  assert.match(email.body, /Song \/ project: Night Shift/);
  assert.match(email.body, /WAV, MP3, M4A, FLAC/);
  assert.match(buildEmailText(email), /^To: mistachatty@gmail\.com\nSubject: /);
});

test('the mailto link round-trips subject and body, including punctuation and accents', () => {
  const email = buildSubmissionEmail(
    { creatorName: 'Zoë & The "Night" Crew', creatorEmail: 'zoe@example.com', workTitle: "Rock'n'Roll #1 (demo) 100%" },
    config,
  );
  const url = buildMailtoUrl(email);
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  assert.equal(params.get('subject'), email.subject);
  assert.equal(params.get('body'), email.body);
});

test('a host can point at its own recipient', () => {
  const custom = createArtistSubmitConfig({ appKey: 'x', appLabel: 'X', recipient: 'music@example.org' });
  const email = buildSubmissionEmail({ creatorName: 'A', creatorEmail: 'a@b.co', workTitle: 'T' }, custom);
  assert.ok(buildMailtoUrl(email).startsWith('mailto:music@example.org?'));
});

test('the manifest opt-in: absent or malformed means off', () => {
  for (const value of [undefined, null, 'yes', 7, [], {}, { mount: [] }, { mount: ['nowhere'] }, { enabled: false, mount: ['music'] }]) {
    assert.deepEqual(parseArtistSubmitFeature(value), { enabled: false, mounts: [] }, JSON.stringify(value));
  }
});

test('the manifest opt-in: known mount points turn it on, unknown ones are ignored', () => {
  const feature = parseArtistSubmitFeature({ mount: ['music', 'bogus', 'hub'] });
  assert.equal(feature.enabled, true);
  assert.deepEqual([...feature.mounts], ['music', 'hub']);
  assert.equal(isMountedAt(feature, 'music'), true);
  assert.equal(isMountedAt(feature, 'studio'), false);
  assert.equal(isMountedAt(parseArtistSubmitFeature(undefined), 'music'), false);
});

test('the manifest may name its own recipient, but only a real address', () => {
  assert.equal(parseArtistSubmitFeature({ mount: ['music'], recipient: 'music@example.org' }).recipient, 'music@example.org');
  assert.equal(parseArtistSubmitFeature({ mount: ['music'], recipient: 'junk' }).recipient, undefined);
});
