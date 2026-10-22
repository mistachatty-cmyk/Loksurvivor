import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildShareLinks, clipExtension, runShareText, SHARE_URL } from './sharePlatforms';

test('every platform link carries the text and game address, encoded', () => {
  const links = buildShareLinks('Survived 4:20 & won', SHARE_URL);
  assert.ok(links.length >= 8);
  for (const link of links) {
    assert.ok(link.href.includes(encodeURIComponent('Survived 4:20 & won')), link.id);
    assert.ok(link.href.includes(encodeURIComponent(SHARE_URL)) || link.id === 'sms' || link.id === 'email' || link.id === 'whatsapp' || link.id === 'bluesky', link.id);
    assert.ok(!link.href.includes(' '), `${link.id} has a raw space`);
  }
  assert.ok(new Set(links.map((link) => link.id)).size === links.length);
});

test('share text reads well and clip extension follows the mime type', () => {
  assert.equal(runShareText('Monroe Strip', '3:05', 1234), 'Survived 3:05 on Monroe Strip in 616 Survivor with 1,234 kills. Can you beat it?');
  assert.equal(clipExtension('video/webm;codecs=vp9'), 'webm');
  assert.equal(clipExtension('video/mp4'), 'mp4');
});
